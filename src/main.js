/** 入口：视口、主循环、PWA 与联机接线。 */
import { config } from './config.js';
import { bindInput, sampleInput } from './input.js';
import { createState, frame, soloMatch, onlineMatch } from './game.js';
import { render } from './render.js';
import { mountUi, syncUi, drawQr } from './ui.js';
import { unlockAudio, toggleMute, isMuted, sfx } from './audio.js';
import { net, openRoom, pack, takeSnap, makeCode } from './net.js';
import { applyStats } from './physics.js';

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const ui = document.querySelector('#ui');
const state = createState(1);
const profile = loadProfile();
applyProfile();
let last = performance.now();
let snapClock = 0;

mountUi(ui, document.querySelector('#debug'), {
  solo: () => soloMatch(state, profile),
  host: () => host(),
  join: () => join(document.querySelector('#room-code').value),
  ready: () => net.sendMeta?.({ t: 'ready' }),
  start: () => startMatch(),
  menu: () => { state.phase = 'MENU'; },
  color: (event) => { profile.color = Number(event.target.dataset.value); saveProfile(); applyProfile(); builtRefresh(); },
  skin: (event) => { profile.skin = event.target.dataset.value; saveProfile(); applyProfile(); builtRefresh(); },
  field: (name, value) => { if (name === 'name') { profile.name = value.slice(0, 8); saveProfile(); applyProfile(); } },
});
bindInput(canvas, () => { unlockAudio(); if (!isMuted()) sfx.tick(); });
addEventListener('resize', fit);
fit();
requestAnimationFrame(loop);
registerSw();
const queryRoom = new URLSearchParams(location.search).get('room');
if (queryRoom) join(queryRoom);

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const input = sampleInput();
  if (state.role === 'client') {
    net.sendInput?.({ x: input.x, y: input.y, charge: input.charge, released: input.released, tap: input.tap });
    takeSnap(state);
    state.players.forEach((player) => { if (player.on) applyStats(player); });
  } else {
    frame(state, dt, input, net);
    snapClock += dt * 1000;
    if (state.role === 'host' && snapClock >= config.net.snapshotMs) {
      net.sendState?.(pack(state));
      snapClock = 0;
    }
  }
  render(ctx, state, state.acc ? state.acc * config.fixedHz : 1);
  syncUi(state, profile, net);
  if (state.role === 'host' && state.phase === 'ROUND_END' && !state.sentTitles) {
    net.sendMeta?.({ t: 'titles', titles: state.titles });
    state.sentTitles = true;
  }
  if (state.phase === 'PLAYING') state.sentTitles = false;
  if (state.phase === 'LOBBY') drawQr(roomUrl()).catch(() => { state.message = '二维码库加载失败'; });
  requestAnimationFrame(loop);
}

function resetShell() {
  Object.assign(state, createState(1));
  state.acc = 0;
  applyProfile();
}

async function host() {
  resetShell();
  state.role = 'host';
  state.code = makeCode();
  state.phase = 'LOBBY';
  state.players[0].id = 'pending';
  await openRoom(state.code);
  state.hostId = net.selfId;
  state.players[0].id = net.selfId;
  state.players[0].on = true;
  remember(net.selfId, profile);
  net.onJoin = () => broadcastRoster();
  net.onLeave = (peerId) => lose(peerId);
  net.onMeta = (data, peerId) => onMeta(data, peerId);
  broadcastRoster();
}

async function join(code) {
  const clean = code.trim().toUpperCase();
  if (clean.length !== 4) { state.message = '房间码为 4 位'; builtRefresh(); return; }
  resetShell();
  state.role = 'client';
  state.phase = 'LOBBY';
  state.code = clean;
  await openRoom(clean);
  state.players[0].id = net.selfId;
  net.onMeta = (data) => onMeta(data, net.selfId);
  net.onLeave = (peerId) => { if (peerId === state.hostId) failHost(); };
  net.sendMeta({ t: 'hi', name: profile.name, color: profile.color, skin: profile.skin });
}

function onMeta(data, peerId) {
  if (data.t === 'hi' && state.role === 'host') remember(peerId, data);
  if (data.t === 'ready') { const row = state.roster.find((item) => item.id === peerId); if (row) row.ready = true; }
  if (data.t === 'roster' && state.role === 'client') {
    state.roster = data.players;
    state.hostId = data.hostId;
    data.players.forEach((item, index) => copySlot(state.players[index], item));
  }
  if (data.t === 'start' && state.role === 'client') onlineMatch(state, data.seed);
  if (data.t === 'titles') state.titles = data.titles || [];
  if (state.role === 'host') broadcastRoster();
  builtRefresh();
}

function startMatch() {
  const count = state.roster.length;
  if (count < 2 || count > 6) { state.message = '需要 2 到 6 人'; builtRefresh(); return; }
  const seed = (Math.random() * 1e9) >>> 0;
  onlineMatch(state, seed);
  net.sendMeta({ t: 'start', seed });
}

function remember(id, data) {
  let row = state.roster.find((item) => item.id === id);
  if (!row) {
    const slot = state.players.find((item) => !item.on);
    if (!slot) return;
    slot.on = true;
    slot.id = id;
    row = { id, ready: id === net.selfId };
    state.roster.push(row);
  }
  row.name = data.name || '果冻';
  row.color = data.color || 0;
  row.skin = data.skin || 'normal';
  const slot = state.players.find((item) => item.id === id);
  copySlot(slot, row);
  applyStats(slot);
}

function copySlot(slot, row) {
  slot.on = true;
  slot.id = row.id;
  slot.name = row.name || slot.name;
  slot.color = row.color ?? slot.color;
  slot.skin = row.skin || 'normal';
  slot.isAI = false;
}

function lose(peerId) {
  const slot = state.players.find((item) => item.id === peerId);
  if (slot && state.phase === 'PLAYING') slot.isAI = true;
  else if (slot) slot.on = false;
  state.roster = state.roster.filter((item) => item.id !== peerId);
  broadcastRoster();
}

function failHost() {
  state.role = 'solo';
  state.phase = 'MENU';
  state.message = '房主已断开，已返回大厅';
  builtRefresh();
}

function broadcastRoster() {
  net.sendMeta?.({ t: 'roster', hostId: net.selfId, players: state.roster });
}

function roomUrl() {
  const url = new URL(location.href);
  url.searchParams.set('room', state.code);
  return url.href;
}

function applyProfile() {
  state.players[0].name = profile.name;
  state.players[0].color = profile.color;
  state.players[0].skin = profile.skin;
}

function loadProfile() {
  const saved = JSON.parse(localStorage.getItem('jelly-profile') || '{}');
  return { name: saved.name || '我', color: saved.color || 0, skin: saved.skin || 'normal' };
}

function saveProfile() {
  localStorage.setItem('jelly-profile', JSON.stringify(profile));
}

function builtRefresh() { state.message = state.message; }

function fit() {
  canvas.width = config.logicalWidth;
  canvas.height = config.logicalHeight;
}

function registerSw() {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          const toast = document.querySelector('#update');
          toast.hidden = false;
          toast.querySelector('button').onclick = () => {
            shouldReload = true;
            worker.postMessage('skip-waiting');
          };
        }
      });
    });
  });
  let shouldReload = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (shouldReload) location.reload(); });
  document.querySelector('#mute').onclick = (event) => { event.target.textContent = toggleMute() ? '声音关' : '声音开'; };
}
