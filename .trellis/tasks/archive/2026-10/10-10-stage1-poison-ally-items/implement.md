# 执行计划

## 步骤

1. [ ] `src/logic.js` `spellDamage`：乘入 `a.spellMult || 1`。
2. [ ] `src/status.js` `tickStatus` 支持传入中毒比例；grep 全部调用点后在 `BattleScene` 传入 `this.stage.poisonRate`。
3. [ ] `src/stages/a.js` 第一关：`zhangbao`、`hj12` 加 `spellMult: 0.6`，关卡加 `poisonRate: 0.05`。
4. [ ] `scripts/validate-stages.mjs`：补 `spellMult` / `poisonRate` 校验（若有未知字段检查）。
   - 回滚点 A：以上为“毒烟”独立部分，可单独提交。
5. [ ] `src/data.js` 加 `ALLY_ITEMS`；`createUnit`（及读档恢复处，如不经过 createUnit）为友军补默认 `items`。
6. [ ] `BattleScene.snapshot()` 浅拷贝 `items`。
7. [ ] `src/logic.js`：新增 `itemTargetsAt`、`itemScore`，`planAI` 增加 `type: 'item'` 计划。
8. [ ] `src/actions.js`：`runAI` 处理 item 计划；`doItem` 按使用者阵营扣对应补给。
9. [ ] （可选）`BattleScene.itemTiles` 改用 `itemTargetsAt` 去重。
10. [ ] `docs/STAGE_GUIDE.md` 与 `helpers.js` 注释：记录 `spellMult`、`poisonRate`、友军 `items` 字段。

## 验证

```bash
node scripts/validate-stages.mjs
npm run build
```

手动（`npm run dev`，普通难度，第一关）：
- 张宝毒烟命中：预测值与实际值一致，约为原来 60%；中毒每回合扣约 5% 最大兵力。
- 刘关张受伤 / 中毒后会对自己或相邻友军用豆 / 解毒药，玩家军需数量不变，补给用尽后不再用。
- 中途存档、读档，友军剩余补给正确。
- 抽查第 2 关以后有道士 / 中毒的关卡数值未变。

## 审查关口
- 步骤 4 后：确认第一关数值手感，再继续 AI 部分。
- 步骤 8 后：观察友军是否“只吃药不打仗”，必要时调低 `itemScore` 系数。
