import { COLS, ROWS } from './config.js';
import { TERRAIN, CLASSES, RANGES, ADVANTAGE, SPELLS } from './data.js';

export const key = (x, y) => y * COLS + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const isFoe = (a, b) => (a.faction === 'enemy') !== (b.faction === 'enemy');

export function calcStats(cls, lvl, bonus = {}, mult = null) {
  const c = CLASSES[cls];
  const s = {};
  for (const k of Object.keys(c.base)) {
    s[k] = Math.round((c.base[k] + c.grow[k] * (lvl - 1)) * (mult?.[k] || 1) + (bonus[k] || 0));
  }
  return s;
}

// diff：难度配置，只作用于敌军
export function createUnit(def, saved, diff) {
  const hard = def.faction === 'enemy' && diff;
  const lvl = Math.max(def.lvl, saved?.lvl || 0) + (hard ? diff.lvl : 0);
  let ai = def.ai || 'aggressive';
  if (hard && diff.aggressive && !def.leader && ai === 'hold') ai = 'aggressive';
  const u = {
    ...def,
    lvl,
    exp: saved?.exp || 0,
    ai,
    mult: hard ? diff.mult : null,
    acted: false,
    moved: false,
    alive: true,
  };
  u.stats = calcStats(u.cls, lvl, def.bonus, u.mult);
  u.hp = u.stats.hp;
  u.mp = u.stats.mp;
  return u;
}

// 升级：返回成长差值
export function levelUp(u) {
  const old = u.stats;
  u.lvl += 1;
  u.stats = calcStats(u.cls, u.lvl, u.bonus, u.mult);
  const diff = {};
  for (const k of Object.keys(old)) diff[k] = u.stats[k] - old[k];
  u.hp = Math.min(u.stats.hp, u.hp + diff.hp);
  u.mp = Math.min(u.stats.mp, u.mp + diff.mp);
  return diff;
}

export function terrainAt(map, x, y) {
  return TERRAIN[map[y][x]];
}

// Dijkstra 计算可移动范围；敌对单位阻挡，友方可穿过但不可停留
export function reachable(map, units, u) {
  const cls = CLASSES[u.cls];
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
  return RANGES[CLASSES[u.cls].range];
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

export function affinity(a, d) {
  const ta = CLASSES[a.cls].type, td = CLASSES[d.cls].type;
  if (ADVANTAGE[ta] === td) return 1.2;
  if (ADVANTAGE[td] === ta) return 0.85;
  return 1;
}

export function physDamage(map, a, d) {
  const t = terrainAt(map, d.x, d.y);
  const base = a.stats.atk - d.stats.def * 0.5;
  const lvl = 1 + (a.lvl - d.lvl) * 0.03;
  return Math.max(5, Math.round(base * lvl * affinity(a, d) * (1 - t.def)));
}

export function hitRate(map, a, d) {
  const t = terrainAt(map, d.x, d.y);
  return Math.round(clamp(92 + (a.stats.agi - d.stats.agi) * 0.8 - t.def * 40, 55, 100));
}

export const critRate = (a, d) => Math.round(clamp(4 + (a.stats.agi - d.stats.agi) * 0.3, 2, 25));

export function rollAttack(map, a, d) {
  const hit = Math.random() * 100 < hitRate(map, a, d);
  const crit = hit && Math.random() * 100 < critRate(a, d);
  const dmg = hit ? Math.round(physDamage(map, a, d) * (0.9 + Math.random() * 0.2) * (crit ? 1.5 : 1)) : 0;
  return { hit, crit, dmg };
}

export function spellDamage(map, a, d, spellId) {
  const sp = SPELLS[spellId];
  const t = terrainAt(map, d.x, d.y);
  const fire = spellId === 'fire' ? t.fire || 1 : 1;
  const base = a.stats.int * 0.62 - d.stats.int * 0.25 + 12;
  return Math.max(5, Math.round(base * sp.power * fire * (1 - t.def * 0.5)));
}

export const spellHit = (a, d) => Math.round(clamp(90 + (a.stats.int - d.stats.int) * 0.5, 50, 100));
export const healAmount = (a) => Math.round(a.stats.int * 0.6 + 20);

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

export function planAI(map, units, u) {
  const foes = units.filter((o) => o.alive && isFoe(o, u));
  const friends = units.filter((o) => o.alive && !isFoe(o, u));
  if (!foes.length) return null;
  const tiles = [...reachable(map, units, u).values()];
  const spells = CLASSES[u.cls].spells.filter((s) => u.mp >= SPELLS[s].mp);
  let best = null;
  const consider = (score, plan) => { if (!best || score > best.score) best = { score, ...plan }; };
  for (const tile of tiles) {
    const tdef = terrainAt(map, tile.x, tile.y).def * 30;
    const self = { ...u, x: tile.x, y: tile.y };
    for (const f of foes) {
      if (canAttackFrom(u, tile.x, tile.y, f)) {
        const d = physDamage(map, u, f);
        const counter = canAttackFrom(f, f.x, f.y, self) && d < f.hp ? physDamage(map, f, self) : 0;
        consider(d + (d >= f.hp ? 80 : 0) + (f.leader ? 15 : 0) - counter * 0.4 + tdef, { tile, type: 'attack', target: f });
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
        consider(Math.min(lost, healAmount(u)) * 0.9 + tdef, { tile, type: 'spell', spell: s, target: fr });
      }
    }
  }
  if (best) return best;
  if (u.ai !== 'aggressive') return null;
  const field = distanceField(map, foes, CLASSES[u.cls].moveType);
  let tile = null;
  for (const t of tiles) if (!tile || field[key(t.x, t.y)] < field[key(tile.x, tile.y)]) tile = t;
  return tile && (tile.x !== u.x || tile.y !== u.y) ? { tile, type: 'wait' } : null;
}
