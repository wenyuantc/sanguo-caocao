# 金手指功能 · 实施计划

1. 设置项：`src/settings.js` 新增 cheat / cheatGod / cheatKill / cheatMove → 验证：旧 localStorage 设置读入不报错，默认关闭。
2. 规则模块：新建 `src/cheat.js`（cheatOn / markCheat / cheatDmg）。
3. 效果挂钩：`actions.js` strike / doSpell，`status.js` tickStatus，`BattleScene.finishUnit` → 验证：开关关时行为与原来完全一致。
4. 存档标识：registry `cheated` 的写入（Battle/Camp create、开关切开）、snapshot / victory writeAuto / Camp snapshot、`restoreRegistry`、TitleScene 新游戏重置、`saveMenu.js` 标签。
5. UI：`settingsMenu.js` 金手指行 + `onCheat` 参数；新建 `src/cheatMenu.js`；BattleScene `openCheat` / `cheatWin`；CampScene 新增「设置」按钮与同步逻辑。
6. 验证命令：
   - `node scripts/validate-stages.mjs`（零错误）
   - `npm run build`
   - `npm run dev` 手动走查：标题开关 → 新游戏战斗中无敌/秒杀/无限行动 → 金手指面板改金币/加道具果子/加装备 → 存档显示标签 → 关开关再存仍有标签 → 读档继承 → 直接胜利进入营中 → 营中面板改资源并在整备/商店可见。
7. 规格更新：`.trellis/spec/frontend/state-management.md` 记录 registry `cheated` 与设置 cheat* 键；`data-contracts.md` 存档字段 `cheated`。

回滚点：步骤 3 完成后可单独验证效果；步骤 4、5 相互独立。
