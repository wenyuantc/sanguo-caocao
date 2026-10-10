# 目录结构

> 代码如何组织：`src/` 下是扁平的原生 ES 模块，不按功能分文件夹。

---

## 目录布局

```
index.html              # <div id="game">，加载 /src/main.js
src/
├── main.js             # new Phaser.Game({ scene: [TitleScene, BattleScene, EndingScene] })
├── config.js           # TILE/COLS/ROWS/MAP_X/MAP_Y/WIDTH/HEIGHT、字体、COLORS、RES + hiDpi()
├── data.js             # 静态规则表：TERRAIN、RANGES、CLASSES、ADVANTAGE、SPELLS、ITEMS、DIFFICULTIES
├── logic.js            # 纯规则：属性计算、Dijkstra 移动范围、伤害/命中、AI 决策（不依赖 Phaser）
├── actions.js          # 作用于场景的异步战斗行动：doAttack/doSpell/doItem/killUnit/runAI
├── stageMeta.js        # normalizeStage、PLANNED_IDS、FIRST_STAGE、ENDINGS（不依赖 Phaser，校验脚本也会用）
├── stages.js           # 汇总 stages/a..f.js → STAGES、getStage、routeOf、resolveNext
├── stages/
│   ├── helpers.js      # 单位工厂 P / E / A
│   └── a.js … f.js     # 每组关卡一个文件（A–F），default 导出关卡对象数组
├── characters.js       # 按中文名登记的外形表 BASE + 合并 extra_a..f；颜色工具函数
├── characters/extra_<组>.js  # 各组补充的武将外形（default 导出对象）
├── generals.js         # 武将总表 GENERALS（默认兵种、bonus、阵亡/离队标记、joinAt），纯数据
├── deploy.js           # 出阵推导 planDeploy / buildPlayerDefs（纯函数，不依赖 Phaser）
├── saves.js            # localStorage 存档位/自动存档、导出导入、applyLoad
├── saveMenu.js         # 存档/读档弹窗 UI（openSaveMenu）
├── prep.js             # 出阵整备弹窗 UI（openPrep）
├── infoPanel.js        # 部队情报弹窗 UI（openInfo）
├── ui.js               # panel/text/button/portrait/DialogBox/floatText/wait
├── hud.js              # class Hud：顶栏、右侧面板、日志、横幅
├── unitView.js         # class UnitView：单个单位的容器、兵力条、移动/受击补间；tileCenter
├── mapRender.js        # drawMap：用 Graphics 绘制地形格
├── heroSprites.js      # Canvas 2D 战场小人（unitTexture）、共用绘图工具 kit()
├── portraits.js        # Canvas 2D 头像（portraitTexture）
├── attackFx.js / spellFx.js / duel.js  # 攻击、策略/道具、单挑过场动画
└── scenes/
    ├── TitleScene.js   # key 'Title'
    ├── BattleScene.js  # key 'Battle'：回合循环、输入、事件、胜负
    └── EndingScene.js  # key 'Ending'
scripts/validate-stages.mjs  # 关卡数据的 Node 校验脚本（直接导入 src/ 模块）
docs/STAGE_GUIDE.md          # 关卡编写的权威规范
GQ.md                        # 与 1998 原版对照的关卡清单
```

---

## 依赖方向

```
data.js、config.js、stageMeta.js        （底层表，不导入其他游戏代码）
        ↑
logic.js（规则）   stages/*.js（数据）   characters.js（外形）
        ↑
actions.js、ui.js、hud.js、unitView.js、*Fx.js、heroSprites.js、portraits.js
        ↑
scenes/*.js
```

- `logic.js` 只导入 `config.js` 和 `data.js`；保持不依赖 Phaser、不访问场景，规则才能复用
  （AI 决策和 HUD 攻击预测调用的是同一批函数）。
- `stageMeta.js`、`stages/*.js`、`data.js`、`characters.js`、`generals.js`、`deploy.js` 必须能被 Node 直接导入：
  `scripts/validate-stages.mjs` 会直接 import 它们。这些文件里不要导入 `phaser`，也不要访问 `window`/`localStorage`。
- 只有场景负责把各模块串起来。

---

## 新代码放哪里

| 改动 | 位置 |
|------|------|
| 新关卡 | 所属组的 `src/stages/<a-f>.js`（见 `docs/STAGE_GUIDE.md` §1）；id 必须在 `PLANNED_IDS` 中 |
| 新的具名武将外形 | 首次引入该人物的组的 `src/characters/extra_<组>.js` |
| 新兵种/地形/策略/道具/难度 | `src/data.js` 中对应的表（绘制补在 `heroSprites.js`/`mapRender.js`/`spellFx.js`） |
| 新规则或公式 | `src/logic.js` 中导出的纯函数 |
| 新的带动画的战斗行动 | `src/actions.js`（async，接收场景 `s`） |
| 新的可复用控件 | `src/ui.js` 中的工厂函数 `(scene, x, y, ...)` |
| 新画面 | `src/scenes/<Name>Scene.js`，并在 `main.js` 的 scene 数组中注册 |

---

## 命名

- 模块用 camelCase（`saveMenu.js`、`heroSprites.js`）；场景文件和类用 PascalCase
  （`BattleScene.js` / `class BattleScene`）。场景 key 是短字符串：`'Title'`、`'Battle'`、`'Ending'`。
- 关卡 id 用拼音 snake_case，保持稳定（`xuzhou_fuchou`、`z_dingjun`、`j_jianye`）。忠臣线前缀 `z_`，奸雄线前缀 `j_`。
- 常量用 UPPER_SNAKE_CASE（`PLANNED_IDS`、`SLOT_COUNT`、`TILE`）。
