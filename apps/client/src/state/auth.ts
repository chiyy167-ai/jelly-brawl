/** 邮箱登录状态：给 React 用 useSyncExternalStore 订阅。 */
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../net/supabase';

type Listener = () => void;

class AuthStore {
  session: Session | null = null;
  ready = !supabaseConfigured;
  version = 0;
  private listeners = new Set<Listener>();
  private started = false;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    this.ensure();
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  get user(): User | null {
    return this.session?.user ?? null;
  }

  get email(): string {
    return this.user?.email ?? '';
  }

  get loggedIn(): boolean {
    return !!this.session;
  }

  private bump(): void {
    this.version += 1;
    this.listeners.forEach((fn) => fn());
  }

  private ensure(): void {
    if (this.started) return;
    this.started = true;
    const sb = getSupabase();
    if (!sb) {
      this.ready = true;
      this.bump();
      return;
    }
    void sb.auth.getSession().then(({ data }) => {
      this.session = data.session;
      this.ready = true;
      this.bump();
    });
    sb.auth.onAuthStateChange((_event, session) => {
      this.session = session;
      this.ready = true;
      this.bump();
    });
  }

  async signUp(email: string, password: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) return friendlyAuth(error.message);
    // 未开邮箱验证时会直接有 session；开了验证时要去邮箱点链接
    if (!data.session) return 'ok-confirm';
    return null;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyAuth(error.message) : null;
  }

  async signOut(): Promise<void> {
    await getSupabase()?.auth.signOut();
  }
}

function friendlyAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return '邮箱或密码不对';
  if (m.includes('already registered') || m.includes('already been registered')) return '这个邮箱已经注册过了，请直接登录';
  if (m.includes('password')) return '密码至少 6 位';
  if (m.includes('email')) return '请填写正确的邮箱';
  if (m.includes('confirm') || m.includes('not confirmed')) return '请先到邮箱点开验证链接，再回来登录';
  if (m.includes('rate') || m.includes('security')) return '操作太频繁，请稍后再试';
  return msg || '登录失败，请稍后再试';
}

export const auth = new AuthStore();
