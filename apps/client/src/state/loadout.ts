/** 开局携带道具：本机库存 + 下一场装备（进对局时消耗 1 个）。 */
import { ITEM_BY_ID, ITEM_DEFS } from '../game/itemCatalog';
import type { ItemKind } from '../game/types';
import { loadProgress, spendCoins, spendGems, subscribeProgress } from './progress';

const KEY = 'jelly-brawl.loadout';

export interface LoadoutState {
  bag: Partial<Record<ItemKind, number>>;
  equipped: ItemKind | null;
}

const DEFAULT: LoadoutState = { bag: {}, equipped: null };

let cache: LoadoutState | null = null;
let version = 0;
const listeners = new Set<() => void>();

function read(): LoadoutState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as LoadoutState;
      const bag: LoadoutState['bag'] = {};
      for (const d of ITEM_DEFS) {
        const n = Number(p.bag?.[d.id] ?? 0);
        if (n > 0) bag[d.id] = Math.min(99, Math.floor(n));
      }
      const eq = p.equipped && ITEM_BY_ID[p.equipped] ? p.equipped : null;
      cache = { bag, equipped: eq && (bag[eq] ?? 0) > 0 ? eq : null };
      return cache;
    }
  } catch {
    // 忽略损坏存档
  }
  cache = { ...DEFAULT, bag: {} };
  return cache;
}

function write(s: LoadoutState): void {
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 忽略
  }
  version += 1;
  listeners.forEach((fn) => fn());
}

export function subscribeLoadout(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function loadoutVersion(): number {
  return version;
}

export function loadLoadout(): LoadoutState {
  return read();
}

export function bagCount(id: ItemKind): number {
  return read().bag[id] ?? 0;
}

/** 用金币/宝石买 1 个进背包 */
export function buyItem(id: ItemKind): string | null {
  const def = ITEM_BY_ID[id];
  if (!def) return '未知道具';
  const prog = loadProgress();
  if (def.currency === 'coins' && prog.coins < def.price) return '金币不足';
  if (def.currency === 'gems' && prog.gems < def.price) return '宝石不足';
  if (def.currency === 'coins') {
    if (!spendCoins(def.price)) return '金币不足';
  } else if (!spendGems(def.price)) return '宝石不足';
  const cur = read();
  const s: LoadoutState = { bag: { ...cur.bag }, equipped: cur.equipped };
  s.bag[id] = (s.bag[id] ?? 0) + 1;
  write(s);
  return null;
}

/** 装备为下一场开局道具（需背包里有） */
export function equipItem(id: ItemKind | null): string | null {
  const cur = read();
  const s: LoadoutState = { bag: { ...cur.bag }, equipped: cur.equipped };
  if (id === null) {
    s.equipped = null;
    write(s);
    return null;
  }
  if ((s.bag[id] ?? 0) < 1) return '背包里没有这个道具，请先购买';
  s.equipped = id;
  write(s);
  return null;
}

/**
 * 开局取走已装备道具：返回 kind 并扣库存。
 * 没装备或库存空则返回 null。
 */
export function consumeEquipped(): ItemKind | null {
  const cur = read();
  const s: LoadoutState = { bag: { ...cur.bag }, equipped: cur.equipped };
  const id = s.equipped;
  if (!id || (s.bag[id] ?? 0) < 1) {
    s.equipped = null;
    write(s);
    return null;
  }
  s.bag[id] = (s.bag[id] ?? 1) - 1;
  if ((s.bag[id] ?? 0) <= 0) delete s.bag[id];
  s.equipped = null;
  write(s);
  return id;
}

/** 只看下一场会带什么，不消耗（联机发 profile 用） */
export function peekEquipped(): ItemKind | null {
  const s = read();
  if (!s.equipped || (s.bag[s.equipped] ?? 0) < 1) return null;
  return s.equipped;
}

// 货币变更时让商城一起刷新
subscribeProgress(() => {
  version += 1;
  listeners.forEach((fn) => fn());
});
