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
- 地图坐标：格子 `(x, y)` → 像素 `MAP_X + x*TILE`、`MAP_Y + y*TILE`；格子中心用 `unitView.js` 的
  `tileCenter(x, y)`，反向换算用 `BattleScene.tileAt(pointer)`。

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
| 0 | 地图（`drawMap` 烘焙成的 `map-bake` 贴图 Image） |
| 4–6 | 目标格、高亮 `hl`、光标 |
| 10 + y | 单位容器（按行排序） |
| 50–52 | HUD 顶栏、面板、HUD 按钮 |
| 600 | 指令菜单 |
| 800–801 | 横幅 |
| 900–951 | 飘字、败北遮罩、单挑 |
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
- 地图格子用 `Graphics` 绘制，配合确定性伪随机 `rnd(x, y, i)`，保证每次加载外观一致；画完后按 `RES` 倍
  烘焙进 DynamicTexture（`map-bake`）并销毁 Graphics。大量静态 Graphics 指令在 WebGL 下每帧都会重新处理，
  静态内容一律烘焙。

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

## 反模式

- 导入图片/音频文件或新增 `assets/` 目录：所有图形都是程序生成的。
- 地图位置写死像素值，而不是用 `TILE`/`MAP_X`/`MAP_Y`/`tileCenter`。
- 创建贴图前不检查 `textures.exists(key)`（会泄漏，或报重复 key 错误）。
- 弹窗关闭后键盘监听仍未移除。
