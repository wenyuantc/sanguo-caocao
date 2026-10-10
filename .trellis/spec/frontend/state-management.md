# 状态管理

> 没有状态管理库。状态分三层：Phaser `registry`（整个战役）、`BattleScene` 字段 + 普通单位对象
> （单场战斗）、`localStorage`（存档）。

---

## 1. 战役状态：`scene.registry`

通过 Phaser 的全局数据 registry 在场景间共享。当前使用的 key：

| Key | 结构 | 写入位置 |
|-----|------|----------|
| `difficulty` | `'normal' \| 'hard' \| 'hell'` | `TitleScene.chooseDifficulty`、`applyLoad` |
| `roster` | `{ [我军单位id]: { lvl, exp, cls, tier } }`（`tier` 阶级 1~3，旧存档缺失时 `applyLoad` 补为 1；`cls` 仅作记录，兵种以武将总表为准） | `BattleScene.victory`、`applyLoad` |
| `joined` | `[武将id]`，已加入的武将（仅 `generals.js` 中的武将） | 新游戏（`[]`）、`BattleScene.victory`、`applyLoad`（旧存档缺失时用 `roster` 的键推导） |
| `items` | `{ [道具id]: 数量 }`（id 见 data-contracts 的 `ITEMS`；`seal` 印绶从 `SEAL_FROM` 关起每关胜利 +1，另按关序轮流获得一件 `LOOT` 战利品） | 新游戏、`victory`（加上 `difficulty.reward`、印绶与战利品）、`applyLoad`（`migrateItems` 迁移旧道具） |
| `red` | 整数，红色指数 | `applyChoice`、`victory`、`applyLoad` |
| `flags` | `{ [标记名]: true }` | `setFlag`、`applyLoad` |

- 新游戏（`TitleScene`）在 `scene.start('Battle', { stage: FIRST_STAGE })` 之前会重置**全部六个** key。
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
`deployPlan`、`over`、`modal`。

- 单位是**可变的普通对象**；逻辑直接修改 `u.x/u.y/u.hp/u.mp/u.alive/u.acted/u.ai`，再调用对应的视图方法。
  没有事件总线或观察者。
- 单位从不从 `units` 中移除；撤退/撤离只设置 `alive = false`（以及 `escaped = true`）。处处用 `u.alive` 过滤。
- 我军成长只在胜利时写入 `roster`（`{ lvl, exp, cls, tier }`），同时把本关我军武将并入 `joined`。败北/重新挑战会按 registry 状态重开本关
  （`scene.start('Battle', { stage: this.stageId })`）。
- 阶段顺序：我军 → 友军 → 敌军 → `turn += 1`；`survive` 和 `turns` 回合上限在 `nextPhase` 中检查。

## 3. 持久化：`src/saves.js`

| localStorage key | 内容 |
|------------------|------|
| `sanguo-slots` | 100 个手动存档位的数组（`SLOT_COUNT`），`null` 表示空 |
| `sanguo-save` | 单个自动存档，每关胜利后由 `victory()` 写入，`kind: 'stage'` |

- 战斗中存档来自 `BattleScene.snapshot()`（`kind: 'battle'`）：关卡、回合、道具、红色指数、标记、roster、
  `joined`、`firedEvents`，以及**去掉 `stats` 的** `units`（单位自带 `tier`，`status` / `buffs` 复制一份写入）；读档时用 `restoreUnit` 重新计算属性
  （旧存档单位缺 `tier` 时我军视为一阶、其他按难度门槛定阶，兵种按武将总表 / 登记表覆盖）。
  不要持久化派生数据或 Phaser 对象。
- 只有在我军阶段、`state` 为 `'idle'`/`'move'` 时才允许存档（`openSave`）。
- `EndingScene` 会调用 `clearAuto()`。
- 导出/导入的文件格式为 `{ app: 'sanguo-caocao-save', version: 1, type: 'all' | 'single', ... }`；
  `planImport` 只返回导入计划、不写入，格式错误时抛出带中文信息的 `Error` 供界面显示。
- 自动存档（`writeAuto`）写入 `stage`（下一关 id）、`roster`、`joined`、`items`、`difficulty`、`red`、`flags`。
- `getStage(id)` 仍通过 `LEGACY`（`stageMeta.js`）兼容旧存档中的数字关卡下标；导入校验 `validSave`
  的关卡字段同样接受非空字符串 id 或非负整数。
- 兼容旧道具：`migrateItems` 只处理带 `wheat` 键的旧格式（麦 → 米 `rice`，旧酒 `wine`（策略 +20）→ 神秘水 `water`）；新格式的 `wine` 是神秘酒，不再迁移。
- 兼容旧存档：没有 `joined` 时 `applyLoad` 用 `roster` 中属于武将总表的键推导；`roster` 条目没有 `tier`
  时补为 1。我军武将的兵种始终取总表（`deploy.js` / `roleOf`），不读 `roster.cls`。

## 反模式

- 把游戏状态挂在 `window` 或模块级可变变量上（目前只有用于调试的 `window.game`）。
- 战斗中读取 registry，而 `BattleScene` 已经把该值复制到了字段里。
- 把 `stats`、视图、贴图或函数写进存档快照。
