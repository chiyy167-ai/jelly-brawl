/** 单机练习与掉线接管用的简单对手。 */
import { config } from './config.js';

export function thinkAi(state, dt) {
  for (const player of state.players) {
    if (!player.alive || player.ghost || !player.isAI) continue;
    player.aiT -= dt;
    if (player.aiT > 0) continue;
    player.aiT = config.ai.interval;
    const blob = nearest(state.blobs, player, (item) => item.alive);
    const foe = nearest(state.players, player, (item) => item.alive && !item.ghost && item !== player);
    const target = blob && (!foe || player.level < 3) ? blob : foe;
    if (!target) { player.wish = { x: 0, y: 0, charge: false, released: false }; continue; }
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    const charge = foe && len < 150 && state.rng.next() < config.ai.chargeChance;
    const was = player.wish?.charge;
    player.wish = { x: dx / len, y: dy / len, charge, released: was && !charge, tap: null };
  }
}

function nearest(list, player, ok) {
  let best = null;
  let dist = Infinity;
  for (const item of list) {
    if (!ok(item)) continue;
    const d = (item.x - player.x) ** 2 + (item.y - player.y) ** 2;
    if (d < dist) { dist = d; best = item; }
  }
  return best;
}
