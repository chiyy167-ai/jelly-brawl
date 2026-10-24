/** 局内随机事件：调度与每帧推进。只改 MatchState。 */
import { GAME } from './config';
import type { EventKind, MatchState, ScheduledEvent } from './types';

const KINDS: EventKind[] = ['rotate', 'collapse', 'ice', 'gravity'];
const TITLES: Record<EventKind, string> = {
  rotate: '旋转平台！',
  collapse: '塌方！',
  ice: '冰面！',
  gravity: '重力波！',
};

function pickTimes(rng: MatchState['rng'], count: number): number[] {
  const cfg = GAME.events;
  const span = cfg.windowEnd - cfg.windowStart;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const times = Array.from({ length: count }, () => cfg.windowStart + rng.next() * span).sort((a, b) => a - b);
    let ok = true;
    for (let i = 1; i < times.length; i += 1) if (times[i] - times[i - 1] < cfg.minGap) ok = false;
    if (ok) return times;
  }
  return count === 1 ? [(cfg.windowStart + cfg.windowEnd) / 2] : [cfg.windowStart + 3, cfg.windowEnd - 3];
}

function makeEvent(kind: EventKind, start: number, rng: MatchState['rng']): ScheduledEvent {
  const ev: ScheduledEvent = { kind, start, announced: false };
  if (kind === 'collapse') {
    ev.angle = rng.next() * Math.PI * 2;
    ev.half = (GAME.events.collapse.sectorDeg * Math.PI) / 360;
    ev.opened = false;
  }
  if (kind === 'gravity') {
    const g = GAME.events.gravity;
    ev.pulses = [];
    for (let at = start + g.warn; at < start + g.duration; at += g.interval) {
      ev.pulses.push({ at, dir: rng.next() < 0.5 ? -1 : 1, fired: false, warned: false });
    }
  }
  return ev;
}

/** 开局用种子抽 1–2 个事件时间表 */
export function scheduleEvents(rng: MatchState['rng']): ScheduledEvent[] {
  const n = GAME.events.minCount + rng.int(GAME.events.maxCount - GAME.events.minCount + 1);
  const pool = [...KINDS];
  const picked: EventKind[] = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    const idx = rng.int(pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  const times = pickTimes(rng, picked.length);
  return picked.map((kind, i) => makeEvent(kind, times[i], rng));
}

function announce(s: MatchState, text: string): void {
  s.banner = text;
  s.bannerT = GAME.events.banner;
  s.fx.push({ type: 'banner', text });
}

/** 是否落在已塌方扇形内（中心安全区除外） */
export function inHole(s: MatchState, x: number, y: number): boolean {
  const dist2 = x * x + y * y;
  if (dist2 < GAME.events.collapse.minDist ** 2) return false;
  let ang = Math.atan2(y, x) - s.spin;
  for (const h of s.holes) {
    let d = ang - h.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= h.half) return true;
  }
  return false;
}

/** 点是否可站立（台面内且不在塌方缺口） */
export function onStand(s: MatchState, x: number, y: number): boolean {
  if (Math.hypot(x, y) > s.platformRadius) return false;
  return !inHole(s, x, y);
}

export function tickEvents(s: MatchState, dt: number): void {
  if (s.bannerT > 0) {
    s.bannerT -= dt;
    if (s.bannerT <= 0) s.banner = null;
  }
  s.alert = null;
  s.warnHole = null;
  let spinning = false;
  let icy = false;

  for (const ev of s.events) {
    const age = s.time - ev.start;
    if (age < 0) continue;
    if (!ev.announced) {
      ev.announced = true;
      announce(s, TITLES[ev.kind]);
    }
    if (ev.kind === 'rotate' && age < GAME.events.rotate.duration) {
      spinning = true;
      s.spin += GAME.events.rotate.omega * dt;
      const edge = GAME.events.rotate.edgeAccel;
      for (const j of s.jellies) {
        if (!j.alive) continue;
        const d = Math.hypot(j.x, j.y) || 0.001;
        const t = d / s.platformRadius;
        if (t < 0.45) continue;
        // 切向加速度
        j.vx += (-j.y / d) * edge * t * dt;
        j.vy += (j.x / d) * edge * t * dt;
      }
    }
    if (ev.kind === 'ice' && age < GAME.events.ice.duration) icy = true;
    if (ev.kind === 'collapse') {
      const w = GAME.events.collapse.warn;
      if (age < w) {
        s.warnHole = { angle: ev.angle!, half: ev.half! };
      } else if (!ev.opened) {
        ev.opened = true;
        s.holes.push({ angle: ev.angle!, half: ev.half! });
        for (const j of s.jellies) {
          if (j.alive && inHole(s, j.x, j.y)) {
            j.alive = false;
            j.charging = false;
            j.elimTime = s.time;
            j.selfOut += 1;
            s.fx.push({ type: 'fall', id: j.id });
          }
        }
      }
    }
    if (ev.kind === 'gravity' && ev.pulses) {
      for (const p of ev.pulses) {
        if (!p.warned && s.time >= p.at - GAME.events.gravity.warn) {
          p.warned = true;
          s.alert = p.dir < 0 ? '吸向中心！' : '向外推开！';
        }
        if (!p.fired && s.time >= p.at) {
          p.fired = true;
          const imp = GAME.events.gravity.impulse * p.dir;
          for (const j of s.jellies) {
            if (!j.alive) continue;
            const d = Math.hypot(j.x, j.y) || 0.001;
            j.vx += (j.x / d) * imp;
            j.vy += (j.y / d) * imp;
          }
        }
      }
    }
  }
  s.frictionScale = icy ? GAME.events.ice.frictionScale : 1;
  if (!spinning && s.spin !== 0 && Math.abs(s.spin) > 0.001) {
    // 旋转结束后保留角度，塌方扇形仍相对该角度
  }
}
