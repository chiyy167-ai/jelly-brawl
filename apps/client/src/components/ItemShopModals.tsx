/** 道具商城（购买/装备开局携带）与图鉴列表。 */
import { useState, useSyncExternalStore } from 'react';
import { GAME } from '../game/config';
import { ITEM_DEFS, TIER_LABEL, type ItemDef } from '../game/itemCatalog';
import {
  bagCount, buyItem, equipItem, loadLoadout, loadoutVersion, subscribeLoadout,
} from '../state/loadout';
import { exchangeGem, loadProgress, progressVersion, subscribeProgress } from '../state/progress';
import { IconCoin, IconGem } from './icons';
import { ItemIcon } from './itemIcons';
import { Modal } from './Modal';

function useWalletAndBag() {
  useSyncExternalStore(subscribeProgress, progressVersion, progressVersion);
  useSyncExternalStore(subscribeLoadout, loadoutVersion, loadoutVersion);
  return { prog: loadProgress(), load: loadLoadout() };
}

function TierBadge({ tier }: { tier: ItemDef['tier'] }) {
  return <span className={`item-tier tier-${tier}`}>{TIER_LABEL[tier]}</span>;
}

function PriceTag({ def }: { def: ItemDef }) {
  return (
    <span className="item-price">
      {def.currency === 'gems' ? <IconGem size={16} /> : <IconCoin size={16} />}
      {def.price}
    </span>
  );
}

export function ShopModal({ onClose }: { onClose(): void }) {
  const { prog, load } = useWalletAndBag();
  const cost = GAME.economy.gemCostCoins;
  const [msg, setMsg] = useState('');
  const equipped = load.equipped;

  return (
    <Modal title="商城 · 开局道具" onClose={onClose}>
      <p className="muted currency-inline">
        当前：<IconCoin size={18} />{prog.coins}
        <IconGem size={18} />{prog.gems}
      </p>
      <p className="pending-note">
        买进背包后点「装备」，下一场对战开局自动带上（仅第一局，用掉扣 1 个）。
        传说道具仅能用宝石买。皮肤仍全部免费试用。
      </p>

      {equipped ? (
        <p className="loadout-ready">
          已装备开局：
          <ItemIcon kind={equipped} size={22} />
          {ITEM_DEFS.find((d) => d.id === equipped)?.name}
          <button type="button" className="linkish" onClick={() => { equipItem(null); setMsg('已取消装备'); }}>
            取消
          </button>
        </p>
      ) : (
        <p className="muted">尚未装备开局道具</p>
      )}

      <div className="shop-item-list">
        {ITEM_DEFS.map((def) => {
          const n = bagCount(def.id);
          const canBuy = def.currency === 'coins' ? prog.coins >= def.price : prog.gems >= def.price;
          const isEq = equipped === def.id;
          return (
            <div key={def.id} className={`shop-item-row ${isEq ? 'is-eq' : ''}`}>
              <div className="shop-item-ico" style={{ background: `#${def.color.toString(16).padStart(6, '0')}` }}>
                <ItemIcon kind={def.id} size={28} />
              </div>
              <div className="shop-item-body">
                <div className="shop-item-head">
                  <b>{def.name}</b>
                  <TierBadge tier={def.tier} />
                  <PriceTag def={def} />
                </div>
                <p>{def.tip}</p>
                <span className="shop-bag">背包 ×{n}</span>
              </div>
              <div className="shop-item-acts">
                <button
                  type="button"
                  className="btn btn-blue"
                  disabled={!canBuy}
                  onClick={() => setMsg(buyItem(def.id) ?? `已购买 ${def.name}`)}
                >
                  购买
                </button>
                <button
                  type="button"
                  className={`btn ${isEq ? 'btn-yellow' : 'btn-gray'}`}
                  disabled={n < 1}
                  onClick={() => {
                    if (isEq) {
                      equipItem(null);
                      setMsg('已取消装备');
                      return;
                    }
                    setMsg(equipItem(def.id) ?? `已装备 ${def.name}`);
                  }}
                >
                  {isEq ? '已装备' : '装备'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <hr className="auth-hr" />
      <h3 className="auth-title">兑换</h3>
      <button
        className="btn btn-blue"
        disabled={prog.coins < cost}
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

export function ItemsGuideModal({ onClose }: { onClose(): void }) {
  return (
    <Modal title="道具图鉴" onClose={onClose}>
      <p className="muted">
        场上只掉神秘道具箱；开箱随机获得下列之一。也可在商城用金币/宝石预购，开局带进第一局。
      </p>
      <div className="codex-list">
        {ITEM_DEFS.map((def) => (
          <article key={def.id} className="codex-card">
            <div className="codex-ico" style={{ background: `#${def.color.toString(16).padStart(6, '0')}` }}>
              <ItemIcon kind={def.id} size={28} />
            </div>
            <div className="codex-body">
              <div className="shop-item-head">
                <b>{def.name}</b>
                <TierBadge tier={def.tier} />
              </div>
              <p className="codex-tip">{def.tip}</p>
              <p className="muted">{def.desc}</p>
              <p className="codex-buy">
                商城：
                {def.currency === 'gems' ? <><IconGem size={14} />{def.price}（仅宝石）</> : <><IconCoin size={14} />{def.price}</>}
              </p>
            </div>
          </article>
        ))}
      </div>
    </Modal>
  );
}
