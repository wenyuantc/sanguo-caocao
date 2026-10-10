# 三国志曹操传（网页版）

基于 **Phaser 4 + Vite + 原生 JavaScript（ES 模块）** 的浏览器战棋游戏，参照光荣 KOEI 1998 年的《三国志曹操传》复刻。全部图形（地图、兵种、头像）都由代码生成，没有外部素材文件。

## 特色

- **完整战役**：按原版顺序收录 57 关，包括序章到第三章的共通线、忠臣线和奸雄线。部分关卡要满足条件才会出现，详见 [GQ.md](GQ.md)。
- **剧情分支**：红色指数决定路线走向，≥ 3 进入忠臣线，≤ -3 进入奸雄线。全灭敌军或选择撤退也会改变后续关卡。
- **原版兵种体系**：君主、步兵、弓兵、骑兵、弓骑兵、炮车、武道家、贼兵、策士、风水士、道士、骑马策士、舞娘等系列，每系三阶，可用印绶转职。
- **地形**：平原、森林、山地、村庄、河流、城池、战船、营寨等，影响移动消耗、防御和回复，也会改变火计效果。
- **策略与状态**：火、水、地、风系伤害策略，以及增减益、回复和中毒、麻痹、混乱、禁咒等异常状态。
- **单挑过场**：特定关卡会触发武将单挑演出。
- **出阵整备**：开战前选择出阵武将，可在部队情报中查看能力。
- **道具**：豆、米、桃、神秘水、神秘酒、解毒药、膏药等。
- **存档**：100 个手动存档位，每章胜利后自动存档，并支持导出 / 导入 JSON 存档文件（数据保存在浏览器 `localStorage`）。

## 快速开始

需要 Node.js 环境。

```bash
npm ci
```

```bash
npm run dev
```

启动后在浏览器打开终端里显示的本地地址即可游玩。

| 命令 | 说明 |
|---|---|
| `npm ci` | 按 `package-lock.json` 安装依赖 |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 生产构建，输出到 `dist/` |
| `npm run preview` | 本地预览生产构建 |
| `node scripts/validate-stages.mjs` | 校验全部关卡数据 |
| `node scripts/validate-stages.mjs c` | 只校验指定分组（可传多个字母） |

## 操作

- 鼠标点选单位、移动、攻击和选择菜单
- `Esc`：取消当前操作或关闭面板
- `←` / `→`：在情报、整备、存档界面中翻页

## 目录结构

```
index.html              页面入口
src/
  main.js               初始化 Phaser
  config.js             画面尺寸、颜色、字体等常量
  scenes/               标题、战斗、结局场景
  logic.js              战斗计算等核心逻辑
  actions.js            单位行动
  data.js               地形、兵种、道具数据
  spells.js / status.js 策略表与异常状态
  stages/a.js ~ f.js    分组关卡数据（由 stages.js 汇总）
  stageMeta.js          关卡元信息、结局定义
  characters/           各组新增武将外形
  generals.js           武将总表
  deploy.js / prep.js   出阵推导与出阵整备界面
  duel.js               单挑过场
  saves.js / saveMenu.js 存档读写与存档界面
  heroSprites.js, portraits.js, mapRender.js 等  程序化绘制的图形
scripts/validate-stages.mjs  关卡校验脚本
docs/STAGE_GUIDE.md          关卡编写指南
GQ.md                        关卡总表与完成情况
```

## 参与开发

- 编写或修改关卡前，先阅读 [docs/STAGE_GUIDE.md](docs/STAGE_GUIDE.md)。关卡校验必须零错误，警告也要逐一排查。
- 代码风格：两空格缩进，语句结尾加分号，字符串用单引号，相对导入写明 `.js` 扩展名。
- 修改玩法或界面后，用 `npm run dev` 手动验证移动、战斗、对白、存档等受影响的流程，提交前执行一次 `npm run build`。
- 更完整的贡献约定见 [AGENTS.md](AGENTS.md)。

## 声明

本项目是个人学习用的同人复刻，与光荣特库摩（KOEI TECMO）无关。《三国志曹操传》相关名称和设定的版权归原权利人所有。
