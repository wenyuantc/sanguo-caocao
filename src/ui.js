import { COLORS, FONT, UI_FONT, WIDTH, HEIGHT } from './config.js';
import { portraitTexture } from './portraits.js';
import { sfx } from './audio/sfx.js';

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
    if (c.disabled) return;
    // 点击音：返回 / 取消类按钮（标签去掉空格后以这些词开头）用取消音
    sfx(/^(返回|取消|关闭|放弃)/.test(t.text.replace(/\s/g, '')) ? 'cancel' : 'confirm');
    onClick();
  });
  c.setDisabled = (d) => { c.disabled = d; draw(false, d); t.setAlpha(d ? 0.45 : 1); return c; };
  c.label = t;
  return c;
}

// 滑条：value 取 min–max 的整数（按 step），拖动时调用 onChange(v)；右侧显示数值。返回 Container，带 .value、.setValue(v)
export function slider(scene, x, y, w, value, onChange, { min = 0, max = 100, step = 1 } = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const label = text(scene, w + 16, 0, '', 17, '#f1e3c2').setOrigin(0, 0.5);
  const zone = scene.add.zone(-10, -18, w + 20, 36).setOrigin(0).setInteractive({ useHandCursor: true });
  const draw = () => {
    const k = (c.value - min) / (max - min);
    g.clear();
    g.fillStyle(0x2a1b0e, 1).fillRoundedRect(0, -4, w, 8, 4);
    g.lineStyle(1, COLORS.gold, 0.5).strokeRoundedRect(0, -4, w, 8, 4);
    if (k > 0) g.fillStyle(0x8a5a1c, 1).fillRoundedRect(0, -4, Math.max(8, w * k), 8, 4);
    g.fillStyle(0xffd36a, 1).fillCircle(w * k, 0, 9);
    g.lineStyle(2, 0x3a1800, 1).strokeCircle(w * k, 0, 9);
    label.setText(String(c.value));
  };
  c.setValue = (v) => { c.value = Math.max(min, Math.min(max, Math.round(v / step) * step)); draw(); return c; };
  // 按住后在滑条区域内移动即可拖动；在场景任意处抬起结束
  let dragging = false;
  const pick = (lx) => {
    const old = c.value;
    c.setValue(min + ((lx - 10) / w) * (max - min));
    if (c.value !== old) onChange(c.value);
  };
  zone.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); dragging = true; pick(lx); });
  zone.on('pointermove', (p, lx) => { if (dragging && p.isDown) pick(lx); });
  const stop = () => { dragging = false; };
  scene.input.on('pointerup', stop);
  c.once('destroy', () => scene.input.off('pointerup', stop));
  c.add([g, label, zone]);
  c.setValue(value);
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
    // 阻止冒泡：推进对白的点击不传到场景（战场在抬起时按地图点击处理，否则最后一句关闭后会点到下面的格子）
    shade.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); this.next(); });
  }

  show(lines) {
    // 对白行可带 ifFlag / unlessFlag，按剧情标记筛选
    if (lines && this.scene.flagOk) lines = lines.filter((l) => this.scene.flagOk(l));
    if (!lines?.length) return Promise.resolve();
    this.lines = [...lines];
    this.root.setVisible(true);
    return new Promise((res) => { this.resolve = res; this.next(); });
  }

  // 剧情选项：choices [{ text, red, flag, reply: [对白] }]
  showChoices(line) {
    const opts = line.choices;
    this.choiceBox = this.scene.add.container(0, 0);
    const w = 520, h = 46, x = (WIDTH - w) / 2, y0 = HEIGHT - 200 - opts.length * (h + 10);
    opts.forEach((c, i) => {
      const b = button(this.scene, x, y0 + i * (h + 10), w, h, c.text, () => {
        this.choiceBox.destroy();
        this.choiceBox = null;
        this.onChoice?.(c);
        if (c.reply) this.lines.unshift(...c.reply);
        this.scene.time.delayedCall(0, () => this.next());
      }, 19);
      this.choiceBox.add(b);
    });
    this.root.add(this.choiceBox);
  }

  next() {
    if (this.choiceBox) return;
    const cur = this.current;
    if (this.typing) {
      this.typing.remove(); this.typing = null; this.bodyText.setText(this.full);
      if (cur?.choices && !cur.chosen) { cur.chosen = true; this.showChoices(cur); }
      return;
    }
    if (cur?.choices && !cur.chosen) { cur.chosen = true; this.showChoices(cur); return; }
    const line = this.lines.shift();
    this.current = line ? { ...line } : null;
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
        if (i >= this.full.length) {
          this.typing = null;
          const c = this.current;
          if (c?.choices && !c.chosen) { c.chosen = true; this.showChoices(c); }
        }
      },
    });
  }
}

// 上浮数字：位于地图层（世界坐标，随镜头滚动），见 mapCamera.isMapSpace
export function floatText(scene, x, y, str, color = '#ffffff', size = 22) {
  const t = text(scene, x, y, str, size, color, FONT).setOrigin(0.5).setStroke('#000', 5).setDepth(900);
  t.mapSpace = true;
  scene.tweens.add({ targets: t, y: y - 40, alpha: { from: 1, to: 0 }, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  return t;
}

export const wait = (scene, ms) => new Promise((r) => scene.time.delayedCall(ms, r));
