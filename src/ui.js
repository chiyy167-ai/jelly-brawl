/** 大厅、结算和调试面板。对局画面仍由 canvas 绘制。 */
import { config } from './config.js';

let root;
let debug;
let built = '';

export function mountUi(uiRoot, debugRoot, actions) {
  root = uiRoot;
  debug = debugRoot;
  root.addEventListener('click', (event) => {
    const act = event.target.dataset.act;
    if (act) actions[act](event);
  });
  root.addEventListener('change', (event) => {
    if (event.target.dataset.field) actions.field(event.target.dataset.field, event.target.value);
  });
  if (new URLSearchParams(location.search).has('debug')) buildDebug();
}

export function syncUi(state, profile, net) {
  const key = `${state.phase}|${state.code}|${state.message}|${profile.color}|${profile.skin}|${profile.name}|${rosterKey(state)}|${state.titles.join(',')}|${state.round}`;
  if (key === built) return;
  built = key;
  root.innerHTML = screen(state, profile, net);
  root.style.pointerEvents = state.phase === 'PLAYING' || state.phase === 'COUNTDOWN' ? 'none' : 'auto';
}

function screen(state, profile, net) {
  if (state.phase === 'MENU') return menu(profile, state.message);
  if (state.phase === 'LOBBY') return lobby(state, net);
  if (state.phase === 'ROUND_END' || state.phase === 'SCOREBOARD') return board(state);
  return '';
}

function menu(profile, message) {
  const colors = config.colors.map((color, index) =>
    `<button data-act="color" data-value="${index}" style="background:${color}" class="${profile.color === index ? 'on' : ''}"></button>`).join('');
  const skins = config.skins.map((skin) =>
    `<button data-act="skin" data-value="${skin}" class="${profile.skin === skin ? 'on' : ''}">${skin}</button>`).join('');
  return `<section class="card"><h1>Jelly Brawl</h1><p>果冻擂台</p>
    <input data-field="name" value="${profile.name}" maxlength="8">
    <div class="row">${colors}</div><div class="row skins">${skins}</div>
    <button data-act="solo">单人练习</button>
    <button data-act="host">创建房间</button>
    <input id="room-code" placeholder="房间码" maxlength="4">
    <button data-act="join">加入房间</button>
    <p class="warn">${message || ''}</p></section>`;
}

function lobby(state, net) {
  const rows = state.roster.map((player) =>
    `<li>${player.name} ${player.ready ? '已准备' : '未准备'} ${Math.round(net.pings[player.id] || 0)}ms</li>`).join('');
  return `<section class="card"><h1>房间 ${state.code}</h1><canvas id="qr" width="180" height="180"></canvas>
    <ul>${rows}</ul><button data-act="ready">准备</button>
    ${state.role === 'host' ? '<button data-act="start">开始</button>' : ''}</section>`;
}

function board(state) {
  const lines = state.players.filter((player) => player.on).map((player) =>
    `<li>${player.name}　${state.scores[player.index]} 分</li>`).join('');
  const titles = state.titles.map((title) => `<p>${title}</p>`).join('');
  const again = state.phase === 'SCOREBOARD' ? '<button data-act="menu">返回</button>' : '<p>下一局即将开始</p>';
  return `<section class="card"><h1>${state.phase === 'SCOREBOARD' ? '最终比分' : '本局结束'}</h1><ul>${lines}</ul>${titles}${again}</section>`;
}

function rosterKey(state) {
  return state.roster.map((player) => `${player.id}:${player.ready}`).join(';');
}

function buildDebug() {
  debug.hidden = false;
  const fields = ['charge.maxForce', 'charge.maxTime', 'charge.cooldown', 'physics.friction', 'physics.restitution', 'charge.heavyImpact'];
  debug.innerHTML = `<button data-act="fold" type="button">调参</button><div id="fold">${fields.map((path) =>
    `<label>${path}<input data-path="${path}" value="${read(path)}"></label>`).join('')}</div>`;
  debug.addEventListener('click', (event) => {
    if (event.target.dataset.act === 'fold') debug.classList.toggle('shut');
  });
  debug.addEventListener('change', (event) => {
    const path = event.target.dataset.path;
    if (!path) return;
    const [group, key] = path.split('.');
    config[group][key] = Number(event.target.value);
  });
}

function read(path) {
  const [group, key] = path.split('.');
  return config[group][key];
}

export async function drawQr(text) {
  const canvas = document.querySelector('#qr');
  if (!canvas || canvas.dataset.done === text) return;
  await loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js');
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const img = new Image();
  img.onload = () => {
    canvas.getContext('2d').drawImage(img, 0, 0, 180, 180);
    canvas.dataset.done = text;
  };
  img.src = qr.createDataURL(4);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.qrcode) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
