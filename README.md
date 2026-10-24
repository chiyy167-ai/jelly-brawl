# Jelly Brawl《果冻擂台》

横屏 3D 果冻对战。在会缩小的平台上吃果冻块、蓄力冲撞，把别人挤下去。正式对战与联机是三局累计分（并列加赛）；练习只打 1 局。支持最多 4 人联机（不足由电脑补位）。局内有随机事件、糖果道具与幽灵布丁。大厅有 Lv / XP / 金币 / 宝石与每日奖励。玩法细则见 [GAME_DESIGN.md](GAME_DESIGN.md)。

| 目录 | 内容 |
| --- | --- |
| `apps/client` | 新版客户端：React + TypeScript + Vite + Three.js |
| `apps/server` | 联机服务器：Colyseus，服务器权威，跑和客户端同一套物理 |
| 根目录 `index.html`、`src/` 等 | 旧版原生 JS 竖屏版，网站上放在 `/legacy/` |

## 本地运行

需要 Node.js 20 以上。开两个终端：

```bash
# 终端 1：联机服务器（端口 2567）
cd apps/server
npm ci
npm start

# 终端 2：客户端（端口 5174）
cd apps/client
npm ci
npx vite --host --port 5174
```

电脑打开 `http://127.0.0.1:5174/`。

### 同一个 Wi-Fi 下用 4 部手机测试

1. Windows 运行 `ipconfig`，记下 Wi-Fi 的 IPv4 地址，例如 `192.168.4.157`。
2. 4 部手机都打开 `http://192.168.4.157:5174/`（客户端会自动连同一台电脑的 2567 端口）。
3. 第一部手机：多人对战 → 创建房间，点「分享 / 复制邀请链接」发给其他人，或者把 4 位房间号告诉他们。
4. 其他手机：多人对战 → 输入房间号 → 加入。
5. 房主点「开始游戏」。
6. 打不开时，在 Windows 防火墙里允许 Node.js 访问「专用网络」。

### 没有 4 部手机时

```bash
cd apps/server
npm run smoke              # 自动模拟 4 个玩家打完一局
npm run bots ABCD 3        # 往房间 ABCD 里加 3 个乱跑的测试玩家
```

## 发布到网上

需要两部分：GitHub Pages 放网页，Render 跑联机服务器。

### 1. 联机服务器（Render，免费）

1. 用 GitHub 账号登录 [Render](https://render.com)。
2. 点 New → Blueprint，选 `jelly-brawl` 仓库。Render 会读取根目录的 `render.yaml`，点 Apply。
3. 部署完成后复制服务地址，例如 `https://jelly-brawl-server.onrender.com`。浏览器打开它，显示空白页或 OK，不报错就说明服务器在运行。

免费版 15 分钟没人用会休眠，第一次连接要等 30–50 秒唤醒。联机弹窗提示「连不上」时，等一会儿再点一次。

### 2. 告诉网页服务器地址

GitHub 仓库 → Settings → Secrets and variables → Actions → Variables → New repository variable：

- Name：`SERVER_URL`
- Value：`wss://jelly-brawl-server.onrender.com`（把 `https` 换成 `wss`）

然后到 Actions 页面重新运行「Deploy GitHub Pages」。

临时换服务器也可以不重新发布：网址后面加 `?server=wss://...`，手机会记住这个地址。

### 3. 账号与云端战绩（Supabase，免费）

1. 打开 [supabase.com](https://supabase.com) 用 GitHub 登录，New project，选免费档，记住数据库密码。
2. 项目建好后：左栏 **SQL Editor** → New query，把仓库里 [`supabase/schema.sql`](supabase/schema.sql) 全文粘贴进去 → Run。
3. **Authentication → Providers → Email** 保持开启。开发阶段可在 **Authentication → Providers → Email** 里关掉 **Confirm email**，这样注册后马上能登录（正式上线建议再打开验证）。
4. **Authentication → URL Configuration**：
   - Site URL 填 `https://<用户名>.github.io/jelly-brawl/`
   - Redirect URLs 加上同一地址，以及本地调试用的 `http://127.0.0.1:5174/**`
5. **Project Settings → API** 复制：
   - Project URL → 仓库 Variables：`VITE_SUPABASE_URL`
   - `anon` `public` key → 仓库 Variables：`VITE_SUPABASE_ANON_KEY`  
   （不要把 `service_role` 密钥写进前端或仓库。）
6. 重新跑一遍 GitHub Actions「Deploy GitHub Pages」。

本地调试：复制 `apps/client/.env.example` 为 `.env.local` 填入同上两项，再 `npm run dev`。

游戏里：大厅右上角 **设置** → 注册 / 登录。打完一局后战绩写入云端；「排行榜」里可看自己的最近战绩（仍不是全服排行榜）。

### 4. 网页（GitHub Pages）

推送到 `main` 后，`.github/workflows/pages.yml` 会自动构建 `apps/client` 并发布：

- 新版：`https://<用户名>.github.io/jelly-brawl/`
- 旧版：`https://<用户名>.github.io/jelly-brawl/legacy/`

仓库 Settings → Pages → Build and deployment 要选 GitHub Actions。

## 操作

- 左下摇杆移动，电脑用 WASD 或方向键。
- 右下按钮或空格：按住蓄力，松开冲撞；淘汰后同一按键在摇杆方向放布丁。
- 「开始游戏」= 本地三局赛；「单人模式」= 练习一局。

## 已知限制

- 联机不做断线重连。对局中掉线，你的果冻会交给电脑，下一局要重新加入。
- 对局开始后房间会锁住，新玩家要等这一局结束才能进。
- 本机已有 Lv / XP / 金币 / 宝石与每日领取；全服排行榜与付费外观尚未接入。邮箱账号可存个人战绩。
- 原始大模型 `2b33e7661b753dfea12ffdff5f8123f2.glb`（68 MB）和 `jelly_brawl_page_assets.zip` 没有进仓库；游戏实际用的是压缩后的 `apps/client/public/models/` 里的模型。
