import { clamp } from './simulation.js';
export function joystickVector(dx, dy, radius) {
  const d = Math.hypot(dx, dy);
  if (d < radius * 0.1) return { right: 0, forward: 0, x: 0, y: 0 };
  const ratio = Math.min(1, radius / d);
  return { right: dx * ratio / radius, forward: -dy * ratio / radius, x: dx * ratio, y: dy * ratio };
}
export function bindControls({ canvas, joystick, knob, runButton, player, onInteract }) {
  const keys = new Set();
  const stick = { right: 0, forward: 0 };
  let stickPointer = null, lookPointer = null, lastX = 0, lastY = 0, running = false;
  const reset = () => {
    keys.clear(); stick.right = 0; stick.forward = 0;
    running = false; stickPointer = null; lookPointer = null;
    knob.style.transform = 'translate(0px, 0px)';
    runButton.classList.remove('active');
  };
  const stopStick = e => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null; stick.right = 0; stick.forward = 0;
    knob.style.transform = 'translate(0px, 0px)';
  };
  const moveStick = e => {
    if (e.pointerId !== stickPointer) return;
    const r = joystick.getBoundingClientRect();
    const v = joystickVector(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, r.width * 0.32);
    Object.assign(stick, { right: v.right, forward: v.forward });
    knob.style.transform = 'translate(' + v.x + 'px, ' + v.y + 'px)';
  };
  joystick.addEventListener('pointerdown', e => {
    if (stickPointer !== null) return;
    e.preventDefault(); stickPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId); moveStick(e);
  });
  joystick.addEventListener('pointermove', moveStick);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(type, stopStick);
  canvas.addEventListener('pointerdown', e => {
    if (lookPointer !== null) return;
    e.preventDefault(); lookPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== lookPointer) return;
    player().yaw -= (e.clientX - lastX) * 0.004;
    player().pitch = clamp(player().pitch - (e.clientY - lastY) * 0.003, -0.8, 0.8);
    lastX = e.clientX; lastY = e.clientY;
  });
  const stopLook = e => { if (e.pointerId === lookPointer) lookPointer = null; };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, stopLook);
  runButton.addEventListener('click', () => { running = !running; runButton.classList.toggle('active', running); });
  const allowed = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName || '')) return;
    if (allowed.includes(e.code)) { keys.add(e.code); e.preventDefault(); }
    if (e.code === 'KeyE' && !e.repeat) onInteract();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  return {
    reset,
    read: () => ({
      forward: clamp(stick.forward + Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')), -1, 1),
      right: clamp(stick.right + Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')), -1, 1),
      run: running || keys.has('ShiftLeft') || keys.has('ShiftRight')
    })
  };
}
