(() => {
  'use strict';
  const dial = document.querySelector('.island-dial');
  const options = [...dial.querySelectorAll('[data-category]')];
  const panels = [...document.querySelectorAll('.category-panel')];
  const center = dial.querySelector('.dial-center');
  const current = document.getElementById('dial-current');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 3;
  let rotation = 135;
  let wheelTotal = 0;
  let wheelTimer;
  let pointer;
  let ignoreClickUntil = 0;
  const behavior = () => reducedMotion.matches ? 'instant' : 'smooth';
  function select(index) {
    const next = (index + options.length) % options.length;
    let difference = next - selected;
    if (difference > options.length / 2) difference -= options.length;
    if (difference < -options.length / 2) difference += options.length;
    rotation += difference * 45;
    selected = next;
    dial.style.setProperty('--turn', rotation + 'deg');
    options.forEach((option, i) => {
      if (i === selected) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    });
    const label = options[selected].textContent;
    current.textContent = label;
    center.setAttribute('aria-label', 'Open ' + label + ' category');
    center.setAttribute('aria-controls', options[selected].dataset.category);
  }
  function open(index, {history = true, focus = true} = {}) {
    clearTimeout(wheelTimer);
    select(index);
    const id = options[selected].dataset.category;
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    if (history && location.hash !== '#' + id) window.history.pushState(null, '', '#' + id);
    const panel = document.getElementById(id);
    if (focus) panel.querySelector('h2').focus({preventScroll: true});
    panel.scrollIntoView({behavior: behavior(), block: 'start'});
  }
  function home({history = true, focus = true} = {}) {
    clearTimeout(wheelTimer);
    panels.forEach(panel => { panel.hidden = true; });
    if (history) window.history.pushState(null, '', location.pathname + location.search);
    if (focus) center.focus({preventScroll: true});
    document.getElementById('island').scrollIntoView({behavior: behavior(), block: 'start'});
  }
  function route() {
    const index = options.findIndex(option => '#' + option.dataset.category === location.hash);
    if (index >= 0) open(index, {history: false, focus: false});
    else home({history: false, focus: false});
  }
  options.forEach((option, index) => {
    option.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (Date.now() >= ignoreClickUntil) open(index);
    });
  });
  center.addEventListener('click', () => { if (Date.now() >= ignoreClickUntil) open(selected); });
  document.querySelectorAll('.back-to-wheel').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); home();
  }));
  dial.addEventListener('keydown', event => {
    const direction = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
    if (direction) {
      event.preventDefault(); select(selected + direction); options[selected].focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); select(event.key === 'Home' ? 0 : options.length - 1); options[selected].focus();
    }
  });
  dial.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault();
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    wheelTotal += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
    if (Math.abs(wheelTotal) >= 45) {
      select(selected + Math.sign(wheelTotal)); wheelTotal = 0;
    }
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTotal = 0; open(selected); }, 280);
  }, {passive: false});
  dial.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, selected};
  });
  dial.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
      if (!dial.hasPointerCapture(event.pointerId)) dial.setPointerCapture(event.pointerId);
      select(pointer.selected + Math.trunc(-dx / 45));
      pointer.dragging = true;
    }
  });
  dial.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (pointer.dragging) {
      ignoreClickUntil = Date.now() + 500;
      open(selected);
    }
    pointer = null;
  });
  dial.addEventListener('pointercancel', () => { pointer = null; });
  document.querySelectorAll('.choice-detail').forEach(detail => detail.addEventListener('toggle', () => {
    if (detail.open) detail.parentElement.querySelectorAll('.choice-detail').forEach(other => { if (other !== detail) other.open = false; });
  }));
  window.addEventListener('popstate', route);
  window.addEventListener('hashchange', route);
  select(selected);
  route();
})();
