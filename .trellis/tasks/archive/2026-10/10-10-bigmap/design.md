# 设计：大地图与地形

## 坐标与镜头
- `config.js`：保留 `VIEW_COLS = 18`、`VIEW_ROWS = 13` 作为地图视口；地图实际尺寸取 `stage.map[0].length × stage.map.length`。
  - 现有引用 `COLS / ROWS` 的地方（`logic.inMap`、`mapRender`、`validate`、`BattleScene`、`hud`）改为读取当前地图尺寸；`logic` 的纯函数从 `map` 参数取尺寸。
- **镜头设计**（实际方案：双相机，`src/mapCamera.js` 的 `MapCamera`）：
  - 原设想是把地图层放进 `mapLayer` 容器 + 遮罩、移动容器来滚动。没有采用：现有代码大量直接 `scene.add.*` 并按 `tileCenter` 世界坐标摆放（单位、高亮、特效、飘字），改成容器需要逐处改父节点；遮罩还会多一次渲染通道。
  - 主相机（`cameras.main`）只渲染地图层：视口限定为地图区 `(MAP_X, MAP_Y, 864, 624) × RES`，缩放 `RES`，通过 `centerOn` 滚动，视口外自然裁剪。界面相机（`cam.ui`）覆盖整屏、不滚动，缩放与 `hiDpi` 相同，渲染 HUD / 菜单 / 横幅 / 单挑 / 对话 / 弹窗。
  - 分配：场景 `prerender` 事件（Systems.render 中 depthSort 之后、相机渲染之前）遍历 `scene.children.list`，按 `isMapSpace(go)` 给每个顶层对象设置 `cameraFilter`（排除另一台相机）。规则：`go.mapSpace` 显式标记优先，否则 depth < 50（地图、目标格、高亮、光标、单位 `10 + y`、天气）或 700~799（攻击 / 策略特效）为地图层，其余为界面层。容器内子对象随父容器。
    - 新建对象在下一次渲染前一定会被分配，不会双重渲染或漏渲染；`inputCandidate` 也按 `willRender(camera)` 过滤，按钮只在界面相机下命中。
    - 约束：地图最多 40 行，单位 depth `10 + y` ≤ 49，正好在地图层范围内；地图层对象不得使用 50~699 / 800+ 的 depth，界面对象不得使用 < 50 或 700~799（需要例外时设 `mapSpace`，如 `floatText` 深度 900 但标记为地图层）。
    - 开销：每帧遍历一次顶层对象（几十到两百个）并赋值一个整数，可忽略。
  - 坐标：世界坐标 = 旧版地图坐标（`MAP_X + x*TILE, MAP_Y + y*TILE`），`tileCenter` 不变；屏幕坐标 = 1200×672 界面坐标。镜头位置 `(cam.x, cam.y)` 是视口左上角的世界坐标，初值 `(MAP_X, MAP_Y)`，18×13 地图下与旧版完全一致。
  - 指针换算：`cam.tileAt(p)` 用 `p.x / RES` 得屏幕坐标，判断在视口内后加镜头偏移换算格子（不用 `p.worldX`，它随命中测试的相机变化）；指针在小地图上时视为不在地图上。界面层需要贴着格子的元素（指令菜单）用 `cam.tileToScreen`；全视口特效（四神遮罩、砂暴、会心闪白）用 `viewRect(s)`；天气遮罩与粒子每帧移到 `viewRect`。
  - 平滑移动：`panTo / centerTile` 用补间（180~450 毫秒），`follow(tiles)` 在格子已在视口内（留 1 格）时不动；选择单位、AI 行动（行动单位 + 目的地 + 目标）、援军登场、我军阶段开始（曹操）时跟随。
  - 震屏：地图特效震主相机（只震地图区），单挑震界面相机。
## 地形
- `TERRAIN` 扩展到 30 种（`src/terrain.js`），每种包含：`ch` 编码字符、`id` 原版编号、`name`、`color`、`heal`、`elems`（可用的攻击策略属性 f/w/n/e）、`fire`（易燃倍率）、`wild`（砂暴可作用）；绘制在 `mapRender.drawDetail`。
- 移动消耗与防御加成改为按兵种系列查表（`src/terrain.js`）：`TERRAIN_RULES[系列][地形字符]` = `{ pct, cost, def }`，`pct` 为原版能力修正（research §7 逐行抄录），`def = (pct − 100%) × 1.5`（自行设计的换算，120% → +0.3）。原版 27 类中本作有 21 个系列；未登记的系列按步兵处理。船（原版为剧本动态地形）自行设计为可通行。
- `mapRender.drawDetail` 为新地形补绘制：关隘、鹿砦、兵营、荒地、浅滩、雪原、栅栏、宝物库、城门、民居等。
- 编码：一个字符对应一种地形，扩展字符集；在 STAGE_GUIDE 中给出完整图例。

## 57 关重做
- 与第一轮做关卡时一样，按组 A–F 由 6 个子代理并行编写；只改各自的 `src/stages/<组>.js`。
- 规则：
  - 地图尺寸取 research §3；`events` 只改坐标，不增删、不重排；对白不变；
  - 各单位位置按新地图重排，`deploy.slots` 显式写出；
  - 回合上限按地图尺寸调整；
  - 必须通过校验脚本。
- 校验脚本扩展：尺寸与 research 一致（`MAP_SIZES` 表）、30 种地形编码合法、按系列组的通行规则检查站位、`deploy.slots` 合法。

## 兼容
- 关卡对象加 `mapVersion: 2`；战斗快照记录 `mapVersion`。读档时版本不一致，按 PRD M5 重开本关。
