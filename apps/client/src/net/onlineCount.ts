/** 向联机服询问当前在线人数。大厅和战斗共用一次轮询。 */
import { GAME } from '../game/config';
import { serverUrl } from './session';

let n: number | null = null;
let timer = 0;
const listeners = new Set<() => void>();

function httpBase(): string {
  const ws = serverUrl();
  if (!ws) return '';
  return ws.replace(/^ws/i, 'http').replace(/\/$/, '');
}

async function pull(): Promise<void> {
  const base = httpBase();
  if (!base) {
    n = null;
  } else {
    try {
      const res = await fetch(`${base}/online`, { cache: 'no-store' });
      const data = await res.json() as { n?: number };
      n = typeof data.n === 'number' ? data.n : null;
    } catch {
      n = null;
    }
  }
  listeners.forEach((fn) => fn());
}

export function subscribeOnline(fn: () => void): () => void {
  listeners.add(fn);
  if (listeners.size === 1) {
    void pull();
    timer = window.setInterval(() => void pull(), GAME.online.presenceSec * 1000);
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };
}

export function onlineNow(): number | null {
  return n;
}
