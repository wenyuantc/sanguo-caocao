import { TERRAIN, moveCost, terrainDef, IMPASSABLE, RANGES, ADVANTAGE, SPELLS, ITEMS, ALLY_ITEMS, SERIES, GRADE, STAT5, PROMOTE_LVL, classOf } from './data.js';
import { GENERALS, isGeneral } from './generals.js';
import { CLASS_BY_NAME } from './characters.js';
import {
  GUARD_TAKEN, STATUS_KEYS, effStats, moveBonus, canMove, canAct, canCast, canCounter, alwaysHit, has, hasBuff, applyStatus, applyBuff, cure,
} from './status.js';
import { equipStats, defaultKit, copyKit, fx, fxSum, fxMax, FRUIT_GAIN, EQUIP, SLOTS } from './equipment.js';
import { isBad, SUN, CLOUD } from './weather.js';

// 格子键：地图最大 40 × 40，按 KEY_W 列展开（与地图实际宽度无关，可跨地图复用）
export const KEY_W = 64;
export const key = (x, y) => y * KEY_W + x;
// 地图尺寸由关卡数据决定
export const mapCols = (map) => map[0].length;
export const mapRows = (map) => map.length;
export const inMap = (x, y, map) => x >= 0 && y >= 0 && y < map.length && x < map[0].length;
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const isFoe = (a, b) => (a.faction === 'enemy') !== (b.faction === 'enemy');

// 五项能力的统一基础值（自行设计）：五项 = BASE5 + 成长档 × 等级 + 加成，用于把数值量级校准到与旧公式接近
export const BASE5 = 73;

const GENERAL_CLS = Object.fromEntries(Object.values(GENERALS).map((g) => [g.name, g.cls]));

// 单位的兵种系列、个人修正与加成：我军武将以武将总表为准；其他单位依次按兵种登记表、同名武将、
// 黄巾兵（关卡兵种为 bandit 且名字含“黄巾”）映射，都不匹配时沿用关卡数据中的兵种
export function roleOf(def) {
  if (def.faction === 'player' && isGeneral(def.id)) {
    const g = GENERALS[def.id];
    return { cls: g.cls, gradeMod: g.gradeMod || null, bonus: g.bonus };
  }
  const cls = CLASS_BY_NAME[def.name] || GENERAL_CLS[def.name] || (def.cls === 'bandit' && def.name.includes('黄巾') ? 'yellow' : def.cls);
  return { cls, gradeMod: def.gradeMod || null, bonus: def.bonus };
}

// 按等级定阶：默认门槛 PROMOTE_LVL（≥15 二阶，≥30 三阶，首次出阵的我军用）；敌军 / 友军传入难度的 tierLvl；单阶兵种恒为 1
export function tierFor(cls, lvl, gate = PROMOTE_LVL) {
  return Math.min(SERIES[cls].tiers.length, lvl >= gate[1] ? 3 : lvl >= gate[0] ? 2 : 1);
}
// 非我军单位的定阶门槛（随难度）
const gateOf = (diff) => diff?.tierLvl || PROMOTE_LVL;

// 能力：u 需含 cls / tier / lvl，可选 bonus / mult / gradeMod / equip / fruits
// HP/MP = 系列基础 + 每级成长 × (等级 + 2 × 已转职次数) + 武将加成（原版公式）；mult 为难度倍率
// 五项 = BASE5 + 成长档 × 等级 + 加成（关卡数据中的 bonus.agi 视为爆发）
// 装备加成与果子（每个 +FRUIT_GAIN）直接加在结果上，不乘难度倍率
export function calcStats(u) {
  const sr = SERIES[u.cls];
  const tier = Math.min(u.tier || 1, sr.tiers.length);
  const b = u.bonus || {}, m = u.mult || {}, eq = equipStats(u.equip), fr = u.fruits || {};
  const lv = u.lvl + 2 * (tier - 1);
  const s = {
    hp: Math.round((sr.hp[0] + sr.hp[1] * lv) * (m.hp || 1) + (b.hp || 0)) + (eq.hp || 0),
    mp: Math.max(0, Math.round(sr.mp[0] + sr.mp[1] * lv + (b.mp || 0)) + (eq.mp || 0)),
  };
  for (const k of STAT5) {
    const add = k === 'burst' ? b.burst ?? b.agi ?? 0 : b[k] || 0;
    s[k] = Math.round((BASE5 + GRADE[u.gradeMod?.[k] || sr.grow[k]] * u.lvl) * (m[k] || 1) + add) + (eq[k] || 0) + (fr[k] || 0) * FRUIT_GAIN;
  }
  return s;
}

// 装备变化（升级、换装）后重算能力，兵力 / 策略值不超过新上限
export function refreshStats(u) {
  u.stats = calcStats(u);
  u.hp = Math.min(u.hp, u.stats.hp);
  u.mp = Math.min(u.mp, u.stats.mp);
}

// diff：难度配置，只作用于敌军；equip：我军武将的装备实例副本（kitFrom），缺省时按兵种与等级配默认普通装备
// 阶级：我军沿用 roster 记录（有 lvl 的成长记录；旧存档缺省为一阶），首次出阵的我军按 15/30 定阶，敌军 / 友军按难度门槛定阶
export function createUnit(def, saved, diff, equip) {
  const hard = def.faction === 'enemy' && diff;
  const lvl = Math.max(def.lvl, saved?.lvl || 0) + (hard ? diff.lvl : 0);
  let ai = def.ai || 'aggressive';
  if (hard && diff.aggressive && !def.leader && ai === 'hold') ai = 'aggressive';
  const role = roleOf(def);
  const u = {
    ...def,
    ...role,
    lvl,
    tier: saved?.lvl ? Math.min(saved.tier || 1, SERIES[role.cls].tiers.length)
      : tierFor(role.cls, lvl, def.faction === 'player' ? PROMOTE_LVL : gateOf(diff)),
    exp: saved?.exp || 0,
    ai,
    status: {},
    buffs: {},
    equip: equip || defaultKit(role.cls, lvl),
    fruits: saved?.fruits ? { ...saved.fruits } : null,
    items: def.faction === 'ally' ? { ...(def.items || ALLY_ITEMS) } : null,
    mult: hard ? diff.mult : null,
    acted: false,
    moved: false,
    alive: true,
  };
  u.stats = calcStats(u);
  u.hp = u.stats.hp;
  u.mp = u.stats.mp;
  return u;
}

// 读取战斗中存档的单位：兵种以总表 / 登记表为准，缺 tier 时我军视为一阶、其他按等级定阶，能力按新公式重算
export function restoreUnit(saved, diff) {
  // 旧存档没有异常 / 增减益：视为无状态；没有装备：按兵种与等级配默认普通装备（我军武将由 BattleScene 先补上）
  const u = { ...saved, ...roleOf(saved), status: { ...saved.status }, buffs: { ...saved.buffs } };
  // 旧存档的友军没有自带补给：按默认补给补上
  u.items = u.faction === 'ally' ? { ...(saved.items || ALLY_ITEMS) } : null;
  u.tier = Math.min(saved.tier || (u.faction === 'player' ? 1 : tierFor(u.cls, u.lvl, gateOf(diff))), SERIES[u.cls].tiers.length);
  u.equip = saved.equip ? copyKit(saved.equip) : defaultKit(u.cls, u.lvl);
  u.stats = calcStats(u);
  u.hp = Math.min(u.hp, u.stats.hp);
  u.mp = Math.min(u.mp, u.stats.mp);
  return u;
}

// 升级：返回成长差值
export function levelUp(u) {
  const old = u.stats;
  u.lvl += 1;
  u.stats = calcStats(u);
  const diff = {};
  for (const k of Object.keys(old)) diff[k] = u.stats[k] - old[k];
  u.hp = Math.min(u.stats.hp, u.hp + diff.hp);
  u.mp = Math.min(u.stats.mp, u.mp + diff.mp);
  return diff;
}

// 印绶转职条件：可以转职时返回 null，否则返回原因
export function promoteBlock(u) {
  if (u.faction !== 'player') return '只能对我军使用';
  const n = SERIES[u.cls].tiers.length;
  if (n === 1) return `${classOf(u.cls).name}无法转职`;
  if (u.tier >= n) return `${u.name}已是最高阶（${classOf(u.cls, u.tier).name}）`;
  const need = PROMOTE_LVL[u.tier - 1];
  if (u.lvl < need) return `${u.name}需 ${need} 级才能转职（现 ${u.lvl} 级）`;
  return null;
}

// 单位已掌握的策略：本系列习得表中等级、阶级都已达到的策略 id
export function knownSpells(u) {
  return SERIES[u.cls].spells.filter((e) => e.lvl <= u.lvl && e.tier <= (u.tier || 1)).map((e) => e.id);
}

// 转职：升一阶、重算能力、兵力与策略值回满；返回能力差值与新习得的策略（补学已达等级的高阶策略）
export function promote(u) {
  const old = u.stats;
  const oldSpells = knownSpells(u);
  u.tier += 1;
  u.stats = calcStats(u);
  u.hp = u.stats.hp;
  u.mp = u.stats.mp;
  const diff = {};
  for (const k of Object.keys(old)) diff[k] = u.stats[k] - old[k];
  const learned = knownSpells(u).filter((sp) => !oldSpells.includes(sp));
  return { diff, learned };
}

export function terrainAt(map, x, y) {
  return TERRAIN[map[y][x]];
}
// 单位在所在格（或指定格）的地形防御加成：按兵种系列查 TERRAIN_RULES
export const defAt = (map, u, x = u.x, y = u.y) => terrainDef(u.cls, map[y][x]);

// 移动力：兵种 + 增益（强行）+ 装备（马、风车轮）
export const effMove = (u) => classOf(u.cls, u.tier).move + moveBonus(u) + fxSum(u, 'move');

// Dijkstra 计算可移动范围；敌对单位阻挡（赤兔马可穿过），友方可穿过但不可停留；麻痹 / 混乱时只有原地，强行使移动力 +2
// 的卢：可通行地形的消耗都为 1
export function reachable(map, units, u) {
  if (!canMove(u)) return new Map([[key(u.x, u.y), { x: u.x, y: u.y, cost: 0, prev: null }]]);
  const move = effMove(u);
  const pass = !!fx(u, 'passThrough'), flat = !!fx(u, 'allTerrain');
  const occ = new Map();
  for (const o of units) if (o.alive) occ.set(key(o.x, o.y), o);
  const best = new Map([[key(u.x, u.y), { x: u.x, y: u.y, cost: 0, prev: null }]]);
  const open = [best.get(key(u.x, u.y))];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    for (const [dx, dy] of RANGES.melee) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inMap(nx, ny, map)) continue;
      const o = occ.get(key(nx, ny));
      if (o && isFoe(o, u) && !pass) continue;
      const tc = moveCost(u.cls, map[ny][nx]);
      const c = cur.cost + (flat && tc < IMPASSABLE ? 1 : tc);
      if (c > move) continue;
      const k = key(nx, ny);
      if (best.has(k) && best.get(k).cost <= c) continue;
      const node = { x: nx, y: ny, cost: c, prev: cur };
      best.set(k, node);
      open.push(node);
    }
  }
  const result = new Map();
  for (const [k, n] of best) {
    const o = occ.get(k);
    if (!o || o === u) result.set(k, n);
  }
  return result;
}

export function pathTo(node) {
  const path = [];
  for (let n = node; n; n = n.prev) path.unshift({ x: n.x, y: n.y });
  return path;
}

// 攻击范围：兵种阶级的范围，装备没羽箭时改为周围两格
export function attackOffsets(u) {
  return RANGES[fx(u, 'range')?.range || classOf(u.cls, u.tier).range];
}

export function canAttackFrom(u, x, y, target) {
  return attackOffsets(u).some(([dx, dy]) => x + dx === target.x && y + dy === target.y);
}

export function attackTiles(map, u, x = u.x, y = u.y) {
  return attackOffsets(u).map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((p) => inMap(p.x, p.y, map));
}

// 策略射程内的格子；全图策略为全部格子，自身策略只有所在格
export function spellTiles(map, u, spellId, x = u.x, y = u.y) {
  const sp = SPELLS[spellId];
  const r = sp.range === 'map' ? mapCols(map) + mapRows(map) : sp.range;
  const out = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= r && inMap(x + dx, y + dy, map)) out.push({ x: x + dx, y: y + dy });
  return out;
}


// ---------- 战斗计算 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 主将（曹操）与关卡 protect 单位（u.guard）受到的伤害倍率 GUARD_TAKEN 定义在 status.js（中毒扣血同样使用）
export { GUARD_TAKEN };
// 策略伤害另行减轻（自行设计）：原版策略多为范围攻击，开局密集站位时主将常被波及
export const GUARD_SPELL_TAKEN = 0.4;
const taken = (d) => (d.guard ? GUARD_TAKEN : 1);
const spellTaken = (d) => (d.guard ? GUARD_SPELL_TAKEN : 1);

export function affinity(a, d) {
  const ta = classOf(a.cls, a.tier).type, td = classOf(d.cls, d.tier).type;
  if (ADVANTAGE[ta] === td) return 1.2;
  if (ADVANTAGE[td] === ta) return 0.85;
  return 1;
}

// 骑兵类（青釭剑加成对象）：骑马的骑兵相克类型，弓骑兵不算
const isRider = (u) => { const c = classOf(u.cls, u.tier); return c.moveType === 'horse' && c.type === 'horse'; };

// 物理：攻击对防御；命中看双方爆发之差，会心看双方士气之差（系数自行设计，量级与旧公式接近）
// 能力一律取 effStats（套用增减益）；混乱的目标必中
// 装备：镜铠使距离 2 格以上的攻击无效（伤害 0）；青釭剑打骑兵类 ×1.5
export function physDamage(map, a, d) {
  if (dist(a, d) > 1 && fx(d, 'rangedImmune')) return 0;
  const def = defAt(map, d);
  const base = (effStats(a).atk - effStats(d).def * 0.5) * 0.75;
  const lvl = 1 + (a.lvl - d.lvl) * 0.03;
  const horse = isRider(d) ? fx(a, 'vsHorse')?.mult || 1 : 1;
  return Math.max(5, Math.round(base * lvl * affinity(a, d) * horse * (1 - def) * taken(d)));
}

// 倚天剑 / 风神盾：敌人对装备者的命中率降低（在上下限之后扣除）
export function hitRate(map, a, d) {
  if (alwaysHit(d)) return 100;
  return Math.round(clamp(92 + (effStats(a).burst - effStats(d).burst) * 0.8 - defAt(map, d) * 40, 55, 100)) - fxSum(d, 'hitDown');
}

// 玉玺：每次攻击都会心；黄金铠：不会被会心一击（优先）
export function critRate(a, d) {
  if (fx(d, 'noCrit')) return 0;
  if (fx(a, 'alwaysCrit')) return 100;
  return Math.round(clamp(4 + (effStats(a).morale - effStats(d).morale) * 0.3, 2, 25));
}

// 能否反击：未混乱、攻击方没有青龙偃月刀、攻击方在反击范围内
export const counterOk = (a, d) => canCounter(d) && !fx(a, 'noCounter') && canAttackFrom(d, d.x, d.y, a);

// noCrit：不判定会心（蛇矛穿透到身后的伤害）
export function rollAttack(map, a, d, noCrit = false) {
  const hit = Math.random() * 100 < hitRate(map, a, d);
  const crit = !noCrit && hit && Math.random() * 100 < critRate(a, d);
  const dmg = hit ? Math.round(physDamage(map, a, d) * (0.9 + Math.random() * 0.2) * (crit ? 1.5 : 1)) : 0;
  return { hit, crit, dmg };
}

// ---------- 策略 ----------
// 策略伤害的全局系数（自行设计，校准用）：原版公式 × SPELL_SCALE，使量级与物理伤害相当
export const SPELL_SCALE = 2;
// 范围策略对每个目标的威力系数（自行设计）：范围越大单体威力越低，避免一次施放重创密集站位的主将身边部队
export const AREA_SCALE = { cross: 0.4, square: 0.35 };
// 原版伤害公式（research spells.md §2.1）：x = 施策者等级 + (施策者精神 − 目标精神) / 3
const FORMULA = {
  a: (x) => (x + 5) * 0.7 + 14,
  b: (x) => (x + 5) * 0.9 + 18,
  c: (x, ge) => (x + 1) / 2 + (ge ? 12 : 13),
  d: (x) => x * 1.2 + 30,
  e: (x) => (x + 4) * 0.4 + 8,
  f: (x) => x / 5 + 5,
  g: (x) => x + 25,
};
const spellX = (a, d) => a.lvl + (effStats(a).int - effStats(d).int) / 3;

// 野外地形（砂暴可作用）：见 terrain.js 的 wild
const wildCh = (ch) => !!TERRAIN[ch]?.wild;
export const isWild = (map, x, y) => wildCh(map[y][x]);
// 只作用于野外的全图策略（砂暴）；玄武 / 白虎的全图不看地形
const wildOnly = (sp) => sp.area === 'map' && sp.target === 'foe';

// 地形限制（原版，research maps.md §6）：可以施放时返回 null，否则返回中文原因；以目标（范围中心）所在格判断
// 各地形可用的属性见 terrain.js 的 elems（f 火 / w 水 / n 风 / e 地）；船上可用火、水为自行设计
const ELEM_CODE = { fire: 'f', water: 'w', wind: 'n', earth: 'e' };
const ELEM_BLOCK = {
  fire: '火系策略不能朝着位于荒地、山地、浅滩、沼泽、大河、雪原上的部队使用',
  water: '水系策略只能朝着位于桥梁、浅滩、沼泽、大河、雪原、船上的部队使用',
  wind: '风系策略不能对位于建筑物和林中的部队使用',
  earth: '地系策略只能朝着位于山地和荒地的部队使用',
};
export function spellBlock(map, spellId, x, y) {
  const sp = SPELLS[spellId];
  const c = map[y][x];
  if (wildOnly(sp)) return wildCh(c) ? null : '砂暴只能攻击身处野外的敌军';
  const code = ELEM_CODE[sp.elem];
  if (code && !TERRAIN[c]?.elems.includes(code)) return ELEM_BLOCK[sp.elem];
  return null;
}

// 能否以 o 为目标（范围中心）：敌对 / 友方 / 自身；回归只能对已行动、未混乱的其他我军
export function spellTargetOk(a, spellId, o) {
  const sp = SPELLS[spellId];
  if (!o?.alive) return false;
  if (sp.target === 'self') return o === a;
  if (sp.target === 'foe') return isFoe(o, a);
  if (sp.special === 'again') return o !== a && o.faction === 'player' && a.faction === 'player' && o.acted && canAct(o); // 混乱中的部队不能再行动
  return !isFoe(o, a);
}

// 范围格：以 c 为中心（砂暴为全部野外格，玄武 / 白虎为全图）
const AREA = { cross: [[0, 0], ...RANGES.cross], square: [[0, 0], ...RANGES.around] };
export function areaTiles(map, spellId, c) {
  const sp = SPELLS[spellId];
  if (sp.area === 'map') {
    const out = [];
    for (let y = 0; y < mapRows(map); y++) for (let x = 0; x < mapCols(map); x++) if (!wildOnly(sp) || wildCh(map[y][x])) out.push({ x, y });
    return out;
  }
  return (AREA[sp.area] || [[0, 0]]).map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter((p) => inMap(p.x, p.y, map));
}

// 受影响的单位：范围内全部合法目标（敌对策略只打敌人，友方策略只作用于友方）
// 玄武：全图不分敌我（不含施策者）；白虎：全图我方（含友军）
export function spellVictims(map, units, a, spellId, c) {
  const sp = SPELLS[spellId];
  if (sp.special === 'xuanwu') return units.filter((o) => o.alive && o !== a);
  if (sp.special === 'baihu') return units.filter((o) => o.alive && !isFoe(o, a));
  if (sp.target === 'self') return [a];
  if (!sp.area) return [c];
  const side = (o) => o.alive && (sp.target === 'foe' ? isFoe(o, a) : !isFoe(o, a));
  if (sp.area === 'map') return units.filter((o) => side(o) && wildCh(map[o.y][o.x]));
  const offs = AREA[sp.area];
  return units.filter((o) => side(o) && offs.some(([dx, dy]) => o.x === c.x + dx && o.y === c.y + dy));
}

// 预测伤害（确定性，AI 与 HUD 共用）：公式 × SPELL_SCALE × 范围系数 × 地形防御（减半计）× 主将保护（策略为 GUARD_SPELL_TAKEN）；火系乘地形易燃倍率；
// 诱惑由舞娘施放伤害加倍；目标为西凉骑兵 +10%；施策者的 spellMult（关卡数据，缺省 1）；海啸 / 晕眩的伤害等于目标当前兵力（主将仍按保护倍率）
export function spellDamage(map, a, d, spellId) {
  const sp = SPELLS[spellId];
  if (sp.formula === 'kill') return Math.max(1, Math.round(d.hp * spellTaken(d)));
  const t = terrainAt(map, d.x, d.y);
  let m = SPELL_SCALE * (AREA_SCALE[sp.area] || 1) * (1 - defAt(map, d) * 0.5) * spellTaken(d);
  if (sp.elem === 'fire') m *= t.fire || 1;
  if (sp.special === 'drain' && a.cls === 'dancer') m *= 2;
  if (d.cls === 'xiliang') m *= 1.1;
  // 关卡可为个别施策者设 spellMult 调整策略伤害（如第一关张宝），缺省为 1
  m *= a.spellMult || 1;
  // 装备：芭蕉扇 / 五火神焰扇强化对应属性，白银铠减轻受到的策略伤害
  const up = fx(a, 'elemUp');
  if (up && up.elem === sp.elem) m *= up.mult;
  m *= fx(d, 'spellTaken')?.mult || 1;
  return Math.max(1, Math.round(FORMULA[sp.formula](spellX(a, d), effStats(a).int >= effStats(d).int) * m));
}

// 策略消耗：白羽扇减半（向上取整）
export const spellCost = (u, id) => (fx(u, 'mpHalf') ? Math.ceil(SPELLS[id].mp / 2) : SPELLS[id].mp);

// 可使用的策略：已掌握的策略；装备遁甲天书时加上相邻友军已掌握的策略
export function usableSpells(units, u) {
  const own = knownSpells(u);
  if (!fx(u, 'copySpells')) return own;
  const extra = new Set();
  for (const o of units) if (o !== u && o.alive && !isFoe(o, u) && dist(o, u) === 1) knownSpells(o).forEach((id) => extra.add(id));
  return [...own, ...[...extra].filter((id) => !own.includes(id))];
}

// 已装备某件装备
const wears = (u, id) => SLOTS.some((s) => u.equip?.[s]?.id === id);
// 装备了宝玉但尚未习得的四神：策略菜单中置灰显示，并说明所需等级
export const gemSpells = (u, known = knownSpells(u)) => Object.keys(SPELLS)
  .filter((id) => SPELLS[id].needGem && wears(u, SPELLS[id].needGem) && !known.includes(id) && SERIES[u.cls].spells.some((e) => e.id === id));

// 天气条件不满足时的原版提示（research weather.md §5.1）
const WEATHER_NEED = { bad: [isBad, '只能在恶劣天气时使用。'], sun: [(w) => w === SUN, '只能在晴天时使用。'], cloud: [(w) => w === CLOUD, '只能在阴天时使用。'] };
const TIER_NAME = ['一', '二', '三'];

// 策略能否使用（菜单、AI、预测共用）：返回 { ok, reason }
// 依次检查：禁咒 / 混乱、习得等级、宝玉、天气、策略值；ctx.known 为可用策略列表（含遁甲天书借用的），
// ctx.map + ctx.target 时再检查目标所在地形
export function spellUsable(spellId, u, weather, ctx = {}) {
  const sp = SPELLS[spellId];
  const no = (reason) => ({ ok: false, reason });
  if (has(u, 'confuse')) return no(`${u.name}处于混乱状态，无法使用策略`);
  if (has(u, 'silence')) return no(`${u.name}处于禁咒状态，无法使用策略`);
  if (!(ctx.known || knownSpells(u)).includes(spellId)) {
    const e = SERIES[u.cls].spells.find((l) => l.id === spellId);
    return no(e ? `需 ${e.lvl} 级${e.tier > 1 ? `（${TIER_NAME[e.tier - 1]}阶）` : ''}才能使用` : `${classOf(u.cls, u.tier).name}无法使用${sp.name}`);
  }
  if (sp.needGem && !wears(u, sp.needGem)) return no(`需要装备${EQUIP[sp.needGem].name}`);
  if (sp.noBadWeather && isBad(weather)) return no('在恶劣天气时无法使用。');
  if (sp.weather && !WEATHER_NEED[sp.weather][0](weather)) return no(WEATHER_NEED[sp.weather][1]);
  if (u.mp < spellCost(u, spellId)) return no(`策略值不足（需 ${spellCost(u, spellId)}）`);
  if (ctx.map && ctx.target && sp.target === 'foe') {
    const why = spellBlock(ctx.map, spellId, ctx.target.x, ctx.target.y);
    if (why) return no(why);
  }
  return { ok: true, reason: '' };
}

// 谍报吸取的策略值：(L+Δ+1)/2+12，不超过目标现有策略值
export const spellDrainMp = (a, d) => Math.min(d.mp, Math.max(1, Math.round((spellX(a, d) + 1) / 2 + 12)));

// 成功率：对敌策略看双方“精神 + 士气”之差，再乘策略的成功率系数（海啸、晕眩低）；混乱的目标必中；友方策略必中
// 玄武不分敌我，对每个单位都按对敌策略判定（自行设计）
export function spellHit(a, d, spellId) {
  const sp = SPELLS[spellId];
  if ((sp.target !== 'foe' && sp.special !== 'xuanwu') || alwaysHit(d)) return 100;
  const ea = effStats(a), ed = effStats(d);
  // 装备：七星剑提高、白银盾 / 风神盾降低成功率
  const base = clamp(90 + (ea.int + ea.morale - ed.int - ed.morale) * 0.3, 50, 100) + fxSum(a, 'spellHitUp') - fxSum(d, 'spellHitDown');
  return Math.round(clamp(base, 0, 100) * (sp.hitMod || 1));
}

// 回复量（research P3）：小补给 / 援队 40 + 精神 / 10；大补给 / 援军 / 输送 70 + 精神 / 2
export function healAmount(a, spellId) {
  const int = effStats(a).int;
  return Math.round(SPELLS[spellId].heal === 'big' ? 70 + int / 2 : 40 + int / 10);
}

// 玄武的随机效果：四种异常或四种能力下降（降为 70%）之一
export const XUANWU_EFFECTS = [
  ...STATUS_KEYS.map((k) => ({ status: k })),
  ...['power', 'def', 'burst', 'morale'].map((stat) => ({ buff: { stat, mult: 0.7 } })),
];

// 青龙：strikes 次雷击，每次在范围内随机选一个尚未击溃的敌人（目标越多越分散），各自判定成功率；
// 同一目标的多次雷击合并为一个效果（dmg 合计，strikes 为命中次数），res.strikes 记录每次雷击的顺序供特效使用
function resolveThunder(map, a, spellId, victims, res, rng) {
  const sp = SPELLS[spellId];
  const left = new Map(victims.map((v) => [v, v.hp]));
  const eff = new Map();
  res.strikes = [];
  for (let k = 0; k < sp.strikes; k++) {
    const pool = victims.filter((v) => left.get(v) > 0);
    if (!pool.length) break;
    const v = pool[Math.floor(rng() * pool.length)];
    const hit = rng() * 100 < spellHit(a, v, spellId);
    if (!eff.has(v)) eff.set(v, { u: v, hit: false, dmg: 0, strikes: 0 });
    const e = eff.get(v);
    res.strikes.push({ u: v, hit });
    if (!hit) continue;
    const dmg = Math.min(left.get(v), Math.max(1, Math.round(spellDamage(map, a, v, spellId) * (0.9 + rng() * 0.2))));
    left.set(v, left.get(v) - dmg);
    e.hit = true;
    e.dmg += dmg;
    e.strikes += 1;
  }
  res.effects = [...eff.values()];
  return res;
}

// 结算策略（不修改单位）：返回 { caster, spellId, center, effects: [{ u, hit, dmg?, heal?, mp?, mpDrain?, status?, buff?, cure?, again? }], self }
// 随后用 applySpell 写入；actions.js 在两者之间播放特效，Node 模拟脚本直接连用
export function resolveSpell(map, units, a, spellId, t, rng = Math.random) {
  const sp = SPELLS[spellId];
  const res = { caster: a, spellId, center: { x: t.x, y: t.y }, effects: [], self: {} };
  const victims = spellVictims(map, units, a, spellId, t);
  if (sp.special === 'thunder') return resolveThunder(map, a, spellId, victims, res, rng);
  for (const v of victims) {
    const e = { u: v, hit: rng() * 100 < spellHit(a, v, spellId) };
    res.effects.push(e);
    if (!e.hit) continue;
    if (sp.cat === 'damage') {
      const base = spellDamage(map, a, v, spellId);
      e.dmg = Math.min(v.hp, sp.formula === 'kill' ? base : Math.max(1, Math.round(base * (0.9 + rng() * 0.2))));
      if (sp.special === 'drain') res.self.hp = (res.self.hp || 0) + e.dmg;
    }
    if (sp.status) e.status = sp.status === 'random' ? STATUS_KEYS[Math.floor(rng() * STATUS_KEYS.length)] : sp.status;
    if (sp.special === 'drainMp') { e.mpDrain = spellDrainMp(a, v); res.self.mp = (res.self.mp || 0) + e.mpDrain; }
    if (sp.buff) e.buff = sp.buff;
    if (sp.cat === 'heal') e.heal = Math.min(v.stats.hp - v.hp, healAmount(a, spellId));
    if (sp.mpGain) e.mp = Math.min(v.stats.mp - v.mp, sp.mpGain);
    if (sp.cure) e.cure = sp.cure;
    if (sp.special === 'again') e.again = true;
    if (sp.special === 'meditate') { e.dmg = Math.min(v.hp - 1, 50); e.mp = Math.min(v.stats.mp - v.mp, 25); }
    if (sp.special === 'xuanwu') Object.assign(e, XUANWU_EFFECTS[Math.floor(rng() * XUANWU_EFFECTS.length)]);
  }
  return res;
}

// 写入策略结算：扣施策者策略值，依次套用伤害 / 回复 / 异常 / 增减益 / 解除 / 再行动；记录实际解除的异常与作用的能力项
export function applySpell(res) {
  const a = res.caster;
  a.mp = Math.max(0, a.mp - spellCost(a, res.spellId));
  for (const e of res.effects) {
    const v = e.u;
    if (!e.hit) continue;
    if (e.dmg) v.hp = Math.max(0, v.hp - e.dmg);
    if (e.heal) v.hp = Math.min(v.stats.hp, v.hp + e.heal);
    if (e.mp) v.mp = Math.min(v.stats.mp, v.mp + e.mp);
    if (e.mpDrain) v.mp = Math.max(0, v.mp - e.mpDrain);
    if (v.hp <= 0) continue;
    if (e.status) applyStatus(v, e.status);
    if (e.buff) e.buffKeys = applyBuff(v, e.buff);
    if (e.cure) e.cured = cure(v, e.cure);
    if (e.again) v.acted = false;
  }
  // 吸取：施策者按实际回复量记回 res.self（供浮字显示）
  if (a.alive && a.hp > 0) {
    if (res.self.hp) { const h = Math.min(a.stats.hp - a.hp, res.self.hp); a.hp += h; res.self.hp = h; }
    if (res.self.mp) { const m = Math.min(a.stats.mp - a.mp, res.self.mp); a.mp += m; res.self.mp = m; }
  }
}

export function expFor(a, d, killed) {
  return Math.max(2, Math.min(60, 10 + (d.lvl - a.lvl) * 3 + (killed ? 25 : 0)));
}

// 阶段开始时的装备效果：回复兵力（凤凰羽衣 / 青囊书不叠加，取最高）、回复策略值、解除异常；
// 返回 { heal, mp, cured, exp, weapon, armor }，经验类（孙子兵法、六韬、三略）由场景按动画流程发放
export function tickGear(u) {
  const out = { heal: 0, mp: 0, cured: [], exp: fxSum(u, 'expPerTurn'), weapon: fxSum(u, 'weaponExpPerTurn'), armor: fxSum(u, 'armorExpPerTurn') };
  const rate = fxMax(u, 'healEachTurn', 'rate');
  if (rate && u.hp < u.stats.hp) { out.heal = Math.min(u.stats.hp - u.hp, Math.round(u.stats.hp * rate)); u.hp += out.heal; }
  const mp = fxSum(u, 'mpEachTurn');
  if (mp && u.mp < u.stats.mp) { out.mp = Math.min(u.stats.mp - u.mp, mp); u.mp += out.mp; }
  if (fx(u, 'cureEachTurn')) out.cured = cure(u, 'all');
  return out;
}

// ---------- 敌军/友军 AI ----------
function distanceField(map, foes, cls) {
  const field = new Array(KEY_W * mapRows(map)).fill(Infinity);
  // 消耗为 1~3 的小整数：按累计消耗分桶（Dial 算法），40 × 40 地图也只需线性时间
  const buckets = [foes.map((f) => [f.x, f.y])];
  foes.forEach((f) => (field[key(f.x, f.y)] = 0));
  for (let c0 = 0; c0 < buckets.length; c0++) {
    for (const [x, y] of buckets[c0] || []) {
      if (field[key(x, y)] < c0) continue;
      for (const [dx, dy] of RANGES.melee) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny, map)) continue;
        const step = moveCost(cls, map[ny][nx]);
        const c = c0 + step;
        if (step >= IMPASSABLE || c >= field[key(nx, ny)]) continue;
        field[key(nx, ny)] = c;
        (buckets[c] ||= []).push([nx, ny]);
      }
    }
  }
  return field;
}

// 威胁图：每格能被多少个敌人在本回合移动后攻击到（用于受保护单位的 AI 避险）；混乱的敌人不算
function dangerMap(map, units, foes) {
  const field = new Array(KEY_W * mapRows(map)).fill(0);
  for (const f of foes) {
    if (!canAct(f)) continue;
    const hit = new Set();
    for (const t of reachable(map, units, f).values()) for (const a of attackTiles(map, f, t.x, t.y)) hit.add(key(a.x, a.y));
    for (const k of hit) field[k] += 1;
  }
  return field;
}

// 辅助类策略（减益、增益、解除、回复策略值）的计分上限（自行设计）：避免敌人只施放辅助策略而不攻击
export const AUX_CAP = 40;
// 异常策略的计分上限：可略高于辅助类，但低于主力伤害策略
export const STATUS_CAP = 90;
// 异常的价值（按目标威胁估算）：混乱使其一回合无法行动，麻痹只限制移动，中毒按约 3 回合的扣血，禁咒只对会策略的目标有价值
function statusValue(v, key) {
  if (has(v, key)) return 0;
  const st = effStats(v);
  const threat = Math.max(st.atk, knownSpells(v).length ? st.int : 0) * 0.35;
  const lead = v.leader ? 1.3 : 1;
  const val = {
    confuse: threat * 1.5 + 10,
    paralyze: threat * 0.4 + 8,
    poison: Math.min(v.hp - 1, v.stats.hp * 0.1 * 3) * 0.6,
    silence: knownSpells(v).length && v.mp >= 6 ? st.int * 0.35 : 2,
    random: threat * 0.5 + 8,
  }[key];
  return Math.max(0, val) * lead;
}
const nearFoe = (v, foes, r = 6) => foes.some((f) => dist(f, v) <= r);

// 以 c 为中心施放策略的得分（不含站位加成）；不值得施放时返回 0
function spellScore(map, units, u, id, c, foes) {
  const sp = SPELLS[id];
  const victims = spellVictims(map, units, u, id, c);
  let score = 0, aux = 0, stat = 0;
  for (const v of victims) {
    const hit = spellHit(u, v, id) / 100;
    if (sp.cat === 'damage') {
      // 青龙：雷击平均分到范围内各目标
      const d = Math.round(spellDamage(map, u, v, id) * (sp.strikes ? sp.strikes / victims.length : 1));
      const kill = d >= v.hp;
      score += (Math.min(d, v.hp) * (sp.formula === 'kill' ? 0.6 : 0.95) + (kill ? 80 : 0) + (u.focus === v.id ? 300 : 0)) * hit;
      if (sp.status && !kill) stat += statusValue(v, sp.status) * hit;
      if (sp.special === 'drain') score += Math.min(d, u.stats.hp - u.hp) * 0.3 * hit;
    } else if (sp.cat === 'status') stat += statusValue(v, sp.status) * hit;
    else if (sp.special === 'drainMp') aux += (knownSpells(v).length ? spellDrainMp(u, v) : 0) * 0.8 * hit;
    else if (sp.cat === 'debuff') aux += hasBuff(v, sp.buff) || !nearFoe(v, [u], 8) ? 0 : 11 * hit * (v.leader ? 1.5 : 1);
    else if (sp.cat === 'heal') {
      const lost = v.stats.hp - v.hp;
      if (lost >= v.stats.hp * (sp.area ? 0.25 : 0.4)) score += Math.min(lost, healAmount(u, id)) * 0.9 + (v.hp < v.stats.hp * 0.35 ? 20 : 0);
    } else if (sp.cat === 'cure') {
      for (const k of STATUS_KEYS) if (has(v, k)) aux += Math.min(30, statusValue({ ...v, status: {} }, k)) + (v.hp < v.stats.hp * 0.35 ? 10 : 0);
    } else if (sp.cat === 'mp') {
      if (knownSpells(v).length && v.mp < v.stats.mp * 0.3) aux += Math.min(sp.mpGain, v.stats.mp - v.mp) * 0.5;
    } else if (sp.cat === 'buff') {
      if (!hasBuff(v, sp.buff) && nearFoe(v, foes)) aux += (sp.buff.stat === 'all' ? 25 : sp.buff.stat === 'move' ? 6 : 12) + (v.leader ? 4 : 0);
    } else if (sp.special === 'meditate') {
      if (u.mp < u.stats.mp * 0.3 && u.hp > 50 + u.stats.hp * 0.3) aux += 12;
    }
  }
  return score + Math.min(stat, STATUS_CAP) + Math.min(aux, AUX_CAP);
}

// 解除单一异常的道具 id（解毒药、膏药、兴奋剂、止咳药）
const CURE_ITEM = Object.fromEntries(Object.entries(ITEMS).filter(([, it]) => it.cure && it.cure !== 'all').map(([id, it]) => [it.cure, id]));
// 友军用自带补给（u.items）对 v 使用的最佳道具：{ item, score } 或 null（自行设计，量级与 spellScore 的回复 / 解除分支相当）
// 兵力：损失 ≥ 40% 或低于 35% 才用，回复量超出损失的部分扣分（够用时先豆后米）；异常：按异常价值计分，
// 万能药只在多种异常或没有对应单药时用；神秘水 / 酒：会策略且策略值低于 30% 才用；印绶、果子不用
function itemScore(u, v) {
  let best = null;
  const lost = v.stats.hp - v.hp, low = v.hp < v.stats.hp * 0.35;
  const bad = STATUS_KEYS.filter((k) => has(v, k));
  for (const [id, n] of Object.entries(u.items)) {
    const it = ITEMS[id];
    if (!(n > 0) || it.promote || it.fruit) continue;
    let score = 0;
    if ((it.hp || it.full === 'hp') && (lost >= v.stats.hp * 0.4 || low)) {
      const amt = it.hp || lost;
      score = Math.min(lost, amt) * 0.9 - Math.max(0, amt - lost) * 0.3 + (low ? 30 : 0);
    } else if (it.cure) {
      const keys = it.cure === 'all' ? bad : bad.filter((k) => k === it.cure);
      if (it.cure === 'all' && keys.length < 2 && keys.some((k) => u.items[CURE_ITEM[k]] > 0)) continue;
      for (const k of keys) score += Math.min(30, statusValue({ ...v, status: {} }, k)) + (low ? 10 : 0) + (k === 'poison' && low ? 15 : 0);
    } else if ((it.mp || it.full === 'mp') && knownSpells(v).length && v.mp < v.stats.mp * 0.3) {
      score = Math.min(it.mp || v.stats.mp, v.stats.mp - v.mp) * 0.5;
    }
    if (score > 0 && (!best || score > best.score)) best = { item: id, score };
  }
  return best;
}

// AI 可用的策略：已掌握且 spellUsable 通过（禁咒、宝玉、天气、策略值）；回归与天气策略不由 AI 使用
export function castable(u, weather = SUN) {
  if (!canCast(u)) return [];
  return knownSpells(u).filter((id) => SPELLS[id].special !== 'again' && !SPELLS[id].setWeather && spellUsable(id, u, weather).ok);
}

// weather：当前天气（决定火系 / 四神能否使用）
export function planAI(map, units, u, weather = SUN) {
  if (u.ai === 'peace') return null; // 不交战：原地不动、不主动攻击（如华容道放行的关羽）
  if (!canAct(u)) return null; // 混乱：不能行动
  const foes = units.filter((o) => o.alive && isFoe(o, u));
  const friends = units.filter((o) => o.alive && !isFoe(o, u));
  if (!foes.length) return null;
  const tiles = [...reachable(map, units, u).values()];
  const danger = u.guard ? dangerMap(map, units, foes) : null;
  const reach = Math.max(...tiles.map((t) => dist(t, u)));
  // 先按“策略 × 目标”计分（与站位无关），再按站位检查射程
  const plans = [];
  for (const id of castable(u, weather)) {
    const sp = SPELLS[id];
    let centers = sp.target === 'self' ? [u] : sp.target === 'foe' ? foes : friends;
    if (wildOnly(sp)) centers = centers.filter((c) => isWild(map, c.x, c.y)).slice(0, 1);
    for (const c of centers) {
      if (sp.range !== 'map' && c !== u && dist(c, u) > reach + sp.range) continue;
      if (sp.target === 'foe' && spellBlock(map, id, c.x, c.y)) continue;
      const score = spellScore(map, units, u, id, c, foes);
      if (score > 0) plans.push({ id, c, score, range: sp.range });
    }
  }
  // 友军自带补给：先按目标计分；用药的站位偏向靠近敌军的格子（每远一步扣 1 分），避免无仗可打时后撤吃药
  const uses = u.items ? friends.map((v) => ({ v, ...itemScore(u, v) })).filter((p) => p.item && (p.v === u || dist(p.v, u) <= reach + 1)) : [];
  let far = null;
  if (uses.length) {
    const field = distanceField(map, foes, u.cls);
    const steps = (t) => (Number.isFinite(field[key(t.x, t.y)]) ? field[key(t.x, t.y)] : 99);
    const near = Math.min(...tiles.map(steps));
    far = (t) => steps(t) - near;
  }
  let best = null;
  const consider = (score, plan) => { if (!best || score > best.score) best = { score, ...plan }; };
  for (const tile of tiles) {
    // 受保护单位不冒进：每多一个能打到该格的敌人扣 25 分
    const tdef = defAt(map, u, tile.x, tile.y) * 30 - (danger ? danger[key(tile.x, tile.y)] * 25 : 0);
    const self = { ...u, x: tile.x, y: tile.y };
    for (const f of foes) {
      if (!canAttackFrom(u, tile.x, tile.y, f)) continue;
      const d = physDamage(map, u, f);
      const counter = counterOk(self, f) && d < f.hp ? physDamage(map, f, self) : 0;
      const focus = u.focus === f.id ? 300 : 0;
      consider(d + (d >= f.hp ? 80 : 0) + (f.leader ? 15 : 0) + focus - counter * 0.4 + tdef, { tile, type: 'attack', target: f });
    }
    for (const p of plans) {
      if (p.range !== 'map' && p.c !== u && dist(tile, p.c) > p.range) continue;
      consider(p.score + tdef, { tile, type: 'spell', spell: p.id, target: p.c });
    }
    for (const p of uses) {
      if (p.v !== u && dist(tile, p.v) !== 1) continue;
      consider(p.score + tdef - far(tile), { tile, type: 'item', item: p.item, target: p.v });
    }
  }
  if (best) return best;
  if (u.ai !== 'aggressive') return null;
  const field = distanceField(map, foes, u.cls);
  let tile = null;
  for (const t of tiles) if (!tile || field[key(t.x, t.y)] < field[key(tile.x, tile.y)]) tile = t;
  return tile && (tile.x !== u.x || tile.y !== u.y) ? { tile, type: 'wait' } : null;
}
