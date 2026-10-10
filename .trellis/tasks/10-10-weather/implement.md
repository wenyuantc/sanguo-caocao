# 实施清单：天气系统（依赖 10-10-status、10-10-equipment 完成）

1. 新增 `src/weather.js`：天气表、随机游走算法、关卡天气映射；写 Node 测试脚本统计变化分布。
2. `spells.js`：火系加天气限制；新增 3 个天气策略和 4 个四神；更新骑马策士系列的习得表。
3. `logic.js`：新增 `spellUsable`，替换菜单、AI、预测中分散的可用性判断。
4. `actions.js`：天气策略、四神的结算；`spellFx.js` 新增雷击、朱雀火鸟、玄武黑雾、白虎光环特效。
5. `BattleScene`：维护天气、阶段开始时变化、存档字段。
6. 新增 `src/weatherFx.js`；顶部栏显示天气图标。
7. 文档：STAGE_GUIDE 增加关卡 `weather` 字段说明；规范 state-management（`weatherIdx`）。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- Node：天气变化分布测试。
- 浏览器：逐种天气检查画面；火系策略在雨天被禁用；天气策略和四神逐一施放。
- 57 关回归。

## 风险
- 粒子数量影响性能：限制同屏粒子数（≤ 200），在 57 关回归中观察帧率和内存。
