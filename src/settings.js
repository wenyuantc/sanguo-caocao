// 游戏设置：只影响渲染，不进入存档；修改后需重载页面生效（全屏除外）
const SETTINGS_KEY = 'sanguo-settings';

export const DEFAULT_SETTINGS = { res: 'auto', quality: 'high', fps: 0, showFps: false };

// 各设置项的可选值（设置面板按此顺序显示）
export const SETTING_OPTIONS = {
  res: [['auto', '自动'], [1, '1x'], [1.5, '1.5x'], [2, '2x']],
  quality: [['high', '高'], ['low', '低']],
  // 帧率上限：0 = 跟随屏幕刷新率（60Hz 屏幕上限制为 60 会因计时抖动丢帧，故默认不限）
  fps: [[0, '跟随屏幕'], [60, '60'], [30, '30']],
  showFps: [[true, '开'], [false, '关']],
};

const valid = (k, v) => SETTING_OPTIONS[k].some(([o]) => o === v);

export function loadSettings() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch { /* 损坏时回退默认 */ }
  const s = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') for (const k of Object.keys(s)) if (valid(k, raw[k])) s[k] = raw[k];
  return s;
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// 渲染倍率：自动时按设备像素比取 1 / 1.5 / 2
export function resolveRes(s) {
  if (s.res !== 'auto') return s.res;
  const dpr = globalThis.devicePixelRatio || 1;
  return Math.min(2, Math.max(1, Math.round(dpr * 2) / 2));
}
