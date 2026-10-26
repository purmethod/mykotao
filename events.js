(() => {
  'use strict';
  const category = document.getElementById('category');
  const list = document.getElementById('events');
  const status = document.getElementById('feed-status');
  const sourceList = document.getElementById('sources');
  const types = {'parties':'PARTIES','raves':'RAVES','retreats':'RETREATS','yoga-retreats':'YOGA RETREATS','workshops':'WORKSHOPS','live-music':'LIVE MUSIC','community':'COMMUNITY','wellness':'YOGA & WELLNESS','sports':'SPORTS & ADVENTURE','conservation':'CONSERVATION'};
  const requestedCategory = new URLSearchParams(location.search).get('category');
  if (requestedCategory === 'all' || Object.hasOwn(types, requestedCategory)) category.value = requestedCategory;
  const dateFormat = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'});
  const timeFormat = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit',hour12:false});
  const dayFormat = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'});
  let feed;
  let fallback = false;
  const node = (tag, text, className) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  };
  const safeURL = value => {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
    } catch { return null; }
  };
  function lastDay(months) {
    const parts = Object.fromEntries(dayFormat.formatToParts(new Date()).map(p => [p.type,p.value]));
    const target = new Date(Date.UTC(Number(parts.year),Number(parts.month)-1+months,1));
    const days = new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
    target.setUTCDate(Math.min(Number(parts.day),days));
    return target.toISOString().slice(0,10);
  }
  function dateKey(value) {
    const parts = Object.fromEntries(dayFormat.formatToParts(new Date(value)).map(p => [p.type,p.value]));
    return parts.year+'-'+parts.month+'-'+parts.day;
  }
  function render() {
    list.replaceChildren();
    const today = dateKey(new Date());
    const cutoff = lastDay(12);
    const now = Date.now();
    const events = feed.events.filter(e => {
      const start = Date.parse(e.start), end = Date.parse(e.end || e.start), checked = Date.parse(e.checkedAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(checked) || !safeURL(e.url)) return false;
      if (now-checked > 7*86400000) return false;
      if (e.end && !e.dateOnly && end < now) return false;
      if (dateKey(e.end || e.start) < today || dateKey(e.start) > cutoff) return false;
      return category.value === 'all' || e.category === category.value || (category.value === 'retreats' && e.category === 'yoga-retreats');
    }).sort((a,b) => Date.parse(a.start)-Date.parse(b.start));
    const old = Date.now()-Date.parse(feed.updatedAt)>48*3600000;
    status.textContent = events.length+' EVENT'+(events.length===1?'':'S')+' · NEXT 12 MONTHS · UPDATED '+dateFormat.format(new Date(feed.updatedAt))+(fallback?' · SAVED COPY':'')+(old?' · UPDATE DELAYED':'');
    if (!events.length) {
      list.append(node('p','No upcoming events listed for this selection yet. Try another category or check back soon.','empty'));
      return;
    }
    for (const e of events) {
      const article = node('article',undefined,'event');
      const date = node('p',dateFormat.format(new Date(e.start)).toUpperCase(),'event-date');
      if (e.end && dateKey(e.start)!==dateKey(e.end) && ['retreats','yoga-retreats'].includes(e.category)) {
        date.textContent += ' – '+dateFormat.format(new Date(e.end)).toUpperCase();
      }
      if (!e.dateOnly) {
        let times = timeFormat.format(new Date(e.start));
        if (e.end && !['retreats','yoga-retreats'].includes(e.category)) {
          times += ' – '+timeFormat.format(new Date(e.end));
          if (dateKey(e.start)!==dateKey(e.end)) times += ' (+1 DAY)';
        }
        date.append(node('span',times,'event-time'));
      }
      if (e.dateOnly) date.append(node('span','TIME TO BE CONFIRMED','event-time'));
      const body = node('div');
      body.append(node('p',types[e.category] || 'EVENT','event-type'),node('h2',e.title),node('p',e.location,'event-location'),node('p',e.summary,'event-description'));
      if (e.schedule) body.append(node('p',e.schedule==='weekly-program'?'WEEKLY PROGRAM · CONFIRM WITH VENUE':'PUBLISHED RECURRING EVENT','event-type'));
      if (e.note) body.append(node('p',e.note,'event-description'));
      if (e.stale || Date.now()-Date.parse(e.checkedAt)>48*3600000) body.append(node('p','Last-known listing. Check the original for changes.','stale'));
      const link = node('a','VIEW ORIGINAL','source-link');
      link.href = safeURL(e.url); link.target='_blank'; link.rel='noopener noreferrer';
      link.setAttribute('aria-label','View original listing for '+e.title);
      body.append(link); article.append(date,body); list.append(article);
    }
  }
  async function getFeed(url) {
    const response = await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});
    if (!response.ok) throw new Error('Feed unavailable');
    const data = await response.json();
    if (!Array.isArray(data.events) || !Number.isFinite(Date.parse(data.updatedAt))) throw new Error('Invalid event feed');
    return data;
  }
  async function init() {
    try {
      // The scheduled collector commits data to main. No website redeployment is needed for new events.
      feed = await getFeed('https://raw.githubusercontent.com/purmethod/mykotao/main/data/events.json?t='+Math.floor(Date.now()/3600000));
    } catch {
      try { feed = await getFeed('/data/events.json'); fallback=true; }
      catch { status.textContent='The event feed is temporarily unavailable. Please try again later.'; return; }
    }
    for (const source of feed.sources || []) {
      const item = node('li');
      const link = node('a',source.name);
      const url = safeURL(source.url);
      if (url) { link.href=url; link.target='_blank'; link.rel='noopener noreferrer'; item.append(link); }
      else item.textContent=source.name;
      if (source.status==='ok') item.append(document.createTextNode(' · '+source.eventsFound+' upcoming listings'));
      if (source.status!=='ok') item.append(document.createTextNode(' · latest check incomplete'));
      if (source.coverage) item.append(node('p',source.coverage));
      sourceList.append(item);
    }
    render();
    category.addEventListener('change',render);
  }
  init();
})();

