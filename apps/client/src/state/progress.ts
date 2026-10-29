/** 本机成长进度：等级 / 经验 / 宝石 / 金币 / 每日领取。 */
import { GAME, xpToNext } from '../game/config';
import type { MatchResult, Progress } from '../game/types';

const KEY = 'jelly-brawl.progress';

const DEFAULT: Progress = { level: 1, xp: 0, gems: 0, coins: 0, lastDaily: '' };

let cache: Progress | null = null;
const listeners = new Set<() => void>();
let version = 0;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function loadProgress(): Progress {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      cache = {
        level: Math.max(1, Number(p.level) || 1),
        xp: Math.max(0, Number(p.xp) || 0),
        gems: Math.max(0, Number(p.gems) || 0),
        coins: Math.max(0, Number(p.coins) || 0),
        lastDaily: typeof p.lastDaily === 'string' ? p.lastDaily : '',
      };
      return cache;
    }
  } catch {
    // 忽略
  }
  cache = { ...DEFAULT };
  return cache;
}

function save(p: Progress): void {
  cache = p;
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 忽略
  }
  version += 1;
  listeners.forEach((fn) => fn());
}

export function subscribeProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function progressVersion(): number {
  return version;
}

/** 把经验加进当前等级，自动连升 */
export function addXp(amount: number): Progress {
  const p = { ...loadProgress() };
  let left = Math.max(0, Math.floor(amount));
  while (left > 0) {
    const need = xpToNext(p.level) - p.xp;
    if (left >= need) {
      left -= need;
      p.level += 1;
      p.xp = 0;
    } else {
      p.xp += left;
      left = 0;
    }
  }
  save(p);
  return p;
}

/** 新用户见面礼等一次性加金币 */
export function addCoins(amount: number): Progress {
  const p = { ...loadProgress() };
  p.coins += Math.max(0, Math.floor(amount));
  save(p);
  return p;
}

export function applyMatchRewards(r: MatchResult): Progress {
  const { xp, coins, gems } = r.rewards;
  const p = { ...loadProgress() };
  p.coins += coins;
  p.gems += gems;
  save(p);
  return addXp(xp);
}

/** 首次完成/跳过新手教程的额外奖励（幂等：调用方保证只发一次） */
export function grantTutorialBonus(): Progress {
  const t = GAME.tutorial;
  const p = { ...loadProgress() };
  p.coins += t.bonusCoins;
  save(p);
  return addXp(t.bonusXp);
}

export function canClaimDaily(): boolean {
  return loadProgress().lastDaily !== today();
}

export function claimDaily(): Progress | null {
  if (!canClaimDaily()) return null;
  const e = GAME.economy;
  const p = { ...loadProgress() };
  p.coins += e.dailyCoins;
  p.gems += e.dailyGems;
  p.lastDaily = today();
  save(p);
  return p;
}

/** 100 金币换 1 宝石 */
export function exchangeGem(): Progress | null {
  const cost = GAME.economy.gemCostCoins;
  const p = { ...loadProgress() };
  if (p.coins < cost) return null;
  p.coins -= cost;
  p.gems += 1;
  save(p);
  return p;
}

/** 扣金币（商城买道具） */
export function spendCoins(n: number): boolean {
  const need = Math.max(0, Math.floor(n));
  const p = { ...loadProgress() };
  if (p.coins < need) return false;
  p.coins -= need;
  save(p);
  return true;
}

/** 扣宝石（传说道具） */
export function spendGems(n: number): boolean {
  const need = Math.max(0, Math.floor(n));
  const p = { ...loadProgress() };
  if (p.gems < need) return false;
  p.gems -= need;
  save(p);
  return true;
}

export function xpBar(): { level: number; xp: number; need: number; pct: number } {
  const p = loadProgress();
  const need = xpToNext(p.level);
  return { level: p.level, xp: p.xp, need, pct: Math.min(100, (p.xp / need) * 100) };
}
