/** 卡通天空 / 火山天空：渐变 + 云朵 + 漂浮小方块，纯 CSS。 */
import type { MapId } from '../game/types';

const CANDY_CUBES = [
  { left: '8%', top: '22%', c: '#7ddc6a', d: 0 },
  { left: '86%', top: '30%', c: '#ff8fc1', d: 1.2 },
  { left: '18%', top: '68%', c: '#ffd84a', d: 0.6 },
  { left: '72%', top: '14%', c: '#b07cff', d: 1.8 },
  { left: '92%', top: '70%', c: '#4fb8ff', d: 0.9 },
];

const VOLCANO_CUBES = [
  { left: '10%', top: '24%', c: '#ff6a2a', d: 0 },
  { left: '84%', top: '28%', c: '#ffd24a', d: 1.1 },
  { left: '20%', top: '70%', c: '#c04020', d: 0.5 },
  { left: '70%', top: '16%', c: '#ff8a3a', d: 1.6 },
  { left: '90%', top: '66%', c: '#ff4a2a', d: 0.8 },
];

export function SkyBackground({
  dim = false,
  theme = 'candy',
}: {
  dim?: boolean;
  theme?: MapId;
}) {
  const cubes = theme === 'volcano' ? VOLCANO_CUBES : CANDY_CUBES;
  return (
    <div className={`sky ${theme === 'volcano' ? 'sky-volcano' : 'sky-candy'} ${dim ? 'sky-dim' : ''}`} aria-hidden>
      <div className="cloud cloud-a" />
      <div className="cloud cloud-b" />
      <div className="cloud cloud-c" />
      {cubes.map((q, i) => (
        <div key={i} className="float-cube" style={{ left: q.left, top: q.top, background: q.c, animationDelay: `${q.d}s` }} />
      ))}
    </div>
  );
}
