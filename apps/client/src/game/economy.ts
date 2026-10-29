/** 整场结算的 XP / 金币 / 宝石发放公式（与 GAME_DESIGN 一致）。 */
import { GAME } from './config';
import type { GameMode, MatchResult, RankEntry } from './types';

export function computeRewards(mode: GameMode, me: RankEntry): MatchResult['rewards'] {
  const e = GAME.economy;
  const i = Math.max(0, me.rank - 1);
  let xp = (e.placeXp[i] ?? 10) + e.joinXp + me.kos * e.kosXp;
  let coins = (e.placeCoins[i] ?? 5) + me.kos * e.kosCoins;
  const casual = mode === 'practice' || mode === 'tutorial';
  let gems = me.rank === 1 ? (casual ? e.practiceWinGems : e.winGems) : 0;
  if (mode === 'online') xp += e.onlineBonusXp;
  if (casual) {
    xp = Math.round(xp * e.practiceScale);
    coins = Math.round(coins * e.practiceScale);
  }
  return { xp, coins, gems };
}
