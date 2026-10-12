// 营中场景布局（纯数据 + 纯函数，不依赖 Phaser，校验脚本与寻路测试可直接导入）
// 坐标为剧情场景的等角格子 [a, b]（defs.isoToScreen；a 增大 → 右下，b 增大 → 左下）。曹操与人物都站在整数格上。
//
// 字段：
//   id / name        布局 id 与显示名（军营、城镇……）
//   bg / time        剧情背景（story/defs.js 的 BACKGROUNDS）与时段
//   bounds           可走范围：a、b 在 [min, max] 之间，且 a + b 在 [sumMin, sumMax] 之间（sumMax 34 时脚底不出屏幕）
//   block            矩形障碍 [a0, b0, a1, b1]（含两端），对应背景上画好的帐篷、案几、房屋、水井等；
//                    背景是一整张图，人物会画在它上面，所以高大物件身后被挡住的几格也一并划为障碍
//   props            营中额外画出的物件 { type, at, s?, label? }（camp/props.js），block 写占地矩形，自动挡路
//   spawn / face     曹操出生点与朝向
//   hq               整备功能点：{ at, label }（物件，at 为障碍格，站在旁边使用）或 { at, npc: 名字 }（人物站在 at）
//   shop             商人：{ at, name, face? }（人物站在 at，对话即打开商店）
//   recruit          募兵官：{ at, name, face? }（人物站在 at，对话即打开招募）
//   gate             营门 / 城门：{ at, label }（障碍格，站在旁边确认出征）
//   posts            站岗位置 [a, b, 朝向]，部分武将在此站立不动
//   roam             闲逛区域 [a0, b0, a1, b1]，其余武将随机站位并在区域内走动
//   folk             通用角色（城镇百姓等）{ name, at, roam? }，台词取 generic.js 的 FOLK_TALKS[name]
import { BACKGROUNDS } from '../story/defs.js';
import { findPath, STEPS } from '../story/path.js';

// 通用角色的外形（不必在 characters.js 登记）：兵种决定小人外形，side 决定衣甲颜色
export const FOLK = {
  百姓: { cls: 'infantry', side: 'ally' },
  老者: { cls: 'strategist', side: 'ally' },
  商人: { cls: 'strategist', side: 'ally' },
  随军商人: { cls: 'strategist', side: 'ally' },
  军需官: { cls: 'infantry', side: 'player' },
  募兵官: { cls: 'cavalry', side: 'player' },
  侍从: { cls: 'infantry', side: 'player' },
  卫兵: { cls: 'infantry', side: 'player' },
};

const GATE = (label) => ({ at: [19, 10], label });
const GATE_PROP = { type: 'gate', at: [19, 10], block: [19, 9, 19, 11] };

export const LAYOUTS = {
  // 军营：背景 camp（四顶营帐、帅旗、篝火），左侧营帐为大帐
  camp: {
    id: 'camp', name: '军营', bg: 'camp', time: 'day',
    bounds: { min: 1, max: 19, sumMin: 2, sumMax: 34 },
    block: [[0, 6, 3, 11], [6, 0, 11, 3], [0, 13, 3, 18], [13, 0, 18, 3], [0, 0, 2, 2], [9, 9, 10, 10]],
    props: [GATE_PROP, { type: 'stall', at: [14.5, 17.5], block: [14, 17, 15, 18] }, { type: 'crate', at: [16, 15], block: [16, 15, 16, 15] }],
    spawn: [15, 12], face: 'dl',
    hq: { at: [3, 11], label: '大帐', labelAt: [1.8, 9.5, 120] },
    shop: { at: [13, 17], name: '随军商人', face: 'ur' },
    recruit: { at: [11, 17], name: '募兵官', face: 'ur' },
    gate: GATE('营门'),
    posts: [[5, 13, 'dr'], [12, 5, 'dr'], [7, 7, 'dr'], [13, 12, 'dl'], [6, 16, 'dr'], [16, 6, 'dl']],
    roam: [[4, 4, 15, 15]],
    folk: [],
  },
  // 城镇：背景 street（两侧屋舍、水井、货车），城中有百姓与商人
  town: {
    id: 'town', name: '城镇', bg: 'street', time: 'day',
    bounds: { min: 2, max: 19, sumMin: 4, sumMax: 34 },
    block: [[2, 10, 3, 12], [11, 2, 14, 3]],
    props: [GATE_PROP, { type: 'stall', at: [6.5, 2.5], block: [6, 2, 7, 3] }, { type: 'crate', at: [16, 3], block: [16, 3, 16, 3] }],
    spawn: [15, 12], face: 'dl',
    hq: { at: [9, 5], npc: '军需官', face: 'dr' },
    shop: { at: [5, 4], name: '商人', face: 'dr' },
    recruit: { at: [3, 6], name: '募兵官', face: 'dr' },
    gate: GATE('城门'),
    posts: [[8, 9, 'dr'], [12, 12, 'dl'], [15, 6, 'dl'], [6, 14, 'dr'], [16, 14, 'dl']],
    roam: [[3, 4, 17, 17]],
    folk: [{ name: '百姓', at: [10, 15], roam: true }, { name: '百姓', at: [14, 9], roam: true }, { name: '老者', at: [4, 8] }],
  },
  // 公馆 / 相府：背景 hall（书案、盆栽、屏风）
  hall: {
    id: 'hall', name: '府邸', bg: 'hall', time: 'day',
    bounds: { min: 1, max: 19, sumMin: 2, sumMax: 34 },
    block: [[0, 0, 3, 3], [1, 6, 1, 7], [6, 1, 7, 1], [1, 16, 1, 17], [16, 1, 17, 1]],
    props: [GATE_PROP, { type: 'crate', at: [16, 13], block: [16, 13, 16, 13] }],
    spawn: [15, 12], face: 'dl',
    hq: { at: [3, 3], label: '书案', labelAt: [1.6, 1.4, 80] },
    shop: { at: [14, 15], name: '商人', face: 'ul' },
    recruit: { at: [12, 16], name: '募兵官', face: 'ul' },
    gate: GATE('府门'),
    posts: [[5, 9, 'dr'], [9, 5, 'dl'], [5, 14, 'dr'], [14, 5, 'dl'], [12, 12, 'ul'], [8, 15, 'dr']],
    roam: [[4, 4, 16, 16]],
    folk: [{ name: '侍从', at: [6, 4] }],
  },
  // 野外营地：背景 field（远景透视），营帐、篝火由营中场景画出
  field: {
    id: 'field', name: '野营', bg: 'field', time: 'day',
    bounds: { min: 1, max: 19, sumMin: 9, sumMax: 34 },
    block: [],
    props: [
      GATE_PROP,
      { type: 'tent', at: [5, 5], s: 1.25, label: '大帐', block: [3, 3, 7, 7] },
      { type: 'tent', at: [13, 4], s: 0.95, block: [11, 2, 14, 5] },
      { type: 'tent', at: [4, 13], s: 0.95, block: [2, 11, 5, 14] },
      { type: 'fire', at: [11, 11], block: [11, 11, 11, 11] },
      { type: 'stall', at: [15.5, 16.5], block: [15, 16, 16, 17] },
    ],
    spawn: [15, 12], face: 'dl',
    hq: { at: [7, 7], label: '大帐', labelAt: [5, 5, 140] },
    shop: { at: [14, 16], name: '随军商人', face: 'dr' },
    recruit: { at: [12, 16], name: '募兵官', face: 'ur' },
    gate: GATE('营门'),
    posts: [[8, 9, 'dr'], [9, 8, 'dl'], [15, 8, 'dl'], [8, 15, 'dr'], [14, 13, 'dl']],
    roam: [[6, 6, 17, 17]],
    folk: [],
  },
  // 水寨：背景 river（江面、近岸芦苇），只有岸上可走
  river: {
    id: 'river', name: '水寨', bg: 'river', time: 'day',
    bounds: { min: 1, max: 19, sumMin: 14, sumMax: 34 },
    block: [],
    props: [
      GATE_PROP,
      { type: 'tent', at: [7, 9], s: 1.25, label: '大帐', block: [5, 7, 9, 11] },
      { type: 'tent', at: [14, 6], s: 0.95, block: [12, 4, 15, 7] },
      { type: 'flag', at: [11, 5], block: [11, 5, 11, 5] },
      { type: 'crate', at: [13, 18], block: [13, 18, 13, 18] },
      { type: 'crate', at: [6, 15], block: [6, 15, 6, 15] },
    ],
    spawn: [15, 12], face: 'dl',
    hq: { at: [9, 11], label: '大帐', labelAt: [7, 9, 140] },
    shop: { at: [12, 17], name: '随军商人', face: 'ur' },
    recruit: { at: [10, 17], name: '募兵官', face: 'ur' },
    gate: GATE('寨门'),
    posts: [[10, 7, 'dr'], [16, 7, 'dl'], [9, 14, 'dr'], [14, 11, 'dl'], [11, 19, 'ur']],
    roam: [[7, 7, 18, 18]],
    folk: [],
  },
};

// 各关营中布局（键为即将开始的关卡 id，即营中场景结束后要打的那一战）；未列出的关卡用军营。
// 关卡对象也可以写 camp: '<布局 id>' 覆盖本表。
export const CAMP_OF = {
  zhangxiu1: 'hall', yuanshu: 'town', xuzhou_ruqin: 'hall', bowangpo: 'town', nanpi: 'town',
  liucheng: 'field', rangshan: 'field', changban: 'field', chibi: 'river', chibi_tuwei: 'field', machao: 'river',
  j_ruxu: 'hall', j_xiegu: 'field', j_chibi2: 'river', j_ruxu2: 'river', j_jianye: 'river',
  z_chibi2: 'river', z_ruxu: 'river', z_jianye: 'river', z_yufupu: 'river', z_wuzhang1: 'field', z_wuzhang2: 'field',
};

export function campLayoutOf(stage) {
  const id = (stage && (stage.camp || CAMP_OF[stage.id])) || 'camp';
  return LAYOUTS[id] || LAYOUTS.camp;
}

const inRect = (a, b, [a0, b0, a1, b1]) => a >= a0 && a <= a1 && b >= b0 && b <= b1;

// 静态网格：pass(a, b) 只看范围与障碍（不含人物）；free 为全部可走格；objects 为物件功能点格（障碍）
export function layoutGrid(L) {
  const { min, max, sumMin, sumMax } = L.bounds;
  const rects = [...L.block, ...(L.props || []).filter((p) => p.block).map((p) => p.block)];
  const pass = (a, b) => Number.isInteger(a) && Number.isInteger(b) && a >= min && a <= max && b >= min && b <= max
    && a + b >= sumMin && a + b <= sumMax && !rects.some((r) => inRect(a, b, r));
  const free = [];
  for (let a = min; a <= max; a++) for (let b = min; b <= max; b++) if (pass(a, b)) free.push([a, b]);
  return { pass, free };
}

// 人物站位不能占用的格子：出生点及其周围、各功能点旁边（保证随时走得到）
export function reservedCells(L) {
  const out = new Set();
  const around = ([a, b]) => { out.add(`${a},${b}`); for (const [da, db] of STEPS) out.add(`${a + da},${b + db}`); };
  around(L.spawn);
  around(L.gate.at);
  around(L.hq.at);
  around(L.shop.at);
  around(L.recruit.at);
  return out;
}

// 布局自检（校验脚本、寻路测试调用）：返回错误信息数组
export function checkLayout(L) {
  const errs = [];
  const e = (m) => errs.push(m);
  if (!BACKGROUNDS[L.bg] || BACKGROUNDS[L.bg].kind === 'map') e(`背景不存在或不能用于营中：${L.bg}`);
  const { pass, free } = layoutGrid(L);
  const pt = (p) => Array.isArray(p) && p.length >= 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]);
  const stand = [];
  const need = (p, what) => { if (!pt(p)) e(`${what} 坐标无效：${JSON.stringify(p)}`); else if (!pass(p[0], p[1])) e(`${what} 站在障碍或范围外：${p.slice(0, 2)}`); else stand.push([p, what]); };
  need(L.spawn, '出生点');
  need(L.shop?.at, '商人');
  need(L.recruit?.at, '募兵官');
  if (L.hq?.npc) need(L.hq.at, `整备（${L.hq.npc}）`);
  (L.posts || []).forEach((p, i) => need(p, `站岗位置 ${i}`));
  (L.folk || []).forEach((f) => { need(f.at, `通用角色 ${f.name}`); if (!FOLK[f.name]) e(`通用角色未登记外形：${f.name}`); });
  const spots = new Map();
  for (const [p, what] of stand) { const k = `${p[0]},${p[1]}`; if (spots.has(k)) e(`${what} 与${spots.get(k)}重叠：${k}`); else spots.set(k, what); }
  if (!FOLK[L.shop?.name]) e(`商人未登记外形：${L.shop?.name}`);
  if (!FOLK[L.recruit?.name]) e(`募兵官未登记外形：${L.recruit?.name}`);
  if (L.hq?.npc && !FOLK[L.hq.npc]) e(`整备人物未登记外形：${L.hq.npc}`);
  const objs = [[L.gate?.at, '营门']];
  if (!L.hq?.npc) objs.push([L.hq?.at, '整备']);
  for (const [p, what] of objs) {
    if (!pt(p)) { e(`${what} 坐标无效`); continue; }
    if (pass(p[0], p[1])) e(`${what} 应是障碍格（物件），站在旁边使用：${p}`);
  }
  if (!L.roam?.length) e('没有闲逛区域');
  // 连通：出生点能走到每个站位、每个功能点旁边
  if (pt(L.spawn) && pass(...L.spawn)) {
    for (const [p, what] of stand) if (findPath(pass, L.spawn, p) == null) e(`出生点走不到${what}`);
    for (const [p, what] of [...objs, [L.shop?.at, '商人旁边']]) if (pt(p) && findPath((a, b) => pass(a, b) && !(a === p[0] && b === p[1]), L.spawn, p, { near: true }) == null) e(`出生点走不到${what}`);
  }
  if (free.length < 40) e(`可走格太少：${free.length}`);
  return errs;
}
