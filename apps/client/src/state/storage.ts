/** 本地存储：已选皮肤、本机战绩。登录后战绩还会同步到 Supabase（见 cloudHistory.ts）。 */
import { DEFAULT_SKIN, SKINS } from '../data/skins';
import type { GameMode, MatchResult } from '../game/types';

const SKIN_KEY = 'jelly-brawl.skin';
const HISTORY_KEY = 'jelly-brawl.history';
const MAX_HISTORY = 20;

export interface HistoryEntry {
  at: number;
  mode: GameMode;
  rank: number;
  total: number;
  score: number;
  kos: number;
}

export function loadSkin(): string {
  try {
    const id = localStorage.getItem(SKIN_KEY);
    return id && SKINS.some((s) => s.id === id) ? id : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function saveSkin(id: string): void {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // 隐私模式等情况下存不了，忽略
  }
}

const NAME_KEY = 'jelly-brawl.name';
let nameVersion = 0;
const nameListeners = new Set<() => void>();

/** 联机昵称；第一次随机一个 */
export function loadName(): string {
  try {
    const n = localStorage.getItem(NAME_KEY);
    if (n) return n;
  } catch {
    // 忽略
  }
  return `果冻${Math.floor(Math.random() * 900 + 100)}`;
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // 忽略
  }
  nameVersion += 1;
  nameListeners.forEach((fn) => fn());
}

export function subscribeName(fn: () => void): () => void {
  nameListeners.add(fn);
  return () => nameListeners.delete(fn);
}

export function nameStoreVersion(): number {
  return nameVersion;
}

const LOADED_KEY = 'jelly-brawl.loaded';

/** 这台设备以前是否完整加载过一次（用来决定要不要提示"首次加载较慢"） */
export function hasLoadedBefore(): boolean {
  try {
    return localStorage.getItem(LOADED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLoaded(): void {
  try {
    localStorage.setItem(LOADED_KEY, '1');
  } catch {
    // 忽略
  }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function addHistory(r: MatchResult): void {
  const me = r.ranking.find((x) => x.isPlayer);
  if (!me) return;
  const entry: HistoryEntry = { at: Date.now(), mode: r.mode, rank: me.rank, total: r.ranking.length, score: me.score, kos: me.kos };
  try {
    const list = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // 忽略
  }
}
