# 实施清单：出阵整备与情报界面

1. 新增 `src/generals.js`（武将总表，含阵亡 / 离队标记）。
2. 新增 `src/deploy.js`：`planDeploy`、`buildPlayerDefs`。
   - 写一个 Node 临时脚本，对 57 关逐关打印 max、required、blocked、pool，人工抽查：yingchuan、zhangxiu1、baima、machao、z_maicheng、j_dingjun。
3. 修改 `BattleScene`：
   - `create()` 分离我军生成；
   - 新增 `startPrep()`、`focusUnit()`；
   - 胜利时写入 `roster.cls` 和 `joined`。
4. 新增 `src/prep.js` 整备界面、`src/infoPanel.js` 部队情报界面；在 `hud.js` 加“部队”按钮。
5. 存档相关：
   - `saves.js`：`applyLoad` 恢复 `joined`，修复 `validSave`；
   - `TitleScene`：新游戏重置 `joined`；
   - `snapshot` / `writeAuto` 写入 `joined`。
6. `scripts/validate-stages.mjs` 支持校验可选的 `deploy` 字段；`docs/STAGE_GUIDE.md` 补充 `deploy` 说明。
7. 更新规范：`.trellis/spec/frontend/state-management.md`（新增 `joined`、`roster.cls`，删除已修复的已知问题）、`stage-data.md`（`deploy` 字段）。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- 浏览器实测 PRD 中各条验收标准；用测试脚本模拟点选卡片、确认出阵、打开情报界面、点击行。
- 57 关回归：测试脚本在整备界面直接确认默认阵容，其余流程同之前。
- 存档：旧格式存档（手工构造：没有 `joined`、roster 没有 `cls`）读档；当前格式导出后再导入。

## 风险与回滚点
- `BattleScene.create()` 的生成顺序改动最大。若出问题，回退到“整备界面只决定替换名单、其余仍按原逻辑生成”的保守实现。
- 必须出阵的推导可能过严。抽查时如果发现某关可选空间为 0 且明显不合理，用 `deploy.required` 修正。
