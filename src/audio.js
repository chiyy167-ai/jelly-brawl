/** 用振荡器合成音效，不加载音频文件。 */
let ctx;
let muted = globalThis.localStorage?.getItem('jelly-mute') === '1';

function ac() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio() {
  const audio = ac();
  if (audio.state === 'suspended') audio.resume();
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('jelly-mute', muted ? '1' : '0');
  return muted;
}

export function isMuted() { return muted; }

function tone(freq, dur, type, gain, slide) {
  if (muted || !ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  charge() { tone(180, 0.18, 'sawtooth', 0.04, 520); },
  dash() { tone(240, 0.16, 'triangle', 0.08, 90); },
  hit() { tone(140, 0.12, 'square', 0.06, 70); },
  eat() { tone(660, 0.1, 'sine', 0.06, 990); },
  out() { tone(320, 0.28, 'triangle', 0.07, 80); },
  tick() { tone(880, 0.07, 'square', 0.04); },
  win() { tone(523, 0.16, 'triangle', 0.07, 784); },
};
