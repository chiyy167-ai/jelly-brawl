/** 05 皮肤页：分类筛选、3D 预览、选中并保存（首版静态数据，无商城/支付）。 */
import { useMemo, useState } from 'react';
import { JellyStageView } from '../components/JellyStageView';
import { SkyBackground } from '../components/SkyBackground';
import { RARITY_LABEL, SKINS, getSkin, type SkinRarity } from '../data/skins';
import { renderThumbnails } from '../game/stage';
import { useApp } from '../state/AppState';

type Tab = 'all' | SkinRarity;
const TABS: { id: Tab; label: string; color: string }[] = [
  { id: 'all', label: '全部', color: '#b07cff' },
  { id: 'normal', label: RARITY_LABEL.normal, color: '#5fd35a' },
  { id: 'rare', label: RARITY_LABEL.rare, color: '#2ea8ff' },
  { id: 'epic', label: RARITY_LABEL.epic, color: '#c25cff' },
  { id: 'legend', label: RARITY_LABEL.legend, color: '#ffb21f' },
];
const VIEW = { y: 1.6, z: 5.2, lookY: 0.75, fov: 32 };

export function SkinPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<Tab>('all');
  const [preview, setPreview] = useState(state.skinId);
  const thumbs = useMemo(() => renderThumbnails(SKINS.map((s) => s.id)), []);
  const list = SKINS.filter((s) => tab === 'all' || s.rarity === tab);
  const skin = getSkin(preview);
  const equipped = preview === state.skinId;

  return (
    <div className="page skin-page">
      <SkyBackground />
      <header className="skin-head">
        <button className="back-btn" onClick={() => dispatch({ type: 'goLobby' })} aria-label="返回大厅">‹</button>
        <h1 className="tag-title">果冻皮肤</h1>
      </header>

      <div className="skin-body">
        <nav className="skin-tabs" aria-label="皮肤分类">
          {TABS.map((t) => (
            <button key={t.id} className={`skin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <i style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </nav>

        <section className="skin-preview">
          <JellyStageView className="skin-stage" items={[{ skinId: preview, x: 0, z: 0, size: 2.3, yaw: 0 }]} view={VIEW} draggable />
          <div className="skin-info">
            <div className="skin-name">
              <b>{skin.name}</b>
              <em className={`rarity rarity-${skin.rarity}`}>{RARITY_LABEL[skin.rarity]}</em>
            </div>
            <p>{skin.desc}</p>
            <button
              className={`btn ${equipped ? 'btn-yellow btn-used' : 'btn-yellow'}`}
              disabled={equipped}
              onClick={() => dispatch({ type: 'selectSkin', skinId: preview })}
            >
              {equipped ? '使用中' : '使用'}
            </button>
          </div>
        </section>

        <section className="skin-grid" aria-label="皮肤列表">
          {list.map((s) => (
            <button
              key={s.id}
              className={`skin-card ${preview === s.id ? 'selected' : ''}`}
              onClick={() => setPreview(s.id)}
              aria-pressed={preview === s.id}
            >
              {thumbs[s.id] && <img src={thumbs[s.id]} alt={s.name} />}
              <span>{s.name}</span>
              {state.skinId === s.id && <i className="skin-check" aria-label="使用中">✓</i>}
            </button>
          ))}
        </section>
      </div>
      <p className="skin-foot">首版所有皮肤免费试用，商城与解锁尚未接入。拖动预览可以旋转角色。</p>
    </div>
  );
}
