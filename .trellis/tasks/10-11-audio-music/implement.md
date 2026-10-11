# 实施清单：配乐与场景接入（需 10-11-audio-engine-sfx 完成）

1. `audio/sequencer.js` + 简谱解析；先写一首测试曲验证调度与循环。
2. `audio/songs.js`：至少 10 首曲目。
3. `audio/music.js`：场合映射、每关战斗曲分配表、危急判定。
4. 接入各场景（见 design.md）。
5. 规范：`scene-and-rendering.md` 补充配乐接入约定（场景如何调用 `playMusic`）。

## 验证
```bash
npm run build
```
- 浏览器：逐场合检查曲目；抽查若干关的战斗曲与危急切换；切后台再回来；57 关回归统计音频节点数与内存。
