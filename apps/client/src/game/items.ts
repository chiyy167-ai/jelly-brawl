/** 神秘道具箱掉落、开箱、持续效果与地面装置。 */
import { GAME } from './config';
import { onStand } from './events';
import { ITEM_COLORS } from './maps';
import type { Candy, Hazard, HazardKind, ItemKind, Jelly, MatchState } from './types';

export const ITEM_KINDS: ItemKind[] = [
  'rocket', 'shield', 'pad', 'grow', 'magnet',
  'banana', 'mine', 'snow', 'star', 'glove', 'cake',
];

const HAZARD_KINDS: HazardKind[] = ['pad', 'banana', 'mine'];

export function hazardKindIndex(kind: HazardKind): number {
  return HAZARD_KINDS.indexOf(kind);
}

export function hazardKindFromIndex(i: number): HazardKind {
  return HAZARD_KINDS[i] ?? 'banana';
}

function landPoint(s: MatchState): { x: number; y: number } {
  const margin = GAME.items.radius + 1.2;
  for (let i = 0; i < 8; i += 1) {
    const ang = s.rng.next() * Math.PI * 2;
    const r = Math.sqrt(s.rng.next()) * Math.max(0, s.platformRadius - margin);
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    if (onStand(s, x, y)) return { x, y };
  }
  return { x: 0, y: 0 };
}

function giveItem(j: Jelly, kind: ItemKind): void {
  if (!j.item) j.item = kind;
  else j.itemB = kind;
  j.itemHold = 0;
}
export function promoteSpare(j: Jelly): void {
  if (j.item || !j.itemB) return;
  j.item = j.itemB;
  j.itemB = null;
  j.itemHold = 0;
}
export function swapHeld(j: Jelly): void {
  if (!j.item && !j.itemB) return;
  const next = j.itemB;
  j.itemB = j.item;
  j.item = next;
  j.itemHold = 0;
}

function placeHazard(s: MatchState, kind: HazardKind, j: Jelly): void {
  const cfg = GAME.items[kind];
  s.hazards.push({ kind, x: j.x, y: j.y, life: cfg.life, radius: cfg.radius, ownerId: j.id, arm: cfg.arm });
}

function popItem(s: MatchState, j: Jelly, kind: string): void {
  s.fx.push({ type: 'item', x: j.x, y: j.y, color: ITEM_COLORS[kind] ?? 0xffffff });
}

function growOne(j: Jelly): void {
  if (j.level >= GAME.levels.length) return;
  j.level += 1;
  const lv = GAME.levels[j.level - 1];
  j.radius = lv.radius;
  j.mass = lv.mass;
  j.speed = lv.speed;
  j.impact = lv.impact;
  j.resist = lv.resist;
}

function openBox(s: MatchState, jellyId: number): void {
  const j = s.jellies[jellyId];
  if (!j) return;
  const kind = ITEM_KINDS[s.rng.int(ITEM_KINDS.length)];
  giveItem(j, kind);
  const text = `获得${lootBanner(kind)}`;
  popItem(s, j, kind);
  if (j.isPlayer) {
    s.banner = text;
    s.bannerT = Math.min(GAME.events.banner, 1.2);
    s.fx.push({ type: 'banner', text });
  }
}

/** 释放手持道具。拳套 / 雪球改为下一次冲刺才消耗。 */
export function useHeldItem(s: MatchState, j: Jelly): void {
  const kind = j.item;
  if (!kind || !j.alive) return;
  if ((kind === 'glove' || kind === 'snow') && j.gloveMul > 1) return;
  const it = GAME.items;
  let text = lootBanner(kind);
  if (kind === 'shield') j.shield = it.shield.duration;
  else if (kind === 'magnet') j.magnet = it.magnet.duration;
  else if (kind === 'rocket') j.rocket = it.rocket.duration;
  else if (kind === 'star') j.star = it.star.duration;
  else if (kind === 'grow' || kind === 'cake') growOne(j);
  else if (kind === 'pad' || kind === 'banana' || kind === 'mine') placeHazard(s, kind, j);
  else if (kind === 'glove') {
    j.gloveMul = it.glove.knockMul;
    text = '下一次冲刺增强';
  } else if (kind === 'snow') {
    j.gloveMul = 2;
    text = '下一次冲刺冰冻';
  }
  popItem(s, j, kind);
  if (kind !== 'glove' && kind !== 'snow') {
    j.item = null;
    promoteSpare(j);
  }
  if (j.isPlayer) {
    s.banner = text;
    s.bannerT = 1.1;
    s.fx.push({ type: 'banner', text });
  }
}

function lootBanner(kind: ItemKind): string {
  const map: Record<ItemKind, string> = {
    rocket: '冲刺火箭！',
    shield: '护盾！',
    pad: '弹跳跳板！',
    grow: '体型果块！',
    magnet: '磁力糖果！',
    banana: '香蕉皮！',
    mine: '地雷！',
    snow: '冰冻雪球！',
    star: '能量星！',
    glove: '拳击手套！',
    cake: '美味蛋糕！',
  };
  return map[kind];
}

function pullBlobs(s: MatchState, jid: number, dt: number): void {
  const j = s.jellies[jid];
  const reach = GAME.items.magnet.radius;
  const pull = GAME.items.magnet.pull;
  for (const b of s.blobs) {
    if (!b.alive) continue;
    const dx = j.x - b.x;
    const dy = j.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01 || dist > reach) continue;
    b.x += (dx / dist) * pull * dt;
    b.y += (dy / dist) * pull * dt;
  }
}

function mineBlast(s: MatchState, h: Hazard): void {
  const cfg = GAME.items.mine;
  for (const o of s.jellies) {
    if (!o.alive || o.airT > 0) continue;
    const dx = o.x - h.x;
    const dy = o.y - h.y;
    const dist = Math.hypot(dx, dy);
    if (dist > cfg.blast) continue;
    const nx = dist < 0.2 ? Math.cos(o.facing) : dx / dist;
    const ny = dist < 0.2 ? Math.sin(o.facing) : dy / dist;
    const force = cfg.force * (1 - dist / cfg.blast);
    o.vx += nx * force;
    o.vy += ny * force;
    o.dizzy = Math.max(o.dizzy, 0.45);
  }
  s.fx.push({ type: 'hit', x: h.x, y: h.y, heavy: true });
  s.shake = Math.max(s.shake, GAME.charge.shake);
}

function triggerPad(s: MatchState, j: Jelly, h: Hazard): void {
  const cfg = GAME.items.pad;
  const dx = j.x - h.x;
  const dy = j.y - h.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const nx = dx / dist;
  const ny = dy / dist;
  j.vx += nx * cfg.impulse;
  j.vy += ny * cfg.impulse;
  j.airT = cfg.air;
  j.fallY = Math.max(j.fallY, 1.8);
  j.fallVy = 6;
  h.life = 0;
  s.fx.push({ type: 'hit', x: h.x, y: h.y, heavy: false });
}

function triggerBanana(s: MatchState, j: Jelly, h: Hazard): void {
  const cfg = GAME.items.banana;
  j.dizzy = Math.max(j.dizzy, cfg.slip);
  const a = s.rng.next() * Math.PI * 2;
  j.vx += Math.cos(a) * cfg.spin;
  j.vy += Math.sin(a) * cfg.spin;
  j.charging = false;
  j.charge = 0;
  h.life = 0;
  s.fx.push({ type: 'hit', x: h.x, y: h.y, heavy: false });
}

function tickHazards(s: MatchState, dt: number): void {
  for (let i = s.hazards.length - 1; i >= 0; i -= 1) {
    const h = s.hazards[i];
    h.life -= dt;
    if (h.arm > 0) h.arm = Math.max(0, h.arm - dt);
    if (h.life <= 0) {
      s.hazards.splice(i, 1);
      continue;
    }
    if (h.arm > 0) continue;
    for (const j of s.jellies) {
      if (!j.alive || j.airT > 0) continue;
      const reach = j.radius + h.radius;
      if ((j.x - h.x) ** 2 + (j.y - h.y) ** 2 > reach * reach) continue;
      if (h.kind === 'pad') triggerPad(s, j, h);
      else if (h.kind === 'banana') triggerBanana(s, j, h);
      else if (h.kind === 'mine') {
        mineBlast(s, h);
        h.life = 0;
      }
      break;
    }
    if (h.life <= 0) s.hazards.splice(i, 1);
  }
}

/** 冰冻停步。火箭只削弱侧向，正前方仍按加速倍率走。 */
export function scaleInput(j: Jelly, cmd: { x: number; y: number }): { x: number; y: number } {
  if (j.freezeT > 0) return { x: 0, y: 0 };
  if (j.rocket <= 0) return cmd;
  const t = GAME.items.rocket.turnScale;
  const fx = Math.cos(j.facing);
  const fy = Math.sin(j.facing);
  const forward = cmd.x * fx + cmd.y * fy;
  return { x: forward * fx + (cmd.x - forward * fx) * t, y: forward * fy + (cmd.y - forward * fy) * t };
}

export function seedItems(s: MatchState, count = 2): void {
  for (let i = 0; i < count; i += 1) {
    const point = landPoint(s);
    const candy: Candy = { id: s.candySeq++, x: point.x, y: point.y, t: 1, alive: true };
    s.candies.push(candy);
  }
}

export function tickItems(s: MatchState, dt: number): void {
  for (const c of s.candies) {
    if (!c.alive) continue;
    if (c.t < 1) c.t = Math.min(1, c.t + dt / GAME.items.fallSeconds);
    if (c.t < 1) continue;
    for (const j of s.jellies) {
      if (!j.alive) continue;
      const reach = j.radius + GAME.items.radius;
      if ((j.x - c.x) ** 2 + (j.y - c.y) ** 2 > reach * reach) continue;
      c.alive = false;
      openBox(s, j.id);
      break;
    }
  }

  for (const j of s.jellies) {
    if (j.item || j.itemB) j.itemHold += dt;
    if (j.shield > 0) j.shield = Math.max(0, j.shield - dt);
    if (j.rocket > 0) j.rocket = Math.max(0, j.rocket - dt);
    if (j.star > 0) j.star = Math.max(0, j.star - dt);
    if (j.freezeT > 0) j.freezeT = Math.max(0, j.freezeT - dt);
    if (j.airT > 0) {
      j.airT = Math.max(0, j.airT - dt);
      if (j.alive) {
        j.fallVy -= 22 * dt;
        j.fallY += j.fallVy * dt;
        if (j.fallY < 0 || j.airT <= 0) {
          j.fallY = 0;
          j.fallVy = 0;
        }
      }
    }
    if (j.magnet > 0) {
      j.magnet = Math.max(0, j.magnet - dt);
      if (j.alive) pullBlobs(s, j.id, dt);
    }
  }

  tickHazards(s, dt);

  s.itemAcc += dt;
  if (s.itemAcc < GAME.items.every) return;
  s.itemAcc -= GAME.items.every;
  const living = s.candies.filter((c) => c.alive).length;
  if (living >= GAME.items.maxOnField) return;
  const slot = s.candies.find((c) => !c.alive);
  const point = landPoint(s);
  if (slot) {
    slot.x = point.x;
    slot.y = point.y;
    slot.t = 0;
    slot.alive = true;
  } else {
    const candy: Candy = { id: s.candySeq++, x: point.x, y: point.y, t: 0, alive: true };
    s.candies.push(candy);
  }
}
