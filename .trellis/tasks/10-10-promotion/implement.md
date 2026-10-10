# 实施清单：兵种体系与转职（依赖子任务 10-10-prep 完成）

1. `data.js`：
   - 新增 `GRADE`、`SERIES`（13 个可转职系列 + 用得到的单阶兵种）、新的 `RANGES`；
   - `classOf(cls, tier)`；`CLASSES` 保留为兼容视图。
2. `logic.js`：
   - `calcStats(u)` 改为新公式；新增 `promote(u)`、`tierFor(u)`；
   - 战斗公式改用五项能力；
   - 全局把 `CLASSES[u.cls]` 替换为 `classOf(u.cls, u.tier)`（logic、actions、BattleScene、hud、heroSprites、validate 脚本）。
3. `generals.js`：
   - 填入原版兵种与个人修正（research §6）；
   - 加入满宠、貂蝉、曹丕，以及对应的 `joinAt`。
4. `characters.js`：按名字登记敌方特殊兵种的 `cls`。
5. 视觉：`heroSprites.js` 补新系列外形和阶级差异，贴图 key 加入阶级；`hud.js` 信息面板显示五项能力和阶级名称。
6. 印绶：
   - `ITEMS.seal`、道具菜单的使用条件、转职特效；
   - 过关奖励发放印绶（暂时写在 `DIFFICULTIES.reward` 的按关卡进度规则中，子任务 4 再并入 `rewards`）。
7. 存档兼容：`applyLoad` 补 `tier`；读档时重新计算能力。
8. 校验脚本：
   - 支持新的系列和覆盖逻辑；
   - 运行全量校验，修正因兵种改变而非法的我军站位（不改其他内容）。
9. 公式校准：
   - 写一个 Node 脚本，比较改动前后代表单位在第 1、10、20、31、45 关的伤害、命中数值；
   - 调整 `BASE5` 和公式系数，使量级接近现状。
10. 文档：STAGE_GUIDE（兵种列表、能力字段、我军兵种由总表决定）；规范 data-contracts / state-management。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- 浏览器：抽查各系列外形和阶级变化；用印绶转职（15、30 级）；信息面板显示正确。
- AI 完整对战：颍川、官渡、赤壁（普通难度）。
- 57 关回归（每关两回合）。

## 风险与回滚点
- 公式整体替换影响所有关卡的平衡。先完成第 9 步的数值对比再接入，必要时保留旧公式开关，便于对照。
- 兵种改为骑马后站在山地的我军单位：由校验脚本列出，逐一调整站位。
