/** 换装面板：10 套预设 + 眼睛 / 嘴巴 / 头饰分项。 */
import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  EYES, GEARS, MOUTHS, OUTFITS, lookFromOutfit, lookKey, type CosmeticLook,
} from '../data/cosmetics';
import { JellyStageView } from './JellyStageView';
import { loadOutfit, outfitVersion, saveOutfit, subscribeOutfit } from '../state/outfit';

const VIEW = { y: 1.6, z: 5.2, lookY: 0.75, fov: 32 };

export function OutfitPanel({ skinId }: { skinId: string }) {
  useSyncExternalStore(subscribeOutfit, outfitVersion, outfitVersion);
  const saved = loadOutfit();
  const [draft, setDraft] = useState<CosmeticLook>(saved);
  const [tab, setTab] = useState<'set' | 'eye' | 'mouth' | 'gear'>('set');
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
          <p>眼睛、嘴巴和头饰可分开挑，也可一键套用下方 10 套造型。</p>
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
          ['eye', '眼睛'],
          ['mouth', '嘴巴'],
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

      {tab === 'eye' && (
        <div className="outfit-chips">
          {EYES.map((e) => (
            <button key={e.id} type="button" className={draft.eye === e.id ? 'on' : ''} onClick={() => apply({ eye: e.id })}>
              {e.name}
            </button>
          ))}
        </div>
      )}
      {tab === 'mouth' && (
        <div className="outfit-chips">
          {MOUTHS.map((m) => (
            <button key={m.id} type="button" className={draft.mouth === m.id ? 'on' : ''} onClick={() => apply({ mouth: m.id })}>
              {m.name}
            </button>
          ))}
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
