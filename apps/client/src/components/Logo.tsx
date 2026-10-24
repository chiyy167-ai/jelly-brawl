/** 大厅标题：果冻头像 + 圆润英文字，中文用幼圆。 */
import type { CSSProperties } from 'react';

const LETTERS = ['J', 'e', 'l', 'l', 'y', ' ', 'B', 'r', 'a', 'w', 'l'];

function JellyMark() {
  return (
    <svg className="logo-jelly" viewBox="0 0 64 64" aria-hidden>
      <ellipse cx="32" cy="58" rx="14" ry="3.5" fill="rgba(90, 30, 70, 0.22)" />
      <path d="M32 6c15 0 26 11 26 26 0 16-11 26-26 26S6 48 6 32C6 17 17 6 32 6z" fill="#ff8ec8" />
      <path d="M32 6c15 0 26 11 26 26 0 16-11 26-26 26S6 48 6 32C6 17 17 6 32 6z" fill="url(#jelly-shine)" />
      <ellipse cx="23" cy="22" rx="10" ry="6" fill="#fff" opacity="0.55" />
      <circle cx="24" cy="34" r="4.2" fill="#3a2458" />
      <circle cx="42" cy="34" r="4.2" fill="#3a2458" />
      <circle cx="25.4" cy="32.6" r="1.5" fill="#fff" />
      <circle cx="43.4" cy="32.6" r="1.5" fill="#fff" />
      <path d="M26 44c3.2 3.2 8.8 3.2 12 0" fill="none" stroke="#c43b72" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="16" cy="42" rx="3.2" ry="2" fill="#ffb3cf" />
      <ellipse cx="48" cy="42" rx="3.2" ry="2" fill="#ffb3cf" />
      <path d="M48 8l1.6 3.4 3.6.6-2.6 2.4.7 3.6L48 16.2 44.7 18l.7-3.6-2.6-2.4 3.6-.6z" fill="#ffe56a" />
      <defs>
        <radialGradient id="jelly-shine" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#ff8ec8" stopOpacity="0" />
          <stop offset="100%" stopColor="#e85aa0" stopOpacity="0.35" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function Logo({ size = 'big' }: { size?: 'big' | 'small' }) {
  return (
    <div className={`logo logo-${size}`} aria-label="Jelly Brawl 果冻擂台">
      <JellyMark />
      <span className="logo-en" aria-hidden>
        {LETTERS.map((ch, i) => (
          ch === ' '
            ? <i key={i} className="logo-gap" />
            : <em key={i} style={{ '--i': i } as CSSProperties}>{ch}</em>
        ))}
      </span>
      <span className="logo-cn">果冻擂台</span>
    </div>
  );
}
