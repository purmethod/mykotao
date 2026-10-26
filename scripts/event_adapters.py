"""Adapters for public Koh Tao calendars. No login, poster inference or paid API."""
from datetime import datetime, timedelta
from html import unescape
from html.parser import HTMLParser
import json
import re
from urllib.parse import urljoin, urlsplit, parse_qs
from zoneinfo import ZoneInfo

TZ = ZoneInfo('Asia/Bangkok')


def text(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]*>', ' ', str(value or '')))).strip()


def clock(value):
    value = value.strip().lower().replace(' ', '')
    for fmt in ('%I:%M%p', '%I%p', '%H:%M'):
        try:
            return datetime.strptime(value, fmt).time()
        except ValueError:
            pass
    raise ValueError('Unrecognized published time')


def local(day, value):
    return datetime.combine(datetime.fromisoformat(day).date(), clock(value), TZ)


def jungle(html, source, url, now):
    match = re.search(r'<script\b[^>]*\bid=["\']jungle-party-data["\'][^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ValueError('Published party data not found')
    events = []
    # These are explicitly dated entries from the island calendar, not invented recurrence.
    names = {'LBMF': ('Leo Beach Music Festival', 'Sai Thong Beach, Koh Tao'),
             'Jungle Party': ('Jungle Party', 'Escobar, Koh Tao'),
             'Secret Party': ('Secret Party', 'Karma Bar, Koh Tao'),
             'Hii Festival': ('Hii Festival', 'Koh Tao — confirm venue with organizer')}
    for entry in json.loads(match[1]):
        title, venue = names.get(entry.get('name'), (entry.get('name'), 'Koh Tao — see original for venue'))
        events.append({'name': title, 'startDate': entry.get('date'), 'location': venue,
                       'description': 'Party', 'url': entry.get('url') or source['url']})
    return events, []


def ics_unescape(value):
    return re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value)


def ics_date(value, params=''):
    zone = re.search(r'TZID=([^;:]+)', params)
    tz = ZoneInfo(zone[1].strip('"')) if zone else TZ
    for fmt in ('%Y%m%dT%H%M%SZ', '%Y%m%dT%H%M%S', '%Y%m%d'):
        try:
            d = datetime.strptime(value, fmt)
            return d.replace(tzinfo=ZoneInfo('UTC') if value.endswith('Z') else tz).astimezone(TZ)
        except ValueError:
            pass
    raise ValueError('Invalid iCalendar date')


def ical(html, source, url, now):
    if 'BEGIN:VCALENDAR' not in html:
        raise ValueError('iCalendar feed missing')
    lines = re.sub(r'\r?\n[ \t]', '', html).splitlines()
    records, record = [], None
    for line in lines:
        if line == 'BEGIN:VEVENT':
            record = {}
        elif line == 'END:VEVENT':
            if record is not None:
                records.append(record)
            record = None
        elif record is not None and ':' in line:
            left, value = line.split(':', 1)
            key, _, params = left.partition(';')
            record.setdefault(key, []).append((value, params))
    def get(r, key, default=''):
        return r.get(key, [(default, '')])[0][0]
    def date(r, key):
        value, params = r[key][0]
        return ics_date(value, params)
    # Replaced/cancelled instances override a recurring master by UID and original start.
    overrides = {}
    for r in records:
        if 'RECURRENCE-ID' in r:
            overrides[(get(r, 'UID'), date(r, 'RECURRENCE-ID'))] = r
    events = []
    cutoff = now + timedelta(days=367)  # normalize applies exact twelve-calendar-month boundary.
    def emit(r, start, duration, recurring=False):
        if get(r, 'STATUS').upper() == 'CANCELLED':
            return
        date_only = len(get(r, 'DTSTART')) == 8
        events.append({'name': ics_unescape(get(r, 'SUMMARY')),
            'startDate': start.date().isoformat() if date_only else start.isoformat(),
            # DTEND is exclusive for an all-day iCalendar event.
            'endDate': (start + duration - timedelta(days=1)).date().isoformat() if date_only and duration else (start + duration).isoformat() if duration else None,
            'location': ics_unescape(get(r, 'LOCATION')) or source.get('location'),
            'description': ics_unescape(get(r, 'DESCRIPTION')),
            'url': get(r, 'URL') or next(iter(re.findall(r'https://www\.eventpop\.me/e/\d+', get(r, 'DESCRIPTION'))), source['url']),
            'schedule': 'published-recurrence' if recurring else None})
    for r in records:
        if 'RECURRENCE-ID' in r or 'DTSTART' not in r or get(r, 'STATUS').upper() == 'CANCELLED':
            continue
        start = date(r, 'DTSTART')
        duration = date(r, 'DTEND') - start if 'DTEND' in r else timedelta(0)
        rule = dict(part.split('=', 1) for part in get(r, 'RRULE').split(';') if '=' in part)
        if not rule:
            emit(r, start, duration)
            continue
        if rule.get('FREQ') != 'WEEKLY' or set(rule) - {'FREQ', 'INTERVAL', 'BYDAY', 'UNTIL', 'COUNT', 'WKST'} or 'RDATE' in r:
            raise ValueError('Unsupported recurrence; do not infer dates')
        weekdays = {'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6}
        days = [weekdays[x] for x in rule.get('BYDAY', list(weekdays)[start.weekday()]).split(',')]
        interval = max(1, int(rule.get('INTERVAL', '1')))
        week_start = weekdays[rule.get('WKST', 'MO')]
        anchor = start.date() - timedelta(days=(start.weekday() - week_start) % 7)
        until = ics_date(rule['UNTIL']) if 'UNTIL' in rule else now + timedelta(days=28)
        stop = min(cutoff, until)
        count = int(rule.get('COUNT', '100000'))
        exclusions = {ics_date(v, p) for values, p in r.get('EXDATE', []) for v in values.split(',')}
        day, n = start, 0
        if (stop - start).days > 10000:
            raise ValueError('Recurrence exceeds expansion budget')
        while day <= stop and n < count:
            week = (day.date() - anchor).days // 7
            if day.weekday() in days and week % interval == 0:
                n += 1
                override = overrides.get((get(r, 'UID'), day))
                if day not in exclusions and override is None and (day + duration).date() >= now.date():
                    emit(r, day, duration, True)
            day += timedelta(days=1)
    for r in overrides.values():
        if 'DTSTART' in r:
            start = date(r, 'DTSTART')
            emit(r, start, date(r, 'DTEND') - start if 'DTEND' in r else timedelta(0), True)
    return events, []


class BlueSchedule(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.day = self.current = self.field = None
        self.events, self.links = [], []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'section' and re.fullmatch(r'day-\d{4}-\d{2}-\d{2}', a.get('id', '')):
            self.day = a['id'][4:]
        if tag == 'article' and 'site-book-card' in a.get('class', '').split():
            self.current = {'day': self.day}
        if self.current is not None:
            classes = a.get('class', '').split()
            field = 'name' if tag == 'strong' else 'time' if 'site-book-time' in classes else 'location' if 'site-book-meta' in classes else 'description' if 'site-book-desc' in classes else None
            if field:
                self.field = (tag, field)
                self.current[field] = ''
        if tag == 'a' and a.get('href'):
            self.links.append(a['href'])
    def handle_data(self, data):
        if self.current is not None and self.field:
            self.current[self.field[1]] += data
    def handle_endtag(self, tag):
        if self.field and tag == self.field[0]:
            self.field = None
        if tag == 'article' and self.current is not None:
            self.events.append(self.current)
            self.current = None
        if tag == 'section':
            self.day = None


def blue_chitta(html, source, url, now):
    page, events = BlueSchedule(html), []
    if 'site-book' not in html:
        raise ValueError('Schedule markup missing')
    for entry in page.events:
        if not entry.get('day'):
            continue
        times = re.split(r'\s*[-–]\s*', entry.get('time', ''))
        if len(times) != 2:
            continue
        start, end = local(entry['day'], times[0]), local(entry['day'], times[1])
        if end < start:
            end += timedelta(days=1)
        events.append({'name': text(entry.get('name')), 'startDate': start.isoformat(), 'endDate': end.isoformat(),
                       'location': text(entry.get('location', '').split('·')[0]) + ', Koh Tao',
                       'description': text(entry.get('description')), 'url': url,
                       'category': 'sports' if re.search(r'freediv|snorkel', entry.get('description', ''), re.I) else 'wellness'})
    links = []
    if events:
        for href in page.links:
            link = urljoin(url, href)
            p = urlsplit(link)
            q = parse_qs(p.query)
            week = q.get('week', [''])[0]
            if p.path == '/schedule/' and set(q) == {'week'} and re.fullmatch(r'\d{4}-\d{2}-\d{2}', week) and now.date().isoformat() < week <= (now + timedelta(days=28)).date().isoformat():
                links.append(link)
    return events, links


def todo_today(html, source, url, now):
    data = json.loads(html)
    if data.get('channel') != 'koh-tao' or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', data.get('target_date', '')):
        raise ValueError('Calendar channel/date mismatch')
    day, events = data['target_date'], []
    for section in data.get('sections', []):
        for entry in section.get('events', []):
            link = entry.get('link', '')
            match = re.search(r'^https://todo\.today/koh-tao/(\d{4})/(\d{2})/(\d{2})/', link)
            if not match or '-'.join(match.groups()) != day or entry.get('status') not in ('publish', 'published-app') or not entry.get('venue'):
                continue
            start, end = day, None
            if entry.get('start_time'):
                start = local(day, entry['start_time']).isoformat()
            if entry.get('end_time') and 'T' in start:
                end = local(day, entry['end_time'])
                if end < datetime.fromisoformat(start):
                    end += timedelta(days=1)
                end = end.isoformat()
            events.append({'name': entry.get('name'), 'startDate': start, 'endDate': end,
                'location': entry['venue'] + ', Koh Tao', 'url': link,
                'category': 'wellness' if entry.get('category_id') == 1 else None})
    # Public API advertises its own dated pages. Limit rolling discovery to two weeks.
    links = [source['dataUrl'] + '&event_date=' + d['date'] for d in data.get('days', [])
             if d.get('count', 0) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', d.get('date', ''))
             and now.date().isoformat() <= d['date'] <= (now + timedelta(days=13)).date().isoformat()]
    return events, links


def weekly_pages(html, source, url, now):
    body, events = text(html), []
    if source['id'] == 'choppers':
        rules = [
            ('Koh Tao Pub Crawl', [0, 2, 4, 6], '18:00', 'parties', r'Monday, Wednesday, Friday, and Sunday', r'check-in at 1800'),
            ('Jam Jar Open Mic', [1, 3], '19:00', 'live-music', r'Every tuesday and thursday from 7pm', r'Jam Jar'),
            ('Choppers Pub Quiz', [4], '19:30', 'community', r'Every FRIDAY', r'quiz starts promptly at 7:30 pm')]
    else:
        rules = [('Beach Cleanup', [6], '17:30', 'conservation', r'Beach Cleanups', r'Every Sunday at 17:30 h'),
                 ('Ocean Insights', [5], '19:00', 'conservation', r'Ocean Insights', r'Last Saturday of every month at 19:00 h')]
    for name, weekdays, hour, category, guard1, guard2 in rules:
        if not re.search(guard1, body, re.I) or not re.search(guard2, body, re.I):
            raise ValueError('Weekly schedule changed; review published rule: ' + name)
        for delta in range(28):
            day = now.date() + timedelta(days=delta)
            if day.weekday() not in weekdays:
                continue
            if name == 'Ocean Insights' and (day + timedelta(days=7)).month == day.month:
                continue
            events.append({'name': name, 'startDate': local(day.isoformat(), hour).isoformat(),
                'location': source['location'], 'category': category, 'url': source['url'],
                'schedule': 'weekly-program',
                'note': '18:00 is check-in time.' if name == 'Koh Tao Pub Crawl' else None})
    return events, []


def hii(html, source, url, now):
    if 'BEGIN:VCALENDAR' in html:
        return ical(html, source, url, now)
    data = json.loads(html)
    if not isinstance(data, list):
        raise ValueError('Unexpected Hii event response')
    events = []
    links = []
    for entry in data:
        if entry.get('status') != 'PUBLISHED':
            continue
        ticket = re.fullmatch(r'https://www\.eventpop\.me/e/(\d+)(?:\?.*)?', entry.get('ticketUrl', ''))
        if ticket and entry.get('date', '')[:10] >= now.date().isoformat():
            links.append('https://www.eventpop.me/event_details/' + ticket[1] + '/calendar.ics')
        start, end, note = entry.get('date'), entry.get('endDate'), None
        # Some official records serialize local hours as UTC. Do not silently shift the event day.
        date_match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})', entry.get('title', ''), re.I)
        if date_match and start:
            published = datetime.strptime(' '.join(date_match.groups()), '%B %d %Y').date().isoformat()
            if datetime.fromisoformat(start.replace('Z', '+00:00')).astimezone(TZ).date().isoformat() != published:
                start, end = published, None
                note = 'Organizer date and time fields disagree. Confirm start time with the organizer.'
        events.append({'name': entry.get('title'), 'startDate': start, 'endDate': end, 'note': note,
            'location': entry.get('location'), 'description': entry.get('description'),
            'category': 'parties', 'url': source['url']})
    return events, links


ADAPTERS = {'jungle': jungle, 'ical': ical, 'blue-chitta': blue_chitta,
            'todo-today': todo_today, 'weekly-page': weekly_pages, 'hii': hii}
