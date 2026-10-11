import { SPELLS, SPELL_LEARN, ELEMS } from './spells.js';

export { SPELLS, SPELL_LEARN, ELEMS };

// 地形（30 种）与按兵种系列的移动消耗 / 能力修正：见 terrain.js
export { TERRAIN, TERRAIN_RULES, TERRAIN_CHARS, IMPASSABLE, terrainRule, moveCost, passable, terrainDef } from './terrain.js';

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
  r12: ring(1, 2), // 周围两格内 12 格（装备没羽箭的贼兵）
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
// grow: 五项成长档；hp / mp: [基础, 每级]；type: 相克类型（mage / siege / noble 不参与相克）；spells 由下方按 SPELL_LEARN 填入
// 文官系（策士 / 风水士 / 道士 / 骑马策士）与都督、海盗、咒术士、黄巾贼的普通攻击范围原版查不到，为自行设计
const T = (name, glyph, move, range) => ({ name, glyph, move, range });
export const SERIES = {
  lord: { name: '君主', moveType: 'horse', type: 'horse', tiers: [T('群雄', '雄', 6, 'cross'), T('英雄', '英', 6, 'around'), T('霸王', '霸', 7, 'around')],
    grow: { atk: 'A', int: 'A', def: 'A', burst: 'A', morale: 'A' }, hp: [100, 5], mp: [30, 1] },
  infantry: { name: '步兵', moveType: 'foot', type: 'foot', tiers: [T('轻步兵', '步', 4, 'around'), T('重步兵', '步', 4, 'around'), T('近卫兵', '近', 5, 'around')],
    grow: { atk: 'B', int: 'A', def: 'S', burst: 'B', morale: 'B' }, hp: [110, 6], mp: [10, 1] },
  archer: { name: '弓兵', moveType: 'foot', type: 'bow', tiers: [T('弓兵', '弓', 4, 'ring2'), T('弩兵', '弩', 4, 'r23'), T('连弩兵', '弩', 5, 'r24')],
    grow: { atk: 'A', int: 'B', def: 'B', burst: 'B', morale: 'S' }, hp: [90, 4], mp: [10, 1] },
  cavalry: { name: '骑兵', moveType: 'horse', type: 'horse', tiers: [T('轻骑兵', '骑', 6, 'cross'), T('重骑兵', '骑', 6, 'cross'), T('亲卫队', '卫', 7, 'around')],
    grow: { atk: 'S', int: 'B', def: 'A', burst: 'B', morale: 'B' }, hp: [100, 5], mp: [10, 1] },
  archercav: { name: '弓骑兵', moveType: 'horse', type: 'bow', tiers: [T('弓骑兵', '弓', 6, 'line2'), T('弩骑兵', '弩', 6, 'ring2'), T('连弩骑兵', '弩', 7, 'r23')],
    grow: { atk: 'S', int: 'B', def: 'B', burst: 'B', morale: 'A' }, hp: [100, 5], mp: [10, 1] },
  // 炮车二阶射程有冲突，采用 4~5 格
  catapult: { name: '炮车', moveType: 'foot', type: 'siege', tiers: [T('轻炮车', '车', 3, 'ring4'), T('重炮车', '车', 3, 'r45'), T('霹雳车', '霹', 4, 'r45')],
    grow: { atk: 'S', int: 'B', def: 'A', burst: 'C', morale: 'A' }, hp: [90, 4], mp: [10, 1] },
  fighter: { name: '武道家', moveType: 'foot', type: 'foot', tiers: [T('武道家', '武', 5, 'cross'), T('拳士', '拳', 5, 'around'), T('拳圣', '圣', 6, 'around')],
    grow: { atk: 'A', int: 'C', def: 'A', burst: 'S', morale: 'B' }, hp: [90, 4], mp: [20, 1] },
  bandit: { name: '贼兵', moveType: 'foot', type: 'foot', tiers: [T('贼兵', '贼', 5, 'around'), T('义贼', '义', 5, 'around'), T('豪杰', '豪', 6, 'around')],
    grow: { atk: 'S', int: 'C', def: 'B', burst: 'B', morale: 'S' }, hp: [100, 5], mp: [20, 1] },
  strategist: { name: '策士', moveType: 'foot', type: 'mage', tiers: [T('策士', '策', 4, 'cross'), T('参谋', '参', 4, 'around'), T('军师', '军', 5, 'around')],
    grow: { atk: 'B', int: 'S', def: 'B', burst: 'B', morale: 'B' }, hp: [90, 4], mp: [40, 2] },
  healer: { name: '风水士', moveType: 'foot', type: 'mage', tiers: [T('风水士', '风', 4, 'cross'), T('方术士', '方', 5, 'around'), T('仙术士', '仙', 6, 'around')],
    grow: { atk: 'C', int: 'S', def: 'C', burst: 'A', morale: 'A' }, hp: [80, 3], mp: [50, 2] },
  taoist: { name: '道士', moveType: 'foot', type: 'mage', tiers: [T('道士', '道', 4, 'cross'), T('幻术士', '幻', 4, 'around'), T('妖术士', '妖', 5, 'around')],
    grow: { atk: 'C', int: 'S', def: 'B', burst: 'A', morale: 'B' }, hp: [80, 3], mp: [40, 2] },
  mountstrat: { name: '骑马策士', moveType: 'horse', type: 'mage', tiers: [T('骑马策士', '策', 6, 'cross'), T('骑马参谋', '参', 6, 'around'), T('骑马军师', '军', 7, 'around')],
    grow: { atk: 'A', int: 'S', def: 'B', burst: 'B', morale: 'C' }, hp: [100, 5], mp: [40, 2] },
  dancer: { name: '舞娘', moveType: 'foot', type: 'foot', tiers: [T('舞娘', '舞', 5, 'cross'), T('舞伎', '伎', 5, 'around'), T('巫女', '巫', 6, 'around')],
    grow: { atk: 'A', int: 'B', def: 'B', burst: 'S', morale: 'B' }, hp: [90, 3], mp: [20, 1] },
  // ---------- 单阶特殊兵种 ----------
  xiliang: { name: '西凉骑兵', moveType: 'horse', type: 'horse', tiers: [T('西凉骑兵', '凉', 6, 'around')],
    grow: { atk: 'S', int: 'C', def: 'S', burst: 'B', morale: 'B' }, hp: [110, 6], mp: [5, 1] },
  // 黄巾贼的 HP/MP 与攻击范围原版查不到，自行设计
  yellow: { name: '黄巾贼', moveType: 'foot', type: 'foot', tiers: [T('黄巾贼', '巾', 4, 'cross')],
    grow: { atk: 'B', int: 'C', def: 'B', burst: 'B', morale: 'C' }, hp: [90, 4], mp: [5, 1] },
  pirate: { name: '海盗', moveType: 'foot', type: 'foot', tiers: [T('海盗', '海', 5, 'around')],
    grow: { atk: 'S', int: 'B', def: 'B', burst: 'A', morale: 'B' }, hp: [90, 4], mp: [20, 1] },
  dudu: { name: '都督', moveType: 'horse', type: 'mage', tiers: [T('都督', '督', 5, 'around')],
    grow: { atk: 'A', int: 'S', def: 'B', burst: 'B', morale: 'B' }, hp: [90, 4], mp: [30, 2] },
  sorcerer: { name: '咒术士', moveType: 'foot', type: 'mage', tiers: [T('咒术士', '咒', 5, 'around')],
    grow: { atk: 'C', int: 'S', def: 'B', burst: 'B', morale: 'A' }, hp: [80, 3], mp: [60, 3] },
  emperor: { name: '皇帝', moveType: 'foot', type: 'noble', tiers: [T('皇帝', '帝', 4, 'none')],
    grow: { atk: 'C', int: 'C', def: 'C', burst: 'C', morale: 'S' }, hp: [80, 3], mp: [5, 1] },
  // 百姓、辎重队的 HP/MP 原版查不到，自行设计
  commoner: { name: '百姓', moveType: 'foot', type: 'noble', tiers: [T('百姓', '民', 4, 'none')],
    grow: { atk: 'C', int: 'C', def: 'C', burst: 'C', morale: 'C' }, hp: [70, 3], mp: [0, 0] },
  transport: { name: '辎重队', moveType: 'foot', type: 'noble', tiers: [T('辎重队', '辎', 4, 'none')],
    grow: { atk: 'C', int: 'B', def: 'C', burst: 'C', morale: 'B' }, hp: [100, 4], mp: [10, 1] },
};

// 策略习得表：SERIES[x].spells = [{ id, lvl, tier }]（见 spells.js 的 SPELL_LEARN）；无策略的系列为空数组
for (const [id, s] of Object.entries(SERIES)) s.spells = SPELL_LEARN[id] || [];

// 按系列与阶级取兵种信息：{ name, glyph, move, range, moveType, type, spells, tier, tiers, series }
// spells：该阶级（含以下阶级）可习得的策略 id（不看等级）；单位实际掌握的策略用 logic.js 的 knownSpells(u)
const VIEWS = Object.fromEntries(Object.entries(SERIES).map(([id, s]) => [id, s.tiers.map((t, i) => ({
  ...t, moveType: s.moveType, type: s.type, spells: s.spells.filter((e) => e.tier <= i + 1).map((e) => e.id),
  tier: i + 1, tiers: s.tiers.length, series: s.name,
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

// 消耗品（原版，见 research status.md §4）：hp / mp 为回复量，full 为回满（'hp' | 'mp'），cure 为解除的异常（'all' 为全部）
// 自行设计：神秘水 / 神秘酒的回复量；解毒药、膏药、兴奋剂、止咳药与异常的对应关系（原版查不到，按名称设计）
export const ITEMS = {
  bean: { name: '豆', desc: '恢复兵力 30', hp: 30 },
  rice: { name: '米', desc: '恢复兵力 80', hp: 80 },
  peach: { name: '桃', desc: '兵力全满（只能从关卡获得）', full: 'hp' },
  water: { name: '神秘水', desc: '恢复策略值 30', mp: 30 },
  wine: { name: '神秘酒', desc: '策略值全满', full: 'mp' },
  antidote: { name: '解毒药', desc: '解除中毒', cure: 'poison' },
  plaster: { name: '膏药', desc: '解除麻痹', cure: 'paralyze' },
  stimulant: { name: '兴奋剂', desc: '解除混乱', cure: 'confuse' },
  cough: { name: '止咳药', desc: '解除禁咒', cure: 'silence' },
  panacea: { name: '万能药', desc: '解除全部异常', cure: 'all' },
  // 印绶：我军 15 级（一阶）/ 30 级（二阶）以上可用于转职
  seal: { name: '印绶', desc: '转职（15 / 30 级）', promote: true },
  // 果子：3 级普通装备卖出获得，只能在整备时使用（fruit 为对应能力，exp 为经验果）
  fruit_exp: { name: '经验果', desc: '经验 +50（整备时使用）', fruit: 'exp' },
  fruit_atk: { name: '武力果', desc: '攻击 +2（整备时使用）', fruit: 'atk' },
  fruit_int: { name: '智力果', desc: '精神 +2（整备时使用）', fruit: 'int' },
  fruit_def: { name: '统率力果', desc: '防御 +2（整备时使用）', fruit: 'def' },
  fruit_burst: { name: '敏捷果', desc: '爆发 +2（整备时使用）', fruit: 'burst' },
  fruit_morale: { name: '好运果', desc: '士气 +2（整备时使用）', fruit: 'morale' },
};
// 印绶过关奖励：从第 16 关（徐州入侵战）起每关胜利 +1（原版自此关起有售，商店由后续子任务实现）
export const SEAL_FROM = 'xuzhou_ruqin';
// 关卡战利品（自行设计，代替原版各关的宝箱）：每关胜利按关卡序号轮流获得一件，桃只能由此获得
export const LOOT = ['peach', 'antidote', 'plaster', 'wine', 'stimulant', 'cough', 'panacea'];

// 难度：仅作用于敌军（等级加成、属性倍率、AI），以及军需补给；tierLvl 为敌军 / 友军自动定阶的等级门槛 [二阶, 三阶]
export const DIFFICULTIES = {
  normal: {
    name: '普通', color: '#9ce0a8', lvl: 0, mult: null, aggressive: false, tierLvl: [20, 35],
    items: { bean: 6, rice: 2, water: 2, antidote: 1, panacea: 1 }, reward: { bean: 3, rice: 1, water: 1 },
    desc: ['敌军保持原样', '开局军需：豆6 米2 神秘水2', '　　　　　解毒药1 万能药1', '适合初次体验剧情'],
  },
  hard: {
    name: '困难', color: '#ffd27a', lvl: 2, mult: { hp: 1.15, atk: 1.1, def: 1.1, int: 1.1 }, aggressive: false, tierLvl: [15, 30],
    items: { bean: 4, rice: 1, water: 1, antidote: 1 }, reward: { bean: 2, rice: 1, water: 1 },
    desc: ['敌军等级 +2', '兵力 ×1.15，攻击防御精神 ×1.1', '开局军需：豆4 米1 神秘水1', '　　　　　解毒药1'],
  },
  hell: {
    name: '地狱', color: '#ff7a6a', lvl: 4, mult: { hp: 1.3, atk: 1.2, def: 1.15, int: 1.2, burst: 1.1 }, aggressive: true, tierLvl: [15, 30],
    items: { bean: 3, water: 1 }, reward: { bean: 1, water: 1 },
    desc: ['敌军等级 +4', '兵力 ×1.3，攻击 ×1.2', '固守之敌全军出击', '开局军需：豆3 神秘水1'],
  },
};
export const diffOf = (id) => DIFFICULTIES[id] || DIFFICULTIES.normal;
