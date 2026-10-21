/** 多人对战弹窗：填昵称，创建房间或输入房间号加入（连接真实的 Colyseus 服务器）。 */
import { useState, useSyncExternalStore } from 'react';
import { CODE_LENGTH, cleanProfile } from '../net/protocol';
import { serverUrl, session } from '../net/session';
import { useApp } from '../state/AppState';
import { loadName, saveName } from '../state/storage';
import { Modal } from './Modal';

export function MultiModal({ onClose, initialCode = '' }: { onClose(): void; initialCode?: string }) {
  const { state, dispatch } = useApp();
  useSyncExternalStore(session.subscribe, session.getVersion);
  const [name, setName] = useState(loadName);
  const [code, setCode] = useState(initialCode);
  const url = serverUrl();

  const go = async (join: boolean) => {
    const profile = cleanProfile({ name, skinId: state.skinId });
    saveName(profile.name);
    const ok = join ? await session.join(code, profile) : await session.create(profile);
    if (ok) dispatch({ type: 'enterRoom' });
  };

  const busy = session.busy;
  return (
    <Modal title="多人对战" onClose={onClose}>
      {!url && (
        <div className="pending-note">
          <b>联机服务器还没有部署。</b>部署好服务器并在构建时设置 VITE_SERVER_URL 后，这里就能直接联网。
        </div>
      )}
      <label className="field">
        <span>我的昵称</span>
        <input value={name} maxLength={10} onChange={(e) => setName(e.target.value)} placeholder="最多 10 个字" />
      </label>
      <div className="room-form">
        <button className="btn btn-blue" disabled={busy || !url} onClick={() => go(false)}>
          {busy ? '连接中…' : '创建房间'}
        </button>
        <div className="room-join">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH))}
            placeholder="输入房间号"
            aria-label="房间号"
            inputMode="text"
            autoCapitalize="characters"
          />
          <button className="btn btn-yellow" disabled={busy || !url || code.length !== CODE_LENGTH} onClick={() => go(true)}>
            加入
          </button>
        </div>
      </div>
      {session.error && <p className="net-error">{session.error}</p>}
      <p className="muted">最多 4 人一起玩，人数不够时开局会由电脑补位。服务器第一次连接可能要等半分钟左右唤醒。</p>
      {url && <p className="muted server-url">服务器：{url}</p>}
    </Modal>
  );
}
