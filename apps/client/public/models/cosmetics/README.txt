Jelly Brawl — 换装部件建模说明（眼睛 / 嘴巴 / 头饰）

现状
  首版在 apps/client/src/game/jellyCosmetics.ts 用 Three.js 基础几何体拼装占位。
  数据 ID 见 apps/client/src/data/cosmetics.ts（EyeId / MouthId / GearId + 10 套 OUTFITS）。

建议目录（换正式模型时）
  eyes/<id>.glb
  mouths/<id>.glb
  gear/<id>.glb
  例如 eyes/round.glb、gear/crown.glb

约定
  - 单位：米。果冻体宽度归一化为 1，底部 y=0。
  - 原点：部件本地中心；代码里再平移到脸前 / 头顶。
  - 朝向：正面朝 +Z（与果冻一致）。
  - 面数：单件尽量 < 800 tris，手机横屏优先。
  - 材质：简单 BaseColor；可带轻微 Emission（星星/天线灯）。

接入
  在 jellyCosmetics.ts 用 GLTFLoader 按 id 加载，失败时回退当前程序化网格。
  不要把超大源文件（> 几 MB 的原始工程）提交进仓库。
