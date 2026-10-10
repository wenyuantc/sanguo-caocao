// 关卡数据校验：node scripts/validate-stages.mjs [分组字母...]
// 不带参数校验全部关卡；带参数（如 a c）只校验对应的 src/stages/<组>.js
// 检查地图尺寸/字符、单位站位与地形、胜利条件、事件、对白、关卡衔接与可达性
import { normalizeStage, PLANNED_IDS, ENDINGS, FIRST_STAGE } from '../src/stageMeta.js';

const groups = process.argv.slice(2);
const STAGES = groups.length
  ? (await Promise.all(groups.map((g) => import(`../src/stages/${g}.js`)))).flatMap((m) => m.default).map(normalizeStage)
  : (await import('../src/stages.js')).STAGES;
const getStage = (id) => STAGES.find((s) => s.id === id);
import { TERRAIN, SERIES, RANGES, classOf } from '../src/data.js';
import { CHARACTERS, CLASS_BY_NAME } from '../src/characters.js';
import { GENERALS } from '../src/generals.js';
import { roleOf } from '../src/logic.js';
import { planDeploy, buildPlayerDefs } from '../src/deploy.js';

const COLS = 18, ROWS = 13;
const errors = [], warns = [];
const err = (s, m) => errors.push(`[${s.id}] ${m}`);
const warn = (s, m) => warns.push(`[${s.id}] ${m}`);
const GENERIC = /兵|军|贼|术士|伏兵|守将|部将|将领|士兵|骑|营|旁白|斥候|使者|百姓|侍从|亲卫|船|车|众/;
const ids = new Set();

for (const s of STAGES) {
  if (ids.has(s.id)) err(s, 'id 重复');
  ids.add(s.id);
  for (const f of ['id', 'name', 'chapter', 'turns', 'victoryText', 'map', 'units', 'prologue']) if (s[f] == null) err(s, `缺少字段 ${f}`);
  // 地图
  if (!Array.isArray(s.map) || s.map.length !== ROWS) err(s, `地图行数应为 ${ROWS}，实际 ${s.map?.length}`);
  s.map?.forEach((row, y) => {
    if (row.length !== COLS) err(s, `地图第 ${y} 行长度 ${row.length}（应为 ${COLS}）：${row}`);
    for (const ch of row) if (!TERRAIN[ch]) err(s, `地图第 ${y} 行含未知地形字符 '${ch}'`);
  });
  const terr = (x, y) => TERRAIN[s.map[y]?.[x]];
  // 单位
  const all = [...s.units, ...s.events.flatMap((e) => e.units || [])];
  const unitIds = new Set();
  const occ = new Map();
  for (const u of all) {
    const fromEvent = !s.units.includes(u);
    if (!u.id || !u.name) { err(s, `单位缺少 id/name：${JSON.stringify(u)}`); continue; }
    if (unitIds.has(u.id)) err(s, `单位 id 重复：${u.id}`);
    unitIds.add(u.id);
    // 关卡中的兵种必须是 SERIES 的 key；实际兵种按武将总表 / 兵种登记表覆盖后检查站位
    if (!SERIES[u.cls]) { err(s, `${u.name}(${u.id}) 兵种不存在：${u.cls}`); continue; }
    const real = roleOf(u).cls;
    const cls = SERIES[real] && classOf(real);
    if (!cls) { err(s, `${u.name}(${u.id}) 覆盖后的兵种不存在：${real}`); continue; }
    if (!['player', 'enemy', 'ally'].includes(u.faction)) err(s, `${u.id} 阵营错误`);
    if (!(u.x >= 0 && u.x < COLS && u.y >= 0 && u.y < ROWS)) { err(s, `${u.name}(${u.id}) 坐标越界 (${u.x},${u.y})`); continue; }
    const t = terr(u.x, u.y);
    if (t && t.cost[cls.moveType] >= 99) err(s, `${u.name}(${u.id}) [${cls.name}] 站在不可通行地形 ${t.name} (${u.x},${u.y})`);
    if (!fromEvent && !u.ifFlag) {
      const k = `${u.x},${u.y}`;
      if (occ.has(k)) err(s, `${u.name} 与 ${occ.get(k)} 站位重叠 (${k})`);
      occ.set(k, u.name);
    }
    if (typeof u.lvl !== 'number' || u.lvl < 1) err(s, `${u.id} 等级无效`);
    if (u.ai && !['aggressive', 'hold', 'peace'].includes(u.ai)) err(s, `${u.id} ai 只能是 aggressive/hold/peace`);
  }
  const player = s.units.filter((u) => u.faction === 'player');
  if (!player.some((u) => u.id === 'caocao')) err(s, '我军必须包含 caocao');
  if (player.length < 3 || player.length > 12) warn(s, `我军出阵 ${player.length} 人`);
  const enemies = all.filter((u) => u.faction === 'enemy').length;
  if (enemies < 5 || enemies > 26) warn(s, `敌军共 ${enemies} 人`);
  // 胜利条件
  const conds = s.victory;
  if (!conds.length) err(s, '没有胜利条件');
  for (const c of conds) {
    if (!['boss', 'all', 'reach', 'survive'].includes(c.type)) err(s, `未知胜利条件 ${c.type}`);
    if (c.type === 'boss' && !all.some((u) => u.id === c.target)) err(s, `boss 目标不存在：${c.target}`);
    if (c.type === 'reach') {
      if (c.unit !== 'any' && !player.some((u) => u.id === c.unit)) err(s, `reach 单位不存在：${c.unit}`);
      for (const [x, y] of c.tiles || []) if (!terr(x, y) || terr(x, y).cost.foot >= 99) err(s, `reach 目标格不可达 (${x},${y})`);
    }
    if (c.type === 'survive' && !(c.turns < s.turns)) err(s, 'survive 回合数应小于 turns');
  }
  for (const id of s.protect || []) if (!all.some((u) => u.id === id)) err(s, `protect 单位不存在：${id}`);
  if (s.escape) {
    for (const id of s.escape.units || []) if (!player.some((u) => u.id === id)) err(s, `escape 单位不存在：${id}`);
    for (const [x, y] of s.escape.tiles || []) if (!terr(x, y) || terr(x, y).cost.foot >= 99) err(s, `escape 撤离点不可达 (${x},${y})`);
  }
  for (const r of s.victoryFlags || []) {
    if (!all.some((u) => u.id === r.unit)) err(s, `victoryFlags 单位不存在：${r.unit}`);
    if (typeof r.alive !== 'boolean' || !r.flag) err(s, 'victoryFlags 需要 { unit, alive: true|false, flag }');
  }
  // 出阵覆盖（可选）：deploy: { max, required: [id], slots: [[x,y]] }
  if (s.deploy) {
    const d = s.deploy;
    const slots = d.slots || player.map((u) => [u.x, u.y]);
    if (d.slots) {
      const seen = new Set();
      for (const [x, y] of d.slots) {
        const k = `${x},${y}`, t = terr(x, y);
        if (!t || t.cost.foot >= 99) err(s, `deploy.slots 出阵位置不可通行 (${k})`);
        if (seen.has(k)) err(s, `deploy.slots 出阵位置重复 (${k})`);
        seen.add(k);
        const o = s.units.find((u) => u.faction !== 'player' && !u.ifFlag && u.x === x && u.y === y);
        if (o) err(s, `deploy.slots 出阵位置与 ${o.name} 重叠 (${k})`);
      }
    }
    if (d.max != null && !(Number.isInteger(d.max) && d.max >= 1 && d.max <= slots.length)) err(s, `deploy.max 应为 1~${slots.length} 的整数`);
    for (const id of d.required || []) if (!player.some((u) => u.id === id)) err(s, `deploy.required 不是本关预设我军单位：${id}`);
    if (new Set(['caocao', ...(d.required || [])]).size > (d.max ?? slots.length)) err(s, 'deploy.required 人数超过出阵上限');
  }
  // 出阵推导：必须出阵人数不超过上限，默认阵容与预设我军一致
  if (player.some((u) => u.id === 'caocao')) {
    const plan = planDeploy(s);
    if (plan.fixed.length + plan.required.size > plan.max) err(s, `必须出阵 ${plan.fixed.length + plan.required.size} 人，超过出阵上限 ${plan.max}`);
    const defs = buildPlayerDefs(plan, plan.defaults);
    const base = player.filter((u) => !u.ifFlag);
    if (!s.deploy && (defs.length !== base.length || defs.some((d, i) => d !== base[i]))) err(s, '默认出阵阵容与预设我军不一致');
  }
  // 事件
  for (const e of s.events) {
    const kinds = [e.turn != null, e.onDeath != null, e.duel != null].filter(Boolean).length;
    if (kinds !== 1) err(s, `事件需且仅需 turn / onDeath / duel 之一：${JSON.stringify(e).slice(0, 80)}`);
    if (e.onDeath && !all.some((u) => u.id === e.onDeath)) err(s, `onDeath 单位不存在：${e.onDeath}`);
    if (e.duel) {
      for (const k of ['a', 'b']) if (!all.some((u) => u.id === e.duel[k])) err(s, `duel.${k} 单位不存在：${e.duel[k]}`);
      if (e.units?.length) err(s, 'duel 事件不能带 units');
      if (e.duel.result && !['kill', 'hurt', 'draw'].includes(e.duel.result)) err(s, `duel.result 只能是 kill/hurt/draw：${e.duel.result}`);
    }
    if (e.turn != null && e.turn > s.turns) warn(s, `事件回合 ${e.turn} 超过时限`);
    for (const id of Object.keys(e.setAi || {})) if (!all.some((u) => u.id === id)) err(s, `setAi 单位不存在：${id}`);
  }
  // 对白
  const dialogs = [s.prologue, s.epilogue, ...Object.values(s.epilogues || {}), ...s.events.flatMap((e) => [e.dialog, e.after])].filter(Boolean);
  if (!s.epilogue && !s.epilogues) err(s, '缺少 epilogue');
  const checkLines = (lines) => lines.forEach((l) => {
    if (!l.who || !l.text) err(s, `对白缺少 who/text：${JSON.stringify(l).slice(0, 60)}`);
    if (l.side && !['player', 'enemy', 'ally'].includes(l.side)) err(s, `对白 side 错误：${l.side}`);
    if (l.who && l.who !== '旁白' && !CHARACTERS[l.who] && !GENERIC.test(l.who)) warn(s, `对白人物未登记外形（将用默认头像）：${l.who}`);
    for (const c of l.choices || []) {
      if (!c.text) err(s, '选项缺少 text');
      if (c.reply) checkLines(c.reply);
    }
  });
  dialogs.forEach(checkLines);
  // 可达性：从曹操出发（忽略单位）。首领按步行判断（任意我军可接近），到达目标按指定单位的移动方式判断
  const cc = player.find((u) => u.id === 'caocao');
  const flood = (start, moveType) => {
    const seen = new Set([`${start.x},${start.y}`]);
    const q = [[start.x, start.y]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of RANGES.melee) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || !terr(nx, ny) || terr(nx, ny).cost[moveType] >= 99) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  };
  if (cc && s.map?.length === ROWS) {
    const foot = flood(cc, 'foot');
    const near = (x, y, r) => [...foot].some((k) => { const [a, b] = k.split(',').map(Number); return Math.abs(a - x) + Math.abs(b - y) <= r; });
    for (const c of conds) {
      if (c.type === 'boss') {
        const b = all.find((u) => u.id === c.target);
        if (b && !near(b.x, b.y, 3)) err(s, `我军无法接近首领 ${b.name} (${b.x},${b.y})`);
      }
      if (c.type === 'reach') {
        const who = c.unit === 'any' ? null : player.find((u) => u.id === c.unit);
        const mt = who ? classOf(roleOf(who).cls)?.moveType || 'foot' : 'foot';
        const area = flood(who || cc, mt);
        for (const [x, y] of c.tiles) if (!area.has(`${x},${y}`)) err(s, `${who?.name || '我军'}（${mt === 'horse' ? '骑马' : '步行'}）无法到达目标格 (${x},${y})`);
      }
    }
  }
  // 衔接
  const nexts = typeof s.next === 'string' ? [s.next] : Object.entries(s.next || {}).flatMap(([k, v]) => (k === 'route' ? Object.values(v) : [v]));
  if (!nexts.length) err(s, '缺少 next');
  for (const n of nexts) if (!PLANNED_IDS.includes(n) && !ENDINGS[n]) err(s, `next 指向不存在的关卡：${n}`);
  if (!PLANNED_IDS.includes(s.id)) err(s, '关卡 id 不在计划表中（见 docs/STAGE_GUIDE.md）');
}

// 从首关出发能否走到所有关卡
const reach = new Set();
const walk = (id) => {
  if (!id || reach.has(id) || !getStage(id)) return;
  reach.add(id);
  const n = getStage(id).next;
  const list = typeof n === 'string' ? [n] : Object.entries(n || {}).flatMap(([k, v]) => (k === 'route' ? Object.values(v) : [v]));
  list.forEach(walk);
};
if (!groups.length) {
  walk(FIRST_STAGE);
  for (const s of STAGES) if (!reach.has(s.id)) warns.push(`[${s.id}] 从首关无法到达此关`);
}

// 兵种登记：武将总表与按名字登记的兵种必须存在
for (const [id, g] of Object.entries(GENERALS)) if (!SERIES[g.cls]) errors.push(`[generals] ${id} 兵种不存在：${g.cls}`);
for (const [name, c] of Object.entries(CLASS_BY_NAME)) if (!SERIES[c]) errors.push(`[characters] ${name} 兵种不存在：${c}`);

console.log(`共 ${STAGES.length} 关`);
warns.forEach((w) => console.log('警告', w));
errors.forEach((e) => console.log('错误', e));
console.log(errors.length ? `\n校验失败：${errors.length} 个错误，${warns.length} 个警告` : `\n校验通过（${warns.length} 个警告）`);
process.exit(errors.length ? 1 : 0);
