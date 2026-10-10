# 设计：剧情场景演出

## 模块
- `src/scenes/StoryScene.js`（新 Phaser 场景）：执行场景脚本，结束后跳转（整备 / 战斗 / 军营 / 结局）。
- `src/story/backgrounds.js`：程序化背景绘制函数。
  - 外场景用渐变天空、远山、地面纹理、树、城墙剪影组合。
  - 内场景用等角地板网格、柱子、屏风、帐篷、案几。
  - 中国地图用程序绘制的河流、山脉轮廓和州名。
- `src/story/actors.js`：
  - `StoryActor` 视图：复用 `heroSprites` 的绘制，新增“场景姿态”参数，生成四方向、多动作的贴图（贴图 key 带姿态）；
  - 等角坐标换算（research：`x = (a − b) × 8 + 312`、`y = (a + b) × 4 − 216` 的思路，按本项目尺寸缩放）。
- `src/story/runner.js`：指令解释器。每条指令是 async 函数，复用 `DialogBox`（对白、选项）。
- `src/story/auto.js`：`autoScene(stage, 'pre' | 'post')`，按关卡章节、名称关键词（关、城、营、江、原等）选背景；说话人站位用预设阵型。

## 指令格式（纯数据，可被 Node 校验）
```js
{ bg: 'camp', place: '许昌 曹操军主营' }
{ chapter: '第一章 霸王诞生' }
{ actor: '曹操', at: [a, b], face: 'down' }
{ move: '曹操', to: [a, b] }        // 可加 wait: false，实现多人同时移动
{ face: '曹操', dir: 'left' }
{ act: '夏侯惇', pose: 'bow' }
{ emote: '许褚', icon: 'anger' }
{ say: [对白行...] }                 // 沿用现有对白格式，含 choices
{ narr: '……' }
{ wait: 500 }
{ fade: 'out' }
{ map: { show: '曹操', at: [x, y] } }
{ arrow: [[x1, y1], [x2, y2]] }
{ exit: '曹操' }
```

## 战场演出（BattleScene / 事件）
- 事件新增可选字段 `stage: [指令]`，指令包括：
  `{ camera: [x, y] }`、`{ walk: id, path: [[x, y], ...] }`、`{ highlight: [[x, y], ...] }`、`{ terrain: { at: [x, y], set: '门' | '火' | '船' } }`、`{ face: id, dir }`、`{ act: id, pose }`。
- 援军：`spawn` 时若定义了 `from`（地图边缘的格子），单位从该格走到目标位置；没有定义时，默认从最近的地图边缘走入。
- 地形变化：改写 `map` 中对应格的字符，重绘地图格；会影响移动和防御。为此 `this.map` 改为每局复制一份可修改的二维数组，并写入存档（`mapPatches`）。

## 流程调整
- `TitleScene` 新游戏 → `StoryScene(pre)` → `BattleScene`（整备 → 战斗）。
- `BattleScene.victory` → `StoryScene(post)` → 下一关的 `StoryScene(pre)`；子任务 8 会在两者之间插入军营。
- 现有的 `prologue` / `epilogue` 保留为数据来源，由 auto 生成场景；有手写 `scenes` 时优先使用手写。

## 校验
- 校验脚本：指令名合法、人物名已登记或为通用角色、背景名存在、坐标在场景范围内、战场演出的坐标在地图内。
