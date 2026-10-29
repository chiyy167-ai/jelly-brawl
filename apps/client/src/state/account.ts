/** 登录：交给联机服务器的账号库。没有这个邮箱就自动注册。登录过一次下次直接进大厅。 */
import { serverUrl } from '../net/session';

const SESSION_KEY = 'jelly-brawl.session';

/** 密码框的初始值，开发者账号也用这个密码 */
export const INITIAL_PASSWORD = 'happy123';

export interface LoginOk {
  email: string;
  isNew: boolean;
  coins: number;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailLooksOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function currentAccount(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function logoutAccount(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // 忽略
  }
}

function loginUrl(): string {
  const raw = serverUrl().replace(/\/$/, '');
  if (!raw) return '';
  return `${raw.replace(/^ws/i, 'http')}/auth/login`;
}

/** 成功返回账号；失败返回给界面看的一句中文 */
export async function loginAccount(email: string, password: string): Promise<LoginOk | string> {
  const addr = normalizeEmail(email);
  if (!emailLooksOk(addr)) return '请填写正确的邮箱';
  if (password.length < 6) return '密码至少 6 位';
  const url = loginUrl();
  if (!url) return '还没有账号服务器';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addr, password }),
    });
    const data = await res.json() as LoginOk & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) return data.error || '登录失败，请稍后再试';
    localStorage.setItem(SESSION_KEY, data.email || addr);
    return { email: data.email || addr, isNew: !!data.isNew, coins: Number(data.coins) || 0 };
  } catch {
    return '连不上账号服务器，请确认游戏服务器已启动';
  }
}
