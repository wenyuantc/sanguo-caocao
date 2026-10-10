import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, COLORS, FACTION_NAME } from './config.js';
import { classOf } from './data.js';
import { panel, text, button } from './ui.js';

const TABS = ['player', 'ally', 'enemy'];
const STANCE = { aggressive: '进攻', hold: '固守', peace: '中立' };

// 部队情报：分我军 / 友军 / 敌军三页列出在场单位；点击某行回调 onPick(unit)
export function openInfo(scene, { onPick, onClose }) {
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const PER_PAGE = 12, rowH = 32;
  const w = 820, h = 180 + (PER_PAGE + 1) * rowH, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 28, '部 队 情 报', 28, '#ffd36a', FONT).setOrigin(0.5));
  const pageText = text(scene, x0 + 330, y0 + h - 36, '', 16, '#e9c46a', FONT).setOrigin(0.5);
  const list = scene.add.container(0, 0);
  const tabMark = scene.add.graphics();
  root.add([list, pageText, tabMark]);

  const unitsOf = (f) => scene.units.filter((u) => u.alive && u.faction === f);
  let tab = 'player', page = 0, closed = false;
  const pages = () => Math.max(1, Math.ceil(unitsOf(tab).length / PER_PAGE));
  const turn = (dp) => { const np = Phaser.Math.Clamp(page + dp, 0, pages() - 1); if (np !== page) { page = np; scene.time.delayedCall(0, render); } };
  const prevKey = () => turn(-1), nextKey = () => turn(1);
  const dispose = () => {
    closed = true;
    scene.input.keyboard?.off('keydown-ESC', close);
    scene.input.keyboard?.off('keydown-LEFT', prevKey);
    scene.input.keyboard?.off('keydown-RIGHT', nextKey);
    root.destroy();
    onClose?.();
  };
  function close() { if (!closed) dispose(); }

  const tabBtns = TABS.map((f, i) => {
    const b = button(scene, x0 + 30 + i * 130, y0 + 56, 120, 36, `${FACTION_NAME[f]} ${unitsOf(f).length}`, () => {
      tab = f; page = 0; scene.time.delayedCall(0, render);
    }, 17);
    root.add(b);
    return b;
  });
  const prevBtn = button(scene, x0 + 24, y0 + h - 56, 110, 40, '◀ 上一页', prevKey, 17);
  const nextBtn = button(scene, x0 + 144, y0 + h - 56, 110, 40, '下一页 ▶', nextKey, 17);
  root.add([prevBtn, nextBtn, button(scene, x0 + w - 134, y0 + h - 56, 110, 40, '关　闭', close, 18)]);
  scene.input.keyboard?.on('keydown-ESC', close);
  scene.input.keyboard?.on('keydown-LEFT', prevKey);
  scene.input.keyboard?.on('keydown-RIGHT', nextKey);

  const COLS_X = [0, 150, 260, 340, 500, 630];
  const HEAD = ['名字', '兵种', '等级', '兵力', '策略', '状态'];
  const render = () => {
    if (closed) return;
    list.removeAll(true);
    const i0 = TABS.indexOf(tab);
    tabMark.clear().fillStyle(COLORS.gold, 1).fillRect(x0 + 30 + i0 * 130, y0 + 94, 120, 3);
    const units = unitsOf(tab);
    pageText.setText(`第 ${page + 1} / ${pages()} 页`);
    prevBtn.setDisabled(page === 0);
    nextBtn.setDisabled(page >= pages() - 1);
    const lx = x0 + 40, hy = y0 + 106;
    HEAD.forEach((s, i) => list.add(text(scene, lx + COLS_X[i], hy, s, 15, '#e9c46a', FONT)));
    if (!units.length) list.add(text(scene, WIDTH / 2, hy + 60, `没有在场的${FACTION_NAME[tab]}`, 17, '#8a7a60').setOrigin(0.5));
    units.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((u, i) => {
      const y = hy + 26 + i * rowH;
      const g = scene.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(hover ? 0x5a3a1a : i % 2 ? 0x2a1c10 : 0x22160c, 1).fillRoundedRect(x0 + 24, y, w - 48, rowH - 4, 4);
      };
      draw(false);
      const zone = scene.add.zone(x0 + 24, y, w - 48, rowH - 4).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', (p, px, py, e) => {
        e?.stopPropagation?.();
        close();
        onPick(u);
      });
      const status = u.faction === 'player' ? (u.acted ? '已行动' : '待命中') : STANCE[u.ai] || '进攻';
      const cells = [u.name, classOf(u.cls, u.tier).name, `Lv ${u.lvl}`, `${u.hp} / ${u.stats.hp}`, `${u.mp} / ${u.stats.mp}`, status];
      const colors = ['#fff2cc', '#f1e3c2', '#f1e3c2', '#9ce0a8', '#9cc8ff', u.faction === 'player' && u.acted ? '#8a7a60' : '#f1e3c2'];
      list.add([g, zone, ...cells.map((s, k) => text(scene, lx + COLS_X[k], y + 4, s, 15, colors[k], k === 0 ? FONT : undefined))]);
    });
    tabBtns.forEach((b, k) => b.label.setColor(TABS[k] === tab ? '#ffd36a' : '#f6e7c1'));
  };
  render();
  return root;
}
