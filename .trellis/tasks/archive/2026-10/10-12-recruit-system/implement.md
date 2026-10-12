# 执行计划

1. `src/generals.js`：RECRUITS 镜像、`setRecruits` / `generalOf` / `isRecruit`，扩展 `isGeneral`。
2. `src/recruit.js`：排除名单、兵种推导（CLASS_BY_NAME + 关卡扫描）、候选抽取 / 刷新、小兵定义与命名、价格、`recruitUnit(registry, ...)` 写 recruits / roster / joined / gold 并同步镜像。
3. 调用点改 `generalOf`：`logic.js` roleOf、`deploy.js`（候选池含招募 id、buildPlayerDefs）、`CampScene.js`、`BattleScene.js` kitFor。
4. 存档：`TitleScene.resetCampaign`（gold 1000、recruits {}、recruitPool null、setRecruits({})）；`saves.js` restoreRegistry；BattleScene 自动存档与 CampScene snapshot 带上新键。
5. `prep.js`：招募页 + `opts.replan`；BattleScene / CampScene 传入 replan。
6. 营地：layouts 5 套加募兵官位置；CampScene 生成 NPC、标签、activate 分支。
7. 验证：
   - `node scripts/validate-stages.mjs` 零错误
   - `npm run build` 通过
   - 浏览器手动：新游戏 → 第一战整备招募小兵 + 武将 → 刷新 3 次后置灰 → 出阵战斗 → 胜利进营地 → 候选已换批且刷新次数重置 → 募兵官可招募 → 存档读档后招募单位仍在、可出阵、装备正常

回滚点：第 1~4 步完成后先跑校验和构建，确认数据通路不破坏现有流程，再做界面部分。
