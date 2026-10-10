// 策略表（原版，见 research spells.md）。纯数据，Node 可直接导入，由 data.js 再导出
// 字段：name, cat 类别, elem? 元素, formula? 伤害公式, mp, range 射程（'map' 为全图）, area 范围,
//   target 'foe' | 'ally' | 'self', status? 附加异常, buff? { stat, mult | add } 增减益, special? 特殊效果,
//   hitMod? 成功率系数, color 特效主色, desc 说明
// cat：damage 伤害 / status 异常 / debuff 减益 / buff 增益 / heal 回复兵力 / mp 回复策略值 / cure 解除异常 / special 特殊
// area：0 单体、'cross' 十字 5 格、'square' 方形 3×3、'map' 全图
// formula（L = 施策者等级，Δ = (施策者精神 − 目标精神) / 3）：
//   a (L+Δ+5)×0.7+14、b (L+Δ+5)×0.9+18、c 精神不低于目标 (L+Δ+1)/2+12 否则 +13、d (L+Δ)×1.2+30、
//   e (L+Δ+4)×0.4+8、f (L+Δ)/5+5、g L+Δ+25（朱雀）、kill 目标全部兵力、drainMp 吸取策略值 (L+Δ+1)/2+12
// 天气（research weather.md §5~§7）：noBadWeather 恶劣天气（雨 / 豪雨 / 雪）不能用（火系）；
//   weather 四神的天气条件 'bad' | 'sun' | 'cloud'；needGem 需装备的宝玉；setWeather 天气策略 'cloud' | 'sun' | 'rain'
// 自行设计（原版查不到）：MP（有单一来源的取其值：小补给 6、坚固 6、奋起 6、鼓舞 12、强阵 12、输送 18、回归 24、
//   谎报 8、谎言 18、晕眩 16）、射程（普通 3 格）、范围（“阵”“龙”十字，巨岩 / 爆焰 / 海啸 / 谎言 / 定军 / 毒雾 /
//   援队 / 援军 / 各“队”字辅助十字，输送 / 八阵图方形）、地形限制、成功率系数、八阵图效果；
//   范围策略对每个目标的威力系数见 logic.js 的 AREA_SCALE；
//   四神的 MP（白虎 40 为单一低可信来源，其余同取 40）、射程与范围（青龙 / 朱雀 3×3）、青龙雷击的目标分配、
//   玄武的命中判定与作用对象（不含施策者）
export const ELEMS = {
  fire: { name: '火', color: 0xff6a1a },
  water: { name: '水', color: 0x3f9cff },
  earth: { name: '地', color: 0xb8956a },
  wind: { name: '风', color: 0x9ae8c8 },
};

const D = (name, elem, formula, mp, area, desc, extra = {}) => ({
  name, cat: 'damage', elem, formula, mp, range: 3, area, target: 'foe', color: ELEMS[elem]?.color ?? 0xd070ff, desc, ...extra,
});
const X = (name, cat, mp, area, extra, desc) => ({
  name, cat, mp, range: extra.target === 'self' ? 0 : 3, area, target: 'foe', color: 0xb070ff, desc, ...extra,
});
const PW = 'power'; // 攻击 / 精神：对武将作用于攻击，对文官作用于精神
const UP = 1.2, DOWN = 0.7;

export const SPELLS = {
  // ---------- 伤害：火 ----------
  burn: D('灼热', 'fire', 'a', 6, 0, '火攻单个敌军'),
  blaze: D('烈火', 'fire', 'b', 10, 0, '猛火攻击单个敌军'),
  firearr: D('火阵', 'fire', 'c', 12, 'cross', '火焰覆盖十字范围'),
  firedragon: D('火龙', 'fire', 'a', 20, 'cross', '火龙席卷十字范围'),
  explode: D('爆焰', 'fire', 'b', 16, 'cross', '爆炎冲击十字范围'),
  // ---------- 伤害：水（目标或相邻须有河流 / 桥梁 / 战船） ----------
  muddy: D('浊流', 'water', 'a', 6, 0, '浊流冲击单个敌军'),
  torrent: D('激流', 'water', 'b', 10, 0, '激流冲击单个敌军'),
  waterarr: D('水阵', 'water', 'c', 12, 'cross', '水流覆盖十字范围'),
  waterdragon: D('水龙', 'water', 'a', 20, 'cross', '水龙席卷十字范围'),
  tsunami: D('海啸', 'water', 'kill', 24, 'cross', '巨浪吞没十字范围，命中即击溃，成功率低', { hitMod: 0.5 }),
  // ---------- 伤害：地（目标或相邻须有山地 / 森林） ----------
  rock: D('落石', 'earth', 'a', 6, 0, '滚落巨石攻击单个敌军'),
  landslide: D('山岚', 'earth', 'b', 10, 0, '山崩攻击单个敌军'),
  eartharr: D('地阵', 'earth', 'a', 14, 'cross', '地裂覆盖十字范围'),
  earthdragon: D('地龙', 'earth', 'b', 22, 'cross', '地龙翻腾十字范围'),
  boulder: D('巨岩', 'earth', 'd', 18, 'cross', '巨岩砸落十字范围'),
  // ---------- 伤害：风（目标不能在城池内） ----------
  whirl: D('旋风', 'wind', 'c', 4, 0, '旋风攻击单个敌军'),
  tornado: D('龙卷', 'wind', 'a', 8, 0, '龙卷风攻击单个敌军'),
  windarr: D('风阵', 'wind', 'e', 10, 'cross', '狂风覆盖十字范围'),
  winddragon: D('风龙', 'wind', 'c', 18, 'cross', '风龙席卷十字范围'),
  sandstorm: D('砂暴', 'wind', 'f', 30, 'map', '全图风沙，攻击所有身处野外（平原、草原、森林、山地）的敌军', { range: 'map' }),
  // ---------- 伤害：特殊 ----------
  faint: D('晕眩', null, 'kill', 16, 0, '使目标兵力尽失，成功率低', { hitMod: 0.4, color: 0xc070ff }),
  charm: D('诱惑', null, 'a', 8, 0, '吸取目标兵力（舞娘施放伤害加倍）', { special: 'drain', color: 0xff70b0 }),
  bind: D('定身', null, 'c', 10, 0, '伤害并使目标麻痹', { status: 'paralyze', color: 0xffe040 }),
  bindarmy: D('定军', null, 'f', 20, 'cross', '伤害并使十字范围敌军麻痹', { status: 'paralyze', color: 0xffe040 }),
  poison: D('毒烟', null, 'a', 6, 0, '伤害并使目标中毒', { status: 'poison', color: 0x7ad04a }),
  poisonfog: D('毒雾', null, 'e', 16, 'cross', '伤害并使十字范围敌军中毒', { status: 'poison', color: 0x7ad04a }),
  // ---------- 异常 ----------
  silence: X('封咒', 'status', 10, 0, { status: 'silence', hitMod: 0.8, color: 0x9a9ab0 }, '使目标禁咒，无法使用策略'),
  rumor: X('谎报', 'status', 8, 0, { status: 'confuse', hitMod: 0.8, color: 0xb070ff }, '使目标混乱，无法行动'),
  lie: X('谎言', 'status', 18, 'cross', { status: 'confuse', hitMod: 0.8, color: 0xb070ff }, '使十字范围敌军混乱'),
  bazhen: X('八阵图', 'status', 24, 'square', { status: 'random', hitMod: 0.8, color: 0xd0a0ff }, '3×3 范围敌军随机陷入中毒 / 麻痹 / 混乱 / 禁咒（自行设计）'),
  spy: X('谍报', 'debuff', 8, 0, { formula: 'drainMp', special: 'drainMp', color: 0x6ab8ff }, '吸取目标策略值'),
  // ---------- 减益（降为 70%） ----------
  dull: X('钝兵', 'debuff', 6, 0, { buff: { stat: 'burst', mult: DOWN }, hitMod: 0.9 }, '目标爆发降低'),
  dullarmy: X('钝队', 'debuff', 12, 'cross', { buff: { stat: 'burst', mult: DOWN }, hitMod: 0.9 }, '十字范围敌军爆发降低'),
  weaken: X('虚脱', 'debuff', 6, 0, { buff: { stat: 'morale', mult: DOWN }, hitMod: 0.9 }, '目标士气降低'),
  weary: X('厌战', 'debuff', 12, 'cross', { buff: { stat: 'morale', mult: DOWN }, hitMod: 0.9 }, '十字范围敌军士气降低'),
  oppress: X('压迫', 'debuff', 6, 0, { buff: { stat: PW, mult: DOWN }, hitMod: 0.9 }, '目标攻击（文官为精神）降低'),
  intimidate: X('威吓', 'debuff', 12, 'cross', { buff: { stat: PW, mult: DOWN }, hitMod: 0.9 }, '十字范围敌军攻击（文官为精神）降低'),
  curse: X('咒骂', 'debuff', 6, 0, { buff: { stat: 'def', mult: DOWN }, hitMod: 0.9 }, '目标防御降低'),
  provoke: X('挑拨', 'debuff', 12, 'cross', { buff: { stat: 'def', mult: DOWN }, hitMod: 0.9 }, '十字范围敌军防御降低'),
};

const A = (name, cat, mp, area, extra, desc) => X(name, cat, mp, area, { target: 'ally', color: 0x7dffa0, ...extra }, desc);
Object.assign(SPELLS, {
  // ---------- 增益（+20%，强行为移动 +2） ----------
  haste: A('强行', 'buff', 10, 0, { buff: { stat: 'move', add: 2 }, color: 0xffd36a }, '友军移动力 +2'),
  drill: A('练兵', 'buff', 6, 0, { buff: { stat: 'burst', mult: UP }, color: 0xffd36a }, '友军爆发上升'),
  drillarmy: A('练队', 'buff', 12, 'cross', { buff: { stat: 'burst', mult: UP }, color: 0xffd36a }, '十字范围友军爆发上升'),
  rouse: A('昂扬', 'buff', 6, 0, { buff: { stat: 'morale', mult: UP }, color: 0xffd36a }, '友军士气上升'),
  cheer: A('欢声', 'buff', 12, 'cross', { buff: { stat: 'morale', mult: UP }, color: 0xffd36a }, '十字范围友军士气上升'),
  inspire: A('奋起', 'buff', 6, 0, { buff: { stat: PW, mult: UP }, color: 0xffd36a }, '友军攻击（文官为精神）上升'),
  encourage: A('鼓舞', 'buff', 12, 'cross', { buff: { stat: PW, mult: UP }, color: 0xffd36a }, '十字范围友军攻击（文官为精神）上升'),
  fortify: A('坚固', 'buff', 6, 0, { buff: { stat: 'def', mult: UP }, color: 0xffd36a }, '友军防御上升'),
  fortarmy: A('强阵', 'buff', 12, 'cross', { buff: { stat: 'def', mult: UP }, color: 0xffd36a }, '十字范围友军防御上升'),
  focus: A('气合', 'buff', 4, 0, { target: 'self', buff: { stat: PW, mult: UP }, color: 0xffd36a }, '自身攻击（文官为精神）上升'),
  overlord: A('霸气', 'buff', 12, 0, { target: 'self', buff: { stat: 'all', mult: UP }, color: 0xffd36a }, '自身攻击 / 精神、防御、爆发、士气全部上升'),
  // ---------- 特殊 ----------
  again: A('回归', 'special', 24, 0, { special: 'again', color: 0xffe08a }, '让一名已行动的我军部队再行动一次'),
  meditate: A('冥想', 'special', 0, 0, { target: 'self', special: 'meditate', color: 0x6ab8ff }, '自身兵力 −50，策略值 +25'),
  // ---------- 回复 ----------
  aid: A('小补给', 'heal', 6, 0, { heal: 'small' }, '恢复友军兵力（40 + 精神 / 10）'),
  aidarmy: A('援队', 'heal', 12, 'cross', { heal: 'small' }, '恢复十字范围友军兵力（40 + 精神 / 10）'),
  supply: A('大补给', 'heal', 12, 0, { heal: 'big' }, '大量恢复友军兵力（70 + 精神 / 2）'),
  supplyarmy: A('援军', 'heal', 24, 'cross', { heal: 'big' }, '大量恢复十字范围友军兵力'),
  convoy: A('输送', 'heal', 18, 'square', { heal: 'big' }, '大量恢复 3×3 范围友军兵力'),
  advise: A('建言', 'mp', 6, 0, { mpGain: 24, color: 0x6ab8ff }, '恢复友军策略值 24'),
  counsel: A('献策', 'mp', 12, 0, { mpGain: 48, color: 0x6ab8ff }, '恢复友军策略值 48'),
  awaken: A('觉醒', 'cure', 6, 0, { cure: 'all', color: 0xfff2a0 }, '解除友军的中毒、麻痹、混乱、禁咒'),
  awaken2: A('大觉醒', 'cure', 14, 'cross', { cure: 'all', color: 0xfff2a0 }, '解除十字范围友军的全部异常'),
  // ---------- 天气（骑马策士系，必定成功；MP 原版：昙天 10、晴明 / 豪雨 16） ----------
  tiantan: A('昙天', 'special', 10, 0, { target: 'self', setWeather: 'cloud', color: 0x8a96a8 }, '使用奇门遁甲之术使天空阴云密布（天气变为阴）'),
  qingming: A('晴明', 'special', 16, 0, { target: 'self', setWeather: 'sun', color: 0xffd36a }, '使用奇门遁甲之术使天气晴朗（天气变为晴）'),
  haoyu: A('豪雨', 'special', 16, 0, { target: 'self', setWeather: 'rain', color: 0x5a8ad8 }, '使用奇门遁甲之术祈求降雨（变为本关最恶劣的天气，多雪之地会下雪）'),
});

// ---------- 四神（需装备对应宝玉，见 research weather.md §7） ----------
Object.assign(SPELLS, {
  qinglong: D('青龙', null, 'a', 40, 'square', '召唤青龙，3×3 范围内降下 5 次雷击（需青龙宝玉，只能在雨、豪雨、雪天使用）',
    { special: 'thunder', strikes: 5, needGem: 'jade_qinglong', weather: 'bad', color: 0x7ad8ff }),
  zhuque: D('朱雀', null, 'g', 40, 'square', '召唤朱雀，烈焰席卷 3×3 范围（需朱雀宝玉，只能在晴天使用）',
    { special: 'zhuque', needGem: 'jade_zhuque', weather: 'sun', color: 0xff5a2a }),
  xuanwu: X('玄武', 'special', 40, 'map', { target: 'self', special: 'xuanwu', needGem: 'jade_xuanwu', weather: 'cloud', color: 0x4a3a6a },
    '召唤玄武，全图不分敌我随机陷入异常或能力下降（需玄武宝玉，只能在阴天使用）'),
  baihu: A('白虎', 'heal', 40, 'map', { target: 'self', special: 'baihu', heal: 'big', cure: 'all', needGem: 'jade_baihu', color: 0xf0f6ff },
    '召唤白虎，全体我军大补给并解除全部异常（需白虎宝玉，不受天气限制）'),
});
// 火系：恶劣天气不能使用
for (const sp of Object.values(SPELLS)) if (sp.elem === 'fire') sp.noBadWeather = true;

// 各系列按等级与阶级习得的策略（research spells.md §1，P1 表）：[等级, 阶级, id...]
// 一阶栏为阶级 1，一转后栏为阶级 2，二转后栏为阶级 3；天气策略按 research weather.md §6（昙天各阶 13 级、晴明二阶起 27 级、豪雨三阶 30 级）
const L = (...rows) => rows.flatMap(([lvl, tier, ...ids]) => ids.map((id) => ({ id, lvl, tier })));
export const SPELL_LEARN = {
  lord: L([1, 1, 'whirl'], [6, 1, 'aid'], [10, 1, 'overlord'], [15, 2, 'windarr'], [20, 2, 'advise'], [25, 2, 'firearr'], [30, 3, 'intimidate']),
  bandit: L([1, 1, 'rock'], [8, 1, 'curse'], [15, 2, 'landslide'], [30, 3, 'boulder']),
  fighter: L([1, 1, 'focus'], [8, 1, 'dull'], [15, 2, 'poison'], [30, 3, 'dullarmy']),
  dancer: L([1, 1, 'awaken'], [8, 1, 'inspire'], [15, 2, 'charm'], [22, 2, 'awaken2'], [30, 3, 'faint']),
  mountstrat: L([3, 1, 'focus', 'whirl'], [5, 1, 'burn'], [7, 1, 'rock'], [9, 1, 'aid'], [11, 1, 'windarr'], [13, 1, 'tiantan'], [15, 1, 'firearr'],
    [15, 2, 'tornado'], [17, 2, 'bind'], [19, 2, 'blaze'], [21, 2, 'landslide'], [23, 2, 'meditate'], [25, 2, 'boulder'], [27, 2, 'qingming'], [29, 2, 'sandstorm'],
    [30, 3, 'haoyu'], [31, 3, 'explode'], [32, 3, 'winddragon'], [33, 3, 'firedragon'], [35, 3, 'qinglong']),
  strategist: L([1, 1, 'burn'], [3, 1, 'focus'], [5, 1, 'rock'], [7, 1, 'muddy'], [9, 1, 'aid'], [11, 1, 'firearr'], [13, 1, 'eartharr'], [15, 1, 'waterarr'],
    [15, 2, 'whirl'], [17, 2, 'blaze'], [19, 2, 'landslide'], [21, 2, 'torrent'], [23, 2, 'meditate'], [25, 2, 'boulder'], [27, 2, 'tsunami'], [29, 2, 'earthdragon'],
    [30, 3, 'explode'], [31, 3, 'waterdragon'], [33, 3, 'firedragon'], [35, 3, 'zhuque']),
  taoist: L([1, 1, 'poison'], [3, 1, 'weaken'], [5, 1, 'dull'], [7, 1, 'charm'], [9, 1, 'aid'], [11, 1, 'bind'], [13, 1, 'oppress'], [15, 1, 'curse'],
    [15, 2, 'rumor'], [17, 2, 'silence'], [19, 2, 'supply'], [20, 2, 'weary'], [21, 2, 'dullarmy'], [23, 2, 'spy'], [25, 2, 'poisonfog'], [27, 2, 'intimidate'],
    [29, 2, 'provoke'], [30, 2, 'bindarmy'], [30, 3, 'lie'], [31, 3, 'faint'], [33, 3, 'bazhen'], [35, 3, 'xuanwu']),
  healer: L([1, 1, 'aid'], [3, 1, 'rouse'], [5, 1, 'drill'], [7, 1, 'awaken'], [9, 1, 'fortify'], [11, 1, 'advise'], [13, 1, 'inspire'], [15, 1, 'aidarmy'],
    [15, 2, 'supply'], [17, 2, 'cheer'], [19, 2, 'drillarmy'], [21, 2, 'haste'], [23, 2, 'fortarmy'], [25, 2, 'convoy'], [27, 2, 'encourage'], [29, 2, 'counsel'],
    [30, 3, 'again'], [31, 3, 'awaken2'], [33, 3, 'supplyarmy'], [35, 3, 'baihu']),
  pirate: L([1, 1, 'muddy'], [8, 1, 'curse'], [15, 1, 'torrent'], [30, 1, 'tsunami']),
  dudu: L([1, 1, 'muddy'], [4, 1, 'burn'], [8, 1, 'waterarr'], [12, 1, 'aid'], [16, 1, 'torrent'], [20, 1, 'rumor'], [24, 1, 'firearr'],
    [28, 1, 'waterdragon'], [32, 1, 'tsunami'], [35, 1, 'firedragon']),
  sorcerer: L([1, 1, 'burn', 'muddy', 'whirl', 'poison', 'aid', 'focus'], [3, 1, 'weaken', 'rouse'], [5, 1, 'dull', 'drill'],
    [7, 1, 'rock', 'charm', 'awaken'], [8, 1, 'waterarr'], [9, 1, 'fortify'], [11, 1, 'windarr', 'bind', 'inspire'],
    [13, 1, 'firearr', 'oppress', 'aidarmy'], [15, 1, 'tornado', 'eartharr', 'curse', 'rumor', 'supply', 'cheer'], [16, 1, 'torrent'],
    [17, 1, 'blaze', 'silence', 'drillarmy'], [19, 1, 'landslide', 'advise'], [20, 1, 'weary'], [21, 1, 'dullarmy', 'haste'],
    [23, 1, 'spy', 'fortarmy', 'meditate'], [25, 1, 'poisonfog', 'encourage'], [27, 1, 'intimidate', 'counsel'], [28, 1, 'waterdragon'],
    [29, 1, 'provoke', 'awaken2'], [30, 1, 'earthdragon', 'faint', 'lie', 'bindarmy', 'convoy'], [31, 1, 'again'],
    [32, 1, 'winddragon'], [33, 1, 'firedragon', 'bazhen', 'supplyarmy']),
};
