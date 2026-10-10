# 实施清单
1. 新增 settings.js；config.js 改 RES 来源。
2. main.js 应用 antialias / fps / FPS 角标。
3. 新增 settingsMenu.js；TitleScene 加按钮。
4. unitView 画质低不建 idle tween（检查 this.idle 引用）。
5. BattleScene.onHover 去重。
6. mapRender 烘焙。
7. 验证：`npm run build`、`node scripts/validate-stages.mjs`、浏览器手测标题设置与战斗流程。
