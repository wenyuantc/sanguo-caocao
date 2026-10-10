import { WIDTH, HEIGHT, FONT } from './config.js';
import { ITEMS } from './data.js';
import { EQUIP, SLOT_NAME, gearName, gearDesc } from './equipment.js';
import { ensureTextures, gearIcon } from './spellFx.js';
import { panel, text, button } from './ui.js';

// 过关战果：金钱、本关取得的装备（战斗中掉落 + 关卡奖励）与补给道具；点击确定或遮罩关闭
export function openRewards(scene, { gold = 0, gear = [], items = {} } = {}) {
  ensureTextures(scene);
  return new Promise((resolve) => {
    const supplies = Object.entries(items).filter(([id, n]) => n > 0 && ITEMS[id]);
    const rows = Math.min(gear.length, 6);
    const w = 640, h = 230 + rows * 54 + (gear.length > rows ? 24 : 0) + (supplies.length ? 70 : 0);
    const x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
    const root = scene.add.container(0, 0).setDepth(3000);
    const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
    root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
    root.add(text(scene, WIDTH / 2, y0 + 32, '战　果', 30, '#ffd36a', FONT).setOrigin(0.5));
    root.add(text(scene, x0 + 40, y0 + 70, `军资金　+${gold}`, 20, '#ffe08a', FONT));
    let y = y0 + 108;
    root.add(text(scene, x0 + 40, y, gear.length ? '取得装备' : '本关没有取得装备', 16, '#e9c46a', FONT));
    y += 28;
    for (const it of gear.slice(0, rows)) {
      const e = EQUIP[it.id];
      root.add(scene.add.image(x0 + 62, y + 22, gearIcon(it.id)).setScale(40 / 72));
      root.add(text(scene, x0 + 92, y + 2, `${gearName(it)}`, 18, e.treasure ? '#ffd36a' : '#f1e3c2', FONT));
      root.add(text(scene, x0 + 92 + 150, y + 4, `${e.treasure ? '宝物' : '普通'}·${SLOT_NAME[e.slot]}`, 14, '#bfae88'));
      root.add(text(scene, x0 + 92, y + 26, gearDesc(it.id, it.lvl), 13, '#cdbd98').setWordWrapWidth(w - 140));
      y += 54;
    }
    if (gear.length > rows) { root.add(text(scene, x0 + 92, y, `……另有 ${gear.length - rows} 件`, 14, '#bfae88')); y += 24; }
    if (supplies.length) {
      y += 6;
      root.add(text(scene, x0 + 40, y, '补给', 16, '#e9c46a', FONT));
      root.add(text(scene, x0 + 40, y + 26, supplies.map(([id, n]) => `${ITEMS[id].name}×${n}`).join('　'), 16, '#f1e3c2').setWordWrapWidth(w - 80));
    }
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      scene.input.keyboard?.off('keydown-ENTER', close);
      scene.input.keyboard?.off('keydown-SPACE', close);
      root.destroy();
      resolve();
    };
    shade.on('pointerdown', (p, lx, ly, e) => { e?.stopPropagation?.(); close(); });
    root.add(button(scene, WIDTH / 2 - 70, y0 + h - 60, 140, 42, '确　定', close, 20));
    scene.input.keyboard?.on('keydown-ENTER', close);
    scene.input.keyboard?.on('keydown-SPACE', close);
  });
}
