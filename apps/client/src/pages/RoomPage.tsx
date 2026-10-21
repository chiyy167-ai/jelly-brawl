/** 联机房间：显示房间号和分享链接、4 个座位，房主可以开局。 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SkyBackground } from '../components/SkyBackground';
import { GAME } from '../game/config';
import { renderThumbnails } from '../game/stage';
import { session } from '../net/session';
import { useApp } from '../state/AppState';

export function RoomPage() {
  const { dispatch } = useApp();
  useSyncExternalStore(session.subscribe, session.getVersion);
  const [copied, setCopied] = useState(false);
  const lobby = session.lobby;
  const players = lobby?.players ?? [];
  const thumbs = useMemo(() => renderThumbnails(players.map((p) => p.skinId)), [players]);

  // 会话没了（比如刷新过页面）就回大厅
  useEffect(() => {
    if (!session.room) dispatch({ type: 'goLobby' });
  }, [dispatch]);

  const link = lobby ? `${location.origin}${location.pathname}?room=${lobby.code}` : '';
  const share = async () => {
    const text = `来《果冻擂台》一起玩！房间号 ${lobby?.code}`;
    try {
      if (navigator.share) await navigator.share({ title: '果冻擂台', text, url: link });
      else {
        await navigator.clipboard.writeText(`${text} ${link}`);
        setCopied(true);
      }
    } catch {
      // 用户取消分享
    }
  };
  const leave = async () => {
    await session.leave();
    dispatch({ type: 'goLobby' });
  };

  const seats = Array.from({ length: GAME.online.maxHumans }, (_, i) => players[i] ?? null);
  const playing = lobby?.phase === 'playing';
  return (
    <div className="page room-page">
      <SkyBackground />
      <div className="room-card">
        <p className="room-label">房间号</p>
        <h1 className="room-code">{lobby?.code ?? '····'}</h1>
        <button className="btn btn-blue room-share" onClick={share} disabled={!lobby}>
          {copied ? '已复制链接' : '分享 / 复制邀请链接'}
        </button>
        <p className="muted">朋友打开链接，或在「多人对战」里输入房间号就能加入。</p>

        <ul className="room-seats">
          {seats.map((p, i) => (
            <li key={p?.sessionId ?? `empty-${i}`} className={p ? '' : 'empty'}>
              {p ? <img src={thumbs[p.skinId]} alt="" /> : <span className="seat-dot">?</span>}
              <b>{p ? p.name : '等待加入…'}</b>
              {p && p.sessionId === lobby?.hostId && <em className="tag-host">房主</em>}
              {p && p.sessionId === session.selfId && <em className="tag-me">你</em>}
            </li>
          ))}
        </ul>
        <p className="muted">人数不够 {GAME.online.seats} 人时，开局会由电脑补位。</p>

        {playing ? (
          <p className="room-wait">本局正在进行中…</p>
        ) : session.isHost ? (
          <button className="btn btn-yellow btn-big" onClick={() => session.startMatch()}>开始游戏（{players.length} 人）</button>
        ) : (
          <p className="room-wait">等待房主开始游戏…</p>
        )}
        <button className="btn btn-gray" onClick={leave}>离开房间</button>
      </div>
    </div>
  );
}
