import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, movePlayer, tick, targetCamel, care, finishQuest, trade, serialize, restore, calendar, STATIONS, WORLD_LIMIT, resolvePosition, distance } from '../dist/simulation.js';
import { joystickVector, bindControls } from '../dist/controls.js';
const near = (a, b, epsilon = 0.00001) => assert.ok(Math.abs(a - b) < epsilon, a + ' should equal ' + b);
function standBy(state, c) { state.player.x = c.x; state.player.z = c.z + 2; state.player.yaw = 0; }
test('a new world starts with ten named females and one male', () => {
  const s = createState();
  assert.equal(s.camels.length, 11);
  assert.equal(s.camels.filter(c => c.sex === 'female').length, 10);
  assert.equal(new Set(s.camels.map(c => c.id)).size, 11);
  assert.equal(s.coins, 300); assert.equal(s.stock.water, 40);
});
test('walking respects camera direction and normalizes diagonal speed', () => {
  const s = createState(); s.player.x = 50; s.player.z = 50;
  movePlayer(s, { forward: 1, right: 1 }, 0.1);
  near(Math.hypot(s.player.x - 50, s.player.z - 50), 0.36);
  s.player = { x: 50, z: 50, yaw: Math.PI / 2, pitch: 0 };
  movePlayer(s, { forward: 1 }, 0.1); near(s.player.x, 49.64); near(s.player.z, 50);
});
test('running is faster and world boundaries cannot be crossed', () => {
  const s = createState(); s.player.x = WORLD_LIMIT; s.player.z = 50;
  movePlayer(s, { right: 1, run: true }, 0.1); assert.equal(s.player.x, WORLD_LIMIT);
  s.player.x = 50; movePlayer(s, { forward: 1, run: true }, 0.1); near(s.player.z, 49.3);
});
test('tent, trough and market block movement rather than trapping the player', () => {
  for (const p of [STATIONS.camp, STATIONS.water, { x: 28, z: -23 }]) {
    assert.notDeepEqual(resolvePosition(p.x, p.z), { x: p.x, z: p.z });
  }
  assert.deepEqual(resolvePosition(50, 50), { x: 50, z: 50 });
});
test('every camel moves independently in free roaming', () => {
  const s = createState(), initial = s.camels.map(c => ({ x: c.x, z: c.z }));
  for (let i = 0; i < 50; i++) tick(s, 0.1);
  s.camels.forEach((c, i) => assert.ok(distance(c, initial[i]) > 0.1));
});
test('calling the herd draws camels towards the player without teleporting', () => {
  const s = createState(); s.player.x = 45; s.player.z = 45; s.following = true;
  const original = s.camels.map(c => ({ x: c.x, z: c.z }));
  const before = s.camels.reduce((n, c) => n + distance(c, s.player), 0);
  tick(s, 0.1);
  s.camels.forEach((c, i) => assert.ok(distance(c, original[i]) < 8));
  for (let i = 0; i < 250; i++) tick(s, 0.1);
  assert.ok(s.camels.reduce((n, c) => n + distance(c, s.player), 0) < before * 0.45);
});
test('aim selects only a camel in front of the player', () => {
  const s = createState(), c = s.camels[0]; standBy(s, c);
  assert.equal(targetCamel(s).id, c.id);
  s.player.yaw = Math.PI; assert.notEqual(targetCamel(s)?.id, c.id);
});
test('care needs proximity and cannot spend inventory from far away', () => {
  const s = createState(); s.player.x = 70; s.player.z = 70;
  assert.equal(care(s, 1, 'water').ok, false); assert.equal(s.stock.water, 40);
});
test('watering and feeding use stock and track distinct female camels', () => {
  const s = createState(), c = s.camels[0]; standBy(s, c);
  assert.equal(care(s, 1, 'water').ok, true);
  assert.equal(s.stock.water, 39); assert.equal(s.quest.watered.length, 1);
  c.thirst = 40; care(s, 1, 'water'); assert.equal(s.quest.watered.length, 1);
  assert.equal(care(s, 1, 'feed').ok, true); assert.equal(s.quest.fed.length, 1);
  standBy(s, s.camels[10]); care(s, 11, 'feed'); assert.equal(s.quest.fed.length, 1);
});
test('empty stock and already satisfied camels cannot consume more supplies', () => {
  const s = createState(), c = s.camels[0]; standBy(s, c); s.stock.water = 0;
  assert.equal(care(s, 1, 'water').ok, false); assert.equal(s.stock.water, 0);
  s.stock.water = 20; c.thirst = 100;
  assert.equal(care(s, 1, 'water').ok, false); assert.equal(s.stock.water, 20);
});
test('daily reward needs care plus return to camp and pays once', () => {
  const s = createState();
  for (const c of s.camels.slice(0, 3)) { standBy(s, c); care(s, c.id, 'water'); care(s, c.id, 'feed'); }
  s.player.x = 70; s.player.z = 70; assert.equal(finishQuest(s), false);
  s.player.x = -15; s.player.z = 15;
  assert.equal(finishQuest(s), true); assert.equal(s.coins, 550);
  assert.equal(finishQuest(s), false); assert.equal(s.coins, 550);
});
test('milking requires a fed, hydrated female and only works once per day', () => {
  const s = createState(), c = s.camels[0]; standBy(s, c);
  assert.equal(care(s, 1, 'milk').ok, false);
  care(s, 1, 'water'); care(s, 1, 'feed');
  assert.equal(care(s, 1, 'milk').ok, true); assert.equal(s.milk, 2);
  assert.equal(care(s, 1, 'milk').ok, false); assert.equal(s.milk, 2);
  standBy(s, s.camels[10]); assert.equal(care(s, 11, 'milk').ok, false);
});
test('market purchases need location and balance; milk sales pay correctly', () => {
  const s = createState(); assert.equal(trade(s, 'water').ok, false); assert.equal(s.coins, 300);
  s.player.x = STATIONS.market.x; s.player.z = STATIONS.market.z + 2;
  assert.equal(trade(s, 'water').ok, true); assert.equal(s.coins, 270); assert.equal(s.stock.water, 50);
  s.coins = 0; assert.equal(trade(s, 'feed').ok, false); assert.equal(s.stock.feed, 40);
  s.milk = 4; assert.equal(trade(s, 'sell').ok, true); assert.equal(s.coins, 96); assert.equal(s.milk, 0);
  assert.equal(trade(s, 'sell').ok, false); assert.equal(trade(s, 'unknown').ok, false);
});
test('a full day is 600 simulated seconds and resets daily care once', () => {
  const s = createState(); s.quest.paid = true; s.quest.fed = [1, 2, 3];
  for (let i = 0; i < 6000; i++) tick(s, 0.1);
  assert.equal(s.day, 2); assert.equal(s.quest.paid, false); assert.deepEqual(s.quest.fed, []);
  assert.equal(calendar(s).time, '06:00'); assert.equal(calendar(s).season, 'الربيع');
  assert.equal(restore(serialize(s)).day, 2);
  assert.ok(s.camels.every(c => c.health > 0 && Number.isFinite(c.x)));
});
test('all four seasons cycle during one day', () => {
  const s = createState();
  const names = [0, 150, 300, 450].map(elapsed => { s.elapsed = elapsed; return calendar(s).season; });
  assert.deepEqual(names, ['الربيع', 'الصيف', 'الخريف', 'الشتاء']);
  s.elapsed = 0; assert.equal(calendar(s).time, '06:00');
});
test('save round trip preserves purchases, care, position and rewards', () => {
  const s = createState(); standBy(s, s.camels[0]); care(s, 1, 'water'); s.following = true;
  s.quest.paid = true; s.coins = 777; s.settings.quality = 'low';
  const r = restore(serialize(s));
  assert.equal(r.stock.water, 39); assert.equal(r.coins, 777); assert.equal(r.following, true);
  assert.deepEqual(r.quest.watered, [1]); assert.equal(r.quest.paid, true);
  near(r.player.z, s.player.z); assert.equal(r.settings.quality, 'low');
});
test('broken, outdated or duplicate herd saves are rejected', () => {
  assert.equal(restore('{broken'), null); assert.equal(restore(null), null);
  const s = createState(); s.version = 999; assert.equal(restore(s), null);
  s.version = 1; s.camels[1].id = s.camels[0].id; assert.equal(restore(s), null);
});
test('loaded state is clamped and user strings cannot replace camel names or sexes', () => {
  const s = createState(); s.player.x = Infinity; s.player.pitch = 100; s.coins = -90;
  s.camels[0].name = '<script>'; s.camels[0].sex = 'male'; s.camels[0].health = 900;
  s.quest.watered = [1, 1, 2, 999, '<script>', 11]; s.stock.water = -1;
  const r = restore(s);
  assert.equal(r.player.x, 0); assert.equal(r.player.pitch, 0.8); assert.equal(r.coins, 0);
  assert.equal(r.camels[0].name, 'وضحا'); assert.equal(r.camels[0].sex, 'female');
  assert.equal(r.camels[0].health, 100); assert.equal(r.stock.water, 0); assert.deepEqual(r.quest.watered, [1, 2]);
});
test('joystick direction and dead zone match touch movement', () => {
  assert.equal(joystickVector(0, -32, 32).forward, 1);
  assert.equal(joystickVector(32, 0, 32).right, 1);
  assert.deepEqual(joystickVector(1, 1, 32), { right: 0, forward: 0, x: 0, y: 0 });
  const v = joystickVector(200, -200, 32); near(Math.hypot(v.right, v.forward), 1);
});
test('pointer cancellation and window blur release movement instead of sticking', () => {
  class FakeTarget {
    constructor() { this.events = {}; this.style = {}; this.classList = { remove() {}, toggle() {} }; }
    addEventListener(k, f) { (this.events[k] ||= []).push(f); }
    fire(k, data = {}) { for (const f of this.events[k] || []) f(data); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
    setPointerCapture() {}
  }
  const win = new FakeTarget(), doc = new FakeTarget(), canvas = new FakeTarget(), joystick = new FakeTarget();
  const knob = new FakeTarget(), runButton = new FakeTarget(), p = { yaw: 0, pitch: 0 };
  const originalWindow = globalThis.window, originalDocument = globalThis.document;
  globalThis.window = win; globalThis.document = doc;
  try {
    const input = bindControls({ canvas, joystick, knob, runButton, player: () => p, onInteract() {} });
    joystick.fire('pointerdown', { pointerId: 1, clientX: 50, clientY: 10, preventDefault() {} });
    assert.equal(input.read().forward, 1);
    joystick.fire('pointercancel', { pointerId: 1 }); assert.equal(input.read().forward, 0);
    win.fire('keydown', { code: 'KeyW', preventDefault() {} }); assert.equal(input.read().forward, 1);
    runButton.fire('click'); assert.equal(input.read().run, true);
    win.fire('blur'); assert.deepEqual(input.read(), { forward: 0, right: 0, run: false });
    canvas.fire('pointerdown', { pointerId: 4, clientX: 50, clientY: 50, preventDefault() {} });
    canvas.fire('pointermove', { pointerId: 4, clientX: 70, clientY: 60 }); assert.ok(p.yaw < 0);
    canvas.fire('lostpointercapture', { pointerId: 4 });
    const yaw = p.yaw; canvas.fire('pointermove', { pointerId: 4, clientX: 170, clientY: 60 }); assert.equal(p.yaw, yaw);
  } finally { globalThis.window = originalWindow; globalThis.document = originalDocument; }
});
