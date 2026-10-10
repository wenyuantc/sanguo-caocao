// 地形：cost[移动类型]，def 防御加成，heal 回合开始回复比例
export const TERRAIN = {
  '.': { name: '平原', color: 0x9db86a, cost: { foot: 1, horse: 1 }, def: 0, heal: 0 },
  ',': { name: '草原', color: 0x7fa653, cost: { foot: 1, horse: 1 }, def: 0.05, heal: 0 },
  F: { name: '森林', color: 0x4c7a3a, cost: { foot: 2, horse: 3 }, def: 0.2, heal: 0, fire: 1.3 },
  M: { name: '山地', color: 0x8a7350, cost: { foot: 3, horse: 99 }, def: 0.3, heal: 0 },
  V: { name: '村庄', color: 0xb59a6a, cost: { foot: 1, horse: 1 }, def: 0.1, heal: 0.15 },
  W: { name: '河流', color: 0x3f7fb5, cost: { foot: 99, horse: 99 }, def: 0, heal: 0 },
  B: { name: '桥梁', color: 0x9a7448, cost: { foot: 1, horse: 1 }, def: 0, heal: 0 },
  C: { name: '城墙', color: 0x6d6a66, cost: { foot: 99, horse: 99 }, def: 0, heal: 0 },
  G: { name: '城池', color: 0xa89a82, cost: { foot: 1, horse: 1 }, def: 0.3, heal: 0.2 },
  S: { name: '战船', color: 0x7a5432, cost: { foot: 1, horse: 2 }, def: 0.1, heal: 0, fire: 1.6 },
  T: { name: '营寨', color: 0xa08458, cost: { foot: 1, horse: 1 }, def: 0.2, heal: 0.1, fire: 1.2 },
};

// 攻击范围（原版代码，见 research class-tiers §4）：[dx, dy] 偏移
const ring = (lo, hi) => {
  const out = [];
  for (let dy = -hi; dy <= hi; dy++) for (let dx = -hi; dx <= hi; dx++) {
    const d = Math.abs(dx) + Math.abs(dy);
    if (d >= lo && d <= hi) out.push([dx, dy]);
  }
  return out;
};
const AROUND = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const RANGES = {
  cross: ring(1, 1), // 十字：上下左右
  around: AROUND, // 周围 8 格
  ring2: ring(2, 2), // 距离 2 的一圈
  r23: ring(2, 3), // 距离 2~3
  r24: ring(2, 4), // 距离 2~4
  line2: [[2, 0], [-2, 0], [0, 2], [0, -2]], // 直线 2 格
  ring4: ring(4, 4), // 距离 4 的一圈
  r45: ring(4, 5), // 距离 4~5
  none: [],
};
// 旧名别名（移动范围计算等仍使用 melee）
RANGES.melee = RANGES.cross;
RANGES.bow = RANGES.ring2;
RANGES.far = RANGES.r23;

// 成长档：每级加成（S/A/B/C = +4/+3/+2/+1）
export const GRADE = { S: 4, A: 3, B: 2, C: 1 };
// 五项能力：攻击、精神、防御、爆发、士气
export const STAT5 = ['atk', 'int', 'def', 'burst', 'morale'];
export const STAT_NAME = { atk: '攻击', int: '精神', def: '防御', burst: '爆发', morale: '士气' };

// 兵种系列（原版，见 research class-tiers §1~§4）
// tiers: 各阶 { name, glyph, move, range }；单阶特殊兵种只有一项
// grow: 五项成长档；hp / mp: [基础, 每级]；type: 相克类型（mage / siege / noble 不参与相克）
// 文官系（策士 / 风水士 / 道士 / 骑马策士）与都督、海盗、咒术士、黄巾贼的普通攻击范围原版查不到，为自行设计
const T = (name, glyph, move, range) => ({ name, glyph, move, range });
export const SERIES = {
  lord: { name: '君主', moveType: 'horse', type: 'horse', tiers: [T('群雄', '雄', 6, 'cross'), T('英雄', '英', 6, 'around'), T('霸王', '霸', 7, 'around')],
    grow: { atk: 'A', int: 'A', def: 'A', burst: 'A', morale: 'A' }, hp: [100, 5], mp: [30, 1], spells: ['fire', 'heal'] },
  infantry: { name: '步兵', moveType: 'foot', type: 'foot', tiers: [T('轻步兵', '步', 4, 'around'), T('重步兵', '步', 4, 'around'), T('近卫兵', '近', 5, 'around')],
    grow: { atk: 'B', int: 'A', def: 'S', burst: 'B', morale: 'B' }, hp: [110, 6], mp: [10, 1], spells: [] },
  archer: { name: '弓兵', moveType: 'foot', type: 'bow', tiers: [T('弓兵', '弓', 4, 'ring2'), T('弩兵', '弩', 4, 'r23'), T('连弩兵', '弩', 5, 'r24')],
    grow: { atk: 'A', int: 'B', def: 'B', burst: 'B', morale: 'S' }, hp: [90, 4], mp: [10, 1], spells: [] },
  cavalry: { name: '骑兵', moveType: 'horse', type: 'horse', tiers: [T('轻骑兵', '骑', 6, 'cross'), T('重骑兵', '骑', 6, 'cross'), T('亲卫队', '卫', 7, 'around')],
    grow: { atk: 'S', int: 'B', def: 'A', burst: 'B', morale: 'B' }, hp: [100, 5], mp: [10, 1], spells: [] },
  archercav: { name: '弓骑兵', moveType: 'horse', type: 'bow', tiers: [T('弓骑兵', '弓', 6, 'line2'), T('弩骑兵', '弩', 6, 'ring2'), T('连弩骑兵', '弩', 7, 'r23')],
    grow: { atk: 'S', int: 'B', def: 'B', burst: 'B', morale: 'A' }, hp: [100, 5], mp: [10, 1], spells: [] },
  // 炮车二阶射程有冲突，采用 4~5 格
  catapult: { name: '炮车', moveType: 'foot', type: 'siege', tiers: [T('轻炮车', '车', 3, 'ring4'), T('重炮车', '车', 3, 'r45'), T('霹雳车', '霹', 4, 'r45')],
    grow: { atk: 'S', int: 'B', def: 'A', burst: 'C', morale: 'A' }, hp: [90, 4], mp: [10, 1], spells: [] },
  fighter: { name: '武道家', moveType: 'foot', type: 'foot', tiers: [T('武道家', '武', 5, 'cross'), T('拳士', '拳', 5, 'around'), T('拳圣', '圣', 6, 'around')],
    grow: { atk: 'A', int: 'C', def: 'A', burst: 'S', morale: 'B' }, hp: [90, 4], mp: [20, 1], spells: [] },
  bandit: { name: '贼兵', moveType: 'foot', type: 'foot', tiers: [T('贼兵', '贼', 5, 'around'), T('义贼', '义', 5, 'around'), T('豪杰', '豪', 6, 'around')],
    grow: { atk: 'S', int: 'C', def: 'B', burst: 'B', morale: 'S' }, hp: [100, 5], mp: [20, 1], spells: [] },
  strategist: { name: '策士', moveType: 'foot', type: 'mage', tiers: [T('策士', '策', 4, 'cross'), T('参谋', '参', 4, 'around'), T('军师', '军', 5, 'around')],
    grow: { atk: 'B', int: 'S', def: 'B', burst: 'B', morale: 'B' }, hp: [90, 4], mp: [40, 2], spells: ['fire', 'rock', 'heal'] },
  healer: { name: '风水士', moveType: 'foot', type: 'mage', tiers: [T('风水士', '风', 4, 'cross'), T('方术士', '方', 5, 'around'), T('仙术士', '仙', 6, 'around')],
    grow: { atk: 'C', int: 'S', def: 'C', burst: 'A', morale: 'A' }, hp: [80, 3], mp: [50, 2], spells: ['heal', 'heal2', 'rock'] },
  taoist: { name: '道士', moveType: 'foot', type: 'mage', tiers: [T('道士', '道', 4, 'cross'), T('幻术士', '幻', 4, 'around'), T('妖术士', '妖', 5, 'around')],
    grow: { atk: 'C', int: 'S', def: 'B', burst: 'A', morale: 'B' }, hp: [80, 3], mp: [40, 2], spells: ['fire', 'heal'] },
  mountstrat: { name: '骑马策士', moveType: 'horse', type: 'mage', tiers: [T('骑马策士', '策', 6, 'cross'), T('骑马参谋', '参', 6, 'around'), T('骑马军师', '军', 7, 'around')],
    grow: { atk: 'A', int: 'S', def: 'B', burst: 'B', morale: 'C' }, hp: [100, 5], mp: [40, 2], spells: ['fire', 'rock', 'heal'] },
  dancer: { name: '舞娘', moveType: 'foot', type: 'foot', tiers: [T('舞娘', '舞', 5, 'cross'), T('舞伎', '伎', 5, 'around'), T('巫女', '巫', 6, 'around')],
    grow: { atk: 'A', int: 'B', def: 'B', burst: 'S', morale: 'B' }, hp: [90, 3], mp: [20, 1], spells: ['heal'] },
  // ---------- 单阶特殊兵种 ----------
  xiliang: { name: '西凉骑兵', moveType: 'horse', type: 'horse', tiers: [T('西凉骑兵', '凉', 6, 'around')],
    grow: { atk: 'S', int: 'C', def: 'S', burst: 'B', morale: 'B' }, hp: [110, 6], mp: [5, 1], spells: [] },
  // 黄巾贼的 HP/MP 与攻击范围原版查不到，自行设计
  yellow: { name: '黄巾贼', moveType: 'foot', type: 'foot', tiers: [T('黄巾贼', '巾', 4, 'cross')],
    grow: { atk: 'B', int: 'C', def: 'B', burst: 'B', morale: 'C' }, hp: [90, 4], mp: [5, 1], spells: [] },
  pirate: { name: '海盗', moveType: 'foot', type: 'foot', tiers: [T('海盗', '海', 5, 'around')],
    grow: { atk: 'S', int: 'B', def: 'B', burst: 'A', morale: 'B' }, hp: [90, 4], mp: [20, 1], spells: [] },
  dudu: { name: '都督', moveType: 'horse', type: 'mage', tiers: [T('都督', '督', 5, 'around')],
    grow: { atk: 'A', int: 'S', def: 'B', burst: 'B', morale: 'B' }, hp: [90, 4], mp: [30, 2], spells: ['fire', 'rock', 'heal'] },
  sorcerer: { name: '咒术士', moveType: 'foot', type: 'mage', tiers: [T('咒术士', '咒', 5, 'around')],
    grow: { atk: 'C', int: 'S', def: 'B', burst: 'B', morale: 'A' }, hp: [80, 3], mp: [60, 3], spells: ['fire', 'rock', 'heal', 'heal2'] },
  emperor: { name: '皇帝', moveType: 'foot', type: 'noble', tiers: [T('皇帝', '帝', 4, 'none')],
    grow: { atk: 'C', int: 'C', def: 'C', burst: 'C', morale: 'S' }, hp: [80, 3], mp: [5, 1], spells: [] },
  // 百姓、辎重队的 HP/MP 原版查不到，自行设计
  commoner: { name: '百姓', moveType: 'foot', type: 'noble', tiers: [T('百姓', '民', 4, 'none')],
    grow: { atk: 'C', int: 'C', def: 'C', burst: 'C', morale: 'C' }, hp: [70, 3], mp: [0, 0], spells: [] },
  transport: { name: '辎重队', moveType: 'foot', type: 'noble', tiers: [T('辎重队', '辎', 4, 'none')],
    grow: { atk: 'C', int: 'B', def: 'C', burst: 'C', morale: 'B' }, hp: [100, 4], mp: [10, 1], spells: [] },
};

// 按系列与阶级取兵种信息：{ name, glyph, move, range, moveType, type, spells, tier, tiers, series }
// spells 目前按系列共用；策略按阶级习得由策略子任务在此细化
const VIEWS = Object.fromEntries(Object.entries(SERIES).map(([id, s]) => [id, s.tiers.map((t, i) => ({
  ...t, moveType: s.moveType, type: s.type, spells: s.spells, tier: i + 1, tiers: s.tiers.length, series: s.name,
}))]));
export function classOf(cls, tier = 1) {
  const v = VIEWS[cls];
  return v[Math.min(Math.max(tier || 1, 1), v.length) - 1];
}
// 兼容视图：各系列一阶
export const CLASSES = Object.fromEntries(Object.keys(SERIES).map((id) => [id, classOf(id, 1)]));
// 转职所需等级：一阶 → 二阶 15 级，二阶 → 三阶 30 级
export const PROMOTE_LVL = [15, 30];

// 兵种相克：攻击方类型 -> 被克制方类型
export const ADVANTAGE = { horse: 'foot', foot: 'bow', bow: 'horse' };

export const SPELLS = {
  fire: { name: '火计', mp: 6, range: 3, kind: 'damage', power: 1, color: 0xff6a1a, desc: '以火焚烧敌军，森林草原威力大增' },
  rock: { name: '落石', mp: 10, range: 3, kind: 'damage', power: 1.35, color: 0x9a8a70, desc: '滚落巨石，造成大量伤害' },
  heal: { name: '援队', mp: 8, range: 2, kind: 'heal', power: 1, color: 0x6ee08a, desc: '恢复友军兵力' },
  heal2: { name: '大援队', mp: 14, range: 3, kind: 'heal', power: 1.7, color: 0x6ee08a, desc: '大幅恢复友军兵力' },
};

export const ITEMS = {
  bean: { name: '豆', desc: '恢复兵力 60', hp: 60 },
  wheat: { name: '麦', desc: '恢复兵力 120', hp: 120 },
  wine: { name: '酒', desc: '恢复策略 20', mp: 20 },
  // 印绶：我军 15 级（一阶）/ 30 级（二阶）以上可用于转职
  seal: { name: '印绶', desc: '转职（15 / 30 级）', promote: true },
};
// 印绶过关奖励：从第 16 关（徐州入侵战）起每关胜利 +1（原版自此关起有售，商店由后续子任务实现）
export const SEAL_FROM = 'xuzhou_ruqin';

// 难度：仅作用于敌军（等级加成、属性倍率、AI），以及军需补给；tierLvl 为敌军 / 友军自动定阶的等级门槛 [二阶, 三阶]
export const DIFFICULTIES = {
  normal: {
    name: '普通', color: '#9ce0a8', lvl: 0, mult: null, aggressive: false, tierLvl: [20, 35],
    items: { bean: 5, wheat: 2, wine: 2 }, reward: { bean: 3, wheat: 1, wine: 1 },
    desc: ['敌军保持原样', '开局军需：豆5 麦2 酒2', '适合初次体验剧情'],
  },
  hard: {
    name: '困难', color: '#ffd27a', lvl: 2, mult: { hp: 1.15, atk: 1.1, def: 1.1, int: 1.1 }, aggressive: false, tierLvl: [15, 30],
    items: { bean: 3, wheat: 1, wine: 1 }, reward: { bean: 2, wheat: 1, wine: 1 },
    desc: ['敌军等级 +2', '兵力 ×1.15，攻击防御精神 ×1.1', '开局军需：豆3 麦1 酒1'],
  },
  hell: {
    name: '地狱', color: '#ff7a6a', lvl: 4, mult: { hp: 1.3, atk: 1.2, def: 1.15, int: 1.2, burst: 1.1 }, aggressive: true, tierLvl: [15, 30],
    items: { bean: 2, wheat: 0, wine: 1 }, reward: { bean: 1, wheat: 0, wine: 1 },
    desc: ['敌军等级 +4', '兵力 ×1.3，攻击 ×1.2', '固守之敌全军出击', '开局军需：豆2 酒1'],
  },
};
export const diffOf = (id) => DIFFICULTIES[id] || DIFFICULTIES.normal;
