# 状态管理

> 没有状态管理库。状态分三层：Phaser `registry`（整个战役）、`BattleScene` 字段 + 普通单位对象
> （单场战斗）、`localStorage`（存档）。

---

## 1. 战役状态：`scene.registry`

通过 Phaser 的全局数据 registry 在场景间共享。当前使用的 key：

| Key | 结构 | 写入位置 |
|-----|------|----------|
| `difficulty` | `'normal' \| 'hard' \| 'hell'` | `TitleScene.chooseDifficulty`、`applyLoad` |
| `roster` | `{ [我军单位id]: { lvl, exp, cls, tier, equip?: { weapon, armor, acc }（背包 uid 或 null）, fruits?: { [能力]: 个数 } } }`（`tier` 阶级 1~3，旧存档缺失时 `applyLoad` 补为 1；`cls` 仅作记录，兵种以武将总表为准）。**只有带 `lvl` 的条目才算成长记录**：首次出阵前 `kitFor` / 整备可能先写入只有 `equip` / `fruits` 的条目，`createUnit` 与 `planDeploy` 用 `saved?.lvl` 判断是否沿用 `tier` | `BattleScene.victory`（合并写入，保留 `equip` / `fruits`）、`BattleScene.kitFor`、整备（`prep.js`）、`applyLoad` |
| `joined` | `[武将id]`，已加入的武将（`generals.js` 总表武将与招募单位 `rec<n>`；过滤用 `isGeneral`，读档时必须先 `setRecruits` 再过滤） | 新游戏（`[]`）、`BattleScene.victory`、`applyLoad`（旧存档缺失时用 `roster` 的键推导） |
| `items` | `{ [道具id]: 数量 }`（id 见 data-contracts 的 `ITEMS`；`seal` 印绶从 `SEAL_FROM` 关起每关胜利 +1，另按关序轮流获得一件 `LOOT` 战利品） | 新游戏、`victory`（加上 `difficulty.reward`、印绶与战利品）、`applyLoad`（`migrateItems` 迁移旧道具） |
| `red` | 整数，红色指数 | `applyChoice`、`victory`、`applyLoad` |
| `flags` | `{ [标记名]: true }` | `setFlag`、`applyLoad` |
| `inventory` | `[{ uid, id, lvl, exp }]`，全部持有的装备实例（含已装备的；`id` 见 `EQUIP`，宝物唯一） | 新游戏（`[]`）、`kitFor`（补发初始装备）、整备（买卖）、`victory`（写回熟练度并加入掉落与奖励）、`applyLoad`（缺失为 `[]`） |
| `gold` | 整数，军资金 | 新游戏（`START_GOLD` = 1000，见 `recruit.js`；地图更新重开第一关同）、整备商店与招募页、`victory`（`goldFor(曹操等级)` + 奖励金钱）、`applyLoad`（缺失为 0） |

| `recruits` | `{ [rec<n>]: { name, cls, kind: 'general' \| 'soldier', bonus } }`，招募单位定义；`generals.js` 的 `RECRUITS` 是它的模块级镜像（`isGeneral` / `generalOf` 读镜像） | 新游戏（`{}`）、招募（`recruit.recruitUnit`，同时写 `roster` / `joined`）、`applyLoad`（缺失为 `{}`）。**三处都必须调用 `setRecruits`** |
| `recruitPool` | `{ stageId, names: [武将名], refreshLeft }` 当前关卡间隙的武将候选（每批 4 名，刷新 3 次，`stageId` 变化时 `ensurePool` 换批重置） | 新游戏（`null`）、`BattleScene.create` / `CampScene.create` / 胜利写自动存档前（`ensurePool`）、招募页刷新、`applyLoad`（缺失为 `null`） |

| `cheated` | 布尔，本周目是否用过金手指（永久标记，关掉开关也不清除） | 新游戏（`false`）、`cheat.markCheat`（金手指总开关打开时：`BattleScene.create` / `CampScene.create`、战斗 / 营中设置面板切到“开”）、`applyLoad`（缺失为 `false`）；地图版本重开时保留存档的标记 |

- 新游戏（`TitleScene`）在 `scene.start('Battle', { stage: FIRST_STAGE })` 之前会重置**全部十一个** key（并 `setRecruits({})`）。
  候选必须在可存档之前生成（`ensurePool`），否则读档会换批、绕过刷新次数限制。
  新增 key 时，要在这里重置，并在 `saves.applyLoad` 中恢复。
- 写入时一律写副本：`this.registry.set('flags', { ...this.flags })`、`items = { ...this.items }`。

## 2. 战斗状态：`BattleScene` 字段

`create()` 按优先级 `load` 快照 → registry → 关卡默认值 构建所有状态：

```js
this.items = { ...(load?.items || this.registry.get('items') || this.difficulty.items) };
this.red   = load?.red ?? this.registry.get('red') ?? 0;
// 新战斗：我军由出阵推导生成，敌军/友军按关卡数据生成；读档时直接恢复 load.units
this.deployPlan = planDeploy(stage, { roster, joined, flags: this.flags });   // src/deploy.js
this.units = [...buildPlayerDefs(plan, plan.defaults).map((d) => createUnit(d, roster[d.id], diff)), ...敌军与友军];
```

- 出阵整备：开场对白后 `startPrep()` 打开整备界面（`src/prep.js`），阵容与默认不同时重建我军单位与视图；
  读取战斗中存档时 `deployPlan` 为 `null`，跳过整备。推导规则见 `docs/STAGE_GUIDE.md` §3 与 `stage-data.md`。

主要字段：`stage`、`stageId`、`map`、`units`（普通对象数组）、`views`（`Map<unit, UnitView>`）、
`turn`、`phase`（`'player' | 'ally' | 'enemy'`）、`state`（输入状态机）、`sel`（当前选择）、
`firedEvents`（`Set<事件下标>`）、`flags`、`red`、`items`、`joined`（含本关预设 / `joinAt` 加入的武将）、
`deployPlan`、`mapPatches`、`over`、`modal`、`weatherType`（本关天气类别 0~4，取 `stageWeather(stage)`）、`weatherIdx`（当前天气序号 0~5）。

- 天气：当前天气用 getter `this.weather`（= `weatherOf(weatherType, weatherIdx)`，`src/weather.js`）读取，不单独保存。
  开局序号取关卡起始值；第 2 回合起每到我军阶段开始 `stepWeather` 变化一次；天气策略经 `changeWeather(idx)` 修改。
  `changeWeather` 只在实际天气改变时播放 `weatherFx.transition`、更新顶部栏并记日志。AI 通过 `planAI(map, units, u, s.weather)` 拿到天气。

- 单位是**可变的普通对象**；逻辑直接修改 `u.x/u.y/u.hp/u.mp/u.alive/u.acted/u.ai`，再调用对应的视图方法。
  没有事件总线或观察者。
- 单位从不从 `units` 中移除；撤退/撤离只设置 `alive = false`（以及 `escaped = true`）。处处用 `u.alive` 过滤。
- 装备：`create()` 复制 `this.inventory` / `this.gold`；我军武将的单位持有装备实例副本 `u.equip`（`kitFrom`），没有装备记录时 `kitFor` 按 `issueKit` 生成初始装备并**立即**写入 registry；敌军 / 友军 / 临时成员用 `defaultKit`（无 uid）。战斗中的熟练度、掉落（`dropLoot` → `this.gained`）只改副本，胜利时按 uid 写回；败北重开时丢弃。整备中的换装、吃果子、买卖立即写入 registry（重新挑战时保留）。
- 我军成长只在胜利时写入 `roster`（`{ lvl, exp, cls, tier }`），同时把本关我军武将并入 `joined`。败北/重新挑战会按 registry 状态重开本关
  （`scene.start('Battle', { stage: this.stageId })`）。
- 阶段顺序：我军 → 友军 → 敌军 → `turn += 1`；`survive` 和 `turns` 回合上限在 `nextPhase` 中检查。

## 3. 持久化：`src/saves.js`

| localStorage key | 内容 |
|------------------|------|
| `sanguo-slots` | 100 个手动存档位的数组（`SLOT_COUNT`），`null` 表示空 |
| `sanguo-save` | 单个自动存档：每关胜利后由 `victory()` 写入 `kind: 'camp'`（下一关、`talked: []`，读取回到营中；没有下一关时仍为 `'stage'`）；营门出征时由 `CampScene.depart` 覆盖为 `kind: 'stage'`（含营中选项后的状态与 `deploy`，读取播下一关开场） |
| `sanguo-legacy` | 二周目继承（`legacy.js`）：`{ endings: { villain?, middle?, loyal? }, codex: [宝物id] }`，不随单个存档。结局在 `EndingScene` 记录（调试关卡不记）；中间路线 = 马超迎击战分路时 `routeOf(red) === 'middle'`（`victory` 写标记 `route_middle`，剧情走奸雄线，`goNext` 进结局时换成 `middle`）。图鉴在得到宝物时登记（`kitFor` / 营中补发初始装备、`dropLoot`、胜利奖励、读档时持有的宝物）。新游戏第一关开场 `goStage(..., { ngplus: true })`，`StoryScene` 按结局数 / 图鉴插入许劭的选项，`grantNgPlus` 写入 `roster.caocao`（升级）/ `gold` / `inventory`（全部宝物）。全部导出带 `legacy`，导入时合并（结局取或、图鉴取并集） |

- 存档类型 `kind`：`'stage'`（关卡开头，营门出征时的自动存档；读取后先播开场场景，不经过营中，`deploy` 经 `BattleScene` → `StoryScene` 带进整备；旧存档没有 `deploy`，行为不变）、`'battle'`（战斗中）、`'camp'`（营中，见下）。

- 战斗中存档来自 `BattleScene.snapshot()`（`kind: 'battle'`）：关卡、`mapVersion`、回合、道具、红色指数、标记、roster、
  `joined`、`firedEvents`、`weatherIdx`、`mapPatches`、`start`（本关开头的 `red` / `flags`，重新挑战时恢复，旧存档缺失时取存档值）、`inventory`、`gold`，以及**去掉 `stats` 的** `units`（单位自带 `tier`，`status` / `buffs` / `equip` / `fruits` 复制一份写入）；读档时用 `restoreUnit` 重新计算属性
  （旧存档单位缺 `tier` 时我军视为一阶、其他按难度门槛定阶，兵种按武将总表 / 登记表覆盖）。
  不要持久化派生数据或 Phaser 对象。
- 只有在我军阶段、`state` 为 `'idle'`/`'move'` 时才允许存档（`openSave`）。
- 营中存档来自 `CampScene.snapshot()`（`kind: 'camp'`）：`stage` 为**下一关** id，`talked`（已播放本关专属台词的人物名）、`deploy`（营中整备选好的阵容，可为 `null`）、`pos`（曹操所在格），以及与自动存档相同的战役状态（`roster`、`joined`、`items`、`difficulty`、`red`、`flags`、`inventory`、`gold`、`summary.lordLvl`）。营中任意时刻（没有对白 / 弹窗时）都能存档。
  `applyLoad` 遇到 `camp` 时写入 registry 后 `scene.start('Camp', { stage, talked, deploy, pos })`；`validSave` 接受 `camp`（`talked` 缺失或为数组）；存档列表显示“营中 · 下一战：<关名>”。`pos` 不可走时回到出生点。
- 营中没有战斗状态：`CampScene` 只复制 `inventory` / `gold` / `items` 给整备界面（`openPrep` 直接读写 `scene.inventory` 等并立即写回 registry），对白选项（`applyChoice`）直接写 registry 的 `red` / `flags`。营中选好的阵容经 `goStage(scene, id, { deploy })` → `StoryScene` → `afterPre` 带进 `BattleScene`（`campDeploy`），由 `deploy.initialDeploy` 过滤后作为整备的初始阵容；重新挑战（`retry`）沿用 `campDeploy`；读档不带阵容。
- `EndingScene` 会调用 `clearAuto()`。
- 金手指标记：战斗快照、营中快照、胜利时的自动存档都写 `cheated`（取 registry），存档列表在难度标签后显示 `［金手指］`。金手指开关本身是游戏设置（`settings.js` 的 `cheat` 总开关与 `cheatGod` / `cheatKill` / `cheatMove` 分项），不进存档。
- 导出/导入的文件格式为 `{ app: 'sanguo-caocao-save', version: 1, type: 'all' | 'single', ... }`；
  `planImport` 只返回导入计划、不写入，格式错误时抛出带中文信息的 `Error` 供界面显示。
- 自动存档（`writeAuto(data, kind = 'stage')`）写入 `stage`（下一关 id）、`roster`、`joined`、`items`、`difficulty`、`red`、`flags`、`inventory`、`gold`、`summary.lordLvl`；胜利时为 `'camp'`（另有 `talked: []`、`deploy: null`），出征时为 `'stage'`（取 `CampScene.snapshot()` 去掉 `talked` / `pos`，保留 `deploy`）。调试关卡不写。
- 兼容没有装备的旧存档：`applyLoad` 把 `inventory` 设为 `[]`、`gold` 设为 0；进入战斗时 `kitFor` 按原版规则补发初始装备；战斗中存档里没有 `equip` 的我军武将单位同样补发。`validSave` 不要求这两个字段。
- 地图版本：快照记录关卡的 `mapVersion`（旧存档缺失视为 1）。读档时与当前关卡的 `mapVersion` 不一致（地图已重做、坐标失效），
  `BattleScene.create` 丢弃 `load`、置 `mapReset`，由 `restartFromStageStart` 把 registry 恢复为本关开头的战役状态后重开，开场前提示“关卡地图已更新，将从本关开头重新开始”。起点优先级：第一关用新游戏状态（按存档难度）；其他关用 `stageStartSave` 找到的自动存档（`kind` 为 `'stage'` 或 `'camp'`、`stage` 指向本关、难度相同、`savedAt` 不晚于战斗存档；出征时那份覆盖胜利时那份，含营中选项，优先被用到）；都没有时退回 `applyLoad` 写入的战斗存档数据（道具、红色指数、标记、roster 停留在存档时刻，开场选项可能重复累加红色指数）。自动存档（关卡开头）不受影响。
- 地形变化：`this.map` 是每局复制的字符串数组（`[...stage.map]`），战场演出改地形时按行替换字符串（`battleStage.patchMap`），并在 `mapPatches` 记 `[[x, y, 地形字符], ...]`（同一格只保留最后一次）。快照写入 `mapPatches`，读档时在 `drawMap` 之前由 `replayPatches` 重放；旧存档没有该字段视为无变化。不要直接改 `stage.map`（关卡数据是共享的，整备 `planDeploy` 也读它）。
- 兼容没有天气的旧存档：战斗快照缺 `weatherIdx`（或不是 0~5 的整数）时取关卡起始序号；天气类别不入存档，始终按关卡决定。自动存档不需要天气（新关卡从起始值开始）。
- `getStage(id)` 仍通过 `LEGACY`（`stageMeta.js`）兼容旧存档中的数字关卡下标；导入校验 `validSave`
  的关卡字段同样接受非空字符串 id 或非负整数。
- 兼容旧道具：`migrateItems` 只处理带 `wheat` 键的旧格式（麦 → 米 `rice`，旧酒 `wine`（策略 +20）→ 神秘水 `water`）；新格式的 `wine` 是神秘酒，不再迁移。
- 兼容旧存档：没有 `joined` 时 `applyLoad` 用 `roster` 中属于武将总表的键推导；`roster` 条目没有 `tier`
  时补为 1。我军武将的兵种始终取总表（`deploy.js` / `roleOf`），不读 `roster.cls`。

## 反模式

- 把游戏状态挂在 `window` 或模块级可变变量上（目前只有用于调试的 `window.game`）。
- 战斗中读取 registry，而 `BattleScene` 已经把该值复制到了字段里。
- 把 `stats`、视图、贴图或函数写进存档快照。
