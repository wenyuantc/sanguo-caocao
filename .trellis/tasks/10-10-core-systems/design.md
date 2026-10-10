# 设计（总体）：补齐原版核心系统

各子任务的详细设计见各自的 `design.md`。这里只记录跨子任务的共同约定。

## 事实来源
- 原版数据以 `research/` 为准；查不到的数值统一在数据条目上加 `selfDesigned` 注释或字段，并在 STAGE_GUIDE 中汇总。
- 我军武将的兵种、加成、加入时机、阵亡标记以 `src/generals.js` 为准，关卡文件里的我军 `cls` 不再是事实来源。
- 敌方特殊兵种按名字登记在 `src/characters.js`。
- 奖励、掉落、商店上新单独成表（`src/equipment.js`），不改 57 关文件。

## 模块边界（遵守 `.trellis/spec/frontend/directory-structure.md`）
- 纯数据，Node 可导入：`data.js`、`spells.js`、`equipment.js`、`generals.js`、`characters.js`、`stages/*`。
- 纯规则函数：`logic.js`、`status.js`、`deploy.js`，不依赖 Phaser。
- 界面与表现：`prep.js`、`infoPanel.js`、`hud.js`、`spellFx.js`、`unitView.js`、`heroSprites.js`。
- 流程：`scenes/BattleScene.js`、`actions.js`。

## 统一的能力读取路径
`calcStats(u)`（兵种系列 + 阶级 + 等级 + 武将加成 + 难度倍率 + 装备 + 果子）→ `effStats(u)`（再叠加增减益和异常）→ 所有战斗公式、预测、AI。

## 持久化的增量
registry 和存档依次新增：
- `joined`（子任务 1）；
- `roster[id].cls / tier`（子任务 1 / 2）；
- 单位的 `status / buffs`（子任务 3）；
- `inventory / gold / roster[id].equip / fruits`（子任务 4）。

每次新增都同步更新：新游戏重置、`snapshot`、`writeAuto`、`applyLoad`、导出 / 导入。旧存档缺字段时给默认值。

## 平衡策略
- 公式系数（`BASE5`、`SPELL_SCALE` 等）集中定义，用 Node 脚本对比改动前后的数值量级。
- 每个子任务结束时，用我军 AI 完整对战代表关卡，确认没有明显失衡。
