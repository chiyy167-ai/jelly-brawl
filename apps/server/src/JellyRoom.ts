/** 一个房间 = 最多 4 个真人的一局。服务器跑和单机完全相同的 sim，定时把快照广播给所有人。 */
import { Room, type Client } from '@colyseus/core';
import { GAME } from '../../client/src/game/config';
import { botSeat, createNetMatch, matchResult, stepMatch, type RosterSeat } from '../../client/src/game/sim';
import type { InputCmd, MatchState } from '../../client/src/game/types';
import {
  CODE_ALPHABET, CODE_LENGTH, cleanProfile, packSnap,
  type InputMsg, type LobbyInfo, type Profile, type StartMsg,
} from '../../client/src/net/protocol';

// 正在使用的房间号，避免重复
const usedCodes = new Set<string>();

function newCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!usedCodes.has(code)) return code;
  }
}

export class JellyRoom extends Room {
  maxClients = GAME.online.maxHumans;
  private profiles = new Map<string, Profile>();
  /** 加入顺序，第一个是房主 */
  private order: string[] = [];
  private phase: LobbyInfo['phase'] = 'waiting';
  private match: MatchState | null = null;
  /** sessionId → 名单下标 */
  private seatOf = new Map<string, number>();
  private cmds: Record<number, InputCmd> = {};
  private acc = 0;
  private snapAcc = 0;
  private overT = 0;

  onCreate(): void {
    this.roomId = newCode();
    usedCodes.add(this.roomId);
    this.onMessage('profile', (client, p: Partial<Profile>) => {
      if (this.phase !== 'waiting') return;
      this.profiles.set(client.sessionId, cleanProfile(p));
      this.sendLobby();
    });
    this.onMessage('hello', (client) => client.send('lobby', this.lobbyInfo()));
    this.onMessage('start', (client) => {
      if (client.sessionId === this.order[0] && this.phase === 'waiting') this.startMatch();
    });
    this.onMessage('input', (client, m: InputMsg) => {
      const seat = this.seatOf.get(client.sessionId);
      if (seat === undefined || !Array.isArray(m)) return;
      // 摇杆长度限制在 1 以内，防止乱发数据加速
      let x = Number(m[0]) || 0;
      let y = Number(m[1]) || 0;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      this.cmds[seat] = { x, y, charge: m[2] === 1 };
    });
    this.setSimulationInterval((ms) => this.tick(ms / 1000), 1000 / 60);
  }

  onJoin(client: Client, options: Partial<Profile>): void {
    if (this.phase !== 'waiting') throw new Error('对局进行中，请等这一局结束');
    this.profiles.set(client.sessionId, cleanProfile(options));
    this.order.push(client.sessionId);
    this.sendLobby();
  }

  onLeave(client: Client): void {
    this.profiles.delete(client.sessionId);
    this.order = this.order.filter((id) => id !== client.sessionId);
    // 对局中掉线：这只果冻交给电脑
    const seat = this.seatOf.get(client.sessionId);
    if (seat !== undefined && this.match) {
      const j = this.match.jellies[seat];
      j.human = false;
      j.name = `${j.name}（掉线）`;
      delete this.cmds[seat];
    }
    this.seatOf.delete(client.sessionId);
    this.sendLobby();
  }

  onDispose(): void {
    usedCodes.delete(this.roomId);
  }

  private lobbyInfo(): LobbyInfo {
    return {
      code: this.roomId,
      hostId: this.order[0] ?? '',
      phase: this.phase,
      players: this.order.map((sessionId) => ({ sessionId, ...this.profiles.get(sessionId)! })),
    };
  }

  private sendLobby(): void {
    this.broadcast('lobby', this.lobbyInfo());
  }

  private startMatch(): void {
    const roster: RosterSeat[] = this.order.map((id) => ({ ...this.profiles.get(id)!, human: true }));
    const used = roster.map((p) => p.skinId);
    for (let i = 0; roster.length < GAME.online.seats; i += 1) {
      const bot = botSeat(i, used);
      used.push(bot.skinId);
      roster.push(bot);
    }
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.match = createNetMatch(roster, seed, -1);
    this.seatOf = new Map(this.order.map((id, i) => [id, i]));
    this.cmds = {};
    this.acc = 0;
    this.snapAcc = 0;
    this.overT = 0;
    this.phase = 'playing';
    void this.lock();
    for (const c of this.clients) {
      const msg: StartMsg = { seed, roster, you: this.seatOf.get(c.sessionId) ?? -1 };
      c.send('start', msg);
    }
    this.sendLobby();
  }

  private tick(dt: number): void {
    const s = this.match;
    if (!s) return;
    const step = GAME.fixedDt;
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= step) {
      stepMatch(s, this.cmds, step);
      this.acc -= step;
    }
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / GAME.online.snapHz) {
      this.snapAcc = 0;
      this.broadcast('snap', packSnap(s));
    }
    if (s.phase === 'over') {
      this.overT += dt;
      // 等最后一个掉下去的果冻播完再结算，然后回到等待状态，可以再开一局
      if (this.overT >= GAME.online.resultDelay) {
        this.broadcast('result', matchResult(s));
        this.match = null;
        this.seatOf.clear();
        this.phase = 'waiting';
        void this.unlock();
        this.sendLobby();
      }
    }
  }
}
