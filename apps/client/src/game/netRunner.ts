/** 联机战斗循环：本地先预测自己的移动，其他人按服务器时间插值，输入仍以服务器为准。 */
import { applySnap, markResult } from '../net/protocol';
import { session } from '../net/session';
import { consumeEquipped } from '../state/loadout';
import { BattleScene } from './battleScene';
import { GAME } from './config';
import { bindKeyboard, readCmd, type InputSource } from './input';
import { adoptServer, predictStep, pushPose, reconcile, samplePose, type NetPose } from './netSmooth';
import { hudOf, type Hud } from './runner';
import { createNetMatch } from './sim';
import type { InputCmd, Jelly, MatchResult, MatchState } from './types';

export interface NetRunnerOptions {
  host: HTMLElement;
  input: InputSource;
  onHud(h: Hud): void;
  onEnd(r: MatchResult): void;
}

export class NetRunner {
  private state: MatchState;
  private scene: BattleScene;
  private you: number;
  private raf = 0;
  private last = 0;
  private time = 0;
  private sinceSend = 1;
  private lastSent = '';
  private hudKey = '';
  private serverTime = 0;
  private serverAt = 0;
  private pred: Jelly | null = null;
  private trails = new Map<number, NetPose[]>();
  private offs: (() => void)[] = [];
  private onResize = () => this.scene.resize();

  constructor(private opt: NetRunnerOptions) {
    const start = session.start;
    if (!start) throw new Error('还没有收到开局信息');
    this.you = start.you;
    // 联机开局：扣本机已装备库存（服务器侧已按 profile.startItem 发到座位）
    consumeEquipped();
    this.state = createNetMatch(start.roster, start.seed, start.you, start.mapId ?? 'candy');
    this.scene = new BattleScene(opt.host, this.state);
    if (session.lastSnap) this.onSnap(session.lastSnap);
    this.offs.push(
      session.onSnap((s) => this.onSnap(s)),
      session.onResult((r) => opt.onEnd(markResult(r, this.you))),
      bindKeyboard(),
    );
    window.addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.frame);
  }

  private onSnap(snap: Parameters<typeof applySnap>[1]): void {
    applySnap(this.state, snap);
    this.serverTime = snap.h[0];
    this.serverAt = performance.now();
    for (const j of this.state.jellies) {
      const list = this.trails.get(j.id) ?? [];
      pushPose(list, { time: snap.h[0], x: j.x, y: j.y, vx: j.vx, vy: j.vy, fallY: j.fallY });
      this.trails.set(j.id, list);
    }
    const me = this.state.jellies.find((j) => j.id === this.you);
    if (!me) return;
    if (!this.pred) this.pred = { ...me };
    else {
      adoptServer(this.pred, me);
      reconcile(this.pred, me);
    }
  }

  /** 自己开打后用预测位置，其他人回放到略早于现在的服务器时间 */
  private paint(): void {
    const simNow = this.serverTime + (performance.now() - this.serverAt) / 1000;
    const when = simNow - GAME.online.interpDelay;
    const playing = this.state.phase === 'play';
    for (const j of this.state.jellies) {
      if (playing && j.id === this.you && this.pred) {
        j.prevX = j.x = this.pred.x;
        j.prevY = j.y = this.pred.y;
        j.vx = this.pred.vx;
        j.vy = this.pred.vy;
        j.facing = this.pred.facing;
        j.charge = this.pred.charge;
        j.charging = this.pred.charging;
        j.dashT = this.pred.dashT;
        continue;
      }
      const pose = samplePose(this.trails.get(j.id) ?? [], when);
      if (!pose) continue;
      j.prevX = j.x = pose.x;
      j.prevY = j.y = pose.y;
      j.fallY = pose.fallY;
    }
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.time += dt;
    const cmd = readCmd(this.opt.input);
    this.sendInput(cmd, dt);
    if (this.pred && this.state.phase === 'play') predictStep(this.pred, cmd, dt, this.state.frictionScale);
    this.paint();
    this.scene.render(this.state, 1, dt, this.time);
    const h = hudOf(this.state);
    const key = JSON.stringify(h);
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.opt.onHud(h);
    }
  };

  /** 输入变了立刻发；按住摇杆也持续发，避免丢包后停在原地 */
  private sendInput(cmd: InputCmd, dt: number): void {
    this.sinceSend += dt;
    const key = `${cmd.x.toFixed(2)},${cmd.y.toFixed(2)},${cmd.charge},${cmd.use ? 1 : 0},${cmd.swap ? 1 : 0}`;
    const changed = key !== this.lastSent;
    const urgent = cmd.use === true || cmd.swap === true;
    if (!urgent && !(changed && this.sinceSend >= 1 / GAME.online.inputHz) && this.sinceSend < 0.1) return;
    this.sinceSend = 0;
    this.lastSent = key;
    session.sendInput(cmd);
    this.opt.input.useQueued = false;
    this.opt.input.swapQueued = false;
  }

  setHighView(high: boolean): void {
    this.scene.setHigh(high);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.offs.forEach((off) => off());
    this.scene.dispose();
  }
}
