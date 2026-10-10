# 数据契约

> 原生 JavaScript，没有 TypeScript，也没有 JSDoc 类型。数据正确性依靠：(1) 表旁边的结构注释、
> (2) `normalizeStage`、(3) `scripts/validate-stages.mjs`、(4) 只在信任边界（导入存档）做防御性检查。

---

## 规则表（`src/data.js`）

规则表是按短字符串 id 索引的对象字面量，约定上视为只读：

| 表 | 条目结构 |
|----|----------|
| `TERRAIN[字符]` | `{ name, color, cost: { foot, horse }, def, heal, fire? }`，cost 为 `99` 表示不可通行 |
| `RANGES[名称]` | `[dx, dy]` 偏移数组（`melee`、`bow`、`far`、`none`） |
| `CLASSES[cls]` | `{ name, glyph, move, moveType: 'foot'|'horse', range: RANGES 的 key, type, base: Stats, grow: Stats, spells: SPELLS 的 key[] }` |
| `ADVANTAGE` | `{ horse: 'foot', foot: 'bow', bow: 'horse' }`，按兵种的 `type` 索引 |
| `SPELLS[id]` | `{ name, mp, range, kind: 'damage'|'heal', power, color, desc }` |
| `ITEMS[id]` | `{ name, desc, hp?, mp? }` |
| `DIFFICULTIES[id]` | `{ name, color, lvl, mult: Stats|null, aggressive, items, reward, desc[] }`；通过 `diffOf(id)` 读取（找不到时退回 `normal`） |

`Stats` = `{ hp, mp, atk, def, int, agi }`。新增兵种/策略/地形时，要填齐已有条目的**全部**字段；
使用方直接按字段取值，不做空值检查（例如 `terrainAt(map, x, y).cost[cls.moveType]`）。

## 运行时单位对象

由 `createUnit(def, saved, diff)`（`src/logic.js`）根据关卡中的单位定义创建：

```js
{
  // 来自关卡定义（P/E/A）：id, name, cls, faction: 'player'|'enemy'|'ally', x, y,
  //   leader?, bonus?, mark?, focus?, ifFlag?, unlessFlag?
  lvl,            // max(def.lvl, roster 中的 lvl)，敌军再加 difficulty.lvl
  exp,            // 0..99，仅我军使用
  ai,             // 'aggressive' | 'hold' | 'peace'
  mult,           // 难度属性倍率（敌军），否则为 null
  stats,          // calcStats(cls, lvl, bonus, mult)，派生值，从不存档
  hp, mp,         // 当前值
  acted, moved, alive, escaped?
}
```

- `stats` 永远是派生值；修改 `lvl`/`bonus`/`mult` 后要用 `calcStats` 重新计算（参考 `levelUp`）。
- 敌我判断只有一条规则：`isFoe(a, b)`，即是否敌军；我军和友军互为友方。
- 规则和事件用 `u.id`（关卡内唯一）识别单位；`views` 用对象引用识别单位。

## 函数契约（`src/logic.js`）

- 纯函数显式接收 `(map, units, u)` 或 `(map, a, d)`，从不接收场景。
- `reachable()` 返回 `Map<key(x,y), { x, y, cost, prev }>`；把节点传给 `pathTo(node)` 得到路径。
- `rollAttack()` 返回 `{ hit, crit, dmg }`；预测函数（`physDamage`、`hitRate`、`spellDamage`、
  `spellHit`、`healAmount`）是确定性的，AI 和 HUD 共用。
- `planAI()` 返回 `null` 或 `{ score, tile, type: 'attack'|'spell'|'wait', target?, spell? }`。

## 关卡与存档结构

- 关卡对象：见 `stage-data.md` 和 `docs/STAGE_GUIDE.md` §3。`normalizeStage` 保证 `title`、
  `events: []` 存在，且 `victory` 一定是数组，使用方依赖这一点。
- `next`：字符串 id | `'END_LOYAL'`/`'END_VILLAIN'` | `{ annihilate?, retreat?, <outcome>?, default?, route?: { loyal, villain } }`。
- 存档数据：见 `state-management.md` §3。

## 校验策略

- 关卡数据：运行校验脚本（必须 0 错误）。优先扩展 `scripts/validate-stages.mjs`，不要在 `BattleScene`
  中增加运行时检查。
- 外部输入（导入的存档文件）：在 `saves.planImport` 中校验，抛出带中文提示的 `Error`；调用方显示 `e.message`。
- 内部代码信任自身数据：游戏循环里不写防御性的 `typeof` 检查。
- 开发期的合理性检查使用 `console.warn`（例如 `BattleScene.create` 中检查地图行长度）。
