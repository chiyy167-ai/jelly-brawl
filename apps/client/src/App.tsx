/** 根组件：只负责按当前页面状态切换页面，外加全局的横屏提示和联机事件。 */
import { useEffect } from 'react';
import { RotateHint } from './components/RotateHint';
import { unlockAudio } from './game/audio';
import { session } from './net/session';
import { BattlePage } from './pages/BattlePage';
import { LoadingPage } from './pages/LoadingPage';
import { LobbyPage } from './pages/LobbyPage';
import { ResultPage } from './pages/ResultPage';
import { RoomPage } from './pages/RoomPage';
import { SkinPage } from './pages/SkinPage';
import { auth } from './state/auth';
import { AppProvider, useApp } from './state/AppState';
import { syncHistoryAfterLogin } from './state/cloudHistory';
import { syncProfileAfterLogin } from './state/profile';

function Pages() {
  const { state } = useApp();
  switch (state.page) {
    case 'loading':
      return <LoadingPage />;
    case 'lobby':
      return <LobbyPage />;
    case 'battle':
      return <BattlePage key={state.battleId} />;
    case 'skins':
      return <SkinPage />;
    case 'result':
      return <ResultPage />;
    case 'room':
      return <RoomPage />;
  }
}

/** 房主开局时所有人一起进战斗；掉线时回大厅并提示 */
function NetBridge() {
  const { dispatch } = useApp();
  useEffect(() => {
    session.onStart = (msg) => dispatch({ type: 'netStart', mapId: msg.mapId });
    session.onKicked = (msg) => dispatch({ type: 'goLobby', notice: msg });
    return () => {
      session.onStart = null;
      session.onKicked = null;
    };
  }, [dispatch]);
  return null;
}

/** 登录成功后同步战绩与昵称（邮箱验证 / Google 回调回来时也会触发） */
function AuthBridge() {
  useEffect(() => {
    let last = '';
    return auth.subscribe(() => {
      const id = auth.user?.id ?? '';
      if (id && id !== last) {
        last = id;
        void syncHistoryAfterLogin();
        void syncProfileAfterLogin();
      }
      if (!id) last = '';
    });
  }, []);
  return null;
}

/** 任意一次点击/触摸后解锁 WebAudio（iOS / 微信要求） */
function AudioUnlock() {
  useEffect(() => {
    const once = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
    };
    window.addEventListener('pointerdown', once);
    window.addEventListener('keydown', once);
    return () => {
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
    };
  }, []);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <Pages />
      <NetBridge />
      <AuthBridge />
      <AudioUnlock />
      <RotateHint />
    </AppProvider>
  );
}
