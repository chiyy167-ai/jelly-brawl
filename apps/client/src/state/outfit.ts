/** 本机换装：目前只显示头饰。眼睛和嘴巴留在存档里，不再画出来。 */
import { cleanLook, DEFAULT_LOOK, type CosmeticLook } from '../data/cosmetics';

const KEY = 'jelly-brawl.outfit';

let cache: CosmeticLook | null = null;
let version = 0;
const listeners = new Set<() => void>();

function read(): CosmeticLook {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = cleanLook(JSON.parse(raw) as Partial<CosmeticLook>);
      return cache;
    }
  } catch {
    // 忽略
  }
  cache = { ...DEFAULT_LOOK };
  return cache;
}

function write(look: CosmeticLook): void {
  cache = look;
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    // 忽略
  }
  version += 1;
  listeners.forEach((fn) => fn());
}

export function subscribeOutfit(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function outfitVersion(): number {
  return version;
}

export function loadOutfit(): CosmeticLook {
  return read();
}

export function saveOutfit(look: Partial<CosmeticLook>): CosmeticLook {
  const next = cleanLook({ ...read(), ...look });
  write(next);
  return next;
}
