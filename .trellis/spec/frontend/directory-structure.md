# 目录结构

> 代码如何组织：`src/` 下是扁平的原生 ES 模块，不按功能分文件夹。

---

## 目录布局

```
index.html              # <div id="game">，加载 /src/main.js
src/
├── main.js             # new Phaser.Game({ scene: [TitleScene, BattleScene, EndingScene] })
├── config.js           # TILE/VIEW_COLS/VIEW_ROWS（地图视口 18×13）/MAP_X/MAP_Y/WIDTH/HEIGHT、字体、COLORS、RES + hiDpi()
├── terrain.js          # 30 种地形 TERRAIN（一字符一格）、按兵种系列的 TERRAIN_RULES（能力修正 / 移动消耗）、moveCost/passable/terrainDef（纯数据）
├── data.js             # 静态规则表：TERRAIN（再导出）、RANGES、SERIES（兵种系列与阶级）/ classOf、ADVANTAGE、SPELLS、ITEMS、DIFFICULTIES
├── spells.js           # 策略表 SPELLS 与各系列习得表 SPELL_LEARN（纯数据，data.js 再导出）
├── status.js           # 异常状态与增减益：effStats、tickStatus、各种判定（纯函数）
├── weather.js          # 天气表 TABLE / 关卡天气 STAGE_WEATHER、随机游走 stepWeather、天气策略 weatherSpellIdx（纯函数，Node 可导入）
├── equipment.js        # 装备与宝物：EQUIP / KINDS、装备属性与特效查询（fx/fxSum）、初始装备、奖励 REWARDS / 掉落 DROPS / 商店 SHOP_UNLOCK（纯函数）
├── logic.js            # 纯规则：属性计算、Dijkstra 移动范围、伤害/命中、策略结算、AI 决策（不依赖 Phaser）
├── actions.js          # 作用于场景的异步战斗行动：doAttack/doSpell/doItem/killUnit/runAI
├── battleStage.js      # 战场演出：事件 stage 指令（镜头 / 走位 / 高亮 / 地形变化 / 转向 / 动作）、援军走入路线 entryRoute、mapPatches
├── stageMeta.js        # normalizeStage（mapVersion 默认 1）、PLANNED_IDS、FIRST_STAGE、ENDINGS、MAP_SIZES（各关原版地图尺寸）
├── stages.js           # 汇总 stages/a..f.js → STAGES、getStage（也能取到调试关卡）、routeOf、resolveNext
├── stages/
│   ├── helpers.js      # 单位工厂 P / E / A
│   ├── debug.js        # 调试关卡 DEBUG_STAGES（test_bigmap 40×40 测试地图），不在 STAGES 中，用 ?stage=<id> 进入
│   └── a.js … f.js     # 每组关卡一个文件（A–F），default 导出关卡对象数组
├── characters.js       # 按中文名登记的外形表 BASE + 合并 extra_a..f；兵种登记 CLASS_BY_NAME；颜色工具函数
├── characters/extra_<组>.js  # 各组补充的武将外形（default 导出对象）
├── generals.js         # 武将总表 GENERALS（默认兵种、bonus、阵亡/离队标记、joinAt），纯数据
├── deploy.js           # 出阵推导 planDeploy / buildPlayerDefs、商店货架 shopStock（纯函数，不依赖 Phaser）
├── saves.js            # localStorage 存档位/自动存档、导出导入、applyLoad
├── saveMenu.js         # 存档/读档弹窗 UI（openSaveMenu）
├── prep.js             # 整备弹窗 UI（openPrep）：阵容 / 装备 / 道具 / 商店四页
├── rewardPanel.js      # 过关战果弹窗（openRewards，返回 Promise）
├── infoPanel.js        # 部队情报弹窗 UI（openInfo）
├── ui.js               # panel/text/button/portrait/DialogBox/floatText/wait
├── hud.js              # class Hud：顶栏、右侧面板、日志、横幅
├── unitView.js         # class UnitView：单个单位的容器、兵力条、移动/受击补间；tileCenter
├── mapRender.js        # drawMap：用 Graphics 绘制 30 种地形，分块烘焙
├── mapCamera.js        # class MapCamera：地图层 / 界面层两台相机、滚动（拖动 / 键盘 / 边缘）、panTo / follow、坐标换算
├── minimap.js          # class Minimap：小地图（地形、单位、视口框，点击跳转）
├── heroSprites.js      # Canvas 2D 战场小人（unitTexture）、共用绘图工具 kit()
├── portraits.js        # Canvas 2D 头像（portraitTexture）
├── attackFx.js / spellFx.js / duel.js  # 攻击、策略/道具（含四神）、单挑过场动画
├── weatherFx.js        # class WeatherFx：天气粒子（≤ 200）/ 阴天遮罩 / 切换动画；顶部栏天气图标 drawWeatherIcon
├── audio/              # 声音：Web Audio 实时合成，没有音频文件（约定见 scene-and-rendering.md「音频」）
│   ├── engine.js       # AudioContext 单例、主音量 / 配乐 / 音效总线、混响、解锁与后台暂停、节点计数
│   ├── instruments.js  # 乐器音色（古筝 / 琵琶 / 笛子 / 二胡 / 编钟 / 大鼓 / 小鼓 / 锣），统一签名，配乐复用
│   └── sfx.js          # 音效表 sfx(name, opts)、8 声部上限、spellSchool / stepKind
├── camp/               # 营中（两关之间自由走动）：纯数据 + 纯函数，Node 可导入（props.js 除外）
│   ├── layouts.js      # 布局 LAYOUTS（军营 / 城镇 / 府邸 / 野营 / 水寨）、CAMP_OF 关卡 → 布局、通用角色外形 FOLK、layoutGrid / checkLayout
│   ├── talks.js        # 汇总 talks_a..f.js（本关专属台词，键为下一关 id）与 generic.js（通用台词），pickTalk 选台词
│   ├── talks_<组>.js / generic.js  # 台词数据（格式见 docs/STAGE_GUIDE.md §13）
│   └── props.js        # 营门、营帐、篝火、货摊等物件的 Graphics 绘制
├── story/              # 剧情场景（关与关之间的演出）
│   ├── defs.js         # 纯数据 + 纯函数：等角坐标、背景表、中国地图视野 / 城市、各关地点、动作 / 表情、指令表、checkScript（Node 可导入）
│   ├── auto.js         # sceneFor / autoScene：手写 scenes 优先，否则由 prologue / epilogue(s) 生成脚本（纯函数，校验脚本逐关检查）
│   ├── backgrounds.js  # Canvas 2D 程序化背景（外场景 / 内场景 / 中国地图），烘焙为 sbg-* 贴图
│   ├── actors.js       # StoryActor：剧情小人（drawHuman 的姿态参数 S）、表情气泡，贴图 st-*
│   ├── runner.js       # StoryRunner 指令解释器、StoryDialog；中国地图头像 / 箭头 / 文字的避让布局
│   ├── flow.js         # 关卡之间的跳转：goStage / afterPre / goCamp / goNext（胜利后进营中）/ playPost
│   ├── path.js         # 等角网格 A* 寻路 findPath（八方向、不切拐角、目标被占时走到旁边；纯函数，Node 可导入）
│   └── demo.js         # 演示脚本（?scene=demo / gallery / poses）
└── scenes/
    ├── TitleScene.js   # key 'Title'
    ├── BattleScene.js  # key 'Battle'：回合循环、输入、事件、胜负
    ├── StoryScene.js   # key 'Story'：执行剧情场景脚本，开场 / 结尾 / 预览；跳过与加速
    ├── CampScene.js    # key 'Camp'：营中行走（点击寻路 / 方向键）、对话、整备 / 商店、存档、营门出征
    └── EndingScene.js  # key 'Ending'
scripts/validate-stages.mjs  # 关卡数据的 Node 校验脚本（直接导入 src/ 模块）
scripts/mapgen/              # 关卡地图重做工具：画图库、预览、写回、行军分析、与 HEAD 结构比较（用法见 STAGE_GUIDE §4）
scripts/ai-battle.mjs        # 浏览器 AI 完整对战（planAI 驱动双方），难度复核与回合上限依据
scripts/test-path.mjs        # 营中寻路与布局连通性测试（Node）
scripts/camp-smoke.mjs       # 浏览器营中回归（逐关进营中、对话、整备、出征）
docs/STAGE_GUIDE.md          # 关卡编写的权威规范
GQ.md                        # 与 1998 原版对照的关卡清单
```

---

## 依赖方向

```
spells.js → data.js → status.js、equipment.js、config.js、stageMeta.js   （底层表，不导入其他游戏代码）
        ↑
logic.js（规则）   stages/*.js（数据）   characters.js（外形）
        ↑
actions.js、ui.js、hud.js、unitView.js、*Fx.js、heroSprites.js、portraits.js
        ↑
scenes/*.js
```

- `logic.js` 只导入 `config.js`、`data.js`、`status.js`、`equipment.js` 以及纯数据的 `generals.js` / `characters.js`（兵种覆盖 `roleOf`）；保持不依赖 Phaser、不访问场景，规则才能复用
  （AI 决策和 HUD 攻击预测调用的是同一批函数）。
- `stageMeta.js`、`stages/*.js`、`spells.js`、`terrain.js`、`data.js`、`status.js`、`characters.js`、`generals.js`、`equipment.js`、`deploy.js`、`weather.js` 必须能被 Node 直接导入：
  `scripts/validate-stages.mjs` 会直接 import 它们。这些文件里不要导入 `phaser`，也不要访问 `window`/`localStorage`。
- 只有场景负责把各模块串起来。

---

## 新代码放哪里

| 改动 | 位置 |
|------|------|
| 新关卡 | 所属组的 `src/stages/<a-f>.js`（见 `docs/STAGE_GUIDE.md` §1）；id 必须在 `PLANNED_IDS` 中 |
| 新的具名武将外形 | 首次引入该人物的组的 `src/characters/extra_<组>.js` |
| 新兵种/道具/难度 | `src/data.js` 中对应的表（绘制补在 `heroSprites.js`/`spellFx.js`）；新兵种系列要在 `terrain.js` 的 `RAW` 补地形规则 |
| 地形规则 / 新地形 | `src/terrain.js`（`LIST` 与 `RAW` 按原版编号排列），绘制补在 `mapRender.drawDetail`，图例同步 `docs/STAGE_GUIDE.md` §4 |
| 新策略 / 习得调整 | `src/spells.js` 的 `SPELLS` / `SPELL_LEARN`；新效果类型在 `logic.js` 的 `resolveSpell` / `applySpell` 与 `spellFx.js` 的 `hitFx` 中补充 |
| 新异常 / 增减益 | `src/status.js`（`STATUS`、`tickStatus`、判定函数），图标在 `unitView.updateStatus` |
| 新规则或公式 | `src/logic.js` 中导出的纯函数 |
| 新装备 / 宝物特效 | `src/equipment.js` 的 `EQUIP`（新特效类型补 `FX_DESC`，在 `logic.js` / `actions.js` 用 `fx` / `fxSum` 读取）；图标按种类在 `spellFx.js` 的 `drawGear` |
| 天气规则 / 关卡开局天气 | `src/weather.js`（`TABLE`、`STAGE_WEATHER`；关卡也可写 `weather: { type, start }`）；画面在 `weatherFx.js` |
| 关卡奖励 / 掉落 / 商店上新 | `src/equipment.js` 的 `REWARDS` / `DROPS` / `SHOP_UNLOCK`（校验脚本检查引用） |
| 新的带动画的战斗行动 | `src/actions.js`（async，接收场景 `s`） |
| 新的可复用控件 | `src/ui.js` 中的工厂函数 `(scene, x, y, ...)` |
| 新画面 | `src/scenes/<Name>Scene.js`，并在 `main.js` 的 scene 数组中注册 |

---

## 命名

- 模块用 camelCase（`saveMenu.js`、`heroSprites.js`）；场景文件和类用 PascalCase
  （`BattleScene.js` / `class BattleScene`）。场景 key 是短字符串：`'Title'`、`'Battle'`、`'Ending'`。
- 关卡 id 用拼音 snake_case，保持稳定（`xuzhou_fuchou`、`z_dingjun`、`j_jianye`）。忠臣线前缀 `z_`，奸雄线前缀 `j_`。
- 常量用 UPPER_SNAKE_CASE（`PLANNED_IDS`、`SLOT_COUNT`、`TILE`）。
