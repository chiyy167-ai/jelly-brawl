/**
 * WebAudio 合成音效 + 简易 BGM，不加载音频文件（手机流量友好）。
 * iOS / 微信需先在用户点击后 unlock。
 */
import { bgmOf, type BgmId } from './bgmTracks';
import type { FxEvent, MapId } from './types';

const MUTE_KEY = 'jelly-brawl.mute';
const BGM_KEY = 'jelly-brawl.bgm-mute';

/** 总音量。原先单音峰值约 0.08，手机外放几乎听不见。 */
const MASTER = 5.5;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let muted = false;
let bgmMuted = false;
let bgmTimer = 0;
let bgmOn = false;
let bgmNext = 0;
let bgmCursor = 0;
let bgmKick = 0;
let bgmMap: BgmId = 'lobby';
const musicNodes: OscillatorNode[] = [];
let unlocked = false;

const BEAT = 0.5;
/** 120 BPM 的八分音符。每首 120 个八分音符 = 30 秒。 */
const STEP = BEAT / 2;

try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
  bgmMuted = localStorage.getItem(BGM_KEY) === '1';
} catch {
  // 隐私模式
}

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** 放大后再轻微压缩，避免多音叠在一起破音 */
function output(): AudioNode {
  const audio = ac();
  if (!bus) {
    bus = audio.createGain();
    bus.gain.value = MASTER;
    const comp = audio.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.12;
    bus.connect(comp);
    comp.connect(audio.destination);
    return bus;
  }
  return bus;
}

export function unlockAudio(): void {
  const audio = ac();
  if (audio.state === 'suspended') void audio.resume();
  if (unlocked) return;
  unlocked = true;
  // 极短静音，唤醒部分 WebView
  tone(40, 0.01, 'sine', 0.0001);
}

export function isMuted(): boolean {
  return muted;
}

export function isBgmMuted(): boolean {
  return bgmMuted;
}

export function setMuted(v: boolean): void {
  muted = v;
  if (v) stopChargeCue();
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    // 忽略
  }
}

export function setBgmMuted(v: boolean): void {
  bgmMuted = v;
  try {
    localStorage.setItem(BGM_KEY, v ? '1' : '0');
  } catch {
    // 忽略
  }
  if (v) stopBgm();
  else startBgm(bgmMap);
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide?: number): void {
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(amp).connect(output());
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let chargeOsc: OscillatorNode | null = null;
let chargeAmp: GainNode | null = null;
let chargeFull = false;

function stopChargeCue(): void {
  const osc = chargeOsc;
  const amp = chargeAmp;
  chargeOsc = null;
  chargeAmp = null;
  chargeFull = false;
  if (!osc || !amp || !ctx) return;
  const t = ctx.currentTime;
  amp.gain.cancelScheduledValues(t);
  amp.gain.setValueAtTime(Math.max(0.0001, amp.gain.value), t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  osc.stop(t + 0.06);
}

/** 按住蓄力时持续升调，蓄满叮一声。松手或静音立刻停。 */
export function syncChargeCue(charging: boolean, amount: number): void {
  if (!charging || muted) { stopChargeCue(); return; }
  unlockAudio();
  const audio = ac();
  if (!chargeOsc || !chargeAmp) {
    chargeOsc = audio.createOscillator();
    chargeAmp = audio.createGain();
    chargeOsc.type = 'triangle';
    chargeOsc.frequency.value = 220;
    chargeAmp.gain.value = 0.0001;
    chargeOsc.connect(chargeAmp).connect(output());
    chargeOsc.start();
    chargeFull = false;
  }
  const k = Math.min(1, Math.max(0, amount));
  const t = audio.currentTime;
  chargeOsc.frequency.setTargetAtTime(220 * 3 ** k, t, 0.04);
  chargeAmp.gain.setTargetAtTime(0.032, t, 0.03);
  if (k >= 0.99 && !chargeFull) { chargeFull = true; tone(980, 0.08, 'square', 0.04); }
}

export const sfx = {
  dash: () => tone(260, 0.14, 'triangle', 0.07, 90),
  hit: () => tone(150, 0.1, 'square', 0.05, 70),
  heavy: () => {
    tone(90, 0.18, 'square', 0.08, 50);
    tone(180, 0.12, 'sawtooth', 0.04, 60);
  },
  eat: () => tone(660, 0.1, 'sine', 0.055, 990),
  item: () => {
    tone(660, 0.07, 'triangle', 0.05);
    setTimeout(() => tone(880, 0.1, 'triangle', 0.045), 60);
  },
  fall: () => tone(320, 0.26, 'triangle', 0.06, 70),
  shrink: () => tone(200, 0.22, 'sawtooth', 0.04, 120),
  tick: () => tone(880, 0.06, 'square', 0.035),
  go: () => tone(523, 0.14, 'triangle', 0.06, 784),
  win: () => {
    tone(523, 0.12, 'triangle', 0.06);
    setTimeout(() => tone(659, 0.12, 'triangle', 0.06), 100);
    setTimeout(() => tone(784, 0.18, 'triangle', 0.07), 200);
  },
};

/** 对局特效 → 音效 */
export function playFx(e: FxEvent): void {
  if (e.type === 'hit') (e.heavy ? sfx.heavy : sfx.hit)();
  else if (e.type === 'eat') sfx.eat();
  else if (e.type === 'fall') sfx.fall();
  else if (e.type === 'shrink') sfx.shrink();
  else if (e.type === 'dash') sfx.dash();
  else if (e.type === 'item') sfx.item();
}

/** 首页是邀请曲。换地图才切曲，同一首不重开。 */
export function startBgm(id: BgmId = 'lobby'): void {
  if (id !== bgmMap) {
    bgmMap = id;
    bgmCursor = 0;
    bgmNext = 0;
    for (const osc of musicNodes) {
      try { osc.stop(); } catch { /* 已经结束 */ }
    }
    musicNodes.length = 0;
    if (bgmTimer) {
      clearTimeout(bgmTimer);
      bgmTimer = 0;
    }
  } else if (bgmOn && bgmTimer) return;
  if (bgmMuted) return;
  unlockAudio();
  bgmOn = true;
  const audio = ac();
  const kick = ++bgmKick;
  const run = () => {
    if (kick !== bgmKick || !bgmOn || !ctx || bgmTimer) return;
    if (bgmNext < ctx.currentTime) bgmNext = ctx.currentTime + 0.06;
    pumpBgm();
  };
  if (audio.state === 'running') run();
  else void audio.resume().then(run);
}

export function stopBgm(): void {
  bgmOn = false;
  bgmKick += 1;
  if (bgmTimer) {
    clearTimeout(bgmTimer);
    bgmTimer = 0;
  }
  // 已经排进时间线的音符也马上停，否则关掉后还会响一两秒
  for (const osc of musicNodes) {
    try { osc.stop(); } catch { /* 已经结束 */ }
  }
  musicNodes.length = 0;
}

export function startBattleBgm(id: MapId = 'candy'): void {
  startBgm(id);
}

export function stopBattleBgm(): void {
  stopBgm();
}

function midiHz(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}

/** 背景音乐不跟音效静音走 */
function musicNote(freq: number, when: number, dur: number, type: OscillatorType, gain: number, attack = 0.02): void {
  if (!ctx || bgmMuted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + Math.min(attack, dur * 0.45));
  amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(amp).connect(output());
  osc.start(when);
  osc.stop(when + dur + 0.02);
  musicNodes.push(osc);
  osc.onended = () => {
    const i = musicNodes.indexOf(osc);
    if (i >= 0) musicNodes.splice(i, 1);
  };
}

function pumpBgm(): void {
  if (!bgmOn || bgmMuted || !ctx) return;
  const song = bgmOf(bgmMap);
  const hot = song.drive === 'hot';
  const warm = song.drive === 'warm';
  const horizon = ctx.currentTime + 1.4;
  const steps = song.melody.length;
  while (bgmNext < horizon) {
    const i = bgmCursor % steps;
    const note = song.melody[i];
    const slot = i % 8;
    if (note) {
      const wave = hot ? 'sawtooth' : warm ? 'sine' : 'triangle';
      const gain = hot ? 0.022 : warm ? 0.026 : 0.03;
      musicNote(midiHz(note), bgmNext, warm ? STEP * 1.2 : STEP * 0.95, wave, gain, warm ? 0.04 : 0.012);
      if (warm && slot % 4 === 0) musicNote(midiHz(note - 12), bgmNext, STEP * 2, 'triangle', 0.012, 0.05);
    }
    const root = song.bass[Math.floor(i / 8)] ?? song.bass[0];
    const fifth = root + 7;
    const onPulse = warm ? slot === 0 || slot === 4 : slot % 2 === 0;
    if (onPulse) {
      const pulse = slot === 0 || slot === 4 ? root : fifth;
      musicNote(midiHz(pulse), bgmNext, STEP * 1.6, hot ? 'square' : 'sine', hot ? 0.014 : warm ? 0.016 : 0.02, 0.02);
      musicNote(midiHz(pulse - 12), bgmNext, STEP * 1.6, 'sine', hot ? 0.02 : 0.014, 0.02);
    }
    if (hot && slot % 4 === 0) musicNote(46, bgmNext, 0.09, 'sine', 0.05, 0.004);
    if (song.drive === 'soft' && slot % 4 === 0) musicNote(midiHz(96), bgmNext, 0.06, 'triangle', 0.012, 0.004);
    if (hot && (slot === 2 || slot === 6)) {
      musicNote(190, bgmNext, 0.06, 'square', 0.012, 0.004);
      musicNote(320, bgmNext, 0.05, 'triangle', 0.008, 0.004);
    }
    bgmCursor += 1;
    bgmNext += STEP;
  }
  if (bgmTimer) clearTimeout(bgmTimer);
  bgmTimer = window.setTimeout(pumpBgm, 280);
}
