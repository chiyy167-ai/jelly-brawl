/** 卡通天空背景：渐变 + 云朵 + 漂浮小方块，纯 CSS 实现。 */
const CUBES = [
  { left: '8%', top: '22%', c: '#7ddc6a', d: 0 },
  { left: '86%', top: '30%', c: '#ff8fc1', d: 1.2 },
  { left: '18%', top: '68%', c: '#ffd84a', d: 0.6 },
  { left: '72%', top: '14%', c: '#b07cff', d: 1.8 },
  { left: '92%', top: '70%', c: '#4fb8ff', d: 0.9 },
];

export function SkyBackground({ dim = false }: { dim?: boolean }) {
  return (
    <div className={`sky ${dim ? 'sky-dim' : ''}`} aria-hidden>
      <div className="cloud cloud-a" />
      <div className="cloud cloud-b" />
      <div className="cloud cloud-c" />
      {CUBES.map((q, i) => (
        <div key={i} className="float-cube" style={{ left: q.left, top: q.top, background: q.c, animationDelay: `${q.d}s` }} />
      ))}
    </div>
  );
}
