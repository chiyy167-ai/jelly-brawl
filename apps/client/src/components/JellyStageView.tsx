/** 把 Three.js 展示舞台包成 React 组件；可选手指拖动旋转。 */
import { useEffect, useRef, type PointerEvent } from 'react';
import { JellyStage, type StageItem, type StageView } from '../game/stage';

interface Props {
  items: StageItem[];
  view: StageView;
  className?: string;
  draggable?: boolean;
}

export function JellyStageView({ items, view, className, draggable }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<JellyStage | null>(null);
  const firstView = useRef(view);
  const key = JSON.stringify(items);

  // 视角只在创建舞台时使用一次
  useEffect(() => {
    const el = host.current!;
    const s = new JellyStage(el, firstView.current);
    stage.current = s;
    const ro = new ResizeObserver(() => s.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      s.dispose();
      stage.current = null;
    };
  }, []);

  // 用序列化后的 key 判断角色列表是否真的变化
  useEffect(() => {
    stage.current?.setItems(JSON.parse(key) as StageItem[]);
  }, [key]);

  const drag = useRef<{ id: number; x: number; yaw: number } | null>(null);
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggable || !stage.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, yaw: stage.current.dragYaw };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !stage.current) return;
    stage.current.dragYaw = d.yaw + (e.clientX - d.x) * 0.012;
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={host}
      className={`stage ${className ?? ''}`}
      style={{ touchAction: draggable ? 'none' : undefined }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
