# 设计：兵种体系与转职

## 数据（`src/data.js`）
- `GRADE = { S: 4, A: 3, B: 2, C: 1 }`。
- `SERIES[id]`：
  ```js
  {
    tiers: [{ name, glyph, move, range }],   // 三阶；单阶特殊兵种只有一项
    moveType: 'foot' | 'horse',
    type: 'horse' | 'foot' | 'bow' | 'mage' | 'siege' | 'noble',   // 相克类型
    grow: { atk, int, def, burst, morale },  // 成长档字母
    hp: [基础, 每级], mp: [基础, 每级],
    weapon: '剑' | '枪' | '弓' | '棍' | '投石机' | '扇' | '宝剑',
    armor: '铠' | '衣',
    spells?: 由子任务 3 填写,
  }
  ```
  - 系列 id 沿用现有兵种 id，不改关卡数据：`lord / infantry / archer / cavalry / archercav / catapult / fighter / bandit / strategist / healer / taoist`。
  - 新增：`mountstrat`（骑马策士）、`dancer`（舞娘）、`xiliang`（西凉骑兵）、`yellow`（黄巾贼，关卡中的 `bandit` 敌兵按名字映射过来）、`pirate`、`dudu`、`sorcerer`（咒术士）、`emperor`（皇帝，沿用现有 id）、`commoner`、`transport`。
- `RANGES` 新增原版范围：`cross`（十字，即现有的 `melee`）、`around`（周围 8 格）、`ring2`（d = 2 环，即现有的 `bow`）、`r23`（2~3）、`r24`（2~4）、`line2`（直线 2 格）、`ring4`（d = 4 环）、`r45`（4~5）。旧名 `melee`、`bow`、`far` 保留为别名。
- `CLASSES` 改为由 `SERIES` 派生的兼容视图：`classOf(cls, tier)` 返回 `{ name, glyph, move, moveType, range, type, spells }`。现有代码中的 `CLASSES[u.cls]` 全部改为 `classOf(u.cls, u.tier)`。

## 能力计算（`src/logic.js`，纯函数）
- `calcStats(u)` 读取 `u.cls / u.tier / u.lvl / u.bonus / u.mult / u.gradeMod`（以及子任务 4 的装备加成）：
  - `hp = 系列基础HP + bonus.hp + 每级HP × (lvl + 2 × (tier − 1))`，`mp` 同理；
  - 五项 = `BASE5 + GRADE[档] × lvl + bonus[key]`。`BASE5` 是统一基础值（自行设计，用于校准量级）；`bonus.agi` 视为 `burst`（兼容现有关卡数据）。
  - 敌军乘以 `mult`（难度）。
- 公式：
  - `physDamage`：`atk` 对 `def`；
  - `hitRate` / `critRate`：双方 `burst` 之差；
  - `spellHit`：双方“`int` + `morale`”之差；
  - `spellDamage` / `healAmount`：按 research 中的分段公式（子任务 3 落实）。
  - 系数在实施时用代表关卡校准，目标是与现状量级接近。
- 我军武将的 `cls` 和 `gradeMod` 取自 `src/generals.js`（子任务 1）。敌军按 `characters.js` 中的 `cls` 覆盖（按名字），没有登记的保留关卡中的兵种。
- `tier`：我军取 `roster[id].tier`（默认 1）；敌军和友军取 `lvl >= 30 ? 3 : lvl >= 15 ? 2 : 1`；单阶兵种恒为 1。

## 转职
- `ITEMS.seal`（印绶）：使用条件为我军、`tier < 3`、`lvl >= [15, 30][tier − 1]`。
- `promote(u)`（`logic.js`）：`tier += 1`，重新计算能力，兵力、策略值回满；返回变化差值。
- 道具菜单中，不满足条件的印绶按钮置灰，选择目标时显示原因。
- 播放转职特效：复用 `spellFx.js` 的光柱和星光，加金色字样“转职·<新名称>”。
- 胜利时 `roster[id].tier` 写入 registry；战斗中存档的单位自带 `tier`。

## 外形（`heroSprites.js` / `characters.js`）
- `CLASS_LOOK` 补上新系列；贴图 key 加入阶级：`hero-${cls}-${tier}-${faction}-${name}`。
- `drawHuman` / `drawHorse` 接受 `tier`：二阶加金边、披风，三阶换华丽盔甲、马匹披甲。
- `characters.js` 中按名字登记 `cls` 覆盖（吕布：xiliang 等），同时影响外形。

## 兼容
- 读取旧存档：
  - roster 缺 `tier` → 1；
  - 战斗存档的单位用新 `calcStats` 重新计算；
  - 旧存档的 `cls` 若为改动前的我军兵种，以武将总表为准（读档时覆盖）。
- 校验脚本：
  - `cls` 必须是 `SERIES` 的 key；
  - 单位站位按新系列的移动方式检查（例如曹仁改骑兵后不能站山地）。
  - 我军武将改兵种后，可能出现站位非法的情况，由校验脚本找出，逐一调整站位。

## 取舍
- 不逐关修改 `cls`，改由武将总表 / 登记表覆盖：改动集中、可回退；代价是关卡文件中的 `cls` 对我军不再是事实来源（在 STAGE_GUIDE 中注明）。
