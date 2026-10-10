import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, COLORS } from './config.js';
import { classOf } from './data.js';
import { calcStats } from './logic.js';
import { panel, text, button, portrait } from './ui.js';

// 出阵整备：从候选武将中选择出阵阵容；onConfirm(选中的武将 id 数组)
export function openPrep(scene, plan, onConfirm) {
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const w = 1000, h = 600, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  const COLS_N = 4, ROWS_N = 3, PER_PAGE = COLS_N * ROWS_N, cw = 230, ch = 124, gap = 12;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 30, '出 阵 整 备', 30, '#ffd36a', FONT).setOrigin(0.5));
  root.add(text(scene, x0 + 30, y0 + 64, '点选武将上场 / 下场，锁定的武将必须出阵', 15, '#cdbd98'));
  const countText = text(scene, x0 + w - 30, y0 + 60, '', 20, '#f1e3c2', FONT).setOrigin(1, 0);
  const toast = text(scene, x0 + 30, y0 + h - 92, '', 15, '#ff8a7a');
  const pageText = text(scene, x0 + 340, y0 + h - 36, '', 16, '#e9c46a', FONT).setOrigin(0.5);
  const list = scene.add.container(0, 0);
  root.add([list, countText, toast, pageText]);

  const cards = [...plan.pool.filter((c) => c.preset), ...plan.fixedCards, ...plan.pool.filter((c) => !c.preset)];
  const locked = (c) => c.fixed || plan.required.has(c.id);
  const PAGES = Math.max(1, Math.ceil(cards.length / PER_PAGE));
  let selected = new Set(plan.defaults);
  let page = 0;
  let closed = false;
  const count = () => plan.fixed.length + selected.size;

  const turn = (dp) => { const np = Phaser.Math.Clamp(page + dp, 0, PAGES - 1); if (np !== page) { page = np; scene.time.delayedCall(0, render); } };
  const prevKey = () => turn(-1), nextKey = () => turn(1);
  const dispose = () => {
    closed = true;
    scene.input.keyboard?.off('keydown-LEFT', prevKey);
    scene.input.keyboard?.off('keydown-RIGHT', nextKey);
    root.destroy();
  };
  const toggle = (c) => {
    toast.setText('');
    if (locked(c)) toast.setText(`${c.name}必须出阵`);
    else if (selected.has(c.id)) selected.delete(c.id);
    else if (count() >= plan.max) toast.setText(`出阵人数已满（上限 ${plan.max} 人）`);
    else selected.add(c.id);
    scene.time.delayedCall(0, render);
  };

  const prevBtn = button(scene, x0 + 24, y0 + h - 56, 110, 40, '◀ 上一页', prevKey, 17);
  const nextBtn = button(scene, x0 + 144, y0 + h - 56, 110, 40, '下一页 ▶', nextKey, 17);
  const resetBtn = button(scene, x0 + w - 300, y0 + h - 56, 130, 40, '恢复默认', () => {
    selected = new Set(plan.defaults);
    toast.setText('');
    scene.time.delayedCall(0, render);
  }, 18);
  const okBtn = button(scene, x0 + w - 154, y0 + h - 56, 130, 40, '出　阵', () => {
    if (closed) return;
    dispose();
    onConfirm(plan.pool.filter((c) => selected.has(c.id)).map((c) => c.id));
  }, 20);
  root.add([prevBtn, nextBtn, resetBtn, okBtn]);
  scene.input.keyboard?.on('keydown-LEFT', prevKey);
  scene.input.keyboard?.on('keydown-RIGHT', nextKey);

  const render = () => {
    if (closed) return;
    list.removeAll(true);
    countText.setText(`出阵 ${count()} / ${plan.max}`);
    pageText.setText(`第 ${page + 1} / ${PAGES} 页`);
    prevBtn.setDisabled(page === 0);
    nextBtn.setDisabled(page === PAGES - 1);
    cards.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((c, i) => {
      const cx = x0 + 22 + (i % COLS_N) * (cw + gap), cy = y0 + 92 + Math.floor(i / COLS_N) * (ch + gap);
      const on = c.fixed || selected.has(c.id);
      const lock = locked(c);
      const g = scene.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(on ? 0x1c2a44 : hover ? 0x3a2a18 : 0x22160c, 1).fillRoundedRect(cx, cy, cw, ch, 8);
        g.lineStyle(on ? 3 : 1, on ? (lock ? COLORS.gold : 0x6ab8ff) : COLORS.gold, on || hover ? 1 : 0.4).strokeRoundedRect(cx, cy, cw, ch, 8);
      };
      draw(false);
      const zone = scene.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: !lock });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', (p, lx, ly, e) => { e?.stopPropagation?.(); toggle(c); });
      const pt = portrait(scene, cx + 52, cy + ch / 2, c.name, 'player', 84);
      if (!on) pt.setAlpha(0.5);
      const hp = calcStats(c).hp;
      const tag = lock ? ['必须出阵', '#ffd36a'] : on ? ['出　阵', '#9cc8ff'] : ['待　命', '#8a7a60'];
      list.add([g, zone, pt,
        text(scene, cx + 104, cy + 10, c.name, 22, on ? '#fff2cc' : '#bfae88', FONT),
        text(scene, cx + 104, cy + 42, `${classOf(c.cls, c.tier).name}　Lv ${c.lvl}`, 15, '#f1e3c2'),
        text(scene, cx + 104, cy + 66, `兵力 ${hp}`, 15, '#9ce0a8'),
        text(scene, cx + 104, cy + 92, tag[0], 15, tag[1], FONT)]);
    });
  };
  render();
  return root;
}
