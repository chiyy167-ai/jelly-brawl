/** 三局累计分、加赛判定、本局称号。纯数据。 */
import { GAME } from './config';
import type { GameMode, Jelly, MatchState, RoundRank } from './types';

export function seriesRounds(mode: GameMode): number {
  return mode === 'practice' || mode === 'tutorial' ? GAME.series.practiceRounds : GAME.series.rounds;
}

export function blankSeries(mode: GameMode, seats: number): MatchState['series'] {
  return {
    totalRounds: seriesRounds(mode),
    played: 0,
    scores: Array.from({ length: seats }, () => 0),
    overtime: false,
    board: 'none',
  };
}

/** 存活者体型高、离中心近；淘汰者活得越久越靠前。 */
export function rankRound(s: MatchState): RoundRank[] {
  const alive = s.jellies.filter((j) => j.alive)
    .sort((a, b) => b.level - a.level || Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  const out = s.jellies.filter((j) => !j.alive).sort((a, b) => b.elimTime - a.elimTime);
  return [...alive, ...out].map((j, i) => ({
    id: j.id, name: j.name, skinId: j.skinId, isPlayer: j.isPlayer,
    rank: i + 1, gain: 0, bonus: 0, total: s.series.scores[j.id] ?? 0,
    kos: j.kos, eaten: j.eaten,
  }));
}

function leaderCount(scores: number[]): number {
  const top = Math.max(0, ...scores);
  return scores.filter((v) => v === top).length;
}

function best(bodies: Jelly[], key: keyof Jelly): Jelly[] {
  let max = 0;
  const picked: Jelly[] = [];
  for (const b of bodies) {
    const v = Number(b[key]) || 0;
    if (v > max) {
      max = v;
      picked.length = 0;
      picked.push(b);
    } else if (v === max && v > 0) picked.push(b);
  }
  return picked;
}

export function titlesOf(s: MatchState): string[] {
  const rules: [keyof Jelly, string][] = [
    ['kos', '撞人狂魔'],
    ['selfOut', '最爱自爆'],
    ['eaten', '吃货'],
    ['puddings', '布丁师傅'],
    ['hits', '横冲直撞'],
  ];
  const lines: string[] = [];
  for (const [key, title] of rules) {
    for (const j of best(s.jellies, key)) lines.push(`${j.name}·${title}`);
  }
  return lines;
}

/** 把本局名次分写入系列赛累计；决定 next / final。 */
export function awardRound(s: MatchState): void {
  const ranks = rankRound(s);
  const table = GAME.score.places;
  for (let i = 0; i < ranks.length; i += 1) {
    const row = ranks[i];
    const place = table[i] ?? 0;
    const bonus = row.kos * GAME.score.lastHit;
    row.gain = place + bonus;
    row.bonus = bonus;
    row.total = (s.series.scores[row.id] ?? 0) + row.gain;
    s.series.scores[row.id] = row.total;
  }
  s.roundRanks = ranks;
  s.titles = titlesOf(s);
  s.series.played += 1;
  const tied = leaderCount(s.series.scores) > 1;
  const needMore = s.series.played < s.series.totalRounds || (s.series.played >= s.series.totalRounds && tied);
  s.series.overtime = s.series.played >= s.series.totalRounds && tied;
  s.series.board = needMore ? 'next' : 'final';
}
