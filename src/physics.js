/** 固定步长的圆形刚体：移动、冲刺、碰撞、出界。 */
import { config, platformTarget } from './config.js';

export function applyStats(player) {
  const stats = config.levels[player.level - 1];
  player.radius = stats.radius;
  player.mass = stats.mass;
  player.speed = stats.speed;
  player.impact = stats.impact;
  player.resist = stats.resist;
}

export function stepPhysics(state, dt) {
  const ice = state.iceT > 0 ? config.ice.frictionScale : 1;
  const friction = Math.exp(-config.physics.friction * ice * dt);
  state.platform.radius += (platformTarget(state.roundTime) - state.platform.radius) * Math.min(1, dt / config.platform.shrinkDuration);
  if (state.event?.type === 'spin') state.platform.angle += config.platform.rotateSpeed * dt;

  for (const player of living(state)) {
    const input = player.wish || { x: 0, y: 0, charge: false, released: false };
    steer(state, player, input, dt);
    if (state.event?.type === 'spin') spinForce(player, state.platform.radius, dt);
    player.vx *= friction;
    player.vy *= friction;
    cap(player);
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.dashT = Math.max(0, player.dashT - dt);
    player.hurtCd = Math.max(0, player.hurtCd - dt);
    player.shield = Math.max(0, player.shield - dt);
    player.magnet = Math.max(0, player.magnet - dt);
    player.dizzy = Math.max(0, player.dizzy - dt);
    player.pop = Math.max(0, player.pop - dt);
  }
  for (const pudding of state.puddings) if (pudding.alive) pudding.life -= dt;
  collideAll(state);
  eliminate(state);
}

function living(state) {
  return state.players.filter((player) => player.on && player.alive && !player.ghost);
}

function steer(state, player, input, dt) {
  if (input.x || input.y) player.facing = Math.atan2(input.y, input.x);
  if (input.charge && player.cool <= 0 && player.dashT <= 0) {
    player.charge = Math.min(config.charge.maxTime, player.charge + dt);
    player.charging = true;
  }
  if (input.released && player.charging) launch(player);
  if (!input.charge) player.charging = player.charge > 0 && !input.released ? false : player.charging;
  player.cool = Math.max(0, player.cool - dt);
  const scale = player.charging ? config.charge.moveScale : 1;
  player.vx += input.x * player.speed * scale * dt * 3.2;
  player.vy += input.y * player.speed * scale * dt * 3.2;
  if (player.magnet > 0) attract(state, player, dt);
}

function launch(player) {
  const amount = player.charge / config.charge.maxTime;
  let force = config.charge.minForce + (config.charge.maxForce - config.charge.minForce) * amount;
  if (player.spring) { force *= config.spring.multiplier; player.spring = false; }
  player.vx += Math.cos(player.facing) * force;
  player.vy += Math.sin(player.facing) * force;
  player.charge = 0;
  player.charging = false;
  player.cool = config.charge.cooldown;
  player.dashT = 0.22;
  player.justDash = true;
}

function spinForce(player, radius, dt) {
  const dist = Math.hypot(player.x, player.y);
  if (dist < radius * 0.62) return;
  const ang = Math.atan2(player.y, player.x) + Math.PI / 2;
  player.vx += Math.cos(ang) * config.platform.rotateSpeed * dist * dt;
  player.vy += Math.sin(ang) * config.platform.rotateSpeed * dist * dt;
}

function attract(state, player, dt) {
  for (const blob of state.blobs) {
    if (!blob.alive) continue;
    const dx = player.x - blob.x;
    const dy = player.y - blob.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > config.magnet.range) continue;
    blob.x += dx / dist * config.magnet.speed * dt;
    blob.y += dy / dist * config.magnet.speed * dt;
  }
}

function cap(body) {
  const speed = Math.hypot(body.vx, body.vy);
  if (speed > config.physics.maxSpeed) {
    body.vx *= config.physics.maxSpeed / speed;
    body.vy *= config.physics.maxSpeed / speed;
  }
}

function collideAll(state) {
  const bodies = [...living(state), ...state.puddings.filter((item) => item.alive && item.life > 0)];
  for (let i = 0; i < bodies.length; i += 1) {
    for (let j = i + 1; j < bodies.length; j += 1) bounce(state, bodies[i], bodies[j]);
  }
}

function bounce(state, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const min = a.radius + b.radius;
  if (dist > min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  const inv = 1 / (a.mass + b.mass);
  a.x -= nx * overlap * b.mass * inv;
  a.y -= ny * overlap * b.mass * inv;
  b.x += nx * overlap * a.mass * inv;
  b.y += ny * overlap * a.mass * inv;
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel > 0) return;
  const j = -(1 + config.physics.restitution) * rel / (1 / a.mass + 1 / b.mass);
  const pudding = a.kind === 'pudding' || b.kind === 'pudding';
  shove(a, b, nx, ny, j, pudding);
  shove(b, a, -nx, -ny, j, pudding);
  if (!pudding && a.id && b.id && a.hurtCd <= 0 && b.hurtCd <= 0) {
    a.hurtCd = b.hurtCd = 0.35;
    a.lastHitBy = b.id; b.lastHitBy = a.id;
    a.lastHitTime = state.time; b.lastHitTime = state.time;
    const power = Math.abs(j) * 0.5 * (a.impact || 1) * (b.impact || 1);
    if (power > config.charge.heavyImpact) {
      state.hitStop = config.charge.hitStop;
      state.shake = config.charge.shake;
      state.slowT = config.juice.slowMo;
      a.justHit = b.justHit = true;
      hurt(state, a, power);
      hurt(state, b, power);
    }
  }
}

function shove(body, other, nx, ny, impulse, pudding) {
  if (body.kind === 'pudding' || body.shield > 0) {
    if (body.kind !== 'pudding') return;
  }
  const resist = body.resist || 1;
  body.vx -= impulse * nx / body.mass / resist * (body.shield > 0 ? 0 : 1);
  body.vy -= impulse * ny / body.mass / resist * (body.shield > 0 ? 0 : 1);
  if (!pudding && body.shield <= 0) body.dizzy = 0.35;
  void other;
}

function hurt(state, player, power) {
  if (!player.id || player.shield > 0 || player.level <= 1 || power < config.charge.heavyImpact) return;
  player.level -= 1;
  applyStats(player);
  player.justDown = true;
  const blob = state.blobs.find((item) => !item.alive);
  if (blob) {
    blob.alive = true;
    blob.x = player.x + player.radius + 8;
    blob.y = player.y;
  }
}

function eliminate(state) {
  for (const player of living(state)) {
    const dist = Math.hypot(player.x, player.y);
    const hole = state.holes.find((item) => {
      let delta = Math.atan2(player.y, player.x) - item.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      return Math.abs(delta) < item.width / 2 && dist > state.platform.radius * config.collapse.inner;
    });
    if (hole || dist > state.platform.radius + player.radius * 0.25 + config.physics.fallMargin) {
      player.alive = false;
      player.ghost = true;
      player.justElim = true;
      player.elimTime = state.roundTime;
    }
  }
}
