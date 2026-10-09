import { COLORS, FONT, UI_FONT, WIDTH, HEIGHT } from './config.js';
import { portraitTexture } from './portraits.js';

export function panel(scene, x, y, w, h, alpha = 0.95) {
  const g = scene.add.graphics();
  g.fillStyle(COLORS.panel, alpha).fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(2, COLORS.gold, 0.9).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 8);
  g.lineStyle(1, COLORS.gold, 0.35).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, 6);
  return g;
}

export function text(scene, x, y, str, size = 16, color = '#f1e3c2', font = UI_FONT) {
  return scene.add.text(x, y, str, { fontFamily: font, fontSize: `${size}px`, color });
}

export function button(scene, x, y, w, h, label, onClick, size = 18) {
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (hover, disabled) => {
    bg.clear();
    bg.fillStyle(disabled ? 0x2a2420 : hover ? 0x7a4a1c : 0x4a2e14, 1).fillRoundedRect(0, 0, w, h, 6);
    bg.lineStyle(2, disabled ? 0x5a5040 : COLORS.gold, 1).strokeRoundedRect(0, 0, w, h, 6);
  };
  draw(false);
  const t = text(scene, w / 2, h / 2, label, size, '#f6e7c1', FONT).setOrigin(0.5);
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  c.add([bg, t, zone]);
  c.disabled = false;
  zone.on('pointerover', () => !c.disabled && draw(true));
  zone.on('pointerout', () => draw(false, c.disabled));
  zone.on('pointerdown', (p, lx, ly, ev) => {
    ev?.stopPropagation?.();
    if (!c.disabled) onClick();
  });
  c.setDisabled = (d) => { c.disabled = d; draw(false, d); t.setAlpha(d ? 0.45 : 1); return c; };
  c.label = t;
  return c;
}


// 高清半身头像
export function portrait(scene, x, y, name, side, size = 96) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x120c07, 1).fillRect(-size / 2 - 4, -size / 2 - 4, size + 8, size + 8);
  const img = scene.add.image(0, 0, portraitTexture(scene, name, side)).setDisplaySize(size, size);
  const frame = scene.add.graphics();
  frame.lineStyle(3, COLORS.gold, 1).strokeRect(-size / 2, -size / 2, size, size);
  frame.fillStyle(0x000000, 0.55).fillRect(-size / 2, size * 0.3, size, size * 0.2);
  const t = text(scene, 0, size * 0.4, name, Math.max(12, size * 0.15), '#fff6dd', FONT).setOrigin(0.5).setStroke('#000', 3);
  c.add([g, img, frame, t]);
  return c;
}

// 对话框：show(lines) 返回 Promise，点击推进
export class DialogBox {
  constructor(scene) {
    this.scene = scene;
    const h = 170, y = HEIGHT - h - 12;
    this.root = scene.add.container(0, 0).setDepth(1000).setVisible(false);
    const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.25).setOrigin(0).setInteractive();
    const bg = panel(scene, 40, y, WIDTH - 80, h, 0.96);
    this.portraitHolder = scene.add.container(120, y + h / 2);
    this.nameText = text(scene, 200, y + 18, '', 24, '#e9c46a', FONT);
    this.bodyText = text(scene, 200, y + 58, '', 22, '#f6ecd2', FONT).setWordWrapWidth(WIDTH - 300).setLineSpacing(8);
    this.hint = text(scene, WIDTH - 70, y + h - 30, '▼', 18, '#e9c46a').setOrigin(1, 0);
    scene.tweens.add({ targets: this.hint, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
    this.root.add([shade, bg, this.portraitHolder, this.nameText, this.bodyText, this.hint]);
    shade.on('pointerdown', () => this.next());
  }

  show(lines) {
    if (!lines?.length) return Promise.resolve();
    this.lines = [...lines];
    this.root.setVisible(true);
    return new Promise((res) => { this.resolve = res; this.next(); });
  }

  next() {
    if (this.typing) { this.typing.remove(); this.typing = null; this.bodyText.setText(this.full); return; }
    const line = this.lines.shift();
    if (!line) { this.root.setVisible(false); this.resolve?.(); return; }
    this.portraitHolder.removeAll(true);
    const narr = line.who === '旁白';
    if (!narr) this.portraitHolder.add(portrait(this.scene, 0, 0, line.who, line.side, 136));
    this.nameText.setText(narr ? '' : line.who);
    this.bodyText.setX(narr ? 90 : 200);
    this.full = line.text;
    let i = 0;
    this.bodyText.setText('');
    this.typing = this.scene.time.addEvent({
      delay: 28, repeat: this.full.length - 1,
      callback: () => {
        this.bodyText.setText(this.full.slice(0, ++i));
        if (i >= this.full.length) this.typing = null;
      },
    });
  }
}

export function floatText(scene, x, y, str, color = '#ffffff', size = 22) {
  const t = text(scene, x, y, str, size, color, FONT).setOrigin(0.5).setStroke('#000', 5).setDepth(900);
  scene.tweens.add({ targets: t, y: y - 40, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}

export const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));
