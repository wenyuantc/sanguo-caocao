// 金手指面板：分项开关、军资金、道具（含果子）、装备（含宝物）；战斗中另有“直接胜利”。
// 直接读写 scene.gold / scene.items / scene.inventory，关闭后由场景负责同步（onClose）
import { WIDTH, HEIGHT, FONT, SETTINGS } from './config.js';
import { panel, text, button } from './ui.js';
import { chip } from './settingsMenu.js';
import { saveSettings } from './settings.js';
import { ITEMS } from './data.js';
import { EQUIP, KINDS, newGear, gearName } from './equipment.js';
import { recordTreasures } from './legacy.js';

const GOLD_MAX = 9999999;
const TOGGLES = [['cheatGod', '我方无敌'], ['cheatKill', '我方秒杀'], ['cheatMove', '无限行动']];
const COLS = 3, ROWS = 6, PER_PAGE = COLS * ROWS;
const GEAR_IDS = Object.keys(EQUIP);

// lordLvl：宝物等级按曹操等级；onWin 存在时显示“直接胜利”（先关闭面板再调用）
export function openCheatMenu(scene, { lordLvl = 1, onWin, onClose } = {}) {
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const w = 900, h = 630, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 34, '金 手 指', 30, '#ff7ad9', FONT).setOrigin(0.5));
  const toast = text(scene, WIDTH / 2, y0 + h - 92, '', 16, '#9ce0a8', FONT).setOrigin(0.5);
  root.add(toast);
  const say = (msg, color = '#9ce0a8') => toast.setColor(color).setText(msg);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.input.keyboard?.off('keydown-ESC', close);
    root.destroy();
    onClose?.();
  };

  // 分项开关：高亮为开启，即时保存
  const label = (x, y, s) => root.add(text(scene, x, y + 19, s, 19, '#e9c46a', FONT).setOrigin(0, 0.5));
  label(x0 + 40, y0 + 70, '效　果');
  TOGGLES.forEach(([k, name], i) => {
    const c = chip(scene, x0 + 150 + i * 170, y0 + 70, 156, 38, name, () => {
      SETTINGS[k] = !SETTINGS[k];
      try { saveSettings({ ...SETTINGS }); } catch { /* localStorage 不可用时只在本次生效 */ }
      c.setOn(SETTINGS[k]);
    });
    c.setOn(SETTINGS[k]);
    root.add(c);
  });
  root.add(text(scene, x0 + 670, y0 + 89, '（高亮为开启）', 14, '#a8987a').setOrigin(0, 0.5));

  // 军资金
  label(x0 + 40, y0 + 122, '军资金');
  const goldText = text(scene, x0 + 150, y0 + 141, '', 20, '#ffd36a').setOrigin(0, 0.5);
  root.add(goldText);
  const setGold = (v) => {
    scene.gold = Math.max(0, Math.min(GOLD_MAX, v));
    goldText.setText(`${scene.gold} 金`);
  };
  setGold(scene.gold);
  [1000, 10000, 100000].forEach((n, j) => {
    root.add(button(scene, x0 + 330 + j * 116, y0 + 122, 106, 38, `+${n}`, () => setGold(scene.gold + n), 16));
  });
  // 设定：系统输入框（触屏在抬起时打开）
  root.add(button(scene, x0 + 678, y0 + 122, 106, 38, '设　定…', () => {
    const v = window.prompt(`设定军资金（0 ~ ${GOLD_MAX}）`, String(scene.gold));
    if (v == null) return;
    const t = v.trim();
    if (!/^\d+$/.test(t)) { say('请输入非负整数', '#ff8a7a'); return; }
    setGold(Number(t));
    say(`军资金设为 ${scene.gold}`);
  }, 16, { onRelease: true }));

  // 道具 / 装备两页
  let tab = 'items', page = 0;
  const pages = Math.ceil(GEAR_IDS.length / PER_PAGE);
  const tabs = [['items', '道　具'], ['gear', '装　备']].map(([id, name], j) => {
    const c = chip(scene, x0 + 40 + j * 130, y0 + 176, 120, 38, name, () => { tab = id; refresh(); });
    root.add(c);
    return { id, c };
  });
  const pageText = text(scene, x0 + w - 150, y0 + 195, '', 16, '#f1e3c2').setOrigin(0.5);
  const prev = button(scene, x0 + w - 260, y0 + 176, 70, 38, '上页', () => { page = Math.max(0, page - 1); refresh(); }, 16);
  const next = button(scene, x0 + w - 110, y0 + 176, 70, 38, '下页', () => { page = Math.min(pages - 1, page + 1); refresh(); }, 16);
  root.add([pageText, prev, next]);

  const cw = (w - 80) / COLS, ch = 46, ly = y0 + 228;
  const cell = (i) => ({ x: x0 + 40 + (i % COLS) * cw, y: ly + Math.floor(i / COLS) * ch });
  const addItem = (k, n) => {
    scene.items[k] = (scene.items[k] || 0) + n;
    say(`${ITEMS[k].name} +${n}`);
    refresh();
  };
  const addGear = (id) => {
    const it = newGear(scene.inventory, id, lordLvl);
    if (EQUIP[id].treasure) recordTreasures([id]);
    say(`获得「${gearName(it)}」`);
    refresh();
  };

  let list = null;
  const render = () => {
    if (closed) return;
    list?.destroy();
    list = scene.add.container(0, 0);
    root.add(list);
    tabs.forEach(({ id, c }) => c.setOn(id === tab));
    const gear = tab === 'gear';
    [pageText, prev, next].forEach((o) => o.setVisible(gear));
    if (!gear) {
      Object.keys(ITEMS).forEach((k, i) => {
        const { x, y } = cell(i);
        list.add(text(scene, x + 6, y + 19, `${ITEMS[k].name}　×${scene.items[k] || 0}`, 17, ITEMS[k].fruit ? '#9ce0a8' : '#f1e3c2').setOrigin(0, 0.5));
        list.add(button(scene, x + cw - 128, y + 2, 54, 34, '+1', () => addItem(k, 1), 15));
        list.add(button(scene, x + cw - 68, y + 2, 58, 34, '+10', () => addItem(k, 10), 15));
      });
      return;
    }
    pageText.setText(`${page + 1} / ${pages}`);
    prev.setDisabled(page === 0);
    next.setDisabled(page >= pages - 1);
    GEAR_IDS.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((id, i) => {
      const e = EQUIP[id], { x, y } = cell(i);
      const n = scene.inventory.filter((it) => it.id === id).length;
      // 宝物唯一：已拥有时不能再加
      const b = button(scene, x, y + 2, cw - 10, 38, `${e.treasure ? '★' : ''}${e.name}（${KINDS[e.kind].name}）`, () => addGear(id), 15);
      if (e.treasure && n) b.setDisabled(true);
      list.add(b);
      if (n) list.add(text(scene, x + cw - 18, y + 21, e.treasure ? '已有' : `×${n}`, 13, '#ffd36a').setOrigin(1, 0.5));
    });
  };
  const refresh = () => scene.time.delayedCall(0, render);

  // 直接胜利：二次确认
  const bx = onWin ? WIDTH / 2 - 190 : WIDTH / 2 - 90;
  if (onWin) {
    let armed = false;
    const win = button(scene, bx, y0 + h - 62, 180, 42, '直接胜利', () => {
      if (!armed) { armed = true; win.label.setText('确认胜利？'); return; }
      close();
      onWin();
    }, 18);
    root.add(win);
  }
  root.add(button(scene, onWin ? WIDTH / 2 + 10 : bx, y0 + h - 62, 180, 42, '返　回', close, 18));
  scene.input.keyboard?.on('keydown-ESC', close);
  render();
}
