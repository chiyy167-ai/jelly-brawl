/** 双人进房、开局、移动、释放技能，确认两边都收到快照。 */
import { Client } from '@colyseus/sdk';
import { ROOM_NAME, type Snap } from '../../client/src/net/protocol';

const url = process.argv[2] ?? 'ws://127.0.0.1:2567';
const host = await new Client(url).create(ROOM_NAME, { name: '房主', skinId: 'red' });
const code = host.roomId;
const guest = await new Client(url).joinById(code, { name: '客人', skinId: 'blue' });

let hostStart = false;
let guestStart = false;
let hostSnaps = 0;
let guestSnaps = 0;
let moved = false;
let crates = 0;
let held = 0;
let guestSawHeld = false;
let effect = false;
let px = 0;
let py = 0;
let aim = { x: 0, y: 0 };
host.onMessage('start', () => { hostStart = true; });
guest.onMessage('start', () => { guestStart = true; });
host.onMessage('snap', (snap: Snap) => {
  hostSnaps += 1;
  px = snap.j[0] ?? 0;
  py = snap.j[1] ?? 0;
  if (Math.hypot(px, py) > 0.4) moved = true;
  held = snap.j[16] ?? 0;
  crates = 0;
  let best = Infinity;
  for (let i = 0; i < snap.c.length; i += 4) {
    if (snap.c[i] !== 1) continue;
    crates += 1;
    const dx = snap.c[i + 1] - px;
    const dy = snap.c[i + 2] - py;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      aim = { x: snap.c[i + 1], y: snap.c[i + 2] };
    }
  }
  const shield = snap.j[14] ?? 0;
  const rocket = snap.j[20] ?? 0;
  const star = snap.j[21] ?? 0;
  const magnet = snap.j[15] ?? 0;
  if (shield > 0 || rocket > 0 || star > 0 || magnet > 0 || snap.st.length > 0) effect = true;
});
guest.onMessage('snap', (snap: Snap) => {
  guestSnaps += 1;
  if ((snap.j[16] ?? 0) > 0) guestSawHeld = true;
  const shield = snap.j[14] ?? 0;
  const rocket = snap.j[20] ?? 0;
  if (shield > 0 || rocket > 0 || snap.st.length > 0) effect = true;
});

await new Promise((r) => setTimeout(r, 300));
host.send('start', { mapId: 'candy' });
const t0 = Date.now();
while (Date.now() - t0 < 12000) {
  const dx = aim.x - px;
  const dy = aim.y - py;
  const len = Math.hypot(dx, dy) || 1;
  // 房主朝最近箱子走；拿到后持续按释放
  const use = held > 0 ? 1 : 0;
  const ix = held > 0 ? 0 : dx / len;
  const iy = held > 0 ? 0 : dy / len;
  host.send('input', [ix, iy, 0, use]);
  guest.send('input', [0, 0, 0, 0]);
  await new Promise((r) => setTimeout(r, 50));
  if (effect && guestSawHeld) break;
}
const report = { code, hostStart, guestStart, hostSnaps, guestSnaps, moved, crates, held, guestSawHeld, effect };
console.log(JSON.stringify(report));
await host.leave();
await guest.leave();
if (!hostStart || !guestStart || hostSnaps < 5 || guestSnaps < 5 || !moved) process.exit(1);
