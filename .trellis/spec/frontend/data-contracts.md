# 数据契约

> 原生 JavaScript，没有 TypeScript，也没有 JSDoc 类型。数据正确性依靠：(1) 表旁边的结构注释、
> (2) `normalizeStage`、(3) `scripts/validate-stages.mjs`、(4) 只在信任边界（导入存档）做防御性检查。

---

## 规则表（`src/data.js`）

规则表是按短字符串 id 索引的对象字面量，约定上视为只读：

| 表 | 条目结构 |
|----|----------|
| `TERRAIN[字符]` | `{ name, color, cost: { foot, horse }, def, heal, fire? }`，cost 为 `99` 表示不可通行 |
| `RANGES[名称]` | `[dx, dy]` 偏移数组：`cross` 十字、`around` 周围 8 格、`ring2`、`r23`、`r24`、`line2`、`ring4`、`r45`、`none`；旧名 `melee`/`bow`/`far` 为别名 |
| `SERIES[cls]` | 兵种系列：`{ name, moveType: 'foot'|'horse', type, tiers: [{ name, glyph, move, range }], grow: { atk, int, def, burst, morale }（成长档字母）, hp: [基础, 每级], mp: [基础, 每级], spells: [{ id, lvl, tier }] }`；可转职系列 3 阶，特殊兵种 1 阶；`spells` 由 `spells.js` 的 `SPELL_LEARN` 填入 |
| `classOf(cls, tier)` | 按阶级取兵种视图 `{ name, glyph, move, moveType, range, type, spells, tier, tiers, series }`（缓存对象，只读；`spells` 为该阶级以下可习得的策略 id，不看等级）。按单位取兵种信息一律用 `classOf(u.cls, u.tier)`；单位实际掌握的策略用 `knownSpells(u)`（等级、阶级都达到） |
| `CLASSES[cls]` | 兼容视图，等于 `classOf(cls, 1)`；新代码不要用 |
| `GRADE` / `STAT5` / `STAT_NAME` | 成长档 `{ S: 4, A: 3, B: 2, C: 1 }`；五项能力 key 列表与中文名 |
| `PROMOTE_LVL` | 转职等级 `[15, 30]` |
| `ADVANTAGE` | `{ horse: 'foot', foot: 'bow', bow: 'horse' }`，按兵种的 `type` 索引 |
| `SPELLS[id]`（`src/spells.js`，data.js 再导出） | `{ name, cat, elem?, formula?, mp, range, area, target, status?, buff?, special?, heal?, mpGain?, cure?, hitMod?, color, desc }`，见下方“策略” |
| `ITEMS[id]` | `{ name, desc, hp?, mp?, full?: 'hp'|'mp', cure?: 状态名|'all', promote? }`：bean 豆、rice 米、peach 桃、water 神秘水、wine 神秘酒、antidote 解毒药、plaster 膏药、stimulant 兴奋剂、cough 止咳药、panacea 万能药、seal 印绶（`promote: true`，`SEAL_FROM` 起每关胜利奖励 1 个）；`LOOT` 为每关胜利轮流获得的战利品 |
| `DIFFICULTIES[id]` | `{ name, color, lvl, mult: Stats|null, aggressive, tierLvl: [二阶, 三阶], items, reward, desc[] }`（`tierLvl`：敌军 / 友军自动定阶门槛，普通 `[20, 35]`，困难 / 地狱 `[15, 30]`）；通过 `diffOf(id)` 读取（找不到时退回 `normal`） |

### 策略（`SPELLS`）

- `cat`：`damage` 伤害 / `status` 异常 / `debuff` 减益 / `buff` 增益 / `heal` 回复兵力 / `mp` 回复策略值 / `cure` 解除异常 / `special`（回归、冥想）。
- `elem`：`fire` / `water` / `earth` / `wind`（决定地形限制与特效）；`formula`：`a`~`f`、`g`（朱雀 L+Δ+25）为原版伤害公式类别，`kill` 为目标全部兵力，`drainMp` 为谍报吸取量。
- 天气相关：`noBadWeather`（火系，雨 / 豪雨 / 雪不能用）、`weather: 'bad'|'sun'|'cloud'`（四神的天气条件）、`needGem`（需装备的宝玉 id）、`setWeather: 'cloud'|'sun'|'rain'`（昙天 / 晴明 / 豪雨）、`strikes`（青龙雷击次数）；`special` 另有 `'thunder'`、`'zhuque'`、`'xuanwu'`、`'baihu'`。
- 可用性一律用 `spellUsable(id, u, weather, ctx?)` → `{ ok, reason }`（禁咒 / 混乱、习得等级、宝玉、天气、策略值，`ctx.map + ctx.target` 时含地形）；菜单、AI（`castable(u, weather)`）、测试共用。
- `range`：射程（曼哈顿距离，`'map'` 为全图）；`area`：`0` 单体、`'cross'` 十字 5 格、`'square'` 3×3、`'map'` 全图野外；`target`：`'foe'` / `'ally'` / `'self'`。
- `status`：附加异常（`'random'` 为随机一种）；`buff`：`{ stat: 'atk'|'int'|'def'|'burst'|'morale'|'power'|'all'|'move', mult? , add? }`（`power` 对文官作用于精神、对武将作用于攻击）；`special`：`'drain'` 吸取兵力、`'drainMp'`、`'again'`、`'meditate'`；`heal`：`'small'`/`'big'`；`hitMod`：成功率系数。
- 结算一律走 `resolveSpell(map, units, a, id, t, rng)`（不修改单位，返回 `{ caster, spellId, center, effects: [{ u, hit, dmg?, heal?, mp?, mpDrain?, status?, buff?, cure?, again? }], self }`）→ `applySpell(res)`（写入并记录 `buffKeys` / `cured`）。`actions.doSpell` 在两者之间播放特效；Node 模拟脚本直接连用。
- 预测函数：`spellDamage(map, a, d, id)`、`spellHit(a, d, id)`、`healAmount(a, id)`、`spellDrainMp(a, d)`；限制与目标：`spellBlock(map, id, x, y)`（地形限制，返回中文原因或 null）、`spellTargetOk(a, id, o)`、`spellVictims(map, units, a, id, c)`、`areaTiles(map, id, c)`。

### 状态（`src/status.js`，纯函数）

- `u.status = { poison?, paralyze?, confuse?, silence?: 剩余回合 }`；`u.buffs = { atk?|int?|def?|burst?|morale?: { mult, turns }, move?: { add, turns } }`。两者随战斗中存档保存，旧存档缺失时 `restoreUnit` 补为 `{}`。
- `applyStatus` / `cure(u, key|'all')` / `applyBuff`（同一能力只刷新不叠加）；`tickStatus(u, rng, rate = POISON_RATE)` 在所属阵营阶段开始时调用（`BattleScene` 传入 `stage.poisonRate ?? POISON_RATE`），返回 `[{ type: 'poison'|'recover'|'expire', … }]`。
- 判定：`canMove`（麻痹 / 混乱时 false）、`canAct`（混乱 false）、`canCast`（禁咒 / 混乱 false）、`canCounter`（混乱 false）、`alwaysHit`（目标混乱）。
- 战斗公式一律读 `effStats(u)`（套用增减益后的五项），不要直接读 `u.stats` 的五项；移动力用 `effMove(u)`（兵种 + `moveBonus` + 装备）。

### 装备（`src/equipment.js`，纯函数）

- 装备实例 `{ uid, id, lvl, exp }`：背包 `registry.inventory` 存全部实例，`roster[id].equip` 存 uid；战斗单位持有副本 `u.equip = { weapon, armor, acc }`（`kitFrom`），敌军 / 友军 / 临时成员为 `defaultKit(cls, lvl)`（无 uid）。
- `EQUIP[id]`：`{ name, kind, slot, treasure, tier, main, base, max, extra, price?, sellFruit?, effects: [{ type, ... }], series, cap }`；普通装备 37 件、宝物 50 件（校验脚本检查）。普通装备最高 `NORMAL_CAP`（3）级，宝物 `TREASURE_CAP`（9）级，辅助品 `cap` 为 1 不升级。
- 属性：`gearStats(id, lvl)` / `equipStats(equip)` 直接加到 `calcStats` 结果上（不乘难度倍率）；果子 `u.fruits[能力] × FRUIT_GAIN`（2）。
- 特效一律用 `fx(u, type)` / `fxSum(u, type, key)` / `fxMax` 查询，**不要按装备 id 判断**；新增特效类型必须在 `FX_DESC` 写说明（`gearDesc` 与校验脚本依赖）。
- 熟练度：`GEAR_EXP`（命中 / 未中 / 被击中），`addGearExp(it, amt)` 返回升级数；只有我军武将（有 uid）的装备成长，胜利时按 uid 写回背包。
- 取得：宝物唯一，`pickGear(inv, item)` 对数组取第一件未拥有的；`stageRewards(stageId, ctx)` 的 ctx 为 `{ flags, outcome, via（胜利条件类型）, annihilated, turn, alive(id) }`。

`Stats` = `{ hp, mp, atk, int, def, burst, morale }`（攻击、精神、防御、爆发、士气）；`bonus` / 难度 `mult` 使用同样的 key（关卡数据中的旧字段 `bonus.agi` 视为 `burst`）。新增兵种/策略/地形时，要填齐已有条目的**全部**字段；
使用方直接按字段取值，不做空值检查（例如 `terrainAt(map, x, y).cost[cls.moveType]`）。

## 运行时单位对象

由 `createUnit(def, saved, diff, equip?)`（`src/logic.js`）根据关卡中的单位定义创建：

```js
{
  // 来自关卡定义（P/E/A）：id, name, cls, faction: 'player'|'enemy'|'ally', x, y,
  //   leader?, bonus?, mark?, focus?, ifFlag?, unlessFlag?
  cls, gradeMod, bonus, // roleOf(def)：我军武将取 generals.js；其他按 CLASS_BY_NAME / 同名武将 / 黄巾映射覆盖
  lvl,            // max(def.lvl, roster 中的 lvl)，敌军再加 difficulty.lvl
  guard?,         // 主将 / 受保护单位（BattleScene.markGuard）
  status, buffs,  // 异常与增减益（见上方“状态”），新单位为 {}
  equip,          // 装备副本 { weapon, armor, acc }（见上方“装备”），随战斗中存档保存
  fruits?,        // 我军武将已吃的果子 { [能力]: 个数 }（取自 roster）
  tier,           // 1~3：我军取 roster 的 tier（缺省 1）；roster 没有 lvl 记录的我军 tierFor(cls, lvl)（15/30）；敌军 / 友军 tierFor(cls, lvl, diff.tierLvl)
  exp,            // 0..99，仅我军使用
  ai,             // 'aggressive' | 'hold' | 'peace'
  items,         // 友军自带补给 { [道具id]: 数量 }（关卡 extra `items`，缺省 ALLY_ITEMS）；我军 / 敌军为 null。随战斗中存档保存，旧存档的友军由 restoreUnit 补默认值
  spellMult?,     // 施策者策略伤害倍率（关卡 extra，缺省 1），在 spellDamage 中乘入，预测 / AI / 结算一致
  mult,           // 难度属性倍率（敌军），否则为 null
  stats,          // calcStats(u)，派生值，从不存档
  hp, mp,         // 当前值
  acted, moved, alive, escaped?
}
```

- `stats` 永远是派生值；修改 `lvl`/`tier`/`bonus`/`mult` 后要用 `calcStats(u)` 重新计算（参考 `levelUp`、`promote`）。
- 公式：HP/MP = 系列基础 + 每级 × (lvl + 2 × (tier − 1)) + 加成；五项 = `BASE5` + `GRADE[档]` × lvl + 加成（`gradeMod` 覆盖个人成长档）。
- 转职：`promoteBlock(u)` 返回 `null` 或中文原因；`promote(u)` 升阶、重算并回满，返回 `{ diff, learned }`（`learned` 为新阶级多出的策略，供策略按阶级习得使用）。
- 读取战斗中存档的单位用 `restoreUnit(saved, diff)`：重新套用兵种覆盖、补 tier、重算能力。
- 道具使用一律走 `actions.doItem(s, a, itemId, t)`：我军扣 `s.items` 并刷新 HUD，友军扣 `a.items`（不占玩家军需）。友军 AI 在 `planAI` 中以 `{ type: 'item', item, target }` 计划参与比较（`itemScore`：兵力低于 35% 或损失 ≥ 40% 才回复，异常按 `statusValue` 估值），补给用尽不再生成；敌军不用道具。
- 敌我判断只有一条规则：`isFoe(a, b)`，即是否敌军；我军和友军互为友方。
- 规则和事件用 `u.id`（关卡内唯一）识别单位；`views` 用对象引用识别单位。

## 金手指（`src/cheat.js`）

- 开关读 `SETTINGS`：`cheatOn(k?)`（总开关且分项开）、`godOf(d)`（我军无敌）、`killBy(a, d)`（我军打敌军秒杀）、`cheatDmg(a, d, dmg)`。只作用于 `player` 阵营，友军 / 敌军不变。
- 挂钩点只在场景层：`actions.strike`（无敌时攻击落空、秒杀时必中并打掉全部兵力，且绕过龙鳞铠）、`actions.doSpell` 在 `resolveSpell` 与 `applySpell` 之间修正效果（`cheatSpell`）、`BattleScene.tickUnit`（无敌时中毒比例传 0）、`BattleScene.finishUnit`（无限行动不设 `acted`、不自动结束回合）。`logic.js` 的预测与 AI 不受影响。
- 金手指面板 `cheatMenu.openCheatMenu(scene, { lordLvl, onWin?, onClose })` 直接改 `scene.gold / items / inventory`：战斗中随快照 / 胜利写回，营中在 `onClose` 写回 registry。

## 函数契约（`src/logic.js`）

- 纯函数显式接收 `(map, units, u)` 或 `(map, a, d)`，从不接收场景。
- `reachable()` 返回 `Map<key(x,y), { x, y, cost, prev }>`；把节点传给 `pathTo(node)` 得到路径。
- `rollAttack()` 返回 `{ hit, crit, dmg }`；预测函数（`physDamage`、`hitRate`、`spellDamage`、
  `spellHit`、`healAmount`）是确定性的，AI 和 HUD 共用。
- `planAI()` 返回 `null` 或 `{ score, tile, type: 'attack'|'spell'|'wait', target?, spell? }`。
- 主将保护：`u.guard`（曹操与关卡 `protect` 单位，由 `BattleScene.markGuard` 设置并随存档保存）受到的物理伤害与中毒扣血乘 `GUARD_TAKEN`（0.7，定义在 status.js、logic.js 再导出），策略伤害乘 `GUARD_SPELL_TAKEN`（0.4）；`planAI` 对 guard 单位按威胁图（每格可被几个敌人打到）扣分避险。
- 战斗公式：物理伤害看攻击对防御；命中看双方爆发之差，会心看双方士气之差；策略伤害 = 原版公式（`x = 等级 + (精神差) / 3`）× `SPELL_SCALE`（2）× `AREA_SCALE`（十字 0.4、方形 0.35）× 地形；策略成功率看双方“精神 + 士气”之差再乘 `hitMod`；混乱的目标必中。
- AI 策略计分：伤害按期望伤害与击破计分；异常按目标威胁计分，上限 `STATUS_CAP`；增益 / 减益 / 解除 / 回复策略值上限 `AUX_CAP`，防止只放辅助策略不攻击。AI 不使用回归，不使用受地形限制的策略。

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
