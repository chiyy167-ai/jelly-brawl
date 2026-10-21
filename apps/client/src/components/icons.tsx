/** 界面用到的小图标（内联 SVG，不依赖外部图片）。 */
type P = { size?: number };

export const IconPlay = ({ size = 40 }: P) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden><circle cx="20" cy="20" r="19" fill="#fff" /><path d="M15 11l14 9-14 9z" fill="#ff9d1c" /></svg>
);
export const IconUser = ({ size = 36 }: P) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden><circle cx="18" cy="11" r="7" fill="currentColor" /><path d="M4 33c0-8 6-13 14-13s14 5 14 13z" fill="currentColor" /></svg>
);
export const IconUsers = ({ size = 36 }: P) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden><circle cx="12" cy="11" r="6" fill="currentColor" /><circle cx="25" cy="12" r="5" fill="currentColor" opacity=".75" /><path d="M1 32c0-7 5-11 11-11s11 4 11 11z" fill="currentColor" /><path d="M20 21c1.5-.6 3.2-1 5-1 6 0 10 4 10 11H24c0-4-1.5-7.5-4-10z" fill="currentColor" opacity=".75" /></svg>
);
export const IconShirt = ({ size = 36 }: P) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden><path d="M12 4l-9 5 3 8 4-2v17h16V15l4 2 3-8-9-5c-1 3-3.5 4.5-6 4.5S13 7 12 4z" fill="currentColor" /></svg>
);
export const IconCrown = ({ size = 36 }: P) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden><path d="M4 12l7 6 7-11 7 11 7-6-3 17H7z" fill="currentColor" /><rect x="7" y="30" width="22" height="3" rx="1.5" fill="currentColor" /></svg>
);
export const IconGift = ({ size = 36 }: P) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden><rect x="4" y="12" width="28" height="7" rx="2" fill="#ffcf3f" /><rect x="6" y="19" width="24" height="14" rx="2" fill="#ff5a6e" /><rect x="16" y="12" width="4" height="21" fill="#ffcf3f" /><path d="M18 12c-3-6-9-7-9-3s6 3 9 3zm0 0c3-6 9-7 9-3s-6 3-9 3z" fill="#ffcf3f" /></svg>
);
export const IconBook = ({ size = 36 }: P) => (
  <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden><circle cx="18" cy="12" r="7" fill="#ffd9b0" /><path d="M5 31c0-7 6-11 13-11s13 4 13 11z" fill="#2f7cf6" /><path d="M10 6l8-3 8 3-8 3z" fill="#1e2b5c" /></svg>
);
export const IconGear = ({ size = 30 }: P) => (
  <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden><path fill="currentColor" d="M13 2h4l.7 3.3 2.4 1 2.8-1.9 2.8 2.8-1.9 2.8 1 2.4L28 13v4l-3.3.7-1 2.4 1.9 2.8-2.8 2.8-2.8-1.9-2.4 1L17 28h-4l-.7-3.3-2.4-1-2.8 1.9-2.8-2.8 1.9-2.8-1-2.4L2 17v-4l3.3-.7 1-2.4-1.9-2.8 2.8-2.8 2.8 1.9 2.4-1zM15 10a5 5 0 100 10 5 5 0 000-10z" /></svg>
);
export const IconGem = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden><path d="M7 3h14l5 7-12 15L2 10z" fill="#3fb6ff" /><path d="M7 3l7 7 7-7M2 10h24M14 10v15" stroke="#bfe8ff" strokeWidth="1.5" fill="none" /></svg>
);
export const IconCoin = ({ size = 28 }: P) => (
  <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden><circle cx="14" cy="14" r="12" fill="#ffc21f" stroke="#e38b00" strokeWidth="2" /><circle cx="14" cy="14" r="7" fill="none" stroke="#fff0a8" strokeWidth="2" /></svg>
);
export const IconTimer = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden><circle cx="13" cy="15" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M13 15V10M10 2h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
);
export const IconFist = ({ size = 56 }: P) => (
  <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
    <path d="M14 24c0-4 3-6 6-6h18c4 0 7 3 7 7v9c0 9-7 15-15 15h-3c-7 0-13-6-13-13z" fill="#fff" stroke="#3b2a6b" strokeWidth="3" />
    <path d="M20 18v-4a4 4 0 018 0v4M28 18v-5a4 4 0 018 0v5M36 18v-3a4 4 0 018 0v8" fill="#fff" stroke="#3b2a6b" strokeWidth="3" />
    <path d="M14 28c4 0 9 1 11 5" fill="none" stroke="#3b2a6b" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
export const IconWarn = ({ size = 40 }: P) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden><path d="M20 3l18 33H2z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" /><rect x="18" y="13" width="4" height="13" rx="2" fill="#e8202f" /><circle cx="20" cy="31" r="2.4" fill="#e8202f" /></svg>
);
