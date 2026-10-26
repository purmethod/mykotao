(() => {
  'use strict';
  const dial = document.querySelector('.island-dial');
  const options = [...dial.querySelectorAll('[data-category]')];
  const panels = [...document.querySelectorAll('.category-panel')];
  const picker = dial.querySelector('.picker-window');
  const rows = [...picker.querySelectorAll('[data-picker-index]')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const count = options.length, step = 360 / count, rowHeight = 34;
  const wrap = value => ((value % count) + count) % count;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const angleDelta = (next, previous) => ((next - previous + 540) % 360) - 180;
  let position = 3, selected = 3, pointer = null, frame = 0, wheelTimer;
  let ignoreClickUntil = 0;
  const behavior = () => reducedMotion.matches ? 'instant' : 'smooth';

  function render() {
    selected = wrap(Math.round(position));
    dial.style.setProperty('--turn', (-position * step) + 'deg');
    options.forEach((option, i) => {
      const angle = (i - position) * step * Math.PI / 180;
      option.style.setProperty('--x', (50 + 39 * Math.sin(angle)) + '%');
      option.style.setProperty('--y', (50 - 39 * Math.cos(angle)) + '%');
      if (i === selected) option.setAttribute('aria-current', 'true');
      else option.removeAttribute('aria-current');
    });
    rows.forEach((row, i) => {
      const distance = wrap(i - position + count / 2) - count / 2;
      const visible = Math.abs(distance) < 2;
      row.style.transform = 'translateY(' + (distance * rowHeight) + 'px) rotateX(' + (-distance * 24) + 'deg) scale(' + Math.max(.65, 1 - Math.abs(distance) * .13) + ')';
      row.style.opacity = visible ? Math.max(0, 1 - Math.abs(distance) * .48) : 0;
      row.style.pointerEvents = visible ? 'auto' : 'none';
      row.setAttribute('aria-selected', String(i === selected));
    });
    picker.setAttribute('aria-activedescendant', rows[selected].id);
  }
  function stop() {
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(wheelTimer);
  }
  function settle(target = Math.round(position)) {
    stop();
    const start = position, difference = target - start;
    if (reducedMotion.matches || Math.abs(difference) < .001) {
      position = target; render(); return;
    }
    const began = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - began) / 280);
      position = start + difference * (1 - (1 - progress) ** 3);
      render();
      if (progress < 1) frame = requestAnimationFrame(tick);
      else frame = 0;
    }
    frame = requestAnimationFrame(tick);
  }
  function select(index, animate = true) {
    const difference = wrap(index - position + count / 2) - count / 2;
    const target = position + difference;
    if (animate) settle(target);
    else { stop(); position = target; render(); }
  }
  function open(index, {history = true, focus = true} = {}) {
    select(index, false);
    document.documentElement.classList.remove('is-home');
    const id = options[selected].dataset.category;
    panels.forEach(panel => { panel.hidden = panel.id !== id; });
    if (history && location.hash !== '#' + id) window.history.pushState(null, '', '#' + id);
    const panel = document.getElementById(id);
    if (focus) panel.querySelector('h2').focus({preventScroll: true});
    panel.scrollIntoView({behavior: behavior(), block: 'start'});
  }
  function home({history = true, focus = true} = {}) {
    settle();
    panels.forEach(panel => { panel.hidden = true; });
    document.documentElement.classList.add('is-home');
    if (history) window.history.pushState(null, '', location.pathname + location.search);
    if (focus) picker.focus({preventScroll: true});
    document.getElementById('island').scrollIntoView({behavior: 'instant', block: 'start'});
  }
  function route() {
    const index = options.findIndex(option => '#' + option.dataset.category === location.hash);
    if (index >= 0) open(index, {history: false, focus: false});
    else home({history: false, focus: false});
  }
  function tap(target) {
    const option = target.closest('[data-category]');
    const row = target.closest('[data-picker-index]');
    if (option) open(options.indexOf(option));
    else if (row) {
      const index = Number(row.dataset.pickerIndex);
      if (index === selected) open(index);
      else select(index);
    }
  }
  // Capture the actual gesture: circular outside, vertical inside. Neither gesture
  // navigates away; a tap on the selected row confirms the visitor's choice.
  dial.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || pointer || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    stop();
    const bounds = dial.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2, cy = bounds.top + bounds.height / 2;
    pointer = {
      id: event.pointerId, target: event.target,
      mode: event.target.closest('.dial-center') ? 'picker' : 'ring',
      x: event.clientX, y: event.clientY, start: position, cx, cy,
      angle: Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI,
      time: performance.now(), velocity: 0, moved: false
    };
    dial.setPointerCapture(event.pointerId);
  });
  dial.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 6) return;
    pointer.moved = true;
    dial.classList.add('is-dragging');
    let next;
    if (pointer.mode === 'picker') next = pointer.start - (event.clientY - pointer.y) / rowHeight;
    else {
      // Ignore the unstable angle right at the centre of a circle.
      if (Math.hypot(event.clientX - pointer.cx, event.clientY - pointer.cy) < 20) return;
      const angle = Math.atan2(event.clientY - pointer.cy, event.clientX - pointer.cx) * 180 / Math.PI;
      next = position - angleDelta(angle, pointer.angle) / step;
      pointer.angle = angle;
    }
    const now = performance.now();
    pointer.velocity = clamp((next - position) / Math.max(8, now - pointer.time), -.02, .02);
    pointer.time = now;
    position = next; render();
  });
  function release(event, cancelled = false) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const gesture = pointer;
    pointer = null;
    dial.classList.remove('is-dragging');
    if (dial.hasPointerCapture(event.pointerId)) dial.releasePointerCapture(event.pointerId);
    ignoreClickUntil = Date.now() + 500;
    if (cancelled) { settle(); return; }
    if (gesture.moved) {
      const velocity = performance.now() - gesture.time < 100 ? gesture.velocity : 0;
      settle(Math.round(position + clamp(velocity * 100, -1.5, 1.5)));
    } else tap(gesture.target);
  }
  dial.addEventListener('pointerup', event => release(event));
  dial.addEventListener('pointercancel', event => release(event, true));
  dial.addEventListener('lostpointercapture', event => { if (pointer) release(event, true); });
  dial.addEventListener('dragstart', event => event.preventDefault());
  dial.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (event.detail === 0 || Date.now() >= ignoreClickUntil) tap(event.target);
  });
  dial.addEventListener('wheel', event => {
    if (event.ctrlKey || pointer) return;
    event.preventDefault(); stop();
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
    position += clamp(pixels / 80, -2, 2);
    render();
    wheelTimer = setTimeout(() => settle(), 160);
  }, {passive: false});
  dial.addEventListener('keydown', event => {
    const direction = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];
    if (direction) { event.preventDefault(); select(selected + direction, false); }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); select(event.key === 'Home' ? 0 : count - 1, false);
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === picker) {
      event.preventDefault(); open(selected);
    }
  });
  document.querySelectorAll('.back-to-wheel').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); home({focus: event.detail === 0});
  }));
  document.querySelectorAll('.home-link').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); home({focus: event.detail === 0});
  }));
  document.querySelectorAll('.choice-detail').forEach(detail => detail.addEventListener('toggle', () => {
    if (detail.open) detail.parentElement.querySelectorAll('.choice-detail').forEach(other => { if (other !== detail) other.open = false; });
  }));
  window.addEventListener('popstate', route);
  window.addEventListener('hashchange', route);
  render(); route();
})();
