/** 战斗主循环：60Hz 固定步长推进逻辑，requestAnimationFrame 插值渲染。 */
import { BattleScene } from './battleScene';
import { GAME } from './config';
import { bindKeyboard, readCmd, type InputSource } from './input';
import { createMatch, matchResult, stepMatch } from './sim';
import type { GameMode, MatchResult, MatchState } from './types';

/** 给 React HUD 的精简数据（值变化时才回调） */
export interface Hud {
  phase: MatchState['phase'];
  countdown: number;
  timeLeft: number;
  alive: number;
  total: number;
  level: number;
  charge: number;
  playerAlive: boolean;
  warnLeft: number | null;
}

/** 从对局状态算出 HUD（单机和联机共用） */
export function hudOf(s: MatchState): Hud {
  const p = s.jellies.find((j) => j.isPlayer) ?? s.jellies[0];
  return {
    phase: s.phase,
    countdown: Math.ceil(s.countdown),
    timeLeft: Math.max(0, Math.ceil(GAME.platform.roundTime - s.time)),
    alive: s.jellies.filter((j) => j.alive).length,
    total: s.jellies.length,
    level: p.level,
    charge: Math.round((p.charge / GAME.charge.maxTime) * 20) / 20,
    playerAlive: p.alive,
    warnLeft: s.warn ? Math.ceil(s.warn.timeLeft) : null,
  };
}

export interface RunnerOptions {
  host: HTMLElement;
  mode: GameMode;
  skinId: string;
  input: InputSource;
  onHud(h: Hud): void;
  onEnd(r: MatchResult): void;
}

export class BattleRunner {
  private state: MatchState;
  private scene: BattleScene;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private hudKey = '';
  private endDelay = 1.6;
  private ended = false;
  private paused = false;
  private unbindKeys: () => void;
  private onResize = () => this.scene.resize();

  constructor(private opt: RunnerOptions) {
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.state = createMatch(opt.mode, opt.skinId, seed);
    this.scene = new BattleScene(opt.host, this.state);
    // 开发模式下在控制台可通过 __jb 查看 / 修改对局状态，正式构建不包含
    if (import.meta.env.DEV) (window as unknown as { __jb?: MatchState }).__jb = this.state;
    this.unbindKeys = bindKeyboard();
    window.addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }

  /** 玩家主动结束（例如练习模式点退出） */
  finishNow(): void {
    if (this.ended) return;
    this.ended = true;
    this.opt.onEnd(matchResult(this.state));
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dtReal = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    if (this.paused) return;
    this.time += dtReal;
    const step = GAME.fixedDt;
    this.acc += dtReal;
    const cmd = readCmd(this.opt.input);
    while (this.acc >= step) {
      stepMatch(this.state, { 0: cmd }, step);
      this.acc -= step;
    }
    this.scene.render(this.state, this.acc / step, dtReal, this.time);
    this.pushHud();
    // 对局结束后稍等一下，让最后一个落下的果冻播完
    if (this.state.phase === 'over' && !this.ended) {
      this.endDelay -= dtReal;
      if (this.endDelay <= 0) this.finishNow();
    }
  };

  private pushHud(): void {
    const h = hudOf(this.state);
    const key = JSON.stringify(h);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.opt.onHud(h);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.unbindKeys();
    this.scene.dispose();
  }
}
