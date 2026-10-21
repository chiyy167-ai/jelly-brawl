/** 根组件：只负责按当前页面状态切换页面，外加全局的横屏提示和联机事件。 */
import { useEffect } from 'react';
import { RotateHint } from './components/RotateHint';
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
    session.onStart = () => dispatch({ type: 'netStart' });
    session.onKicked = (msg) => dispatch({ type: 'goLobby', notice: msg });
    return () => {
      session.onStart = null;
      session.onKicked = null;
    };
  }, [dispatch]);
  return null;
}

/** 登录成功后把本机战绩补传到云端（邮箱验证跳转回来时也会触发） */
function AuthBridge() {
  useEffect(() => {
    let last = '';
    return auth.subscribe(() => {
      const id = auth.user?.id ?? '';
      if (id && id !== last) {
        last = id;
        void syncHistoryAfterLogin();
      }
      if (!id) last = '';
    });
  }, []);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <Pages />
      <NetBridge />
      <AuthBridge />
      <RotateHint />
    </AppProvider>
  );
}
