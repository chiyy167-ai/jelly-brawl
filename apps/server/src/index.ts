/** Jelly Brawl 联机服务器入口：Colyseus + WebSocket。端口取环境变量 PORT（云平台会给），本地默认 2567。 */
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '../../client/src/net/protocol';
import { JellyRoom } from './JellyRoom';
import { onlineNow } from './online';

const port = Number(process.env.PORT) || 2567;
const transport = new WebSocketTransport({ pingInterval: 5000, pingMaxRetries: 3 });
transport.getExpressApp().get('/online', (_req, res) => {
  res.setHeader('cache-control', 'no-store');
  res.json({ n: onlineNow() });
});

const server = new Server({
  transport,
  greet: false,
});

server.define(ROOM_NAME, JellyRoom);

server.listen(port, '0.0.0.0').then(() => {
  console.log(`Jelly Brawl 服务器已启动：ws://0.0.0.0:${port}`);
});
