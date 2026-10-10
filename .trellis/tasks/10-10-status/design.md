# 设计：原版策略体系与异常状态

## 数据（`src/data.js`，或拆为 `src/spells.js` 由 data.js 再导出）
- `SPELLS[id]`：
  ```js
  {
    name, cat: 'damage'|'debuff'|'status'|'buff'|'heal'|'mp'|'cure'|'special',
    elem?: 'fire'|'water'|'earth'|'wind',
    formula?: 'a'|'b'|'c'|'d'|'e'|'f'|'kill'|'drain'|'drainMp',
    mp, range, area: 0|1|2|'map',
    target: 'foe'|'ally'|'self',
    status?, buff?: { stat, mult, turns }, special?, hitMod?, desc,
  }
  ```
- 伤害公式（research P3）：
  - `a`：`(L+Δ+5)×0.7+14`
  - `b`：`(L+Δ+5)×0.9+18`
  - `c`：精神不低于目标时 `(L+Δ+1)/2+12`，否则 `+13`
  - `d`：`(L+Δ)×1.2+30`
  - `e`：`(L+Δ+4)×0.4+8`
  - `f`：`(L+Δ)/5+5`
  - `kill`：目标全部兵力
  - 结果乘 `SPELL_SCALE`（全局系数，校准用，自行设计），再乘地形 / 兵种修正。
- 射程与范围（自行设计，统一规则）：普通单体 3 格；“阵”字策略为范围 1（十字）；“龙”字策略为范围 1（方形 3×3）；巨岩、爆焰、海啸为范围 1；谎言、定军、毒雾为范围 1；砂暴为全图（只打野外地形：平原、草原、森林、山地、荒地类）。
- MP 按威力分档，自行设计；有单一来源的取其值，例如小补给 6、强阵 12、输送 18、回归 24、谎报 8、谎言 18、晕眩 16。
- 地形限制（自行设计，参考 P5）：
  - 火系：目标不能在河流、桥梁上；在战船、森林、营寨上威力加成（沿用现有的 `fire` 倍率）。
  - 水系：目标或其相邻格须有河流、桥梁、战船。
  - 地系：目标或其相邻格须有山地、森林。
  - 风系：目标不能在城池内。
- `SERIES[x].spells`：`[{ id, lvl, tier }]`，按 research 等级表填写；`knownSpells(u)` 按等级、阶级筛选。

## 状态（新增 `src/status.js`，纯函数）
- `unit.status = { poison?: n, paralyze?: n, confuse?: n, silence?: n }`；`unit.buffs = { atk?: { mult, turns }, ... }`。
- `applyStatus(u, key)`、`cure(u, key | 'all')`；`tickStatus(u, rng)` 在所属阵营阶段开始时调用，返回事件列表供日志和特效使用：中毒扣血、按士气概率自然恢复、增减益回合递减。
- `effStats(u)`：`stats` 套上增减益（攻击 / 精神按文官、武将区分）；所有战斗公式改为读 `effStats`。
- `canMove(u)`、`canAct(u)`、`canCast(u)`、`alwaysHit(target)`（混乱必中）。

## 流程（BattleScene / actions）
- `startPhase`：对本阵营单位 `tickStatus`；混乱的单位直接标记为已行动，我军单位置灰。
- 选择单位：麻痹时移动范围只有原地；禁咒时策略菜单置灰并说明原因。
- `doSpell`：
  - 支持范围：对每个合法目标依次结算，特效一次播放。
  - 支持状态、增减益、解除、吸取、回归（目标 `acted = false` 并恢复显示）、冥想、全图砂暴。
- 反击：混乱、麻痹（自行设计：麻痹可以反击）按规则处理。
- AI（`planAI`）：枚举 `knownSpells`，按类别计分，过滤地形限制和禁咒。

## 特效（`spellFx.js`）
- 新增 `waterFx`（浪潮）、`windFx`（旋风）、`quakeFx`（岩崩，复用落石）、`statusFx(key)`、`buffFx(up|down)`、`drainFx`（光束）、`sandstormFx`（全屏风沙）。
- `castFx` 的样式按 `cat` / `elem` 选择。
- `unitView.js` 新增状态图标层：小圆徽章，毒为绿、麻痹为黄、混乱为紫、禁咒为灰，增益上箭头、减益下箭头。

## 道具
- `ITEMS` 改为原版：bean（豆）、rice（米）、peach（桃）、water（神秘水）、wine（神秘酒）、antidote（解毒药）、plaster（膏药）、stimulant（兴奋剂）、cough（止咳药）、panacea（万能药），印绶由子任务 2 加入。
- 旧 `wheat` → `rice`，旧 `wine` → `water`（读档时迁移）。
- 新游戏的初始道具和过关补给按难度表重新配置。

## 兼容
- 存档单位缺少 `status` / `buffs` 视为空对象。
- 旧的策略 id（fire、heal、heal2）只出现在运行时，没有被持久化，无需迁移。
