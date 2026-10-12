# 技术设计

## 1. 第一关毒烟伤害

### 1.1 单位字段 `spellMult`（施策者的策略伤害倍率）
- 位置：`src/logic.js` `spellDamage()`（约 359 行）。在 `m` 的计算中追加 `m *= a.spellMult || 1;`。
- `kill` 公式（海啸 / 晕眩）分支不受影响（直接 return，保持原语义）。
- HUD 预测、AI 的 `spellScore`、实际结算都走 `spellDamage`，自动一致。
- `createUnit` 用 `...def` 展开，字段会自然带到单位上；存档 `snapshot()` 也是展开，无需改动。

### 1.2 关卡字段 `poisonRate`（中毒每回合扣血比例）
- `src/status.js` `tickStatus(u, rng = Math.random, rate = POISON_RATE)`：用 `rate` 替换 `POISON_RATE`。
- `src/scenes/BattleScene.js` 约 351 行：`tickStatus(u, undefined, this.stage.poisonRate ?? POISON_RATE)`（或调整参数顺序为 `tickStatus(u, { rate })`，以不破坏其他调用方为准，先 grep 全部调用点）。
- `src/logic.js` `statusValue` 中毒估值里的 `0.1` 不改（只影响 AI 偏好，误差可接受）；如需精确可后续传入。

### 1.3 第一关数据（`src/stages/a.js`）
- `zhangbao`、`hj12`：extra 加 `spellMult: 0.6`。
- 关卡对象加 `poisonRate: 0.05`。
- `scripts/validate-stages.mjs`：如对未知字段有校验，补充 `spellMult`（0~2 数字）与 `poisonRate`（0~1 数字）的合法性检查。

## 2. 友军 AI 自动使用道具

### 2.1 数据：友军自带补给 `u.items`
- 默认补给 `ALLY_ITEMS` 定义在 `src/data.js`（建议 `{ bean: 2, antidote: 1 }`，加“自行设计”注释）。
- 在 `createUnit` 中按 `def.faction === 'ally'` 生成 `items: { ...(def.items || ALLY_ITEMS) }`；关卡可用 extra `items` 覆盖。
- 不放在 `helpers.js` 的 `A()` 里，是为了让旧存档也能补齐：读档走 `load.units`，需确认是否经过 `createUnit`；若不经过，在读档恢复处对缺少 `items` 的友军同样补默认值。
- 存档：`snapshot()` 中单位已展开，但 `items` 是对象引用，需与 `status` / `buffs` 一样浅拷贝：`items: u.items && { ...u.items }`。

### 2.2 AI 决策：`planAI` 增加道具计划
- 位置：`src/logic.js` `planAI()`，与攻击 / 策略一起参与 `consider()` 比较，新类型 `{ tile, type: 'item', item, target }`。
- 仅当 `u.items` 存在且有剩余时生成（敌军没有 `items`，行为不变；玩家不走 AI）。
- 候选目标：移动后 `tile` 自身及上下左右的非敌方存活单位（与 `BattleScene.itemTiles` 一致，抽一个纯函数 `itemTargetsAt(units, u, tile)` 放 logic.js，BattleScene 也可复用）。
- 打分 `itemScore(it, v)`（自行设计，参照 `spellScore` 的 heal / cure 分支，保持量级可比）：
  - 回复兵力：`lost = v.stats.hp - v.hp`；仅当 `lost >= v.stats.hp * 0.4` 或 `v.hp < v.stats.hp * 0.35` 时计分：`min(lost, 回复量) * 0.9 + (v.hp < 35% ? 30 : 0)`；豆 / 米 择“够用且最便宜”（先豆后米）。
  - 解除异常：对 `cure` 覆盖的每个异常 `statusValue({ ...v, status: {} }, k)`，再加 `v.hp < 35% ? 10 : 0`；中毒且兵力低时额外加分。万能药只在多异常或无对应单药时使用。
  - 回复策略值（神秘水 / 酒）：默认补给不含，支持但不主动配置。
  - 加站位分 `tdef`（同攻击），使其倾向在安全格用药。
- 印绶、果子（`promote` / `fruit`）跳过。

### 2.3 执行：`runAI` 与 `doItem`
- `src/actions.js` `runAI`：`plan.type === 'item'` 时调用 `doItem(s, u, plan.item, plan.target)`。
- `doItem` 目前固定扣 `s.items[itemId]`：改为按使用者扣：
  ```js
  const pool = a.faction === 'player' ? s.items : a.items;
  pool[itemId] -= 1;
  if (pool === s.items) s.hud.setItems(s.items);
  ```
- 其余（特效、飘字、日志、经验）沿用；友军的 `gainExp` 现有逻辑如何处理沿用现状。

## 3. 兼容与回滚
- 新字段全部可选，缺省时行为与改动前一致；敌军 / 玩家路径不变。
- 回滚：删除 a.js 的三处配置即可恢复第一关数值；去掉 `planAI` 的 item 分支即可关闭友军用药。
