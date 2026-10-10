# 状态管理

> 没有状态管理库。状态分三层：Phaser `registry`（整个战役）、`BattleScene` 字段 + 普通单位对象
> （单场战斗）、`localStorage`（存档）。

---

## 1. 战役状态：`scene.registry`

通过 Phaser 的全局数据 registry 在场景间共享。当前使用的 key：

| Key | 结构 | 写入位置 |
|-----|------|----------|
| `difficulty` | `'normal' \| 'hard' \| 'hell'` | `TitleScene.chooseDifficulty`、`applyLoad` |
| `roster` | `{ [我军单位id]: { lvl, exp } }` | `BattleScene.victory`、`applyLoad` |
| `items` | `{ bean, wheat, wine }` 数量 | 新游戏、`victory`（加上 `difficulty.reward`）、`applyLoad` |
| `red` | 整数，红色指数 | `applyChoice`、`victory`、`applyLoad` |
| `flags` | `{ [标记名]: true }` | `setFlag`、`applyLoad` |

- 新游戏（`TitleScene`）在 `scene.start('Battle', { stage: FIRST_STAGE })` 之前会重置**全部五个** key。
  新增 key 时，要在这里重置，并在 `saves.applyLoad` 中恢复。
- 写入时一律写副本：`this.registry.set('flags', { ...this.flags })`、`items = { ...this.items }`。

## 2. 战斗状态：`BattleScene` 字段

`create()` 按优先级 `load` 快照 → registry → 关卡默认值 构建所有状态：

```js
this.items = { ...(load?.items || this.registry.get('items') || this.difficulty.items) };
this.red   = load?.red ?? this.registry.get('red') ?? 0;
this.units = load ? load.units.map((u) => ({ ...u, stats: calcStats(u.cls, u.lvl, u.bonus, u.mult) }))
                  : stage.units.filter((d) => this.flagOk(d)).map((d) => createUnit(d, roster[d.id], this.difficulty));
```

主要字段：`stage`、`stageId`、`map`、`units`（普通对象数组）、`views`（`Map<unit, UnitView>`）、
`turn`、`phase`（`'player' | 'ally' | 'enemy'`）、`state`（输入状态机）、`sel`（当前选择）、
`firedEvents`（`Set<事件下标>`）、`flags`、`red`、`items`、`over`、`modal`。

- 单位是**可变的普通对象**；逻辑直接修改 `u.x/u.y/u.hp/u.mp/u.alive/u.acted/u.ai`，再调用对应的视图方法。
  没有事件总线或观察者。
- 单位从不从 `units` 中移除；撤退/撤离只设置 `alive = false`（以及 `escaped = true`）。处处用 `u.alive` 过滤。
- 我军成长只在胜利时写入 `roster`。败北/重新挑战会按 registry 状态重开本关
  （`scene.start('Battle', { stage: this.stageId })`）。
- 阶段顺序：我军 → 友军 → 敌军 → `turn += 1`；`survive` 和 `turns` 回合上限在 `nextPhase` 中检查。

## 3. 持久化：`src/saves.js`

| localStorage key | 内容 |
|------------------|------|
| `sanguo-slots` | 100 个手动存档位的数组（`SLOT_COUNT`），`null` 表示空 |
| `sanguo-save` | 单个自动存档，每关胜利后由 `victory()` 写入，`kind: 'stage'` |

- 战斗中存档来自 `BattleScene.snapshot()`（`kind: 'battle'`）：关卡、回合、道具、红色指数、标记、roster、
  `firedEvents`，以及**去掉 `stats` 的** `units`（`units.map(({ stats, ...u }) => u)`）；读档时重新计算属性。
  不要持久化派生数据或 Phaser 对象。
- 只有在我军阶段、`state` 为 `'idle'`/`'move'` 时才允许存档（`openSave`）。
- `EndingScene` 会调用 `clearAuto()`。
- 导出/导入的文件格式为 `{ app: 'sanguo-caocao-save', version: 1, type: 'all' | 'single', ... }`；
  `planImport` 只返回导入计划、不写入，格式错误时抛出带中文信息的 `Error` 供界面显示。
- `getStage(id)` 仍通过 `LEGACY`（`stageMeta.js`）兼容旧存档中的数字关卡下标。

### 已知问题（已记录，尚未修复）

`saves.validSave` 要求 `Number.isInteger(d.stage)`，但当前存档保存的是字符串关卡 id（如 `'hulao'`），
所以当前版本导出的文件在导入时会被判为无效。应在单独任务中修复；新代码不要照抄这个检查。

## 反模式

- 把游戏状态挂在 `window` 或模块级可变变量上（目前只有用于调试的 `window.game`）。
- 战斗中读取 registry，而 `BattleScene` 已经把该值复制到了字段里。
- 把 `stats`、视图、贴图或函数写进存档快照。
