/** 逐项检查 11 种道具：释放后状态、位移或碰撞是否符合设计。 */
import { GAME } from '../../client/src/game/config';
import { createMatch, stepMatch } from '../../client/src/game/sim';
import type { InputCmd, ItemKind, Jelly, MatchState } from '../../client/src/game/types';

const dt = GAME.fixedDt;
const idle: InputCmd = { x: 0, y: 0, charge: false };
const fails: string[] = [];

function say(ok: boolean, name: string, detail: string): void {
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}  ${detail}`);
  if (!ok) fails.push(name);
}

function setLevel(j: Jelly, level: number): void {
  j.level = level;
  const lv = GAME.levels[level - 1];
  j.radius = lv.radius;
  j.mass = lv.mass;
  j.speed = lv.speed;
  j.impact = lv.impact;
  j.resist = lv.resist;
}

function quiet(): { s: MatchState; me: Jelly; foe: Jelly } {
  const s = createMatch('practice', 'classic', 7);
  s.phase = 'play';
  s.countdown = 0;
  s.time = 1;
  s.events = [];
  s.holes = [];
  s.hazards = [];
  s.itemAcc = 0;
  s.candies.forEach((c) => { c.alive = false; });
  s.blobs.forEach((b) => { b.alive = false; });
  const me = s.jellies[0];
  const foe = s.jellies[1];
  s.jellies.forEach((j, i) => {
    const ang = (i / s.jellies.length) * Math.PI * 2;
    j.alive = true;
    j.item = null;
    j.itemB = null;
    j.vx = j.vy = 0;
    j.fallY = 0;
    j.fallVy = 0;
    j.freezeT = j === me ? 0 : 30;
    j.x = Math.cos(ang) * 6;
    j.y = Math.sin(ang) * 6;
    j.gloveMul = 1;
    j.shield = j.rocket = j.star = j.magnet = j.airT = j.dizzy = 0;
    setLevel(j, 1);
  });
  me.x = 0;
  me.y = 0;
  me.facing = 0;
  return { s, me, foe };
}

function run(s: MatchState, n: number, cmd: InputCmd = idle): void {
  for (let i = 0; i < n; i += 1) stepMatch(s, { 0: cmd }, dt);
}

function use(s: MatchState): void {
  stepMatch(s, { 0: { x: 0, y: 0, charge: false, use: true } }, dt);
}

function dash(s: MatchState, holdSteps: number): void {
  const hold: InputCmd = { x: 0, y: 0, charge: true };
  run(s, holdSteps, hold);
  run(s, 1, idle);
}

const sec = (t: number) => Math.round(t / dt);

// 火箭：立刻加速，持续约 2.2 秒
{
  const plain = quiet();
  run(plain.s, sec(0.6), { x: 1, y: 0, charge: false });
  const base = Math.hypot(plain.me.x, plain.me.y);
  const hot = quiet();
  hot.me.item = 'rocket';
  use(hot.s);
  const dur = hot.me.rocket;
  run(hot.s, sec(0.6), { x: 1, y: 0, charge: false });
  const gone = Math.hypot(hot.me.x, hot.me.y);
  say(hot.me.item === null && dur > 2 && dur < 2.3 && gone > base * 1.25, '冲刺火箭', `持续 ${dur.toFixed(2)}s 位移 ${gone.toFixed(2)} > ${base.toFixed(2)}`);
}

// 护盾：重击不降级，被撞开的速度更小
function smack(shield: boolean): { level: number; speed: number } {
  const { s, me, foe } = quiet();
  setLevel(me, 2);
  setLevel(foe, 2);
  if (shield) {
    me.item = 'shield';
    use(s);
  }
  me.x = 0;
  me.y = 0;
  me.vx = me.vy = 0;
  foe.freezeT = 0;
  foe.x = me.radius + foe.radius - 0.08;
  foe.y = 0;
  foe.vx = -28;
  foe.vy = 0;
  run(s, 1);
  return { level: me.level, speed: Math.hypot(me.vx, me.vy) };
}
{
  const bare = smack(false);
  const safe = smack(true);
  say(safe.level === 2 && bare.level === 1 && safe.speed < bare.speed * 0.85, '护盾', `裸 Lv${bare.level} 速 ${bare.speed.toFixed(1)} / 盾 Lv${safe.level} 速 ${safe.speed.toFixed(1)}`);
}

// 跳板：布置后踩上离地
{
  const { s, me } = quiet();
  me.item = 'pad';
  use(s);
  const placed = s.hazards.some((h) => h.kind === 'pad');
  run(s, sec(GAME.items.pad.arm + 0.15));
  say(placed && me.airT > 0 && me.fallY > 0.4, '弹跳跳板', `离地 ${me.fallY.toFixed(2)} air ${me.airT.toFixed(2)}`);
}

// 体型果块 / 蛋糕：升 1 级；满级不再升，但道具会花掉
function grow(kind: 'grow' | 'cake', from: number): number {
  const { s, me } = quiet();
  setLevel(me, from);
  me.item = kind;
  use(s);
  return me.level;
}
say(grow('grow', 1) === 2 && grow('grow', 3) === 3, '体型果块', `1→${grow('grow', 1)} 满级 ${grow('grow', 3)}`);
say(grow('cake', 1) === 2 && grow('cake', 2) === 3, '美味蛋糕', `1→${grow('cake', 1)} 2→${grow('cake', 2)}`);

// 磁力：果冻块被吸近
{
  const { s, me } = quiet();
  const blob = s.blobs[0];
  blob.alive = true;
  blob.x = 4;
  blob.y = 0;
  me.item = 'magnet';
  use(s);
  const dur = me.magnet;
  run(s, sec(0.8));
  say(me.item === null && dur > 4.5 && blob.x < 3.2, '磁力糖果', `持续 ${dur.toFixed(2)}s 果冻块 x ${blob.x.toFixed(2)}`);
}

// 香蕉皮：踩到后眩晕
{
  const { s, me } = quiet();
  me.item = 'banana';
  use(s);
  run(s, sec(GAME.items.banana.arm + 0.1));
  say(me.dizzy >= 1, '香蕉皮', `眩晕 ${me.dizzy.toFixed(2)}s`);
}

// 地雷：别人踩上被炸开
{
  const { s, me, foe } = quiet();
  me.item = 'mine';
  use(s);
  const mine = s.hazards.find((h) => h.kind === 'mine');
  me.x = 5;
  me.y = 0;
  run(s, sec(GAME.items.mine.arm + 0.05));
  if (mine) {
    foe.freezeT = 0;
    foe.x = mine.x;
    foe.y = mine.y;
    foe.vx = foe.vy = 0;
  }
  const before = Math.hypot(foe.vx, foe.vy);
  run(s, 2);
  const after = Math.hypot(foe.vx, foe.vy);
  say(!!mine && after > before + 8, '地雷', `炸开速度 ${after.toFixed(1)}`);
}

// 雪球：按下不消耗，冲刺命中后冻结
{
  const { s, me, foe } = quiet();
  me.item = 'snow';
  use(s);
  const armed = me.item === 'snow' && me.gloveMul > 1;
  foe.freezeT = 0;
  foe.x = me.radius + foe.radius - 0.05;
  foe.y = 0;
  foe.vx = foe.vy = 0;
  dash(s, sec(0.5));
  say(armed && foe.freezeT > 1.5 && me.item !== 'snow', '冰冻雪球', `冻结 ${foe.freezeT.toFixed(2)}s 手持 ${me.item}`);
}

// 能量星：移速和冲刺力度都更高
{
  const plain = quiet();
  dash(plain.s, sec(0.8));
  const baseDash = Math.hypot(plain.me.vx, plain.me.vy);
  const hot = quiet();
  hot.me.item = 'star';
  use(hot.s);
  const dur = hot.me.star;
  dash(hot.s, sec(0.8));
  const starDash = Math.hypot(hot.me.vx, hot.me.vy);
  say(hot.me.item === null && dur > 3.5 && starDash > baseDash * 1.2, '能量星', `持续 ${dur.toFixed(2)}s 冲刺 ${starDash.toFixed(1)} > ${baseDash.toFixed(1)}`);
}

// 拳套：按下留着，下一次冲刺击退更大，然后消耗
{
  const plain = quiet();
  plain.foe.freezeT = 0;
  plain.foe.x = plain.me.radius + plain.foe.radius - 0.05;
  plain.foe.y = 0;
  dash(plain.s, sec(0.6));
  const base = Math.hypot(plain.foe.vx, plain.foe.vy);
  const hot = quiet();
  hot.me.item = 'glove';
  use(hot.s);
  const armed = hot.me.item === 'glove' && hot.me.gloveMul > 2;
  hot.foe.freezeT = 0;
  hot.foe.x = hot.me.radius + hot.foe.radius - 0.05;
  hot.foe.y = 0;
  dash(hot.s, sec(0.6));
  const punched = Math.hypot(hot.foe.vx, hot.foe.vy);
  say(armed && hot.me.item !== 'glove' && punched > base * 1.3, '拳击手套', `击退 ${punched.toFixed(1)} > ${base.toFixed(1)}`);
}

// 两槽：用掉当前槽后备用递上来
{
  const { s, me } = quiet();
  me.item = 'shield';
  me.itemB = 'rocket';
  use(s);
  say(me.shield > 0 && me.item === 'rocket' && me.itemB === null, '双槽递补', `${me.item}/${me.itemB} 盾 ${me.shield.toFixed(2)}`);
}

// 开箱会进空槽，并带上道具特效
{
  const { s, me } = quiet();
  s.candies.push({ id: 99, x: 0, y: 0, t: 1, alive: true });
  run(s, 1);
  const kinds: ItemKind[] = ['rocket', 'shield', 'pad', 'grow', 'magnet', 'banana', 'mine', 'snow', 'star', 'glove', 'cake'];
  say(!!me.item && kinds.includes(me.item) && s.fx.some((e) => e.type === 'item'), '开箱', `得到 ${me.item}`);
}

console.log(fails.length ? `失败 ${fails.join('、')}` : '11 种道具和开箱都通过');
process.exit(fails.length ? 1 : 0);
