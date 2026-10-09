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
};

// 攻击范围：melee 上下左右；bow 距离2 + 斜角1
export const RANGES = {
  melee: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  bow: [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

// 兵种：基础值(1级) + 成长
export const CLASSES = {
  lord: { name: '群雄', glyph: '君', move: 6, moveType: 'horse', range: 'melee', type: 'horse',
    base: { hp: 115, mp: 20, atk: 72, def: 58, int: 75, agi: 62 },
    grow: { hp: 9, mp: 2, atk: 3, def: 2.5, int: 3, agi: 2.5 }, spells: ['fire', 'heal'] },
  cavalry: { name: '骑兵', glyph: '骑', move: 6, moveType: 'horse', range: 'melee', type: 'horse',
    base: { hp: 100, mp: 6, atk: 72, def: 52, int: 40, agi: 60 },
    grow: { hp: 8, mp: 1, atk: 3, def: 2.5, int: 1, agi: 2.5 }, spells: [] },
  infantry: { name: '步兵', glyph: '步', move: 4, moveType: 'foot', range: 'melee', type: 'foot',
    base: { hp: 120, mp: 6, atk: 66, def: 64, int: 40, agi: 48 },
    grow: { hp: 10, mp: 1, atk: 2.5, def: 3, int: 1, agi: 2 }, spells: [] },
  archer: { name: '弓兵', glyph: '弓', move: 4, moveType: 'foot', range: 'bow', type: 'bow',
    base: { hp: 90, mp: 6, atk: 66, def: 48, int: 45, agi: 56 },
    grow: { hp: 7, mp: 1, atk: 3, def: 2, int: 1.5, agi: 2.5 }, spells: [] },
  strategist: { name: '策士', glyph: '策', move: 4, moveType: 'foot', range: 'melee', type: 'mage',
    base: { hp: 82, mp: 32, atk: 45, def: 45, int: 86, agi: 50 },
    grow: { hp: 6, mp: 4, atk: 1.5, def: 2, int: 3.5, agi: 2 }, spells: ['fire', 'rock', 'heal'] },
  bandit: { name: '黄巾', glyph: '贼', move: 5, moveType: 'foot', range: 'melee', type: 'foot',
    base: { hp: 85, mp: 0, atk: 60, def: 44, int: 30, agi: 50 },
    grow: { hp: 7, mp: 0, atk: 2.5, def: 2, int: 1, agi: 2 }, spells: [] },
  taoist: { name: '道士', glyph: '道', move: 4, moveType: 'foot', range: 'melee', type: 'mage',
    base: { hp: 88, mp: 30, atk: 45, def: 46, int: 80, agi: 50 },
    grow: { hp: 7, mp: 4, atk: 1.5, def: 2, int: 3, agi: 2 }, spells: ['fire', 'heal'] },
};

// 兵种相克：攻击方类型 -> 被克制方类型
export const ADVANTAGE = { horse: 'foot', foot: 'bow', bow: 'horse' };

export const SPELLS = {
  fire: { name: '火计', mp: 6, range: 3, kind: 'damage', power: 1, color: 0xff6a1a, desc: '以火焚烧敌军，森林草原威力大增' },
  rock: { name: '落石', mp: 10, range: 3, kind: 'damage', power: 1.35, color: 0x9a8a70, desc: '滚落巨石，造成大量伤害' },
  heal: { name: '援队', mp: 8, range: 2, kind: 'heal', power: 1, color: 0x6ee08a, desc: '恢复友军兵力' },
};

export const ITEMS = {
  bean: { name: '豆', desc: '恢复兵力 60', hp: 60 },
  wheat: { name: '麦', desc: '恢复兵力 120', hp: 120 },
  wine: { name: '酒', desc: '恢复策略 20', mp: 20 },
};

// 难度：仅作用于敌军（等级加成、属性倍率、AI），以及军需补给
export const DIFFICULTIES = {
  normal: {
    name: '普通', color: '#9ce0a8', lvl: 0, mult: null, aggressive: false,
    items: { bean: 5, wheat: 2, wine: 2 }, reward: { bean: 3, wheat: 1, wine: 1 },
    desc: ['敌军保持原样', '开局军需：豆5 麦2 酒2', '适合初次体验剧情'],
  },
  hard: {
    name: '困难', color: '#ffd27a', lvl: 2, mult: { hp: 1.15, atk: 1.1, def: 1.1, int: 1.1 }, aggressive: false,
    items: { bean: 3, wheat: 1, wine: 1 }, reward: { bean: 2, wheat: 1, wine: 1 },
    desc: ['敌军等级 +2', '兵力 ×1.15，武防智 ×1.1', '开局军需：豆3 麦1 酒1'],
  },
  hell: {
    name: '地狱', color: '#ff7a6a', lvl: 4, mult: { hp: 1.3, atk: 1.2, def: 1.15, int: 1.2, agi: 1.1 }, aggressive: true,
    items: { bean: 2, wheat: 0, wine: 1 }, reward: { bean: 1, wheat: 0, wine: 1 },
    desc: ['敌军等级 +4', '兵力 ×1.3，武力 ×1.2', '固守之敌全军出击', '开局军需：豆2 酒1'],
  },
};
export const diffOf = (id) => DIFFICULTIES[id] || DIFFICULTIES.normal;
