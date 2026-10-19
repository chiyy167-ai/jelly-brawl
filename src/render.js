/** 只读 state 的画布渲染，并推进粒子池。 */
import { config } from './config.js';
import { chargeZone, stickView } from './input.js';
import { ITEM_NAMES } from './items.js';

const VIEW = 1.15;

export function render(ctx, state, alpha) {
  const w = config.logicalWidth;
  const h = config.logicalHeight;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(0, 0, w, h);
  const cam = camera(state);
  ctx.save();
  ctx.translate(w / 2 + cam.x, h * 0.46 + cam.y);
  ctx.scale(cam.scale, cam.scale);
  drawPlatform(ctx, state);
  for (const blob of state.blobs) if (blob.alive) dot(ctx, blob.x, blob.y, config.blobs.radius, '#ff8cc6');
  for (const item of state.items) if (item.alive) drawItem(ctx, item);
  for (const pudding of state.puddings) if (pudding.alive && pudding.life > 0) dot(ctx, pudding.x, pudding.y, pudding.radius, '#ffd36a');
  stepParticles(state, 1 / 60);
  for (const bit of state.particles) if (bit.alive) dot(ctx, bit.x, bit.y, bit.r, bit.color);
  for (const player of state.players) if (player.on) drawJelly(ctx, player, alpha, state);
  if (state.smokeT > 0) smoke(ctx, state);
  ctx.restore();
  hud(ctx, state, w);
}

function camera(state) {
  const shake = state.shake > 0 ? (Math.random() * 2 - 1) * state.shake : 0;
  const zoom = state.slowT > 0 ? config.juice.zoom : 1;
  return { x: shake, y: shake * 0.4, scale: VIEW * zoom };
}

function drawPlatform(ctx, state) {
  const radius = state.platform.radius;
  ctx.save();
  ctx.rotate(state.platform.angle);
  ctx.fillStyle = state.iceT > 0 ? '#d7f4ff' : '#ffd0e2';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.stroke();
  for (const hole of state.holes) wedge(ctx, radius, hole.angle - state.platform.angle, hole.width, '#8ec8ee');
  const warn = state.event?.type === 'collapse' && !state.event.opened;
  if (warn) wedge(ctx, radius, state.event.angle - state.platform.angle, config.collapse.width, 'rgba(255,60,80,.45)');
  ctx.restore();
}

function wedge(ctx, radius, angle, width, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, angle - width / 2, angle + width / 2);
  ctx.closePath();
  ctx.fill();
}

function drawJelly(ctx, player, alpha, state) {
  const x = player.prevX + (player.x - player.prevX) * alpha;
  const y = player.prevY + (player.y - player.prevY) * alpha;
  const speed = Math.hypot(player.vx, player.vy);
  const stretch = Math.min(0.28, speed / 1800);
  const angle = Math.atan2(player.vy, player.vx);
  const pop = 1 + Math.sin(player.pop * 24) * player.pop;
  ctx.save();
  ctx.translate(x + 8, y + 14);
  ctx.fillStyle = 'rgba(70,30,60,.18)';
  ctx.beginPath();
  ctx.ellipse(0, 0, player.radius * 0.8, player.radius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale((1 + stretch) * pop, (1 - stretch * 0.7) * pop);
  ctx.globalAlpha = player.ghost ? 0.35 : 1;
  if (player.charging) ring(ctx, player);
  ctx.fillStyle = smoked(state, player) ? state.smokeColor : config.colors[player.color];
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(-player.radius * 0.28, -player.radius * 0.32, player.radius * 0.28, player.radius * 0.16, -0.5, 0, Math.PI * 2);
  ctx.fill();
  if (!smoked(state, player)) face(ctx, player);
  ctx.restore();
  if (player.item) label(ctx, x, y - player.radius - 18, ITEM_NAMES[player.item]);
  if (player.charging) bar(ctx, x, y - player.radius - 34, player.charge / config.charge.maxTime);
}

function smoked(state, player) {
  return state.smokeT > 0 && Math.hypot(player.x - state.smokeX, player.y - state.smokeY) < config.smoke.radius;
}

function face(ctx, player) {
  const mood = player.ghost ? 'cry' : player.charging ? 'angry' : player.dizzy > 0 ? 'dizzy' : player.skin;
  const look = player.ghost ? 0 : player.facing;
  const ox = Math.cos(look) * 3;
  const oy = Math.sin(look) * 3;
  ctx.fillStyle = '#3a1020';
  eye(ctx, -8 + ox, -4 + oy, mood);
  eye(ctx, 8 + ox, -4 + oy, mood === 'wink' ? 'shut' : mood);
  ctx.strokeStyle = '#3a1020';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (mood === 'cry') ctx.arc(0, 10, 7, Math.PI, 0);
  else if (mood === 'happy') ctx.arc(0, 4, 8, 0.15, Math.PI - 0.15);
  else ctx.arc(0, 8, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function eye(ctx, x, y, mood) {
  ctx.save();
  ctx.translate(x, y);
  if (mood === 'shut' || mood === 'happy') {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (mood === 'dizzy') {
    ctx.strokeStyle = '#3a1020';
    ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.moveTo(4, -4); ctx.lineTo(-4, 4); ctx.stroke();
  } else {
    ctx.scale(1, mood === 'angry' ? 1.3 : 1.15);
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ring(ctx, player) {
  ctx.strokeStyle = `rgba(255,40,70,${0.35 + player.charge})`;
  ctx.lineWidth = 6 + player.charge * 8;
  ctx.beginPath();
  ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawItem(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y - item.z);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, config.items.radius, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, 0, 4, ITEM_NAMES[item.kind].slice(0, 1));
  ctx.restore();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function bar(ctx, x, y, amount) {
  ctx.fillStyle = '#402030';
  ctx.fillRect(x - 24, y, 48, 8);
  ctx.fillStyle = '#ff315d';
  ctx.fillRect(x - 24, y, 48 * amount, 8);
}

function label(ctx, x, y, text) {
  ctx.fillStyle = '#402030';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function smoke(ctx, state) {
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.arc(state.smokeX, state.smokeY, config.smoke.radius, 0, Math.PI * 2);
  ctx.fill();
}

function hud(ctx, state, w) {
  ctx.fillStyle = '#243044';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.ceil(Math.max(0, config.platform.roundTime - state.roundTime))}  第${state.round}局`, w / 2, 48);
  if (state.bannerT > 0) {
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(state.banner, w / 2, 110);
  }
  const stick = stickView();
  if (stick) {
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(stick.cx, stick.cy, 78, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.arc(stick.cx + stick.sx * 78, stick.cy + stick.sy * 78, 28, 0, Math.PI * 2); ctx.fill();
  }
  const zone = chargeZone();
  ctx.fillStyle = 'rgba(255,70,110,.9)';
  ctx.beginPath();
  ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('冲', zone.x, zone.y + 12);
  if (state.phase === 'COUNTDOWN') {
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(String(Math.ceil(state.count)), w / 2, 360);
  }
}

export function burst(state, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const bit = state.particles.find((item) => !item.alive);
    if (!bit) return;
    const angle = (Math.PI * 2 * i) / count;
    bit.alive = true;
    bit.x = x; bit.y = y; bit.vx = Math.cos(angle) * 80; bit.vy = Math.sin(angle) * 80;
    bit.life = 0.4; bit.r = 4; bit.color = color;
  }
}

function stepParticles(state, dt) {
  for (const bit of state.particles) {
    if (!bit.alive) continue;
    bit.x += bit.vx * dt; bit.y += bit.vy * dt; bit.life -= dt;
    if (bit.life <= 0) bit.alive = false;
  }
}
