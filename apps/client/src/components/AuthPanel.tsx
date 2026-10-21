/** 设置里的邮箱注册 / 登录面板。未配置 Supabase 时显示说明。 */
import { useState, useSyncExternalStore } from 'react';
import { supabaseConfigured } from '../net/supabase';
import { auth } from '../state/auth';
import { syncHistoryAfterLogin } from '../state/cloudHistory';
import { saveName } from '../state/storage';

type Mode = 'login' | 'register';

export function AuthPanel() {
  useSyncExternalStore(auth.subscribe, auth.getVersion);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  if (!supabaseConfigured) {
    return (
      <div className="auth-panel">
        <p className="pending-note">账号服务尚未配置。在仓库 Variables 里设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 后重新发布即可。</p>
      </div>
    );
  }

  if (!auth.ready) return <p className="muted">正在检查登录状态…</p>;

  if (auth.loggedIn) {
    return (
      <div className="auth-panel">
        <p className="auth-email">已登录：<b>{auth.email}</b></p>
        <p className="muted">战绩会同步到云端，换手机登录同一账号也能看到。</p>
        <button
          className="btn btn-gray"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await auth.signOut();
            setBusy(false);
          }}
        >
          退出登录
        </button>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError('');
    setHint('');
    const err = mode === 'login'
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password);
    setBusy(false);
    if (err === 'ok-confirm') {
      setHint('注册成功！请到邮箱点开验证链接，再回来登录。（若收不到邮件，检查垃圾箱，或在 Supabase 控制台关闭邮箱验证。）');
      setMode('login');
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    // 用邮箱前缀当作默认联机昵称（用户可在多人对战里改）
    const nick = email.trim().split('@')[0]?.slice(0, 10);
    if (nick) saveName(nick);
    void syncHistoryAfterLogin();
    setHint(mode === 'register' ? '注册成功，已自动登录。' : '登录成功。');
  };

  return (
    <div className="auth-panel">
      <div className="auth-tabs">
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>登录</button>
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>注册</button>
      </div>
      <label className="field">
        <span>邮箱</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <label className="field">
        <span>密码</span>
        <input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" />
      </label>
      {error && <p className="net-error">{error}</p>}
      {hint && <p className="auth-hint">{hint}</p>}
      <button className="btn btn-yellow btn-big" disabled={busy || !email || password.length < 6} onClick={submit}>
        {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
      </button>
    </div>
  );
}
