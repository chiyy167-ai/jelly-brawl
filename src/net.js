/** Trystero 0.26.0 房主权威联机。TURN 配置见 NETWORK_NOTES.md。 */
import { config } from './config.js';

const CDN = 'https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';
const PHASES = ['MENU', 'LOBBY', 'COUNTDOWN', 'PLAYING', 'ROUND_END', 'SCOREBOARD'];
const BANNERS = ['', '平台旋转', '塌方预警', '地面塌了', '冰面', '重力波', '即将吸向中心', '即将向外推开'];
export const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const net = { role: 'solo', selfId: '', code: '', inputs: {}, pings: {}, room: null, buffer: [], wait: [] };

export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return [...bytes].map((value) => ALPHABET[value % ALPHABET.length]).join('');
}

export async function openRoom(code) {
  const { joinRoom } = await import(CDN);
  const room = joinRoom({ appId: config.net.appId, rtcConfig: { iceServers: ICE_SERVERS } }, code);
  net.room = room;
  net.selfId = room.selfId;
  net.code = code;
  const meta = room.makeAction('meta');
  const input = room.makeAction('input');
  const stateAction = room.makeAction('state');
  net.sendMeta = (data) => meta.send(data);
  net.sendInput = (data) => input.send(data);
  net.sendState = (data) => stateAction.send(data);
  meta.onMessage = (data, info) => net.onMeta?.(data, info.peerId);
  input.onMessage = (data, info) => { net.inputs[info.peerId] = data; };
  stateAction.onMessage = (data) => net.wait.push({ at: performance.now() + net.lag, data });
  room.onPeerJoin = (peerId) => { net.onJoin?.(peerId); ping(peerId); };
  room.onPeerLeave = (peerId) => net.onLeave?.(peerId);
  net.lag = Number(new URLSearchParams(location.search).get('lag') || 0);
}

async function ping(peerId) {
  const timer = setInterval(async () => {
    if (!net.room) return clearInterval(timer);
    try { net.pings[peerId] = await net.room.ping(peerId); } catch { /* 对手还没连上 */ }
  }, 2000);
}

export function pack(state) {
  const data = [state.time, PHASES.indexOf(state.phase), state.round, state.roundTime, state.platform.radius, state.platform.angle, state.seed, state.iceT, state.smokeT];
  for (const player of state.players) data.push(player.on ? 1 : 0, player.x, player.y, player.vx, player.vy, player.level, player.alive ? 1 : 0, player.ghost ? 1 : 0, player.charge, player.facing, state.scores[player.index]);
  for (const blob of state.blobs) data.push(blob.alive ? 1 : 0, blob.x, blob.y);
  for (const item of state.items) data.push(item.alive ? 1 : 0, item.x, item.y, item.z);
  data.push(Math.max(0, BANNERS.indexOf(state.banner)), state.bannerT, state.holes.length);
  for (const hole of state.holes) data.push(hole.angle, hole.width);
  return data;
}

export function takeSnap(state) {
  const now = performance.now();
  while (net.wait.length && net.wait[0].at <= now) net.buffer.push(net.wait.shift());
  if (net.buffer.length > 8) net.buffer.shift();
  const ready = net.buffer.filter((item) => item.at <= now - Math.max(80, net.lag));
  if (ready.length < 1) return;
  const b = ready[ready.length - 1];
  const a = ready[ready.length - 2] || b;
  const span = b.at - a.at || 1;
  const alpha = Math.min(1, Math.max(0, (now - Math.max(80, net.lag) - a.at) / span));
  apply(state, a.data, b.data, alpha);
}

function apply(state, older, newer, alpha) {
  let cursor = 0;
  const read = (list) => list[cursor++];
  state.time = read(newer);
  state.phase = PHASES[read(newer)] || state.phase;
  state.round = read(newer);
  state.roundTime = read(newer);
  state.platform.radius = read(newer);
  state.platform.angle = read(newer);
  state.seed = read(newer);
  state.iceT = read(newer);
  state.smokeT = read(newer);
  state.players.forEach((player, index) => {
    const base = 9 + index * 11;
    player.on = newer[base] === 1;
    player.prevX = mix(older[base + 1], newer[base + 1], alpha);
    player.prevY = mix(older[base + 2], newer[base + 2], alpha);
    player.x = player.prevX;
    player.y = player.prevY;
    player.vx = newer[base + 3];
    player.vy = newer[base + 4];
    player.level = newer[base + 5];
    player.alive = newer[base + 6] === 1;
    player.ghost = newer[base + 7] === 1;
    player.charge = newer[base + 8];
    player.facing = newer[base + 9];
    state.scores[index] = newer[base + 10];
  });
  cursor = 9 + 66;
  state.blobs.forEach((blob) => { blob.alive = read(newer) === 1; blob.x = read(newer); blob.y = read(newer); });
  state.items.forEach((item) => { item.alive = read(newer) === 1; item.x = read(newer); item.y = read(newer); item.z = read(newer); });
  state.banner = BANNERS[read(newer)] || '';
  state.bannerT = read(newer);
  const holes = read(newer);
  state.holes.length = 0;
  for (let i = 0; i < holes; i += 1) state.holes.push({ angle: read(newer), width: read(newer) });
}

function mix(a, b, t) { return (a ?? b) + ((b ?? a) - (a ?? b)) * t; }
