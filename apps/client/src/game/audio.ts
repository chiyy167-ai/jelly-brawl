/**
 * WebAudio 合成音效 + 简易 BGM，不加载音频文件（手机流量友好）。
 * iOS / 微信需先在用户点击后 unlock。
 */
import type { FxEvent } from './types';

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
let bgmKick = 0;
const musicNodes: OscillatorNode[] = [];
let unlocked = false;

const BEAT = 0.36;
/** 8 拍循环：拍点、MIDI。大调小旋律，不使用现成曲子。 */
const MELODY: Array<[number, number]> = [
  [0, 76], [0.5, 79], [1, 81], [1.5, 79],
  [2, 76], [2.5, 74], [3, 72], [3.5, 74],
  [4, 76], [4.5, 79], [5, 84], [5.5, 81],
  [6, 79], [6.5, 76], [7, 74], [7.5, 72],
];
const BASS = [48, 45, 53, 43];

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
  else startBgm();
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

export const sfx = {
  charge: () => tone(180, 0.16, 'sawtooth', 0.035, 520),
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

/** 对战 / 大厅 BGM：已在播就不重开，避免旋律被打断 */
export function startBgm(): void {
  if (bgmMuted) return;
  if (bgmOn && bgmTimer) return;
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

export function startBattleBgm(): void {
  startBgm();
}

export function stopBattleBgm(): void {
  stopBgm();
}

function midiHz(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}

/** 背景音乐不跟音效静音走 */
function musicNote(freq: number, when: number, dur: number, type: OscillatorType, gain: number): void {
  if (!ctx || bgmMuted) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  amp.gain.setValueAtTime(0.0001, when);
  amp.gain.exponentialRampToValueAtTime(gain, when + 0.03);
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
  const horizon = ctx.currentTime + 1.4;
  const loop = BEAT * 8;
  while (bgmNext < horizon) {
    for (const [step, note] of MELODY) {
      musicNote(midiHz(note), bgmNext + step * BEAT, BEAT * 0.9, 'triangle', 0.036);
    }
    BASS.forEach((note, i) => {
      const at = bgmNext + i * 2 * BEAT;
      musicNote(midiHz(note), at, BEAT * 1.9, 'sine', 0.028);
      musicNote(midiHz(note + 12), at, BEAT * 1.7, 'sine', 0.012);
    });
    bgmNext += loop;
  }
  if (bgmTimer) clearTimeout(bgmTimer);
  bgmTimer = window.setTimeout(pumpBgm, 500);
}
