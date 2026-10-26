/** 道具 UI 图标：内联 SVG，避免 emoji 在部分安卓/Win 上显示成方块。 */
import type { ReactNode } from 'react';
import type { ItemKind } from '../game/types';

type P = { size?: number; className?: string };

function wrap(size: number, className: string | undefined, children: ReactNode) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden>
      {children}
    </svg>
  );
}

export function ItemIcon({ kind, size = 28, className }: P & { kind: ItemKind }) {
  switch (kind) {
    case 'rocket':
      return wrap(size, className, (
        <>
          <path d="M20 4c4 6 6 12 6 18 0 4-2.5 7-6 7s-6-3-6-7c0-6 2-12 6-18z" fill="#ff5a3a" />
          <circle cx="20" cy="18" r="3.2" fill="#ffe66b" />
          <path d="M14 30l6 6 6-6" fill="#ff9a3a" />
        </>
      ));
    case 'shield':
      return wrap(size, className, (
        <path d="M20 4l14 5v10c0 9-6 15-14 17C12 34 6 28 6 19V9z" fill="#4fb8ff" stroke="#fff" strokeWidth="2" />
      ));
    case 'pad':
      return wrap(size, className, (
        <>
          <ellipse cx="20" cy="24" rx="14" ry="8" fill="#b07cff" />
          <ellipse cx="20" cy="20" rx="10" ry="5" fill="#e0c8ff" />
        </>
      ));
    case 'grow':
      return wrap(size, className, (
        <rect x="8" y="8" width="24" height="24" rx="6" fill="#6fdc6a" stroke="#fff" strokeWidth="2" />
      ));
    case 'magnet':
      return wrap(size, className, (
        <path d="M12 8h6v14a4 4 0 008 0V8h6v14a10 10 0 01-20 0z" fill="#ff5a5a" />
      ));
    case 'banana':
      return wrap(size, className, (
        <path d="M10 28c2-12 10-18 20-18 0 4-2 8-6 12-5 5-12 8-14 6z" fill="#ffe14a" stroke="#e0b000" strokeWidth="1.5" />
      ));
    case 'mine':
      return wrap(size, className, (
        <>
          <circle cx="20" cy="22" r="10" fill="#8a40c8" />
          <circle cx="20" cy="22" r="4" fill="#ff4a3a" />
          <path d="M20 8v4M8 22h4M28 22h4M12 12l3 3M28 12l-3 3" stroke="#c98cff" strokeWidth="2" />
        </>
      ));
    case 'snow':
      return wrap(size, className, (
        <>
          <circle cx="20" cy="20" r="11" fill="#a8e8ff" />
          <path d="M20 8v24M8 20h24M12 12l16 16M28 12L12 28" stroke="#fff" strokeWidth="2" />
        </>
      ));
    case 'star':
      return wrap(size, className, (
        <path d="M20 4l4 10h11l-9 7 3 11-9-6-9 6 3-11-9-7h11z" fill="#ffd84a" stroke="#fff" strokeWidth="1.5" />
      ));
    case 'glove':
      return wrap(size, className, (
        <path d="M12 18c0-4 3-6 6-6h10c3 0 5 2 5 5v8c0 6-4 10-10 10h-2c-5 0-9-4-9-9z" fill="#ff3a4a" stroke="#fff" strokeWidth="1.5" />
      ));
    case 'cake':
      return wrap(size, className, (
        <>
          <path d="M8 22h24v10H8z" fill="#ff8fc1" />
          <path d="M8 16c4-6 8-6 12 0s8 6 12 0v6H8z" fill="#fff0f6" />
          <circle cx="20" cy="14" r="2.5" fill="#ff4a6a" />
        </>
      ));
    default:
      return wrap(size, className, <circle cx="20" cy="20" r="12" fill="#ccc" />);
  }
}
