/** 大厅弹窗：联机、战绩、每日奖励、教程、设置、商城。 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GAME } from '../game/config';
import { isBgmMuted, isMuted, setBgmMuted, setMuted, sfx, unlockAudio } from '../game/audio';
import { currentAccount, logoutAccount } from '../state/account';
import { auth } from '../state/auth';
import { useApp } from '../state/AppState';
import { fetchCloudHistory } from '../state/cloudHistory';
import {
  canClaimDaily, claimDaily, loadProgress, progressVersion, subscribeProgress,
} from '../state/progress';
import { loadHistory, type HistoryEntry } from '../state/storage';
import { AuthPanel } from './AuthPanel';
import { ItemsGuideModal, ShopModal } from './ItemShopModals';
import { Modal } from './Modal';
import { MultiModal } from './MultiModal';

export type LobbyModal = 'multi' | 'rank' | 'daily' | 'tutorial' | 'items' | 'settings' | 'shop' | null;

const MODE_LABEL = { practice: '练习', match: '对战', online: '联机', tutorial: '教程' } as const;

export function LobbyModals({
  which, onClose, roomCode, onStartTutorial,
}: {
  which: LobbyModal;
  onClose(): void;
  roomCode?: string;
  onStartTutorial?(): void;
}) {
  if (which === 'multi') return <MultiModal onClose={onClose} initialCode={roomCode} />;
  if (which === 'rank') return <RankModal onClose={onClose} />;
  if (which === 'daily') return <DailyModal onClose={onClose} />;
  if (which === 'tutorial') return <TutorialModal onClose={onClose} onStart={onStartTutorial} />;
  if (which === 'items') return <ItemsGuideModal onClose={onClose} />;
  if (which === 'settings') return <SettingsModal onClose={onClose} />;
  if (which === 'shop') return <ShopModal onClose={onClose} />;
  return null;
}

function SettingsModal({ onClose }: { onClose(): void }) {
  const { dispatch } = useApp();
  const email = currentAccount();
  const [sfxOff, setSfxOff] = useState(isMuted);
  const [bgmOff, setBgmOff] = useState(isBgmMuted);
  // 打开设置时响一声，方便确认音量
  useEffect(() => {
    if (isMuted()) return;
    unlockAudio();
    sfx.go();
  }, []);
  return (
    <Modal title="设置" onClose={onClose}>
      <h3 className="auth-title">声音</h3>
      <div className="sound-toggles">
        <button
          type="button"
          className={`sound-toggle ${sfxOff ? '' : 'on'}`}
          onClick={() => {
            unlockAudio();
            const next = !sfxOff;
            setMuted(next);
            setSfxOff(next);
          }}
        >
          音效：{sfxOff ? '关' : '开'}
        </button>
        <button
          type="button"
          className={`sound-toggle ${bgmOff ? '' : 'on'}`}
          onClick={() => {
            unlockAudio();
            const next = !bgmOff;
            setBgmMuted(next);
            setBgmOff(next);
          }}
        >
          背景音乐：{bgmOff ? '关' : '开'}
        </button>
      </div>
      <p className="muted">音效用手机扬声器实时合成，不额外下载音频文件。</p>
      <hr className="auth-hr" />
      <h3 className="auth-title">账号</h3>
      {email && (
        <>
          <p className="auth-email">本机已登录：<b>{email}</b></p>
          <button
            className="btn btn-gray"
            onClick={() => {
              logoutAccount();
              onClose();
              dispatch({ type: 'needAuth' });
            }}
          >
            退出登录
          </button>
        </>
      )}
      <AuthPanel />
      <hr className="auth-hr" />
      <p className="legal-links">
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>隐私政策</a>
        <span>·</span>
        <a href={`${import.meta.env.BASE_URL}terms.html`}>使用条款</a>
      </p>
      <p className="muted">版本：网页版 0.4（音效 + 对撞手感调整）</p>
    </Modal>
  );
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
  useSyncExternalStore(subscribeProgress, progressVersion, progressVersion);
  const ready = canClaimDaily();
  const e = GAME.economy;
  const [msg, setMsg] = useState('');
  return (
    <Modal title="每日奖励" onClose={onClose}>
      <div className="daily-grid">
        <div className="daily-cell">
          <span>今日</span>
          <b>🪙{e.dailyCoins}</b>
        </div>
        <div className="daily-cell">
          <span>额外</span>
          <b>💎{e.dailyGems}</b>
        </div>
      </div>
      <p className="muted">每天可领取一次（按本机日期）。已领：{loadProgress().lastDaily || '从未'}</p>
      {msg && <p className="pending-note">{msg}</p>}
      <button
        className="btn btn-yellow"
        disabled={!ready}
        onClick={() => {
          const p = claimDaily();
          setMsg(p ? `已领取 +${e.dailyCoins} 金币、+${e.dailyGems} 宝石` : '今天已经领过了');
        }}
      >
        {ready ? '领取今日奖励' : '今日已领取'}
      </button>
    </Modal>
  );
}

function TutorialModal({ onClose, onStart }: { onClose(): void; onStart?(): void }) {
  return (
    <Modal title="新手教程" onClose={onClose}>
      <p className="muted">大约 1 分钟的引导对局：只有 1 个很乖的电脑靶子，没有道具和随机事件。</p>
      <ol className="tutorial">
        <li><b>移动</b><span>摇杆或 WASD</span></li>
        <li><b>变大</b><span>吃掉场上的果冻块</span></li>
        <li><b>冲撞</b><span>按住拳头蓄力，松手冲出去</span></li>
        <li><b>缩圈</b><span>站在红圈内，别掉下去</span></li>
      </ol>
      <p className="muted">正式对战里还有神秘道具箱、幽灵布丁、三局赛等，引导里先不打扰你。</p>
      <button
        type="button"
        className="btn btn-yellow btn-big"
        onClick={() => {
          onClose();
          onStart?.();
        }}
      >
        开始引导对局
      </button>
    </Modal>
  );
}
