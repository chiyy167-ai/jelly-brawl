/** 联机战斗循环：不在本机跑物理，只把服务器快照插值后渲染，并按固定频率上报输入。 */
import { applySnap, markResult } from '../net/protocol';
import { session } from '../net/session';
import { BattleScene } from './battleScene';
import { GAME } from './config';
import { bindKeyboard, readCmd, type InputSource } from './input';
import { hudOf, type Hud } from './runner';
import { createNetMatch } from './sim';
import type { InputCmd, MatchResult, MatchState } from './types';

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
  private snapAt = 0;
  private sinceSend = 1;
  private lastSent = '';
  private hudKey = '';
  private offs: (() => void)[] = [];
  private onResize = () => this.scene.resize();

  constructor(private opt: NetRunnerOptions) {
    const start = session.start;
    if (!start) throw new Error('还没有收到开局信息');
    this.you = start.you;
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
    this.snapAt = performance.now();
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.time += dt;
    this.sendInput(readCmd(this.opt.input), dt);
    // 两份快照之间按到达时间插值，画面延迟约一个快照间隔（50ms）
    const alpha = Math.min(1, (now - this.snapAt) / (1000 / GAME.online.snapHz));
    this.scene.render(this.state, alpha, dt, this.time);
    const h = hudOf(this.state);
    const key = JSON.stringify(h);
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.opt.onHud(h);
    }
  };

  /** 输入变了立刻发；没变也每 0.2 秒补发一次，防止丢包后卡住 */
  private sendInput(cmd: InputCmd, dt: number): void {
    this.sinceSend += dt;
    const key = `${cmd.x.toFixed(2)},${cmd.y.toFixed(2)},${cmd.charge},${cmd.use ? 1 : 0}`;
    const changed = key !== this.lastSent;
    const urgent = cmd.use === true;
    // 释放技能立刻发；其它变化最多 inputHz 次/秒
    if (!urgent && !(changed && this.sinceSend >= 1 / GAME.online.inputHz) && this.sinceSend < 0.2) return;
    this.sinceSend = 0;
    this.lastSent = key;
    session.sendInput(cmd);
    this.opt.input.useQueued = false;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.offs.forEach((off) => off());
    this.scene.dispose();
  }
}
