/** 战斗主循环：60Hz 固定步长推进逻辑，requestAnimationFrame 插值渲染。 */
import { syncChargeCue } from './audio';
import { consumeEquipped } from '../state/loadout';
import { loadOutfit } from '../state/outfit';
import { BattleScene } from './battleScene';
import { GAME } from './config';
import { bindKeyboard, readCmd, type InputSource } from './input';
import { itemName } from './itemCatalog';
import { awardRound } from './series';
import { createMatch, matchResult, stepMatch } from './sim';
import type { GameMode, ItemKind, MapId, MatchResult, MatchState } from './types';

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
  round: number;
  totalRounds: number;
  overtime: boolean;
  seriesScore: number;
  banner: string | null;
  alert: string | null;
  roundRanks: MatchState['roundRanks'];
  ghostCd: number;
  item: string | null;
  /** 当前槽显示名 */
  held: string | null;
  heldKind: ItemKind | null;
  /** 备用槽 */
  heldB: string | null;
  heldBKind: ItemKind | null;
  /** 持续效果短标签 */
  buff: string | null;
}

function label(kind: ItemKind | null | undefined): string | null {
  if (!kind) return null;
  return itemName(kind);
}

export function hudOf(s: MatchState): Hud {
  const p = s.jellies.find((j) => j.isPlayer) ?? s.jellies[0];
  const buffKind: ItemKind | null = p.rocket > 0 ? 'rocket'
    : p.star > 0 ? 'star'
      : p.freezeT > 0 ? 'snow'
        : p.magnet > 0 ? 'magnet'
          : p.shield > 0 ? 'shield'
            : null;
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
    round: Math.min(s.series.played + (s.phase === 'round_end' || s.phase === 'series_end' ? 0 : 1), Math.max(s.series.played, 1)),
    totalRounds: s.series.totalRounds,
    overtime: s.series.overtime,
    seriesScore: s.series.scores[p.id] ?? 0,
    banner: s.banner,
    alert: s.alert,
    roundRanks: s.roundRanks,
    ghostCd: p.ghostCd,
    held: label(p.item),
    heldKind: p.item,
    heldB: label(p.itemB),
    heldBKind: p.itemB,
    item: label(p.item) ?? label(buffKind),
    buff: label(buffKind),
  };
}

export interface RunnerOptions {
  host: HTMLElement;
  mode: GameMode;
  skinId: string;
  mapId?: MapId;
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
    // 教程不带开局道具；正式局从背包消耗已装备的一件
    const start = opt.mode === 'tutorial' ? null : consumeEquipped();
    this.state = createMatch(opt.mode, opt.skinId, seed, opt.mapId ?? 'candy', start, loadOutfit());
    this.scene = new BattleScene(opt.host, this.state);
    if (import.meta.env.DEV) (window as unknown as { __jb?: MatchState }).__jb = this.state;
    this.unbindKeys = bindKeyboard();
    window.addEventListener('resize', this.onResize);
    this.raf = requestAnimationFrame(this.frame);
  }

  setPaused(p: boolean): void {
    this.paused = p;
    if (p) syncChargeCue(false, 0);
  }

  setHighView(high: boolean): void {
    this.scene.setHigh(high);
  }

  /** 给新手教练等只读当前对局（勿修改） */
  peek(): MatchState {
    return this.state;
  }

  finishNow(): void {
    if (this.ended) return;
    this.ended = true;
    const s = this.state;
    if (s.phase !== 'series_end') {
      if (s.phase === 'play' || s.phase === 'countdown') awardRound(s);
      s.series.board = 'final';
      s.phase = 'series_end';
    }
    this.opt.onEnd(matchResult(s));
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
    let stepped = false;
    while (this.acc >= step) {
      stepMatch(this.state, { 0: cmd }, step);
      this.acc -= step;
      stepped = true;
    }
    if (stepped) {
      this.opt.input.useQueued = false;
      this.opt.input.swapQueued = false;
    }
    this.scene.render(this.state, this.acc / step, dtReal, this.time);
    this.pushHud();
    if (this.state.phase === 'series_end' && !this.ended) {
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
