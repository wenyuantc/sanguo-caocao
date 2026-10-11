// 地形（原版 30 种，见 research maps.md §4~§7）：地图一个字符一格；纯数据 + 纯函数，Node 可直接导入
// 字段：ch 编码字符、id 原版编号、name、color 底色（小地图同色）、heal 回合开始回复比例（§5）、
//   elems 可作为攻击策略目标的属性（§6，f 火 / w 水 / n 风 / e 地）、fire 火系易燃倍率、wild 野外（砂暴可作用）
// 自行设计：船（原版为剧本动态地形，表中不可进入）在本作可通行，水 / 火系可用；fire 易燃倍率；wild 野外的范围；
//   原版城门由剧本开关，本作一律不可通行
const T = (ch, name, color, extra = {}) => ({ ch, name, color, heal: 0, elems: '', fire: 1, wild: false, ...extra });
const LIST = [
  T('.', '平原', 0x9db86a, { elems: 'fn', wild: true }),
  T(',', '草原', 0x7fa653, { elems: 'fn', wild: true }),
  T('F', '树林', 0x4c7a3a, { elems: 'f', wild: true, fire: 1.3 }),
  T('D', '荒地', 0xb39a6a, { elems: 'ne', wild: true }),
  T('M', '山地', 0x8a7350, { elems: 'ne', wild: true }),
  T('X', '岩山', 0x6e6458),
  T('^', '山崖', 0x7a6248),
  T('*', '雪原', 0xe4ebef, { elems: 'nw', wild: true }),
  T('B', '桥梁', 0x9a7448, { elems: 'fnw' }),
  T('~', '浅滩', 0x86b4c8, { elems: 'nw', wild: true }),
  T('%', '沼泽', 0x5f7046, { elems: 'nw', wild: true }),
  T('O', '池塘', 0x4a88b0),
  T('W', '小河', 0x3f7fb5),
  T('R', '大河', 0x2f6a9e, { elems: 'nw' }),
  T('#', '栅栏', 0x8a6a40),
  T('C', '城墙', 0x6d6a66),
  T('+', '城内', 0xb8ad96, { elems: 'f' }),
  T('E', '城门', 0x7a5a3a),
  T('G', '城池', 0xa89a82, { elems: 'f', heal: 0.25 }),
  T('P', '关隘', 0x8f8a7c, { elems: 'f', heal: 0.2 }),
  T('Z', '鹿砦', 0x9a8458, { elems: 'f', heal: 0.2, fire: 1.2 }),
  T('V', '村庄', 0xb59a6a, { elems: 'f', heal: 0.15 }),
  T('T', '兵营', 0xa08458, { elems: 'f', heal: 0.2, fire: 1.2 }),
  T('H', '民居', 0xc0a27a, { elems: 'f' }),
  T('$', '宝物库', 0xa88a5a, { elems: 'f' }),
  T('Q', '水池', 0x4f90c0),
  T('!', '火', 0xd8602a),
  T('S', '船', 0x7a5432, { elems: 'fw', fire: 1.6 }),
  T('A', '祭坛', 0x9a8a9a),
  T('U', '地下', 0x4a4038),
];
LIST.forEach((t, i) => { t.id = i; });

// 按原版编号排列的编码字符
export const TERRAIN_CHARS = LIST.map((t) => t.ch).join('');
export const TERRAIN = Object.fromEntries(LIST.map((t) => [t.ch, t]));

// 能力修正与移动消耗（原版 Data.e5，research §7）：每个兵种系列两串，按原版编号 0~29 排列
// 能力修正：8 = 80%、9 = 90%、0 = 100%、1 = 110%、2 = 120%；消耗 1~3；x 不能进入
// 系列与原版行号：君主 0、步兵 1、弓兵 2、骑兵 3、弓骑兵 4、炮车 5、武道家 6、贼兵 7、策士 8、风水士 9、道士 10、
//   骑马策士 11、舞娘 12、西凉骑兵 13、黄巾贼 14、海盗 15、都督 18、咒术士 19、辎重队 21、皇帝 25、百姓 26
const RAW = {
  lord: ['01998xx0198xx9xx0x2221100xxxxx', '11223xx2123xx2xx1x1122232xxxxx'],
  infantry: ['00000xx0000xx0xx1x2221110xxxxx', '11112xx1122xx1xx1x1111121xxxxx'],
  archer: ['00000xx0000xx0xx1x2221110xxxxx', '11112xx1122xx1xx1x1111121xxxxx'],
  cavalry: ['11998xx0198xx8xx0x2221190xxxxx', '11223xx2123xx2xx1x1122232xxxxx'],
  archercav: ['01998xx0198xx8xx0x2221190xxxxx', '11223xx2123xx2xx1x1122232xxxxx'],
  catapult: ['00998xx0188xx0xx1x2221100xxxxx', '11112xx1122xx1xx1x1111121xxxxx'],
  fighter: ['00009xx9000xx1xx0x2221110xxxxx', '11112xx1112xx1xx1x1111121xxxxx'],
  bandit: ['00111xx8088xx8xx0x2221110xxxxx', '11111xx1122xx2xx1x1111121xxxxx'],
  strategist: ['00098xx9009xx8xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
  healer: ['00098xx0009xx0xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
  taoist: ['00111xx9098xx8xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
  mountstrat: ['01998xx0198xx8xx0x2221190xxxxx', '11223xx2123xx2xx1x1122232xxxxx'],
  dancer: ['00099xx9011xx1xx0x2221110xxxxx', '11112xx1111xx1xx1x1111121xxxxx'],
  xiliang: ['00811xx1088xx8xx0x2221190xxxxx', '11211xx1123xx2xx1x1122232xxxxx'],
  yellow: ['00111xx8098xx8xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
  pirate: ['99988xx9011xx1xx0x2221110xxxxx', '11112xx1111xx1xx1x1111121xxxxx'],
  dudu: ['09988xx9011xx1xx0x2221110xxxxx', '11112xx1111xx1xx1x1111121xxxxx'],
  sorcerer: ['00098xx9088xx0xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
  transport: ['99999xx9099xx9xx0x2221100xxxxx', '11223xx2123xx2xx1x1122232xxxxx'],
  emperor: ['99999xx9088xx8xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
  commoner: ['99999xx9088xx8xx0x2221110xxxxx', '11112xx1122xx2xx1x1111121xxxxx'],
};
// 船（自行设计）：骑马系列消耗 2，其余 1；海盗、都督在船上 110%
const SHIP = TERRAIN.S.id;
const SHIP_HORSE = new Set(['lord', 'cavalry', 'archercav', 'mountstrat', 'xiliang', 'transport']);
const SHIP_WATER = new Set(['pirate', 'dudu']);

// 能力修正换算为防御加成（自行设计）：def = (修正 − 100%) × DEF_SCALE，120% → +0.3，80% → −0.3
// def 用于伤害减免 (1 − def)、命中修正、AI 站位评分
export const DEF_SCALE = 1.5;
export const IMPASSABLE = 99;
const PCT = { 8: 80, 9: 90, 0: 100, 1: 110, 2: 120 };

// TERRAIN_RULES[系列][字符] = { pct 能力修正（%）, cost 移动消耗（不能进入为 IMPASSABLE）, def 防御加成 }
export const TERRAIN_RULES = Object.fromEntries(Object.entries(RAW).map(([cls, [p, c]]) => {
  const out = {};
  LIST.forEach((t, i) => {
    let pct = p[i] === 'x' ? 100 : PCT[p[i]];
    let cost = c[i] === 'x' ? IMPASSABLE : Number(c[i]);
    if (i === SHIP) { pct = SHIP_WATER.has(cls) ? 110 : 100; cost = SHIP_HORSE.has(cls) ? 2 : 1; }
    out[t.ch] = { pct, cost, def: Math.round((pct - 100) * DEF_SCALE) / 100 };
  });
  return [cls, out];
}));

// 规则查询：未登记的系列按步兵处理
export const terrainRule = (cls, ch) => (TERRAIN_RULES[cls] || TERRAIN_RULES.infantry)[ch];
export const moveCost = (cls, ch) => terrainRule(cls, ch)?.cost ?? IMPASSABLE;
export const passable = (cls, ch) => moveCost(cls, ch) < IMPASSABLE;
export const terrainDef = (cls, ch) => terrainRule(cls, ch)?.def ?? 0;
// 所有系列都不能进入的地形（障碍）
export const isBlocked = (ch) => Object.keys(TERRAIN_RULES).every((cls) => !passable(cls, ch));

// 战场演出的地形变化预设（battleStage.js 使用，校验脚本也检查）：ch 改成的地形，from 只改写这些地形的格子（3×3 范围时避免把城墙、河流也点着）
const FLAMMABLE = LIST.filter((t) => t.elems.includes('f')).map((t) => t.ch).join('');
export const TERRAIN_PRESETS = {
  open: { ch: '+', from: 'E', name: '城门打开了', color: 0xfff0c0 },
  close: { ch: 'E', from: '+', name: '城门关闭了', color: 0x5a3a20 },
  fire: { ch: '!', from: FLAMMABLE, name: '燃起了大火', color: 0xff7a2a },
  douse: { ch: '.', from: '!', name: '火势熄灭了', color: 0x9db86a },
  ship: { ch: 'S', from: 'RW~O', name: '船只驶来', color: 0x7a5432 },
};
