// 出阵推导：根据关卡预设我军、武将总表与战役状态，推导出阵位置、上限、必须出阵 / 不可出阵与候选名单
// 纯函数，不依赖 Phaser（Node 可直接导入）
import { passable } from './data.js';
import { roleOf, tierFor } from './logic.js';
import { GENERALS, isGeneral, isRecruit, generalOf } from './generals.js';
import { getStage } from './stages.js';
import { SHOP_UNLOCK } from './equipment.js';

const flagOk = (d, flags) => (!d.ifFlag || flags[d.ifFlag]) && (!d.unlessFlag || !flags[d.unlessFlag]);
const nextIds = (n) => (!n ? [] : typeof n === 'string' ? [n] : Object.entries(n).flatMap(([k, v]) => (k === 'route' ? Object.values(v) : [v])));

// 从 from 关沿 next 能否走到 to 关（含 from 本身）
function reaches(from, to) {
  const seen = new Set();
  const q = [from];
  while (q.length) {
    const id = q.shift();
    if (id === to) return true;
    if (seen.has(id) || !getStage(id)) continue;
    seen.add(id);
    q.push(...nextIds(getStage(id).next));
  }
  return false;
}

// joinAt 指定的关卡（分路线时任一路线）已到达或已经过
const joinReached = (g, stageId) => {
  if (!g.joinAt) return false;
  const at = typeof g.joinAt === 'string' ? [g.joinAt] : Object.values(g.joinAt);
  return at.some((id) => reaches(id, stageId));
};

// 关卡中与我军武将相关、因而必须出阵的单位 id（胜负条件、撤离、事件、对白发言人）
function storyIds(stage, presetOk, flags) {
  const ids = new Set();
  for (const c of stage.victory) {
    if (c.type === 'boss') ids.add(c.target);
    if (c.type === 'reach' && c.unit !== 'any') ids.add(c.unit);
  }
  (stage.protect || []).forEach((id) => ids.add(id));
  (stage.escape?.units || []).forEach((id) => ids.add(id));
  (stage.victoryFlags || []).forEach((r) => ids.add(r.unit));
  for (const ev of stage.events) {
    if (ev.duel) { ids.add(ev.duel.a); ids.add(ev.duel.b); }
    if (ev.onDeath) ids.add(ev.onDeath);
    Object.keys(ev.setAi || {}).forEach((id) => ids.add(id));
  }
  // 对白中我方发言的武将（按名字对应到预设我军单位）
  const byName = new Map(presetOk.map((d) => [d.name, d.id]));
  const scan = (lines) => (lines || []).forEach((l) => {
    if (!flagOk(l, flags)) return;
    if (l.side === 'player' && byName.has(l.who)) ids.add(byName.get(l.who));
    (l.choices || []).forEach((c) => scan(c.reply));
  });
  [stage.prologue, stage.epilogue, ...Object.values(stage.epilogues || {}), ...stage.events.flatMap((e) => [e.dialog, e.after])].forEach(scan);
  return ids;
}

export function planDeploy(stage, { roster = {}, joined = [], flags = {} } = {}) {
  const preset = stage.units.filter((d) => d.faction === 'player');
  const presetOk = preset.filter((d) => flagOk(d, flags));
  const defsById = Object.fromEntries(presetOk.map((d) => [d.id, d]));
  const fixed = presetOk.filter((d) => !isGeneral(d.id));

  // 不可出阵：已阵亡 / 离队、被剧情标记排除的预设武将、本关事件中途生成（或作为敌军 / 友军登场）的武将
  const blocked = new Set();
  for (const [id, g] of Object.entries(GENERALS)) if (g.gone && flags[g.gone]) blocked.add(id);
  for (const d of preset) if (isGeneral(d.id) && !defsById[d.id]) blocked.add(d.id);
  for (const u of [...stage.units, ...stage.events.flatMap((e) => e.units || [])]) {
    if (isGeneral(u.id) && !defsById[u.id]) blocked.add(u.id);
  }

  const presetGenerals = presetOk.filter((d) => isGeneral(d.id) && !blocked.has(d.id)).map((d) => d.id);
  const allJoined = new Set([...joined.filter(isGeneral), ...presetGenerals]);
  for (const [id, g] of Object.entries(GENERALS)) if (joinReached(g, stage.id)) allJoined.add(id);

  const lord = defsById.caocao;
  const notPreset = (id) => allJoined.has(id) && !blocked.has(id) && !defsById[id];
  // 候选：预设武将 → 总表中已加入的武将 → 招募单位（按招募先后）
  const poolIds = [...presetGenerals, ...Object.keys(GENERALS).filter(notPreset), ...[...allJoined].filter((id) => isRecruit(id) && notPreset(id))];
  const pool = poolIds.map((id) => {
    const def = defsById[id], saved = roster[id], g = generalOf(id);
    const floor = def ? def.lvl : Math.max(1, lord.lvl - 1);
    const lvl = Math.max(floor, saved?.lvl || 0);
    // 兵种、个人修正与加成以武将总表为准；阶级同 createUnit（roster 记录，首次出阵按等级定阶）
    return {
      id,
      name: def?.name || g.name,
      cls: g.cls,
      gradeMod: g.gradeMod || null,
      tier: saved?.lvl ? saved.tier || 1 : tierFor(g.cls, lvl),
      floor,
      lvl,
      bonus: g.bonus,
      preset: !!def,
    };
  });

  const ov = stage.deploy || {};
  const required = new Set(['caocao']);
  const reqSrc = ov.required || [...storyIds(stage, presetOk, flags)];
  for (const id of reqSrc) if (poolIds.includes(id)) required.add(id);

  const seen = new Set();
  const slots = (ov.slots || preset.map((d) => [d.x, d.y])).filter(([x, y]) => !seen.has(`${x},${y}`) && seen.add(`${x},${y}`));
  const max = Math.min(ov.max ?? slots.length, slots.length);
  const room = max - fixed.length;
  // 默认阵容 = 预设阵容（超出上限时先去掉非必须出阵的武将）
  const defaults = [...presetGenerals, ...[...required].filter((id) => !presetGenerals.includes(id))];
  while (defaults.length > room) {
    const i = defaults.findLastIndex((id) => !required.has(id));
    if (i < 0) break;
    defaults.splice(i, 1);
  }

  // 临时成员的展示信息（整备界面锁定显示）
  const fixedCards = fixed.map((d) => {
    const { cls, bonus } = roleOf(d);
    const saved = roster[d.id], lvl = Math.max(d.lvl, saved?.lvl || 0);
    return { id: d.id, name: d.name, cls, bonus, lvl, tier: saved?.lvl ? saved.tier || 1 : tierFor(cls, lvl), fixed: true };
  });
  return { stageId: stage.id, map: stage.map, slots, max, required, blocked, pool, fixed, fixedCards, defaults, defsById, joined: [...allJoined] };
}

// 商店货架：本关及之前（沿关卡衔接能走到本关）上架过的商品，按上架先后去重
export function shopStock(stageId) {
  const out = [];
  for (const [at, goods] of Object.entries(SHOP_UNLOCK)) {
    if (reaches(at, stageId)) goods.forEach((id) => out.includes(id) || out.push(id));
  }
  return out;
}

// 整备的初始阵容：沿用之前（营中整备）选好的武将——必须出阵的武将一定在内，其余只保留本关候选中的，不超过人数上限
export function initialDeploy(plan, ids) {
  const poolIds = new Set(plan.pool.map((c) => c.id));
  const room = plan.max - plan.fixed.length;
  const out = [...plan.required].filter((id) => poolIds.has(id));
  for (const id of ids || []) if (poolIds.has(id) && !out.includes(id) && out.length < room) out.push(id);
  return out;
}

// 按选择生成我军单位定义（与关卡 P(...) 结构一致）：临时成员与预设武将站原位，其余依次填入空出的位置
export function buildPlayerDefs(plan, selectedIds) {
  const used = new Set();
  const k = (x, y) => `${x},${y}`;
  const inSlots = (x, y) => plan.slots.some(([sx, sy]) => sx === x && sy === y);
  const defs = [];
  const rest = [];
  for (const d of plan.fixed) { defs.push(d); used.add(k(d.x, d.y)); }
  for (const id of selectedIds) {
    const d = plan.defsById[id];
    if (d && inSlots(d.x, d.y) && !used.has(k(d.x, d.y))) { defs.push(d); used.add(k(d.x, d.y)); }
    else rest.push(id);
  }
  for (const id of rest) {
    const p = plan.pool.find((o) => o.id === id);
    const free = plan.slots.filter(([x, y]) => !used.has(k(x, y)));
    const slot = free.find(([x, y]) => passable(p.cls, plan.map[y][x])) || free[0];
    if (!slot) continue;
    used.add(k(slot[0], slot[1]));
    const g = generalOf(id);
    const base = plan.defsById[id] || { id, name: p.name, faction: 'player', bonus: p.bonus, ...(g?.mark && { mark: g.mark }) };
    defs.push({ ...base, cls: p.cls, lvl: p.floor, x: slot[0], y: slot[1] });
  }
  // 按站位顺序排列（默认阵容时与关卡预设顺序一致）
  const order = (d) => plan.slots.findIndex(([x, y]) => x === d.x && y === d.y);
  return defs.sort((a, b) => order(a) - order(b));
}
