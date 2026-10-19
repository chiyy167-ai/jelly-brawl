/** 对局状态机、固定步长主循环和计分。渲染不在这里发生。 */
import { config } from './config.js';
import { makeRng } from './rng.js';
import { applyStats, stepPhysics } from './physics.js';
import { planEvents, stepEvents, applyGravity } from './events.js';
import { stepItems, stepBlobs } from './items.js';
import { thinkAi } from './ai.js';
import { sfx } from './audio.js';
import { burst } from './render.js';

export function createState(seed = 1) {
  const state = {
    phase: 'MENU', round: 1, roundTime: 0, count: 3, time: 0, seed,
    rng: makeRng(seed), platform: { radius: config.platform.maxRadius, angle: 0 },
    players: Array.from({ length: 6 }, (_, index) => blank(index)),
    blobs: Array.from({ length: 6 }, () => ({ alive: false })),
    items: Array.from({ length: 4 }, () => ({ alive: false, z: 0 })),
    puddings: Array.from({ length: 8 }, () => ({ alive: false, kind: 'pudding', mass: 4, radius: config.ghost.puddingRadius, life: 0, vx: 0, vy: 0 })),
    particles: Array.from({ length: 160 }, () => ({ alive: false })),
    holes: [], events: [], event: null, banner: '', bannerT: 0, iceT: 0, smokeT: 0,
    gravPulse: null, hitStop: 0, shake: 0, slowT: 0, itemT: 4, blobT: 1,
    scores: [0, 0, 0, 0, 0, 0], lastPlaces: [], titles: [], message: '',
    role: 'solo', hostId: 'local', code: '', roster: [],
  };
  state.players[0].on = true;
  state.players.forEach(applyStats);
  return state;
}

function blank(index) {
  return {
    on: false, id: `p${index}`, index, name: `果冻${index + 1}`, isAI: false, color: index, skin: 'normal',
    x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, facing: 0, level: 1, alive: true, ghost: false,
    charge: 0, charging: false, cool: 0, dashT: 0, shield: 0, magnet: 0, spring: false, smoke: 0,
    item: '', lastHitBy: '', lastHitTime: -9, elimTime: 99, eaten: 0, hits: 0, falls: 0, dashes: 0,
    dizzy: 0, pop: 0, hurtCd: 0, wish: null, aiT: 0, ghostCd: 0, justDash: false, justHit: false, justEat: false,
    justUp: false, justDown: false, justElim: false, justItem: false,
  };
}

export function soloMatch(state, profile) {
  Object.assign(state, createState((Math.random() * 1e9) >>> 0));
  state.players[0].on = true;
  state.players[0].id = 'local';
  state.players[0].name = profile.name;
  state.players[0].color = profile.color;
  state.players[0].skin = profile.skin;
  for (let i = 1; i <= 3; i += 1) {
    state.players[i].on = true;
    state.players[i].isAI = true;
    state.players[i].name = `小果冻${i}`;
  }
  beginRound(state);
}

export function onlineMatch(state, seed) {
  state.seed = seed;
  state.rng = makeRng(seed);
  state.round = 1;
  state.scores = [0, 0, 0, 0, 0, 0];
  beginRound(state);
}

export function frame(state, dt, input, net) {
  if (state.role !== 'client') tickMeta(state, dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
  if (state.slowT > 0) state.slowT -= dt;
  if (state.phase !== 'PLAYING' && state.phase !== 'COUNTDOWN') { state.acc = 0; return; }
  if (state.hitStop > 0) { state.hitStop -= dt; return; }
  state.acc = (state.acc || 0) + dt * (state.slowT > 0 ? config.juice.slowScale : 1);
  const step = 1 / config.fixedHz;
  let guard = 0;
  while (state.acc >= step && guard < 5) {
    snapshot(state);
    fixed(state, step, input, net);
    state.acc -= step;
    guard += 1;
  }
}

function snapshot(state) {
  for (const player of state.players) { player.prevX = player.x; player.prevY = player.y; }
}

function fixed(state, dt, input, net) {
  if (state.role === 'client') return;
  if (state.phase === 'COUNTDOWN') return countdown(state, dt);
  if (state.phase !== 'PLAYING') return;
  state.time += dt;
  state.roundTime += dt;
  const local = state.players.find((player) => player.id === (state.role === 'solo' ? 'local' : net.selfId));
  for (const player of state.players) {
    if (!player.on || player.isAI) continue;
    if (player === local) player.wish = input;
    else if (net.inputs[player.id]) player.wish = net.inputs[player.id];
  }
  thinkAi(state, dt);
  for (const player of state.players) if (player.on && player.alive) clearFlags(player);
  if (local?.ghost && input.tap) placePudding(state, local, screenToWorld(input.tap.x, input.tap.y));
  stepEvents(state, dt);
  applyGravity(state, dt);
  stepItems(state, dt);
  stepBlobs(state, dt);
  for (const player of state.players) if (player.on) applyStats(player);
  stepPhysics(state, dt);
  reactions(state);
  if (state.roundTime >= config.platform.roundTime || aliveCount(state) <= 1) finishRound(state);
}

function countdown(state, dt) {
  const prev = Math.ceil(state.count);
  state.count -= dt;
  if (Math.ceil(state.count) !== prev) sfx.tick();
  if (state.count <= 0) { state.phase = 'PLAYING'; state.roundTime = 0; }
}

function placePudding(state, player, tap) {
  if (player.ghostCd > 0) return;
  const slot = state.puddings.find((item) => !item.alive || item.life <= 0);
  if (!slot) return;
  slot.alive = true;
  slot.life = config.ghost.puddingLife;
  slot.x = tap.worldX;
  slot.y = tap.worldY;
  slot.vx = 0; slot.vy = 0;
  player.ghostCd = config.ghost.puddingCd;
}

export function screenToWorld(px, py) {
  const scale = 1.15;
  return { worldX: (px - 360) / scale, worldY: (py - config.logicalHeight * 0.46) / scale };
}

function reactions(state) {
  for (const player of state.players) {
    if (!player.on) continue;
    if (player.justDash) { player.dashes += 1; sfx.dash(); }
    if (player.justHit) { player.hits += 1; sfx.hit(); burst(state, player.x, player.y, '#fff', 8); vibrate(); }
    if (player.justEat || player.justItem) sfx.eat();
    if (player.justUp || player.justDown) burst(state, player.x, player.y, config.colors[player.color], 10);
    if (player.justElim) {
      player.falls += 1;
      sfx.out();
      burst(state, player.x, player.y, config.colors[player.color], 16);
      awardLastHit(state, player);
    }
    player.ghostCd = Math.max(0, player.ghostCd - 1 / config.fixedHz);
    if (player.shield <= 0 && player.magnet <= 0 && player.smoke <= 0 && !player.spring) player.item = '';
  }
}

function awardLastHit(state, player) {
  if (state.time - player.lastHitTime > config.score.lastHitWindow) return;
  const source = state.players.find((item) => item.id === player.lastHitBy && item.id !== player.id);
  if (source) { state.scores[source.index] += config.score.lastHit; source.hits += 1; }
}

function finishRound(state) {
  const ranked = rank(state);
  state.lastPlaces = ranked.map((player) => player.index);
  ranked.forEach((player, place) => { state.scores[player.index] += config.score.places[place] || 0; });
  state.titles = titles(state);
  state.phase = 'ROUND_END';
  state.endT = 3.2;
  sfx.win();
}

export function tickMeta(state, dt) {
  if (state.phase !== 'ROUND_END') return;
  state.endT -= dt;
  if (state.endT > 0) return;
  const more = state.round < config.score.rounds || tied(state);
  if (more) { state.round += 1; beginRound(state); }
  else state.phase = 'SCOREBOARD';
}

function beginRound(state) {
  state.phase = 'COUNTDOWN';
  state.count = 3;
  state.roundTime = 0;
  state.platform.radius = config.platform.maxRadius;
  state.platform.angle = 0;
  state.holes = [];
  state.events = planEvents(state.rng);
  state.event = null;
  state.blobs.forEach((item) => { item.alive = false; });
  state.items.forEach((item) => { item.alive = false; });
  state.puddings.forEach((item) => { item.alive = false; });
  const ons = state.players.filter((player) => player.on);
  ons.forEach((player, index) => {
    const angle = (Math.PI * 2 * index) / ons.length;
    player.x = Math.cos(angle) * 80; player.y = Math.sin(angle) * 80;
    player.prevX = player.x; player.prevY = player.y;
    player.vx = 0; player.vy = 0; player.level = 1; player.alive = true; player.ghost = false;
    player.eaten = 0; player.hits = 0; player.falls = 0; player.dashes = 0;
    applyStats(player);
  });
}

function rank(state) {
  return state.players.filter((player) => player.on).sort((a, b) => {
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (a.alive && b.alive && a.level !== b.level) return b.level - a.level;
    if (a.alive && b.alive) return Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y);
    return b.elimTime - a.elimTime;
  });
}

function titles(state) {
  const ons = state.players.filter((player) => player.on);
  const top = (key) => ons.slice().sort((a, b) => b[key] - a[key])[0];
  return [[top('falls'), '最爱自爆'], [top('hits'), '撞人狂魔'], [top('eaten'), '吃货果冻'], [top('dashes'), '蓄力达人']]
    .filter(([player, title]) => player && player[title === '最爱自爆' ? 'falls' : title === '撞人狂魔' ? 'hits' : title === '吃货果冻' ? 'eaten' : 'dashes'] > 0)
    .map(([player, title]) => `${player.name} · ${title}`);
}

function tied(state) {
  const best = Math.max(...state.scores);
  return state.scores.filter((score) => score === best).length > 1;
}

function aliveCount(state) {
  return state.players.filter((player) => player.on && player.alive && !player.ghost).length;
}

function clearFlags(player) {
  player.justDash = player.justHit = player.justEat = player.justUp = false;
  player.justDown = player.justElim = player.justItem = false;
}

function vibrate() {
  navigator.vibrate?.(18);
}
