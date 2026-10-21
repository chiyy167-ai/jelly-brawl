import { Client } from '@colyseus/sdk';
const url = 'wss://jelly-brawl-server.onrender.com';
(async () => {
  const r = await new Client(url).create('jelly', { name: 'a', skinId: 'classic' });
  r.onMessage('*', () => {});
  r.onLeave((code) => console.log('onLeave code', code));
  console.log('joined', r.roomId);
  await new Promise((ok) => setTimeout(ok, 3000));
  const t = Date.now();
  const code = await r.leave();
  console.log('leave resolved', code, Date.now() - t, 'ms');
  process.exit(0);
})();
