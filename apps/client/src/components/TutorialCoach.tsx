/** 新手引导局顶部教练条：四步教会移动、吃果冻、冲撞、缩圈。 */
import { useEffect, useState } from 'react';
import type { MatchState } from '../game/types';

const STEPS = [
  { id: 'move', title: '① 移动', tip: '拖动左下角摇杆（电脑用 WASD），先随便走两步。' },
  { id: 'eat', title: '② 变大', tip: '走到彩色小果冻块上吃掉，体型会升到 Lv.2。' },
  { id: 'dash', title: '③ 冲撞', tip: '按住右下角拳头蓄力，松手冲出去，撞一下对面的果冻。' },
  { id: 'shrink', title: '④ 缩圈', tip: '平台会缩小！红圈外的地会掉下去，尽量站在圈内。' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export function TutorialCoach({
  getState,
  onSkip,
}: {
  getState(): MatchState | null;
  onSkip(): void;
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let primed = false;
    let sawDash = false;
    let sawHit = false;
    let shrinkOk = false;
    const tick = () => {
      const s = getState();
      if (!s) return;
      const me = s.jellies.find((j) => j.isPlayer) ?? s.jellies[0];
      if (!primed && s.phase === 'play') {
        startX = me.x;
        startY = me.y;
        primed = true;
      }
      if (primed && Math.hypot(me.x - startX, me.y - startY) > 1.2) setMoved(true);
      if (s.fx.some((e) => e.type === 'dash' && e.id === me.id)) sawDash = true;
      if (s.fx.some((e) => e.type === 'hit')) sawHit = true;
      if (me.dashT > 0) sawDash = true;
      if (me.hits > 0) sawHit = true;
      // 缩圈步骤：出现警告或时间到 18 秒后，再活过 4 秒 / 或撞下对方
      if (s.warn || s.time >= 16) {
        if (s.time >= 20 || !me.alive || s.jellies.some((j) => !j.alive && !j.isPlayer)) shrinkOk = true;
      }

      let next = 0;
      if (moved || Math.hypot(me.x - startX, me.y - startY) > 1.2) next = 1;
      if (me.eaten >= 1 || me.level >= 2) next = 2;
      if (sawDash && (sawHit || me.hits > 0 || s.time > 12)) next = 3;
      if (shrinkOk || s.phase === 'series_end' || s.phase === 'round_end') {
        setDone(true);
        next = 3;
      }
      setStep(next);
    };
    const id = window.setInterval(tick, 200);
    return () => clearInterval(id);
  }, [getState, moved]);

  const cur = STEPS[Math.min(step, STEPS.length - 1)] as { id: StepId; title: string; tip: string };
  return (
    <div className="tutorial-coach" role="status">
      <div className="tutorial-coach-main">
        <strong>{done ? '✓ 引导完成！' : cur.title}</strong>
        <p>{done ? '正式对战里还有道具和随机事件，去大厅开一局吧。' : cur.tip}</p>
        <div className="tutorial-dots" aria-hidden>
          {STEPS.map((s, i) => (
            <i key={s.id} className={i < step || done ? 'on' : i === step ? 'cur' : ''} />
          ))}
        </div>
      </div>
      <button type="button" className="tutorial-skip" onClick={onSkip}>跳过教程</button>
    </div>
  );
}
