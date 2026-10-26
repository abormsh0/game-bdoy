export const DAY_SECONDS = 600;
export const SAVE_VERSION = 1;
export const WORLD_LIMIT = 86;
export const INTERACT_DISTANCE = 3.3;
export const STATIONS = Object.freeze({
  camp: { x: -15, z: 5, name: 'المخيم' },
  water: { x: -8, z: -7, name: 'الماء' },
  pasture: { x: 24, z: 8, name: 'المرعى' },
  market: { x: 28, z: -21, name: 'السوق' }
});
export const OBSTACLES = [
  { x: -15, z: 3, w: 6.5, d: 4.5 },
  { x: -8, z: -7, w: 2.5, d: 1.0 },
  { x: 28, z: -23, w: 4.4, d: 2.0 }
];
const NAMES = ['وضحا', 'الشاهينية', 'شعلا', 'مزيون', 'النود', 'صيتة', 'العنود', 'ريم', 'الهنوف', 'نجود', 'شاهين'];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const finite = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : fallback;
export function createState() {
  const camels = NAMES.map((name, i) => {
    const angle = i * 2.39996;
    return {
      id: i + 1, name, sex: i === 10 ? 'male' : 'female', age: i === 10 ? 6 : 4 + i % 4,
      x: i === 0 ? 0 : Math.sin(angle) * (6 + i * 0.75),
      z: i === 0 ? 7 : Math.cos(angle) * (6 + i * 0.6) - 1,
      yaw: 0, phase: i * 1.71, thirst: 52 + (i % 4) * 5, hunger: 48 + (i % 3) * 8,
      health: 90, bond: 20, milkDay: 0, target: null, gait: 0
    };
  });
  return {
    version: SAVE_VERSION, elapsed: 0, day: 1, coins: 300, milk: 0,
    stock: { water: 40, feed: 40 }, player: { x: 0, z: 12, yaw: 0, pitch: 0 },
    camels, following: false, quest: { day: 1, watered: [], fed: [], paid: false },
    settings: { sound: false, quality: 'balanced' }
  };
}
export function calendar(state) {
  let inDay = state.elapsed % DAY_SECONDS;
  if (inDay < 1e-7 || DAY_SECONDS - inDay < 1e-7) inDay = 0;
  const progress = inDay / DAY_SECONDS;
  const minutes = Math.floor((6 * 60 + progress * 24 * 60) % 1440);
  return {
    day: state.day, progress, season: ['الربيع', 'الصيف', 'الخريف', 'الشتاء'][Math.floor(progress * 4)],
    seasonIndex: Math.floor(progress * 4),
    time: String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0'),
    hour: minutes / 60
  };
}
export function resolvePosition(x, z, radius = 0.45) {
  x = clamp(x, -WORLD_LIMIT, WORLD_LIMIT);
  z = clamp(z, -WORLD_LIMIT, WORLD_LIMIT);
  for (const b of OBSTACLES) {
    const dx = x - b.x, dz = z - b.z;
    const rx = b.w + radius, rz = b.d + radius;
    if (Math.abs(dx) < rx && Math.abs(dz) < rz) {
      if (rx - Math.abs(dx) < rz - Math.abs(dz)) x = b.x + (dx < 0 ? -rx : rx);
      else z = b.z + (dz < 0 ? -rz : rz);
    }
  }
  return { x, z };
}
export function movePlayer(state, input, dt) {
  const forward = clamp(Number(input.forward) || 0, -1, 1);
  const right = clamp(Number(input.right) || 0, -1, 1);
  const magnitude = Math.max(1, Math.hypot(forward, right));
  const speed = input.run ? 7 : 3.6;
  const step = clamp(dt, 0, 0.1) * speed / magnitude;
  const yaw = state.player.yaw;
  let x = state.player.x + (right * Math.cos(yaw) - forward * Math.sin(yaw)) * step;
  let z = state.player.z + (-right * Math.sin(yaw) - forward * Math.cos(yaw)) * step;
  for (const c of state.camels) {
    const dx = x - c.x, dz = z - c.z, length = Math.hypot(dx, dz);
    if (length < 1.35) {
      x = c.x + (length > 0.001 ? dx / length : 1) * 1.35;
      z = c.z + (length > 0.001 ? dz / length : 0) * 1.35;
    }
  }
  Object.assign(state.player, resolvePosition(x, z));
  return Math.hypot(forward, right) > 0.05;
}
function updateCamel(state, c, dt) {
  c.thirst = clamp(c.thirst - dt * 0.032, 0, 100);
  c.hunger = clamp(c.hunger - dt * 0.024, 0, 100);
  c.health = clamp(c.health + dt * (c.thirst < 15 || c.hunger < 15 ? -0.07 : 0.009), 5, 100);
  let target;
  if (state.following) {
    const ring = 5 + (c.id % 3) * 1.9, a = c.id * 2.39996;
    target = { x: state.player.x + Math.sin(a) * ring, z: state.player.z + Math.cos(a) * ring };
  } else if (c.thirst < 28) target = { x: STATIONS.water.x + 4 + c.id % 3, z: STATIONS.water.z + c.id % 5 - 2 };
  else if (c.hunger < 28) target = { x: STATIONS.pasture.x + Math.sin(c.phase) * 5, z: STATIONS.pasture.z + Math.cos(c.phase) * 5 };
  else {
    if (!c.target || distance(c, c.target) < 0.6) {
      c.phase += 1.618;
      c.target = { x: Math.sin(c.phase) * (8 + c.id * 0.8), z: Math.cos(c.phase * 0.73) * (7 + c.id * 0.65) };
    }
    target = c.target;
  }
  let dx = target.x - c.x, dz = target.z - c.z;
  const length = Math.hypot(dx, dz);
  const speed = state.following ? 2.1 : 0.6 + (c.id % 3) * 0.16;
  let vx = length > 1 ? dx / length * speed : 0;
  let vz = length > 1 ? dz / length * speed : 0;
  for (const other of state.camels) {
    if (other.id === c.id) continue;
    const ox = c.x - other.x, oz = c.z - other.z, d = Math.hypot(ox, oz);
    if (d < 2.2 && d > 0.01) { vx += ox / d * (2.2 - d); vz += oz / d * (2.2 - d); }
  }
  const pd = distance(c, state.player);
  if (pd < 2 && pd > 0.01) { vx += (c.x - state.player.x) / pd * (2 - pd); vz += (c.z - state.player.z) / pd * (2 - pd); }
  const position = resolvePosition(c.x + vx * dt, c.z + vz * dt, 0.9);
  const travelled = Math.hypot(position.x - c.x, position.z - c.z);
  if (travelled > 0.002) {
    const desired = Math.atan2(-vx, -vz);
    c.yaw += Math.atan2(Math.sin(desired - c.yaw), Math.cos(desired - c.yaw)) * Math.min(1, dt * 4);
    c.gait += travelled * 2.8;
  }
  Object.assign(c, position);
  if (!state.following && distance(c, STATIONS.water) < 8 && c.thirst < 40) c.thirst = Math.min(100, c.thirst + dt * 0.9);
  if (!state.following && distance(c, STATIONS.pasture) < 9 && c.hunger < 50) c.hunger = Math.min(100, c.hunger + dt * 0.55);
}
export function tick(state, dt) {
  dt = clamp(dt, 0, 0.1);
  state.elapsed += dt;
  const day = Math.floor((state.elapsed + 1e-7) / DAY_SECONDS) + 1;
  if (day !== state.day) {
    state.day = day;
    state.quest = { day, watered: [], fed: [], paid: false };
  }
  for (const c of state.camels) updateCamel(state, c, dt);
}
export function targetCamel(state, maxDistance = 8) {
  let result = null, best = Infinity;
  const forward = { x: -Math.sin(state.player.yaw), z: -Math.cos(state.player.yaw) };
  for (const c of state.camels) {
    const d = distance(state.player, c);
    if (d > maxDistance || d < 0.01) continue;
    const dot = ((c.x - state.player.x) * forward.x + (c.z - state.player.z) * forward.z) / d;
    if (dot < 0.64) continue;
    const score = d + (1 - dot) * 8;
    if (score < best) { result = c; best = score; }
  }
  return result;
}
export function care(state, id, action) {
  const c = state.camels.find(c => c.id === id);
  if (!c || distance(state.player, c) > INTERACT_DISTANCE) return { ok: false, message: 'اقترب من الناقة أولًا' };
  if (action === 'water' || action === 'feed') {
    const stat = action === 'water' ? 'thirst' : 'hunger';
    if (c[stat] > 94) return { ok: false, message: action === 'water' ? 'الناقة مكتفية بالماء' : 'الناقة شبعت' };
    if (state.stock[action] < 1) return { ok: false, message: 'المخزون نفد؛ اشترِ من السوق' };
    state.stock[action] -= 1;
    c[stat] = Math.min(100, c[stat] + 40);
    c.bond = Math.min(100, c.bond + 4);
    const list = state.quest[action === 'water' ? 'watered' : 'fed'];
    if (!list.includes(c.id) && c.sex === 'female') list.push(c.id);
    return { ok: true, message: action === 'water' ? 'سقيت ' + c.name : 'أطعمت ' + c.name };
  }
  if (action === 'pet') {
    c.bond = Math.min(100, c.bond + 5);
    return { ok: true, message: c.name + ' ارتاحت لك' };
  }
  if (action === 'milk') {
    if (c.sex !== 'female') return { ok: false, message: 'الحلب متاح للنوق فقط' };
    if (c.milkDay === state.day) return { ok: false, message: 'حلبتها اليوم؛ انتظر اليوم القادم' };
    if (c.hunger < 60 || c.thirst < 60 || c.health < 60) return { ok: false, message: 'اسقها وأطعمها قبل الحلب' };
    c.milkDay = state.day;
    state.milk += 2;
    return { ok: true, message: 'جمعت لترين من حليب ' + c.name };
  }
  return { ok: false, message: 'اختر أداة من الشريط' };
}
export function finishQuest(state) {
  if (state.quest.paid || state.quest.fed.length < 3 || state.quest.watered.length < 3) return false;
  if (distance(state.player, STATIONS.camp) > 12) return false;
  state.quest.paid = true;
  state.coins += 250;
  return true;
}
export function trade(state, action) {
  if (distance(state.player, STATIONS.market) > 9) return { ok: false, message: 'السوق بعيد؛ اتبع العلامة' };
  if (action === 'sell') {
    if (state.milk <= 0) return { ok: false, message: 'احلب النوق أولًا' };
    const value = state.milk * 24;
    state.coins += value;
    state.milk = 0;
    return { ok: true, message: 'بعت الحليب مقابل ' + value + ' ريال' };
  }
  const price = action === 'water' ? 30 : action === 'feed' ? 40 : null;
  if (price === null) return { ok: false, message: 'طلب غير معروف' };
  if (state.coins < price) return { ok: false, message: 'رصيدك ما يكفي' };
  state.coins -= price;
  state.stock[action] += 10;
  return { ok: true, message: 'أضفت 10 وحدات للمخزون' };
}
export function serialize(state) {
  return JSON.stringify(state);
}
export function restore(raw) {
  let saved;
  try { saved = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
  if (!saved || saved.version !== SAVE_VERSION || !Array.isArray(saved.camels) || saved.camels.length !== 11) return null;
  const state = createState();
  state.elapsed = finite(saved.elapsed, 0, 0, 600 * 36500);
  state.day = Math.floor((state.elapsed + 1e-7) / DAY_SECONDS) + 1;
  state.coins = finite(saved.coins, 300, 0, 100000000);
  state.milk = finite(saved.milk, 0, 0, 100000);
  state.stock.water = Math.floor(finite(saved.stock?.water, 40, 0, 100000));
  state.stock.feed = Math.floor(finite(saved.stock?.feed, 40, 0, 100000));
  state.player.x = finite(saved.player?.x, 0, -WORLD_LIMIT, WORLD_LIMIT);
  state.player.z = finite(saved.player?.z, 12, -WORLD_LIMIT, WORLD_LIMIT);
  state.player.yaw = finite(saved.player?.yaw, 0, -100000, 100000);
  state.player.pitch = finite(saved.player?.pitch, 0, -0.8, 0.8);
  Object.assign(state.player, resolvePosition(state.player.x, state.player.z));
  const ids = new Set(saved.camels.map(c => c?.id));
  if (ids.size !== 11 || state.camels.some(c => !ids.has(c.id))) return null;
  for (const c of state.camels) {
    const source = saved.camels.find(s => s?.id === c.id);
    for (const key of ['x', 'z']) c[key] = finite(source[key], c[key], -WORLD_LIMIT, WORLD_LIMIT);
    for (const key of ['thirst', 'hunger', 'health', 'bond']) c[key] = finite(source[key], c[key], 0, 100);
    c.yaw = finite(source.yaw, 0, -100000, 100000);
    c.phase = finite(source.phase, c.phase, -100000, 100000);
    c.milkDay = Math.floor(finite(source.milkDay, 0, 0, state.day));
    Object.assign(c, resolvePosition(c.x, c.z, 0.9));
  }
  const validIds = list => Array.isArray(list) ? [...new Set(list)].filter(id => Number.isInteger(id) && id >= 1 && id <= 10) : [];
  if (saved.quest?.day === state.day) {
    state.quest = { day: state.day, fed: validIds(saved.quest.fed), watered: validIds(saved.quest.watered), paid: saved.quest.paid === true };
  }
  state.following = saved.following === true;
  state.settings.sound = saved.settings?.sound === true;
  state.settings.quality = saved.settings?.quality === 'low' ? 'low' : 'balanced';
  return state;
}
