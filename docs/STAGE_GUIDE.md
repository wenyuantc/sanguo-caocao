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
  // 可选：protect: ['xiandi'], defeatText: '曹操或献帝撤退 / 超过 25 回合', victoryFlags, epilogues
  map: [ /* 13 行，每行 18 个字符 */ ],
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
- `escape: { tiles: [[x,y],...], units: ['dianwei'] }` 撤离点：列出的我军武将行动结束停在撤离点即撤出战场（不算阵亡，alive 变为 false），地图上以蓝框标出。
- 出阵整备（自动推导，一般不用填）：出阵位置 = 本关预设我军单位的站位，上限 = 位置数，默认阵容 = 预设阵容。
  必须出阵：曹操、不在武将总表（`src/generals.js`）中的临时成员、在胜利条件 / `protect` / `escape` / `victoryFlags` / 事件（duel、onDeath、setAi）中出现的我军武将、开场 / 结尾 / 事件对白中 `side: 'player'` 发言的预设我军武将。
  不可出阵：带阵亡 / 离队标记的武将、本关事件中途生成（或作为敌军 / 友军登场）的武将。
  推导不合理时可用可选字段覆盖：`deploy: { max?: 出阵上限, required?: [预设我军 id]（替换推导出的必须出阵名单，曹操始终必须）, slots?: [[x,y], ...]（替换出阵位置，须可通行、不重叠） }`，校验脚本会检查其格式。

## 4. 地图（18 列 × 13 行，坐标 x 0~17 左→右，y 0~12 上→下）
`.`平原 `,`草原 `F`森林 `M`山地(骑兵不可过) `V`村庄(回复) `W`河流(不可过) `B`桥 `C`城墙(不可过) `G`城池/城门(防+30%回复) `S`战船甲板(水上可走，火计×1.6) `T`营寨(防+20%)
- 尽量还原原版战场形态（关隘、河流、城池、营寨、船队）。我军通常在下方/一侧，敌军首领在城池或营寨。
- 每个单位必须站在其兵种可通行的格子上，初始不得重叠；我军必须能走到首领附近（校验脚本会检查）。

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
  - 射程普通 3 格；“阵”“龙”字策略与巨岩、爆焰、海啸、谎言、定军、毒雾等为十字 5 格范围（每个目标威力 ×0.4），输送、八阵图为 3×3；砂暴全图，只打身处野外（平原、草原、森林、山地）的敌军。
  - 地形限制：火系打不到河流 / 桥梁上的目标（战船、森林、营寨上威力加成）；水系要求目标在河流 / 桥梁 / 战船上或旁边；地系要求目标在山地 / 森林上或旁边；风系打不到城池内的目标。布置敌方策士时注意：站在平原中间的水系 / 地系策士用不出伤害策略。
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

## 9. 对白与红色指数
- 对白：`{ who: '名字'|'旁白', side: 'player'|'enemy'|'ally', text }`。名字须与单位名一致才能显示对应头像；对白风格贴近三国演义，简洁。
- 选项（影响红色指数，决定第 31 关后的路线；≥3 忠臣线，≤−3 奸雄线，其余同奸雄线）：
  `{ who: '曹操', side: 'player', text: '……', choices: [{ text: '……', red: 1, reply: [对白] }, { text: '……', red: -1, reply: [...] }] }`
- 选项分布：A 组 2 处（徐州复仇战屠城与否 ±2、董卓追击战 ±1），B 组 2 处（献帝救出战 ±1、吕布包围战 ±1），C 组 2 处（官渡之战焚烧书信 ±1、另 1 处 ±1），D 组 2 处（长坂坡 ±1、马超迎击战关键抉择 ±2），E/F 组可选。

## 10. 武将外形
- `src/characters.js` 已登记主要人物（曹营、刘备军、孙吴、群雄）。对白或单位中出现未登记的“具名”武将时，在本组 `src/characters/extra_<组>.js` 的 default 对象中补充，字段见 characters.js 顶部注释。不要修改其他文件。

## 11. 校验（必须 0 错误）
- 只校验本组：`node scripts/validate-stages.mjs <组字母>`（例如 `node scripts/validate-stages.mjs c`），必须 0 错误，警告尽量消除。
- 其他组同时在编辑各自文件，不要运行 `vite build`，也不要修改本组以外的任何文件。
- `src/characters/extra_<组>.js` 每次都用一次性完整写入，保证任何时刻语法都正确（其他组的校验也会导入它）。
