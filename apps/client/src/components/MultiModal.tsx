/** 多人对战：先选新开还是加入，再进房间。地图由房主在房间里选。 */
import { useState, useSyncExternalStore } from 'react';
import { CODE_LENGTH, cleanProfile } from '../net/protocol';
import { serverUrl, session } from '../net/session';
import { useApp } from '../state/AppState';
import { loadName, saveName } from '../state/storage';
import { Modal } from './Modal';

type Step = 'pick' | 'create' | 'join';

export function MultiModal({ onClose, initialCode = '' }: { onClose(): void; initialCode?: string }) {
  const { state, dispatch } = useApp();
  useSyncExternalStore(session.subscribe, session.getVersion);
  const [step, setStep] = useState<Step>(initialCode ? 'join' : 'pick');
  const [code, setCode] = useState(initialCode);
  const url = serverUrl();
  const name = loadName();

  const go = async (join: boolean) => {
    const profile = cleanProfile({ name, skinId: state.skinId });
    saveName(profile.name);
    const ok = join ? await session.join(code, profile) : await session.create(profile);
    if (ok) dispatch({ type: 'enterRoom' });
  };

  const busy = session.busy;
  const title = step === 'create' ? '新开房间' : step === 'join' ? '加入房间' : '多人对战';
  return (
    <Modal title={title} onClose={onClose}>
      {!url && (
        <div className="pending-note">
          <b>联机服务器还没有部署。</b>部署好服务器并在构建时设置 VITE_SERVER_URL 后，这里就能直接联网。
        </div>
      )}
      {step === 'pick' && (
        <>
          <p className="multi-lead">最多 4 位朋友一起玩。人数不够时，开局由电脑补位。地图等进房间后再由房主选择。</p>
          <div className="multi-choices">
            <button type="button" className="multi-choice create" onClick={() => setStep('create')}>
              <b>新开房间</b>
              <span>你当房主，选好地图后开始</span>
            </button>
            <button type="button" className="multi-choice join" onClick={() => setStep('join')}>
              <b>加入房间</b>
              <span>输入朋友给你的 4 位房间号</span>
            </button>
          </div>
        </>
      )}
      {step === 'create' && (
        <>
          <p className="multi-lead">将用游戏名字「{name}」创建房间。名字可以在设置里修改。</p>
          <button className="btn btn-yellow btn-big" disabled={busy || !url} onClick={() => go(false)}>
            {busy ? '连接中…' : '创建房间'}
          </button>
          <button type="button" className="linkish multi-back" onClick={() => setStep('pick')}>返回</button>
        </>
      )}
      {step === 'join' && (
        <>
          <p className="multi-lead">
            {initialCode ? `朋友邀请你加入房间 ${initialCode}。` : '向房主要 4 位房间号，字母不用区分大小写。'}
          </p>
          <input
            className="room-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
            placeholder="房间号"
            aria-label="房间号"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button className="btn btn-yellow btn-big" disabled={busy || !url || code.length !== CODE_LENGTH} onClick={() => go(true)}>
            {busy ? '连接中…' : '加入房间'}
          </button>
          <button type="button" className="linkish multi-back" onClick={() => setStep('pick')}>返回</button>
        </>
      )}
      {session.error && <p className="net-error">{session.error}</p>}
      <p className="muted">服务器第一次连接可能要等半分钟左右唤醒。</p>
    </Modal>
  );
}
