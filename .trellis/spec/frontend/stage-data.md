# 关卡数据

> 关卡、单位、事件、对白和武将外形都是**纯数据**。字段的权威说明见 `docs/STAGE_GUIDE.md`；
> 本文记录代码如何读取这些数据，以及现有各组文件遵循的约定。

---

## 文件归属

- 关卡分在 6 个组文件 `src/stages/a.js` … `f.js` 中，每组由一个编辑者/智能体负责
  （分工表见 `docs/STAGE_GUIDE.md` §1）。只修改本组的关卡文件和对应的 `src/characters/extra_<组>.js`。
- `src/stages.js` 按顺序拼接各组并调用 `normalizeStage`；数组顺序**不决定**关卡推进，推进由 `next` 决定。
- 每个关卡 id 必须已在 `PLANNED_IDS`（`src/stageMeta.js`）中。新增 id 需要同时修改
  `stageMeta.js`、`docs/STAGE_GUIDE.md` 和 `GQ.md`。

## 文件结构

```js
// 第三组：第二章 河北之争（第 16~25 关）     ← 头部注释：组 + 章节 + 关卡范围
import { P, E, A } from './helpers.js';
const CH = '第二章 河北之争';                  ← 共用的章节名

// 我军武将辅助函数，只在本文件内使用（a.js 写法）
const CAOCAO = (lv, x, y) => P('caocao', '曹操', 'lord', lv, x, y, { leader: true, bonus: { atk: 4, int: 6 } });
// 或者用武将表 R = { id: [名字, 兵种, bonus, extra|棋子字] }（e.js / f.js 写法）

export default [
  // ==================== 第 16 关 徐州入侵战 ====================
  { id: 'xuzhou_ruqin', no: 16, chapter: CH, name: '徐州入侵战', next: 'baima', turns: 25, ... },
];
```

- 武将辅助函数**有意在每个组文件中各写一份**（组之间不互相导入），这样各组可以并行编辑。
  id、兵种和 bonus 必须与 STAGE_GUIDE §6 的表一致。
- 单位一律用 `helpers.js` 的 `P` / `E` / `A` 创建（参数 `(id, name, cls, lvl, x, y, extra)`）；
  `E`/`A` 默认 `ai: 'aggressive'`。

## 引擎如何读取关卡

| 字段 | 读取位置 |
|------|----------|
| `map`（行数 × 列数 = `MAP_SIZES[id]`；旧版 13 × 18） | `drawMap`、`terrainAt`、`reachable`、镜头 / 小地图；字符是 `terrain.js` 中 `TERRAIN` 的 key（30 种，一字符一格） |
| `mapVersion`（1 旧版 / 2 原版尺寸） | `normalizeStage` 默认 1；写入战斗中存档，读档不一致时从本关开头重开；校验按版本检查尺寸 |
| `units` | 敌军/友军：`BattleScene.create` → `createUnit(def, null, difficulty)`；我军：`deploy.planDeploy` 推导出阵位置、上限、必须 / 不可出阵，整备后 `buildPlayerDefs` → `createUnit(def, roster[id], difficulty)`。都先按 `flagOk`（`ifFlag`/`unlessFlag`）过滤 |
| `deploy`（可选） | `planDeploy`：`{ max?, required?, slots? }` 覆盖自动推导（见 `docs/STAGE_GUIDE.md` §3），校验脚本检查格式 |
| `victory[]` | `checkEnd`（`boss`/`all`/`reach`）、`nextPhase`（`survive`）、`drawGoals`（`reach` 目标格） |
| `protect`、`escape`、`victoryFlags` | `checkEnd`、`tryEscape`、`victory()` |
| `events[]` | 援军默认从最近地图边缘走入（6 格内，更远淡入）；落点被占时 `spawnTile` 在曼哈顿 3 格内找该兵种可站的空格，都没有才放弃该单位；`fireEvents`（回合 + 阵营，阵营默认 `'enemy'`）、`fireDeathEvents`（`onDeath`）、`findDuel`/`runDuel`（`duel`）。已触发事件在 `firedEvents` 中**按数组下标**记录 |
| `prologue` / `epilogue` / `epilogues{annihilate,retreat,win,…}` | 在剧情场景中演出（`story/auto.js` 的 `autoScene` 生成脚本）；结尾对白选择顺序（`postLines`）：`annihilate`（敌军全灭时）→ `epilogues[outcome]` → `epilogue` |
| `scenes`（可选）`{ pre?, post? }` | `sceneFor`：手写脚本优先于自动生成；`post` 可为数组或与 `epilogues` 同名的分支对象（加 `default`）。手写时原对白（含 `choices` / `red` / `setFlag`）须原样放进 `say`，prologue / epilogue 字段保留。指令见 `docs/STAGE_GUIDE.md` §8.5 |
| `events[].stage`、`units[].from` | `battleStage.js`：战场演出指令与援军入场格（见 §8）；地形变化写入战斗存档 `mapPatches` |
| `next` | `stages.js` 中的 `resolveNext(stage, outcome, annihilated, red)` |
| `victoryText`、`defeatText`、`turns` | `Hud` 右侧面板 / 顶栏 |

`firedEvents` 记录的是下标，并且会写入战斗中存档，所以**在已发布的关卡中重排或插入事件，会破坏该关的
战斗中存档**。新事件请追加在末尾。

出阵推导依赖关卡数据：预设我军单位的站位就是出阵位置；胜负条件、`protect`、`escape`、`victoryFlags`、
事件（duel / onDeath / setAi）中的我军 id，以及 `side: 'player'` 对白的发言人都会被列为必须出阵；事件 `units`
里的我军武将在该关不可出阵。修改这些字段会改变整备界面的可选范围；新增可加入的武将要登记到 `src/generals.js`。

## 对白行

`{ who, side?, text, ifFlag?, unlessFlag?, choices? }`

- `who` 必须与单位名/武将名一致才能显示正确头像；`'旁白'` 表示旁白（不显示头像）。
- `choices: [{ text, red, flag?, reply: [对白] }]` → `BattleScene.applyChoice` 累加 `red`、设置 `flag`。
- 红色指数在 `machao` 之后决定路线：`routeOf(red)` ≥ 3 忠臣线，≤ −3 奸雄线，其余为中间路线（剧情同奸雄线）。

## 武将外形

- `src/characters.js` 的 `BASE` 是**中文名 → 外形字段**的映射（字段说明见文件头注释）。
  各组新增的人物写在 `src/characters/extra_<组>.js`，格式为 `export default { 名字: {...} }`。
- `extra_<组>.js` 每次都一次性完整写入：其他组运行校验时也会导入它，必须随时保持语法正确。
- 未登记的名字会退回兵种外形（`heroSprites.lookOf`）和按名字推断的外形（`portraits.lookFor`：
  `术士` / `黄巾` / `弓`）。普通士兵（名字匹配校验脚本 `GENERIC` 正则：兵/军/贼/伏兵/…）不需要登记。

## 校验（必须执行）

```bash
node scripts/validate-stages.mjs        # 全部组 + 从 FIRST_STAGE 出发的可达性
node scripts/validate-stages.mjs c      # 只校验 C 组（其他组正在编辑时使用）
```

必须 0 错误，每条警告都要排查（当前基线：57 关全部 mapVersion 2，0 警告）。正式关卡用旧版 18×13 地图（mapVersion 1）算错误，只有调试关卡可以用。
校验内容：地图尺寸（mapVersion 2 = `MAP_SIZES`，并须写 `deploy.slots`，预设我军必须在 slots 中）/字符、`defeatText` 中的回合数等于 `turns`、按兵种系列通行规则的站位、单位站位与地形、站位重叠、胜利/撤离/保护目标、事件结构、对白字段、
未登记外形的说话人、`next` 指向和首领可达性。
