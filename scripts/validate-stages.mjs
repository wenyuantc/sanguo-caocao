// 关卡数据校验：node scripts/validate-stages.mjs [分组字母...]
// 不带参数校验全部关卡（另外校验调试关卡 src/stages/debug.js）；带参数（如 a c）只校验对应的 src/stages/<组>.js
// 检查地图尺寸/字符、单位站位与地形（按兵种系列的通行规则）、胜利条件、事件、对白、关卡衔接与可达性
// 地图尺寸：正式关卡必须为 mapVersion 2，尺寸等于 MAP_SIZES（原版尺寸）；旧版 18×13（mapVersion 1）只允许调试关卡使用
import { normalizeStage, PLANNED_IDS, ENDINGS, FIRST_STAGE, MAP_SIZES, LEGACY_MAP_SIZE } from '../src/stageMeta.js';
import { DEBUG_STAGES } from '../src/stages/debug.js';

const argv = process.argv.slice(2);
const groups = argv.filter((a) => !a.startsWith('--'));
// --camp-strict：营中台词覆盖率不足（某关少于 3 位人物、某武将通用台词少于 3 段）算错误（台词全部写完后的整合阶段使用）
const CAMP_STRICT = argv.includes('--camp-strict');
const STAGES = groups.length
  ? (await Promise.all(groups.map((g) => import(`../src/stages/${g}.js`)))).flatMap((m) => m.default).map(normalizeStage)
  : (await import('../src/stages.js')).STAGES;
const getStage = (id) => STAGES.find((s) => s.id === id);
import { TERRAIN, SERIES, RANGES, classOf, SPELLS, ITEMS, DIFFICULTIES, LOOT, passable } from '../src/data.js';
import { STATUS } from '../src/status.js';
import { CHARACTERS, CLASS_BY_NAME } from '../src/characters.js';
import { GENERALS } from '../src/generals.js';
import { roleOf } from '../src/logic.js';
import { planDeploy, buildPlayerDefs } from '../src/deploy.js';
import { EQUIP, REWARDS, DROPS, SHOP_UNLOCK, STARTER_TREASURES, ITEM_PRICE, gearDesc } from '../src/equipment.js';
import { TABLE, STAGE_WEATHER, SET_WEATHER, stageWeather, validIdx } from '../src/weather.js';
import { TERRAIN_PRESETS } from '../src/terrain.js';
import { checkScript, POSES } from '../src/story/defs.js';
import { autoScene } from '../src/story/auto.js';
import { TALKS_BY_GROUP, GENERIC_TALKS, FOLK_TALKS } from '../src/camp/talks.js';
import { LAYOUTS, CAMP_OF, FOLK, checkLayout } from '../src/camp/layouts.js';

const errors = [], warns = [];
const err = (s, m) => errors.push(`[${s.id}] ${m}`);
const warn = (s, m) => warns.push(`[${s.id}] ${m}`);
const GENERIC = /兵|军|贼|术士|伏兵|守将|部将|将领|士兵|骑|营|旁白|斥候|使者|百姓|侍从|亲卫|船|车|众/;
const ids = new Set();

function checkStage(s, { debug = false } = {}) {
  if (ids.has(s.id)) err(s, 'id 重复');
  ids.add(s.id);
  for (const f of ['id', 'name', 'chapter', 'turns', 'victoryText', 'map', 'units', 'prologue']) if (s[f] == null) err(s, `缺少字段 ${f}`);
  // 地图：一字符一格（30 种地形编码见 terrain.js），尺寸按 mapVersion 检查
  if (![1, 2].includes(s.mapVersion)) err(s, `mapVersion 只能是 1 或 2：${s.mapVersion}`);
  const [COLS, ROWS] = s.mapVersion >= 2 ? MAP_SIZES[s.id] || [s.map?.[0]?.length, s.map?.length] : LEGACY_MAP_SIZE;
  if (s.mapVersion >= 2 && !MAP_SIZES[s.id] && !debug) err(s, 'MAP_SIZES 中没有本关的地图尺寸');
  if (s.mapVersion < 2 && !debug) err(s, `地图仍为旧版 18×13，应按原版尺寸 ${MAP_SIZES[s.id]?.join('×')} 重做并设 mapVersion: 2`);
  if (!(COLS >= 18 && COLS <= 40 && ROWS >= 13 && ROWS <= 40)) err(s, `地图尺寸超出范围：${COLS}×${ROWS}（应为 18~40 × 13~40）`);
  if (!Array.isArray(s.map) || s.map.length !== ROWS) err(s, `地图行数应为 ${ROWS}，实际 ${s.map?.length}`);
  s.map?.forEach((row, y) => {
    if (row.length !== COLS) err(s, `地图第 ${y} 行长度 ${row.length}（应为 ${COLS}）：${row}`);
    for (const ch of row) if (!TERRAIN[ch]) err(s, `地图第 ${y} 行含未知地形字符 '${ch}'`);
  });
  const mapOk = Array.isArray(s.map) && s.map.length === ROWS && s.map.every((r) => r.length === COLS);
  // 天气：关卡 weather 字段（可选）或原版映射，类别 0~4、起始序号 0~5
  const wt = stageWeather(s);
  if (!TABLE[wt.type] || !validIdx(wt.start)) err(s, `天气设定错误：${JSON.stringify(wt)}（type 0~4，start 0~5）`);
  if (!s.weather && !STAGE_WEATHER[s.id]) warn(s, '没有原版天气映射，使用默认天气（普通类别、开局晴）');
  const terr = (x, y) => TERRAIN[s.map?.[y]?.[x]];
  // 按兵种系列判断能否站立 / 通行；目标格、撤离点、出阵位置按步兵判断
  const canStand = (cls, x, y) => !!terr(x, y) && passable(cls, s.map[y][x]);
  const footOk = (x, y) => canStand('infantry', x, y);
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
    if (t && !passable(real, t.ch)) err(s, `${u.name}(${u.id}) [${cls.name}] 站在不可通行地形 ${t.name} (${u.x},${u.y})`);
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
      for (const [x, y] of c.tiles || []) if (!footOk(x, y)) err(s, `reach 目标格不可达 (${x},${y})`);
    }
    if (c.type === 'survive' && !(c.turns < s.turns)) err(s, 'survive 回合数应小于 turns');
  }
  for (const id of s.protect || []) if (!all.some((u) => u.id === id)) err(s, `protect 单位不存在：${id}`);
  if (s.escape) {
    for (const id of s.escape.units || []) if (!player.some((u) => u.id === id)) err(s, `escape 单位不存在：${id}`);
    for (const [x, y] of s.escape.tiles || []) if (!footOk(x, y)) err(s, `escape 撤离点不可达 (${x},${y})`);
  }
  for (const r of s.victoryFlags || []) {
    if (!all.some((u) => u.id === r.unit)) err(s, `victoryFlags 单位不存在：${r.unit}`);
    if (typeof r.alive !== 'boolean' || !r.flag) err(s, 'victoryFlags 需要 { unit, alive: true|false, flag }');
  }
  // 出阵覆盖：deploy: { max, required: [id], slots: [[x,y]] }；重做后的大地图（mapVersion 2）必须显式写出 slots
  if (s.mapVersion >= 2 && !s.deploy?.slots && !debug) err(s, 'mapVersion 2 的关卡必须写出 deploy.slots');
  if (s.deploy) {
    const d = s.deploy;
    const slots = d.slots || player.map((u) => [u.x, u.y]);
    if (d.slots) {
      const seen = new Set();
      for (const [x, y] of d.slots) {
        const k = `${x},${y}`;
        if (!terr(x, y)) err(s, `deploy.slots 出阵位置超出地图 (${k})`);
        else if (!footOk(x, y)) err(s, `deploy.slots 出阵位置不可通行 (${k})`);
        if (seen.has(k)) err(s, `deploy.slots 出阵位置重复 (${k})`);
        seen.add(k);
        const o = s.units.find((u) => u.faction !== 'player' && !u.ifFlag && u.x === x && u.y === y);
        if (o) err(s, `deploy.slots 出阵位置与 ${o.name} 重叠 (${k})`);
      }
    }
    // 预设我军（非条件登场）必须站在出阵位置上，否则整备后的站位与预设不符
    if (d.slots) {
      for (const u of player.filter((p) => !p.ifFlag)) {
        if (!d.slots.some(([x, y]) => x === u.x && y === u.y)) err(s, `预设我军 ${u.name} (${u.x},${u.y}) 不在 deploy.slots 中`);
      }
    }
    if (d.max != null && !(Number.isInteger(d.max) && d.max >= 1 && d.max <= slots.length)) err(s, `deploy.max 应为 1~${slots.length} 的整数`);
    for (const id of d.required || []) if (!player.some((u) => u.id === id)) err(s, `deploy.required 不是本关预设我军单位：${id}`);
    if (new Set(['caocao', ...(d.required || [])]).size > (d.max ?? slots.length)) err(s, 'deploy.required 人数超过出阵上限');
  }
  // 失败说明中写明的回合数必须与回合上限一致
  const dt = /超过\s*(\d+)\s*回合/.exec(s.defeatText || '');
  if (dt && Number(dt[1]) !== s.turns) err(s, `defeatText 写的是 ${dt[1]} 回合，与回合上限 turns ${s.turns} 不一致`);
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
  // 战场演出：事件的 stage 指令与援军入场格 from
  const tileOk = (p) => Array.isArray(p) && p.length === 2 && !!terr(p[0], p[1]);
  const unitOk = (id) => all.some((u) => u.id === id);
  const targetOk = (t) => (typeof t === 'string' ? unitOk(t) : tileOk(t));
  const BATTLE_POSES = ['jump', 'bow', 'shake', 'flash', 'spin'];
  s.events.forEach((e, i) => {
    const at = `事件 #${i} stage`;
    for (const u of e.units || []) {
      if (u.from != null && u.from !== false && !tileOk(u.from)) err(s, `事件 #${i} 援军 ${u.id} 的 from 不在地图内：${JSON.stringify(u.from)}`);
    }
    if (e.stage == null) return;
    if (!Array.isArray(e.stage)) { err(s, `${at} 必须是指令数组`); return; }
    e.stage.forEach((c, j) => {
      const where = `${at}[${j}]`;
      if (c.camera != null) { if (!targetOk(c.camera)) err(s, `${where} camera 目标无效：${JSON.stringify(c.camera)}`); }
      else if (c.walk != null) {
        if (!unitOk(c.walk)) err(s, `${where} walk 单位不存在：${c.walk}`);
        if (!c.to && !c.path) err(s, `${where} walk 需要 to 或 path`);
        if (c.to && !tileOk(c.to)) err(s, `${where} walk.to 不在地图内`);
        if (c.path && !(Array.isArray(c.path) && c.path.every(tileOk))) err(s, `${where} walk.path 含地图外的格子`);
      } else if (c.highlight != null) {
        if (!Array.isArray(c.highlight) || !c.highlight.every(targetOk)) err(s, `${where} highlight 含无效格子或单位`);
      } else if (c.terrain != null) {
        for (const t of [c.terrain].flat()) {
          if (!tileOk(t.at)) err(s, `${where} terrain.at 不在地图内：${JSON.stringify(t.at)}`);
          if (!TERRAIN_PRESETS[t.set] && !TERRAIN[t.set]) err(s, `${where} terrain.set 无效：${t.set}（预设 ${Object.keys(TERRAIN_PRESETS).join('/')} 或地形字符）`);
          if (t.size != null && ![1, 3].includes(t.size)) err(s, `${where} terrain.size 只能是 1 或 3`);
        }
      } else if (c.face != null) {
        if (!unitOk(c.face)) err(s, `${where} face 单位不存在：${c.face}`);
        if (!['left', 'right', 'up', 'down'].includes(c.dir) && !targetOk(c.dir)) err(s, `${where} face.dir 无效：${JSON.stringify(c.dir)}`);
      } else if (c.act != null) {
        if (!unitOk(c.act)) err(s, `${where} act 单位不存在：${c.act}`);
        if (!BATTLE_POSES.includes(c.pose) && !POSES[c.pose]) err(s, `${where} act.pose 无效：${c.pose}`);
      } else if (c.say != null) { if (Array.isArray(c.say)) checkLines(c.say); else err(s, `${where} say 必须是对白数组`); }
      else if (c.wait != null) { if (typeof c.wait !== 'number' || c.wait < 0) err(s, `${where} wait 必须是非负毫秒数`); }
      else if (c.spawn !== true) err(s, `${where} 未知指令：${JSON.stringify(c).slice(0, 60)}`);
    });
    if (e.stage.filter((c) => c.spawn === true).length > 1) err(s, `${at} 最多一条 spawn`);
  });
  // 剧情场景：手写 scenes.pre / scenes.post（post 可按结果分支）；没有手写的部分检查自动生成的场景
  const known = (name) => !!CHARACTERS[name] || GENERIC.test(name);
  const checkScene = (script, label) => {
    for (const m of checkScript(script, { known })) {
      if (m.includes('人物未登记')) warn(s, `${label} ${m}（将用默认外形）`);
      else err(s, `${label} ${m}`);
    }
  };
  const sc = s.scenes || {};
  for (const k of Object.keys(sc)) if (!['pre', 'post'].includes(k)) err(s, `scenes 只能有 pre / post：${k}`);
  if (sc.pre != null) checkScene(sc.pre, 'scenes.pre');
  else checkScene(autoScene(s, 'pre'), '自动开场场景');
  if (Array.isArray(sc.post)) checkScene(sc.post, 'scenes.post');
  else if (sc.post && typeof sc.post === 'object') {
    for (const [k, v] of Object.entries(sc.post)) {
      if (!['default', 'annihilate', 'win', ...Object.keys(s.epilogues || {})].includes(k)) warn(s, `scenes.post 分支 ${k} 没有对应的结果`);
      checkScene(v, `scenes.post.${k}`);
    }
  } else {
    for (const outcome of ['win', ...Object.keys(s.epilogues || {}).filter((k) => k !== 'annihilate')]) checkScene(autoScene(s, 'post', { outcome }), `自动结尾场景(${outcome})`);
    if (s.epilogues?.annihilate) checkScene(autoScene(s, 'post', { annihilated: true }), '自动结尾场景(annihilate)');
  }
  // 可达性：从曹操出发（忽略单位）。首领按步行判断（任意我军可接近），到达目标按指定单位的移动方式判断
  const cc = player.find((u) => u.id === 'caocao');
  const flood = (start, cls) => {
    const seen = new Set([`${start.x},${start.y}`]);
    const q = [[start.x, start.y]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of RANGES.melee) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (seen.has(k) || !canStand(cls, nx, ny)) continue;
        seen.add(k); q.push([nx, ny]);
      }
    }
    return seen;
  };
  if (cc && mapOk) {
    const foot = flood(cc, 'infantry');
    const near = (x, y, r) => [...foot].some((k) => { const [a, b] = k.split(',').map(Number); return Math.abs(a - x) + Math.abs(b - y) <= r; });
    for (const c of conds) {
      if (c.type === 'boss') {
        const b = all.find((u) => u.id === c.target);
        if (b && !near(b.x, b.y, 3)) err(s, `我军无法接近首领 ${b.name} (${b.x},${b.y})`);
      }
      if (c.type === 'reach') {
        const who = c.unit === 'any' ? null : player.find((u) => u.id === c.unit);
        const sc = who ? roleOf(who).cls : 'infantry';
        const area = flood(who || cc, sc);
        for (const [x, y] of c.tiles) if (!area.has(`${x},${y}`)) err(s, `${who?.name || '我军'}（${SERIES[sc]?.name || sc}）无法到达目标格 (${x},${y})`);
      }
    }
  }
  // 衔接
  const nexts = typeof s.next === 'string' ? [s.next] : Object.entries(s.next || {}).flatMap(([k, v]) => (k === 'route' ? Object.values(v) : [v]));
  if (!nexts.length) err(s, '缺少 next');
  for (const n of nexts) if (!PLANNED_IDS.includes(n) && !ENDINGS[n]) err(s, `next 指向不存在的关卡：${n}`);
  if (!debug && !PLANNED_IDS.includes(s.id)) err(s, '关卡 id 不在计划表中（见 docs/STAGE_GUIDE.md）');
  if (debug && PLANNED_IDS.includes(s.id)) err(s, '调试关卡的 id 不能与正式关卡重复');
}

for (const s of STAGES) checkStage(s);
if (!groups.length) for (const s of DEBUG_STAGES.map(normalizeStage)) checkStage(s, { debug: true });

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

// 策略表与习得表、道具表
const CATS = ['damage', 'status', 'debuff', 'buff', 'heal', 'mp', 'cure', 'special'];
for (const [id, sp] of Object.entries(SPELLS)) {
  const e = (m) => errors.push(`[spells] ${id} ${m}`);
  if (!sp.name || !sp.desc || typeof sp.mp !== 'number') e('缺少 name / desc / mp');
  if (!CATS.includes(sp.cat)) e(`类别错误：${sp.cat}`);
  if (!['foe', 'ally', 'self'].includes(sp.target)) e(`目标类型错误：${sp.target}`);
  if (![0, 'cross', 'square', 'map'].includes(sp.area)) e(`范围错误：${sp.area}`);
  if (!(sp.range === 'map' || (Number.isInteger(sp.range) && sp.range >= 0))) e(`射程错误：${sp.range}`);
  if (sp.cat === 'damage' && !['a', 'b', 'c', 'd', 'e', 'f', 'g', 'kill'].includes(sp.formula)) e(`伤害公式错误：${sp.formula}`);
  if (sp.weather && !['bad', 'sun', 'cloud'].includes(sp.weather)) e(`天气条件错误：${sp.weather}`);
  if (sp.setWeather && !(sp.setWeather in SET_WEATHER)) e(`天气策略错误：${sp.setWeather}`);
  if (sp.needGem && EQUIP[sp.needGem]?.kind !== 'jade') e(`需要的宝玉不存在：${sp.needGem}`);
  if (sp.status && sp.status !== 'random' && !STATUS[sp.status]) e(`异常不存在：${sp.status}`);
  if (sp.buff && !(['atk', 'int', 'def', 'burst', 'morale', 'power', 'all'].includes(sp.buff.stat) && sp.buff.mult > 0)
    && !(sp.buff.stat === 'move' && sp.buff.add)) e(`增减益错误：${JSON.stringify(sp.buff)}`);
  if (sp.cure && sp.cure !== 'all' && !STATUS[sp.cure]) e(`解除的异常不存在：${sp.cure}`);
}
for (const [id, it] of Object.entries(ITEMS)) if (it.cure && it.cure !== 'all' && !STATUS[it.cure]) errors.push(`[items] ${id} 解除的异常不存在：${it.cure}`);
for (const [cls, s] of Object.entries(SERIES)) {
  for (const l of s.spells) {
    if (!SPELLS[l.id]) errors.push(`[series] ${cls} 习得的策略不存在：${l.id}`);
    if (!(l.tier >= 1 && l.tier <= s.tiers.length)) errors.push(`[series] ${cls} 策略 ${l.id} 阶级超出范围：${l.tier}`);
  }
}
for (const [id, d] of Object.entries(DIFFICULTIES)) {
  for (const k of [...Object.keys(d.items), ...Object.keys(d.reward)]) if (!ITEMS[k]) errors.push(`[difficulty] ${id} 道具不存在：${k}`);
}
for (const k of LOOT) if (!ITEMS[k]) errors.push(`[loot] 道具不存在：${k}`);
for (const id of Object.keys(STAGE_WEATHER)) if (!PLANNED_IDS.includes(id)) errors.push(`[weather] 天气映射的关卡不存在：${id}`);

// 装备：数量（普通 37 / 宝物 50）、可装备系列、特效说明、射程；奖励 / 掉落 / 商店引用的关卡与物品
const eqErr = (m) => errors.push(`[equipment] ${m}`);
const eqList = Object.values(EQUIP);
const nNormal = eqList.filter((e) => !e.treasure).length, nTreasure = eqList.length - nNormal;
if (nNormal !== 37 || nTreasure !== 50) eqErr(`装备数量应为普通 37 / 宝物 50，实际 ${nNormal} / ${nTreasure}`);
for (const [id, e] of Object.entries(EQUIP)) {
  for (const c of e.series) if (!SERIES[c]) eqErr(`${id} 可装备系列不存在：${c}`);
  for (const f of e.effects) if (f.type === 'range' && !RANGES[f.range]) eqErr(`${id} 射程不存在：${f.range}`);
  try { gearDesc(id, 1); } catch { eqErr(`${id} 特效缺少说明`); }
  if (e.sellFruit && !ITEMS[e.sellFruit]?.fruit) eqErr(`${id} 卖出得到的果子不存在：${e.sellFruit}`);
}
const gearIds = (item) => (Array.isArray(item) ? item : [item]);
const setFlags = new Set(STAGES.flatMap((s) => {
  const out = [...(s.victoryFlags || []).map((r) => r.flag), ...s.events.map((e) => e.setFlag)];
  const scan = (lines) => (lines || []).forEach((l) => (l.choices || []).forEach((c) => { out.push(c.flag); scan(c.reply); }));
  [s.prologue, s.epilogue, ...Object.values(s.epilogues || {}), ...s.events.flatMap((e) => [e.dialog, e.after])].forEach(scan);
  return out;
}).filter(Boolean));
for (const [sid, list] of Object.entries(REWARDS)) {
  if (!PLANNED_IDS.includes(sid)) eqErr(`奖励关卡不存在：${sid}`);
  for (const r of list) {
    if (r.item) gearIds(r.item).forEach((id) => EQUIP[id] || eqErr(`${sid} 奖励装备不存在：${id}`));
    if (!r.item && !r.gold) eqErr(`${sid} 奖励条目没有装备或金钱`);
    const s = getStage(sid);
    if (!s || groups.length) continue;
    for (const f of [r.ifFlag, r.unlessFlag]) if (f && !setFlags.has(f)) eqErr(`${sid} 奖励条件的剧情标记没有任何关卡设置：${f}`);
    if (r.alive && !s.units.some((u) => u.id === r.alive)) eqErr(`${sid} 奖励条件的单位不在关卡中：${r.alive}`);
    if (r.via && !s.victory.some((c) => c.type === r.via)) eqErr(`${sid} 奖励条件的胜利方式不存在：${r.via}`);
  }
}
for (const [sid, map] of Object.entries(DROPS)) {
  if (!PLANNED_IDS.includes(sid)) eqErr(`掉落关卡不存在：${sid}`);
  const s = getStage(sid);
  for (const [uid, item] of Object.entries(map)) {
    gearIds(item).forEach((id) => EQUIP[id] || eqErr(`${sid} 掉落装备不存在：${id}`));
    const all = s ? [...s.units, ...s.events.flatMap((e) => e.units || [])] : [];
    if (s && !all.some((u) => u.id === uid && u.faction === 'enemy')) eqErr(`${sid} 掉落的敌军单位不在关卡中：${uid}`);
  }
}
for (const [sid, goods] of Object.entries(SHOP_UNLOCK)) {
  if (!PLANNED_IDS.includes(sid)) eqErr(`商店上架关卡不存在：${sid}`);
  for (const id of goods) {
    if (EQUIP[id]?.treasure) eqErr(`${sid} 商店不能出售宝物：${id}`);
    else if (!EQUIP[id] && !ITEM_PRICE[id]) eqErr(`${sid} 商品不存在或没有价格：${id}`);
  }
}
for (const [gid, list] of Object.entries(STARTER_TREASURES)) {
  if (!GENERALS[gid]) eqErr(`初始宝物的武将不存在：${gid}`);
  for (const id of list) if (!EQUIP[id]?.treasure) eqErr(`${gid} 初始宝物不存在：${id}`);
}
for (const id of Object.keys(ITEM_PRICE)) if (!ITEMS[id]) eqErr(`有价格的道具不存在：${id}`);

// ---------- 营中（camp/）：布局、本关专属台词（talks_<组>.js）、通用台词（generic.js） ----------
{
  const campErr = (m) => errors.push(`[camp] ${m}`);
  const GROUP_IDS = Object.fromEntries(await Promise.all([...'abcdef'].map(async (g) => [g, (await import(`../src/stages/${g}.js`)).default.map((x) => x.id)])));
  const GENERAL_NAMES = new Set(Object.values(GENERALS).map((g) => g.name));
  const known = (n) => n === '旁白' || GENERAL_NAMES.has(n) || !!CHARACTERS[n] || !!FOLK[n] || GENERIC.test(n);
  const FLAG_RE = /^[a-z][a-z0-9_]*$/;
  const LINE_KEYS = new Set(['who', 'side', 'text', 'ifFlag', 'unlessFlag', 'choices']);
  const ENTRY_KEYS = new Set(['who', 'side', 'cls', 'lines', 'again', 'ifFlag', 'unlessFlag']);
  const flagField = (o, at) => { for (const f of ['ifFlag', 'unlessFlag']) if (o[f] != null && (typeof o[f] !== 'string' || !FLAG_RE.test(o[f]))) campErr(`${at} ${f} 格式错误：${o[f]}（小写字母开头，只含小写字母、数字、下划线）`); };
  const lines = (arr, at, noChoice) => {
    if (!Array.isArray(arr) || !arr.length) { campErr(`${at} 对白必须是非空数组`); return; }
    arr.forEach((l, i) => {
      const w = `${at} 第 ${i + 1} 行`;
      if (!l || typeof l !== 'object') { campErr(`${w} 不是对象`); return; }
      if (typeof l.who !== 'string' || typeof l.text !== 'string' || !l.text.trim()) campErr(`${w} 缺少 who / text`);
      else if (!known(l.who)) campErr(`${w} 说话人未登记：${l.who}（武将名 / characters 登记 / layouts.FOLK / 通用士兵名）`);
      for (const k of Object.keys(l)) if (!LINE_KEYS.has(k)) campErr(`${w} 未知字段：${k}`);
      if (l.side && !['player', 'enemy', 'ally'].includes(l.side)) campErr(`${w} side 无效：${l.side}`);
      flagField(l, w);
      if (l.choices == null) return;
      if (noChoice) { campErr(`${w} 此处不能带选项（可反复触发的台词）`); return; }
      if (!Array.isArray(l.choices) || l.choices.length < 2 || l.choices.length > 3) { campErr(`${w} choices 须为 2~3 个选项`); return; }
      l.choices.forEach((c, j) => {
        const cw = `${w} 选项 ${j + 1}`;
        if (!c || typeof c.text !== 'string' || !c.text.trim()) campErr(`${cw} 缺少 text`);
        if (c.red != null && !(Number.isInteger(c.red) && Math.abs(c.red) <= 3)) campErr(`${cw} red 须为 −3~3 的整数：${c.red}`);
        if (c.flag != null && (typeof c.flag !== 'string' || !FLAG_RE.test(c.flag))) campErr(`${cw} flag 格式错误：${c.flag}`);
        for (const k of Object.keys(c || {})) if (!['text', 'red', 'flag', 'reply'].includes(k)) campErr(`${cw} 未知字段：${k}`);
        if (c.reply != null) lines(c.reply, `${cw} 回复`, false);
      });
    });
  };
  // 布局
  for (const [id, L] of Object.entries(LAYOUTS)) {
    if (L.id !== id) campErr(`布局 id 与键不一致：${id}`);
    checkLayout(L).forEach((m) => campErr(`布局 ${id}：${m}`));
  }
  for (const [sid, lid] of Object.entries(CAMP_OF)) {
    if (!PLANNED_IDS.includes(sid)) campErr(`CAMP_OF 的关卡不存在：${sid}`);
    if (!LAYOUTS[lid]) campErr(`CAMP_OF[${sid}] 布局不存在：${lid}`);
  }
  for (const st of STAGES) if (st.camp != null && !LAYOUTS[st.camp]) campErr(`${st.id} 的 camp 布局不存在：${st.camp}`);
  // 本关专属台词：键为即将开始的关卡 id，写在该关所属组的 talks_<组>.js
  let covered = 0, total = 0;
  for (const g of groups.length ? groups : Object.keys(GROUP_IDS)) {
    const talks = TALKS_BY_GROUP[g];
    if (!talks || typeof talks !== 'object') { campErr(`talks_${g}.js 没有导出 CAMP_TALKS_${g.toUpperCase()}`); continue; }
    for (const [sid, list] of Object.entries(talks)) {
      const at = `talks_${g}.${sid}`;
      if (!PLANNED_IDS.includes(sid)) { campErr(`${at} 关卡不存在`); continue; }
      if (!GROUP_IDS[g].includes(sid)) campErr(`${at} 关卡不属于 ${g.toUpperCase()} 组（应写在 ${Object.keys(GROUP_IDS).find((k) => GROUP_IDS[k].includes(sid))} 组）`);
      if (sid === FIRST_STAGE) campErr(`${at} 第一关之前不进营中，不需要台词`);
      if (!Array.isArray(list) || !list.length) { campErr(`${at} 必须是非空数组`); continue; }
      const seen = new Set();
      list.forEach((e, i) => {
        const ew = `${at}[${i}]`;
        if (!e || typeof e.who !== 'string') { campErr(`${ew} 缺少 who`); return; }
        if (!known(e.who)) campErr(`${ew} 人物未登记：${e.who}`);
        if (e.who === '曹操') campErr(`${ew} 不能与曹操自己对话`);
        for (const k of Object.keys(e)) if (!ENTRY_KEYS.has(k)) campErr(`${ew} 未知字段：${k}`);
        if (e.side && !['player', 'enemy', 'ally'].includes(e.side)) campErr(`${ew} side 无效：${e.side}`);
        if (e.cls && !SERIES[e.cls]) campErr(`${ew} 兵种不存在：${e.cls}`);
        flagField(e, ew);
        const k = `${e.who}|${e.ifFlag || ''}|${e.unlessFlag || ''}`;
        if (seen.has(k)) campErr(`${ew} ${e.who} 的台词重复（同一人物多条须用 ifFlag / unlessFlag 区分）`);
        seen.add(k);
        lines(e.lines, `${ew}.lines`, false);
        if (e.again != null) lines(e.again, `${ew}.again`, true);
      });
      const n = new Set(list.map((e) => e?.who)).size;
      if (CAMP_STRICT && (n < 3 || n > 6)) campErr(`${at} 应有 3~6 位人物的台词，实际 ${n}`);
    }
    for (const sid of GROUP_IDS[g]) {
      if (sid === FIRST_STAGE) continue;
      total += 1;
      if (talks?.[sid]) covered += 1;
      else if (CAMP_STRICT) campErr(`talks_${g}.${sid} 缺少营中台词`);
    }
  }
  // 通用台词
  let genOk = 0;
  const genTotal = Object.keys(GENERALS).filter((id) => id !== 'caocao').length;
  for (const [gid, convs] of Object.entries(GENERIC_TALKS)) {
    if (!GENERALS[gid]) { campErr(`generic.${gid} 武将不存在（键为武将 id）`); continue; }
    if (gid === 'caocao') campErr('generic.caocao 曹操不需要通用台词');
    if (!Array.isArray(convs) || !convs.length) { campErr(`generic.${gid} 必须是非空数组`); continue; }
    convs.forEach((c, i) => lines(c, `generic.${gid}[${i}]`, true));
    if (convs.length >= 3) genOk += 1;
  }
  if (CAMP_STRICT) for (const gid of Object.keys(GENERALS)) if (gid !== 'caocao' && !(GENERIC_TALKS[gid]?.length >= 3)) campErr(`generic.${gid} 通用台词少于 3 段`);
  for (const [name, convs] of Object.entries(FOLK_TALKS)) {
    if (!FOLK[name]) campErr(`FOLK_TALKS.${name} 通用角色未在 layouts.FOLK 登记`);
    if (!Array.isArray(convs) || !convs.length) { campErr(`FOLK_TALKS.${name} 必须是非空数组`); continue; }
    convs.forEach((c, i) => lines(c, `FOLK_TALKS.${name}[${i}]`, true));
  }
  console.log(`营中台词：本关专属 ${covered} / ${total} 关，通用台词满 3 段的武将 ${genOk} / ${genTotal}${CAMP_STRICT ? '（严格模式）' : ''}`);
}

console.log(`共 ${STAGES.length} 关${groups.length ? '' : `（另有调试关卡 ${DEBUG_STAGES.length} 个）`}`);
warns.forEach((w) => console.log('警告', w));
errors.forEach((e) => console.log('错误', e));
console.log(errors.length ? `\n校验失败：${errors.length} 个错误，${warns.length} 个警告` : `\n校验通过（${warns.length} 个警告）`);
process.exit(errors.length ? 1 : 0);
