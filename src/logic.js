import { COLS, ROWS } from './config.js';
import { TERRAIN, RANGES, ADVANTAGE, SPELLS, SERIES, GRADE, STAT5, PROMOTE_LVL, classOf } from './data.js';
import { GENERALS, isGeneral } from './generals.js';
import { CLASS_BY_NAME } from './characters.js';

export const key = (x, y) => y * COLS + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
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

// 能力：u 需含 cls / tier / lvl，可选 bonus / mult / gradeMod
// HP/MP = 系列基础 + 每级成长 × (等级 + 2 × 已转职次数) + 武将加成（原版公式）；mult 为难度倍率
// 五项 = BASE5 + 成长档 × 等级 + 加成（关卡数据中的 bonus.agi 视为爆发）
export function calcStats(u) {
  const sr = SERIES[u.cls];
  const tier = Math.min(u.tier || 1, sr.tiers.length);
  const b = u.bonus || {}, m = u.mult || {};
  const lv = u.lvl + 2 * (tier - 1);
  const s = {
    hp: Math.round((sr.hp[0] + sr.hp[1] * lv) * (m.hp || 1) + (b.hp || 0)),
    mp: Math.max(0, Math.round(sr.mp[0] + sr.mp[1] * lv + (b.mp || 0))),
  };
  for (const k of STAT5) {
    const add = k === 'burst' ? b.burst ?? b.agi ?? 0 : b[k] || 0;
    s[k] = Math.round((BASE5 + GRADE[u.gradeMod?.[k] || sr.grow[k]] * u.lvl) * (m[k] || 1) + add);
  }
  return s;
}

// diff：难度配置，只作用于敌军
// 阶级：我军沿用 roster 记录（旧存档缺省为一阶），首次出阵的我军按 15/30 定阶，敌军 / 友军按难度门槛定阶
export function createUnit(def, saved, diff) {
  const hard = def.faction === 'enemy' && diff;
  const lvl = Math.max(def.lvl, saved?.lvl || 0) + (hard ? diff.lvl : 0);
  let ai = def.ai || 'aggressive';
  if (hard && diff.aggressive && !def.leader && ai === 'hold') ai = 'aggressive';
  const role = roleOf(def);
  const u = {
    ...def,
    ...role,
    lvl,
    tier: saved ? Math.min(saved.tier || 1, SERIES[role.cls].tiers.length)
      : tierFor(role.cls, lvl, def.faction === 'player' ? PROMOTE_LVL : gateOf(diff)),
    exp: saved?.exp || 0,
    ai,
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
  const u = { ...saved, ...roleOf(saved) };
  u.tier = Math.min(saved.tier || (u.faction === 'player' ? 1 : tierFor(u.cls, u.lvl, gateOf(diff))), SERIES[u.cls].tiers.length);
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

// 转职：升一阶、重算能力、兵力与策略值回满；返回能力差值与新习得的策略（策略按阶级习得的接口）
export function promote(u) {
  const old = u.stats;
  const oldSpells = classOf(u.cls, u.tier).spells;
  u.tier += 1;
  u.stats = calcStats(u);
  u.hp = u.stats.hp;
  u.mp = u.stats.mp;
  const diff = {};
  for (const k of Object.keys(old)) diff[k] = u.stats[k] - old[k];
  const learned = classOf(u.cls, u.tier).spells.filter((sp) => !oldSpells.includes(sp));
  return { diff, learned };
}

export function terrainAt(map, x, y) {
  return TERRAIN[map[y][x]];
}

// Dijkstra 计算可移动范围；敌对单位阻挡，友方可穿过但不可停留
export function reachable(map, units, u) {
  const cls = classOf(u.cls, u.tier);
  const occ = new Map();
  for (const o of units) if (o.alive) occ.set(key(o.x, o.y), o);
  const best = new Map([[key(u.x, u.y), { x: u.x, y: u.y, cost: 0, prev: null }]]);
  const open = [best.get(key(u.x, u.y))];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    for (const [dx, dy] of RANGES.melee) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inMap(nx, ny)) continue;
      const o = occ.get(key(nx, ny));
      if (o && isFoe(o, u)) continue;
      const c = cur.cost + terrainAt(map, nx, ny).cost[cls.moveType];
      if (c > cls.move) continue;
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

export function attackOffsets(u) {
  return RANGES[classOf(u.cls, u.tier).range];
}

export function canAttackFrom(u, x, y, target) {
  return attackOffsets(u).some(([dx, dy]) => x + dx === target.x && y + dy === target.y);
}

export function attackTiles(u, x = u.x, y = u.y) {
  return attackOffsets(u).map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((p) => inMap(p.x, p.y));
}

export function spellTiles(u, spellId, x = u.x, y = u.y) {
  const r = SPELLS[spellId].range;
  const out = [];
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= r && inMap(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
  return out;
}

// ---------- 战斗计算 ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 主将（曹操）与关卡 protect 单位（u.guard）受到的伤害倍率（自行设计）：
// 原版三阶射程（连弩 2~4、霹雳车 4~5、步兵周围 8 格）让能打到主将的敌人成倍增加，而关卡站位按旧射程设计
export const GUARD_TAKEN = 0.7;
const taken = (d) => (d.guard ? GUARD_TAKEN : 1);

export function affinity(a, d) {
  const ta = classOf(a.cls, a.tier).type, td = classOf(d.cls, d.tier).type;
  if (ADVANTAGE[ta] === td) return 1.2;
  if (ADVANTAGE[td] === ta) return 0.85;
  return 1;
}

// 物理：攻击对防御；命中看双方爆发之差，会心看双方士气之差（系数自行设计，量级与旧公式接近）
export function physDamage(map, a, d) {
  const t = terrainAt(map, d.x, d.y);
  const base = (a.stats.atk - d.stats.def * 0.5) * 0.75;
  const lvl = 1 + (a.lvl - d.lvl) * 0.03;
  return Math.max(5, Math.round(base * lvl * affinity(a, d) * (1 - t.def) * taken(d)));
}

export function hitRate(map, a, d) {
  const t = terrainAt(map, d.x, d.y);
  return Math.round(clamp(92 + (a.stats.burst - d.stats.burst) * 0.8 - t.def * 40, 55, 100));
}

export const critRate = (a, d) => Math.round(clamp(4 + (a.stats.morale - d.stats.morale) * 0.3, 2, 25));

export function rollAttack(map, a, d) {
  const hit = Math.random() * 100 < hitRate(map, a, d);
  const crit = hit && Math.random() * 100 < critRate(a, d);
  const dmg = hit ? Math.round(physDamage(map, a, d) * (0.9 + Math.random() * 0.2) * (crit ? 1.5 : 1)) : 0;
  return { hit, crit, dmg };
}

// 策略：精神对精神；成功率看双方“精神 + 士气”之差（具体公式由策略子任务细化）
export function spellDamage(map, a, d, spellId) {
  const sp = SPELLS[spellId];
  const t = terrainAt(map, d.x, d.y);
  const fire = spellId === 'fire' ? t.fire || 1 : 1;
  const base = (a.stats.int - d.stats.int * 0.5) * 0.65 + 14;
  return Math.max(5, Math.round(base * sp.power * fire * (1 - t.def * 0.5) * taken(d)));
}

export const spellHit = (a, d) => Math.round(clamp(90 + (a.stats.int + a.stats.morale - d.stats.int - d.stats.morale) * 0.3, 50, 100));
export const healAmount = (a, spellId = 'heal') => Math.round((a.stats.int * 0.5 + 16) * SPELLS[spellId].power);

export function expFor(a, d, killed) {
  return Math.max(2, Math.min(60, 10 + (d.lvl - a.lvl) * 3 + (killed ? 25 : 0)));
}

// ---------- 敌军/友军 AI ----------
function distanceField(map, foes, moveType) {
  const field = new Array(COLS * ROWS).fill(Infinity);
  const open = foes.map((f) => ({ x: f.x, y: f.y, c: 0 }));
  open.forEach((n) => (field[key(n.x, n.y)] = 0));
  while (open.length) {
    open.sort((a, b) => a.c - b.c);
    const cur = open.shift();
    for (const [dx, dy] of RANGES.melee) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (!inMap(nx, ny)) continue;
      const c = cur.c + terrainAt(map, nx, ny).cost[moveType];
      if (c >= 99 || c >= field[key(nx, ny)]) continue;
      field[key(nx, ny)] = c;
      open.push({ x: nx, y: ny, c });
    }
  }
  return field;
}

// 威胁图：每格能被多少个敌人在本回合移动后攻击到（用于受保护单位的 AI 避险）
function dangerMap(map, units, foes) {
  const field = new Array(COLS * ROWS).fill(0);
  for (const f of foes) {
    const hit = new Set();
    for (const t of reachable(map, units, f).values()) for (const a of attackTiles(f, t.x, t.y)) hit.add(key(a.x, a.y));
    for (const k of hit) field[k] += 1;
  }
  return field;
}

export function planAI(map, units, u) {
  if (u.ai === 'peace') return null; // 不交战：原地不动、不主动攻击（如华容道放行的关羽）
  const foes = units.filter((o) => o.alive && isFoe(o, u));
  const friends = units.filter((o) => o.alive && !isFoe(o, u));
  if (!foes.length) return null;
  const tiles = [...reachable(map, units, u).values()];
  const danger = u.guard ? dangerMap(map, units, foes) : null;
  const spells = classOf(u.cls, u.tier).spells.filter((s) => u.mp >= SPELLS[s].mp);
  let best = null;
  const consider = (score, plan) => { if (!best || score > best.score) best = { score, ...plan }; };
  for (const tile of tiles) {
    // 受保护单位不冒进：每多一个能打到该格的敌人扣 25 分
    const tdef = terrainAt(map, tile.x, tile.y).def * 30 - (danger ? danger[key(tile.x, tile.y)] * 25 : 0);
    const self = { ...u, x: tile.x, y: tile.y };
    for (const f of foes) {
      if (canAttackFrom(u, tile.x, tile.y, f)) {
        const d = physDamage(map, u, f);
        const counter = canAttackFrom(f, f.x, f.y, self) && d < f.hp ? physDamage(map, f, self) : 0;
        const focus = u.focus === f.id ? 300 : 0;
        consider(d + (d >= f.hp ? 80 : 0) + (f.leader ? 15 : 0) + focus - counter * 0.4 + tdef, { tile, type: 'attack', target: f });
      }
      for (const s of spells) {
        if (SPELLS[s].kind !== 'damage' || dist(tile, f) > SPELLS[s].range) continue;
        const d = spellDamage(map, u, f, s);
        consider(d * 0.95 + (d >= f.hp ? 80 : 0) + tdef, { tile, type: 'spell', spell: s, target: f });
      }
    }
    for (const s of spells) {
      if (SPELLS[s].kind !== 'heal') continue;
      for (const fr of friends) {
        const lost = fr.stats.hp - fr.hp;
        if (lost < fr.stats.hp * 0.4 || dist(tile, fr.x === u.x && fr.y === u.y ? tile : fr) > SPELLS[s].range) continue;
        consider(Math.min(lost, healAmount(u, s)) * 0.9 + tdef, { tile, type: 'spell', spell: s, target: fr });
      }
    }
  }
  if (best) return best;
  if (u.ai !== 'aggressive') return null;
  const field = distanceField(map, foes, classOf(u.cls, u.tier).moveType);
  let tile = null;
  for (const t of tiles) if (!tile || field[key(t.x, t.y)] < field[key(tile.x, tile.y)]) tile = t;
  return tile && (tile.x !== u.x || tile.y !== u.y) ? { tile, type: 'wait' } : null;
}
