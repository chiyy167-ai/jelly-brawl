/** 快速验证三局赛 / 练习能跑到 series_end */
import { createMatch, matchResult, stepMatch } from '../../client/src/game/sim';

const s = createMatch('match', 'red', 12345);
let steps = 0;
while (s.phase !== 'series_end' && steps < 60 * 60 * 4) {
  stepMatch(s, { 0: { x: Math.sin(steps / 40), y: Math.cos(steps / 55), charge: steps % 100 < 25 } }, 1 / 60);
  steps += 1;
}
const r = matchResult(s);
console.log({
  phase: s.phase,
  played: s.series.played,
  board: s.series.board,
  scores: s.series.scores,
  rank: r.playerRank,
  rewards: r.rewards,
  steps,
  eventKinds: s.events.map((e) => e.kind),
});
