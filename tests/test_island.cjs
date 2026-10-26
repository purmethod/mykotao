// Dependency-free regression checks for the dial's actual event handlers.
// Run: node tests/test_island.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
class Element {
  constructor(name, text = '') {
    this.name = name; this.textContent = text; this.id = name;
    this.dataset = {}; this.attrs = {}; this.handlers = {}; this.values = {};
    this.style = {setProperty: (k, v) => { this.values[k] = v; }};
    this.classList = {add() {}, remove() {}};
  }
  addEventListener(type, handler) { this.handlers[type] = handler; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  closest(selector) {
    const matches = selector === '.' + this.name ||
      (selector === '[data-category]' && this.dataset.category) ||
      (selector === '[data-picker-index]' && this.dataset.pickerIndex !== undefined);
    return matches ? this : this.parentElement?.closest(selector) || null;
  }
  focus() {} scrollIntoView() { this.scrolled = true; }
  querySelector() { return this.heading; }
}
function setup() {
  const names = ['eat', 'relax', 'move', 'explore', 'connect', 'stay', 'essentials', 'whats-next'];
  const dial = new Element('island-dial'), center = new Element('dial-center');
  const picker = new Element('picker-window'), opener = new Element('dial-open');
  center.parentElement = dial; picker.parentElement = center; opener.parentElement = center;
  const options = names.map(n => { const e = new Element(n + '-option', n.toUpperCase()); e.dataset.category = n; e.parentElement = dial; return e; });
  const rows = names.map((n, i) => { const e = new Element('picker-option-' + i, n); e.dataset.pickerIndex = String(i); e.parentElement = picker; return e; });
  const panels = names.map(n => { const e = new Element(n); e.heading = new Element(n + '-title'); return e; });
  const home = new Element('island'), back = new Element('back-to-wheel');
  const byid = Object.fromEntries([...panels, home].map(e => [e.id, e]));
  dial.querySelectorAll = () => options; picker.querySelectorAll = () => rows;
  dial.querySelector = s => s === '.picker-window' ? picker : opener;
  dial.getBoundingClientRect = () => ({left: 0, top: 0, width: 400, height: 400});
  let capture = false;
  dial.setPointerCapture = () => { capture = true; };
  dial.hasPointerCapture = () => capture;
  dial.releasePointerCapture = () => { capture = false; };
  const location = {hash: '', pathname: '/', search: ''}, handlers = {};
  let now = 0, nextId = 0;
  const rafs = new Map(), timers = new Map();
  const context = {
    document: {querySelector: () => dial, querySelectorAll: s => s === '.category-panel' ? panels : s === '.back-to-wheel' ? [back] : [], getElementById: id => byid[id]},
    window: {matchMedia: () => ({matches: false}), addEventListener: (t, f) => { handlers[t] = f; }, history: {pushState(a, b, url) { location.hash = url.includes('#') ? '#' + url.split('#')[1] : ''; }}},
    location, Date, performance: {now: () => now},
    requestAnimationFrame: f => { rafs.set(++nextId, f); return nextId; },
    cancelAnimationFrame: id => rafs.delete(id),
    setTimeout: f => { timers.set(++nextId, f); return nextId; }, clearTimeout: id => timers.delete(id)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../island.js'), 'utf8'), context);
  function fire(type, target = dial, extra = {}) {
    now += 40;
    dial.handlers[type]({target, button: 0, isPrimary: true, pointerId: 1, clientX: 200, clientY: 40, preventDefault() {}, ...extra});
  }
  function flush() {
    for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
    now += 300;
    for (const [id, fn] of [...rafs]) { rafs.delete(id); fn(now); }
  }
  const selected = () => Number(picker.attrs['aria-activedescendant'].split('-').at(-1));
  return {dial, picker, opener, rows, options, panels, location, handlers, selected, fire, flush, pause: () => { now += 200; }};
}
{
  const t = setup();
  assert.equal(t.selected(), 3);
  t.fire('pointerdown');
  t.fire('pointermove', t.dial, {clientX: 360, clientY: 200}); // Clockwise 90 degrees.
  assert.equal(t.selected(), 1);
  t.pause(); t.fire('pointerup'); t.flush();
  assert.equal(t.selected(), 1);
  assert.equal(t.location.hash, '', 'Rotating must not navigate away');
  assert.equal(t.options[1].attrs['aria-current'], 'true');
  assert.equal(t.rows[1].attrs['aria-selected'], 'true');
}
{
  const t = setup();
  const point = angle => ({clientX: 200 + 160 * Math.cos(angle * Math.PI / 180), clientY: 200 + 160 * Math.sin(angle * Math.PI / 180)});
  t.fire('pointerdown', t.dial, point(170));
  t.fire('pointermove', t.dial, point(-170));
  assert.equal(t.selected(), 3, 'Crossing the angle seam must not jump a full revolution');
  t.fire('pointermove', t.dial, point(-145));
  t.pause(); t.fire('pointerup'); t.flush();
  assert.equal(t.selected(), 2);
}
{
  const t = setup();
  t.fire('pointerdown', t.picker, {clientY: 220});
  t.fire('pointermove', t.picker, {clientY: 152}); // Two rows upward.
  assert.equal(t.selected(), 5);
  t.pause(); t.fire('pointerup', t.picker); t.flush();
  assert.equal(t.selected(), 5); assert.equal(t.location.hash, '');
  t.fire('click', t.rows[5], {detail: 1}); // Synthetic click after drag.
  assert.equal(t.location.hash, '');
  t.fire('pointerdown', t.opener); t.fire('click', t.opener, {detail: 1});
  assert.equal(t.location.hash, '#stay', 'A fresh confirmation tap must work immediately');
  assert.equal(t.panels.filter(p => !p.hidden).length, 1);
}
{
  const t = setup();
  t.fire('wheel', t.picker, {deltaY: 80, deltaX: 0, deltaMode: 0}); t.flush();
  assert.equal(t.selected(), 4); assert.equal(t.location.hash, '');
  t.fire('keydown', t.picker, {key: 'End'});
  t.fire('keydown', t.picker, {key: 'ArrowDown'});
  assert.equal(t.selected(), 0);
  t.fire('keydown', t.picker, {key: 'Enter'}); assert.equal(t.location.hash, '#eat');
  t.location.hash = '#relax'; t.handlers.popstate(); assert.equal(t.selected(), 1);
}
{
  const t = setup();
  t.fire('pointerdown', t.rows[4], {clientY: 230});
  t.fire('pointerup', t.rows[4], {clientY: 230}); t.flush();
  assert.equal(t.selected(), 4); assert.equal(t.location.hash, '', 'Neighbouring row taps select without opening');
  t.fire('pointerdown', t.picker, {clientY: 230});
  t.fire('pointermove', t.picker, {clientY: 215});
  t.fire('pointercancel', t.picker); t.flush();
  assert.equal(t.location.hash, '');
  assert.equal(t.selected(), 4, 'Cancelled drags snap to the nearest category');
}
console.log('PASS: circular drag, angle seam, vertical roller, synchronized selection, snap, confirmation, wheel, keyboard, history and cancellation');
