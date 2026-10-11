// 自动演出：没有手写 scenes 的关卡，由 prologue / epilogue 生成场景脚本（纯函数，Node 可导入，校验脚本可逐关检查）
// 规则：
// 1. 开头的旁白放在中国地图上（开场：曹操头像 → 行军箭头 → 本关地点，敌军首领头像）；
// 2. 其余对白按阵营分段（我军 + 友军 / 敌军），每段一个背景：我军在军营大帐 / 军营（战后进城则为公馆、街道），
//    敌军在城中宫殿 / 府邸或战场外景；分段超过 3 段时合成一段，双方在外景对峙；
// 3. 说话人依次入场站位，发言时走到前方，按台词加表情 / 动作；结束时部下向主公作揖（没有主公时离场）。
import { STAGES } from '../stages.js';
import { GENERALS } from '../generals.js';
import { STAGE_PLACE, CITIES, MAP_VIEWS, mapProjector, lonLatToMap } from './defs.js';

const GENERAL_NAMES = new Set(Object.values(GENERALS).map((g) => g.name));

// 结尾对白：与旧版 BattleScene.victory 相同的选择顺序（敌军全灭 → 按结果 → 默认）
export function postLines(stage, outcome = 'win', annihilated = false) {
  const eps = stage.epilogues || {};
  return (annihilated && eps.annihilate) || eps[outcome] || stage.epilogue || [];
}

// 场景脚本：手写 scenes.pre / scenes.post 优先（post 可以是数组，或与 epilogues 相同的按结果分支对象）
export function sceneFor(stage, part, ctx = {}) {
  const hand = stage.scenes?.[part];
  if (Array.isArray(hand)) return hand;
  if (hand && typeof hand === 'object') {
    const pick = (ctx.annihilated && hand.annihilate) || hand[ctx.outcome] || hand.default;
    if (pick) return pick;
  }
  return autoScene(stage, part, ctx);
}

// 上一关（用于开场的行军箭头）
let PREV = null;
function prevStage(id) {
  if (!PREV) {
    PREV = {};
    const targets = (n) => (!n ? [] : typeof n === 'string' ? [n] : Object.values(n).flatMap(targets));
    for (const s of STAGES) for (const t of targets(s.next)) PREV[t] ??= s.id;
  }
  return PREV[id];
}

const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 17);
const sideOf = (stage, l) => l.side || stage.units?.find((u) => u.name === l.who)?.faction || (GENERAL_NAMES.has(l.who) ? 'player' : 'enemy');
const cond = (o) => ({ ...(o?.ifFlag && { ifFlag: o.ifFlag }), ...(o?.unlessFlag && { unlessFlag: o.unlessFlag }) });

// 地形关键词
function terrainOf(stage) {
  const s = stage.name + (STAGE_PLACE[stage.id]?.place || '');
  if (/关|剑阁/.test(s)) return 'citygate';
  if (/江|赤壁|濡须|汉水|鱼腹|津|渭|白马|渡|口|浦/.test(s)) return 'river';
  if (/山|坡|谷|原|岭|道/.test(s)) return 'mountain';
  if (/城|邺|南皮|建业|成都|下邳|寿春|江陵|徐州|濮阳|宛/.test(s)) return 'city';
  return 'field';
}
const OUTER = { citygate: 'citygate', river: 'river', mountain: 'mountain', city: 'citygate', field: 'field' };

// 中国地图视野：选能同时容纳两个地点的放大视野（放大倍数最大者优先，同倍数取中心离两点中点最近），都不行用全图
function viewFor(...cities) {
  const pts = cities.filter(Boolean).map((c) => lonLatToMap(...CITIES[c]));
  let best = 'all', bestD = Infinity, bestZ = 0;
  for (const [name, v] of Object.entries(MAP_VIEWS)) {
    if (name === 'all') continue;
    const proj = mapProjector(name);
    if (!pts.every((p) => { const s = proj(p.x, p.y); return s.x > 90 && s.x < 1110 && s.y > 110 && s.y < 520; })) continue;
    const c = lonLatToMap(...v.center), m = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    const d = Math.hypot(c.x - m.x, c.y - m.y);
    if (v.zoom > bestZ || (v.zoom === bestZ && d < bestD)) { bestD = d; best = name; bestZ = v.zoom; }
  }
  return best;
}

// ---------- 台词 → 表情 / 动作 ----------
function emoteFor(text) {
  if (/什么|不好|竟然|竟是|岂有此理|怎么可能|糟了|中计/.test(text)) return 'shock';
  if (/贼子|匹夫|可恶|大胆|该死|鼠辈|狗贼|竖子|无耻/.test(text)) return 'anger';
  if (/哈哈|大喜|甚好|妙哉|善哉|大善|妙计|好！/.test(text)) return 'joy';
  if (/[？?]$|为何|何故|莫非|如何是好/.test(text)) return 'question';
  if (/惭愧|恕罪|不敢|冷汗|罪该万死/.test(text)) return 'sweat';
  return null;
}
function poseFor(text, isLord) {
  if (/哭|泣|呜呼|痛煞|悲/.test(text)) return 'cry';
  if (/哈哈/.test(text)) return 'excite';
  if (!isLord && /末将|遵命|领命|得令|谢主公|拜见|参见|愿效|在下|臣/.test(text)) return 'bow';
  if (isLord && /全军|众将|出发|进军|随我|杀！|冲|传令|听令/.test(text)) return 'raise1';
  return null;
}

// ---------- 阵型 ----------
// court：主位在后方中间，部下分左右两列面向中间；line：外景单方阵营围成半圆；both：双方左右对峙
const sd = (s, d) => [(d + s) / 2, (d - s) / 2];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
function formation(kind, n, lordIdx) {
  const slots = [];
  if (kind === 'court') {
    const rows = [12, 16, 20, 24];
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (i === lordIdx) { slots.push({ at: [3, 3], face: 'dr', fwd: [1.5, 1.5], entry: [3, 3] }); continue; }
      const left = k % 2 === 0, d = rows[Math.min(3, Math.floor(k / 2))] + (k >= 8 ? 2 : 0);
      const at = sd(left ? -6 : 6, d);
      slots.push({ at, face: left ? 'dr' : 'dl', fwd: left ? [1.5, -1.5] : [-1.5, 1.5], entry: add(at, [6, 6]) });
      k += 1;
    }
    return slots;
  }
  if (kind === 'line') {
    const ring = [[0, 14], [-4, 16], [4, 16], [-8, 18], [8, 18], [-4, 20], [4, 20], [0, 22]];
    for (let i = 0; i < n; i++) {
      const j = lordIdx >= 0 ? (i === lordIdx ? 0 : i < lordIdx ? i + 1 : i) : i;
      const [s, d] = ring[Math.min(j, ring.length - 1)];
      const at = sd(s, d + (j >= ring.length ? 2 : 0));
      slots.push({ at, face: s > 0 ? 'dl' : 'dr', fwd: [1.2, 1.2], entry: add(at, s > 0 ? [7, -7] : [-7, 7]) });
    }
    return slots;
  }
  return slots;
}
function sideSlots(g, n) {
  // g = -1 我军在左，+1 敌军在右
  const base = [[6, 16], [8, 13], [8, 19], [10, 16], [12, 13], [12, 19], [14, 16], [10, 22]];
  return Array.from({ length: n }, (_, i) => {
    const [s, d] = base[Math.min(i, base.length - 1)];
    const at = sd(s * g, d + (i >= base.length ? (i - base.length + 1) * 2 : 0));
    return { at, face: g < 0 ? 'dr' : 'dl', fwd: g < 0 ? [1, -1] : [-1, 1], entry: add(at, g < 0 ? [-7, 7] : [7, -7]) };
  });
}

// ---------- 分段 ----------
function segment(stage, lines) {
  const segs = [];
  let intro = [];
  for (const l of lines) {
    const narr = l.who === '旁白';
    if (narr && !segs.length) { intro.push(l); continue; }
    const g = narr ? segs[segs.length - 1].g : sideOf(stage, l) === 'enemy' ? 'E' : 'P';
    const last = segs[segs.length - 1];
    if (last && last.g === g) last.lines.push(l);
    else segs.push({ g, lines: [l] });
  }
  if (segs.length > 3) {
    const all = segs.flatMap((s) => s.lines);
    return { intro, segs: [{ g: 'B', lines: all }] };
  }
  return { intro, segs };
}

function leaderOf(stage, faction) {
  return stage.units?.find((u) => u.faction === faction && u.leader)?.name;
}

// 生成一段的背景与人物
function buildSegment(stage, part, seg, i, last, out) {
  const place = STAGE_PLACE[stage.id]?.place || stage.name.replace(/之战.*|战.*$/, '');
  const ter = terrainOf(stage);
  const h = hash(stage.id + part + i);
  const time = /夜|火/.test(seg.lines.map((l) => l.text).join('')) && part === 'post' ? 'night'
    : h % 5 === 0 ? 'dusk' : (part === 'post' && h % 7 === 1 ? 'night' : 'day');
  const speakers = [];
  for (const l of seg.lines) if (l.who !== '旁白' && !speakers.includes(l.who)) speakers.push(l.who);
  const sideMap = Object.fromEntries(seg.lines.filter((l) => l.who !== '旁白').map((l) => [l.who, sideOf(stage, l)]));
  // 只在某些剧情标记下发言的人物（如“典韦未阵亡”），出场同样带上这个条件
  const condOf = {};
  for (const sp of speakers) {
    const ls = seg.lines.filter((l) => l.who === sp);
    const c0 = JSON.stringify(cond(ls[0]));
    condOf[sp] = ls.every((l) => JSON.stringify(cond(l)) === c0) ? cond(ls[0]) : {};
  }
  let bg, kind, lord = null, placeText = place;
  if (seg.g === 'B') {
    bg = OUTER[ter]; kind = 'both';
  } else if (seg.g === 'P') {
    const city = ter === 'city';
    if (part === 'post' && city) { bg = h % 3 === 0 ? 'street' : 'hall'; placeText = `${place}　${bg === 'street' ? '城内' : '府邸'}`; }
    else { bg = h % 3 === 0 ? 'camp' : 'tent'; placeText = `${place}　曹操军主营`; }
    kind = bg === 'street' ? 'line' : 'court';
    const mine = speakers.some((sp) => sideMap[sp] === 'player');
    if (!speakers.includes('曹操') && mine && kind === 'court') { speakers.unshift('曹操'); sideMap['曹操'] = 'player'; condOf['曹操'] = {}; }
    lord = speakers.includes('曹操') ? '曹操' : null;
  } else {
    const boss = leaderOf(stage, 'enemy');
    const head = speakers.includes(boss) ? boss : speakers[0];
    const cls = stage.units?.find((u) => u.name === head)?.cls;
    if (ter === 'city') { bg = cls === 'lord' || cls === 'emperor' ? 'palace' : 'hall'; kind = 'court'; lord = head; }
    else { bg = OUTER[ter]; kind = 'line'; lord = head; }
    placeText = `${place}　${boss || head}军`;
  }
  out.push({ bg, place: placeText, time });

  // 站位
  let slots;
  if (kind === 'both') {
    const P = speakers.filter((sp) => sideMap[sp] !== 'enemy'), E = speakers.filter((sp) => sideMap[sp] === 'enemy');
    const ps = sideSlots(-1, P.length), es = sideSlots(1, E.length);
    slots = Object.fromEntries([...P.map((sp, k) => [sp, ps[k]]), ...E.map((sp, k) => [sp, es[k]])]);
  } else {
    const f = formation(kind, speakers.length, lord ? speakers.indexOf(lord) : -1);
    slots = Object.fromEntries(speakers.map((sp, k) => [sp, f[k]]));
  }
  // 入场：主公直接在主位，其余依次走到站位
  const first = speakers.filter((sp) => sp === lord);
  for (const sp of first) out.push({ actor: sp, side: sideMap[sp], at: slots[sp].at, face: slots[sp].face, ...condOf[sp] });
  for (const sp of speakers) {
    if (sp === lord) continue;
    const s = slots[sp];
    out.push({ actor: sp, side: sideMap[sp], at: s.entry, face: s.face, ...condOf[sp] });
    out.push({ move: sp, to: s.at, face: s.face, wait: false, ...condOf[sp] });
    out.push({ wait: 160 });
  }
  out.push({ join: true });

  // 对白：说话人换人时走到前方，原来在前方的人退回
  let front = null;
  for (const l of seg.lines) {
    if (l.who === '旁白') { out.push({ say: [l] }); continue; }
    const sp = l.who, s = slots[sp], c = { ...condOf[sp], ...cond(l) };
    if (front !== sp) {
      if (front) out.push({ move: front, to: slots[front].at, face: slots[front].face, wait: false, speed: 7, ...condOf[front] });
      out.push({ move: sp, to: add(s.at, s.fwd), face: s.face, speed: 7, ...c });
      front = sp;
    }
    const emo = emoteFor(l.text), pose = poseFor(l.text, sp === lord);
    if (emo) out.push({ emote: sp, icon: emo, ms: 120, ...c });
    if (pose) out.push({ act: sp, pose, ms: 0, ...c });
    out.push({ say: [l] });
    if (pose) out.push({ act: sp, pose: 'stand', ms: 0, ...c });
  }
  if (front) out.push({ move: front, to: slots[front].at, face: slots[front].face, speed: 7, ...condOf[front] });

  // 收尾：最后一段——部下向主公作揖，或全部离场
  if (last) {
    if (lord && kind === 'court') {
      for (const sp of speakers) if (sp !== lord) out.push({ act: sp, pose: 'bow', ms: 0, ...condOf[sp] });
      out.push({ wait: 900 });
    } else {
      for (const sp of speakers) out.push({ exit: sp, to: slots[sp].entry, wait: false, ...condOf[sp] });
      out.push({ join: true });
    }
    out.push({ fade: 'out', ms: 500 });
  }
}

export function autoScene(stage, part = 'pre', ctx = {}) {
  const lines = part === 'pre' ? stage.prologue || [] : postLines(stage, ctx.outcome, ctx.annihilated);
  const out = [];
  if (part === 'pre') out.push({ chapter: stage.chapter, sub: stage.name });
  const { intro, segs } = segment(stage, lines);
  const city = STAGE_PLACE[stage.id]?.city;
  if (intro.length && (part === 'pre' || !segs.length)) {
    // 开场旁白：中国地图上的行军路线
    const from = part === 'pre' ? STAGE_PLACE[prevStage(stage.id)]?.city || '陈留' : null;
    const view = viewFor(from, city);
    out.push({ bg: 'china', view, place: STAGE_PLACE[stage.id]?.place || stage.name });
    if (city) {
      out.push({ map: { show: '曹操', at: from || city, side: 'player' } });
      if (from && from !== city) out.push({ arrow: [from, city], side: 'player' });
      const boss = leaderOf(stage, 'enemy');
      if (part === 'pre' && boss) out.push({ map: { show: boss, at: city, side: 'enemy' } });
    }
    out.push({ say: intro });
    if (!segs.length) out.push({ wait: 400 }, { fade: 'out', ms: 500 });
  } else if (intro.length) {
    segs.length ? segs[0].lines.unshift(...intro) : segs.push({ g: 'P', lines: intro });
  }
  segs.forEach((seg, i) => buildSegment(stage, part, seg, i, i === segs.length - 1, out));
  if (!intro.length && !segs.length) {
    // 没有对白：主营里曹操与部下稍作停留
    out.push({ bg: part === 'pre' ? 'tent' : 'camp', place: `${STAGE_PLACE[stage.id]?.place || stage.name}　曹操军主营` });
    out.push({ actor: '曹操', side: 'player', at: [3, 3], face: 'dr' }, { wait: 900 }, { fade: 'out', ms: 500 });
  }
  return out;
}
