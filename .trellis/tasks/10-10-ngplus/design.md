# 设计：二周目继承

## 数据与存储
- `src/legacy.js`：`readLegacy()` / `writeLegacy()`（localStorage `sanguo-legacy`）→ `{ endings: { loyal?, villain?, middle? }, codex: [宝物id] }`；`recordEnding(route)`、`recordTreasure(id)`。
- `ENDINGS` 增加 `END_MIDDLE: 'middle'`：`machao` 的分路解析中，`routeOf(red) === 'middle'` 时仍进入奸雄线关卡，但用 flag 记录路线为 middle，最终关 `j_jianye` 胜利时，按路线记录 middle 或 villain 结局，并显示对应结局文字。

## 流程
- `EndingScene`：调用 `recordEnding(route)`；新增中间路线结局文字。
- `equipment` 子任务的宝物入账函数中调用 `recordTreasure`。
- 新游戏：如果 `legacy.endings` 非空，颍川之战的开场场景插入许子将对话（选项按 PRD G4）；选择结果写入 registry：升级 → 我军初始等级加成（`roster` 预置）；全部宝物 → 背包加入 50 件宝物（等级 = 曹操等级 / 4 + 1）；拒绝 → 加金钱。
- 标题画面：结局标记（程序绘制的三只鸟，按达成情况着色）+ “图鉴”按钮（覆盖层，网格显示 50 件宝物，未收集显示剪影）。
- `saves.exportAll` / `planImport` / `applyImport` 增加 `legacy` 字段的导出与合并。
