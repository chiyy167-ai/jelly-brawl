/** 06 结算页：系列赛名次、奖励，以及音效收尾。 */
import { useEffect, useMemo } from 'react';
import { JellyStageView } from '../components/JellyStageView';
import { SkyBackground } from '../components/SkyBackground';
import { sfx, stopBattleBgm } from '../game/audio';
import { renderThumbnails } from '../game/stage';
import { session } from '../net/session';
import { useApp } from '../state/AppState';

const VIEW = { y: 2.6, z: 9.5, lookY: 1.3, fov: 34 };
const PLACE_X = [0, -2.3, 2.3];
const CN_RANK = ['一', '二', '三', '四', '五', '六'];

export function ResultPage() {
  const { state, dispatch } = useApp();
  const r = state.result;
  const ranking = r?.ranking ?? [];
  const me = ranking.find((x) => x.isPlayer);
  const champ = ranking[0];
  const items = useMemo(
    () => ranking.slice(0, 3).map((e, i) => ({ skinId: e.skinId, x: PLACE_X[i], z: 0, size: i === 0 ? 1.9 : 1.4, podium: i + 1, yaw: 0 })),
    [ranking],
  );
  const avatar = useMemo(() => (me ? renderThumbnails([me.skinId])[me.skinId] : ''), [me]);
  const won = me?.rank === 1;
  const online = r?.mode === 'online';

  useEffect(() => {
    if (!r || !me) return;
    stopBattleBgm();
    if (won) sfx.win();
    else sfx.fall();
  }, [r, me, won]);

  if (!r || !me || !champ) {
    return (
      <div className="page result-page">
        <SkyBackground />
        <p className="muted">没有对局结果。</p>
        <button className="btn btn-yellow" onClick={() => dispatch({ type: 'goLobby' })}>返回大厅</button>
      </div>
    );
  }
  const leave = async () => {
    await session.leave();
    dispatch({ type: 'goLobby' });
  };
  const rw = r.rewards ?? { xp: 0, coins: 0, gems: 0 };
  return (
    <div className="page result-page">
      <SkyBackground />
      <span className="tag-title result-tag">
        {won ? '胜利结算' : '对局结算'}
        {r.mode === 'tutorial' ? ' · 新手教程' : r.mode === 'practice' ? ' · 练习' : r.mode === 'online' ? ' · 联机' : ' · 三局赛'}
        {r.roundsPlayed ? ` · ${r.roundsPlayed} 局` : ''}
      </span>
      <div className="result-main">
        <div className="result-left">
          <h1 className={`rank-title ${won ? 'rank-win' : ''}`}>第{CN_RANK[me.rank - 1] ?? me.rank}名</h1>
          <p className="champ-line">冠军：{champ.isPlayer ? '你！' : champ.name}</p>
          <JellyStageView className="result-stage" items={items} view={VIEW} />
        </div>
        <aside className="result-card">
          <div className="result-who">
            {avatar && <img src={avatar} alt="" />}
            <b>{me.name}</b>
            {won && <span aria-hidden>👑</span>}
          </div>
          <dl>
            <dt>名次</dt><dd>{me.rank} / {ranking.length}</dd>
            <dt>淘汰数</dt><dd>{me.kos}</dd>
            <dt>吃掉果冻</dt><dd>{me.eaten}</dd>
            <dt>累计分</dt><dd className="score">{me.score}</dd>
          </dl>
          <p className="reward-note">
            本场奖励：+{rw.xp} XP · +{rw.coins} 金币
            {rw.gems > 0 ? ` · +${rw.gems} 宝石` : ''}
          </p>
          {r.titles?.length > 0 && (
            <p className="titles-line">{r.titles.slice(0, 4).join('　')}</p>
          )}
          <ol className="mini-rank">
            {ranking.map((e) => (
              <li key={e.id} className={e.isPlayer ? 'me' : ''}>
                <span>{e.rank}</span>{e.name}<em>{e.score} 分</em>
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <div className="result-actions">
        {online ? (
          <>
            <button className="btn btn-blue" onClick={() => dispatch({ type: 'replay' })} disabled={!session.room}>回到房间</button>
            <button className="btn btn-yellow btn-big" onClick={leave}>离开房间</button>
          </>
        ) : (
          <>
            <button className="btn btn-blue" onClick={() => dispatch({ type: 'replay' })}>再来一场</button>
            <button className="btn btn-yellow btn-big" onClick={() => dispatch({ type: 'goLobby' })}>返回大厅</button>
          </>
        )}
      </div>
      {online && <p className="muted">房主再次开局时，会自动进入下一场三局赛。</p>}
      <p className="muted result-rule">每局名次分 4/2/1/0，最后一击 +1；打满 3 局累计，并列加赛。</p>
    </div>
  );
}
