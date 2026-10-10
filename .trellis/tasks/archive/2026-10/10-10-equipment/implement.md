# 实施清单：装备与宝物（依赖 10-10-prep、10-10-promotion、10-10-status 完成）

1. `src/equipment.js`：
   - `EQUIP`（87 种）、`REWARDS`、`DROPS`、`SHOP_UNLOCK`、价格、果子映射、升级插值函数；
   - 写一个 Node 临时脚本，核对数量（37 普通 + 50 宝物）与 research 名单逐项一致。
2. 初始装备：`defaultEquipFor(general, lvl)`（E3 规则），加入时生成；为旧存档补默认装备。
3. `logic.js` / `status.js`：`calcStats` 加入装备和果子；`effMove`；预测函数和 AI 读取装备效果。
4. `actions.js`：经验与升级、附加异常、封杀反击、再反击、连击、MP 减半、命中修正；阶段开始的每回合效果。
5. `BattleScene.victory`：奖励、金钱、奖励面板；击破掉落即时进背包。
6. `prep.js`：装备、道具、商店三页；程序化装备图标。
7. 存档：`inventory`、`gold`、`equip`、`fruits` 接入新游戏重置、`snapshot`、`writeAuto`、`applyLoad`、导出导入。
8. 校验脚本：`REWARDS` / `DROPS` 引用的关卡、物品、敌将必须存在。
9. 文档：STAGE_GUIDE（奖励、掉落、商店表）；规范 data-contracts、state-management。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- 浏览器：
  - 逐个装备 50 种宝物并触发效果（脚本化）；
  - 换装前后预测对比；
  - 装备升级到上限；卖出得果子、吃果子；
  - 商店随关卡上新；奖励和掉落；
  - 存档读档、导出导入保留全部状态。
- 代表关卡 AI 完整对战（5 关）；57 关回归。

## 风险与回滚点
- 宝物特效分散在结算流程中：每种效果单独成函数，在 `strike` / `doAttack` 中集中调用，便于逐个开关排查。
- 数值膨胀：宝物 Lv9 上限按原版填写后，用代表关卡对战检查；必要时下调敌方掉落和奖励的初始等级（研究规则 = 曹操等级 / 4 + 1）。
