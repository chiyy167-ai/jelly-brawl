/** 大厅里的各个弹窗。未接入的功能会明确写出“尚未接入”。 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { RARITY_LABEL } from '../data/skins';
import { auth } from '../state/auth';
import { fetchCloudHistory } from '../state/cloudHistory';
import { loadHistory, type HistoryEntry } from '../state/storage';
import { AuthPanel } from './AuthPanel';
import { Modal } from './Modal';
import { MultiModal } from './MultiModal';

export type LobbyModal = 'multi' | 'rank' | 'daily' | 'tutorial' | 'settings' | 'shop' | null;

const MODE_LABEL = { practice: '练习', match: '对战', online: '联机' } as const;

export function LobbyModals({ which, onClose, roomCode }: { which: LobbyModal; onClose(): void; roomCode?: string }) {
  if (which === 'multi') return <MultiModal onClose={onClose} initialCode={roomCode} />;
  if (which === 'rank') return <RankModal onClose={onClose} />;
  if (which === 'daily') return <DailyModal onClose={onClose} />;
  if (which === 'tutorial') return <TutorialModal onClose={onClose} />;
  if (which === 'settings') {
    return (
      <Modal title="设置" onClose={onClose}>
        <h3 className="auth-title">账号</h3>
        <AuthPanel />
        <hr className="auth-hr" />
        <p className="pending-note">音量、画质等设置项尚未接入。当前版本没有音效。</p>
        <p className="muted">版本：网页版 0.3（单机 + 4 人联机 + 账号战绩）</p>
      </Modal>
    );
  }
  if (which === 'shop') {
    return (
      <Modal title="商城" onClose={onClose}>
        <p className="pending-note">宝石 / 金币商城尚未接入，也没有任何支付功能。当前所有皮肤都可以免费试用。</p>
      </Modal>
    );
  }
  return null;
}

function RankModal({ onClose }: { onClose(): void }) {
  const version = useSyncExternalStore(auth.subscribe, auth.getVersion);
  const loggedIn = auth.loggedIn;
  const [list, setList] = useState<HistoryEntry[]>(() => loadHistory());
  const [loading, setLoading] = useState(loggedIn);

  useEffect(() => {
    let alive = true;
    if (!loggedIn) {
      setList(loadHistory());
      setLoading(false);
      return;
    }
    setLoading(true);
    void fetchCloudHistory().then((rows) => {
      if (alive) {
        setList(rows);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, [loggedIn, version]);

  return (
    <Modal title="排行榜" onClose={onClose}>
      <p className="pending-note">
        全服排行榜尚未接入。
        {auth.loggedIn
          ? '下面是你账号里的最近战绩（已同步到云端）。'
          : '下面是本浏览器里的最近战绩。打开右上角设置注册登录后，战绩可换设备查看。'}
      </p>
      {loading ? (
        <p className="muted">正在加载战绩…</p>
      ) : list.length === 0 ? (
        <p className="muted">还没有战绩，先去打一局吧！</p>
      ) : (
        <ol className="history">
          {list.map((h) => (
            <li key={`${h.at}-${h.mode}-${h.rank}-${h.score}`}>
              <span>{new Date(h.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span>{MODE_LABEL[h.mode] ?? '对战'}</span>
              <span>第 {h.rank}/{h.total} 名</span>
              <span>得分 {h.score}</span>
              <span>淘汰 {h.kos}</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function DailyModal({ onClose }: { onClose(): void }) {
  return (
    <Modal title="每日奖励" onClose={onClose}>
      <div className="daily-grid">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} className="daily-cell">
            <span>第{d}天</span>
            <b>{d === 7 ? '🎁' : '🪙'}</b>
          </div>
        ))}
      </div>
      <p className="pending-note">签到和奖励发放尚未接入，以上只是样式预览，领取不会获得任何物品。</p>
      <button className="btn btn-yellow" disabled>领取（待接入）</button>
    </Modal>
  );
}

function TutorialModal({ onClose }: { onClose(): void }) {
  const steps = [
    { t: '移动', d: '手机：拖动左下角摇杆。电脑：WASD 或方向键。' },
    { t: '冲撞', d: '按住右下角拳头（电脑：空格）蓄力，松手朝面向的方向冲出去。蓄力时移动变慢。' },
    { t: '变大', d: '吃掉平台上的果冻块升级，最高 3 级。越大越重，越难被撞飞。' },
    { t: '变小', d: '被重重撞到会降一级，并掉出一块果冻。' },
    { t: '缩圈', d: '15 秒后平台每 8 秒缩小一次，红圈外的地砖会掉下去。' },
    { t: '胜负', d: '掉出平台就淘汰。60 秒结束或只剩一人时结算。' },
  ];
  return (
    <Modal title="新手教程" onClose={onClose}>
      <ol className="tutorial">
        {steps.map((s) => (
          <li key={s.t}>
            <b>{s.t}</b>
            <span>{s.d}</span>
          </li>
        ))}
      </ol>
      <p className="muted">皮肤稀有度：{Object.values(RARITY_LABEL).join(' / ')}（仅外观，不影响属性）</p>
    </Modal>
  );
}
