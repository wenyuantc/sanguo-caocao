# 场景与渲染

> Phaser 场景、UI 工厂函数、视图类、程序化贴图，以及基于 async/await 的动画流程。

---

## 场景

- 每个场景写作 `export class XScene extends Phaser.Scene { constructor() { super('X'); } }`
  （`src/scenes/TitleScene.js`、`BattleScene.js`、`EndingScene.js`）。
- 每个 `create()` 第一句调用 `hiDpi(this)`（`src/config.js`）：画布按 `RES` 倍创建，镜头放大 `RES` 倍，
  文字分辨率 `RES` 倍。`RES` 取自游戏设置（1 / 1.5 / 2，自动按设备像素比），不要假设它等于 2。布局一律使用**世界坐标** `WIDTH × HEIGHT`（1200 × 672），不要用画布像素。
- 每次运行的临时状态在 `init(data)` 中重置（`BattleScene.init` 重置 `modal/over/state/sel/menu`）。
- 场景切换用 `this.scene.start('Battle', { stage, load })` / `('Ending', { route })` / `('Title')`。
  场景是重启而不是暂停；`BattleScene.create` 会调用 `purgeTextures()` 释放上一关的 `hero-*` / `pt-*` 贴图。
- 地图坐标（世界坐标）：格子 `(x, y)` → 像素 `MAP_X + x*TILE`、`MAP_Y + y*TILE`；格子中心用 `unitView.js` 的
  `tileCenter(x, y)`，反向换算用 `BattleScene.tileAt(pointer)`（按镜头换算，不要用 `pointer.worldX`）。
  地图尺寸由关卡决定（`map[0].length × map.length`，最大 40×40），屏幕上的地图区固定为 `VIEW_COLS × VIEW_ROWS`（18×13）。

- `hiDpi` 只给每个场景实例注册一次 `addedtoscene` 监听（场景实例在重启之间复用，`scene.events` 的监听不会随 shutdown 清除）。
  在 `create` 里给 `this.events` 加长期监听时，要在 `shutdown` 中移除，或用实例标记保证只注册一次。

## 剧情场景（`src/scenes/StoryScene.js`、`src/story/`）

- 流程（`story/flow.js`）：新游戏 / 下一关 → `Story`（pre）→ `Battle`（`skipStory: true`，开局整备）；胜利 → `playPost` 暂停并隐藏战场，
  `launch('Story', { part: 'post', onDone })` 叠加播放，`onDone` 在 Story **shutdown 之后**回调（回调里马上再开 Story 也不会被这次关闭打断），
  战场恢复后把 registry 中的 `red` / `flags` 同步回来再算奖励、写自动存档；`goNext` 进入下一关开场或结局。
- `BattleScene.create` 在没有 `load` 且没有 `skipStory` 时转去开场场景（`redirecting = true`，`update` 直接返回）；地图版本不一致的重开也走这里，提示语作为 `notice` 旁白。
  读档（`load`）与重新挑战（`retry()`，`skipStory: true`）不播开场场景；重新挑战把 registry 的 `red` / `flags` 恢复为 `startState`（本关开头的值，战斗快照里存为 `start`）。
- 场景中的选项写入 registry（`StoryScene.applyChoice`）；场景里没有存档入口。
- 两台相机：主相机渲染 depth < 1000 的场景层（可推近），`ui` 相机渲染对白、标题、按钮；`prerender` 时按 depth 设置 `cameraFilter`。
- 加速 / 跳过只改 `tweens.timeScale` 与 `time.timeScale`（跳过 60 倍），遇到选项停下等玩家选择；`shutdown` 时恢复 1 倍并释放 `st-*` / `sbg-*` 贴图（`pt-*` 头像由下一个 `BattleScene` 释放）。
- 剧情小人贴图 key `st-<名>-<阵营>-<兵种>-<动作>-<帧>-<f|b>`，`drawHuman(k, L, F, oy, mounted, S)` 的 `S` 缺省时与战场小人逐行一致；跪姿（`seat`）裁掉腰以下再画折叠的腿，作揖（`bend`）以腰为轴压扁上半身。

## 营中场景（`src/scenes/CampScene.js`、`src/camp/`）

- 流程：`goNext` → `goCamp`（`Camp`，data `{ stage: 下一关, talked?, deploy?, pos? }`）→ 营门确认 → `goStage(scene, id, { deploy })`。第一关之前、结局之后不进营中。
- 两台相机同剧情场景：主相机（depth < 1000：背景、物件、人物、头顶标记 / 提示）放大 `ZOOM` 倍并平滑跟随曹操（夹在背景范围内）；`ui` 相机渲染顶栏、按钮、`DialogBox`（1000）与弹窗（3000）。场景层文字用 `worldText`（分辨率 `RES × ZOOM`）。
- 人物复用 `StoryActor`，坐标为等角整数格；物件（`camp/props.js`）按中心的屏幕 y 设 depth（`100 + y / 4`，与人物同一套排序）。背景是整张图，高大物件身后的格子在布局里划为障碍，避免人物画在帐篷上。
- 移动：`story/path.js` 的 `findPath`（八方向，不切拐角，`near` 走到目标旁边）；方向键按屏幕方向映射为格子对角步。每步一个补间，`update` 中决定下一步；人物占格含正在走向的格（`to`）。规划长路径时忽略远处闲逛的人物，走到跟前被挡再按全部人物重新规划。
- 弹窗 / 对白期间（`busy()`）不响应移动与互动；整备、商店复用 `openPrep(scene, plan, onConfirm, { tabs, title, confirmLabel, selected })`，场景需提供 `inventory` / `gold` / `items` 字段。
- `shutdown` 时销毁人物并释放 `st-*` / `sbg-*` 贴图。

## 镜头（`src/mapCamera.js`）

- `BattleScene.cam = new MapCamera(scene, map, { canScroll })`：两台相机。`cameras.main` 只渲染**地图层**，视口限定在地图区并滚动；
  `cam.ui` 整屏不滚动，渲染**界面层**。每帧 `prerender` 按 `isMapSpace(go)` 设置 `cameraFilter` 分配对象：
  depth < 50 或 700~799，或 `go.mapSpace === true` 为地图层（世界坐标）；其余为界面层（屏幕坐标）。
  新增显示对象按下表的层级放置即可；界面层却要用 < 50 / 700~799 的 depth 时设 `mapSpace = false`，地图层的飘字类对象设 `mapSpace = true`（`floatText` 已设）。
- 镜头位置 `cam.x / cam.y` 是视口左上角的世界坐标（初始 `(MAP_X, MAP_Y)`，18×13 地图不滚动、与旧版一致）。
  换算：`cam.tileAt(p)`、`cam.screenOf(p)`、`cam.toWorld / toScreen`、`cam.tileToScreen(x, y)`（界面层对象贴着格子摆放时用，如指令菜单）、`viewRect(s)`（当前视口的世界矩形，全屏特效 / 天气用）。
- 移动：`cam.panTo(x, y, ms?)`（视口左上角，补间，返回 Promise）、`cam.centerTile(x, y, ms?)`、`cam.follow(tiles)` / `scene.follow(...units)`（都在视口内则不动）。
  AI 行动前 `await s.follow(u, plan.tile, plan.target)`；援军登场、选择单位、我军阶段开始（曹操）、部队情报跳转都会跟随。
- 输入：场景级 `pointerdown` 只调用 `cam.press(p)`（右键直接取消），`pointerup` 时 `cam.release(p)` 为真（未拖动超过 6px）才调用 `onClick`。
  方向键 / WASD、鼠标停在视口边缘 24px（250ms 后）滚动；`canScroll` 为假（弹窗、对话、指令菜单）时禁止手动滚动。
- 小地图 `src/minimap.js`（地图大于视口时才创建）：视口右上角悬浮（depth 60），地形为每格 1 像素的画布贴图最近邻放大，单位点与视口框在 `update` 中按签名重画；点击 / 拖动跳转，按钮或 M 键折叠。

## UI 工厂函数（`src/ui.js`）

控件是返回 Phaser 对象的普通函数，不是类：

```js
text(scene, x, y, str, size = 16, color = '#f1e3c2', font = UI_FONT)
button(scene, x, y, w, h, label, onClick, size = 18)   // Container，带 .setDisabled(d)、.label
panel(scene, x, y, w, h, alpha)                         // 金边深色面板 Graphics
portrait(scene, x, y, name, side, size)                 // 带边框的头像 Container
floatText(scene, x, y, str, color, size)                // 上浮的伤害/回复数字
wait(scene, ms)                                         // 基于 scene.time.delayedCall 的 Promise
```

- 复用这些函数，不要直接用 `scene.add.text` 写临时样式。标题/标签用 `FONT`（楷体），正文/数字用默认的
  `UI_FONT`。颜色取自 `COLORS`（数值）或现有的十六进制字符串色板（`'#e9c46a'` 金色标签、
  `'#f1e3c2'` 纸色正文、`'#ff8a7a'` 错误、`'#9ce0a8'` 成功）。
- 按钮点击会调用 `ev.stopPropagation()`，避免场景级 `pointerdown` 同时触发。
- 弹窗（`openSaveMenu`、`TitleScene.chooseDifficulty`）= `container.setDepth(3000)` + 吞掉点击的全屏
  遮罩矩形 + 关闭时移除的 ESC 监听（`keyboard.off('keydown-ESC', close)`）。新增弹窗照此实现。

## 视图类

只有长期存在、有状态的显示对象才写成类：`Hud`（`hud.js`）、`UnitView`（`unitView.js`）、
`DialogBox`（`ui.js`）。它们在构造函数中接收 `scene`，并把 Phaser 对象保存为字段。

- `BattleScene.views` 是 `Map<单位对象, UnitView>`；逻辑先修改单位对象，再调用视图方法
  （`updateHp()`、`setActed()`、`moveAlong(path)`、`snap()`）。视图从不决定游戏规则。
- 单位阵亡后删除其视图：`s.views.delete(u)`（见 `killUnit`）。单位可能已不存在时，用 `s.views.get(u)?.…` 访问。

## 显示层级（setDepth）

| 深度 | 内容 |
|------|------|
| 0 | 地图（`drawMap` 按 20×20 格分块烘焙的 `map-bake-*` 贴图 Image） |
| 4–6 | 目标格、高亮 `hl`、光标 |
| 10 + y | 单位容器（按行排序） |
| 30–31 | 天气遮罩、天气粒子（`weatherFx.js`，每帧跟随视口） |
| 50–52 | HUD 顶栏、面板、HUD 按钮（以下为界面层） |
| 60 | 小地图 |
| 600 | 指令菜单 |
| 700–799 | 攻击 / 策略特效（地图层） |
| 800–801 | 横幅、天气切换提示 |
| 900–951 | 飘字（`mapSpace`，地图层）、败北遮罩、单挑 |
| 1000 | DialogBox |
| 3000 | 弹窗（存档菜单、难度选择） |

## 程序化贴图

项目没有图片素材。贴图用 Canvas 2D 绘制一次，并按 key 缓存：

```js
const key = `hero-${unit.cls}-${unit.faction}-${unit.name}`;   // heroSprites.unitTexture
if (scene.textures.exists(key)) return key;
const tex = scene.textures.createCanvas(key, LW * TEX, (LH + PAD) * TEX);
const ctx = tex.getContext(); ctx.scale(TEX, TEX);
/* 用 kit(ctx) 绘制：grad / fill / ell / poly / line */
tex.refresh();
return key;
```

- 同样的写法：`portraits.portraitTexture`（`pt-${name}-${side}`，×4）、`spellFx.canvasTex`（`fx-*`，×3）。
- 按逻辑尺寸绘制，再用分辨率倍数（`TEX`、`PT`、`R`）缩放 context。
- 如果临时修改共享色板（heroSprites 中的 `C`），要在 `finally` 中恢复。
- 地图格子用 `Graphics` 绘制，配合确定性伪随机 `rnd(x, y, i)`，保证每次加载外观一致；按 20×20 格分块，每块画完后按 `RES` 倍
  烘焙进 DynamicTexture（`map-bake-<x>-<y>`，避免 40×40 单张贴图超出显卡尺寸）并销毁 Graphics。30 种地形各有 `drawDetail` 分支，细节不要超出格子左右边界（上方可超出 4px）。大量静态 Graphics 指令在 WebGL 下每帧都会重新处理，
  静态内容一律烘焙。
- 地形变化后用 `redrawTiles(scene, map, tiles)` 只重烘受影响的分块（分块图像记在 `scene.mapChunks`，key `"cx,cy"`），小地图用 `minimap.paintTerrain(map)` 重画像素并清空 `sig`。

## 游戏设置与性能

- 设置在 `src/settings.js`（localStorage `sanguo-settings`，损坏回退默认），启动时由 `config.js` 读出
  `SETTINGS` / `RES`，`main.js` 据此设置 `antialias`、`fps.limit` 与帧率角标。设置面板 `settingsMenu.js`
  只在标题页打开，保存后 `location.reload()` 生效（全屏立即生效）。
- 画质“低”时 `UnitView.idle` 不创建，引用一律写 `v.idle?.…`。
- 帧率上限默认 0（跟随屏幕）：Phaser 的限帧器在 60Hz 屏幕上设 60 会因 rAF 计时抖动丢帧。
- `pointermove` 处理中不要无条件重建含 Text / 头像的面板：`BattleScene.onHover` 按“格子 + state”去重
  `hud.showUnit`，其它主动刷新面板的地方（如 `focusUnit`）要清空 `hoverKey`。

## 异步动画流程

游戏流程是对 Promise 包装的补间/定时器顺序 `async/await`，而不是事件回调：

```js
// actions.js
await playAttack(s, a, d, r, onImpact);
await wait(s, 200);
await gainExp(s, a, expFor(a, d, killed));
if (killed) await killUnit(s, d);
```

- 补间包装成 `new Promise((r) => scene.tweens.add({ ...cfg, onComplete: r }))`（见 `duel.js` 的 `tween`、
  `UnitView.moveAlong`、`Hud.banner`）。下一步依赖的动画必须 await 完成。
- `actions.js` 中的战斗行动以场景作为第一个参数 `s`，直接访问 `s.units`、`s.views`、`s.hud`、`s.map`、
  `s.items`。可选的场景钩子用 `?.` 调用（`s.findDuel?.(a, d)`、`s.fireDeathEvents?.(u)`）。
- 每个玩家行动和每个 AI 单位的行动都包在 `try/catch` + `console.error('…出错', e)` 中，单个行动出错
  只结束该单位行动，不会卡死整局（`BattleScene.execute`、`runAI`）。新增行动类型时保留这个保护。
- `BattleScene.state`（`'busy' | 'idle' | 'move' | 'menu' | 'target'`）控制输入；任何需要 await 的动画
  开始前设为 `'busy'`，结束后恢复。

## 战场演出（`src/battleStage.js`）

- 事件可选字段 `stage: [指令]`，`runEvent` 的顺序：`setFlag` → `stage` 逐条 await → 援军登场（`spawn`）→ `setAi` → `dialog`；
  `stage` 里写 `{ spawn: true }` 可把援军登场与 `setAi` 提前到该位置。整个事件期间 `state = 'busy'`，结束后恢复；每条指令单独 `try/catch`。
- 指令：`{ camera: [x, y] | 单位id, ms? }`、`{ walk: id, to?: [x, y], path?: [[x, y], ...], ms? }`、`{ highlight: [[x, y] | 单位id, ...], color?, ms? }`、
  `{ terrain: { at, set, size?, from? } | [...] }`、`{ face: id, dir: left|right|up|down|[x, y]|单位id }`、`{ act: id, pose }`、`{ say: [对白] }`、`{ wait: ms }`。
  战场单位没有背面贴图：`face` 的 up/down 只做压扁示意；`act` 用 `UnitView.act`（jump / bow / shake / flash / spin，剧情姿态名按 `ACT_ALIAS` 映射）。
- 援军 `spawn` 是 async：`entryRoute` 给出从地图边缘（或 `def.from`）到落点的 BFS 路线（兵种可通行、不穿过敌对单位），起点在边缘时补一格地图外的虚拟起点；
  默认路线超过 `MAX_WALK`（6）格、走不通或 `from: false` / `enter: 'fade'` 时原地淡入。全部到位后才返回，读档不重放。
- 地形变化 `changeTerrain`：`terrainCells` 解析范围（`size: 3` 为 3×3，按预设 / `from` 过滤，跳过有单位且新地形对其不可通行的格），`patchMap` 改地图并记 `mapPatches`，再重烘分块与小地图。

## 反模式

- 导入图片/音频文件或新增 `assets/` 目录：所有图形都是程序生成的。
- 地图位置写死像素值，而不是用 `TILE`/`MAP_X`/`MAP_Y`/`tileCenter`。
- 用 `pointer.worldX/worldY` 或 `WIDTH/HEIGHT`、整张地图尺寸摆放地图层对象（应换算镜头 / 用 `viewRect`）；把界面对象放到地图层 depth。
- 假设地图为 18×13：尺寸一律从 `map` 取（`logic.mapCols/mapRows`），`inMap(x, y, map)`、`attackTiles(map, u)`、`spellTiles(map, u, id)` 都要传地图。
- 创建贴图前不检查 `textures.exists(key)`（会泄漏，或报重复 key 错误）。
- 弹窗关闭后键盘监听仍未移除。
