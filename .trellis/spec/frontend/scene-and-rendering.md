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

- 流程：`goNext` → `goCamp`（`Camp`，data `{ stage: 下一关, talked?, deploy?, pos? }`）→ 营门确认（回车确认 / ESC 取消；键盘监听延后一帧注册并忽略按住重复，避免打开确认框的那次回车直接出征）→ 写 `kind: 'stage'` 自动存档 → `goStage(scene, id, { deploy })`。第一关之前、结局之后不进营中。
- 两台相机同剧情场景：主相机（depth < 1000：背景、物件、人物、头顶标记 / 提示）放大 `ZOOM` 倍并平滑跟随曹操（夹在背景范围内）；`ui` 相机渲染顶栏、按钮、`DialogBox`（1000）与弹窗（3000）。场景层文字用 `worldText`（分辨率 `RES × ZOOM`）。
- 人物复用 `StoryActor`，坐标为等角整数格；物件（`camp/props.js`）按中心的屏幕 y 设 depth（`100 + y / 4`，与人物同一套排序）。背景是整张图，高大物件身后的格子在布局里划为障碍，避免人物画在帐篷上。
- 移动：`story/path.js` 的 `findPath`（八方向，不切拐角，`near` 走到目标旁边）；方向键按屏幕方向映射为格子对角步。每步一个补间，`update` 中决定下一步；人物占格含正在走向的格（`to`）。规划长路径时忽略远处闲逛的人物，走到跟前被挡再按全部人物重新规划。
- 弹窗 / 对白期间（`busy()`）不响应移动与互动；整备、商店复用 `openPrep(scene, plan, onConfirm, { tabs, title, confirmLabel, selected })`，场景需提供 `inventory` / `gold` / `items` 字段。
- `shutdown` 时销毁人物并释放 `st-*` / `sbg-*` 贴图。
- 布局（`camp/layouts.js`）新增或改动后必须过 `checkLayout`（校验脚本与 `scripts/test-path.mjs` 都会调用）：出生点、商人、整备人物、站岗位、百姓两两不能同格，且从出生点都能走到。踩过的坑：府邸布局的商人与出生点同格。
- 营中摆人：`joined` 武将 → 本关台词里已在 `plan.pool`（预设我军 / `joinAt` 已到）但还没记入 `joined` 的武将 → 客人（非登记人物，或登记武将但条目写明 `side`）→ 布局百姓；按名字去重。新增“剧情中已归降、下一关才预设出场”的武将时，确认他能通过 `plan.pool` 进营。

## 镜头（`src/mapCamera.js`）

- `BattleScene.cam = new MapCamera(scene, map, { canScroll })`：两台相机。`cameras.main` 只渲染**地图层**，视口限定在地图区并滚动；
  `cam.ui` 整屏不滚动，渲染**界面层**。每帧 `prerender` 按 `isMapSpace(go)` 设置 `cameraFilter` 分配对象：
  depth < 50 或 700~799，或 `go.mapSpace === true` 为地图层（世界坐标）；其余为界面层（屏幕坐标）。
  新增显示对象按下表的层级放置即可；界面层却要用 < 50 / 700~799 的 depth 时设 `mapSpace = false`，地图层的飘字类对象设 `mapSpace = true`（`floatText` 已设）。
- 镜头位置 `cam.x / cam.y` 是视口左上角的世界坐标（初始 `(MAP_X, MAP_Y)`，18×13 地图不滚动、与旧版一致）。
  换算：`cam.tileAt(p)`、`cam.screenOf(p)`、`cam.toWorld / toScreen`、`cam.tileToScreen(x, y)`（界面层对象贴着格子摆放时用，如指令菜单）、`viewRect(s)`（当前视口的世界矩形，全屏特效 / 天气用）。
- 移动：`cam.panTo(x, y, ms?)`（视口左上角，补间，返回 Promise）、`cam.centerTile(x, y, ms?)`、`cam.follow(tiles)` / `scene.follow(...units)`（都在视口内则不动）。
  AI 行动前 `await s.follow(u, plan.tile, plan.target)`；援军登场、选择单位、我军阶段开始（曹操）、部队情报跳转都会跟随。
- 输入：场景级 `pointerdown` 只调用 `cam.press(p)`（右键直接取消），`pointerup` 时 `cam.release(p)` 为真（未拖动超过 6px，触摸为 18px）才调用 `onClick`。
  方向键 / WASD、鼠标停在视口边缘 24px（250ms 后）滚动（触摸不做边缘滚动）；`canScroll` 为假（弹窗、对话、指令菜单）时禁止手动滚动。
- 小地图 `src/minimap.js`（地图大于视口时才创建）：视口右上角悬浮（depth 60），地形为每格 1 像素的画布贴图最近邻放大，单位点与视口框在 `update` 中按签名重画；点击 / 拖动跳转，按钮或 M 键折叠。

## 触屏输入（移动端横屏）

只支持横屏：`index.html` 的 `#rotate` 遮罩在 `(orientation: portrait) and (pointer: coarse)` 时盖住画面；页面禁止缩放、下拉刷新、长按菜单。
不引入手势 / 高清 / 全屏库（评估过 Hammer.js、phaser3-rex-plugins、phaser-hidpi、screenfull，见归档任务 `10-12-mobile-adapt/design.md`）。

### 判定：两级，不要混用

| 判定 | 来源 | 用于 |
|------|------|------|
| `IS_TOUCH`（`config.js`） | `matchMedia('(pointer: coarse)')`，Node 下为 false | 显示哪套说明文字、是否创建触屏专用控件（取消按钮） |
| `p.wasTouch`（Phaser `Pointer`） | 本次事件是否来自触摸 | 一切行为分支（补刷悬停、二次确认、点击容差、边缘滚动、悬停信息保留） |

同一设备可能混用鼠标与触摸，行为分支必须看 `p.wasTouch`；鼠标事件会把 `activePointer` 切回鼠标指针、`wasTouch` 为 false。

### Phaser 4 触摸事件语义（`node_modules/phaser/src/input/InputPlugin.js`）

- `TOUCH_START` → down + **over**；`TOUCH_END` → up + **out**；只有 `TOUCH_MOVE` 才派发 move。
  - 单击不触发场景 `pointermove`：依赖 `onHover` 的刷新要在点击时手动补（`BattleScene` 的 `up`：`if (p.wasTouch) this.onHover(p)`）。
  - 悬停说明在抬起时被 `pointerout` 还原：需要保留的，`pointerout` 里 `if (!p.wasTouch)` 才还原（`hud.js` 天气说明）。
- `input.isOver` 只由鼠标进出画布维护，触屏时恒为 true；触摸抬起后 `activePointer` 停在最后触点。按指针位置做的每帧逻辑（边缘滚动、镜头移动后刷新悬停）要排除 `p.wasTouch`。
- 默认只有 1 个触摸指针（`input.activePointers = 1`），第二根手指被忽略。
- 触摸事件在 DOM 回调中同步派发；`touchend` 是浏览器认可的用户激活，`touchstart` 不是。

### 约定

- 点击容差：`mapCamera.js` 的 `DRAG = 6`（鼠标）/ `DRAG_TOUCH = 18`（触摸，手机横屏画面约缩小到 0.54~0.58 倍）。
- 需要用户激活的按钮（文件选择、下载）传 `button(..., size, { onRelease: true })`：触摸按下只记标记，在按钮上抬起才触发；鼠标仍在按下时触发。不传 `opts` 时行为不变。
- 全屏只由玩家点左下角 DOM 按钮 `#fs-btn` 切换（不自动全屏；仅 `IS_TOUCH` 且 `scale.fullscreen.available` 时显示，iPhone Safari 不显示）。目标 `#game`（`fullscreenTarget: 'game'`，竖屏遮罩和按钮都在其内）；进入全屏后用原生 `screen.orientation.lock('landscape')`——Phaser 的 `scale.lockOrientation` 调用已废弃 API，无效。
- 画布外的 DOM 控件必须吞掉自己的触摸：Phaser 在 window 上监听画布外的 `touchstart` / `touchend` 并当作游戏点击（营中会走路、标题会开始），只跳过 `defaultPrevented` 的事件。做法是在控件的 `touchstart` 和 `touchend` 里 `preventDefault()` + `stopPropagation()`，动作放在 `touchend` 中执行（之后不会再有 `click`）。
- 右键 / ESC 的触屏替代：`BattleScene.cancelBtn`（仅 `IS_TOUCH`），move / menu / target 状态显示并隐藏“结束回合”；取消按钮消失后“结束回合”延迟 400ms（`endGuard`）出现，防止连点误结束回合。
- 执行类点击要二次确认：选目标时触摸第一次点击只预览（`aimAt(t)` 记 `touchAim`，地图层标“再点确认”），再点同一格才执行；进入 / 取消目标状态、清除选择时 `aimAt(null)`。
- 右侧预测区只容 3 行（y 392~449，450 为分隔线），提示不要往预测区追加行。

### 错误示例 vs 正确示例

```js
// 错误：触屏单击不会触发 pointermove，信息面板不刷新；目标点了直接执行
this.input.on('pointerup', (p) => { if (this.cam.release(p)) this.onClick(p); });
// 正确
this.input.on('pointerup', (p) => { if (!this.cam.release(p)) return; if (p.wasTouch) this.onHover(p); this.onClick(p); });

// 错误：触摸 down 来自 touchstart，手机上文件选择会被浏览器拦截
button(scene, x, y, 92, 32, '导　入', () => pickFile(), 15);
// 正确
button(scene, x, y, 92, 32, '导　入', () => pickFile(), 15, { onRelease: true });
```

### 验证

预览浏览器 `preview_resize` 宽度 < 768（如 740×360）才会模拟触屏（`pointer: coarse`、`maxTouchPoints`），切换后要刷新页面。
脚本注入触摸：`new Touch({ identifier, target: canvas, clientX, clientY, pageX, pageY })`——**必须带 `pageX/pageY`**，否则 Phaser 算出的指针坐标错误；
再 `canvas.dispatchEvent(new TouchEvent('touchstart' | 'touchmove' | 'touchend', { touches, changedTouches, targetTouches, cancelable: true }))`。
合成事件不算用户手势，控制台出现 `requestFullscreen ... user gesture` 警告属正常。需真机确认：文件选择、下载、全屏、横屏锁定。

## UI 工厂函数（`src/ui.js`）

控件是返回 Phaser 对象的普通函数，不是类：

```js
text(scene, x, y, str, size = 16, color = '#f1e3c2', font = UI_FONT)
button(scene, x, y, w, h, label, onClick, size = 18, opts = {})   // Container，带 .setDisabled(d)、.label；opts.onRelease 见“触屏输入”
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
| 40 | 触屏选目标的“再点确认”标签（`BattleScene.aimAt`） |
| 50–52 | HUD 顶栏、面板、HUD 按钮（以下为界面层） |
| 53 | 触屏“取消”按钮（与“结束回合”同位置，二者互斥显示） |
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
  的渲染类设置（`RENDER_KEYS`）只在标题页修改，保存后 `location.reload()` 生效（全屏立即生效）；音量类设置即时生效，战斗中可打开只含游戏速度与音量行的面板（见「音频」）。
- 游戏速度 `speed`（1x–16x）即时保存、不重载，只作用于 Battle：`BattleScene.applySpeed()` 在 `create` 与战斗设置面板关闭时设置
  `tweens.timeScale` / `time.timeScale`。战斗流程的等待必须走 `scene.tweens` / `scene.time`（不要用 `setTimeout`），否则不会随倍率加速；
  `time.now` 不受倍率影响，防误触判断仍按真实时间。Story 场景自行管理倍率，不读此设置。
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

## 音频（`src/audio/`）

- 全部声音由 Web Audio 实时合成，没有音频文件；Phaser 自带的声音系统已关闭（`main.js` 的 `audio: { noAudio: true }`）。
- `engine.js`：单例 `engine`（`AudioContext`、`master` → 压限 → 输出，`musicBus` / `sfxBus` 两个总线各有一路发送到程序生成脉冲响应的混响）。
  `main.js` 启动时 `initAudio(SETTINGS)`：设置音量、在 window 上注册 pointerdown / keydown 解锁（上下文真正 running 后才移除监听：ESC 等按键不算浏览器认可的用户操作）、`visibilitychange` 时 suspend / resume。
  `engine.ready`（已解锁且上下文在运行）为假时一切播放调用都是静默的无操作，调用方不需要判断。
- `instruments.js`：音色函数统一签名 `play<音色>(dest, time, note, dur, vel = 0.8, opts = {})`（`dest` 为 `'music'` / `'sfx'` / AudioNode，`note` ≤ 127 为 MIDI 号、否则为 Hz，返回发声结束时间），
  配乐的音序器直接调用。拨弦（古筝 / 琵琶）用 Karplus-Strong 预先算成缓冲并缓存。
- 新建的节点一律经 `engine.track(nodes, sources)` 登记：全部声源 `onended` 后断开节点、扣减 `engine.activeNodes`（`window.__audioStats.activeNodes`，回归时检查回落到 0）。
  不要自己给声源赋 `onended`（会覆盖登记）；每个声源都必须 `stop()`，否则节点永远不释放。
- 音效：`sfx(name, opts)`（`sfx.js` 的 `SOUNDS` 表）。接入点只加一行 `sfx(...)`，不 await、不改变动画时序；音效内部的出声延迟按动画出手时刻写在音效定义里。
  同时发声最多 8 个声部（满员淡出最早的，`step` 脚步满员时直接忽略），同名同参数 40ms 内只播一次。
  兵器取 `weaponOf(unit)`（13 种），策略系别用 `spellSchool(sp)`，脚步类型用 `stepKind(lookOf(unit))`。
- 现有接入点：`ui.button`（标签去掉空格后以 返回 / 取消 / 关闭 / 放弃 开头为 `cancel`，否则 `confirm`）、设置面板选项（`select`）、战场选中 / 查看单位（`select`）与取消（`cancel`）、
  `UnitView.moveAlong` 每步 `step`、`playAttack`（`crit` 切入、`attack` 挥动、命中 / 闪避 `hit` / `miss`）、`castFx`（`cast`）、`spellFx`（`spell`，青龙每道雷一次）、
  `itemFx` 回复（`spell` heal）、`gainExp` 升级（`levelup`）、`promoteFx`（`promote`）、`lootFx`（`treasure`）、`openRewards`（`treasure` / `item`）、`deathFx`（`retreat`）、
  `BattleScene.changeWeather`（`weather`）、`startPhase` 横幅前（`turn`）。
- 调试：`__audioTest(name)` 试听音色（不传参依次试听全部）、`__sfxTest(name, opts)` 触发音效、`__musicTest(场合或曲目 id)` 播放配乐（不传参停止）、`__musicNow()` 当前曲目 id。
- 音量设置（`music` / `sfx` 0–100、`mute`）在 `settings.js`，设置面板改动即时 `engine.setVolumes` 并保存，不重载页面；只有 `RENDER_KEYS` 改动才重载。
  战斗中由右侧面板“设置”按钮打开 `openSettingsMenu(scene, { audioOnly: true, onClose })`（期间 `modal = true`）。
- 标题页首次进入时显示“点击开始”，首次点击 / 按键解锁音频后才显示菜单（调试入口 `?stage` 等跳过标题，由 window 级监听在第一次操作时解锁）。

### 配乐（`sequencer.js` / `songs.js` / `music.js`）

- 场景只调用 `playMusic(场合 | 曲目id, opts?)`（`music.js`）：同一首正在播放（或等待开始）时直接返回，不会从头重播，所以可以放心重复调用。
  场合表 `OCCASION`：`title` / `story`（剧情、中国地图）/ `camp`（营中）/ `council`（军议、整备）/ `battle`（未登记关卡的战斗曲）/ `crisis` / `duel` / `victory` / `defeat` / `ending`。
  未解锁时调用也可以：曲目登记为待播，解锁后自动开始。
- 接入点：`TitleScene.create`（`title`，渐入）；`StoryScene.onBg`（`StoryRunner.bg` 换背景时回调：中国地图 → `story`，开场其余背景 → `council`，结尾的 `tent` / `camp` → `camp`、其余 → `story`；
  叠加在战场上的结尾场景第一张背景不换曲，沿用胜利曲）；`CampScene.create`（`camp`）；`BattleScene.start`（整备 `council` → 开战 `updateMusic()`）；
  `BattleScene.updateMusic()`（本关战斗曲 `battleMusic(stageId)`，`isCrisis` 为真时 `crisis`；在 `resume`、`startPhase`、`checkEnd` 未结束时调用，战斗结束后与单挑期间不处理）；
  `runDuel`（`duel`，`finally` 中恢复）；`victory`（横幅前与战果面板前 `victory`）；`defeat`（`defeat`）；`EndingScene.create`（`ending`）。读档进入各场景时按上面的规则自然播放对应曲目。
- 每关战斗曲 `BATTLE_MUSIC`：按原版各关战斗曲（research/audio.md §3.1，`ORIGINAL` 表）归类——暴走 / 急袭 → `battle1`、霸道 / 互角 → `battle2`、舌战 → `battle3`、大战 / 暗云 → `decisive`。
  新增关卡要在 `ORIGINAL` 中登记（缺失时用 `OCCASION.battle`）。我军 / 友军 / 敌军阶段不换曲。
- 危急判定 `isCrisis({ stage, units, turn }, prev)`（纯函数）：曹操、`stage.protect`、`reach` 条件指定的我军单位兵力低于 30%（已危急时回到 50% 以上才解除），或离 `stage.turns` 不到 2 回合（有 `survive` 胜利条件的关卡不算）。
- 音序器：每 25ms 检查、提前 100ms 排程；每首曲子一个增益节点 → `musicBus`（计入 `activeNodes`，渐出且余音结束后断开）。切换时旧曲渐出，新曲在旧曲下一小节线（超过 `maxWait` 秒则立即）渐入。
  `engine.ready` 为假（未解锁 / 后台挂起）时不排程；主线程卡顿错过的音符直接丢弃，不补发；静音或配乐音量为 0 时照常走拍但不发声。
- 曲目（`songs.js`，纯数据）：五声音阶原创，不模仿原版旋律。简谱语法见 `sequencer.js` 顶部注释（`_` 八分、`__` 十六分、`.` 附点、`-` 延长一拍、`'` / `,` 八度、`x` / `X` 打击乐、`~` 琵琶轮指）；
  每小节长度由 `compileSong` 校验（不对时 `console.warn`），`validate-stages.mjs` 同样校验各声部小节长度、场合与每关战斗曲登记（报错）。打击乐的 `pitch` ≤ 127 按 MIDI 号、否则按 Hz 解释（锣的低音写 MIDI 号，不要写 100 这类会被当成 MIDI 的 Hz 值）。
  新曲先用 `__musicTest(id)` 试听，并对照现有曲目的响度调整 `gain`（`AnalyserNode` 接在 `musicBus` 上测 RMS，战斗类约 0.05–0.08、抒情类约 0.03–0.05，配乐音量 70 时）。

## 反模式

- 导入图片/音频文件或新增 `assets/` 目录：所有图形都是程序生成的。
- 地图位置写死像素值，而不是用 `TILE`/`MAP_X`/`MAP_Y`/`tileCenter`。
- 用 `pointer.worldX/worldY` 或 `WIDTH/HEIGHT`、整张地图尺寸摆放地图层对象（应换算镜头 / 用 `viewRect`）；把界面对象放到地图层 depth。
- 假设地图为 18×13：尺寸一律从 `map` 取（`logic.mapCols/mapRows`），`inMap(x, y, map)`、`attackTiles(map, u)`、`spellTiles(map, u, id)` 都要传地图。
- 创建贴图前不检查 `textures.exists(key)`（会泄漏，或报重复 key 错误）。
- 弹窗关闭后键盘监听仍未移除。
- 只靠悬停（`pointerover` / `pointermove`）、右键、键盘提供的功能或信息，没有触屏途径（见“触屏输入”）。
- 在 `pointerdown` 里打开文件选择、触发下载或请求全屏（触屏的 down 来自 `touchstart`，不算用户激活）。
