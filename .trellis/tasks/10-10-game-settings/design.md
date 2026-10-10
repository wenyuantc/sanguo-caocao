# 设计

- `src/settings.js`：`SETTINGS_KEY='sanguo-settings'`、`DEFAULT_SETTINGS`、`loadSettings()`、`saveSettings()`、`resolveRes()`；不依赖 config.js。
- `src/config.js`：`SETTINGS = loadSettings()`，`RES = resolveRes(SETTINGS)`（原固定 2）。
- `src/main.js`：`antialias` 按画质，`fps.limit` 按帧率上限；`showFps` 时 DOM 角标读 `game.loop.actualFps`。
- `src/settingsMenu.js`：仿 `saveMenu`/难度选择的弹窗（depth 3000、遮罩、ESC 关闭并移除监听）；草稿改动，保存时写入并 `location.reload()`。
- `TitleScene`：第三个按钮「游 戏 设 置」。
- `UnitView`：画质低时不创建待机 tween。
- `BattleScene.onHover`：按 `格子+state` 去重，`focus` 等主动刷新处清空去重键。
- `mapRender.drawMap`：Graphics 绘入 DynamicTexture（尺寸 × RES），销毁 Graphics，返回 Image（scale 1/RES）。

兼容性：settings 只影响渲染，不进入存档；回滚即删除新增文件并恢复 RES=2。
