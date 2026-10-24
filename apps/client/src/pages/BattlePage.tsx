/** 03 战斗页：3D 擂台 + 摇杆 + HUD（系列赛 / 事件横幅 / 局间记分）。 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DashButton } from '../components/DashButton';
import { SkillButton } from '../components/SkillButton';
import { IconTimer, IconUser } from '../components/icons';
import { Joystick } from '../components/Joystick';
import { ShrinkWarning } from '../components/ShrinkWarning';
import { SkyBackground } from '../components/SkyBackground';
import { sfx, startBattleBgm, stopBattleBgm, unlockAudio } from '../game/audio';
import { createInput, releaseKeys } from '../game/input';
import { NetRunner } from '../game/netRunner';
import { BattleRunner, type Hud } from '../game/runner';
import type { MatchResult } from '../game/types';
import { onlineNow, subscribeOnline } from '../net/onlineCount';
import { session } from '../net/session';
import { useApp } from '../state/AppState';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TITLES = { practice: '单人练习', match: '本地对战 · 三局赛', online: '联机对战 · 三局赛' } as const;

export function BattlePage() {
  const { state, dispatch } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const runner = useRef<BattleRunner | null>(null);
  const [input] = useState(createInput);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [high, setHigh] = useState(false);
  const highRef = useRef(false);
  const setCam = useRef<(v: boolean) => void>(() => undefined);
  const onlineN = useSyncExternalStore(subscribeOnline, onlineNow, () => null);
  const practice = state.mode === 'practice';
  const online = state.mode === 'online';

  useEffect(() => {
    unlockAudio();
    startBattleBgm();
    const onEnd = (result: MatchResult) => dispatch({ type: 'finishBattle', result });
    if (online) {
      if (!session.start) {
        dispatch({ type: 'goLobby' });
        return () => stopBattleBgm();
      }
      const r = new NetRunner({ host: host.current!, input, onHud: setHud, onEnd });
      setCam.current = (v) => r.setHighView(v);
      r.setHighView(highRef.current);
      return () => {
        stopBattleBgm();
        setCam.current = () => undefined;
        r.dispose();
      };
    }
    const r = new BattleRunner({
      host: host.current!, mode: state.mode, skinId: state.skinId, mapId: state.mapId, input, onHud: setHud, onEnd,
    });
    runner.current = r;
    setCam.current = (v) => r.setHighView(v);
    r.setHighView(highRef.current);
    return () => {
      stopBattleBgm();
      setCam.current = () => undefined;
      r.dispose();
      runner.current = null;
    };
  }, [online, state.mode, state.skinId, state.mapId, state.battleId, input, dispatch]);

  // 倒计时音效：3、2、1、开打
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (!hud || hud.phase !== 'countdown') {
      lastCount.current = null;
      return;
    }
    if (lastCount.current === hud.countdown) return;
    lastCount.current = hud.countdown;
    if (hud.countdown > 0) sfx.tick();
    else sfx.go();
  }, [hud]);

  useEffect(() => {
    if (!online) runner.current?.setPaused(paused);
    if (paused) stopBattleBgm();
    else if (hud?.phase === 'play' || hud?.phase === 'countdown') startBattleBgm();
  }, [paused, online, hud?.phase]);

  useEffect(() => {
    if (paused) {
      input.dashHeld = false;
      input.useQueued = false;
      input.swapQueued = false;
      input.stickX = input.stickY = 0;
      releaseKeys();
    }
  }, [paused, input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyC' || e.repeat) return;
      e.preventDefault();
      highRef.current = !highRef.current;
      setHigh(highRef.current);
      setCam.current(highRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const leaveRoom = async () => {
    await session.leave();
    dispatch({ type: 'goLobby' });
  };

  const bannerSeen = useRef<string | null>(null);
  const bannerKey = useRef(0);
  if (hud?.banner !== bannerSeen.current) {
    bannerSeen.current = hud?.banner ?? null;
    if (hud?.banner) bannerKey.current += 1;
  }

  const warn = hud?.phase === 'play' ? hud.warnLeft : null;
  const title = online && session.lobby ? `${TITLES.online} · 房间 ${session.lobby.code}` : TITLES[state.mode];
  const roundLabel = hud?.overtime
    ? '加赛'
    : `第 ${hud?.round ?? 1}/${hud?.totalRounds ?? 1} 局`;

  return (
    <div className={`page battle-page ${warn !== null ? 'battle-danger' : ''}`}>
      <SkyBackground dim={warn !== null} theme={state.mapId} />
      <div ref={host} className="battle-canvas" />

      <div className="hud-top">
        <div className="hud-left">
          <span className="hud-pill hud-title">{title}</span>
          <span className="hud-pill">{roundLabel} · 累计 <b>{hud?.seriesScore ?? 0}</b></span>
          <span className="hud-pill"><IconUser size={22} />剩余 <b>{hud?.alive ?? '-'}</b> 人</span>
          <span className="hud-pill hud-level">体型 Lv.{hud?.level ?? 1}{hud?.item ? ` · ${hud.item}` : ''}</span>
        </div>
        <div className="hud-right">
          <span className="hud-pill">在线 {onlineN ?? '—'}</span>
          <span className="hud-pill hud-timer"><IconTimer />{fmt(hud?.timeLeft ?? 60)}</span>
          <button type="button" className="hud-pill hud-cam" onClick={() => {
            highRef.current = !highRef.current;
            setHigh(highRef.current);
            setCam.current(highRef.current);
          }}>{high ? '正常视角' : '高视角'}</button>
          <button className="hud-pill hud-pause" onClick={() => setPaused(true)} aria-label={online ? '菜单' : '暂停'}>❚❚</button>
        </div>
      </div>

      <ShrinkWarning secondsLeft={warn} />

      {hud?.banner && <div className="event-banner" key={bannerKey.current}>{hud.banner}</div>}
      {hud?.alert && <div className="event-alert">{hud.alert}</div>}

      {hud?.phase === 'countdown' && (
        <div className="countdown" key={hud.countdown}>{hud.countdown > 0 ? hud.countdown : '开打！'}</div>
      )}

      {hud?.phase === 'round_end' && (
        <div className="round-board">
          <h2>{hud.overtime ? '加赛即将开始' : `第 ${hud.round} 局结束`}</h2>
          <ol>
            {hud.roundRanks.slice(0, 6).map((row) => (
              <li key={row.id} className={row.isPlayer ? 'me' : ''}>
                <span>{row.rank}</span>
                <b>{row.name}</b>
                <em>+{row.gain}</em>
                <i>总分 {row.total}</i>
              </li>
            ))}
          </ol>
          <p className="muted">请稍候…</p>
        </div>
      )}

      {hud && !hud.playerAlive && hud.phase === 'play' && (
        <div className="out-banner">
          <p>你变成幽灵了！瞄准方向按「冲」放布丁</p>
          <p className="muted">{hud.ghostCd > 0 ? `冷却 ${Math.ceil(hud.ghostCd)}s` : '布丁已就绪'}</p>
          {!online && (
            <button className="btn btn-yellow" onClick={() => runner.current?.finishNow()}>提前结束整场</button>
          )}
        </div>
      )}
      {hud?.phase === 'series_end' && <div className="countdown">系列赛结束</div>}

      <Joystick input={input} />
      {hud?.heldB && hud.playerAlive && hud.phase === 'play' && (
        <button
          type="button"
          className="swap-btn"
          onPointerDown={(e) => {
            e.preventDefault();
            input.swapQueued = true;
          }}
        >
          Q 切换 {hud.heldB}
        </button>
      )}
      {hud?.held && hud.playerAlive && hud.phase === 'play' && <SkillButton input={input} name={hud.held} />}
      <DashButton input={input} charge={hud?.charge ?? 0} />
      <p className="key-hint">电脑：WASD 移动，空格蓄力，E 或 1 释放，Q 或 2 切换，C 切换视角</p>

      {paused && (
        <div className="modal-mask">
          <div className="modal pause-menu">
            <h2>{online ? '联机对战中' : '已暂停'}</h2>
            {online && <p className="muted">联机时游戏不会暂停。</p>}
            <button className="btn btn-yellow" onClick={() => setPaused(false)}>继续</button>
            {practice && (
              <button className="btn btn-blue" onClick={() => runner.current?.finishNow()}>结束练习并结算</button>
            )}
            {online ? (
              <button className="btn btn-gray" onClick={leaveRoom}>离开房间（你的果冻交给电脑）</button>
            ) : (
              <button className="btn btn-gray" onClick={() => dispatch({ type: 'goLobby' })}>放弃本场，返回大厅</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
