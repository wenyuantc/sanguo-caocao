# 实施清单：原版策略体系与异常状态（依赖子任务 10-10-promotion 完成）

1. 新增 `src/spells.js`：`SPELLS`（约 70 种）、伤害公式、射程 / 范围 / MP 规则、地形限制；`data.js` 再导出。
2. `SERIES[x].spells` 按 research 等级表填写；新增 `knownSpells(u)`。
3. 新增 `src/status.js`：异常、增减益、`effStats`、`tickStatus`、各种判定函数。
4. `logic.js`：
   - 战斗公式改读 `effStats`；混乱必中；
   - `spellDamage` 按公式类别计算；
   - `planAI` 扩展各类策略的计分与地形过滤。
5. `actions.js` 的 `doSpell` 支持范围、状态、增减益、特殊效果；道具支持解除和新道具。
6. `BattleScene`：
   - 阶段开始时处理状态；
   - 混乱、麻痹、禁咒对选择、移动和菜单的限制；
   - 回归后恢复行动。
7. `spellFx.js`：新增各元素和状态特效；`unitView.js` 显示状态图标；`hud.js` 信息面板显示状态。
8. `ITEMS` 换成原版消耗品；更新初始道具和过关补给；`applyLoad` 迁移旧道具 id。
9. 文档：STAGE_GUIDE（兵种可学策略说明）；规范 data-contracts（SPELLS、ITEMS 结构）。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- 浏览器：脚本逐个施放全部策略（参照之前“13 种兵器 + 4 种策略”的测试写法），检查无报错、效果正确；四种异常和道具逐一验证。
- 抽查习得：风水士、策士、道士、骑马策士、舞娘、君主在 1 / 15 / 30 / 35 级时的策略列表。
- 57 关回归；颍川、官渡、赤壁 AI 完整对战。

## 风险与回滚点
- 策略总伤害可能偏高或偏低：先用 Node 脚本对比改动前后在代表关卡的伤害量级，再调整 `SPELL_SCALE`。
- AI 计分可能让敌人一直施放减益而不攻击：给辅助类计分设上限，回归测试中统计各类行动的比例。
