# 设计：适配移动端

## 第三方库：不引入

结论：全部用 Phaser 4.2.1 内置能力 + 少量原生浏览器 API，不新增依赖（`quality-guidelines.md` 也禁止无明确任务时新增依赖）。

| 需求 | 候选库 | 选择 | 理由 |
|------|--------|------|------|
| 全屏 | screenfull | Phaser `scale.startFullscreen()` | 已处理厂商前缀、成功 / 失败事件，并在全屏后自动 `refresh()` 重新适配 |
| 横屏锁定 | — | 原生 `screen.orientation.lock` | Phaser `scale.lockOrientation` 只调用已废弃的 `screen.lockOrientation`，现代浏览器无效（已读源码确认） |
| 竖屏检测 | — | CSS 媒体查询 | 纯样式即可，无需脚本 |
| 触摸 / 鼠标区分 | Hammer.js | Phaser `pointer.wasTouch` | Phaser 已统一指针事件；再挂一套手势库会与 Phaser 输入争抢事件 |
| 高清渲染 | @sparkade-labs/phaser-hidpi | 现有 `config.js` 的 `RES` / `hiDpi()` | 项目已实现同类方案：画布按 `WIDTH*RES` 创建、镜头放大 `RES`、文字 `setResolution(RES)`，世界坐标不变；该库要求所有坐标 / 字号 / 线宽改写为 `px(n)`，与现有方案冲突且改动遍及全部文件。手机横屏估算（未实机测量）：844×390 视口、DPR 3 时画布显示约 2088×1170 物理像素，`RES=2` 的绘制缓冲 2400×1344 已超过显示尺寸，不会发虚 |
| 虚拟摇杆、双指缩放地图 | phaser3-rex-plugins | 不做 | 用户确认只需手指点击 / 拖动；营中点击行走已可用 |

## 两种“触屏”判定

- **设备级** `IS_TOUCH`（`config.js` 新增导出）：`matchMedia('(pointer: coarse)').matches`。只用于决定显示哪套说明文字、是否创建“取消”按钮。主指针为鼠标的触屏笔记本仍按桌面处理。
- **事件级** `p.wasTouch`（Phaser `Pointer` 字段，触摸事件时为 true）：用于行为分支（补刷悬停、二次确认、边缘滚动、天气说明保持）。这样同一设备混用鼠标和触摸时，各自走正确的分支。

## Phaser 触屏事件语义（已读 `node_modules/phaser/src/input/InputPlugin.js` 确认）

- `TOUCH_START`：down + over；`TOUCH_END`：up + out；只有 `TOUCH_MOVE` 才有 move。
- 因此单击不会触发场景 `pointermove`；悬停类 UI 在抬起时被 `pointerout` 还原。
- `InputManager.isOver` 只由鼠标进出画布维护，触屏时一直为初始值 true。

## 改动点

| 文件 | 改动 |
|------|------|
| `index.html` | viewport 加 `maximum-scale=1, user-scalable=no`；`body` / `#game` 加 `touch-action:none`、`user-select:none`、`-webkit-touch-callout:none`、`-webkit-tap-highlight-color:transparent`；高度用 `100dvh`（保留 `100%` 兜底）；在 `#game` 内新增 `#rotate` 遮罩 DOM；`html, body` 加 `overscroll-behavior:none`；加 `apple-mobile-web-app-capable` / `mobile-web-app-capable` meta，“添加到主屏幕”后全屏（放在全屏目标内，全屏后仍可见） + CSS 媒体查询 `(orientation: portrait) and (pointer: coarse)` 时显示 |
| `src/config.js` | 导出 `IS_TOUCH` |
| `src/main.js` | 游戏配置 `scale.fullscreenTarget: 'game'`；`IS_TOUCH` 时：首次 `touchend` 调 `game.scale.startFullscreen()`，`ENTER_FULLSCREEN` 后再 `screen.orientation.lock('landscape')`（`catch` 忽略，只尝试一次）；阻止 iOS `gesturestart` 缩放 |
| `src/mapCamera.js` | `update` 中边缘滚动条件追加 `!p.wasTouch`；新增 `DRAG_TOUCH = 18`，`move` / `release` 按 `p.wasTouch` 取阈值 |
| `src/ui.js` | `button()` 增加可选第 8 参数 `opts`，`opts.onRelease` 为真时：触摸按下只阻止冒泡，在该按钮上抬起才触发 `onClick`（鼠标仍在按下时触发） |
| `src/saveMenu.js` | “导　入”“导出全部”及每个存档行的“导出”按钮传 `{ onRelease: true }`（文件选择 / 下载需要 `touchend` 带来的用户激活） |
| `src/scenes/BattleScene.js` | ① `up`：`p.wasTouch` 时先 `onHover(p)` 再 `onClick(p)`；② `onClick` 目标分支：触屏且可执行时，若 `touchAim` 不是该格 → 记下并在预测区追加“再点一次确认”，返回；③ 进入 / 离开目标状态（`chooseTarget`、`cancel`、`clearSelection`）清空 `touchAim`；④ `IS_TOUCH` 时创建“取消”按钮，`update()` 中按状态切换可见；⑤ 选目标提示按设备换文案 |
| `src/hud.js` | 天气说明 `pointerout` 在 `p.wasTouch` 时不还原 |
| `src/scenes/TitleScene.js` / `CampScene.js` / `StoryScene.js` / `src/prep.js` | 说明文字按 `IS_TOUCH` 切换 |

## 取消按钮

- 用 `ui.js` 的 `button()`，标签“取　消”（以“取消”开头 → 自动播放取消音效）。
- 位置：与“结束回合”按钮同位置、同尺寸（右侧面板底部 `PANEL_X + 20, HEIGHT - 58`），深度 53。显示取消时隐藏“结束回合”，反之亦然。
  不放在地图上：地图左下角放 96×40 会盖住 (0,12)、(1,12) 两格，18×13 小地图关卡无法滚开，单位走不到。选中单位期间“结束回合”本就不该点。
- 按钮 `pointerdown` 自身 `stopPropagation`，不会穿透成地图点击。
- 回调与右键一致：`if (!this.dialog.root.visible && !this.modal && this.state !== 'busy' && !this.over) this.cancel()`。
- 可见性（取消按钮显示 ⇔ 结束回合按钮隐藏）：`update()` 每帧设置 `['move','menu','target'].includes(state) && !dialog可见 && !modal && !over`。

## 二次确认细节

- `touchAim` 存目标格键 `key(x, y)`；第一次点击只走 `onHover`（已显示预测与 AoE 预览），并由 `aimAt(t)` 在目标格上方显示地图层标签“再点确认”（depth 40，第 0 行时放在格子下方）。
  不追加到右侧预测区：预测区只容得下 3 行（y 392~449，下方 450 为分隔线、458 为日志），攻击预测带反击时已是 3 行，实测追加后底部到 469 会压住日志。
- 选目标提示（触屏）带策略 / 道具说明：最长说明 44 字 + 提示实测底部 449，未溢出。
- 只拦截“会执行”的分支（`inRange && u && validTarget(u)`）；不可选目标的报错提示分支保持原样。
- 鼠标点击（`!p.wasTouch`）不受影响。

## 已排查、无需改动的输入入口

- 所有弹窗（部队、存档、设置、整备、图鉴、难度、出征确认、战果）的 ESC / ←→ / 回车 / 空格都有对应屏幕按钮或点击遮罩。
- 小地图 `M` 键有切换按钮；剧情点击推进、按住加速对触屏同样有效；营中点击行走 / 点人对话可用。
- 指令菜单不可用按钮：触屏按下时 `pointerover` 显示说明，抬起的 `pointerout` 只重绘按钮不清预测区，说明会保留。
- 整备装备对比：背包行副标题已显示 `diffText` 能力差值，触屏无需悬停预览。
- 音频解锁已监听 `touchend`。

## 兼容与回滚

- 所有行为分支都以 `p.wasTouch` / `IS_TOUCH` 为前提，桌面路径代码不变。
- 回滚：还原上述文件即可，无存档 / 数据结构变化。
