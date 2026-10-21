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
import { AppProvider, useApp } from './state/AppState';

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

export default function App() {
  return (
    <AppProvider>
      <Pages />
      <NetBridge />
      <RotateHint />
    </AppProvider>
  );
}
