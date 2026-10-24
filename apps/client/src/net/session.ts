/** 联机会话：连接 Colyseus 服务器、建房 / 加入、收发消息。整个页面只有一个会话。 */
import { Client, type Room } from '@colyseus/sdk';
import type { InputCmd, MatchResult } from '../game/types';
import { ROOM_NAME, type InputMsg, type LobbyInfo, type Profile, type Snap, type StartMsg } from './protocol';

const SERVER_KEY = 'jelly-brawl.server';

/** 服务器地址：?server= 参数（会记住）> 构建时的 VITE_SERVER_URL > 本机 / 局域网默认 2567 端口 */
export function serverUrl(): string {
  try {
    const q = new URLSearchParams(location.search).get('server');
    if (q) localStorage.setItem(SERVER_KEY, q);
    const saved = localStorage.getItem(SERVER_KEY);
    if (saved) return saved;
  } catch {
    // 存储不可用时忽略
  }
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const h = location.hostname;
  const lan = h === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  return import.meta.env.DEV || lan ? `ws://${h}:2567` : '';
}

type Fn<T> = (v: T) => void;

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  if (/locked/i.test(msg)) return '房间已满（最多 4 人）或正在对局中';
  if (/not found|invalid/i.test(msg)) return '找不到这个房间，请检查房间号';
  if (/进行中/.test(msg)) return msg;
  return `连不上联机服务器（${serverUrl()}）。服务器可能没启动，或者正在唤醒，请稍后再试`;
}

class NetSession {
  room: Room | null = null;
  lobby: LobbyInfo | null = null;
  start: StartMsg | null = null;
  lastSnap: Snap | null = null;
  busy = false;
  error = '';
  /** 每次变化 +1，给 React 的 useSyncExternalStore 用 */
  version = 0;
  private listeners = new Set<() => void>();
  private snapFns = new Set<Fn<Snap>>();
  private resultFns = new Set<Fn<MatchResult>>();
  onStart: Fn<StartMsg> | null = null;
  onKicked: Fn<string> | null = null;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private changed(): void {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }

  get selfId(): string {
    return this.room?.sessionId ?? '';
  }

  get isHost(): boolean {
    return !!this.lobby && this.lobby.hostId === this.selfId;
  }

  async create(profile: Profile): Promise<boolean> {
    return this.connect((c) => c.create(ROOM_NAME, profile));
  }

  async join(code: string, profile: Profile): Promise<boolean> {
    return this.connect((c) => c.joinById(code.trim().toUpperCase(), profile));
  }

  private async connect(open: (c: Client) => Promise<Room>): Promise<boolean> {
    const url = serverUrl();
    if (!url) {
      this.error = '联机服务器还没有部署，暂时只能玩单机。';
      this.changed();
      return false;
    }
    this.busy = true;
    this.error = '';
    this.changed();
    try {
      await this.leave();
      const room = await open(new Client(url));
      this.bind(room);
      return true;
    } catch (e) {
      this.error = friendly(e);
      return false;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  private bind(room: Room): void {
    this.room = room;
    // 服务器不支持断线重连；Render 的代理还会吞掉正常离开的关闭码，开着会让 SDK 一直重试
    room.reconnection.enabled = false;
    room.onMessage('lobby', (info: LobbyInfo) => {
      this.lobby = info;
      this.changed();
    });
    room.onMessage('start', (msg: StartMsg) => {
      this.start = msg;
      this.lastSnap = null;
      this.onStart?.(msg);
      this.changed();
    });
    room.onMessage('snap', (snap: Snap) => {
      this.lastSnap = snap;
      this.snapFns.forEach((fn) => fn(snap));
    });
    room.onMessage('result', (r: MatchResult) => this.resultFns.forEach((fn) => fn(r)));
    room.onLeave(() => {
      if (this.room !== room) return;
      this.reset();
      this.onKicked?.('和联机服务器断开了连接，已回到大厅。');
    });
    // 进房后的第一条房间信息可能在注册监听前就到了，主动再要一次
    room.send('hello');
  }

  private reset(): void {
    this.room = null;
    this.lobby = null;
    this.start = null;
    this.lastSnap = null;
    this.changed();
  }

  async leave(): Promise<void> {
    const room = this.room;
    if (!room) return;
    this.reset();
    // 最多等 1 秒，网络不好时也不卡住界面
    await Promise.race([room.leave().catch(() => undefined), new Promise((ok) => setTimeout(ok, 1000))]);
  }

  sendProfile(p: Profile): void {
    this.room?.send('profile', p);
  }

  startMatch(mapId: 'candy' | 'volcano' = 'candy'): void {
    this.room?.send('start', { mapId });
  }

  sendInput(cmd: InputCmd): void {
    const m: InputMsg = [
      Math.round(cmd.x * 100) / 100, Math.round(cmd.y * 100) / 100,
      cmd.charge ? 1 : 0, cmd.use ? 1 : 0, cmd.swap ? 1 : 0,
    ];
    this.room?.send('input', m);
  }

  onSnap(fn: Fn<Snap>): () => void {
    this.snapFns.add(fn);
    return () => this.snapFns.delete(fn);
  }

  onResult(fn: Fn<MatchResult>): () => void {
    this.resultFns.add(fn);
    return () => this.resultFns.delete(fn);
  }
}

export const session = new NetSession();
