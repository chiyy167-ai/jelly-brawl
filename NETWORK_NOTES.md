# 联机与 TURN

游戏使用 Trystero `0.26.0`（jsDelivr 精确版本）做 WebRTC 信令，默认不需要自建服务器。信令只负责找人和交换连接信息，果冻状态走浏览器之间的直连。

## 配置位置

`src/net.js` 里的 `ICE_SERVERS` 会传给 Trystero：

```js
joinRoom({ appId, rtcConfig: { iceServers: ICE_SERVERS } }, roomCode)
```

当前只有公共 STUN：

```js
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
];
```

同一 Wi-Fi 或宽松的 NAT 通常够用。手机流量、公司网络或对称 NAT 下，两端可能交换了 SDP 但仍连不上。这时需要 TURN 中继。

## 免费 TURN 兜底

可以用 [Open Relay](https://www.metered.ca/tools/openrelay/) 或 [Twilio 试用](https://www.twilio.com/stun-turn) 申请一组带用户名和密码的 TURN。把服务器加进同一个数组，STUN 继续留着：

```js
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:staticauth.openrelay.metered.ca:80',
    username: '你的用户名',
    credential: '你的密码',
  },
  {
    urls: 'turns:staticauth.openrelay.metered.ca:443',
    username: '你的用户名',
    credential: '你的密码',
  },
];
```

`turns` 走 443 端口，适合拦了 UDP 的网络。不要把长期有效的账号密码提交到公开仓库；公开演示可以使用服务商明确允许公开的测试账号。

这里传了完整的 `rtcConfig.iceServers`，Trystero 不会再额外混入它自己的 STUN。所以 STUN 和 TURN 都要写在这个数组里。

## 怎么判断缺的是 TURN

1. 两台设备都打开房间，大厅能看到对方，但延迟一直是 0，或者对局不同步。
2. 浏览器控制台里 ICE 状态停在 `checking` 或变成 `failed`。
3. 同一 Wi-Fi 正常、换成流量就失败，基本就是 NAT 需要 TURN。
