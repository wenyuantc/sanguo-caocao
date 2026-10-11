# 实施清单：音频引擎与音效

1. `audio/engine.js`：上下文、总线、混响、解锁、后台暂停、节点计数。
2. `audio/instruments.js`：全部音色；写一个调试函数（如 `window.__audioTest('zheng')`）逐个试听。
3. `audio/sfx.js`：E3 全部音效与 8 个并发上限。
4. 接入各动作（见 design.md 接入点）。
5. 设置：`settings.js` 新字段、`ui.js` 的 `slider`、`settingsMenu.js` 音量行与 `audioOnly`、战斗系统菜单入口、`main.js` 初始化、标题“点击开始”。
6. 规范：`scene-and-rendering.md` 增加音频接入约定（sfx 调用方式、节点断开、未解锁静默）。

## 验证
```bash
npm run build
```
- 浏览器：逐个触发全部音效；调整音量 / 静音后刷新确认保存，确认不重载；战斗中打开设置；切后台；大量触发音效后检查 `activeNodes` 回落；57 关回归无报错。

## 评审关口
- 步骤 2 完成后先试听音色再继续；步骤 5 后确认原有渲染设置行为未变。
