# 设计：出阵整备与情报界面

## 模块与职责
- `src/generals.js`（新增，纯数据，Node 可导入）
  - `GENERALS`：`{ [id]: { name, cls, bonus, gone?: '标记名', joinAt?: 关卡id | { loyal, villain } } }`，内容来自 docs/STAGE_GUIDE.md §6；忠臣线关羽为 `guanyu_z`。
  - 关卡数据里没有的武将：满宠（`joinAt: 'zhangxiu1'`）、貂蝉（`'xuzhou_ruqin'`）、曹丕（`'yecheng'`）。本子任务先用现有兵种近似（风水士 → `healer`，舞娘暂用 `fighter`，弓骑兵 → `archercav`），由子任务 10-10-promotion 改为原版系列。
  - `isGeneral(id)`。
- `src/deploy.js`（新增，纯函数，不依赖 Phaser）
  - `planDeploy(stage, { roster, joined, flags })` 返回：
    ```js
    {
      slots: [[x, y]],
      max,
      required: Set<id>,
      blocked: Set<id>,          // 事件中途生成的我军武将、已阵亡/离队的武将
      pool: [{ id, name, cls, lvl, bonus }],  // 可出阵候选（已加入、未阵亡、未被事件预留）
      fixed: [unitDef],          // 不在 GENERALS 中的临时成员，原样出阵
      defaults: [id],            // 预设阵容
      defsById,                  // 预设单位定义，用于取原站位、等级下限
    }
    ```
  - `buildPlayerDefs(plan, selectedIds)` 返回我军单位定义数组（P/E/A 同结构，带 x、y），交给 `createUnit`。
  - 必须出阵的推导：
    - 胜利条件：`boss.target`、`reach.unit`（以及 `escape.units`、`protect`）；
    - 事件：`duel.a` / `duel.b`、`onDeath`、`setAi` 的 key；
    - 对白：`prologue`、`epilogue(s)`、`events[].dialog` / `after` 中，`side: 'player'` 的发言人名字，映射到预设我军单位的 id。
  - 只统计预设我军单位，敌军的同名 id 不算。
- `src/prep.js`（新增，覆盖层 UI，写法仿 `saveMenu.js`）
  - `openPrep(scene, plan, onConfirm)`：卡片网格 4 列，每页 12 张，需要时翻页；用 `portrait`、`button`、`panel`、`text`；全部监听在关闭时清理。
- `src/infoPanel.js`（新增，覆盖层 UI）
  - `openInfo(scene)`：三页列表，点击某行回调 `scene.focusUnit(u)`。
- `src/scenes/BattleScene.js`（修改）
  - `create()`：
    - 新战斗时，`this.units` 只放敌军、友军和固定临时成员；存档恢复时不变。
    - 计算 `this.deployPlan`。
  - `start()`：prologue → `await this.startPrep()` → 横幅 → `startPhase('player')`。
  - `startPrep()`：调用 `openPrep`，确认后用 `buildPlayerDefs` 生成我军单位与视图。
  - 胜利时：`roster[id] = { lvl, exp, cls }`；`joined` 并入本关预设的武将。
  - 新增 `focusUnit(u)`：设置光标，`hud.showUnit`。
- `src/hud.js`：顶部栏加“部队”按钮（我军阶段且 `state` 为 `idle` / `move` 时可用，与保存按钮相同的条件）。
- `src/saves.js`：
  - `applyLoad` 恢复 `joined`；
  - `validSave` 改为接受 `typeof stage === 'string'` 或整数。
- `TitleScene` 新游戏重置 `joined: []`。

## 数据流
`roster` / `joined` / `flags`（registry）+ 关卡数据 → `planDeploy` → 整备界面选择 → `buildPlayerDefs` → `createUnit` → `units` / `views`。
胜利时 → 更新 `roster` / `joined` → `writeAuto`。

## 兼容性
- 旧存档没有 `joined`：`applyLoad` 用 `Object.keys(roster)` 推导。roster 条目没有 `cls`：按 P4 推导。
- 战斗中存档的 `units` 已包含我军，读档时跳过整备，不受影响。
- 不改 57 关的数据；`deploy` 覆盖字段可选，校验脚本校验其格式（slots 可通行且不重叠，required 必须是预设我军单位）。

## 取舍
- 站位不允许自由摆放：原版是固定出阵位置，而且自由摆放会让很多关卡的剧情站位失去意义。
- 对白发言人自动列为必须出阵，避免剧情里出现未出阵的人说话。代价是部分关卡的可选空间变小，可以用 `deploy.required` 手动放宽。
