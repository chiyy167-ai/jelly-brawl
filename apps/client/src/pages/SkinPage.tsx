/** 皮肤体色 + 换装（头饰）。眼睛和嘴巴用模型原有的。 */
import { useMemo, useState } from 'react';
import { JellyStageView } from '../components/JellyStageView';
import { OutfitPanel } from '../components/OutfitPanel';
import { SkyBackground } from '../components/SkyBackground';
import { RARITY_LABEL, SKINS, getSkin, type SkinRarity } from '../data/skins';
import { renderThumbnails } from '../game/stage';
import { useApp } from '../state/AppState';
import { loadOutfit } from '../state/outfit';

type MainTab = 'body' | 'outfit';
type RarityTab = 'all' | SkinRarity;

const RARITY_TABS: { id: RarityTab; label: string; color: string }[] = [
  { id: 'all', label: '全部', color: '#b07cff' },
  { id: 'normal', label: RARITY_LABEL.normal, color: '#5fd35a' },
  { id: 'rare', label: RARITY_LABEL.rare, color: '#2ea8ff' },
  { id: 'epic', label: RARITY_LABEL.epic, color: '#c25cff' },
  { id: 'legend', label: RARITY_LABEL.legend, color: '#ffb21f' },
];
const VIEW = { y: 1.6, z: 5.2, lookY: 0.75, fov: 32 };

export function SkinPage() {
  const { state, dispatch } = useApp();
  const [main, setMain] = useState<MainTab>('outfit');
  const [tab, setTab] = useState<RarityTab>('all');
  const [preview, setPreview] = useState(state.skinId);
  const look = loadOutfit();
  const thumbs = useMemo(() => renderThumbnails(SKINS.map((s) => s.id)), []);
  const list = SKINS.filter((s) => tab === 'all' || s.rarity === tab);
  const skin = getSkin(preview);
  const equipped = preview === state.skinId;

  return (
    <div className="page skin-page">
      <SkyBackground />
      <header className="skin-head">
        <button className="back-btn" onClick={() => dispatch({ type: 'goLobby' })} aria-label="返回大厅">‹</button>
        <h1 className="tag-title">换装中心</h1>
      </header>

      <nav className="skin-tabs main-tabs" aria-label="换装大类">
        <button type="button" className={`skin-tab ${main === 'outfit' ? 'active' : ''}`} onClick={() => setMain('outfit')}>
          脸与道具
        </button>
        <button type="button" className={`skin-tab ${main === 'body' ? 'active' : ''}`} onClick={() => setMain('body')}>
          果冻体色
        </button>
      </nav>

      {main === 'outfit' ? (
        <div className="skin-body">
          <OutfitPanel skinId={state.skinId} />
          <p className="skin-foot">眼睛和嘴巴用模型原来的。头饰是程序化占位，后续可换成独立 glb。体色在另一页签。</p>
        </div>
      ) : (
        <div className="skin-body">
          <nav className="skin-tabs" aria-label="皮肤分类">
            {RARITY_TABS.map((t) => (
              <button key={t.id} className={`skin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <i style={{ background: t.color }} />
                {t.label}
              </button>
            ))}
          </nav>

          <section className="skin-preview">
            <JellyStageView
              className="skin-stage"
              items={[{ skinId: preview, look, x: 0, z: 0, size: 2.3, yaw: 0 }]}
              view={VIEW}
              draggable
            />
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
          <p className="skin-foot">体色与换装互相独立。拖动预览可旋转。</p>
        </div>
      )}
    </div>
  );
}
