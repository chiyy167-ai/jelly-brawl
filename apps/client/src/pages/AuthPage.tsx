/** 登录门：没有这个邮箱就由服务器自动注册。新用户先看见面礼，再进大厅。 */
import { useState } from 'react';
import { IconCoin } from '../components/icons';
import { Logo } from '../components/Logo';
import { SkyBackground } from '../components/SkyBackground';
import { emailLooksOk, INITIAL_PASSWORD, loginAccount } from '../state/account';
import { useApp } from '../state/AppState';
import { addCoins } from '../state/progress';
import { saveNameIfEmpty } from '../state/storage';

export function AuthPage() {
  const { dispatch } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(INITIAL_PASSWORD);
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gift, setGift] = useState<number | null>(null);

  const submit = async () => {
    setBusy(true);
    setError('');
    const result = await loginAccount(email, password);
    setBusy(false);
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    const nick = email.trim().split('@')[0]?.slice(0, 10) ?? '';
    saveNameIfEmpty(nick);
    if (result.isNew) {
      addCoins(result.coins);
      setGift(result.coins);
      return;
    }
    dispatch({ type: 'goLobby' });
  };

  const ready = emailLooksOk(email) && password.length >= 6 && !busy;

  return (
    <div className="page auth-page">
      <SkyBackground />
      <div className="auth-jelly auth-jelly-a" aria-hidden />
      <div className="auth-jelly auth-jelly-b" aria-hidden />
      <div className="auth-jelly auth-jelly-c" aria-hidden />
      {gift == null && <div className="auth-wrap">
        <Logo />
        <form
          className="auth-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void submit();
          }}
        >
          <p className="auth-hello">欢迎回来，果冻！</p>
          <label className="field">
            <span>邮箱</span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>密码</span>
            <span className="auth-pw">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="auth-eye" onClick={() => setShowPw((v) => !v)}>
                {showPw ? '隐藏' : '显示'}
              </button>
            </span>
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-yellow btn-big auth-go" type="submit" disabled={!ready}>
            {busy ? '请稍候…' : '登录'}
          </button>
          <p className="auth-tip">第一次用这个邮箱登录，会自动注册。登录过一次后，下次直接进入大厅。</p>
        </form>
      </div>}
      {gift != null && (
        <div className="gift-mask">
          <div className="gift-card" role="dialog" aria-label="新用户见面礼">
            <IconCoin size={72} />
            <h2>欢迎新果冻！</h2>
            <p className="gift-coin">+{gift}</p>
            <p>这是送给你的见面礼金币</p>
            <button className="btn btn-yellow btn-big auth-go" type="button" onClick={() => dispatch({ type: 'goLobby' })}>
              收下并进入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
