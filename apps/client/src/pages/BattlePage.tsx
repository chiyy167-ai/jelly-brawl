/** 03 战斗页：Three.js 3D 擂台 + 摇杆 + 冲撞键 + 剩余人数 + 倒计时 + 缩圈警告。单机和联机共用。 */
import { useEffect, useRef, useState } from 'react';
import { DashButton } from '../components/DashButton';
import { IconTimer, IconUser } from '../components/icons';
import { Joystick } from '../components/Joystick';
import { ShrinkWarning } from '../components/ShrinkWarning';
import { SkyBackground } from '../components/SkyBackground';
import { sfx, startBattleBgm, stopBattleBgm, unlockAudio } from '../game/audio';
import { createInput } from '../game/input';
import { NetRunner } from '../game/netRunner';
import { BattleRunner, type Hud } from '../game/runner';
import type { MatchResult } from '../game/types';
import { session } from '../net/session';
import { useApp } from '../state/AppState';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TITLES = { practice: '单人练习', match: '本地对战 · 电脑对手', online: '联机对战' } as const;

export function BattlePage() {
  const { state, dispatch } = useApp();
  const host = useRef<HTMLDivElement>(null);
  const runner = useRef<BattleRunner | null>(null);
  const [input] = useState(createInput);
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
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
      return () => {
        stopBattleBgm();
        r.dispose();
      };
    }
    const r = new BattleRunner({ host: host.current!, mode: state.mode, skinId: state.skinId, input, onHud: setHud, onEnd });
    runner.current = r;
    return () => {
      stopBattleBgm();
      r.dispose();
      runner.current = null;
    };
  }, [online, state.mode, state.skinId, input, dispatch]);

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
      input.stickX = input.stickY = 0;
    }
  }, [paused, input]);

  const leaveRoom = async () => {
    await session.leave();
    dispatch({ type: 'goLobby' });
  };

  const warn = hud?.phase === 'play' ? hud.warnLeft : null;
  const title = online && session.lobby ? `${TITLES.online} · 房间 ${session.lobby.code}` : TITLES[state.mode];
  return (
    <div className={`page battle-page ${warn !== null ? 'battle-danger' : ''}`}>
      <SkyBackground dim={warn !== null} />
      <div ref={host} className="battle-canvas" />

      <div className="hud-top">
        <div className="hud-left">
          <span className="hud-pill hud-title">{title}</span>
          <span className="hud-pill"><IconUser size={22} />剩余 <b>{hud?.alive ?? '-'}</b> 人</span>
          <span className="hud-pill hud-level">体型 Lv.{hud?.level ?? 1}</span>
        </div>
        <div className="hud-right">
          <span className="hud-pill hud-timer"><IconTimer />{fmt(hud?.timeLeft ?? 60)}</span>
          <button className="hud-pill hud-pause" onClick={() => setPaused(true)} aria-label={online ? '菜单' : '暂停'}>❚❚</button>
        </div>
      </div>

      <ShrinkWarning secondsLeft={warn} />

      {hud?.phase === 'countdown' && (
        <div className="countdown" key={hud.countdown}>{hud.countdown > 0 ? hud.countdown : '开打！'}</div>
      )}
      {hud && !hud.playerAlive && hud.phase !== 'over' && (
        <div className="out-banner">
          <p>你掉下擂台了！正在观战…</p>
          {online ? (
            <p className="muted">等这一局结束后一起结算</p>
          ) : (
            <button className="btn btn-yellow" onClick={() => runner.current?.finishNow()}>直接结算</button>
          )}
        </div>
      )}
      {hud?.phase === 'over' && <div className="countdown">对局结束</div>}

      <Joystick input={input} />
      <DashButton input={input} charge={hud?.charge ?? 0} />
      <p className="key-hint">电脑：WASD / 方向键移动，空格蓄力冲撞</p>

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
              <button className="btn btn-gray" onClick={() => dispatch({ type: 'goLobby' })}>放弃本局，返回大厅</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
