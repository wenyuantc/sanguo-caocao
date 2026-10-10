# 实施清单：军营与城镇自由走动（依赖 10-10-scenes、10-10-equipment 完成）

1. `story/path.js`：等角网格 A* 寻路，加 Node 测试。
2. `camp/layouts.js`：4–6 种营地 / 城镇布局。
3. `CampScene`：行走、镜头跟随、人物摆放与闲逛、对话提示、功能点、营门出征。
4. 流程接入：victory → post 场景 → 营中 → pre 场景。
5. 存档：`kind: 'camp'` 的保存、读取、导出导入、存档列表显示。
6. 内容：6 个子代理并行编写 `talks_a.js`–`talks_f.js` 和通用台词；校验脚本检查。
7. 文档：STAGE_GUIDE 增加营中台词格式；规范 state-management（营中存档）。

## 验证命令
```bash
node scripts/validate-stages.mjs
npm run build
```
- Node：寻路测试。
- 浏览器：营中行走、对话、功能点、存档读档；抽查 10 个关卡的专属台词；57 关回归（脚本自动从营门出征）。
