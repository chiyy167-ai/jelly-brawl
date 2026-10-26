/** 一个房间 = 最多 4 真人的系列赛。服务器跑与单机相同的 sim，整场三局（含加赛）锁房。 */
import { Room, type Client } from '@colyseus/core';
import { GAME } from '../../client/src/game/config';
import { botSeat, createNetMatch, matchResult, stepMatch, type RosterSeat } from '../../client/src/game/sim';
import { resolveMap } from '../../client/src/game/maps';
import { noteJoin, noteLeave } from './online';
import type { InputCmd, MapId, MatchState } from '../../client/src/game/types';
import {
  CODE_ALPHABET, CODE_LENGTH, cleanProfile, packSnap,
  type InputMsg, type LobbyInfo, type Profile, type StartMsg,
} from '../../client/src/net/protocol';

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
  private order: string[] = [];
  private phase: LobbyInfo['phase'] = 'waiting';
  private match: MatchState | null = null;
  private seatOf = new Map<string, number>();
  private cmds: Record<number, InputCmd> = {};
  private acc = 0;
  private snapAcc = 0;
  private overT = 0;
  private mapId: MapId = 'candy';

  onCreate(): void {
    this.roomId = newCode();
    usedCodes.add(this.roomId);
    this.onMessage('profile', (client, p: Partial<Profile>) => {
      if (this.phase !== 'waiting') return;
      this.profiles.set(client.sessionId, cleanProfile(p));
      this.sendLobby();
    });
    this.onMessage('hello', (client) => client.send('lobby', this.lobbyInfo()));
    this.onMessage('start', (client, body?: { mapId?: string }) => {
      if (client.sessionId === this.order[0] && this.phase === 'waiting') {
        this.mapId = resolveMap(body?.mapId);
        this.startMatch();
      }
    });
    this.onMessage('input', (client, m: InputMsg) => {
      const seat = this.seatOf.get(client.sessionId);
      if (seat === undefined || !Array.isArray(m)) return;
      let x = Number(m[0]) || 0;
      let y = Number(m[1]) || 0;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      this.cmds[seat] = { x, y, charge: m[2] === 1, use: m[3] === 1, swap: m[4] === 1 };
    });
    this.setSimulationInterval((ms) => this.tick(ms / 1000), 1000 / 60);
  }

  onJoin(client: Client, options: Partial<Profile>): void {
    if (this.phase !== 'waiting') throw new Error('对局进行中，请等这一局结束');
    this.profiles.set(client.sessionId, cleanProfile(options));
    this.order.push(client.sessionId);
    this.sendLobby();
    noteJoin();
  }

  onLeave(client: Client): void {
    noteLeave();
    this.profiles.delete(client.sessionId);
    this.order = this.order.filter((id) => id !== client.sessionId);
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
    const roster: RosterSeat[] = this.order.map((id) => {
      const p = this.profiles.get(id)!;
      return {
        name: p.name, skinId: p.skinId, human: true,
        startItem: p.startItem ?? null, look: p.look ?? null,
      };
    });
    const used = roster.map((p) => p.skinId);
    for (let i = 0; roster.length < GAME.online.seats; i += 1) {
      const bot = botSeat(i, used);
      used.push(bot.skinId);
      roster.push(bot);
    }
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.match = createNetMatch(roster, seed, -1, this.mapId);
    this.seatOf = new Map(this.order.map((id, i) => [id, i]));
    this.cmds = {};
    this.acc = 0;
    this.snapAcc = 0;
    this.overT = 0;
    this.phase = 'playing';
    void this.lock();
    for (const c of this.clients) {
      const msg: StartMsg = { seed, roster, you: this.seatOf.get(c.sessionId) ?? -1, mapId: this.mapId };
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
    for (const seat of Object.keys(this.cmds)) {
      const cmd = this.cmds[Number(seat)];
      if (cmd) {
        cmd.use = false;
        cmd.swap = false;
      }
    }
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / GAME.online.snapHz) {
      this.snapAcc = 0;
      this.broadcast('snap', packSnap(s));
    }
    // 整场系列赛结束才结算解锁；局间 round_end 继续跑
    if (s.phase === 'series_end') {
      this.overT += dt;
      if (this.overT >= GAME.online.resultDelay) {
        this.broadcast('result', matchResult(s));
        this.match = null;
        this.seatOf.clear();
        this.phase = 'waiting';
        void this.unlock();
        this.sendLobby();
      }
    } else {
      this.overT = 0;
    }
  }
}
