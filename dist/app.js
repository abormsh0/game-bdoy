import { createState, restore, serialize, calendar, distance, STATIONS, tick, movePlayer, targetCamel, care, finishQuest, trade, INTERACT_DISTANCE } from './simulation.js';
import { bindControls } from './controls.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'badawi:new-journey:v1';
let state = createState(), hasSave = false, started = false, activeModal = 'intro';
let selectedTool = 'water', selected = null, waypoint = null, resetRequested = false, world = null;
let toastUntil = 0, saveAt = 0, hudAt = 0, helpUntil = 0, soundContext = null, feedback = '', previousFocus = null;
try {
  const loaded = restore(localStorage.getItem(SAVE_KEY));
  if (loaded) { state = loaded; hasSave = true; }
} catch {}
const escape = value => String(value).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
const number = n => Math.round(n).toLocaleString('en-US');
const labels = { water: 'اسقِ', feed: 'أطعم', pet: 'المس', milk: 'احلب' };
function notify(message) {
  $('toast').textContent = message; $('toast').classList.remove('hidden'); toastUntil = performance.now() + 3000;
}
function save(show = false) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state)); hasSave = true;
    $('save-status').textContent = 'تم الحفظ على جهازك';
    if (show) notify('انحفظ تقدمك على هذا الجهاز');
    return true;
  } catch {
    $('save-status').textContent = 'الحفظ غير متاح في هذا المتصفح';
    if (show) notify('تعذر الحفظ؛ جرّب السماح بتخزين بيانات الموقع');
    return false;
  }
}
function sound(kind) {
  if (!state.settings.sound) return;
  try {
    soundContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (soundContext.state === 'suspended') soundContext.resume().catch(() => {});
    const osc = soundContext.createOscillator(), gain = soundContext.createGain(), t = soundContext.currentTime;
    osc.type = 'sine'; osc.frequency.setValueAtTime(kind === 'call' ? 940 : 520, t);
    osc.frequency.exponentialRampToValueAtTime(kind === 'call' ? 1350 : 720, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); osc.connect(gain); gain.connect(soundContext.destination);
    osc.start(t); osc.stop(t + 0.22);
  } catch {}
}
function interact() {
  if (!started || activeModal || document.hidden) return;
  selected = targetCamel(state);
  const result = care(state, selected?.id, selectedTool);
  notify(result.message);
  if (result.ok) { world?.interact(); sound('care'); save(); }
  updateHud();
}
const controls = bindControls({
  canvas: $('world'), joystick: $('joystick'), knob: $('knob'), runButton: $('run-button'),
  player: () => state.player, onInteract: interact
});
function renderIntro() {
  $('modal-content').innerHTML =
    '<div class="intro-symbol">ب</div><span class="eyebrow">في رحاب الصحراء</span>' +
    '<h1 id="modal-title">بدوي</h1><p class="intro-subtitle">حياة بسيطة. قطيع يحتاجك.</p>' +
    '<div class="intro-facts"><span>10 نياق وجمل</span><span>منظور شخص أول</span><span>يوم = 10 دقائق</span></div>' +
    '<p class="intro-copy">اسقِ النوق وأطعمها، امشِ معها للمرعى، ثم بع الحليب في السوق. كل شيء يبدأ بخطوتك الأولى.</p>' +
    '<button data-do="start" class="primary">' + (hasSave ? 'واصل رحلتك' : 'ابدأ رحلتك') + '<span>←</span></button>' +
    '<button data-do="help" class="text-button">كيف ألعب؟</button>' +
    '<p class="prototype-label">نسخة أولية قابلة للعب · رسوم ثلاثية الأبعاد مبسطة</p>';
}
function inertHud(value) {
  for (const e of document.querySelectorAll('.hud, .quest, .controls')) e.inert = value;
}
function openModal(kind) {
  activeModal = kind; controls.reset(); feedback = ''; resetRequested = false;
  previousFocus = document.activeElement; inertHud(true);
  $('modal').classList.remove('hidden');
  $('modal-close').classList.toggle('hidden', !started);
  renderModal();
  ($('modal-close').classList.contains('hidden') ? $('modal-content').querySelector('button') : $('modal-close'))?.focus();
}
function closeModal() {
  if (activeModal === 'error') return;
  if (!started) { activeModal = 'intro'; renderModal(); return; }
  activeModal = ''; $('modal').classList.add('hidden'); inertHud(false); controls.reset();
  previousFocus?.focus?.();
}
function helpHtml() {
  return '<h2 id="modal-title">كيف تلعب؟</h2><div class="help-list">' +
    '<div><b>خطوتك الأولى</b><span>اسحب العصا أسفل اليسار للتحرك. اسحب المشهد لتغيير اتجاه نظرك. زر الركض يزيد سرعتك.</span></div>' +
    '<div><b>رعاية القطيع</b><span>وجّه نظرك لناقة واقترب منها. اختر الماء أو العلف أو اللمس أو الحلب، ثم اضغط زر التفاعل أسفل اليمين.</span></div>' +
    '<div><b>مهمة اليوم</b><span>اسقِ ثلاث نياق مختلفة وأطعم ثلاث نياق مختلفة، ثم اقترب من المخيم لتحصل على 250 ريال.</span></div>' +
    '<div><b>الحليب والسوق</b><span>الحلب يعطيك لترين من الناقة مرة في اليوم إذا كانت شبعانة ومروية. اذهب للسوق لبيع الحليب وشراء المؤن.</span></div>' +
    '<div><b>نداء القطيع</b><span>اضغط «نداء» لتتبعك الإبل. اضغطه مرة ثانية لتعود للرعي الحر. الخريطة تساعدك تلقى الماء والمرعى والسوق.</span></div>' +
    '<div><b>الوقت والحفظ</b><span>اليوم 10 دقائق؛ تتتابع خلاله الفصول الأربعة. اللعبة تتوقف عند فتح القوائم أو ترك الصفحة. تقدمك ينحفظ على هذا المتصفح.</span></div>' +
    '<div><b>على الكمبيوتر</b><span>W A S D أو الأسهم للحركة، Shift للركض، E للتفاعل، واسحب بالماوس لتغيير النظر. على الجوال جرّب الشاشة الأفقية.</span></div></div>' +
    '<button data-do="' + (started ? 'close' : 'intro') + '" class="primary spaced">فهمت</button>';
}
function renderModal() {
  const content = $('modal-content');
  if (activeModal === 'intro') { renderIntro(); return; }
  if (activeModal === 'help') { content.innerHTML = helpHtml(); return; }
  if (activeModal === 'map') {
    content.innerHTML = '<h2 id="modal-title">حول المخيم</h2><p class="map-key">أنت بالذهبي · القطيع بالنقاط البنية</p>' +
      '<canvas id="map-canvas" class="map-canvas" width="640" height="640" aria-label="خريطة المخيم والماء والمرعى والسوق"></canvas>' +
      '<div class="map-destinations">' + Object.entries(STATIONS).map(([key, s]) =>
        '<button data-dest="' + key + '">' + s.name + ' <small>' + Math.round(distance(state.player, s)) + ' م</small></button>').join('') + '</div>' +
      '<button data-do="clear-waypoint" class="text-button">إزالة علامة الاتجاه</button>';
    drawMap(); return;
  }
  if (activeModal === 'herd') {
    content.innerHTML = '<h2 id="modal-title">قطيعك</h2><p class="herd-summary">10 نياق وجمل · ' + (state.following ? 'يتبعك القطيع' : 'رعي حر') + '</p><div class="herd-list">' +
      state.camels.map(c => '<div class="herd-row"><b>' + escape(c.name) + '<small> ' + (c.sex === 'male' ? 'جمل' : 'ناقة') + ' · ' + c.age + ' سنوات</small></b>' +
        '<span>ماء ' + Math.round(c.thirst) + '%<br>غذاء ' + Math.round(c.hunger) + '% · صحة ' + Math.round(c.health) + '%</span></div>').join('') +
      '</div><button data-do="call" class="primary spaced">' + (state.following ? 'اترك القطيع يرعى' : 'نادِ القطيع') + '</button>'; return;
  }
  if (activeModal === 'market') {
    content.innerHTML = '<h2 id="modal-title">سوق البادية</h2><p class="herd-summary">رصيدك ' + number(state.coins) + ' ريال · حليبك ' + state.milk + ' لتر</p>' +
      '<div class="shop-row"><div><b>10 وحدات ماء</b><small>30 ريال · مخزونك ' + state.stock.water + '</small></div><button data-buy="water">اشترِ</button></div>' +
      '<div class="shop-row"><div><b>10 وحدات علف</b><small>40 ريال · مخزونك ' + state.stock.feed + '</small></div><button data-buy="feed">اشترِ</button></div>' +
      '<div class="shop-row"><div><b>بيع الحليب</b><small>24 ريال للتر · الإجمالي ' + number(state.milk * 24) + ' ريال</small></div><button data-buy="sell"' + (state.milk ? '' : ' disabled') + '>بع الحليب</button></div>' +
      '<p class="notice" role="status">' + escape(feedback || 'السوق يستخدم رصيد اللعبة.') + '</p>'; return;
  }
  if (activeModal === 'quest') {
    content.innerHTML = '<h2 id="modal-title">الرعاية أولًا</h2><div class="help-list">' +
      '<div><b>سقي النوق: ' + Math.min(3, state.quest.watered.length) + '/3</b><span>اسقِ ثلاث نياق مختلفة بالماء.</span></div>' +
      '<div><b>إطعام النوق: ' + Math.min(3, state.quest.fed.length) + '/3</b><span>أطعم ثلاث نياق مختلفة بالعلف.</span></div>' +
      '<div><b>ارجع للمخيم</b><span>بعد الرعاية، اقترب من بيت الشعر لاستلام مكافأة 250 ريال.</span></div></div>' +
      '<p class="herd-summary spaced">' + (state.quest.paid ? 'أنجزت مهمة اليوم. المهمة القادمة تبدأ في اليوم الجديد.' : 'المهمة تتجدد مع كل يوم افتراضي.') + '</p>' +
      '<button data-dest="camp" class="primary">حدد المخيم على المشهد</button>'; return;
  }
  if (activeModal === 'settings') {
    content.innerHTML = '<h2 id="modal-title">على راحتك</h2>' +
      '<div class="setting-row"><span>المؤثرات الصوتية</span><button data-do="sound">' + (state.settings.sound ? 'مفعلة' : 'متوقفة') + '</button></div>' +
      '<div class="setting-row"><label for="quality-select">جودة العرض</label><select id="quality-select"><option value="balanced"' + (state.settings.quality === 'balanced' ? ' selected' : '') + '>متوازنة</option><option value="low"' + (state.settings.quality === 'low' ? ' selected' : '') + '>خفيفة</option></select></div>' +
      '<div class="setting-row"><span>تقدمك</span><button data-do="save">احفظ الآن</button></div>' +
      '<div class="setting-row"><span>تعليمات التحكم</span><button data-do="help">كيف ألعب؟</button></div>' +
      '<p class="modal-copy">الحفظ مرتبط بالجهاز والمتصفح الحالي. المؤثرات إشارات قصيرة عند النداء والرعاية.</p>' +
      (resetRequested ? '<p class="modal-copy danger">بدء عالم جديد يستبدل تقدمك الحالي على هذا الجهاز.</p><button data-do="confirm-reset" class="primary">ابدأ من جديد</button>' :
        '<button data-do="reset" class="text-button danger">بدء عالم جديد</button>'); return;
  }
}
function drawMap() {
  const canvas = $('map-canvas'), ctx = canvas.getContext('2d');
  const scale = canvas.width / 100, project = p => ({ x: (p.x + 50) * scale, y: (p.z + 50) * scale });
  ctx.fillStyle = '#d6bc89'; ctx.fillRect(0, 0, 640, 640);
  ctx.strokeStyle = '#bb9c67'; ctx.lineWidth = 1;
  for (let i = 0; i < 640; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 640); ctx.moveTo(0, i); ctx.lineTo(640, i); ctx.stroke(); }
  for (const [key, s] of Object.entries(STATIONS)) {
    const p = project(s); ctx.fillStyle = key === 'water' ? '#50868e' : key === 'pasture' ? '#6d7950' : '#6c5034';
    ctx.beginPath(); ctx.arc(p.x, p.y, key === 'pasture' ? 33 : 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f3422'; ctx.font = '22px Tahoma'; ctx.textAlign = 'center'; ctx.fillText(s.name, p.x, p.y + 40);
  }
  for (const c of state.camels) { const p = project(c); ctx.fillStyle = c.sex === 'male' ? '#7b3730' : '#98663c'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); }
  const p = project(state.player);
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-state.player.yaw);
  ctx.fillStyle = '#fcdda2'; ctx.strokeStyle = '#70552d'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(0, -17); ctx.lineTo(-10, 12); ctx.lineTo(0, 6); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function callHerd() {
  state.following = !state.following; controls.reset(); sound('call');
  notify(state.following ? 'القطيع يتبعك الآن' : 'تركت القطيع يرعى بحرية'); save(); updateHud();
}
function market() {
  if (!started) return;
  if (distance(state.player, STATIONS.market) <= 9) openModal('market');
  else { waypoint = 'market'; notify('حددنا لك السوق؛ امشِ باتجاه العلامة'); updateHud(); }
}
function updateHud() {
  const cal = calendar(state);
  $('clock').textContent = cal.time;
  $('calendar').textContent = 'اليوم ' + cal.day + ' · ' + cal.season;
  $('season-icon').textContent = ['✿', '☀', '❧', '❄'][cal.seasonIndex];
  $('day-progress').style.width = cal.progress * 100 + '%';
  $('coins').textContent = number(state.coins);
  $('water-stock').textContent = state.stock.water; $('feed-stock').textContent = state.stock.feed;
  $('milk-stock').textContent = state.milk + ' ل';
  $('water-progress').style.width = Math.min(3, state.quest.watered.length) / 3 * 100 + '%';
  $('feed-progress').style.width = Math.min(3, state.quest.fed.length) / 3 * 100 + '%';
  $('quest-title').textContent = state.quest.paid ? 'أتممت مهمة اليوم' : 'الرعاية أولًا';
  $('quest-detail').textContent = state.quest.paid ? 'القطيع بخير؛ استكشف البادية' :
    state.quest.watered.length >= 3 && state.quest.fed.length >= 3 ? 'ارجع للمخيم لاستلام المكافأة' :
    'ماء ' + Math.min(3, state.quest.watered.length) + '/3 · علف ' + Math.min(3, state.quest.fed.length) + '/3';
  $('quest-badge').textContent = state.quest.paid ? '✓ اكتملت' : '+250 ريال';
  $('call-button').classList.toggle('active', state.following);
  $('call-button').querySelector('span').textContent = state.following ? 'اترك' : 'نداء';
  const ready = selected && distance(state.player, selected) <= INTERACT_DISTANCE;
  $('interact-button').classList.toggle('ready', Boolean(ready));
  $('interact-label').textContent = ready ? labels[selectedTool] : selected ? 'اقترب' : 'وجّه نظرك';
  if (waypoint) {
    const s = STATIONS[waypoint], d = distance(state.player, s);
    if (d < (waypoint === 'market' ? 9 : 5)) { notify('وصلت إلى ' + s.name); waypoint = null; }
    else {
      const targetAngle = Math.atan2(-(s.x - state.player.x), -(s.z - state.player.z));
      const delta = Math.atan2(Math.sin(targetAngle - state.player.yaw), Math.cos(targetAngle - state.player.yaw));
      $('waypoint').textContent = (Math.abs(delta) < 0.4 ? '↑' : delta > 0 ? '←' : '→') + ' ' + s.name + ' · ' + Math.round(d) + ' م';
    }
  }
  $('waypoint').classList.toggle('hidden', !waypoint);
}
for (const button of document.querySelectorAll('[data-tool]')) button.addEventListener('click', () => {
  selectedTool = button.dataset.tool;
  for (const e of document.querySelectorAll('[data-tool]')) e.classList.toggle('selected', e === button);
  updateHud();
});
$('interact-button').addEventListener('click', interact);
$('call-button').addEventListener('click', callHerd);
$('map-button').addEventListener('click', () => openModal('map'));
$('herd-button').addEventListener('click', () => openModal('herd'));
$('settings-button').addEventListener('click', () => openModal('settings'));
$('quest-button').addEventListener('click', () => openModal('quest'));
$('market-button').addEventListener('click', market);
$('modal-close').addEventListener('click', closeModal);
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
$('modal-content').addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.dest) { waypoint = button.dataset.dest; closeModal(); updateHud(); return; }
  if (button.dataset.buy) {
    const result = trade(state, button.dataset.buy); feedback = result.message;
    if (result.ok) { sound('care'); save(); }
    renderModal(); updateHud(); return;
  }
  const action = button.dataset.do;
  if (action === 'start') { started = true; helpUntil = performance.now() + 18000; closeModal(); save(); }
  if (action === 'help') { activeModal = 'help'; renderModal(); }
  if (action === 'intro') { activeModal = 'intro'; renderModal(); }
  if (action === 'close') closeModal();
  if (action === 'clear-waypoint') { waypoint = null; closeModal(); updateHud(); }
  if (action === 'call') { callHerd(); renderModal(); }
  if (action === 'save') { const saved = save(true); button.textContent = saved ? 'تم الحفظ ✓' : 'تعذر الحفظ'; }
  if (action === 'sound') { state.settings.sound = !state.settings.sound; save(); renderModal(); sound('care'); }
  if (action === 'reset') { resetRequested = true; renderModal(); }
  if (action === 'confirm-reset') {
    state = createState(); selected = null; waypoint = null; selectedTool = 'water'; resetRequested = false;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('selected', b.dataset.tool === 'water'));
    world?.resize(state.settings.quality); save(); updateHud(); closeModal(); notify('بدأت رحلة جديدة');
  }
});
$('modal-content').addEventListener('change', e => {
  if (e.target.id === 'quality-select') { state.settings.quality = e.target.value; world?.resize(state.settings.quality); save(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && activeModal) closeModal();
  if (e.key === 'Tab' && activeModal) {
    const focusable = [...$('modal').querySelectorAll('button:not(.hidden):not(:disabled),select')].filter(e => e.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) { last?.focus(); e.preventDefault(); }
    if (!e.shiftKey && document.activeElement === last) { first?.focus(); e.preventDefault(); }
  }
});
window.addEventListener('resize', () => world?.resize(state.settings.quality));
window.addEventListener('pagehide', () => { if (started) save(); });
document.addEventListener('visibilitychange', () => { if (started && document.hidden) save(); });
function fatal() {
  activeModal = 'error'; inertHud(true); $('modal').classList.remove('hidden'); $('modal-close').classList.add('hidden');
  $('modal-content').innerHTML = '<h2 id="modal-title">تعذر تشغيل المشهد</h2><p class="error-copy">أعد فتح اللعبة في Safari أو Chrome حديث مع تسريع الرسوم مفعّل. هذا المشهد يحتاج دعم WebGL 2.</p><button data-do="reload" class="primary">حاول مرة أخرى</button>';
  $('modal-content').querySelector('button').addEventListener('click', () => location.reload());
}
$('world').addEventListener('webglcontextlost', e => { e.preventDefault(); controls.reset(); save(); fatal(); });
renderIntro(); inertHud(true); updateHud();
try {
  const { createWorld } = await import('./world.js');
  world = createWorld($('world'), state);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    let moving = false;
    if (started && !activeModal && !document.hidden) {
      moving = movePlayer(state, controls.read(), dt); tick(state, dt);
      selected = targetCamel(state);
      if (finishQuest(state)) { notify('أنجزت المهمة! استلمت 250 ريال'); sound('care'); save(); }
      if (now - saveAt > 15000) { save(); saveAt = now; }
    }
    if (!document.hidden) {
      world.update(state, dt, moving, started && !activeModal ? selected : null);
      if (now - hudAt > 160) { updateHud(); hudAt = now; }
      if (selected && !activeModal && started) {
        const p = world.screenPosition(selected, 3.7), tag = $('target-tag');
        tag.classList.toggle('hidden', !p.visible);
        tag.style.left = p.x + 'px'; tag.style.top = p.y + 'px';
        $('target-name').textContent = selected.name + ' · ' + Math.round(distance(state.player, selected)) + ' م';
        $('target-stats').textContent = 'ماء ' + Math.round(selected.thirst) + '% · غذاء ' + Math.round(selected.hunger) + '%';
      } else $('target-tag').classList.add('hidden');
    }
    if (now > toastUntil) $('toast').classList.add('hidden');
    $('look-hint').style.opacity = started && now < helpUntil ? '1' : '0';
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (error) { console.error('Badawi scene could not start:', error); fatal(); }
