/** 选决斗场：在开始游戏 / 单人 / 多人之后弹出。 */
import { useEffect, useState } from 'react';
import { startBgm } from '../game/audio';
import { MAPS, MAP_IDS } from '../game/maps';
import type { MapId } from '../game/types';
import { useApp } from '../state/AppState';
import { Modal } from './Modal';

const BLURB: Record<MapId, string> = {
  candy: '马卡龙地砖、棒棒糖与棉花糖浮岛。音乐轻快明亮。',
  volcano: '熔岩地砖、侧后方火山喷烟与熔岩河。音乐更热血。',
};

export type MapPickNext = 'match' | 'practice' | 'multi';

export function MapPickModal({
  next,
  onClose,
  onPicked,
}: {
  next: MapPickNext;
  onClose(): void;
  onPicked(mapId: MapId): void;
}) {
  const { state } = useApp();
  const [pick, setPick] = useState<MapId>(state.mapId);
  useEffect(() => { startBgm(pick); }, [pick]);
  const title = next === 'practice' ? '单人练习 · 选地图' : next === 'multi' ? '多人对战 · 选地图' : '开始游戏 · 选地图';

  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">选好决斗场再继续。每张地图有自己的背景音乐，玩法规则相同。</p>
      <div className="map-pick-grid">
        {MAP_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={`map-card map-card-${id} ${pick === id ? 'is-on' : ''}`}
            onClick={() => setPick(id)}
          >
            <strong>{MAPS[id].name}</strong>
            <span>{BLURB[id]}</span>
          </button>
        ))}
      </div>
      <button
        className="btn btn-yellow btn-big"
        type="button"
        onClick={() => onPicked(pick)}
      >
        {next === 'multi' ? '下一步：联机房间' : '进入决斗场'}
      </button>
    </Modal>
  );
}
