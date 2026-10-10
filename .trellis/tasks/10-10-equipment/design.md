# 设计：装备与宝物

## 数据（`src/equipment.js`，纯数据，Node 可导入）
- `EQUIP[id]`：
  ```js
  {
    name,
    slot: 'weapon'|'armor'|'acc',
    kind: '剑'|'枪'|'弓'|'棍'|'投石机'|'扇'|'宝剑'|'铠'|'衣'|'盾'|'马铠'|'盔'|'巾'|'手套'|'马'|'书'|'玉'|…,
    series: [可装备系列] | 'all',
    treasure: bool,
    stat: { atk?, int?, def?, burst?, morale?, hp?, mp?, move? },   // 1 级数值
    max: { ... },        // 普通装备为 3 级值；宝物为 Lv9 值（research §5）
    price?,
    effects: [{ type, ...参数 }],
    sellFruit?,          // 普通装备 3 级卖出得到的果子
    selfDesigned?: [...],
  }
  ```
- 等级 n 的属性 = 1 级值线性插值到上限值。
- 效果类型：
  - 攻防相关：`noCounter`、`chain`、`reCounter`、`onHitStatus`、`hitDown`、`spellHitDown`、`spellHitUp`、`mpHalf`、`rangeUp`；
  - 成长相关：`move`、`expMul`、`expPerTurn`、`weaponExpPerTurn`、`armorExpPerTurn`；
  - 回复相关：`cureEachTurn`、`healEachTurn`；
  - 其他：`copySpells`（遁甲天书）、`fourGod`（四神，暂不生效）。
- `REWARDS`：关卡 id → `[{ item, gold?, ifFlag?, unlessFlag?, route? }]`，单独成表，不改关卡文件（关卡对象也可写 `rewards` 覆盖）。
- `DROPS`：关卡 id → `{ 敌将id: 物品id }`。
- `SHOP_UNLOCK`：关卡 id → `[商品]`，按 research §7。解锁按“已经到达的关卡”计算；红蓝线分别列出。

## 状态
- registry：
  - `inventory: [{ uid, id, lvl, exp }]`；
  - `gold`；
  - `roster[id].equip = { weapon: uid, armor: uid, acc: uid }`；
  - `roster[id].fruits = { atk: n, ... }`。
- `shopSeen`：已解锁的商品集合，也可以按关卡顺序即时计算，不存储。
- 战斗内：我军单位带 `equip`（实例副本，包含等级和经验）；敌军单位可带 `equip`（掉落物）。

## 计算接入（`logic.js` / `status.js`）
- `calcStats(u)` 加上装备属性和果子加成；`effStats` 叠加增减益。
- 预测函数和 AI 读取装备效果：`noCounter` 时不计算反击伤害，`hitDown` 降低命中，射程用 `classOf` 范围加上 `rangeUp`。
- 移动力加成加到 `classOf(...).move`，通过 `effMove(u)` 读取。

## 结算挂钩（`actions.js`）
- `strike` 之后：
  - 武器 / 护具得经验，必要时升级（日志：“XX 的 倚天剑 升至 Lv3”）；
  - `onHitStatus` 按概率附加异常。
- `doAttack`：
  - `noCounter` 时跳过反击；
  - `reCounter` 时被反击后再攻击一次；
  - `chain`：击破后寻找下一个可攻击的目标继续攻击，每回合最多一次（自行设计）。
- 阶段开始（`startPhase`）：处理 `cureEachTurn`、`healEachTurn`、`expPerTurn`、`weaponExpPerTurn`、`armorExpPerTurn`。
- `doSpell`：`mpHalf`、`spellHitUp` / `spellHitDown`；遁甲天书在策略列表中合并相邻友军的已知策略。
- 胜利（`victory`）：
  - 发放 `REWARDS` 和金钱，战后弹出奖励清单面板；
  - 掉落在击破时即时进入背包，并有飘字和图标动画。

## 界面（`src/prep.js` 扩展）
- 标签页：出阵、装备、道具、商店。
- 装备页：左侧武将列表，中间三个栏位，右侧背包（按类别筛选，只显示该武将能装备的）；选中装备时显示能力变化对比（绿色增加、红色减少）。
- 商店页：买、卖两个分页；卖出 3 级普通装备时提示将得到的果子；显示金钱。
- 道具页：消耗品列表，可以吃果子（选择武将）。
- 装备图标：`spellFx.js` 的 `canvasTex` 方式按类别程序化绘制，复用道具图标的写法。

## 兼容与迁移
- 旧存档：没有 `inventory` / `gold` / `equip` 时，按 E3 为已加入的武将生成默认装备，`gold = 0`。
- 战斗中存档：单位的 `equip` 随单位保存（不包含派生属性）。
- 导出 / 导入：新字段随存档数据进出，`planImport` 校验时不强制要求这些字段。

## 取舍
- 奖励、掉落、上新单独成表，不改 57 关文件：改动集中，便于对照 research 核对；代价是关卡文件不再完整描述奖励（在 STAGE_GUIDE 中注明）。
