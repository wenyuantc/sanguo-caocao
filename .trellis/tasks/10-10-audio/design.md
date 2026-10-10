# 设计：配乐与音效

## 模块
- `src/audio/engine.js`：
  - 单例 `AudioEngine`：管理 `AudioContext`、主音量、配乐 / 音效两个总线、混响（程序生成的脉冲响应）；
  - `unlock()`：首次用户操作时调用；`visibilitychange` 时暂停或恢复。
- `src/audio/instruments.js`：音色函数 `(ctx, dest, time, note, dur, vel)`，包括拨弦（Karplus-Strong 近似：噪音激励 + 反馈延迟）、笛、二胡、钟、鼓、锣。每个音符播放完自动断开节点。
- `src/audio/songs.js`：曲目数据，纯数据：速度、调式（五声音阶）、各声部音符序列（简谱式字符串解析）、循环点。
- `src/audio/sequencer.js`：提前 100ms 排程（look-ahead 调度），支持渐变切换和循环。
- `src/audio/sfx.js`：音效函数表，按事件名调用（如 `sfx('attack', { weapon: 'glaive' })`）。
- `src/audio/music.js`：`playMusic(场合 | 曲id)`；场合映射与每关战斗曲分配表（参考 research §3.1）。

## 接入点
- 场景：Title（标题）、StoryScene（剧情 / 中国地图）、CampScene（军营）、BattleScene（军议 → 战斗；我军回合不换曲，与原版一致；危急时切换）、单挑（单挑曲）、胜利、败北、结局。
- 动作：`ui.button`（点击音）、`UnitView.moveAlong`（脚步）、`attackFx` 各兵器、`spellFx` 各系、`actions`（升级、撤退、道具）、天气变化。
- 设置面板：新增 `src/settings.js` 覆盖层（滑条用 `ui.js` 新增的 `slider` 工厂函数）。

## 性能与泄漏
- 每个音符、音效的节点在 `onended` 时断开；同时发声的音效限制 8 个。
- 回归测试统计活动节点数。
