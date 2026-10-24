/** 当前连着这台服务器的人数。房间进出时加减。 */
let n = 0;

export function noteJoin(): void {
  n += 1;
}

export function noteLeave(): void {
  n = Math.max(0, n - 1);
}

export function onlineNow(): number {
  return n;
}
