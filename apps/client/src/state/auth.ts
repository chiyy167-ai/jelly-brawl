/** 账号：邮箱密码、Google、找回/改密。给 React 用 useSyncExternalStore 订阅。 */
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from '../net/supabase';

type Listener = () => void;

/** 页面回调地址（GitHub Pages 子路径也要带上） */
function redirectTo(): string {
  return `${location.origin}${location.pathname}`;
}

class AuthStore {
  session: Session | null = null;
  ready = !supabaseConfigured;
  /** 从邮件点「重置密码」回来后，需要用户设新密码 */
  needsPasswordReset = false;
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

  /** 是否用 Google 登录（没有邮箱密码可改） */
  get isGoogle(): boolean {
    const identities = this.user?.identities ?? [];
    return identities.some((i) => i.provider === 'google');
  }

  /** Google 头像，没有则空串 */
  get avatarUrl(): string {
    const meta = this.user?.user_metadata as Record<string, unknown> | undefined;
    const url = meta?.avatar_url ?? meta?.picture;
    return typeof url === 'string' ? url : '';
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
    sb.auth.onAuthStateChange((event, session) => {
      this.session = session;
      this.ready = true;
      if (event === 'PASSWORD_RECOVERY') this.needsPasswordReset = true;
      if (event === 'SIGNED_OUT') this.needsPasswordReset = false;
      this.bump();
    });
  }

  async signUp(email: string, password: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) return friendlyAuth(error.message);
    if (!data.session) return 'ok-confirm';
    return null;
  }

  async signIn(email: string, password: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    return error ? friendlyAuth(error.message) : null;
  }

  /** Gmail / Google 一键登录（会跳转到 Google） */
  async signInWithGoogle(): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo(),
        queryParams: { prompt: 'select_account' },
      },
    });
    return error ? friendlyAuth(error.message) : null;
  }

  /** 发找回密码邮件 */
  async resetPassword(email: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo(),
    });
    return error ? friendlyAuth(error.message) : null;
  }

  /** 点邮件链接回来后设置新密码 */
  async updatePassword(password: string): Promise<string | null> {
    const sb = getSupabase();
    if (!sb) return '还没有配置账号服务（缺少 Supabase 地址）';
    if (password.length < 6) return '密码至少 6 位';
    const { error } = await sb.auth.updateUser({ password });
    if (error) return friendlyAuth(error.message);
    this.needsPasswordReset = false;
    this.bump();
    return null;
  }

  clearPasswordReset(): void {
    this.needsPasswordReset = false;
    this.bump();
  }

  async signOut(): Promise<void> {
    this.needsPasswordReset = false;
    await getSupabase()?.auth.signOut();
  }
}

function friendlyAuth(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return '邮箱或密码不对';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return '这个邮箱已经注册过了，请直接登录';
  }
  if (m.includes('password')) return '密码至少 6 位';
  if (m.includes('email')) return '请填写正确的邮箱';
  if (m.includes('confirm') || m.includes('not confirmed')) {
    return '请先到邮箱点开验证链接，再回来登录';
  }
  if (m.includes('rate') || m.includes('security')) return '操作太频繁，请稍后再试';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'Google 登录尚未在后台开启，请用邮箱登录，或联系管理员配置 Google。';
  }
  return msg || '登录失败，请稍后再试';
}

export const auth = new AuthStore();
