// 存档：100 个手动存档位 + 1 个自动存档（每章胜利后写入）
// 存档类型 kind：'stage' 关卡开头（营门出征时的自动存档，可带 deploy 营中选好的阵容）/ 'battle' 战斗中 / 'camp' 营中（stage 为下一关 id，另记 talked 已对话人物、deploy 营中选好的阵容、pos 曹操位置）
import { isGeneral, setRecruits } from './generals.js';
import { SERIES } from './data.js';
import { readLegacy, writeLegacy, mergeLegacy, normalizeLegacy, recordTreasures } from './legacy.js';

const SLOT_KEY = 'sanguo-slots';
const AUTO_KEY = 'sanguo-save';
export const SLOT_COUNT = 100;

const parse = (s, fallback) => {
  try { return JSON.parse(s) ?? fallback; } catch { return fallback; }
};

export function listSlots() {
  const arr = parse(localStorage.getItem(SLOT_KEY), []);
  return Array.from({ length: SLOT_COUNT }, (_, i) => arr[i] || null);
}

export function writeSlot(i, data) {
  const arr = listSlots();
  arr[i] = { ...data, savedAt: Date.now() };
  localStorage.setItem(SLOT_KEY, JSON.stringify(arr));
}

export function deleteSlot(i) {
  const arr = listSlots();
  arr[i] = null;
  localStorage.setItem(SLOT_KEY, JSON.stringify(arr));
}

export function readAuto() {
  return parse(localStorage.getItem(AUTO_KEY), null);
}

// kind：'camp'（胜利后进营中前写入，读取回到营中）或 'stage'（营门出征时写入，读取播下一关开场）
export function writeAuto(data, kind = 'stage') {
  localStorage.setItem(AUTO_KEY, JSON.stringify({ ...data, kind, savedAt: Date.now() }));
}

export function clearAuto() {
  localStorage.removeItem(AUTO_KEY);
}

export function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 旧存档的道具（豆 / 麦 / 酒）：带 wheat 键的为旧格式，麦 → 米，酒（策略 +20）→ 神秘水
export function migrateItems(items = {}) {
  if (!('wheat' in items)) return { ...items };
  const { wheat, wine, ...rest } = items;
  return { ...rest, rice: (rest.rice || 0) + (wheat || 0), water: (rest.water || 0) + (wine || 0) };
}

// 把存档中的战役状态写入 registry（读档与地图版本不一致时的重开共用）
export function restoreRegistry(scene, data) {
  data = { ...data, items: migrateItems(data.items) };
  // 旧存档的 roster 没有 tier（阶级）：视为一阶
  const roster = Object.fromEntries(Object.entries(data.roster || {}).map(([id, r]) => [id, { ...r, tier: r.tier || 1 }]));
  scene.registry.set('roster', roster);
  // 招募单位（旧存档没有）：先同步镜像，下面的 joined 过滤才认得招募 id
  const recruits = Object.fromEntries(Object.entries(data.recruits && typeof data.recruits === 'object' ? data.recruits : {})
    .filter(([, r]) => typeof r?.name === 'string' && SERIES[r.cls]));
  scene.registry.set('recruits', recruits);
  setRecruits(recruits);
  scene.registry.set('recruitPool', Array.isArray(data.recruitPool?.names) ? data.recruitPool : null);
  // 旧存档没有加入记录：用 roster 中的武将推导
  scene.registry.set('joined', Array.isArray(data.joined) ? data.joined.filter(isGeneral) : Object.keys(roster).filter(isGeneral));
  scene.registry.set('items', data.items);
  scene.registry.set('difficulty', data.difficulty || 'normal');
  scene.registry.set('red', data.red ?? 0);
  scene.registry.set('flags', data.flags || {});
  // 旧存档没有装备与金钱：背包为空，进入战斗时按原版规则补发初始装备
  scene.registry.set('inventory', Array.isArray(data.inventory) ? data.inventory : []);
  scene.registry.set('gold', data.gold ?? 0);
  // 金手指进度标记（旧存档没有：视为未使用）
  scene.registry.set('cheated', !!data.cheated);
  // 存档里持有的宝物补登图鉴（有图鉴之前的存档）
  if (Array.isArray(data.inventory)) recordTreasures(data.inventory.map((it) => it?.id));
}

// 读取存档：写入全局状态后进入战场；营中存档（kind: 'camp'）回到营中；
// 关卡开头存档（kind: 'stage'）先播开场场景，营门出征时选好的阵容（deploy）带进整备
export function applyLoad(scene, data) {
  restoreRegistry(scene, data);
  if (data.kind === 'camp') {
    scene.scene.start('Camp', { stage: data.stage, talked: data.talked, deploy: data.deploy, pos: data.pos });
    return;
  }
  if (data.kind === 'battle') { scene.scene.start('Battle', { stage: data.stage, load: data }); return; }
  scene.scene.start('Battle', { stage: data.stage, load: null, deploy: Array.isArray(data.deploy) ? data.deploy : null });
}

// 战斗中存档的地图版本与关卡不一致时，找本关开头的状态作为重开起点：
// 自动存档在上一关胜利时（kind: 'camp'，进营中前）和营门出征时（kind: 'stage'，含营中选项与阵容）写入，
// stage 都是下一关 id，所以 stage 指向本关的自动存档就是本关开头的快照（出征时那份覆盖胜利时那份，优先被找到）。
// 还要求难度相同、且不晚于该战斗存档（更晚的自动存档属于之后另一次进入本关，状态不同）。
// idOf 把关卡字段（旧存档可能是数字下标）换成关卡 id。找不到时返回 null。
export function stageStartSave(load, stageId, idOf = (s) => s) {
  const auto = readAuto();
  if (!auto || (auto.kind !== 'stage' && auto.kind !== 'camp') || idOf(auto.stage) !== stageId) return null;
  if ((auto.difficulty || 'normal') !== (load.difficulty || 'normal')) return null;
  if (auto.savedAt && load.savedAt && auto.savedAt > load.savedAt) return null;
  return auto;
}

// ---------- 导出 / 导入 ----------
const FILE_TAG = 'sanguo-caocao-save';

function download(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => formatTime(Date.now()).replace(/[-: ]/g, '').replace(/^(\d{8})/, '$1-');

export function exportAll() {
  download({ app: FILE_TAG, version: 1, type: 'all', exportedAt: Date.now(), auto: readAuto(), slots: listSlots(), legacy: readLegacy() }, `曹操传-全部存档-${stamp()}.json`);
}

export function exportSlot(i) {
  download({ app: FILE_TAG, version: 1, type: 'single', exportedAt: Date.now(), save: listSlots()[i] }, `曹操传-存档${String(i + 1).padStart(3, '0')}-${stamp()}.json`);
}

// 关卡字段：当前存档为字符串关卡 id，旧存档为数字下标
const validStage = (v) => (typeof v === 'string' && v.length > 0) || (Number.isInteger(v) && v >= 0);
const validSave = (d) => d && typeof d === 'object' && validStage(d.stage)
  && d.items && typeof d.items === 'object' && (d.joined == null || Array.isArray(d.joined))
  && (d.recruits == null || (typeof d.recruits === 'object' && !Array.isArray(d.recruits)))
  && (d.recruitPool == null || Array.isArray(d.recruitPool.names))
  && (d.kind === 'stage' || (d.kind === 'battle' && Array.isArray(d.units)) || (d.kind === 'camp' && (d.talked == null || Array.isArray(d.talked))));

// 本地是否有可导出的结局记录 / 图鉴
export const hasLegacy = () => { const d = readLegacy(); return !!(Object.keys(d.endings).length || d.codex.length); };

// 解析导入文件，返回导入计划（不写入）；格式错误时抛出中文错误信息
export function planImport(textContent) {
  let obj;
  try { obj = JSON.parse(textContent); } catch { throw new Error('文件不是有效的 JSON'); }
  if (obj?.app !== FILE_TAG) throw new Error('不是本游戏的存档文件');
  const local = listSlots();
  if (obj.type === 'single') {
    if (!validSave(obj.save)) throw new Error('存档内容已损坏');
    const index = local.findIndex((d) => !d);
    if (index < 0) throw new Error('存档位已满，请先删除部分存档');
    return { slots: { [index]: obj.save }, auto: null, overwrite: 0, count: 1, target: index };
  }
  if (obj.type === 'all' && Array.isArray(obj.slots)) {
    const slots = {};
    obj.slots.slice(0, SLOT_COUNT).forEach((d, i) => { if (validSave(d)) slots[i] = d; });
    const auto = validSave(obj.auto) ? obj.auto : null;
    // 结局记录与图鉴（旧导出文件没有）：导入时与本地合并
    const lg = normalizeLegacy(obj.legacy);
    const legacy = Object.keys(lg.endings).length || lg.codex.length ? lg : null;
    const count = Object.keys(slots).length + (auto ? 1 : 0);
    if (!count && !legacy) throw new Error('文件中没有可导入的存档');
    const overwrite = Object.keys(slots).filter((i) => local[i]).length + (auto && readAuto() ? 1 : 0);
    return { slots, auto, legacy, overwrite, count };
  }
  throw new Error('无法识别的存档格式');
}

export function applyImport(plan) {
  const arr = listSlots();
  for (const [i, d] of Object.entries(plan.slots)) arr[i] = d;
  localStorage.setItem(SLOT_KEY, JSON.stringify(arr));
  if (plan.auto) localStorage.setItem(AUTO_KEY, JSON.stringify(plan.auto));
  if (plan.legacy) writeLegacy(mergeLegacy(readLegacy(), plan.legacy));
}

// 打开系统文件选择框，读取文本
export function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}
