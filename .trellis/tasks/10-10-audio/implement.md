# 实施清单：配乐与音效（依赖 10-10-scenes、10-10-town 完成）

1. `audio/engine.js`、`instruments.js`、`sequencer.js`；先做一首测试曲验证音色和调度。
2. `audio/songs.js`：至少 10 首中国风曲目（自行作曲，不模仿原版旋律）。
3. `audio/sfx.js`：A3 全部音效。
4. 接入各场景和各动作；`music.js` 的场合映射与每关战斗曲分配。
5. `settings.js` 设置面板，`ui.js` 新增 `slider`；标题“点击开始”解锁音频。
6. 规范：scene-and-rendering 增加音频接入约定。

## 验证命令
```bash
npm run build
```
- 浏览器：各场合曲目、各音效触发（脚本逐个触发）、音量设置保存；57 关回归时统计音频节点数和内存。
