# Jelly Brawl《果冻擂台》

竖屏果冻对战。在会缩小的圆形平台上吃果冻块、蓄力冲撞，把别人挤下去。支持单人练习和 2–6 人 WebRTC 联机。玩法细节见 [GAME_DESIGN.md](GAME_DESIGN.md)。

## 本地运行

在项目目录执行：

```bash
python -m http.server 8080
```

电脑打开 `http://127.0.0.1:8080/`。不要直接双击 `index.html`，模块脚本和 Service Worker 都需要这个本地服务器。

手机和电脑连同一个 Wi-Fi 后，用电脑的局域网地址访问，例如 `http://192.168.1.20:8080/`。Windows 可在终端运行 `ipconfig`，看当前 Wi-Fi 的 IPv4 地址。若手机打不开，允许 Python 通过专用网络防火墙。

地址栏加上 `?debug=1` 会显示右上角调参面板。`?lag=150` 会把收到的联机快照延迟 150 毫秒，用来看插值是否抖动。

## 操作

- 左半屏按住拖动是摇杆。电脑用 WASD 或方向键。
- 右下角「冲」，或键盘空格：按住蓄力，松开冲刺。
- 淘汰后变成幽灵，点平台可放布丁。

## 手感检查清单

- 摇杆在按下的位置出现，松手后角色会滑一小段再停下。
- 摇杆和「冲」可以同时按住，左边移动不会把右边按钮取消。
- 按住「冲」时明显变慢，头顶红条在 1.2 秒时停住，周围红光变强。
- 不推摇杆松手时，沿上次朝向冲出去。
- 连按空格，第二次在约 0.4 秒内没有冲刺。
- 全速撞上静止靶子或对手时，双方都被推开，重击有短暂停顿和画面震动。
- 吃到果冻块会变大，被重击会变小并掉出一块。
- 平台边缘站太出去会被淘汰，幽灵不能再撞人。

## 部署到 GitHub Pages

`.github/workflows/pages.yml` 会在 `main` 分支更新时发布当前目录。仓库 Settings → Pages → Build and deployment 选择 GitHub Actions。

项目页地址是 `https://<用户名>.github.io/jelly-brawl/`。资源都使用相对路径，可以放在这个子路径下。

更新缓存时，把 `sw.js` 第一处 `jelly-brawl-v1` 改成新的名字再推送。玩家下次打开会看到「点击更新」。一行替换示例：

```bash
python -c "from pathlib import Path; p=Path('sw.js'); p.write_text(p.read_text(encoding='utf-8').replace('jelly-brawl-v1','jelly-brawl-v2',1), encoding='utf-8')"
```

## 安装到手机

iOS Safari：用上面的地址打开游戏，点分享，选「添加到主屏幕」。图标使用 `icons/apple-touch-icon.png`。iOS 不支持震动，游戏会自动跳过。

Android Chrome：打开游戏，菜单选「安装应用」或「添加到主屏幕」。需要 HTTPS，所以用 GitHub Pages 的地址，而不是局域网的 `http://`。

## 图标

`icons/icon.svg` 是源文件。仓库里已经带好 192、512、maskable 和 180 的 PNG。若要重做：

```bash
magick icons/icon.svg -resize 192x192 icons/icon-192.png
magick icons/icon.svg -resize 512x512 icons/icon-512.png
magick icons/icon.svg -resize 180x180 icons/apple-touch-icon.png
```

maskable 图标需要四周留出纯色边，不要把果冻画到画布边缘。

## PWA 自查

已具备：manifest 名称、standalone、竖屏、主题色、192/512 图标、maskable 图标、Service Worker 离线缓存、`theme-color`、苹果触摸图标和可安装的相对路径。

本地 `http://` 不能拿到完整的 Lighthouse PWA 安装分，因为规范要求 HTTPS。部署到 GitHub Pages 后再跑 Lighthouse。第三方 Trystero 和二维码库来自 CDN，离线时大厅二维码和联机会不可用，单机画面仍可从缓存打开。

## 已知限制

- 默认只有 STUN。复杂网络需要按 [NETWORK_NOTES.md](NETWORK_NOTES.md) 加 TURN。
- 客户端不做位置预测，延迟高时会晚一点跟着房主走；`?lag=150` 可在本机看这个效果。
- 房主掉线会回到大厅，不会移交主机。
- 音效是 WebAudio 合成的，iOS 要先点一下画面才出声。
