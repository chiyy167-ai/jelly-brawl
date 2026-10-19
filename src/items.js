/** 糖果道具的掉落、拾取和生效。 */
import { config } from './config.js';

export const ITEM_NAMES = { spring: '弹簧', shield: '护盾', magnet: '磁铁', smoke: '烟雾' };
const KINDS = Object.keys(ITEM_NAMES);

export function stepItems(state, dt) {
  state.itemT -= dt;
  if (state.itemT <= 0) {
    state.itemT = config.items.interval;
    const slot = state.items.find((item) => !item.alive);
    if (slot) {
      const angle = state.rng.next() * Math.PI * 2;
      const dist = state.rng.range(0, state.platform.radius * 0.75);
      slot.alive = true;
      slot.kind = state.rng.pick(KINDS);
      slot.x = Math.cos(angle) * dist;
      slot.y = Math.sin(angle) * dist;
      slot.z = 80;
    }
  }
  for (const item of state.items) {
    if (!item.alive) continue;
    item.z = Math.max(0, item.z - dt * 140);
    for (const player of state.players) {
      if (!player.on || !player.alive || player.ghost) continue;
      if (busy(player)) continue;
      if (Math.hypot(player.x - item.x, player.y - item.y) < player.radius + config.items.radius) {
        grant(state, player, item.kind);
        item.alive = false;
        player.justItem = true;
      }
    }
  }
  for (const player of state.players) if (player.smoke > 0) player.smoke = Math.max(0, player.smoke - dt);
}

function busy(player) {
  return player.spring || player.shield > 0 || player.magnet > 0 || player.smoke > 0;
}

function grant(state, player, kind) {
  player.item = kind;
  if (kind === 'spring') player.spring = true;
  if (kind === 'shield') player.shield = config.shield.duration;
  if (kind === 'magnet') player.magnet = config.magnet.duration;
  if (kind === 'smoke') {
    player.smoke = config.smoke.duration;
    state.smokeX = player.x;
    state.smokeY = player.y;
    state.smokeT = config.smoke.duration;
    state.smokeColor = player.color;
  }
}

export function stepBlobs(state, dt) {
  state.blobT -= dt;
  const count = state.blobs.filter((item) => item.alive).length;
  if (state.blobT <= 0 && count < config.blobs.max) {
    state.blobT = config.blobs.interval;
    const slot = state.blobs.find((item) => !item.alive);
    const angle = state.rng.next() * Math.PI * 2;
    const dist = state.rng.range(0, state.platform.radius * 0.8);
    slot.alive = true;
    slot.x = Math.cos(angle) * dist;
    slot.y = Math.sin(angle) * dist;
  }
  for (const blob of state.blobs) {
    if (!blob.alive) continue;
    for (const player of state.players) {
      if (!player.on || !player.alive || player.ghost) continue;
      if (Math.hypot(player.x - blob.x, player.y - blob.y) >= player.radius + config.blobs.radius) continue;
      blob.alive = false;
      player.eaten += 1;
      player.justEat = true;
      if (player.level < 3) {
        player.level += 1;
        player.pop = 0.28;
        player.justUp = true;
      }
    }
  }
  void dt;
}
