# 设计：出阵名额按章节递增

## 改动边界

| 文件 | 改动 |
|---|---|
| `src/deploy.js` | 新增章节增量表 `CHAPTER_BONUS`、补位函数 `extraSlots(stage, slots)`；`planDeploy` 把补出的位置追加到 `slots`，`max` 加上增量 |
| `scripts/validate-stages.mjs` | 出阵推导检查：补位数量不足报 warn，新位置合法性（可通行、不重叠）报 error |
| `docs/STAGE_GUIDE.md`、`.trellis/spec/frontend/stage-data.md` | 记录 `deploy.bonus` 覆盖字段与章节增量规则 |

不改：`prep.js`（已按 `plan.max` 显示 `出阵 x / max`，分页按候选数计算）、`buildPlayerDefs` / `initialDeploy`（只依赖 `slots` / `max`）、存档结构、关卡数据文件。

## 数据契约

```js
// src/deploy.js
export const CHAPTER_BONUS = { 序章: 2, 第一章: 3, 第二章: 4, 第三章: 5, 第四章: 6, 终章: 6 };
const chapterKey = (stage) => (stage.chapter || '').split(' ')[0];
```

- 关卡可选覆盖：`deploy.bonus`（非负整数），优先于章节表；写 `0` 表示本关不加名额（剧情上要求小队作战的关卡用）。
- 调试关卡（`src/stages/debug.js`）没有匹配章节 → 增量 0，行为不变。

## planDeploy 变化

```
baseSlots = 现有去重后的 slots
baseMax   = min(ov.max ?? baseSlots.length, baseSlots.length)   // 原逻辑
bonus     = ov.bonus ?? CHAPTER_BONUS[chapterKey(stage)] ?? 0
extra     = extraSlots(stage, baseSlots, bonus)                  // 可能少于 bonus
slots     = [...baseSlots, ...extra]
max       = baseMax + extra.length
```

- 返回结构不变，额外带 `bonus`（实际补到的数量）方便校验脚本输出。
- `defaults`（默认阵容）的裁剪仍以 `room = max - fixed.length` 为准；名额只增不减，所以默认阵容与改动前一致。
- 新位置追加在 `slots` 末尾：`buildPlayerDefs` 先让预设武将站原位，其余单位按顺序填空位，因此招募单位会优先填原阵型中空出来的位置，再填新位置；排序依据 `slots` 下标，不受影响。

## extraSlots 算法（纯函数、确定性）

多源 BFS，从 `baseSlots`（按数组顺序入队）向外扩展，四方向固定顺序 上 → 右 → 下 → 左：

1. **扩展条件**：在地图内，且至少一种常用兵种可通行（避免隔着城墙 / 深水“跳”到另一侧）。
2. **候选条件**（全部满足才收为新出阵位）：
   - 常用兵种 `lord / infantry / archer / cavalry / strategist / healer` 全部可通行（不管上场的是谁都能站）；
   - 不与任何 `stage.units`（含 `ifFlag` 条件单位、任何阵营）、事件援军 `events[].units` 的坐标重叠；
   - 不在胜利条件 `reach` 的 `tiles`、`escape.tiles` 上（避免出生即达成 / 撤离）；
   - 不与原出阵位重叠。
3. **距离上限**：离最近原出阵位曼哈顿 BFS 步数 ≤ 4；凑不够就按实际数量返回。
4. 同一关多次调用结果相同（只依赖关卡数据），营中整备、战场整备、读档之间位置一致；按 `stage.id` 用模块级 `Map` 缓存。

原型（`/tmp/proto.mjs`）结果：57 关全部补足，加名额后每关空位 1–4。

## 兼容性

- **存档**：战斗中存档记录单位实际坐标，不受影响；营中 / 关卡开头存档只记阵容 id 列表，`initialDeploy` 按新 `max` 截断，人数只会多不会少。
- **援军落点**：新位置已避开事件援军原定坐标；即使我军走过去占位，`BattleScene.spawnTile` 也会就近找空格。
- **校验脚本**：现有“预设我军必须在 `deploy.slots` 中”等检查针对关卡数据本身，不受影响；`deploy.max` 合法范围仍按原 `slots` 判断。

## 取舍

- 选自动补位而不是手填坐标：57 关 × 2–6 个，手填成本高且易错；个别位置不理想时可用 `deploy.bonus` 或直接在 `slots` 里写更多坐标（`slots` 写多了就等于手动加名额，`bonus` 设 0 即可）。
- 不调整敌军数量：属于平衡问题，超出本任务范围（PRD Out of Scope）。

## 回滚

改动集中在 `deploy.js` 一处：把 `CHAPTER_BONUS` 全部置 0 即恢复原行为；或直接 revert 提交。
