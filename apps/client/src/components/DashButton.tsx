/** 冲撞按钮：按住蓄力，松手冲刺。外圈显示蓄力进度。 */
import { useRef, type PointerEvent } from 'react';
import type { InputSource } from '../game/input';
import { IconFist } from './icons';

export function DashButton({ input, charge }: { input: InputSource; charge: number }) {
  const pointer = useRef<number | null>(null);
  const press = (e: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== null) return;
    pointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    input.dashHeld = true;
  };
  const release = (e: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    input.dashHeld = false;
  };
  return (
    <button
      className={`dash-btn ${charge > 0 ? 'dash-charging' : ''}`}
      style={{ ['--charge' as string]: `${charge * 360}deg` }}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="冲撞（按住蓄力，松手冲刺）"
    >
      <IconFist size={60} />
    </button>
  );
}
