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
let bgmStep = 0;
let unlocked = false;

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
  if (unlocked) return;
  unlocked = true;
  const audio = ac();
  if (audio.state === 'suspended') void audio.resume();
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
  if (v) stopBattleBgm();
}

export function setBgmMuted(v: boolean): void {
  bgmMuted = v;
  try {
    localStorage.setItem(BGM_KEY, v ? '1' : '0');
  } catch {
    // 忽略
  }
  if (v) stopBattleBgm();
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

/** 对战 BGM：轻快琶音循环，不抢音效 */
export function startBattleBgm(): void {
  stopBattleBgm();
  if (muted || bgmMuted) return;
  unlockAudio();
  const notes = [262, 330, 392, 523, 392, 330, 294, 349];
  bgmStep = 0;
  const beat = () => {
    if (muted || bgmMuted || !ctx) return;
    const n = notes[bgmStep % notes.length];
    tone(n, 0.22, 'triangle', 0.035);
    tone(n / 2, 0.28, 'sine', 0.02);
    bgmStep += 1;
    bgmTimer = window.setTimeout(beat, 280);
  };
  beat();
}

export function stopBattleBgm(): void {
  if (bgmTimer) {
    clearTimeout(bgmTimer);
    bgmTimer = 0;
  }
}
