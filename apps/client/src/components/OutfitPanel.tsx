/** 换装面板：套装和头饰。眼睛、嘴巴用模型原有的。 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  GEARS, OUTFITS, lookFromOutfit, lookKey, type CosmeticLook,
} from '../data/cosmetics';
import { JellyStageView } from './JellyStageView';
import { loadOutfit, outfitVersion, saveOutfit, subscribeOutfit } from '../state/outfit';

const VIEW = { y: 1.6, z: 5.2, lookY: 0.75, fov: 32 };

export function OutfitPanel({ skinId }: { skinId: string }) {
  useSyncExternalStore(subscribeOutfit, outfitVersion, outfitVersion);
  const saved = loadOutfit();
  const [draft, setDraft] = useState<CosmeticLook>(saved);
  const [tab, setTab] = useState<'set' | 'gear'>('set');
  const dirty = lookKey(draft) !== lookKey(saved);

  const stage = useMemo(
    () => [{ skinId, look: draft, x: 0, z: 0, size: 2.3, yaw: 0 }],
    [skinId, draft],
  );

  const apply = (patch: Partial<CosmeticLook>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="outfit-panel">
      <section className="skin-preview">
        <JellyStageView className="skin-stage" items={stage} view={VIEW} draggable />
        <div className="skin-info">
          <div className="skin-name"><b>我的换装</b></div>
          <p>眼睛和嘴巴用角色模型原来的。这里只换头饰，也可以一键套用造型。</p>
          <button
            className={`btn ${dirty ? 'btn-yellow' : 'btn-gray'}`}
            disabled={!dirty}
            onClick={() => saveOutfit(draft)}
          >
            {dirty ? '保存换装' : '已保存'}
          </button>
        </div>
      </section>

      <nav className="skin-tabs outfit-tabs" aria-label="换装分类">
        {([
          ['set', '套装'],
          ['gear', '道具'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`skin-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'set' && (
        <div className="outfit-grid">
          {OUTFITS.map((o) => {
            const look = lookFromOutfit(o.id);
            const on = lookKey(draft) === lookKey(look);
            return (
              <button
                key={o.id}
                type="button"
                className={`outfit-card ${on ? 'selected' : ''}`}
                onClick={() => setDraft(look)}
              >
                <b>{o.name}</b>
                <span>{o.desc}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === 'gear' && (
        <div className="outfit-chips">
          {GEARS.map((g) => (
            <button key={g.id} type="button" className={draft.gear === g.id ? 'on' : ''} onClick={() => apply({ gear: g.id })}>
              {g.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
