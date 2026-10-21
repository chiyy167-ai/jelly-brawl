/** 联机冒烟测试：4 个假玩家建房 / 加入 / 开局 / 收快照 / 收结算。用法：npm run smoke [服务器地址] */
import { Client, type Room } from '@colyseus/sdk';
import { ROOM_NAME, type InputMsg, type LobbyInfo, type StartMsg } from '../../client/src/net/protocol';

const url = process.argv[2] ?? 'ws://127.0.0.1:2567';
const names = ['小红', '小蓝', '小黄', '小绿'];
const skins = ['classic', 'blue', 'star', 'sprout'];

function wait<T>(room: Room, type: string, ms = 90000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`等待 ${type} 超时`)), ms);
    const off = room.onMessage(type, (m: T) => {
      clearTimeout(t);
      off();
      resolve(m);
    });
  });
}

const rooms: Room[] = [];
const host = await new Client(url).create(ROOM_NAME, { name: names[0], skinId: skins[0] });
rooms.push(host);
const first = await wait<LobbyInfo>(host, 'lobby');
console.log('房间号', first.code);
for (let i = 1; i < 4; i += 1) {
  rooms.push(await new Client(url).joinById(first.code, { name: names[i], skinId: skins[i] }));
}
try {
  await new Client(url).joinById(first.code, { name: '第五人' });
  console.log('错误：第 5 个人也进来了');
} catch (e) {
  console.log('第 5 个人被拒绝（正确）：', (e as Error).message);
}
const starts = rooms.map((r) => wait<StartMsg>(r, 'start'));
host.send('start');
const got = await Promise.all(starts);
console.log('开局，名单：', got[0].roster.map((p) => p.name).join(' / '), '我的下标：', got.map((g) => g.you).join(','));

let snaps = 0;
rooms.forEach((r) => r.onMessage('snap', () => (snaps += 1)));
// 每个人都往中心推摇杆，按住再松开冲撞
const timer = setInterval(() => {
  const charge = Math.floor(Date.now() / 700) % 2;
  rooms.forEach((r, i) => r.send('input', [Math.cos(i), Math.sin(i), charge] satisfies InputMsg));
}, 33);
const results = await Promise.all(rooms.map((r) => wait<{ ranking: { name: string; rank: number; score: number }[] }>(r, 'result')));
clearInterval(timer);
console.log('快照数', snaps, '结算：', results[0].ranking.map((e) => `${e.rank}.${e.name}(${e.score})`).join(' '));
await Promise.all(rooms.map((r) => r.leave()));
process.exit(0);
