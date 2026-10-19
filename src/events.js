/** 四个局内事件。随机序列只使用传入的 rng。 */
import { config } from './config.js';

const TYPES = ['spin', 'collapse', 'ice', 'gravity'];

export function planEvents(rng) {
  const count = 1 + rng.int(2);
  const pool = [...TYPES];
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const type = pool.splice(rng.int(pool.length), 1)[0];
    events.push({ type, at: rng.range(config.events.minT, config.events.maxT), started: false });
  }
  return events.sort((a, b) => a.at - b.at);
}

export function stepEvents(state, dt) {
  state.bannerT = Math.max(0, state.bannerT - dt);
  state.iceT = Math.max(0, state.iceT - dt);
  state.smokeT = Math.max(0, state.smokeT - dt);
  const due = state.events.find((item) => !item.started && state.roundTime >= item.at);
  if (due) begin(state, due);
  const event = state.event;
  if (!event) return;
  event.t -= dt;
  if (event.type === 'collapse' && !event.opened && event.t <= 0) {
    event.opened = true;
    state.holes.push({ angle: event.angle, width: config.collapse.width });
    say(state, '地面塌了');
  }
  if (event.type === 'gravity') pulse(state, dt);
  if (event.t <= 0 && event.type !== 'collapse') state.event = null;
}

function begin(state, plan) {
  plan.started = true;
  if (plan.type === 'spin') {
    state.event = { type: 'spin', t: 12 };
    say(state, '平台旋转');
  } else if (plan.type === 'collapse') {
    state.event = { type: 'collapse', t: config.collapse.warn, angle: state.rng.range(-Math.PI, Math.PI), opened: false };
    say(state, '塌方预警');
  } else if (plan.type === 'ice') {
    state.event = { type: 'ice', t: config.ice.duration };
    state.iceT = config.ice.duration;
    say(state, '冰面');
  } else {
    state.event = { type: 'gravity', t: 12, clock: config.gravity.warn, dir: state.rng.next() < 0.5 ? -1 : 1 };
    say(state, '重力波');
  }
}

function pulse(state, dt) {
  const event = state.event;
  event.clock -= dt;
  if (event.clock > 0 && event.clock < config.gravity.warn) say(state, event.dir < 0 ? '即将吸向中心' : '即将向外推开');
  if (event.clock > 0) return;
  state.gravPulse = { dir: event.dir, life: 0.28 };
  event.clock = config.gravity.interval;
  event.dir *= -1;
}

export function applyGravity(state, dt) {
  if (!state.gravPulse || state.gravPulse.life <= 0) return;
  state.gravPulse.life -= dt;
  for (const player of state.players) {
    if (!player.on || !player.alive || player.ghost) continue;
    const dist = Math.hypot(player.x, player.y) || 1;
    const force = config.gravity.force * state.gravPulse.dir;
    player.vx += player.x / dist * force * dt * 4;
    player.vy += player.y / dist * force * dt * 4;
  }
}

function say(state, text) {
  state.banner = text;
  state.bannerT = 1.4;
}
