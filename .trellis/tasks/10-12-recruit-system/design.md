# 技术设计：招募系统

## 1. 数据模型

新增 registry 键（随存档读写）：

- `recruits`：`{ [id]: { name, cls, kind: 'general' | 'soldier', bonus?, mark? } }`
  - id 形如 `rec1`、`rec2`…（`rec` + 递增序号；关卡里已有敌军 id `r1`~`r6`，不能用 `r`，取当前最大序号 + 1），不会与 `GENERALS` / 关卡单位 id 冲突。
  - 招募后同时写入 `roster[id] = { lvl, exp: 0, tier }` 与 `joined`，后续成长、装备、果子沿用现有 roster 通路。
- `recruitPool`：`{ stageId, names: [武将名…], refreshLeft }` —— 当前关卡间隙的候选武将。`stageId` 与当前整备关卡不同时重新生成（每关重置）。

## 2. 成员判定（核心改动）

`src/generals.js` 增加招募武将的镜像表，避免把 registry 传遍所有调用点：

```js
const RECRUITS = {};
export const setRecruits = (map) => { /* 清空后写入 map */ };
export const generalOf = (id) => GENERALS[id] || RECRUITS[id];
export const isGeneral = (id) => Object.hasOwn(GENERALS, id) || Object.hasOwn(RECRUITS, id);
export const isRecruit = (id) => Object.hasOwn(RECRUITS, id);
```

- 同步时机：`resetCampaign`（清空）、`restoreRegistry`（读档）、招募成功（写入后）。只有这三处会修改 `recruits`。
- 把调用点中的 `GENERALS[id]` 改为 `generalOf(id)`：`logic.roleOf`、`deploy.planDeploy` / `buildPlayerDefs`、`CampScene`（营中人物、补发装备）、`BattleScene.kitFor`。
- `planDeploy` 的候选池在遍历 `GENERALS` 之外，追加 `joined` 中的招募 id。招募单位没有 `gone` / `joinAt`，也不会被 `blocked`（id 与关卡敌将不同）。
- 剧情相关的 `GENERAL_NAMES` / `GENERAL_CLS`（story、logic）保持只认 `GENERALS`，不受影响。

权衡：模块级可变状态违反"纯数据"约定，但能把改动限制在少数调用点。只要上述三处同步不漏，就能与 registry 保持一致。

## 3. 招募池与数值（`src/recruit.js`，新文件，纯函数）

- **武将候选全集**：`CHARACTERS` 中的名字，去掉 `GENERALS` 中的名字、`RECRUIT_EXCLUDE`、已招募的名字，以及找不到兵种的名字。
  - `RECRUIT_EXCLUDE`（君主 / 非战斗 / 特殊）：刘备 孙坚 孙策 孙权 袁绍 袁术 董卓 张角 张鲁 刘璋 陶谦 孟获 韩遂 献帝 魔王孔明 孔明幻影 亡灵集合体 许劭 田氏 黄承彦。
- **武将兵种**：先查 `CLASS_BY_NAME`，再查从全部关卡数据中扫描到的同名单位兵种（取首次出现）。结果为 lord / emperor / commoner / transport 或缺失的，不进候选。
- **候选数量**：每批 4 名，随机抽取；刷新时换一批全新的（尽量不与当前批重复）。
- **小兵**：固定兵种 步兵 infantry / 弓兵 archer / 骑兵 cavalry / 策士 strategist / 风水士 healer，可无限购买。命名为"系列名 + 天干序号"（步兵甲、步兵乙…，用完后续加数字），无外形条目，按默认外形渲染。
- **等级**：`lvl = max(1, 曹操等级 - 1)`；tier 由 `tierFor` 按等级定阶。
- **强弱**（通过 bonus 实现，不改成长档）：
  - 武将：按兵种主属性 +6，并给 hp +4。
  - 小兵：五项各 -4，hp -4。
- **价格**：小兵 `300 + lvl×10`；武将 `800 + lvl×30`。
- **开局金币**：`resetCampaign` 把 gold 设为 1000（原为 0）。

## 4. 界面

- `src/prep.js` 新增第五页 `['recruit', '招　募']`：
  - 左栏：小兵兵种 5 行，每行有价格和"招募"按钮。
  - 右栏：武将候选 4 行（立绘图标、名字、兵种、等级、价格、招募按钮），另有"刷新（剩余 N 次）"按钮。
  - 金币不足或刷新次数用尽时按钮置灰，并沿用现有 toast 提示。
- 招募后需要刷新阵容：`openPrep` 新增 `opts.replan`（返回新 plan 的函数）。招募成功后用新 plan 替换 cards / generals 等派生数据，使阵容、装备页能立即看到新成员。BattleScene 与 CampScene 各自传入自己的 plan 生成函数。
- **出战前整备**（BattleScene）：默认显示全部 5 页，所以开局第一战前就能招募。
- **营地**：
  - 大帐整备加入 recruit 页。
  - `src/camp/layouts.js` 的 5 套布局各加一个 `recruit: { at, name: '募兵官', face }`。CampScene 生成 `role: 'recruit'` 的 NPC，标签为"募兵官（招募）"，交互时调用 `openPrepUI` 打开仅含 recruit 页的界面。

## 5. 存档兼容

- `restoreRegistry`：没有 `recruits` / `recruitPool` 的旧存档按 `{}` / `null` 处理。`joined` 过滤改在 `setRecruits` 之后执行（否则会把招募 id 过滤掉）。
- 写存档（`BattleScene` 自动存档、`CampScene.snapshot`）：加入 `recruits`、`recruitPool`。
- 战斗中存档：招募单位的 id 在 `recruits` 中，`restoreUnit → roleOf` 能够取到兵种。

## 6. 回滚

功能集中在 `recruit.js` 与 prep 招募页；成员判定改动在 `generals.js`。回滚时还原这些文件，并把 gold 初值改回 0。
