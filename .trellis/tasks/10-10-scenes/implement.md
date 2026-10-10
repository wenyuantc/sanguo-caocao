# 实施清单：剧情场景演出（依赖 10-10-bigmap 完成）

1. `story/backgrounds.js`：三类背景，各 3–5 种变化。
2. `story/actors.js`：场景小人（四方向、10 种动作、表情气泡），等角坐标换算。
3. `story/runner.js` 指令解释器；新增 `StoryScene`；接入标题、胜利、结局流程；跳过和加速。
4. `story/auto.js`：57 关自动演出。
5. 战场演出：事件的 `stage` 指令、援军走入、地形变化（`mapPatches` 写入存档）。
6. 手写重点场景约 15 场（写在对应组的 `stages/<组>.js` 的 `scenes` 字段）。
7. 校验脚本扩展；STAGE_GUIDE 增加场景指令文档；规范 scene-and-rendering。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- 浏览器：逐一播放 15 场手写场景（截图检查）；抽查 10 关自动场景；战场演出（援军走入、开城门、放火）；跳过与加速。
- 57 关回归（脚本自动跳过演出）。

## 风险
- 场景小人需要新的姿态绘制，工作量集中在 `heroSprites`：先做站立、行走、作揖三种验证管线，再补其余动作。
