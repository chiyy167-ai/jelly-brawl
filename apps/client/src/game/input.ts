/** 本地输入：虚拟摇杆 / 冲撞按钮写入这里，键盘（WASD、方向键、空格）也会合并进来。 */
import type { InputCmd } from './types';

export interface InputSource {
  /** 摇杆方向，长度 0~1 */
  stickX: number;
  stickY: number;
  /** 冲撞按钮是否按住 */
  dashHeld: boolean;
}

export function createInput(): InputSource {
  return { stickX: 0, stickY: 0, dashHeld: false };
}

const keys = new Set<string>();

function onKey(e: KeyboardEvent, down: boolean): void {
  const code = e.code;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
    e.preventDefault();
    if (down) keys.add(code);
    else keys.delete(code);
  }
}
const down = (e: KeyboardEvent) => onKey(e, true);
const up = (e: KeyboardEvent) => onKey(e, false);
const clear = () => keys.clear();

/** 开始监听键盘，返回取消监听的函数 */
export function bindKeyboard(): () => void {
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', clear);
    keys.clear();
  };
}

/** 合并触屏与键盘，得到这一帧的指令 */
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
  return { x, y, charge: src.dashHeld || keys.has('Space') };
}
