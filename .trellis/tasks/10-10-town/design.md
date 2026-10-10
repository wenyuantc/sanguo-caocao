# 设计：军营与城镇自由走动

## 模块
- `src/scenes/CampScene.js`（新 Phaser 场景）：
  - 背景与人物复用 `story/backgrounds.js`、`story/actors.js`；
  - 可走网格：等角坐标的格子，带障碍标记；
  - 曹操的移动用 A* 寻路（新增纯函数 `src/story/path.js`，可用 Node 测试）。
- `src/camp/layouts.js`：营地 / 城镇布局（背景种类、障碍格、功能点位置、出生点），纯数据，约 4–6 种。
- `src/camp/talks.js`：
  - `CAMP_TALKS[关卡id] = [{ who, lines: [对白行，可带 choices] }]`（本关专属）；
  - `GENERIC_TALKS[武将id] = [[对白行]...]`（通用）。
  - 纯数据，按组分文件（`talks_a.js`–`talks_f.js`），便于并行编写。
- 交互：
  - 面朝的相邻格有人物时，显示“对话”提示；
  - 功能点：商人 → `prep.js` 的商店页；大帐 → 整备界面；营门 → 确认对话框后进入下一关。

## 流程
- `BattleScene.victory` → `StoryScene(post)` → `CampScene(下一关id)` → 营门 → `StoryScene(pre)` → `BattleScene`（整备 → 战斗）。
- 结局关之后不进入营中。

## 存档
- `saves.js` 新增 `kind: 'camp'`，记录 `{ stage: 下一关id, talked: [...], ...战役状态 }`；
- `applyLoad` 遇到 `camp` 时启动 `CampScene`；
- 存档列表显示“营中 · 下一战：<关名>”。
- 导出 / 导入支持 `camp`。

## 内容编写
- 与第一轮关卡编写一样，6 个子代理按 A–F 组并行编写 `talks_<组>.js` 和通用台词（通用台词由一个子代理统一写）。
- 写台词前先读对应关卡的 prologue、事件和地图，保证情报准确。
