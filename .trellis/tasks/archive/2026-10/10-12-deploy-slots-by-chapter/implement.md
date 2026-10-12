# 实施计划：出阵名额按章节递增

## 步骤

1. **`src/deploy.js`：章节增量表 + 补位函数**
   - 新增 `CHAPTER_BONUS`、`chapterKey`、`extraSlots(stage, baseSlots, n)`（算法见 design.md），按 `stage.id` 缓存。
   - `planDeploy`：`slots` 追加补出的位置，`max = baseMax + extra.length`，返回值加 `bonus`。
   - 验证：`node -e` 打印每关 `max` 前后对比，与 design.md 原型结果一致（57 关全部补足）。

2. **`scripts/validate-stages.mjs`：出阵推导检查**
   - 对 `planDeploy(s)` 的新位置检查：在地图内、常用兵种可通行、不与任何单位 / 援军 / 原出阵位 / reach / escape 格重叠 → 不满足报 error。
   - 补到的数量少于章节增量 → 报 warn（列出关卡与数量）。
   - 校验 `deploy.bonus`（若写）为非负整数。
   - 验证：`node scripts/validate-stages.mjs` 0 错误。

3. **文档 / 规范**
   - `docs/STAGE_GUIDE.md` §3 出阵覆盖字段补充 `bonus`，并说明章节增量规则与补位条件。
   - `.trellis/spec/frontend/stage-data.md` 的 `deploy` 行同步。

4. **整体验证**
   - `node scripts/validate-stages.mjs` → 0 错误。
   - `npm run build` → 通过。
   - 浏览器（preview）：
     - 新游戏第 1 关整备：显示 `出阵 x / 6`，招募一个小兵后能选上场，开战后站在新出阵位上；
     - `?camp=hulao` 进营中整备：名额 10，招募单位可上场，出征后阵容带入战场；
   - `node scripts/camp-smoke.mjs`（需先起 `npx vite --port 5191`）抽查几关通过。

## 评审节点

- 步骤 1 完成后先看数据对比，确认数字正确再做步骤 2。
- 全部完成后跑 trellis-check。

## 回滚点

- 只动 `deploy.js` / 校验脚本 / 文档；出问题把 `CHAPTER_BONUS` 全部置 0 或 revert 提交即可。
