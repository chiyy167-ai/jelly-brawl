/** 大厅弹窗：联机、战绩、每日奖励、教程、设置、商城。 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GAME } from '../game/config';
import { RARITY_LABEL } from '../data/skins';
import { isBgmMuted, isMuted, setBgmMuted, setMuted, unlockAudio } from '../game/audio';
import { auth } from '../state/auth';
import { fetchCloudHistory } from '../state/cloudHistory';
import {
  canClaimDaily, claimDaily, exchangeGem, loadProgress, progressVersion, subscribeProgress,
} from '../state/progress';
import { loadHistory, type HistoryEntry } from '../state/storage';
import { AuthPanel } from './AuthPanel';
import { Modal } from './Modal';
import { MultiModal } from './MultiModal';

export type LobbyModal = 'multi' | 'rank' | 'daily' | 'tutorial' | 'items' | 'settings' | 'shop' | null;

const MODE_LABEL = { practice: '练习', match: '对战', online: '联机' } as const;
const ITEM_GUIDE_URL = `${import.meta.env.BASE_URL}images/item-guide.jpg`;

export function LobbyModals({ which, onClose, roomCode }: { which: LobbyModal; onClose(): void; roomCode?: string }) {
  if (which === 'multi') return <MultiModal onClose={onClose} initialCode={roomCode} />;
  if (which === 'rank') return <RankModal onClose={onClose} />;
  if (which === 'daily') return <DailyModal onClose={onClose} />;
  if (which === 'tutorial') return <TutorialModal onClose={onClose} />;
  if (which === 'items') return <ItemsGuideModal onClose={onClose} />;
  if (which === 'settings') return <SettingsModal onClose={onClose} />;
  if (which === 'shop') return <ShopModal onClose={onClose} />;
  return null;
}

function SettingsModal({ onClose }: { onClose(): void }) {
  const [sfxOff, setSfxOff] = useState(isMuted);
  const [bgmOff, setBgmOff] = useState(isBgmMuted);
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
      <AuthPanel />
      <hr className="auth-hr" />
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

function ShopModal({ onClose }: { onClose(): void }) {
  useSyncExternalStore(subscribeProgress, progressVersion, progressVersion);
  const p = loadProgress();
  const cost = GAME.economy.gemCostCoins;
  const [msg, setMsg] = useState('');
  return (
    <Modal title="商城" onClose={onClose}>
      <p className="muted">当前：{p.coins} 金币 · {p.gems} 宝石</p>
      <p className="pending-note">皮肤仍可全部免费试用。暂无真实支付；可用金币兑换宝石。</p>
      <button
        className="btn btn-blue"
        disabled={p.coins < cost}
        onClick={() => {
          const next = exchangeGem();
          setMsg(next ? `兑换成功：-${cost} 金币，+1 宝石` : '金币不足');
        }}
      >
        {cost} 金币 → 1 宝石
      </button>
      {msg && <p className="muted">{msg}</p>}
    </Modal>
  );
}

function TutorialModal({ onClose }: { onClose(): void }) {
  const steps = [
    { t: '移动与冲撞', d: '摇杆移动；按住右下拳头蓄力，松手冲刺。' },
    { t: '变大变小', d: '吃黄块升级；被重击降级并掉块。' },
    { t: '缩圈', d: '15 秒后每 8 秒缩小，掉出平台即淘汰。' },
    { t: '神秘道具箱', d: '场上会掉金色道具箱，捡起随机开出火箭、护盾、跳板、地雷等。详见「道具图鉴」。' },
    { t: '幽灵布丁', d: '淘汰后变幽灵，冷却好后按冲在摇杆方向放布丁挡路。' },
    { t: '三局赛', d: '正式对战与联机打满 3 局累计分，并列加赛。练习只打 1 局。' },
    { t: '成长', d: '结算得 XP / 金币 / 宝石；大厅可领每日奖励，商城可用金币换宝石。' },
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
      <p className="muted">皮肤稀有度：{Object.values(RARITY_LABEL).join(' / ')}（仅外观）</p>
    </Modal>
  );
}

function ItemsGuideModal({ onClose }: { onClose(): void }) {
  return (
    <Modal title="道具图鉴" onClose={onClose}>
      <p className="muted">场上只掉神秘道具箱；开箱后随机获得下列道具之一。</p>
      <div className="item-guide">
        <img src={ITEM_GUIDE_URL} alt="果冻擂台道具设计图：神秘箱与各类道具效果说明" />
      </div>
    </Modal>
  );
}
