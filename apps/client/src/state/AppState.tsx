/** 全局页面状态：当前页面、对局模式、选中皮肤、上一局结果。 */
import { createContext, useCallback, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { GameMode, MatchResult } from '../game/types';
import { pushMatchResult } from './cloudHistory';
import { addHistory, loadSkin, saveSkin } from './storage';

export type Page = 'loading' | 'lobby' | 'battle' | 'skins' | 'result' | 'room';

export interface AppState {
  page: Page;
  mode: GameMode;
  skinId: string;
  result: MatchResult | null;
  /** 每开一局 +1，用来让战斗页完全重新创建 */
  battleId: number;
  /** 大厅顶部的一次性提示（例如联机掉线） */
  notice: string;
}

export type Action =
  | { type: 'loaded' }
  | { type: 'goLobby'; notice?: string }
  | { type: 'startBattle'; mode: GameMode }
  | { type: 'replay' }
  | { type: 'openSkins' }
  | { type: 'selectSkin'; skinId: string }
  | { type: 'finishBattle'; result: MatchResult }
  | { type: 'enterRoom' }
  | { type: 'netStart' }
  | { type: 'clearNotice' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return { ...state, page: 'lobby' };
    case 'goLobby':
      return { ...state, page: 'lobby', notice: action.notice ?? '' };
    case 'startBattle':
      return { ...state, page: 'battle', mode: action.mode, battleId: state.battleId + 1 };
    case 'replay':
      // 联机的“再玩一局”是回到房间等房主开局
      return state.mode === 'online' ? { ...state, page: 'room' } : { ...state, page: 'battle', battleId: state.battleId + 1 };
    case 'openSkins':
      return { ...state, page: 'skins' };
    case 'selectSkin':
      return { ...state, skinId: action.skinId };
    case 'finishBattle':
      return { ...state, page: 'result', result: action.result };
    case 'enterRoom':
      return { ...state, page: 'room', mode: 'online' };
    case 'netStart':
      return { ...state, page: 'battle', mode: 'online', battleId: state.battleId + 1 };
    case 'clearNotice':
      return { ...state, notice: '' };
    default:
      return state;
  }
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, () => ({
    page: 'loading' as Page,
    mode: 'match' as GameMode,
    skinId: loadSkin(),
    result: null,
    battleId: 0,
    notice: '',
  }));
  // 存储等副作用放在 reducer 外面，避免开发模式下被执行两次
  const dispatch = useCallback<Dispatch<Action>>((action) => {
    if (action.type === 'selectSkin') saveSkin(action.skinId);
    if (action.type === 'finishBattle') {
      addHistory(action.result);
      // 已登录则异步写入云端，失败不影响本地结算
      void pushMatchResult(action.result);
    }
    rawDispatch(action);
  }, []);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp 必须在 AppProvider 里使用');
  return v;
}
