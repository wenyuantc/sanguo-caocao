import * as Phaser from 'phaser';
import { tileCenter } from './unitView.js';
import { text } from './ui.js';
import { FONT } from './config.js';
import { ITEMS, SPELLS } from './data.js';

// 策略 / 道具特效：先生成高清特效贴图，再用补间组合
const D = 720;
const R = 3; // 贴图分辨率倍数
const ADD = Phaser.BlendModes.ADD;

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w * R, h * R);
  const ctx = tex.getContext();
  ctx.scale(R, R);
  draw(ctx, w, h);
  tex.refresh();
}

function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function ensureTextures(s) {
  canvasTex(s, 'fx-flame', 24, 40, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(12, 1);
    ctx.bezierCurveTo(16, 12, 23, 20, 22, 29);
    ctx.bezierCurveTo(21, 36, 16, 39, 12, 39);
    ctx.bezierCurveTo(8, 39, 3, 36, 2, 29);
    ctx.bezierCurveTo(1, 20, 8, 12, 12, 1);
    ctx.fillStyle = radial(ctx, 12, 33, 34, [[0, 'rgba(255,248,190,1)'], [0.22, 'rgba(255,190,50,1)'], [0.5, 'rgba(245,100,20,0.95)'], [0.8, 'rgba(200,40,10,0.8)'], [1, 'rgba(150,20,0,0)']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,30,0,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
  });
  canvasTex(s, 'fx-glow', 32, 32, (ctx) => {
    ctx.fillStyle = radial(ctx, 16, 16, 16, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 32, 32);
  });
  canvasTex(s, 'fx-smoke', 32, 32, (ctx) => {
    ctx.fillStyle = radial(ctx, 16, 16, 16, [[0, 'rgba(70,62,56,0.75)'], [0.6, 'rgba(90,82,74,0.35)'], [1, 'rgba(100,90,80,0)']]);
    ctx.fillRect(0, 0, 32, 32);
  });
  canvasTex(s, 'fx-spark', 16, 16, (ctx) => {
    ctx.fillStyle = radial(ctx, 8, 8, 8, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(9, 7); ctx.lineTo(16, 8); ctx.lineTo(9, 9); ctx.lineTo(8, 16); ctx.lineTo(7, 9); ctx.lineTo(0, 8); ctx.lineTo(7, 7); ctx.closePath(); ctx.fill();
  });
  for (let v = 0; v < 3; v++) {
    canvasTex(s, `fx-rock${v}`, 24, 22, (ctx) => {
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 8, r = 8 + ((i * 7 + v * 3) % 5);
        return [12 + Math.cos(a) * r, 11 + Math.sin(a) * r * 0.85];
      });
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      const g = ctx.createLinearGradient(4, 2, 20, 20);
      g.addColorStop(0, '#c8baa0'); g.addColorStop(0.5, '#8a7a62'); g.addColorStop(1, '#4a3e30');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(9, 6); ctx.lineTo(12, 11); ctx.lineTo(10, 16); ctx.moveTo(12, 11); ctx.lineTo(17, 12); ctx.stroke();
      ctx.fillStyle = 'rgba(255,250,230,0.35)'; ctx.beginPath(); ctx.ellipse(9, 7, 3, 2, -0.5, 0, Math.PI * 2); ctx.fill();
    });
  }
  // 道具图标（逻辑 24x24）
  canvasTex(s, 'fx-bean', 24, 24, (ctx) => {
    const bag = ctx.createLinearGradient(4, 8, 20, 23);
    bag.addColorStop(0, '#e8d4a8'); bag.addColorStop(1, '#a08050');
    ctx.fillStyle = bag; ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(6, 10); ctx.quadraticCurveTo(2, 22, 8, 23); ctx.lineTo(16, 23); ctx.quadraticCurveTo(22, 22, 18, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,0.5)'; ctx.lineWidth = 0.5;
    for (const x of [9, 12, 15]) { ctx.beginPath(); ctx.moveTo(x, 13); ctx.lineTo(x - 1, 22); ctx.stroke(); }
    ctx.fillStyle = '#c8a870'; ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(12, 10, 6.8, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (const [x, y] of [[9, 9], [12, 8], [15, 9], [10.5, 10.5], [13.5, 10.5], [12, 6.5]]) {
      ctx.fillStyle = '#5aa83a'; ctx.beginPath(); ctx.ellipse(x, y, 1.7, 1.3, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a5a18'; ctx.lineWidth = 0.4; ctx.stroke();
      ctx.fillStyle = 'rgba(220,255,180,0.8)'; ctx.beginPath(); ctx.arc(x - 0.5, y - 0.4, 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#8a3a1e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(5.5, 12.5); ctx.quadraticCurveTo(12, 15, 18.5, 12.5); ctx.stroke();
  });
  canvasTex(s, 'fx-wheat', 24, 24, (ctx) => {
    for (const [x0, x1] of [[12, 6], [12, 12], [12, 18], [12, 9], [12, 15]]) {
      ctx.strokeStyle = '#b08a30'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(12, 23); ctx.quadraticCurveTo(x0, 14, x1, 7); ctx.stroke();
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
        const t = i / 4, x = x1 + (12 - x1) * t * 0.35, y = 2.5 + i * 2.1;
        ctx.fillStyle = i % 2 ? '#f6d460' : '#e8b840'; ctx.strokeStyle = '#8a6418'; ctx.lineWidth = 0.35;
        ctx.beginPath(); ctx.ellipse(x + sx * 1.1, y + 1, 0.95, 1.7, sx * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#f0d890'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(x1, 2.5); ctx.lineTo(x1 + (x1 - 12) * 0.15, -0.5); ctx.stroke();
    }
    ctx.fillStyle = '#9a6a30'; ctx.strokeStyle = '#4a3010'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(12, 16, 3.6, 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  canvasTex(s, 'fx-wine', 24, 24, (ctx) => {
    const jar = ctx.createLinearGradient(4, 0, 20, 0);
    jar.addColorStop(0, '#5a2a14'); jar.addColorStop(0.35, '#b0683a'); jar.addColorStop(1, '#4a200e');
    ctx.fillStyle = jar; ctx.strokeStyle = '#2a1006'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(8.5, 6); ctx.lineTo(15.5, 6); ctx.quadraticCurveTo(22, 11, 19, 21); ctx.quadraticCurveTo(12, 24, 5, 21); ctx.quadraticCurveTo(2, 11, 8.5, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,190,0.25)'; ctx.beginPath(); ctx.ellipse(8, 12, 1.4, 4, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8c090'; ctx.beginPath(); ctx.ellipse(12, 5, 4.6, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c8281e'; ctx.beginPath(); ctx.ellipse(12, 3.6, 3.4, 1.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(7.5, 7.5); ctx.quadraticCurveTo(12, 9, 16.5, 7.5); ctx.stroke();
    ctx.fillStyle = '#d8302a'; ctx.strokeStyle = '#7a1008'; ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(17, 14.5); ctx.lineTo(12, 19); ctx.lineTo(7, 14.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe8b0'; ctx.font = 'bold 5.5px "STKaiti","KaiTi",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('酒', 12, 14.8);
  });
  canvasTex(s, 'fx-seal', 24, 24, (ctx) => {
    // 印绶：金印 + 印钮 + 红色绶带
    ctx.strokeStyle = '#7a1008'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(12, 9); ctx.quadraticCurveTo(4, 12, 5, 22); ctx.moveTo(12, 9); ctx.quadraticCurveTo(19, 13, 18, 22); ctx.stroke();
    ctx.strokeStyle = '#d8302a'; ctx.lineWidth = 1.3; ctx.stroke();
    const gold = ctx.createLinearGradient(5, 10, 19, 22);
    gold.addColorStop(0, '#fff2b0'); gold.addColorStop(0.45, '#f0c848'); gold.addColorStop(1, '#8a6410');
    ctx.fillStyle = gold; ctx.strokeStyle = '#4a3008'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.rect(6, 11, 12, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 11); ctx.quadraticCurveTo(12, 2, 16, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a1008'; ctx.font = 'bold 6px "STKaiti","KaiTi",serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('印', 12, 16.5);
  });
  // 道具碎粒
  canvasTex(s, 'fx-beanlet', 8, 8, (ctx) => {
    ctx.fillStyle = '#6ac048'; ctx.strokeStyle = '#2a5a18'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.ellipse(4, 4, 3, 2.2, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e0ffc0'; ctx.beginPath(); ctx.arc(3, 3.2, 0.8, 0, Math.PI * 2); ctx.fill();
  });
  canvasTex(s, 'fx-grain', 8, 8, (ctx) => {
    ctx.fillStyle = '#f6d460'; ctx.strokeStyle = '#8a6418'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.ellipse(4, 4, 1.7, 3, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  canvasTex(s, 'fx-drop', 8, 10, (ctx) => {
    ctx.fillStyle = radial(ctx, 3.5, 6.5, 4.5, [[0, '#e8f8ff'], [0.5, '#7ac8ff'], [1, '#2a78c8']]);
    ctx.beginPath(); ctx.moveTo(4, 0.5); ctx.quadraticCurveTo(7.5, 6, 6.5, 8); ctx.quadraticCurveTo(4, 10.5, 1.5, 8); ctx.quadraticCurveTo(0.5, 6, 4, 0.5); ctx.fill();
  });
  canvasTex(s, 'fx-leaf', 10, 6, (ctx) => {
    ctx.fillStyle = '#7ad858'; ctx.strokeStyle = '#2a6a18'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0.5, 3); ctx.quadraticCurveTo(5, -1, 9.5, 3); ctx.quadraticCurveTo(5, 7, 0.5, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, 3); ctx.lineTo(9, 3); ctx.stroke();
  });
}

const tween = (s, cfg) => new Promise((resolve) => s.tweens.add({ ...cfg, onComplete: resolve }));
const delay = (s, ms) => new Promise((r) => s.time.delayedCall(ms, r));
const rand = (a, b) => a + Math.random() * (b - a);
const img = (s, key, x, y, scale = 1, depth = D) => s.add.image(x, y, key).setScale(scale / R).setDepth(depth);
const fadeOut = (s, o, ms, extra = {}) => s.tweens.add({ targets: o, alpha: 0, duration: ms, ...extra, onComplete: () => o.destroy() });

const SPELL_STYLE = {
  fire: { color: 0xff7a2a, css: '#ffb070', name: '火计' },
  rock: { color: 0xd8c098, css: '#e8d4a8', name: '落石' },
  heal: { color: 0x7dffa0, css: '#a8ffc0', name: '援队' },
};

// 施法：脚下法阵 + 光晕 + 升腾光点 + 策略名
export async function castFx(s, caster, spellId, target) {
  ensureTextures(s);
  // 没有专属样式的策略（如大援队）按类型套用：回复类用援队样式，伤害类用火计样式
  const sp = SPELLS[spellId];
  const st = SPELL_STYLE[spellId] || { ...SPELL_STYLE[sp.kind === 'heal' ? 'heal' : 'fire'], name: sp.name };
  const v = s.views.get(caster);
  if (target && target !== caster) v.face(target);
  const p = tileCenter(caster.x, caster.y);
  const circle = s.add.graphics().setDepth(9 + caster.y).setPosition(p.x, p.y + 18).setScale(0.2, 0.1);
  circle.lineStyle(1.5, st.color, 0.9).strokeCircle(0, 0, 22).strokeCircle(0, 0, 16);
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8;
    circle.fillStyle(st.color, 0.9).fillRect(Math.cos(a) * 19 - 1.5, Math.sin(a) * 19 - 1.5, 3, 3);
    circle.lineBetween(Math.cos(a) * 16, Math.sin(a) * 16, Math.cos(a + 2.36) * 16, Math.sin(a + 2.36) * 16);
  }
  s.tweens.add({ targets: circle, scaleX: 1, scaleY: 0.45, duration: 260, ease: 'Back.easeOut' });
  s.tweens.add({ targets: circle, angle: 180, duration: 900 });
  const glow = img(s, 'fx-glow', p.x, p.y, 1.6, 9 + caster.y).setTint(st.color).setBlendMode(ADD).setAlpha(0);
  s.tweens.add({ targets: glow, alpha: 0.8, scale: 2.4 / R, duration: 300, yoyo: true, hold: 200 });
  for (let i = 0; i < 10; i++) {
    const m = img(s, 'fx-spark', p.x + rand(-16, 16), p.y + rand(4, 18), rand(0.5, 0.9)).setTint(st.color).setBlendMode(ADD);
    s.tweens.add({ targets: m, y: m.y - rand(26, 44), alpha: 0, delay: i * 40, duration: 600, onComplete: () => m.destroy() });
  }
  const label = text(s, p.x, p.y - 38, st.name, 22, st.css, FONT).setOrigin(0.5).setStroke('#2a1000', 5).setDepth(D + 40).setAlpha(0).setScale(1.6);
  s.tweens.add({ targets: label, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
  s.tweens.add({ targets: label, alpha: 0, y: label.y - 12, delay: 700, duration: 300, onComplete: () => label.destroy() });
  await tween(s, { targets: v.body, scale: 1.08, duration: 180, yoyo: true, hold: 120 });
  fadeOut(s, circle, 300);
  s.time.delayedCall(400, () => glow.destroy());
  await delay(s, 120);
}

// 火计：strong 为森林 / 草原等易燃地形
async function fire(s, p, strong) {
  const n = strong ? 13 : 9;
  const base = img(s, 'fx-glow', p.x, p.y + 6, 1, D - 2).setTint(0xff6a1a).setBlendMode(ADD).setAlpha(0);
  s.tweens.add({ targets: base, alpha: 0.55, scale: (strong ? 3.6 : 2.8) / R, duration: 300 });
  const flames = [];
  for (let i = 0; i < n; i++) {
    const f = img(s, 'fx-flame', p.x + rand(-20, 20), p.y + rand(10, 20), 0, D).setOrigin(0.5, 1).setAlpha(0.92);
    f.setTint([0xffffff, 0xffd0a0, 0xffb090][i % 3]);
    const sc = rand(0.7, strong ? 1.35 : 1.1);
    flames.push(f);
    s.tweens.add({ targets: f, scaleX: sc / R, scaleY: sc / R, delay: i * 35, duration: 220, ease: 'Back.easeOut' });
    s.tweens.add({ targets: f, scaleY: (sc * rand(1.2, 1.5)) / R, scaleX: (sc * 0.8) / R, angle: rand(-8, 8), delay: 250 + i * 35, duration: rand(90, 150), yoyo: true, repeat: 4 });
  }
  for (let i = 0; i < (strong ? 22 : 14); i++) {
    const e = img(s, 'fx-spark', p.x + rand(-18, 18), p.y + rand(0, 16), rand(0.3, 0.6)).setTint(0xffa040).setBlendMode(ADD);
    s.tweens.add({ targets: e, y: e.y - rand(30, 60), x: e.x + rand(-14, 14), alpha: 0, delay: rand(100, 700), duration: rand(500, 800), onComplete: () => e.destroy() });
  }
  s.time.delayedCall(950, () => {
    flames.forEach((f) => s.tweens.add({ targets: f, scaleY: 0, alpha: 0, duration: 260, onComplete: () => f.destroy() }));
    fadeOut(s, base, 400);
    const scorch = s.add.ellipse(p.x, p.y + 16, 40, 12, 0x1a0e06, 0.45).setDepth(8);
    fadeOut(s, scorch, 1600, { delay: 600 });
    for (let i = 0; i < 6; i++) {
      const sm = img(s, 'fx-smoke', p.x + rand(-14, 14), p.y + rand(-4, 10), rand(0.8, 1.2));
      s.tweens.add({ targets: sm, y: sm.y - rand(26, 40), scale: rand(1.8, 2.4) / R, alpha: 0, delay: i * 70, duration: 900, onComplete: () => sm.destroy() });
    }
  });
  await delay(s, 450);
}

async function rock(s, p) {
  const shadow = s.add.ellipse(p.x, p.y + 16, 40, 12, 0x000000, 0.4).setDepth(9).setScale(0.1);
  await tween(s, { targets: shadow, scale: 1, duration: 280 });
  const lands = [];
  for (let i = 0; i < 4; i++) {
    const tx = p.x + rand(-12, 12), ty = p.y + rand(-2, 12);
    const r = img(s, `fx-rock${i % 3}`, tx + rand(-10, 10), ty - 170, rand(0.9, 1.3)).setAngle(rand(0, 360));
    lands.push(tween(s, { targets: r, x: tx, y: ty, angle: r.angle + rand(180, 360), delay: i * 110, duration: 320, ease: 'Quad.easeIn' }).then(() => {
      s.cameras.main.shake(90, 0.006);
      for (let k = 0; k < 4; k++) {
        const d = img(s, 'fx-smoke', tx + rand(-8, 8), ty + 8, rand(0.6, 0.9)).setTint(0xd8c8a0);
        s.tweens.add({ targets: d, x: d.x + rand(-20, 20), y: d.y - rand(6, 16), scale: 1.8 / R, alpha: 0, duration: 500, onComplete: () => d.destroy() });
      }
      for (let k = 0; k < 5; k++) {
        const chip = s.add.rectangle(tx, ty, 3, 3, 0x8a7a62).setDepth(D).setAngle(rand(0, 90));
        const dx = rand(-26, 26);
        s.tweens.add({ targets: chip, x: tx + dx, duration: 380 });
        s.tweens.add({ targets: chip, y: ty - rand(10, 22), duration: 180, ease: 'Quad.easeOut', yoyo: true, onComplete: () => chip.destroy() });
      }
      s.tweens.add({ targets: r, y: r.y - 5, duration: 90, yoyo: true });
      fadeOut(s, r, 400, { delay: 700 });
    }));
  }
  const cracks = s.add.graphics().setDepth(8).setPosition(p.x, p.y + 16);
  cracks.lineStyle(1.2, 0x2a2018, 0.8);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + rand(-0.3, 0.3), l = rand(10, 20);
    cracks.lineBetween(0, 0, Math.cos(a) * l, Math.sin(a) * l * 0.35);
  }
  cracks.setAlpha(0);
  await lands[0];
  cracks.setAlpha(1);
  fadeOut(s, cracks, 900, { delay: 700 });
  fadeOut(s, shadow, 500, { delay: 400 });
  await delay(s, 120);
}

async function heal(s, p, color = 0x7dffa0, small = false) {
  const col = img(s, 'fx-glow', p.x, p.y - 70, 1).setTint(color).setBlendMode(ADD).setAlpha(0);
  col.setScale((small ? 1.2 : 1.8) / R, 4 / R);
  s.tweens.add({ targets: col, y: p.y - 10, alpha: 0.85, duration: 320, ease: 'Quad.easeOut' });
  fadeOut(s, col, 400, { delay: 600 });
  const halo = s.add.ellipse(p.x, p.y + 17, 10, 4).setStrokeStyle(2, 0xfff2a0, 1).setDepth(9);
  s.tweens.add({ targets: halo, scaleX: 4, scaleY: 4, alpha: 0, delay: 250, duration: 650, onComplete: () => halo.destroy() });
  for (let i = 0; i < (small ? 10 : 16); i++) {
    const a = (Math.PI * 2 * i) / 8;
    const sp = img(s, 'fx-spark', p.x + Math.cos(a) * 16, p.y + 16, rand(0.5, 0.9)).setTint(i % 2 ? color : 0xfff2a0).setBlendMode(ADD).setAlpha(0);
    const prog = { t: 0 };
    s.tweens.add({
      targets: prog, t: 1, delay: 200 + i * 35, duration: 700,
      onUpdate: () => {
        const ang = a + prog.t * 4;
        sp.setPosition(p.x + Math.cos(ang) * 16 * (1 - prog.t * 0.4), p.y + 16 - prog.t * 46).setAlpha(Math.sin(Math.PI * prog.t));
      },
      onComplete: () => sp.destroy(),
    });
  }
  await delay(s, 520);
}

// 策略命中特效；返回时为结算时刻，余下效果继续播放
export async function spellFx(s, spellId, target, opts = {}) {
  ensureTextures(s);
  const p = tileCenter(target.x, target.y);
  if (spellId === 'fire') await fire(s, p, opts.strong);
  else if (spellId === 'rock') await rock(s, p);
  else await heal(s, p);
  if (opts.failed) {
    for (let i = 0; i < 5; i++) {
      const sm = img(s, 'fx-smoke', p.x + rand(-12, 12), p.y + rand(-10, 8), 1).setTint(0xcfd8e0);
      s.tweens.add({ targets: sm, scale: 2.2 / R, alpha: 0, duration: 600, onComplete: () => sm.destroy() });
    }
  }
}

const ITEM_STYLE = {
  bean: { color: 0x7dffa0, css: '#a8ffc0', bit: 'fx-beanlet' },
  wheat: { color: 0xffd860, css: '#ffe08a', bit: 'fx-grain' },
  wine: { color: 0x7ac8ff, css: '#a8dcff', bit: 'fx-drop' },
};

// 道具专属回复光效：豆=叶片飞旋，麦=麦粒升腾，酒=气泡上浮
function itemAura(s, p, itemId, color) {
  for (let i = 0; i < 10; i++) {
    const a0 = (Math.PI * 2 * i) / 10;
    let o;
    if (itemId === 'wine') {
      o = s.add.circle(p.x, p.y, rand(2, 3.5)).setStrokeStyle(1, 0xd8f0ff, 0.95).setDepth(D);
      o.isFilled = false;
    } else {
      o = img(s, itemId === 'bean' ? 'fx-leaf' : 'fx-grain', p.x, p.y, rand(0.9, 1.3));
    }
    o.setAlpha(0);
    const prog = { t: 0 };
    s.tweens.add({
      targets: prog, t: 1, delay: 150 + i * 45, duration: 850,
      onUpdate: () => {
        const r = itemId === 'wine' ? 10 + Math.sin(prog.t * 9 + i) * 3 : 18 * (1 - prog.t * 0.5);
        const ang = a0 + prog.t * (itemId === 'bean' ? 5 : 2);
        o.setPosition(p.x + Math.cos(ang) * r, p.y + 16 - prog.t * 48).setAlpha(Math.sin(Math.PI * prog.t));
        if (itemId !== 'wine') o.setAngle(prog.t * 360 + i * 36);
      },
      onComplete: () => o.destroy(),
    });
  }
  const glow = img(s, 'fx-glow', p.x, p.y + 4, 1.5).setTint(color).setBlendMode(ADD).setAlpha(0);
  s.tweens.add({ targets: glow, alpha: 0.7, scale: 3 / R, duration: 300, yoyo: true, hold: 300, onComplete: () => glow.destroy() });
}

// 道具：取出 → 抛出 → 接住化为碎粒吸收 → 专属回复光效
export async function itemFx(s, user, itemId, target) {
  ensureTextures(s);
  const st = ITEM_STYLE[itemId];
  const vu = s.views.get(user), vt = s.views.get(target);
  const a = tileCenter(user.x, user.y), b = tileCenter(target.x, target.y);
  if (user !== target) vu.face(target);
  // 取出
  s.tweens.add({ targets: vu.body, scale: 1.06, duration: 160, yoyo: true });
  const icon = img(s, `fx-${itemId}`, a.x, a.y - 4, 0.4, D + 5);
  const shine = img(s, 'fx-glow', a.x, a.y - 36, 2.4, D + 4).setTint(st.color).setBlendMode(ADD).setAlpha(0);
  s.tweens.add({ targets: shine, alpha: 0.85, duration: 220, yoyo: true, hold: 260, onComplete: () => shine.destroy() });
  await tween(s, { targets: icon, y: a.y - 36, scale: 1.25 / R, duration: 280, ease: 'Back.easeOut' });
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI * 2 * i) / 6;
    const sp = img(s, 'fx-spark', icon.x, icon.y, 0.7, D + 6).setTint(0xfff2a0).setBlendMode(ADD);
    s.tweens.add({ targets: sp, x: icon.x + Math.cos(ang) * 18, y: icon.y + Math.sin(ang) * 18, alpha: 0, duration: 380, onComplete: () => sp.destroy() });
  }
  const label = text(s, a.x, a.y - 60, `「${ITEMS[itemId].name}」`, 18, st.css, FONT).setOrigin(0.5).setStroke('#2a1000', 4).setDepth(D + 40);
  s.tweens.add({ targets: label, alpha: 0, y: label.y - 10, delay: 520, duration: 300, onComplete: () => label.destroy() });
  await tween(s, { targets: icon, angle: { from: -12, to: 12 }, duration: 110, yoyo: true, repeat: 1 });
  // 抛出
  const ex = b.x, ey = b.y - 14;
  if (user !== target) {
    const prog = { t: 0 }, sx = icon.x, sy = icon.y;
    let lastTrail = 0;
    await tween(s, {
      targets: prog, t: 1, duration: 480, ease: 'Sine.easeInOut',
      onUpdate: () => {
        icon.setPosition(sx + (ex - sx) * prog.t, sy + (ey - sy) * prog.t - Math.sin(Math.PI * prog.t) * 34).setAngle(prog.t * 540);
        if (s.time.now - lastTrail > 35) {
          lastTrail = s.time.now;
          const tr = img(s, 'fx-spark', icon.x, icon.y, 0.6, D + 4).setTint(st.color).setBlendMode(ADD);
          s.tweens.add({ targets: tr, alpha: 0, scale: 0.1 / R, duration: 320, onComplete: () => tr.destroy() });
        }
      },
    });
  } else {
    await tween(s, { targets: icon, y: ey, angle: 360, duration: 300, ease: 'Quad.easeIn' });
  }
  // 接住：目标跳起，道具化为碎粒后被吸收
  s.tweens.add({ targets: vt.body, y: -8, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
  fadeOut(s, icon, 200, { scale: 2 / R });
  const pop = img(s, 'fx-glow', ex, ey, 1.6, D + 4).setTint(0xfff2a0).setBlendMode(ADD);
  s.tweens.add({ targets: pop, scale: 3.2 / R, alpha: 0, duration: 380, onComplete: () => pop.destroy() });
  for (let i = 0; i < 12; i++) {
    const ang = (Math.PI * 2 * i) / 12 + rand(-0.2, 0.2), r = rand(16, 26);
    const bit = img(s, st.bit, ex, ey, rand(0.9, 1.3), D + 5).setAngle(rand(0, 360));
    tween(s, { targets: bit, x: ex + Math.cos(ang) * r, y: ey + Math.sin(ang) * r * 0.8, angle: bit.angle + 180, duration: 260, ease: 'Quad.easeOut' })
      .then(() => tween(s, { targets: bit, x: b.x, y: b.y + 2, scale: 0.2 / R, alpha: 0.3, delay: i * 15, duration: 280, ease: 'Quad.easeIn' }))
      .then(() => bit.destroy());
  }
  if (itemId === 'wine') {
    const ripple = s.add.ellipse(b.x, b.y + 16, 8, 3).setStrokeStyle(1.5, 0xa8dcff, 1).setDepth(9);
    s.tweens.add({ targets: ripple, scaleX: 5, scaleY: 5, alpha: 0, duration: 700, onComplete: () => ripple.destroy() });
  }
  await delay(s, 420);
  // 回复
  itemAura(s, b, itemId, st.color);
  await heal(s, b, st.color, true);
  vu.faceDefault();
}

// 撤退特效：闪白 → 倒地 → 烟散；主将额外金色光环与震屏
export async function deathFx(s, v) {
  ensureTextures(s);
  const u = v.unit;
  const p = tileCenter(u.x, u.y);
  v.idle.stop();
  v.hpTween?.stop();
  v.body.setPosition(0, 0);
  // 闪白抖动
  for (let i = 0; i < 3; i++) {
    v.sprite.setTintMode(Phaser.TintModes.FILL).setTint(0xffffff);
    v.body.setX(i % 2 ? 3 : -3);
    await delay(s, 70);
    v.sprite.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    v.body.setX(0);
    await delay(s, 60);
  }
  const label = text(s, p.x, p.y - 30, u.leader ? `${u.name} 撤退！` : '撤退', u.leader ? 22 : 17, u.leader ? '#ffd36a' : '#d8d0c0', FONT)
    .setOrigin(0.5).setStroke('#1a1008', 5).setDepth(D + 40).setAlpha(0);
  s.tweens.add({ targets: label, alpha: 1, y: label.y - 10, duration: 260 });
  s.tweens.add({ targets: label, alpha: 0, y: label.y - 24, delay: u.leader ? 1300 : 900, duration: 350, onComplete: () => label.destroy() });
  if (u.leader) {
    s.cameras.main.shake(260, 0.01);
    const halo = s.add.ellipse(p.x, p.y + 17, 12, 5).setStrokeStyle(3, 0xffd36a, 1).setDepth(9);
    s.tweens.add({ targets: halo, scaleX: 6, scaleY: 6, alpha: 0, duration: 800, onComplete: () => halo.destroy() });
    const flash = img(s, 'fx-glow', p.x, p.y, 2).setTint(0xffd36a).setBlendMode(ADD);
    s.tweens.add({ targets: flash, scale: 5 / R, alpha: 0, duration: 600, onComplete: () => flash.destroy() });
  }
  // 倒地：以脚为支点向后倒下并变暗
  const dir = v.sprite.flipX ? 1 : -1;
  v.sprite.setTint(0x8a8078);
  await tween(s, {
    targets: v.sprite, angle: 52 * dir, y: v.sprite.y + 6, scaleY: v.sprite.scaleY * 0.85, alpha: 0.65, duration: 420, ease: 'Quad.easeIn',
  });
  s.cameras.main.shake(70, 0.003);
  for (let i = 0; i < 6; i++) {
    const d = img(s, 'fx-smoke', p.x + rand(-6, 6) + dir * 10, p.y + 14, rand(0.6, 0.9)).setTint(0xd8c8a0);
    s.tweens.add({ targets: d, x: d.x + rand(-22, 22), y: d.y - rand(2, 10), scale: 1.6 / R, alpha: 0, duration: 450, onComplete: () => d.destroy() });
  }
  // 烟散
  const n = u.leader ? 12 : 8;
  for (let i = 0; i < n; i++) {
    const sm = img(s, 'fx-smoke', p.x + rand(-14, 14), p.y + rand(0, 14), rand(0.9, 1.3));
    s.tweens.add({ targets: sm, y: sm.y - rand(24, 44), x: sm.x + rand(-8, 8), scale: rand(2, 2.8) / R, alpha: 0, delay: i * 40, duration: 900, onComplete: () => sm.destroy() });
  }
  for (let i = 0; i < n + 4; i++) {
    const ink = img(s, 'fx-spark', p.x + rand(-12, 12), p.y + rand(-4, 14), rand(0.4, 0.7)).setTint(0x2a2018);
    s.tweens.add({ targets: ink, y: ink.y - rand(26, 50), x: ink.x + rand(-10, 10), angle: rand(-180, 180), alpha: 0, delay: rand(0, 300), duration: 800, onComplete: () => ink.destroy() });
  }
  await tween(s, { targets: v.c, alpha: 0, delay: 120, duration: 420 });
  v.c.destroy();
}

// 转职：金色光柱与环绕星光（复用回复特效），中途闪白换装，金色字样“转职·新兵种”
// onChange 在闪光时调用（更新外形）
export async function promoteFx(s, unit, title, onChange) {
  ensureTextures(s);
  const p = tileCenter(unit.x, unit.y);
  const v = s.views.get(unit);
  const done = heal(s, p, 0xffd36a);
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14;
    const st = img(s, 'fx-spark', p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 14 + 6, rand(0.6, 1)).setTint(0xffe08a).setBlendMode(ADD);
    s.tweens.add({ targets: st, x: p.x, y: p.y - 6, alpha: 0, delay: i * 20, duration: 420, ease: 'Quad.easeIn', onComplete: () => st.destroy() });
  }
  await delay(s, 420);
  v.sprite.setTintMode(Phaser.TintModes.FILL).setTint(0xfff2c0);
  onChange();
  s.cameras.main.flash(120, 255, 236, 170);
  const burst = img(s, 'fx-glow', p.x, p.y, 1.4).setTint(0xffd36a).setBlendMode(ADD);
  s.tweens.add({ targets: burst, scale: 4.5 / R, alpha: 0, duration: 500, onComplete: () => burst.destroy() });
  const halo = s.add.ellipse(p.x, p.y + 17, 12, 5).setStrokeStyle(3, 0xffd36a, 1).setDepth(9);
  s.tweens.add({ targets: halo, scaleX: 5, scaleY: 5, alpha: 0, duration: 700, onComplete: () => halo.destroy() });
  s.time.delayedCall(180, () => { v.sprite.setTintMode(Phaser.TintModes.MULTIPLY).clearTint(); });
  const label = text(s, p.x, p.y - 46, title, 24, '#ffd36a', FONT).setOrigin(0.5).setStroke('#3a1800', 6).setDepth(D + 40).setAlpha(0).setScale(1.8);
  s.tweens.add({ targets: label, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
  s.tweens.add({ targets: label, alpha: 0, y: label.y - 14, delay: 1100, duration: 320, onComplete: () => label.destroy() });
  await done;
  await delay(s, 900);
}
