# 设计：大地图与地形

## 坐标与镜头
- `config.js`：保留 `VIEW_COLS = 18`、`VIEW_ROWS = 13` 作为地图视口；地图实际尺寸取 `stage.map[0].length × stage.map.length`。
  - 现有引用 `COLS / ROWS` 的地方（`logic.inMap`、`mapRender`、`validate`、`BattleScene`、`hud`）改为读取当前地图尺寸；`logic` 的纯函数从 `map` 参数取尺寸。
- **镜头设计**：
  - 现在 `hiDpi` 把主相机缩放 2 倍并固定居中，地图和界面都画在同一个世界坐标里。
  - 改为：地图层（地形、单位、高亮、特效）放进 `mapLayer` 容器，用一个地图区遮罩裁剪；滚动通过移动 `mapLayer` 的位置实现。界面（HUD、对话、覆盖层）不动。
  - 指针换算：`tileAt` 先减去 `mapLayer` 的偏移，再换算格子。
  - `tileCenter` 返回地图层内坐标；需要屏幕坐标的地方（飘字、横幅）加上偏移。
  - 平滑移动：`panTo(x, y)` 用补间动画。
- **输入**：在地图区拖动（超过 6 像素才算拖动，避免和点击冲突）、方向键 / WASD、边缘滚动（鼠标在地图区边缘 24 像素内）。
- **小地图**（`src/minimap.js`）：每格 3 像素绘制地形色块和单位点，视口框可点击跳转；位置在右侧面板顶部，可折叠。

## 地形
- `TERRAIN` 扩展到 30 种，每种包含：`name`、编码字符、绘制函数、`heal`、`category`（策略地形类别）、`fire` 等。
- 移动消耗与防御加成改为按系列组查表：`TERRAIN_RULES[系列组][地形]` = `{ cost, def }`。系列组按 research §7 的 27 类兵种归并。
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
