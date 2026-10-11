# 设计：音频引擎与音效

## 模块（`src/audio/`）
- `engine.js`：单例 `AudioEngine`
  - `ctx`、`master`、`musicBus`、`sfxBus`、`reverb`（程序生成的脉冲响应，作为两个总线的发送效果）；
  - `unlock()`：首次用户操作时创建 / 恢复 `AudioContext`；未解锁前所有播放调用静默忽略；
  - `setVolumes({ music, sfx, mute })`：0–100 映射到增益，静音时主音量为 0；
  - 监听 `visibilitychange`：隐藏时 `ctx.suspend()`，显示时 `ctx.resume()`；
  - `activeNodes` 计数（供回归测试读取，如挂到 `window.__audioStats`）。
- `instruments.js`：`play<音色>(dest, time, note, dur, vel)`，`note` 用 MIDI 号或频率；拨弦用 Karplus-Strong 近似（噪音激励 + 反馈延迟）；所有节点在 `onended` 时断开并更新计数。子任务 2 的音序器直接复用这些函数。
- `sfx.js`：`sfx(name, opts)` 按事件名查表，如 `sfx('attack', { weapon })`、`sfx('spell', { school: 'fire' })`；超过 8 个同时发声时丢弃最旧或直接忽略新的；未解锁时无操作。

## 接入点
- `ui.js` 的 `button`：点击音（确认 / 取消按按钮类型区分）。
- `unitView.js` 移动：脚步（按格节拍）。
- `attackFx.js`：按兵器类型出声；命中 / 会心 / 闪避在结算处出声。
- `spellFx.js`：按策略系别出声。
- `actions.js`：升级、转职、得到道具 / 宝物、撤退。
- `weather.js` / `weatherFx.js`：天气变化；BattleScene 回合开始。
- 接入只加一行 `sfx(...)` 调用，不改变原有动画时序。

## 设置
- `settings.js`：`DEFAULT_SETTINGS` 增加 `music: 70`、`sfx: 80`、`mute: false`；`SETTING_OPTIONS` 中按现有校验方式支持；音量值校验为 0–100 的整数。
- `settingsMenu.js`：
  - 增加音量行，滑条由 `ui.js` 新增的 `slider` 工厂函数实现；拖动时实时调用 `engine.setVolumes` 并保存；
  - `apply()` 只在渲染类设置（res / quality / fps / showFps）有改动时才重载页面；
  - `openSettingsMenu(scene, { audioOnly })`：战斗中打开时只显示音量行。
- BattleScene 的系统菜单增加“设置”入口。
- `main.js` 启动时用 `SETTINGS` 初始化音量。
- TitleScene：首屏提示“点击开始”，首次 pointerdown / keydown 调用 `unlock()`。
