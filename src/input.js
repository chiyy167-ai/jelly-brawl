/** 摇杆、键盘与冲刺按钮。输出标准化输入，不碰游戏规则。 */
const W = 720;
const H = 1280;
const keys = new Set();
const sticks = new Map();
let chargeId = null;
let chargeHeld = false;
let chargeWas = false;
let tap = null;
let canvas;

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * W,
    y: ((event.clientY - rect.top) / rect.height) * H,
    id: event.pointerId,
  };
}

export function chargeZone() {
  return { x: W - 118, y: H - 168, r: 74 };
}

function inCharge(p) {
  const z = chargeZone();
  return Math.hypot(p.x - z.x, p.y - z.y) <= z.r;
}

export function bindInput(target, onFirst) {
  canvas = target;
  const down = (event) => {
    onFirst();
    canvas.setPointerCapture?.(event.pointerId);
    const p = point(event);
    if (p.x > W * 0.58 && inCharge(p) && chargeId == null) chargeId = p.id;
    else if (p.x < W * 0.62) sticks.set(p.id, { ...p, cx: p.x, cy: p.y, sx: 0, sy: 0 });
    event.preventDefault();
  };
  const move = (event) => {
    const p = point(event);
    const stick = sticks.get(p.id);
    if (!stick) return;
    const dx = p.x - stick.cx;
    const dy = p.y - stick.cy;
    const len = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, len / 78);
    stick.sx = dx / len * scale;
    stick.sy = dy / len * scale;
  };
  const up = (event) => {
    const p = point(event);
    const stick = sticks.get(p.id);
    if (stick && Math.hypot(p.x - stick.cx, p.y - stick.cy) < 14) tap = { x: p.x, y: p.y };
    sticks.delete(p.id);
    if (chargeId === p.id) chargeId = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  addEventListener('keyup', (event) => keys.delete(event.code));
}

export function stickView() {
  let view = null;
  sticks.forEach((stick) => { view = stick; });
  return view;
}

export function sampleInput() {
  let x = 0;
  let y = 0;
  sticks.forEach((stick) => { x = stick.sx; y = stick.sy; });
  if (!sticks.size) {
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
  }
  const nextCharge = chargeId != null || keys.has('Space');
  const released = chargeWas && !nextCharge;
  chargeWas = nextCharge;
  const picked = tap;
  tap = null;
  return { x, y, charge: nextCharge, released, tap: picked };
}
