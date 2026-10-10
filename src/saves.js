// 存档：100 个手动存档位 + 1 个自动存档（每章胜利后写入）
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

export function writeAuto(data) {
  localStorage.setItem(AUTO_KEY, JSON.stringify({ ...data, kind: 'stage', savedAt: Date.now() }));
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

// 读取存档：写入全局状态后进入战场
export function applyLoad(scene, data) {
  scene.registry.set('roster', data.roster || {});
  scene.registry.set('items', data.items);
  scene.registry.set('difficulty', data.difficulty || 'normal');
  scene.registry.set('red', data.red ?? 0);
  scene.registry.set('flags', data.flags || {});
  scene.scene.start('Battle', { stage: data.stage, load: data.kind === 'battle' ? data : null });
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
  download({ app: FILE_TAG, version: 1, type: 'all', exportedAt: Date.now(), auto: readAuto(), slots: listSlots() }, `曹操传-全部存档-${stamp()}.json`);
}

export function exportSlot(i) {
  download({ app: FILE_TAG, version: 1, type: 'single', exportedAt: Date.now(), save: listSlots()[i] }, `曹操传-存档${String(i + 1).padStart(3, '0')}-${stamp()}.json`);
}

const validSave = (d) => d && typeof d === 'object' && Number.isInteger(d.stage) && d.stage >= 0
  && d.items && typeof d.items === 'object' && (d.kind === 'stage' || (d.kind === 'battle' && Array.isArray(d.units)));

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
    const count = Object.keys(slots).length + (auto ? 1 : 0);
    if (!count) throw new Error('文件中没有可导入的存档');
    const overwrite = Object.keys(slots).filter((i) => local[i]).length + (auto && readAuto() ? 1 : 0);
    return { slots, auto, overwrite, count };
  }
  throw new Error('无法识别的存档格式');
}

export function applyImport(plan) {
  const arr = listSlots();
  for (const [i, d] of Object.entries(plan.slots)) arr[i] = d;
  localStorage.setItem(SLOT_KEY, JSON.stringify(arr));
  if (plan.auto) localStorage.setItem(AUTO_KEY, JSON.stringify(plan.auto));
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
