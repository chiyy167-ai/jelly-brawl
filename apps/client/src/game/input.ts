/** 本地输入：虚拟摇杆 / 冲撞按钮写入这里，键盘（WASD、方向键、空格）也会合并进来。 */
import type { InputCmd } from './types';

export interface InputSource {
  /** 摇杆方向，长度 0~1 */
  stickX: number;
  stickY: number;
  /** 冲撞按钮是否按住 */
  dashHeld: boolean;
  /** 技能键点按，读走前一直为 true */
  useQueued: boolean;
  /** 切换两个道具槽，读走前一直为 true */
  swapQueued: boolean;
}

export function createInput(): InputSource {
  return { stickX: 0, stickY: 0, dashHeld: false, useQueued: false, swapQueued: false };
}

const keys = new Set<string>();
/** 点按沿：松手太快时，按住状态会在下一帧读走前被清掉 */
let useEdge = false;
let swapEdge = false;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const USE_KEYS = ['KeyE', 'Digit1', 'Numpad1'];
const SWAP_KEYS = ['KeyQ', 'Digit2', 'Numpad2'];

function onKey(e: KeyboardEvent, down: boolean): void {
  const code = e.code;
  if (![...MOVE_KEYS, ...USE_KEYS, ...SWAP_KEYS].includes(code)) return;
  e.preventDefault();
  if (down) {
    keys.add(code);
    if (e.repeat) return;
    if (USE_KEYS.includes(code)) useEdge = true;
    if (SWAP_KEYS.includes(code)) swapEdge = true;
  } else keys.delete(code);
}
const down = (e: KeyboardEvent) => onKey(e, true);
const up = (e: KeyboardEvent) => onKey(e, false);

/** 暂停或失焦时丢掉按住的键，避免恢复后突然释放 */
export function releaseKeys(): void {
  keys.clear();
  useEdge = false;
  swapEdge = false;
}

/** 开始监听键盘，返回取消监听的函数 */
export function bindKeyboard(): () => void {
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', releaseKeys);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', releaseKeys);
    releaseKeys();
  };
}

/** 合并触屏与键盘。use 保留到调用方取走。 */
export function readCmd(src: InputSource): InputCmd {
  let x = src.stickX;
  let y = src.stickY;
  const kx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const ky = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (kx || ky) {
    const len = Math.hypot(kx, ky);
    x = kx / len;
    y = ky / len;
  }
  if (useEdge) {
    src.useQueued = true;
    useEdge = false;
  }
  if (swapEdge) {
    src.swapQueued = true;
    swapEdge = false;
  }
  return { x, y, charge: src.dashHeld || keys.has('Space'), use: src.useQueued, swap: src.swapQueued };
}
