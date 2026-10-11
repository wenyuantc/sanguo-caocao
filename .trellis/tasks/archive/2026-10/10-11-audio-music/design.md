# 设计：配乐与场景接入

## 模块（`src/audio/`）
- `sequencer.js`：look-ahead 调度（每 25ms 检查，提前 100ms 排程）；`play(song, { fade })` 渐出旧曲、在下一小节渐入新曲；`stop(fade)`；循环点支持。所有音符调用子任务 1 的 `instruments.js`，输出到 `musicBus`。
- `songs.js`：纯数据。每首：`id`、`bpm`、调式（宫商角徵羽）、拍号、`loop`（循环起点小节）、各声部 `{ instrument, notes }`；`notes` 用简谱式字符串（如 `"1 2 3 5 | 6. 5 3 -"`，`.` 附点、`-` 延长、`'` / `,` 高低八度），在加载时解析。
- `music.js`：
  - `playMusic(场合 | 曲id)`：同曲正在播放时不重启；
  - `OCCASION`：场合 → 曲目 id；
  - `BATTLE_MUSIC`：关卡 id → 战斗曲 id（参考 research §3.1，未列出的关卡用默认战斗曲）；
  - 危急判定：曹操或胜利条件关键单位兵力低于阈值，或回合接近上限时切危急曲。

## 接入点
- `TitleScene`、`StoryScene`（剧情 / 中国地图）、`CampScene`（军营）、`BattleScene`（军议 → 战斗 → 危急）、单挑（`duel.js`）、胜利 / 败北、`EndingScene`。
- 读档进入场景时按当前场合播放。

## 性能
- 音序器只在可见时调度；隐藏时随 `ctx.suspend()` 一起暂停，恢复后从当前时间重新排程，不补发错过的音符。
- 回归脚本统计 `__audioStats.activeNodes`。
