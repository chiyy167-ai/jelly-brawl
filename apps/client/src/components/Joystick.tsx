/** 虚拟摇杆：左半屏任意位置按下，摇杆底座就出现在手指处；松手回到左下角。 */
import { useRef, useState, type PointerEvent } from 'react';
import type { InputSource } from '../game/input';

const RADIUS = 56;

export function Joystick({ input }: { input: InputSource }) {
  const zone = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  // 底座位置同时存在 ref 里，按下后紧接着的移动事件也能立刻读到
  const baseRef = useRef<{ x: number; y: number } | null>(null);
  const [base, setBase] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (cx: number, cy: number, b: { x: number; y: number }) => {
    let dx = cx - b.x;
    let dy = cy - b.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    // 小于 15% 当作没推
    const m = Math.min(1, len / RADIUS);
    input.stickX = m < 0.15 ? 0 : dx / RADIUS;
    input.stickY = m < 0.15 ? 0 : dy / RADIUS;
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== null) return;
    pointer.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = zone.current!.getBoundingClientRect();
    const b = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    baseRef.current = b;
    setBase(b);
    update(b.x, b.y, b);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const b = baseRef.current;
    if (pointer.current !== e.pointerId || !b) return;
    const rect = zone.current!.getBoundingClientRect();
    update(e.clientX - rect.left, e.clientY - rect.top, b);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    baseRef.current = null;
    setBase(null);
    setKnob({ x: 0, y: 0 });
    input.stickX = 0;
    input.stickY = 0;
  };

  const style = base ? { left: base.x, top: base.y } : undefined;
  return (
    <div
      ref={zone}
      className="joy-zone"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-label="移动摇杆"
    >
      <div className={`joy-base ${base ? 'joy-active' : ''}`} style={style}>
        <div className="joy-knob" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
    </div>
  );
}
