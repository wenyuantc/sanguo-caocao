# 关卡编写规范（复刻《三国志曹操传》1998 光荣原版）

## 1. 文件分工（只改自己的文件）
| 组 | 关卡文件 | 武将外形补充 | 负责关卡（id，按顺序） |
|---|---|---|---|
| A | src/stages/a.js | src/characters/extra_a.js | 1 yingchuan 颍川之战、2 sishui 汜水关之战、3 hulao 虎牢关之战、4 dongzhuo 董卓追击战、5 qingzhou 青州黄巾讨伐战、6 xuzhou_fuchou 徐州复仇战、7 puyang1 濮阳之战、8 puyang2 濮阳之战（二）、9 puyang3 濮阳之战（三） |
| B | src/stages/b.js | extra_b.js | 10 xiandi 献帝救出战、11 zhangxiu1 张绣讨伐战、12 yuanshu 袁术讨伐战、13 zhangxiu2 张绣讨伐战（二）、14 xuzhou_jiuyuan 徐州救援战、15 lvbu_baowei 吕布包围战 |
| C | src/stages/c.js | extra_c.js | 16 xuzhou_ruqin 徐州入侵战、17 baima 白马之战、18 yanjin 延津之战、19 guandu 官渡之战、20 cangting 仓亭之战、21 rangshan 穰山之战、22 liyang 黎阳之战、23 yecheng 邺城之战、24 nanpi 南皮攻略战、25 liucheng 柳城平定战 |
| D | src/stages/d.js | extra_d.js | 26 bowangpo 博望坡之战、27 changban 长坂坡之战、28 chibi 赤壁之战、29 chibi_tuwei 赤壁突围战、30 hefei 合肥之战、31 machao 马超迎击战 |
| E | src/stages/e.js | extra_e.js | 忠臣线：z_dingjun 定军山之战、z_maicheng 麦城救援战、z_jiangling 江陵之战、z_chibi2 赤壁之战（二）、z_ruxu 濡须口之战、z_jianye 建业入侵战、【终章 魔王复活】z_yufupu 突破鱼腹浦、z_baidi 白帝城之战、z_jiange 剑阁之战、z_yangping 阳平关之战、z_wuzhang1 五丈原之战（一）、z_wuzhang2 五丈原之战（二） |
| F | src/stages/f.js | extra_f.js | 奸雄线：j_zhanglu 张鲁讨伐战、j_xiaoyao 逍遥津之战、j_ruxu 濡须口之战、【终章 天下统一】j_dingjun 定军山之战、j_hanshui 汉水之战、j_xiegu 斜谷之战、j_fancheng 樊城救援战、j_yangping 阳平关之战、j_jiange 剑阁之战、j_chengdu 成都入侵战、j_baidi 白帝城之战、j_chibi2 赤壁之战（二）、j_ruxu2 濡须口之战（二）、j_jianye 建业入侵战 |

## 2. next 衔接（必须严格照写）
- 线性：每关 `next` 指向本表中的下一关；组末关指向下一组首关（A→xiandi，B→xuzhou_ruqin，C→bowangpo）。
- `puyang1`: `{ annihilate: 'xiandi', retreat: 'puyang2', default: 'xiandi' }`；`puyang2`: `{ annihilate: 'xiandi', retreat: 'puyang3', default: 'xiandi' }`；`puyang3`: `'xiandi'`。濮阳之战须提供“全灭”与“曹操撤退到撤离点（reach，outcome:'retreat'）”两种胜利条件。
- `chibi`: `{ annihilate: 'hefei', retreat: 'chibi_tuwei', default: 'chibi_tuwei' }`；`chibi_tuwei` → `hefei`。
- `machao`: `{ route: { loyal: 'z_dingjun', villain: 'j_zhanglu' } }`。
- `z_wuzhang2` → `'END_LOYAL'`；`j_jianye` → `'END_VILLAIN'`。
- `j_dingjun`: `{ retreat: 'j_hanshui', default: 'j_fancheng' }`（汉中城失守后选撤退 → reach 撤离点）；`j_hanshui` → `j_xiegu` → `j_fancheng`。

## 3. 关卡对象格式
```js
import { P, E, A } from './helpers.js';
export default [{
  id: 'hulao', no: 3, chapter: '第一章 霸王诞生', name: '虎牢关之战',
  next: 'dongzhuo',
  turns: 25,                                   // 回合上限
  victoryText: '击退吕布 或 全灭敌军',            // 显示在右侧面板，≤ 18 字
  victory: [{ type: 'boss', target: 'lvbu' }, { type: 'all' }],
  // 可选：protect: ['xiandi'], defeatText: '曹操或献帝撤退 / 超过 25 回合', victoryFlags, epilogues, weather: { type, start }
  mapVersion: 2,                               // 地图版本：按原版尺寸重做后填 2（旧版 18×13 为 1，可省略）
  map: [ /* 行数 × 列数 = MAP_SIZES[id]，每行一个字符串，一字符一格 */ ],
  deploy: { slots: [[x, y], ...] },            // mapVersion 2 必须显式写出出阵位置
  prologue: [{ who: '旁白', text: '……' }, { who: '曹操', side: 'player', text: '……' }],
  epilogue: [ ... ],                           // 或 epilogues: { annihilate: [...], retreat: [...], win: [...] }
  units: [ P(...), E(...), A(...) ],
  events: [ ... ],
}];
```
- 胜利条件 `victory` 数组，满足任一即胜：
  - `{ type: 'boss', target: '单位id', outcome? }` 击破指定单位
  - `{ type: 'all' }` 全灭敌军（敌军全灭时也会自动判胜）
  - `{ type: 'reach', unit: '单位id'|'any', tiles: [[x,y],...], outcome: 'retreat', fromTurn? }` 我军单位到达目标格（地图上会高亮；fromTurn 指定从第几回合起才生效）
  - `{ type: 'survive', turns: N }` 坚守到第 N 回合结束（N < turns）
- 失败：曹操撤退、`protect` 中任一单位撤退、超过 `turns`。
- `victoryFlags: [{ unit: 'guojia', alive: true, flag: 'guojia_dead', outcome? }]` 胜利时该单位存活状态符合则设标记（填 outcome 时只在该结局生效）。
- 天气（一般不用填）：开局天气按原版映射 `src/weather.js` 的 `STAGE_WEATHER` 自动决定。可选字段 `weather: { type, start }` 覆盖：`type` 天气类别 0~4（0 普通：晴/阴/雨/豪雨，1 晴好：晴/阴/雨，2 阴雨：晴/阴/雨/豪雨，3、4 含雪：晴/阴/雪），`start` 起始序号 0~5（第 1 回合天气 = `TABLE[type][start]`）。之后每回合我军阶段开始时序号随机 ±1 变化。没有原版对应的新关卡不填时用普通类别、序号 1（开局晴），校验会给出警告。
- `escape: { tiles: [[x,y],...], units: ['dianwei'] }` 撤离点：列出的我军武将行动结束停在撤离点即撤出战场（不算阵亡，alive 变为 false），地图上以蓝框标出。
- 出阵整备（自动推导，一般不用填）：出阵位置 = 本关预设我军单位的站位，上限 = 位置数，默认阵容 = 预设阵容。
  必须出阵：曹操、不在武将总表（`src/generals.js`）中的临时成员、在胜利条件 / `protect` / `escape` / `victoryFlags` / 事件（duel、onDeath、setAi）中出现的我军武将、开场 / 结尾 / 事件对白中 `side: 'player'` 发言的预设我军武将。
  不可出阵：带阵亡 / 离队标记的武将、本关事件中途生成（或作为敌军 / 友军登场）的武将。
  推导不合理时可用可选字段覆盖：`deploy: { max?: 出阵上限, required?: [预设我军 id]（替换推导出的必须出阵名单，曹操始终必须）, slots?: [[x,y], ...]（替换出阵位置，须可通行、不重叠） }`，校验脚本会检查其格式。

## 4. 地图（尺寸取原版，一字符一格，坐标 x 0~列数−1 左→右，y 0~行数−1 上→下）
- **尺寸**：取 `src/stageMeta.js` 的 `MAP_SIZES[id]`（原版对应战场，20×20 ~ 40×40，见 research maps.md §3），`map` 为“行数”个字符串、每个长度为“列数”。屏幕上的地图区固定显示 18×13 格，其余部分靠滚动 / 小地图查看。
- **版本**：按原版尺寸重做后的关卡写 `mapVersion: 2`；没写（旧版 18×13）视为 1。版本 2 的尺寸必须与 `MAP_SIZES` 一致，否则校验报错。改变版本后，玩家该关的战斗中存档会自动从本关开头重开（成长数据保留）。
- **地形图例**（30 种，按原版编号；能力修正 / 移动消耗按兵种系列查 `src/terrain.js` 的 `TERRAIN_RULES`，数值见 research maps.md §7）：

| 字符 | 地形 | 说明 | 字符 | 地形 | 说明 |
|---|---|---|---|---|---|
| `.` | 平原 | 火 / 风可用，野外 | `+` | 城内 | 步兵 / 弓兵 110%，火可用 |
| `,` | 草原 | 骑马系 110%，火 / 风可用，野外 | `E` | 城门 | **不可通行**（本作城门不开关） |
| `F` | 树林 | 骑马系 90%·2、贼兵 110%，火可用（易燃 ×1.3） | `G` | 城池 | 全兵种 120%，回复 25%，火可用 |
| `D` | 荒地 | 骑马系 90%·2，风 / 地可用 | `P` | 关隘 | 全兵种 120%，回复 20%，火可用 |
| `M` | 山地 | 步兵系 100%·2，骑马系 80%·3，风 / 地可用 | `Z` | 鹿砦 | 全兵种 120%（骑马消耗 2），回复 20%，火可用（×1.2） |
| `X` | 岩山 | **不可通行** | `V` | 村庄 | 全兵种 110%，回复 15%，火可用 |
| `^` | 山崖 | **不可通行** | `T` | 兵营 | 全兵种 110%，回复 20%，火可用（×1.2） |
| `*` | 雪原 | 骑马系消耗 2，风 / 水可用 | `H` | 民居 | 步行系 110%·2，骑马系 90%·3，火可用 |
| `B` | 桥梁 | 火 / 风 / 水可用 | `$` | 宝物库 | 骑马消耗 2，火可用 |
| `~` | 浅滩 | 消耗 2（武道家 / 舞娘 / 海盗 / 都督 1），风 / 水可用 | `Q` | 水池 | **不可通行** |
| `%` | 沼泽 | 骑马系 80%·3，风 / 水可用 | `!` | 火 | **不可通行** |
| `O` | 池塘 | **不可通行** | `S` | 船 | 可通行（骑马消耗 2，海盗 / 都督 110%），火（×1.6）/ 水可用 |
| `W` | 小河 | **不可通行** | `A` | 祭坛 | **不可通行** |
| `R` | 大河 | **可通行**：步兵 / 弓兵 / 炮车 / 武道家 / 舞娘 / 海盗 / 都督消耗 1，其余 2；风 / 水可用 | `U` | 地下 | **不可通行** |
| `#` | 栅栏 | **不可通行** | `C` | 城墙 | **不可通行** |

- 能力修正 → 防御加成：`(修正 − 100%) × 1.5`，120% 为 +30%，80% 为 −30%（伤害、命中、AI 站位都按单位所在格计算）。
- 尽量还原原版战场形态（关隘、河流、城池、营寨、船队）。我军通常在下方/一侧，敌军首领在城池或营寨。
- 每个单位必须站在其兵种（覆盖后的系列）可通行的格子上，初始不得重叠；我军必须能走到首领附近（校验脚本会检查）。
- **重做规则（mapVersion 2，6 组并行时遵守）**：
  - 地图尺寸取 `MAP_SIZES`，不照搬原版逐格数据，只参考战场形态；
  - 所有单位站位、事件援军、`reach` / `escape` 格随新地图重排；**events 只改坐标，不增删、不重排**（已触发事件按下标记入存档）；对白、剧情不变；
  - 显式写出 `deploy.slots`（出阵位置，数量 = 出阵上限，预设我军站在其中）；
  - 回合上限按地图尺寸调整：敌我距离变远，取 `max(原上限 + ⌈(列数 + 行数 − 31) ÷ 4⌉, AI 最晚取胜回合 + 8)`（20×20 约 +3，32×32 约 +9，40×40 约 +13；AI 对战见 `scripts/ai-battle.mjs`），事件 / `survive` / `fromTurn` 回合不要落在上限前 8 回合以内；`defeatText` 里写明的“超过 N 回合”必须同步改成新的 `turns`（校验会检查）；
  - 到达 / 撤离即胜的关卡，剧情事件（如华容道关羽）的回合必须早于胜利单位最快到达的回合，否则玩家会跳过剧情，这类事件可以不顺延；
  - 援军 / 首领出击回合顺延参考：20×20 推后 0~1 回合，24 格以上推后 1~2 回合；第 1~2 回合的开局伏兵不推后；
  - 敌军不要全部堆在首领身边：大地图分散布置几处据点，保证我军每 2~3 回合有接战；敌军前锋约 2~3 回合与我军接战，除陷阱关外不要第 1 回合就贴身；
  - 城门 `E` 不可通行，只当“关着的门”装饰；城墙上的通道用 `+`（城内）或 `P`（关隘）表示，不要把唯一入口画成 `E`；慎用 `G`（城池）当城门通道：城池每回合回复 25%、能力 120%，守门敌兵会非常耐打；
  - 水面：`R`（大河）按原版可以涉渡（步兵消耗 1~2），只适合可渡的江面、航道；不可渡的深水、江心急流用 `W`（小河，原版不可进入）；
  - `!`（火）可以当静态障碍（燃烧的营帐、城中大火）；
  - 在敌我交战带放一些浅滩、桥、沼泽、荒地或山地，让水系、地系策略有用武之地（见上方策略地形类别）；
  - 援军落点被占时，引擎会在 3 格内就近找可站的空格（再没有才放弃该单位），但仍应尽量把援军放在地图边缘或敌方后方。
- **重做工具**（`scripts/mapgen/`）：
  - 画图：在自己的临时目录写一个地图模块，`import { mk } from '<仓库>/scripts/mapgen/lib.mjs'`，用 `fill / put / rect / path / scatter` 绘制，导出 `MAPS = { 关卡id: m.rows() }`；
  - `node scripts/mapgen/show.mjs <地图模块> [id]` 打印带坐标的预览；
  - `node scripts/mapgen/apply.mjs <组> <地图模块>` 把地图以字面字符串写回 `src/stages/<组>.js` 并补 `mapVersion: 2`（之后可直接手改字面量）；
  - `node scripts/mapgen/analyze.mjs <组> [id]` 行军分析：各敌人接战回合、曹操到首领 / 撤离格回合、连通性、出阵格是否可站；
  - `node scripts/mapgen/compare.mjs <组>` 与 HEAD 比较结构，去掉坐标与回合后对白、事件、单位、胜负条件必须完全一致；
  - 建议顺序：画图 → 预览 → 写回 → 排站位 → `validate-stages.mjs <组>` → analyze → compare。
- 调试：浏览器地址加 `?stage=<关卡 id>` 可以普通难度直接进入任意关卡（`?stage=test_bigmap` 为 40×40 测试地图，含全部 30 种地形，见 `src/stages/debug.js`）。

## 5. 单位
`P/E/A(id, 名字, 兵种, 等级, x, y, extra)`；extra：`leader: true`（主将，金色光环）、`ai: 'aggressive'|'hold'|'peace'`（hold 原地固守，进入攻击范围才出击；peace 原地不动且不主动攻击，用于放行/中立）、`bonus: { hp, mp, atk, int, def, burst, morale }`（旧字段 `agi` 视为 `burst`）、`mark: '惇'`（棋子上的字，默认名字首字）、`focus: '目标id'`（AI 优先攻击，用于友军关羽去单挑华雄等）、`ifFlag`/`unlessFlag`（对白行也可带这两个字段，按剧情标记显示/隐藏）。
- 兵种填写**系列 id**（`src/data.js` 的 `SERIES`），阶级不用填：敌军 / 友军按等级（含难度加级）自动定阶，门槛随难度：普通 ≥20 二阶、≥35 三阶，困难 / 地狱 ≥15 二阶、≥30 三阶（`DIFFICULTIES[id].tierLvl`）；我军由转职决定。
  - 可转职系列（一阶 / 二阶 / 三阶）：`lord` 群雄/英雄/霸王、`infantry` 轻步兵/重步兵/近卫兵、`archer` 弓兵/弩兵/连弩兵、`cavalry` 轻骑兵/重骑兵/亲卫队、`archercav` 弓骑兵/弩骑兵/连弩骑兵、`catapult` 轻炮车/重炮车/霹雳车（射程 4 / 4~5 / 4~5，不能打近身）、`fighter` 武道家/拳士/拳圣、`bandit` 贼兵/义贼/豪杰、`strategist` 策士/参谋/军师、`healer` 风水士/方术士/仙术士、`taoist` 道士/幻术士/妖术士、`mountstrat` 骑马策士/骑马参谋/骑马军师（骑马）、`dancer` 舞娘/舞伎/巫女。
  - 单阶特殊兵种：`xiliang` 西凉骑兵、`yellow` 黄巾贼、`pirate` 海盗、`dudu` 都督（骑马）、`sorcerer` 咒术士、`emperor` 皇帝（不能攻击，配合 protect，ai 用 hold）、`commoner` 百姓、`transport` 辎重队（不能攻击）。
  - 兵种覆盖（不必改关卡数据）：我军武将的兵种以武将总表 `src/generals.js` 为准，关卡里写的 `cls` 对我军武将不生效；敌军 / 友军按名字登记（`src/characters.js` 的 `CLASS_BY_NAME`，如吕布→西凉骑兵、诸葛亮→咒术士、周瑜→都督、粮草车→辎重队）或与武将总表同名（如敌将张郃→弓骑兵）覆盖；关卡兵种为 `bandit` 且名字含“黄巾”的敌兵映射为黄巾贼。站位是否可通行按覆盖后的兵种检查。
- 能力：兵力 / 策略 + 五项（攻击 atk、精神 int、防御 def、爆发 burst、士气 morale）。HP/MP = 系列基础 + 每级成长 × (等级 + 2 × 已转职次数) + 加成；五项 = 统一基础值 + 成长档（S/A/B/C = 每级 +4/+3/+2/+1）× 等级 + 加成。
- 相克：骑兵克步兵、步兵克弓兵、弓兵克骑兵（策士系、炮车、皇帝等不参与相克）。
- 主将保护：曹操与 `protect` 中的单位（不分阵营）受到的物理伤害与中毒扣血 ×0.7（`GUARD_TAKEN`），策略伤害 ×0.4（`GUARD_SPELL_TAKEN`）；由 AI 控制时（如受保护的友军）选位会避开敌人集中的格子。三阶射程（连弩 2~4、霹雳车 4~5）威胁范围很大，布置开局站位时仍应让主将远离敌方远程单位。
- 策略（原版，`src/spells.js`）：各系列按等级与阶级自动习得（`SPELL_LEARN`，二阶 / 三阶的策略须转职后才学会，转职时补学已达等级的策略），关卡里**不用也不能**为单位指定策略。会策略的系列：君主（旋风、小补给、霸气…）、贼兵（落石、咒骂…）、武道家（气合、钝兵…）、舞娘（觉醒、奋起、诱惑…）、策士 / 骑马策士（火水地风四系伤害）、道士（毒烟、定身、谎报等异常与减益）、风水士（回复、增益、回归）、海盗 / 都督（水系为主）、咒术士（几乎全部）。步兵、弓兵、骑兵、弓骑兵、炮车、西凉骑兵、黄巾贼等没有策略。
  - 射程普通 3 格；“阵”“龙”字策略与巨岩、爆焰、海啸、谎言、定军、毒雾等为十字 5 格范围（每个目标威力 ×0.4），输送、八阵图为 3×3；砂暴全图，只打身处野外（平原、草原、树林、荒地、山地、雪原、浅滩、沼泽）的敌军。
  - 地形限制（原版，按目标所在格，见第 4 节图例）：火系不能打荒地、山地、雪原、浅滩、沼泽、大河上的目标（船、树林、鹿砦、兵营上威力加成）；水系只能打桥梁、浅滩、沼泽、大河、雪原、船上的目标；地系只能打山地、荒地上的目标；风系不能打树林与建筑类地形（城内、城池、关隘、村庄、兵营等）上的目标。布置敌方策士时注意：站在平原中间的水系 / 地系策士用不出伤害策略。
  - 异常：中毒（阵营阶段开始时损失最大兵力 10%，最低留 1）、麻痹（不能移动，可原地攻击 / 施策 / 反击）、混乱（不能行动、不能反击，被攻击 / 施策必中）、禁咒（不能用策略）；最多 4 回合，每回合按士气概率自然恢复。增减益 ±20%（减益降为 70%，强行移动 +2），持续 3 回合，“攻击 / 精神”类对文官作用于精神。
- 同一关内 id 唯一。我军武将 id 必须使用下表；敌军/友军用有意义的 id（如 `lvbu`、`yanliang`、`e_cav1`）。

## 6. 我军武将表（id / 名字 / 兵种 / bonus / 起始加入关）
> 兵种、个人成长修正与 bonus 以 `src/generals.js` 为准（原版兵种，见 research class-tiers §6）；下表“兵种”列是关卡数据中的写法，仅供参考。
> 现行兵种：曹操 lord、夏侯惇 / 曹仁 / 张辽 / 曹彰 / 关羽 cavalry、夏侯渊 / 张郃 / 曹丕 archercav、曹洪 / 乐进 / 李典 / 庞德 infantry、于禁 / 徐晃 archer、典韦 fighter、许褚 bandit、荀彧 / 程昱 strategist、荀攸 / 满宠 healer、郭嘉 / 贾诩 taoist、刘晔 catapult、司马懿 mountstrat、貂蝉 dancer。
> 转职：我军 15 级（一阶→二阶）、30 级（二阶→三阶）用道具“印绶”转职；印绶从第 16 关徐州入侵战起每关胜利奖励 1 个。首次出阵的武将按等级自动定阶（例如 30 级加入即为三阶）。
> 道具（原版消耗品，`ITEMS`）：豆 / 米 / 桃（兵力 +30 / +80 / 全满）、神秘水 / 神秘酒（策略值 +30 / 全满）、解毒药 / 膏药 / 兴奋剂 / 止咳药（解除中毒 / 麻痹 / 混乱 / 禁咒）、万能药（解除全部异常）、印绶。开局与过关补给按难度表；每关胜利另按关卡序号轮流获得一件战利品（`LOOT`，桃只能由此获得）。
| id | 名字 | 兵种 | bonus | 加入 |
|---|---|---|---|---|
| caocao | 曹操 | lord | {atk:4,int:6} | 1 |
| xiahoudun | 夏侯惇 | cavalry | {atk:6} | 1 |
| xiahouyuan | 夏侯渊 | archer（16 关起改 archercav） | {atk:4,agi:4} | 1 |
| caoren | 曹仁 | infantry | {def:6} | 1 |
| xunyu | 荀彧 | strategist | {int:8} | 2 |
| yuejin | 乐进 | infantry | {atk:4} | 3 |
| lidian | 李典 | archer | {int:4} | 3 |
| caohong | 曹洪 | cavalry | {def:4} | 4 |
| chengyu | 程昱 | strategist | {int:6} | 5 |
| yujin | 于禁 | infantry | {def:4,atk:2} | 5 |
| dianwei | 典韦 | fighter | {atk:12,hp:30} | 7（`unlessFlag:'dianwei_dead'`，11 关后都要加） |
| xuchu | 许褚 | fighter | {atk:10,hp:30} | 10 |
| xuhuang | 徐晃 | infantry | {atk:6} | 10 |
| guojia | 郭嘉 | strategist | {int:10} | 11（26 关起加 `unlessFlag:'guojia_dead'`） |
| xunyou | 荀攸 | strategist | {int:8} | 12 |
| zhangliao | 张辽 | cavalry | {atk:8} | 16 |
| jiaxu | 贾诩 | strategist | {int:10} | 16 |
| guanyu | 关羽 | cavalry | {atk:14,hp:20} | 仅 17、18 关（暂投曹营） |
| zhanghe | 张郃 | cavalry | {atk:6} | 20 |
| liuye | 刘晔 | healer | {int:6} | 26 |
| simayi | 司马懿 | strategist | {int:12} | 30 |
| pangde | 庞德 | cavalry | {atk:10} | 奸雄线 j_zhanglu 起 / 忠臣线自定 |
| caozhang | 曹彰 | cavalry | {atk:8} | 奸雄线 j_dingjun 起 |
- 每关我军出阵 6~10 人，从已加入者中按原版选择。新武将加入时在本关 prologue 中交代。
- 剧情标记：`dianwei_dead`（11 张绣讨伐战中典韦撤退则设，用 onDeath 事件 `setFlag`）、`guojia_dead`（25 柳城战胜时郭嘉仍在场则设，用 victoryFlags）。

## 7. 等级参考（未计难度加成）
- 我军单位填写的等级是“下限”（会与存档等级取较大值）：第 n 关约 `2 + 0.8n`；忠臣/奸雄线第 k 关约 `27 + k`。
- 敌军杂兵约等于该关我军下限 −1~+1，副将 +2~3，首领 +4~6（首领可加 bonus）。

## 8. 事件 events（每个事件只能有 turn / onDeath / duel 之一）
- 回合事件：`{ turn: 4, faction: 'enemy', units: [E(...)], setAi: { lvbu: 'aggressive' }, dialog: [...], setFlag? }`（援军、伏兵、首领出击）
- 撤退事件：`{ onDeath: 'dianwei', dialog: [...], setFlag: 'dianwei_dead', units?, setAi? }`
- 单挑：`{ duel: { a: 'guanyu', b: 'huaxiong', winner: 'a', result: 'kill'|'hurt'|'draw' }, dialog: [单挑前对白], after: [单挑后对白] }` —— a 与 b 首次交手时触发过场，结算后败者撤退或重伤。若败者是 boss 目标会直接判胜。原版有的单挑（关羽vs华雄/颜良/文丑、许褚vs马超 等）请还原。
- 援军登场默认从最近的地图边缘走入（6 格以内；更远的伏兵原地淡入）。单位可加 `from: [x, y]` 指定起点格（通常在地图边缘，不限距离），`from: false` 强制淡入。
- 战场演出（可选）`stage: [指令]`：执行顺序 setFlag → stage → 援军登场 → setAi → dialog；stage 中写 `{ spawn: true }` 可把援军登场提前到该位置。每条指令都可带 `ifFlag` / `unlessFlag`（按剧情标记跳过，与剧情场景一致）。指令：
  - `{ camera: [x, y] | '单位id' }` 镜头移到该格；`{ highlight: [[x, y] | '单位id', ...] }` 闪烁高亮；`{ wait: 毫秒 }`；`{ say: [对白] }`
  - `{ walk: '单位id', to: [x, y] }`（自动找路）或 `path: [[x, y], ...]`（途经点，相邻两点先横后竖）；终点必须是空格
  - `{ face: '单位id', dir: 'left'|'right'|'up'|'down'|[x, y]|'单位id' }`；`{ act: '单位id', pose: 'jump'|'bow'|'shake'|'flash'|'spin' }`
  - `{ terrain: { at: [x, y], set, size?: 1|3, from? } }`（可为数组：数组中的各条一起演出——一次镜头、一次闪光、一条日志）：`set` 为预设 `open`（城门 E → 城内 +）、`close`（+ → E）、`fire`（可燃地形 → 火 !）、`douse`（! → 平原）、`ship`（大河 / 小河 / 浅滩 / 池塘 → 船 S），或任意地形字符；`size: 3` 改以 at 为中心的 3×3，只改写 `from`（预设自带）中的地形，有单位且新地形对其不可通行的格子跳过。变化写入战斗中存档（`mapPatches`）。

## 8.5 剧情场景 scenes（关与关之间的演出）
- 每关的开场 / 结尾都在剧情场景（`StoryScene`）中演出：没有手写时由 `prologue` / `epilogue(s)` 自动生成（`src/story/auto.js`）；手写 `scenes: { pre?: [指令], post?: [指令] | { default, win, retreat, annihilate, ... } }` 优先，`post` 的分支键与 `epilogues` 相同。
- 手写场景**取代**对应的 prologue / epilogue 演出，但 prologue / epilogue 仍要保留（作为数据来源与回退）；手写时把原有对白（含 `choices`、`red`、`setFlag`）原样放进 `say`，**选项与红色指数不能丢**，可以拆成多段穿插走位和动作。
- 坐标：站位用等角格 `[a, b]`，地板为 0~20 的菱形（`a` 向右下、`b` 向左下），允许 −6~26（场外入场 / 离场）；屏幕位置 x = 600 + (a − b) × 28，y = 150 + (a + b) × 14。
- 指令（每条可带 `ifFlag` / `unlessFlag`）：
  - `{ bg: 名称, place?, time?: 'day'|'dusk'|'night', view?, keep?, fade? }`：背景。外场景 `field 野外`、`citygate 城下`、`river 河畔`、`mountain 山路`；内场景（等角）`palace 宫殿`、`tent 军营大帐`、`hall 公馆 / 相府`、`street 城内街道`、`camp 军营`；`china 中国地图`（`view`: `all / north / central / south / west / zhongyuan`；`zhongyuan` 为中原近景（约 3 倍，洛阳—官渡—白马一带），汜水关、虎牢关、荥阳、陈留、官渡、白马、延津、黎阳等相邻城市同时出场时用它）。`keep: true` 保留人物。
  - `{ chapter: 章名, sub?, ms? }`、`{ place: 地点名 }`；
  - `{ actor: 人物名, id?, at: [a, b], face?, side?, cls?, pose?, fade? }` 出场（同名多人用 `id` 区分，之后的指令引用 `id`）；`{ exit: 人物, to?, wait?, speed?, line? }` 离场；
  - `{ move: 人物, to: [a, b], wait?: false, speed?, face?, line? }`（`wait: false` 与后续移动同时进行，用 `{ join: true }` 等全部走完）。默认沿格子先走 `a` 再走 `b`（折线）；`line: true` 直线走过去（`a`、`b` 同时变化时，例如屏幕上竖直 / 水平移动，避免走成 L 形或穿过旁人）；
  - 说话人提示：对白开始时说话人轻跳一下。按对白行的 `actor`（出场时的 `id`）→ `who` 作为出场 id → 第一个名字等于 `who` 的人物依次匹配；同名多人时在对白行写 `actor: 'id'` 指定；
  - `{ face: 人物, dir }`：`dr` 正面右下、`dl` 正面左下、`ur` 背面右上、`ul` 背面左上（`right / left / down / up` 为别名）；
  - `{ act: 人物, pose, ms? }`：`stand walk bow raise raise1 reach sit kneel cry sitcry fall swing bound excite`（`sitcry` 跪坐哭泣；`ms` 为动作后的等待）；
  - `{ emote: 人物, icon, hold?, ms? }`：`shock anger joy sweat question dots`；`hold` 为气泡显示时长（默认 2500 毫秒），`ms` 为指令后的等待（默认 380）；
  - `{ say: [对白行...] }`（现有格式，含 `choices`）、`{ narr: 旁白 }`、`{ wait: 毫秒 }`、`{ fade: 'in'|'out', ms?, color? }`（`color` 只对这一轮转场生效，完全淡入后恢复黑色）、`{ camera: [a, b] | 'reset', zoom?, ms? }`、`{ shake: 毫秒 }`、`{ clear: true }`；
  - 中国地图：`{ map: { show: 人物, at: 城市名或[x,y], side? } | { move: 人物, to } | { hide: 人物 } | { text, at } }`、`{ arrow: [城市名或[x,y], ...], side?, color?, ms? }`（城市表见 `src/story/defs.js` 的 `CITIES`）。头像与已有头像、城市名或地图文字重叠时（show 与 move 都会），圆点留在城市上，头像按周围空位错开到上下左右或四角并画引线连回城市点；`map.text` 也会在原位与上下左右中挑一个不压住头像和城市名的位置；被头像或箭头引用过的城市会标出地名并保留到换背景。
- 示例见 `src/story/demo.js`；预览：`?scene=<关卡id>:pre`、`?scene=<关卡id>:post`（可加 `&outcome=retreat`、`&annihilate=1`、`&flags=标记1,标记2` 预设剧情标记以预览分支），`?scene=poses` 看全部动作 / 表情，`?scene=gallery` 看全部背景。
- 校验会检查指令名、背景、站位范围、引用的人物是否已出场、动作 / 表情名、地图指令前是否设置了 `china` 背景；人物未登记外形只给警告。

## 9. 对白与红色指数
- 对白：`{ who: '名字'|'旁白', side: 'player'|'enemy'|'ally', text }`。名字须与单位名一致才能显示对应头像；对白风格贴近三国演义，简洁。
- 选项（影响红色指数，决定第 31 关后的路线；≥3 忠臣线，≤−3 奸雄线，其余同奸雄线）：
  `{ who: '曹操', side: 'player', text: '……', choices: [{ text: '……', red: 1, reply: [对白] }, { text: '……', red: -1, reply: [...] }] }`
- 选项分布：A 组 2 处（徐州复仇战屠城与否 ±2、董卓追击战 ±1），B 组 2 处（献帝救出战 ±1、吕布包围战 ±1），C 组 2 处（官渡之战焚烧书信 ±1、另 1 处 ±1），D 组 2 处（长坂坡 ±1、马超迎击战关键抉择 ±2），E/F 组可选。

## 10. 武将外形
- `src/characters.js` 已登记主要人物（曹营、刘备军、孙吴、群雄）。对白或单位中出现未登记的“具名”武将时，在本组 `src/characters/extra_<组>.js` 的 default 对象中补充，字段见 characters.js 顶部注释。不要修改其他文件。

## 11. 校验（必须 0 错误）
- 只校验本组：`node scripts/validate-stages.mjs <组字母>`（例如 `node scripts/validate-stages.mjs c`），必须 0 错误，警告尽量消除。
- 地图尺寸：正式关卡必须 `mapVersion: 2`，尺寸等于 `MAP_SIZES`，必须写 `deploy.slots`，且预设我军（非条件登场）都站在 `deploy.slots` 中；旧版 18×13 只允许调试关卡使用。
- 其他组同时在编辑各自文件，不要运行 `vite build`，也不要修改本组以外的任何文件。
- `src/characters/extra_<组>.js` 每次都用一次性完整写入，保证任何时刻语法都正确（其他组的校验也会导入它）。

## 12. 装备奖励、掉落与商店（`src/equipment.js`，整合阶段维护，各组不要改）
- 关卡奖励 `REWARDS[关卡id]`：`[{ item?: 装备id | [依次取第一件未拥有的], gold?, ifFlag?, unlessFlag?, annihilate?: true|false, maxTurn?, alive?: 单位id, via?: 胜利条件类型, outcome?, note? }]`，胜利时（结尾对白之后）按条件发放；宝物只能拥有一件，已有时跳过。
- 敌将掉落 `DROPS[关卡id] = { 敌军单位id: 装备id | [...] }`：击破时立即获得（败北重开则作废）。改动敌将 id 时同步修改这里。
- 商店上新 `SHOP_UNLOCK[关卡id] = [商品]`：本关及之前（沿 next 能走到本关）上架过的商品都在整备“商店”页出售。
- 奖励条件用到的剧情标记必须由某关设置（事件 `setFlag`、选项 `flag` 或 `victoryFlags`），例如濮阳之战（三）结尾选项的 `puyang_merchant_spared` / `puyang_merchant_fined`。
- 校验脚本检查：装备数量（普通 37 / 宝物 50）、以上三表引用的关卡 / 装备 / 敌将 / 剧情标记 / 胜利方式是否存在。

## 13. 营中台词（`src/camp/`，两关之间的军营 / 城镇）
- 流程：每关胜利 → 结尾场景 → 战果 → **营中**（`CampScene`）→ 营门出征 → 下一关开场场景 → 整备 → 战斗。新游戏的第 1 关（颍川之战）之前、结局之后不进营中。营中可以自由走动、与人物对话、整备（大帐 / 书案 / 军需官）、购物（商人）、存档。
- 营中出现的人物：已加入的我军武将（registry `joined`，阵亡 / 离队标记生效的、下一关作为敌军或事件援军登场的除外；**下一关开场才加入的武将不在营中**）；本关台词里写到、尚未记入 `joined` 但已是下一关出阵候选的武将（预设我军或 `joinAt` 已到，如汉中战后归降的庞德）；本关台词里写到的非我军人物（客人，例如暂居营中的刘备）；与登记武将同名但条目**写明 `side`** 且不在营中的人物也作为客人（例如暂投曹营的关羽、麦城救出的关羽——不写 `side` 就不会出场）；以及布局自带的商人 / 军需官 / 百姓。
- **本关专属台词**写在所属组的文件里：A 组 `src/camp/talks_a.js`（导出 `CAMP_TALKS_A`）……F 组 `talks_f.js`（`CAMP_TALKS_F`），分组与 §1 相同。**键为即将开始的那一战**（营中场景结束后要打的关卡 id，例如颍川之战胜利后的营中写在 `sishui` 下），内容围绕这一战的地形、敌将、计策，写台词前先读该关的 prologue、事件和地图。第 1 关 `yingchuan` 不写。每关 3~6 位人物：
  ```js
  export const CAMP_TALKS_A = {
    sishui: [
      { who: '夏侯惇', lines: [{ who: '夏侯惇', text: '……' }, { who: '曹操', text: '……' }] },
      {
        who: '曹仁',
        lines: [{ who: '曹仁', text: '兄长以为如何？', choices: [
          { text: '……', red: 1, reply: [{ who: '曹仁', text: '……' }] },
          { text: '……', red: -1, flag: 'some_flag', reply: [...] },
        ] }],
        again: [{ who: '曹仁', text: '再次交谈时说的话（不能带选项）' }],
      },
      { who: '刘备', side: 'ally', lines: [...] },   // 非我军武将：营中会多出这位客人
    ],
  };
  ```
  - 条目字段：`who`（人物名，与武将名一致）、`lines`（对白行，格式同 §9，可带 `choices`）、`again?`（已谈过后再交谈时的台词，不能带选项）、`ifFlag?` / `unlessFlag?`（按剧情标记出现；同一人物写多条时必须用它们区分）、`side?` / `cls?`（只对客人有效：阵营色与兵种外形；登记武将以客人身份出场时必须写 `side`）。
  - 选项与原版军营交谈作用相同：`red` 累加红色指数（−3~3 的整数），`flag` 设置剧情标记（小写字母开头，只含小写字母、数字、下划线），2~3 个选项。选项只在第一次交谈时出现：之后有 `again` 播 `again`，没有 `again` 且台词不带选项时重播，否则改说通用台词。
  - 谈过本关专属台词的人物会记入营中存档（`talked`），头顶的“！”标记消失。
- **通用台词**写在 `src/camp/generic.js`（由一个人统一编写）：`GENERIC_TALKS[武将id] = [[对白行...], ...]`，每位我军武将（曹操除外）至少 3 段，按武将个性写，**不能带选项**（可反复触发，按关卡与交谈次数轮换）。没有本关专属台词的武将说通用台词。`FOLK_TALKS[名字]` 是百姓、老者、侍从等通用角色的台词，名字须在 `src/camp/layouts.js` 的 `FOLK` 登记。
- **布局**（`src/camp/layouts.js`，整合阶段维护）：`camp` 军营（默认）、`town` 城镇、`hall` 府邸、`field` 野营、`river` 水寨。每关用哪种布局由 `CAMP_OF[关卡id]` 指定（键同样是即将开始的关卡），也可在关卡对象上写 `camp: '<布局 id>'` 覆盖。布局字段见文件头注释：背景、可走范围、障碍矩形、物件、出生点、大帐 / 商人 / 营门位置、站岗位置、闲逛区域、通用角色。
- 校验：`node scripts/validate-stages.mjs <组字母>` 会检查本组 `talks_<组>.js`：关卡 id 存在且属于本组、人物名已登记、字段名、对白行、选项格式（2~3 个、`red` 整数、`flag` 格式）、`again` 不带选项、同一人物不重复、本组选项设置的每个 `flag` 都被读取过（任一关卡数据中的 `ifFlag` / `unlessFlag`——开场 / 结尾 / 事件 / 单位 / 场景脚本，或营中台词的 `ifFlag` / `unlessFlag`、武将离队标记、奖励条件；营中标记必须有后果）；不带参数时另检查通用台词与布局（出生点能走到全部站位与功能点）。最后一行输出覆盖率；台词全部写完后用 `node scripts/validate-stages.mjs --camp-strict` 把覆盖率不足（某关少于 3 位、某武将通用台词少于 3 段）当作错误。
- 营中标记的后果：营中对话是可选的，没去对话的玩家不设任何标记，所以**不设标记时必须保持原剧情 / 原玩法**。`unlessFlag: 正向标记` 只能写“没选这一项”时也成立的内容；要表现反向选项的后果（如“任凭诸将处置”“尽捕可疑之人”），给反向选项另设标记（`camp_yecheng_loot`、`camp_hefei_purge`），用 `ifFlag` 读取。
- 调试入口：`?camp=<关卡id>` 以普通难度进入该关之前的营中（已加入武将取该关的候选名单，可加 `&flags=a,b`）；寻路测试 `node scripts/test-path.mjs`；浏览器回归 `node scripts/camp-smoke.mjs [关卡id ...]`（先 `npx vite --port 5191`，逐关进营中、谈完专属台词、开关整备与商店、走到营门出征）。
