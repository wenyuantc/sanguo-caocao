// 营中物件：营门、营帐、篝火、货摊、木箱、旗帜（Phaser Graphics 绘制，按前角的屏幕 y 排序，与人物一起遮挡）
// 布局数据见 camp/layouts.js 的 props；坐标为等角格子 [a, b]（可以是小数，表示物件中心）。
import { FONT } from '../config.js';
import { isoToScreen } from '../story/defs.js';
import { text } from '../ui.js';

const P = (a, b, h = 0) => { const p = isoToScreen(a, b); return { x: p.x, y: p.y - h }; };
const depthAt = (a, b) => 100 + isoToScreen(a, b).y / 4;

function poly(g, pts, fill, alpha = 1, line = 0x2a1a0a, lw = 1.2) {
  g.fillStyle(fill, alpha).fillPoints(pts, true);
  if (line != null) g.lineStyle(lw, line, 0.8).strokePoints(pts, true);
}

// 等角方块：底面 [a0,a1]×[b0,b1]，高 h
function box(g, a0, b0, a1, b1, h, top, left, right) {
  poly(g, [P(a0, b1), P(a1, b1), P(a1, b1, h), P(a0, b1, h)], left);
  poly(g, [P(a1, b0), P(a1, b1), P(a1, b1, h), P(a1, b0, h)], right);
  poly(g, [P(a0, b0, h), P(a1, b0, h), P(a1, b1, h), P(a0, b1, h)], top);
}

function shadow(g, a, b, rx, ry) {
  const p = P(a, b);
  g.fillStyle(0x000000, 0.22).fillEllipse(p.x, p.y, rx * 2, ry * 2);
}

const DRAW = {
  // 营门：沿 b 方向的两根门柱 + 横梁 + 匾额（label）
  gate(scene, g, { at: [a, b], label = '营门' }) {
    const posts = [b - 1.3, b + 1.3];
    for (const pb of posts) {
      shadow(g, a, pb, 10, 5);
      box(g, a - 0.18, pb - 0.18, a + 0.18, pb + 0.18, 118, 0x8a5a2a, 0x6a4020, 0x4a2c14);
    }
    const beam = (h, th) => poly(g, [P(a, posts[0] - 0.4, h), P(a, posts[1] + 0.4, h), P(a, posts[1] + 0.4, h + th), P(a, posts[0] - 0.4, h + th)], 0x6a3a18);
    beam(102, 10);
    beam(122, 8);
    // 匾额
    const m = P(a, b, 112);
    g.fillStyle(0x2a1a0c, 1).fillRect(m.x - 30, m.y - 13, 60, 26);
    g.lineStyle(2, 0xd8b050, 1).strokeRect(m.x - 30, m.y - 13, 60, 26);
    // 两侧小旗
    for (const pb of posts) {
      const t = P(a, pb, 150);
      g.fillStyle(0x3a2410, 1).fillRect(t.x - 1.5, t.y, 3, 32);
      poly(g, [{ x: t.x + 1.5, y: t.y }, { x: t.x + 26, y: t.y + 5 }, { x: t.x + 1.5, y: t.y + 16 }], 0xb8281e);
    }
    return [text(scene, m.x, m.y, label, 17, '#f0d070', FONT).setOrigin(0.5)];
  },
  // 营帐：方底尖顶，s 为大小；label 为帐前的帅旗字
  tent(scene, g, { at: [a, b], s = 1, label }) {
    const r = 1.6 * s;
    shadow(g, a + 0.3, b + 0.3, 70 * s, 26 * s);
    const apex = P(a, b, 95 * s);
    const c = [P(a - r, b - r), P(a + r, b - r), P(a + r, b + r), P(a - r, b + r)];
    poly(g, [c[3], c[2], apex], label ? 0xf0e0b8 : 0xe8dcb8, 1, 0x5a4a2a);
    poly(g, [c[1], c[2], apex], label ? 0xd0b888 : 0xc8b890, 1, 0x5a4a2a);
    if (label) {
      // 红色帐檐
      poly(g, [c[3], c[2], P(a + r * 0.82, b + r * 0.82, 18 * s), P(a - r * 0.82, b + r * 0.82, 18 * s)], 0xa8241a, 0.9);
      poly(g, [c[1], c[2], P(a + r * 0.82, b + r * 0.82, 18 * s), P(a + r * 0.82, b - r * 0.82, 18 * s)], 0x8a1c14, 0.9);
    }
    const m = P(a, b + r);
    poly(g, [{ x: m.x - 12 * s, y: m.y - 4 * s }, { x: m.x + 16 * s, y: m.y + 2 * s }, { x: (m.x + apex.x) / 2 + 2, y: (m.y + apex.y) / 2 + 8 }], 0x3a2a14);
    g.fillStyle(0x3a2410, 1).fillRect(apex.x - 1.5, apex.y - 30, 3, 30);
    poly(g, [{ x: apex.x + 1.5, y: apex.y - 30 }, { x: apex.x + 26, y: apex.y - 24 }, { x: apex.x + 1.5, y: apex.y - 17 }], 0xb8281e);
    return [];
  },
  fire(scene, g, { at: [a, b] }) {
    const p = P(a, b);
    g.fillStyle(0x000000, 0.25).fillEllipse(p.x, p.y, 52, 24);
    for (let k = 0; k < 6; k++) {
      const ang = (k * Math.PI) / 3;
      g.fillStyle(0x6a6460, 1).fillEllipse(p.x + Math.cos(ang) * 20, p.y + Math.sin(ang) * 9, 12, 8);
    }
    g.fillStyle(0xffd070, 0.25).fillCircle(p.x, p.y - 12, 34);
    poly(g, [{ x: p.x - 14, y: p.y }, { x: p.x - 6, y: p.y - 30 }, { x: p.x, y: p.y - 12 }, { x: p.x + 6, y: p.y - 36 }, { x: p.x + 14, y: p.y }], 0xffb030, 1, 0xd85010);
    return [];
  },
  // 货摊：木台 + 布篷 + 货物
  stall(scene, g, { at: [a, b] }) {
    shadow(g, a, b, 50, 20);
    for (const [da, db] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
      const p = P(a + da, b + db);
      g.fillStyle(0x4a2c14, 1).fillRect(p.x - 2, p.y - 72, 4, 72);
    }
    box(g, a - 0.9, b - 0.9, a + 0.9, b + 0.9, 24, 0x9a6a3a, 0x6a4424, 0x5a381c);
    for (let i = 0; i < 4; i++) {
      const p = P(a - 0.5 + (i % 2) * 0.9, b - 0.4 + Math.floor(i / 2) * 0.8, 30);
      g.fillStyle([0xe8d8a8, 0xc8402a, 0x6a9a4a, 0xd8b050][i], 1).fillEllipse(p.x, p.y, 16, 10);
    }
    poly(g, [P(a - 1.1, b - 1.1, 76), P(a + 1.1, b - 1.1, 76), P(a + 1.1, b + 1.1, 68), P(a - 1.1, b + 1.1, 68)], 0x2f6fd6, 0.92, 0x1a3a7a);
    return [];
  },
  crate(scene, g, { at: [a, b] }) {
    shadow(g, a, b, 22, 10);
    box(g, a - 0.4, b - 0.4, a + 0.4, b + 0.4, 26, 0xb08050, 0x8a5a30, 0x6a4424);
    box(g, a - 0.3, b - 0.3, a + 0.3, b + 0.3, 40, 0xc89a60, 0x9a6a3a, 0x7a5030);
    return [];
  },
  flag(scene, g, { at: [a, b] }) {
    const p = P(a, b);
    shadow(g, a, b, 10, 5);
    g.fillStyle(0x3a2410, 1).fillRect(p.x - 2.5, p.y - 170, 5, 170);
    poly(g, [{ x: p.x + 2.5, y: p.y - 166 }, { x: p.x + 60, y: p.y - 158 }, { x: p.x + 54, y: p.y - 128 }, { x: p.x + 62, y: p.y - 100 }, { x: p.x + 2.5, y: p.y - 104 }], 0xa8241a, 1, 0xd8b050);
    return [text(scene, p.x + 32, p.y - 132, '曹', 26, '#f0d070', FONT).setOrigin(0.5)];
  },
};

// 画出一个物件，返回显示对象数组（调用方负责销毁）；深度取物件中心（人物在中心之前的格子画在物件前面）
export function drawProp(scene, def) {
  const draw = DRAW[def.type];
  if (!draw) return [];
  const g = scene.add.graphics();
  const extra = draw(scene, g, def);
  const d = depthAt(def.at[0], def.at[1]) + 0.01;
  g.setDepth(d);
  extra.forEach((o) => o.setDepth(d + 0.01));
  return [g, ...extra];
}
