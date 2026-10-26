/** 02 游戏大厅：开始游戏、单人练习、多人入口、皮肤、排行榜、每日奖励、新手教程。 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { IconBook, IconCodex, IconCoin, IconCrown, IconGear, IconGem, IconGift, IconPlay, IconShirt, IconUser, IconUsers } from '../components/icons';
import { JellyStageView } from '../components/JellyStageView';
import { LobbyModals, type LobbyModal } from '../components/LobbyModals';
import { Logo } from '../components/Logo';
import { MapPickModal, type MapPickNext } from '../components/MapPickModal';
import { SkyBackground } from '../components/SkyBackground';
import { getSkin } from '../data/skins';
import { startBgm } from '../game/audio';
import { renderThumbnails } from '../game/stage';
import type { MapId } from '../game/types';
import { onlineNow, subscribeOnline } from '../net/onlineCount';
import { CODE_LENGTH } from '../net/protocol';
import { useApp } from '../state/AppState';
import { auth } from '../state/auth';
import { loadProgress, progressVersion, subscribeProgress, xpBar } from '../state/progress';
import { hasDoneTutorial, loadName, nameStoreVersion, subscribeName } from '../state/storage';

const VIEW = { y: 3.4, z: 12, lookY: 0.6, fov: 35, floor: 5.4 };

function takeRoomParam(): string {
  const url = new URL(location.href);
  const code = (url.searchParams.get('room') ?? '').toUpperCase().slice(0, CODE_LENGTH);
  if (code) {
    url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }
  return code;
}

export function LobbyPage() {
  const { state, dispatch } = useApp();
  const [roomCode] = useState(takeRoomParam);
  useEffect(() => { startBgm(); }, []);
  const [modal, setModal] = useState<LobbyModal>(roomCode ? 'multi' : null);
  const [mapNext, setMapNext] = useState<MapPickNext | null>(null);

  const startTutorial = () => {
    dispatch({ type: 'setMap', mapId: 'candy' });
    dispatch({ type: 'startBattle', mode: 'tutorial' });
  };

  // 首次进入大厅自动开引导（有邀请进房时不打断；sessionStorage 防止本页重复自动进）
  useEffect(() => {
    if (roomCode || hasDoneTutorial()) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      if (cancelled || hasDoneTutorial()) return;
      try {
        if (sessionStorage.getItem('jb-auto-tut') === '1') return;
        sessionStorage.setItem('jb-auto-tut', '1');
      } catch {
        // 忽略
      }
      startTutorial();
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在进大厅时检查一次
  }, []);
  useSyncExternalStore(subscribeProgress, progressVersion, progressVersion);
  useSyncExternalStore(auth.subscribe, auth.getVersion);
  useSyncExternalStore(subscribeName, nameStoreVersion);
  const onlineN = useSyncExternalStore(subscribeOnline, onlineNow, () => null);
  const prog = loadProgress();
  const bar = xpBar();
  const skin = getSkin(state.skinId);
  const displayName = loadName();
  const avatar = useMemo(() => renderThumbnails([state.skinId])[state.skinId], [state.skinId]);
  const items = useMemo(() => {
    const others = ['blue', 'cool', 'wizard'].filter((id) => id !== state.skinId);
    return [
      { skinId: state.skinId, x: -0.4, z: 0, size: 3.1, yaw: 0.25 },
      { skinId: others[0], x: 2.4, z: 0.6, size: 1.6, yaw: -0.3 },
      { skinId: others[1], x: 4.1, z: -0.2, size: 1.4, yaw: -0.5 },
      { skinId: others[2] ?? 'sprout', x: -3.6, z: 0.3, size: 1.3, yaw: 0.5 },
    ];
  }, [state.skinId]);

  const afterMap = (mapId: MapId) => {
    dispatch({ type: 'setMap', mapId });
    const next = mapNext;
    setMapNext(null);
    if (next === 'multi') setModal('multi');
    else if (next === 'practice') dispatch({ type: 'startBattle', mode: 'practice' });
    else if (next === 'match') dispatch({ type: 'startBattle', mode: 'match' });
  };

  return (
    <div className="page lobby-page">
      <SkyBackground theme={mapNext ? state.mapId : 'candy'} />
      <JellyStageView className="lobby-stage" items={items} view={VIEW} />

      <header className="lobby-top">
        <div className="lobby-left">
          <Logo size="small" />
          <button className="profile-card" onClick={() => dispatch({ type: 'openSkins' })} aria-label="当前角色，点击换皮肤">
            <img src={avatar} alt="" />
            <div>
              <b>{displayName}</b>
              <small>Lv.{bar.level} · {skin.name}</small>
              <div className="xp-bar">
                <i style={{ width: `${bar.pct}%` }} />
                <span>{bar.xp}/{bar.need}</span>
              </div>
            </div>
          </button>
        </div>
        <div className="currency-row">
          <span className="online-pill" aria-label="当前在线人数">在线 {onlineN ?? '—'}</span>
          <button className="currency" onClick={() => setModal('shop')} aria-label={`宝石 ${prog.gems}`}>
            <IconGem /><span>{prog.gems}</span><em>+</em>
          </button>
          <button className="currency" onClick={() => setModal('shop')} aria-label={`金币 ${prog.coins}`}>
            <IconCoin /><span>{prog.coins}</span><em>+</em>
          </button>
          <button className="round-btn" onClick={() => setModal('settings')} aria-label="设置"><IconGear /></button>
        </div>
      </header>

      <aside className="lobby-side">
        <button className="side-btn side-daily" onClick={() => setModal('daily')}>
          <IconGift size={40} />
          <span>每日奖励</span>
        </button>
        <button className="side-btn" onClick={() => setModal('tutorial')}>
          <IconBook size={40} />
          <span>新手教程</span>
        </button>
        <button className="side-btn side-codex" onClick={() => setModal('items')}>
          <IconCodex size={40} />
          <span>道具图鉴</span>
        </button>
      </aside>

      <footer className="lobby-bottom">
        <div className="lobby-group">
          <button className="tile-btn" onClick={() => setMapNext('practice')}>
            <IconUser />
            <span>单人模式</span>
          </button>
          <button className="tile-btn" onClick={() => setModal('multi')}>
            <IconUsers />
            <span>多人对战</span>
          </button>
        </div>
        <button className="start-btn" onClick={() => setMapNext('match')}>
          <IconPlay />
          <span>开始游戏</span>
        </button>
        <div className="lobby-group">
          <button className="tile-btn" onClick={() => dispatch({ type: 'openSkins' })}>
            <IconShirt />
            <span>果冻皮肤</span>
          </button>
          <button className="tile-btn" onClick={() => setModal('rank')}>
            <IconCrown />
            <span>排行榜</span>
          </button>
        </div>
      </footer>

      {state.notice && (
        <div className="lobby-notice" role="status">
          <span>{state.notice}</span>
          <button onClick={() => dispatch({ type: 'clearNotice' })} aria-label="关闭">×</button>
        </div>
      )}

      {mapNext && (
        <MapPickModal next={mapNext} onClose={() => { setMapNext(null); startBgm('lobby'); }} onPicked={afterMap} />
      )}
      <LobbyModals
        which={modal}
        onClose={() => setModal(null)}
        roomCode={roomCode}
        onStartTutorial={startTutorial}
      />
    </div>
  );
}
