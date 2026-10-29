/** 设置里的账号面板：邮箱 / Google / 找回密码 / 游戏昵称。 */
import { useState, useSyncExternalStore } from 'react';
import { supabaseConfigured } from '../net/supabase';
import { auth } from '../state/auth';
import { syncHistoryAfterLogin } from '../state/cloudHistory';
import { cleanNickname, saveNickname, syncProfileAfterLogin } from '../state/profile';
import { loadName } from '../state/storage';

type Mode = 'login' | 'register' | 'forgot';

export function AuthPanel() {
  useSyncExternalStore(auth.subscribe, auth.getVersion);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState(loadName);
  const [newPass, setNewPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  if (!supabaseConfigured) {
    return (
      <div className="auth-panel">
        <p className="pending-note">
          换设备同步战绩还没接上。进游戏用的邮箱账号存在联机服务器的账号库里。
        </p>
      </div>
    );
  }

  if (!auth.ready) return <p className="muted">正在检查登录状态…</p>;

  // 从找回密码邮件点回来：强制设新密码
  if (auth.needsPasswordReset && auth.loggedIn) {
    return (
      <div className="auth-panel">
        <h4 className="auth-sub">设置新密码</h4>
        <p className="muted">你点了找回密码邮件，请输入新密码。</p>
        <label className="field">
          <span>新密码</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="至少 6 位"
          />
        </label>
        {error && <p className="net-error">{error}</p>}
        {hint && <p className="auth-hint">{hint}</p>}
        <button
          className="btn btn-yellow btn-big"
          disabled={busy || newPass.length < 6}
          onClick={async () => {
            setBusy(true);
            setError('');
            const err = await auth.updatePassword(newPass);
            setBusy(false);
            if (err) setError(err);
            else setHint('密码已更新，可以用新密码登录了。');
          }}
        >
          {busy ? '请稍候…' : '保存新密码'}
        </button>
      </div>
    );
  }

  if (auth.loggedIn) {
    return (
      <LoggedInPanel
        nick={nick}
        setNick={setNick}
        newPass={newPass}
        setNewPass={setNewPass}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
        hint={hint}
        setHint={setHint}
      />
    );
  }

  const afterOk = async () => {
    const name = await syncProfileAfterLogin();
    setNick(name);
    void syncHistoryAfterLogin();
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    setHint('');
    if (mode === 'forgot') {
      const err = await auth.resetPassword(email);
      setBusy(false);
      if (err) setError(err);
      else {
        setHint('已发送找回邮件，请到邮箱点开链接设置新密码。（检查垃圾箱）');
        setMode('login');
      }
      return;
    }
    const err = mode === 'login'
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password);
    setBusy(false);
    if (err === 'ok-confirm') {
      setHint('注册成功！请到邮箱点开验证链接，再回来登录。');
      setMode('login');
      return;
    }
    if (err) {
      setError(err);
      return;
    }
    await afterOk();
    setHint(mode === 'register' ? '注册成功，已自动登录。' : '登录成功。');
  };

  const google = async () => {
    setBusy(true);
    setError('');
    const err = await auth.signInWithGoogle();
    // 成功会跳走；失败才回到这里
    if (err) {
      setBusy(false);
      setError(err);
    }
  };

  return (
    <div className="auth-panel">
      <button type="button" className="btn-google" disabled={busy} onClick={google}>
        <GoogleIcon />
        <span>使用 Gmail / Google 一键登录</span>
      </button>
      <p className="auth-or"><span>或用邮箱</span></p>
      <div className="auth-tabs">
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>登录</button>
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>注册</button>
        <button type="button" className={mode === 'forgot' ? 'on' : ''} onClick={() => setMode('forgot')}>找回密码</button>
      </div>
      <label className="field">
        <span>邮箱</span>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" />
      </label>
      {mode !== 'forgot' && (
        <label className="field">
          <span>密码</span>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 位"
          />
        </label>
      )}
      {error && <p className="net-error">{error}</p>}
      {hint && <p className="auth-hint">{hint}</p>}
      <button
        className="btn btn-yellow btn-big"
        disabled={busy || !email || (mode !== 'forgot' && password.length < 6)}
        onClick={submit}
      >
        {busy ? '请稍候…' : mode === 'login' ? '登录' : mode === 'register' ? '注册' : '发送找回邮件'}
      </button>
    </div>
  );
}

function LoggedInPanel(props: {
  nick: string;
  setNick(v: string): void;
  newPass: string;
  setNewPass(v: string): void;
  busy: boolean;
  setBusy(v: boolean): void;
  error: string;
  setError(v: string): void;
  hint: string;
  setHint(v: string): void;
}) {
  const {
    nick, setNick, newPass, setNewPass, busy, setBusy, error, setError, hint, setHint,
  } = props;
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="auth-panel">
      <div className="auth-user-row">
        {auth.avatarUrl ? <img className="auth-avatar" src={auth.avatarUrl} alt="" referrerPolicy="no-referrer" /> : null}
        <div>
          <p className="auth-email">已登录：<b>{auth.email || 'Google 账号'}</b></p>
          <p className="muted">{auth.isGoogle ? '通过 Google 登录' : '邮箱账号'} · 战绩会同步到云端</p>
        </div>
      </div>

      <label className="field">
        <span>游戏名字（联机显示，最多 10 字）</span>
        <input
          type="text"
          maxLength={10}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="果冻玩家"
        />
      </label>
      <button
        className="btn btn-blue"
        disabled={busy || !cleanNickname(nick)}
        onClick={async () => {
          setBusy(true);
          setError('');
          setHint('');
          const err = await saveNickname(nick);
          setBusy(false);
          if (err) setError(err);
          else {
            setNick(cleanNickname(nick));
            setHint('游戏名字已保存。');
          }
        }}
      >
        保存游戏名字
      </button>

      {!auth.isGoogle && (
        <>
          <button type="button" className="linkish" onClick={() => setShowPass((v) => !v)}>
            {showPass ? '收起改密码' : '修改密码'}
          </button>
          {showPass && (
            <>
              <label className="field">
                <span>新密码</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="至少 6 位"
                />
              </label>
              <button
                className="btn btn-gray"
                disabled={busy || newPass.length < 6}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  const err = await auth.updatePassword(newPass);
                  setBusy(false);
                  if (err) setError(err);
                  else {
                    setNewPass('');
                    setHint('密码已修改。');
                    setShowPass(false);
                  }
                }}
              >
                确认改密
              </button>
            </>
          )}
        </>
      )}

      {error && <p className="net-error">{error}</p>}
      {hint && <p className="auth-hint">{hint}</p>}
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.1 7.1l.1.1 6.2 5.2C37.1 39.1 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
