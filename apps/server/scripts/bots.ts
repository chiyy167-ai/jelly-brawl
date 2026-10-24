/** 测试用假玩家：加入指定房间，随机乱走乱撞，每局结束后留在房间里。用法：npm run bots 房间号 [人数] [服务器地址] */
import { Client } from '@colyseus/sdk';
import { ROOM_NAME, type InputMsg } from '../../client/src/net/protocol';

const [code, count = '3', url = 'ws://127.0.0.1:2567'] = process.argv.slice(2);
if (!code) {
  console.log('用法：npm run bots 房间号 [人数] [服务器地址]');
  process.exit(1);
}
const skins = ['blue', 'star', 'sprout', 'cat'];
for (let i = 0; i < Number(count); i += 1) {
  const room = await new Client(url).joinById(code.toUpperCase(), { name: `测试${i + 1}号`, skinId: skins[i % skins.length] });
  let angle = Math.random() * Math.PI * 2;
  room.onMessage('*', () => undefined);
  setInterval(() => {
    angle += (Math.random() - 0.5) * 0.8;
    const charge = Math.random() < 0.15 ? 1 : 0;
    const use = Math.random() < 0.04 ? 1 : 0;
    room.send('input', [Math.cos(angle) * 0.8, Math.sin(angle) * 0.8, charge, use, 0] satisfies InputMsg);
  }, 100);
  room.onLeave(() => process.exit(0));
  console.log(`测试${i + 1}号 已加入 ${code}`);
}
