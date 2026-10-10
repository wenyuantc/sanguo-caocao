import { tileCenter } from './unitView.js';
import { weaponOf, mountedOf } from './heroSprites.js';
import { text } from './ui.js';
import { WIDTH, HEIGHT, FONT } from './config.js';

// 每种兵器不同的攻击动画。onImpact 在命中瞬间调用（结算伤害 / 飘字）
const D = 720; // 特效层级

const tween = (s, cfg) => new Promise((resolve) => s.tweens.add({ ...cfg, onComplete: resolve }));
const delay = (s, ms) => new Promise((r) => s.time.delayedCall(ms, r));
const lerp = (a, b, t) => a + (b - a) * t;

function geo(a, d) {
  const A = tileCenter(a.x, a.y), B = tileCenter(d.x, d.y);
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  return { A, B, ux: dx / len, uy: dy / len, len, ang: Math.atan2(dy, dx) };
}

// 绘制一段随进度扫过的弧形刀光
function sweepArc(s, cx, cy, r, from, to, color, width, ms, glow = 0xffffff) {
  const g = s.add.graphics().setDepth(D);
  const prog = { t: 0 };
  return tween(s, {
    targets: prog, t: 1, duration: ms, ease: 'Cubic.easeOut',
    onUpdate: () => {
      g.clear();
      const end = lerp(from, to, prog.t), start = lerp(from, to, Math.max(0, prog.t - 0.55));
      g.lineStyle(width + 6, color, 0.25).beginPath().arc(cx, cy, r, start, end, to < from).strokePath();
      g.lineStyle(width, color, 0.95).beginPath().arc(cx, cy, r, start, end, to < from).strokePath();
      g.lineStyle(Math.max(1, width / 3), glow, 1).beginPath().arc(cx, cy, r, start, end, to < from).strokePath();
    },
  }).then(() => tween(s, { targets: g, alpha: 0, duration: 140 })).then(() => g.destroy());
}

function ring(s, x, y, color, r0, r1, ms, width = 3) {
  const c = s.add.circle(x, y, r0).setStrokeStyle(width, color, 1).setDepth(D);
  c.isFilled = false;
  return tween(s, { targets: c, radius: r1, alpha: 0, duration: ms, ease: 'Cubic.easeOut' }).then(() => c.destroy());
}

function sparks(s, x, y, color = 0xffe08a, n = 7, dist = 22) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
    const l = s.add.rectangle(x, y, 7, 2, color).setRotation(a).setDepth(D);
    s.tweens.add({ targets: l, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, scaleX: 0.2, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
  }
}

function dust(s, x, y, n = 5, spread = 16) {
  for (let i = 0; i < n; i++) {
    const c = s.add.circle(x + (Math.random() - 0.5) * spread, y + 16, 3 + Math.random() * 4, 0xd8c8a0, 0.7).setDepth(D - 1);
    s.tweens.add({ targets: c, y: c.y - 8 - Math.random() * 8, x: c.x + (Math.random() - 0.5) * 14, scale: 1.8, alpha: 0, duration: 420, onComplete: () => c.destroy() });
  }
}

// 会心一击：闪白 + 字样
async function critCutIn(s, a) {
  const p = tileCenter(a.x, a.y);
  const flash = s.add.rectangle(0, 0, WIDTH, HEIGHT, 0xffffff, 0.55).setOrigin(0).setDepth(D + 50);
  const t = text(s, p.x, p.y - 44, '会心！', 30, '#ffe05a', FONT).setOrigin(0.5).setStroke('#7a1200', 6).setDepth(D + 51).setScale(1.8);
  s.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
  await tween(s, { targets: t, scale: 1, duration: 180, ease: 'Back.easeOut' });
  s.tweens.add({ targets: t, alpha: 0, y: t.y - 14, delay: 260, duration: 300, onComplete: () => t.destroy() });
}

// 冲锋：骑兵冲得更远并扬起尘土
async function charge(s, va, g, ratio, ms, ease = 'Quad.easeIn') {
  const mounted = mountedOf(va.unit);
  const r = mounted ? Math.min(0.78, ratio + 0.2) : ratio;
  if (mounted) for (let i = 0; i < 3; i++) s.time.delayedCall(i * (ms / 3), () => dust(s, va.c.x, va.c.y, 3, 10));
  await tween(s, { targets: va.c, x: g.A.x + g.ux * g.len * r, y: g.A.y + g.uy * g.len * r, duration: mounted ? ms * 0.85 : ms, ease });
}

const back = (s, va, g, ms = 170) => tween(s, { targets: va.c, x: g.A.x, y: g.A.y, duration: ms, ease: 'Quad.easeOut' });
const windup = (s, va, g, dist, ms) => tween(s, { targets: va.c, x: g.A.x - g.ux * dist, y: g.A.y - g.uy * dist, duration: ms, ease: 'Quad.easeOut' });

// ---------- 各兵器攻击方式 ----------
const STYLES = {
  async sword(s, va, g, hit, crit) {
    await windup(s, va, g, 6, 90);
    await charge(s, va, g, 0.45, 110);
    s.time.delayedCall(80, hit);
    await sweepArc(s, g.B.x, g.B.y, 20, g.ang - 1.9, g.ang + 1.0, 0xbfe4ff, 4, 170);
    if (crit) await sweepArc(s, g.B.x, g.B.y, 24, g.ang + 1.9, g.ang - 1.0, 0xffe05a, 5, 150);
    await back(s, va, g);
  },
  async spear(s, va, g, hit, crit) {
    await windup(s, va, g, 11, 150);
    await charge(s, va, g, 0.62, 90, 'Expo.easeIn');
    const mx = (g.A.x + g.B.x) / 2, my = (g.A.y + g.B.y) / 2;
    const streak = s.add.rectangle(mx, my, g.len * 0.9, 3, 0xffffff, 0.9).setRotation(g.ang).setDepth(D);
    s.tweens.add({ targets: streak, scaleY: 0.1, alpha: 0, duration: 220, onComplete: () => streak.destroy() });
    hit();
    ring(s, g.B.x, g.B.y, 0xffffff, 4, 24, 260);
    if (crit) ring(s, g.B.x, g.B.y, 0xffe05a, 8, 36, 360, 4);
    await delay(s, 120);
    await back(s, va, g);
  },
  async halberd(s, va, g, hit, crit) {
    await Promise.all([
      tween(s, { targets: va.body, angle: -16 * Math.sign(g.ux || 1), scale: 1.15, duration: 200, ease: 'Quad.easeOut' }),
      windup(s, va, g, 8, 200),
    ]);
    await charge(s, va, g, 0.5, 130);
    s.time.delayedCall(120, () => {
      hit();
      s.cameras.main.shake(crit ? 260 : 160, crit ? 0.014 : 0.009);
      dust(s, g.B.x, g.B.y, 7, 26);
      ring(s, g.B.x, g.B.y, 0xff9a3a, 6, 34, 320, 4);
    });
    s.tweens.add({ targets: va.body, angle: 0, scale: 1, duration: 260 });
    await Promise.all([
      sweepArc(s, g.B.x, g.B.y, 30, g.ang - 2.6, g.ang + 2.6, 0xff5a2a, 6, 270, 0xffe08a),
      crit ? sweepArc(s, g.B.x, g.B.y, 22, g.ang + 2.6, g.ang - 2.6, 0xffe05a, 4, 270) : null,
    ]);
    await back(s, va, g, 200);
  },
  async club(s, va, g, hit, crit) {
    await windup(s, va, g, 4, 80);
    const prog = { t: 0 };
    const tx = g.A.x + g.ux * g.len * 0.55, ty = g.A.y + g.uy * g.len * 0.55;
    const sx = va.c.x, sy = va.c.y;
    await tween(s, {
      targets: prog, t: 1, duration: 280, ease: 'Sine.easeIn',
      onUpdate: () => va.c.setPosition(lerp(sx, tx, prog.t), lerp(sy, ty, prog.t) - Math.sin(Math.PI * prog.t) * 26),
    });
    hit();
    s.cameras.main.shake(120, crit ? 0.012 : 0.006);
    const wave = s.add.ellipse(g.B.x, g.B.y + 16, 10, 4).setStrokeStyle(3, 0xe8d8b0, 1).setDepth(D);
    s.tweens.add({ targets: wave, scaleX: crit ? 7 : 5, scaleY: crit ? 7 : 5, alpha: 0, duration: 360, onComplete: () => wave.destroy() });
    dust(s, g.B.x, g.B.y, crit ? 10 : 7, 28);
    await delay(s, 120);
    await back(s, va, g);
  },
  async bow(s, va, g, hit, crit, missed) {
    await windup(s, va, g, 4, 160);
    s.tweens.add({ targets: va.c, x: g.A.x, y: g.A.y, duration: 160 });
    const arrow = s.add.container(g.A.x, g.A.y - 8).setDepth(D);
    const ag = s.add.graphics();
    ag.lineStyle(2, crit ? 0xffe05a : 0x8a5a30, 1).lineBetween(-10, 0, 9, 0);
    ag.fillStyle(0xe8eef4, 1).fillTriangle(9, -3, 9, 3, 15, 0);
    ag.fillStyle(0xffffff, 1).fillTriangle(-10, 0, -14, -4, -8, 0).fillTriangle(-10, 0, -14, 4, -8, 0);
    arrow.add(ag);
    const ex = missed ? g.B.x + g.ux * 30 + g.uy * 12 : g.B.x - g.ux * 6;
    const ey = missed ? g.B.y + g.uy * 30 - g.ux * 12 : g.B.y - g.uy * 6 - 4;
    const h = 18 + g.len * 0.15, sx = arrow.x, sy = arrow.y;
    const pos = (t) => ({ x: lerp(sx, ex, t), y: lerp(sy, ey, t) - Math.sin(Math.PI * t) * h });
    const prog = { t: 0 };
    await tween(s, {
      targets: prog, t: 1, duration: 230 + g.len * 0.9, ease: 'Linear',
      onUpdate: () => {
        const p = pos(prog.t), q = pos(Math.min(1, prog.t + 0.02));
        arrow.setPosition(p.x, p.y).setRotation(Math.atan2(q.y - p.y, q.x - p.x));
      },
    });
    hit();
    if (!missed) {
      sparks(s, g.B.x, g.B.y, 0xffffff, crit ? 9 : 5, 16);
      if (crit) ring(s, g.B.x, g.B.y, 0xffe05a, 4, 28, 300);
      await tween(s, { targets: arrow, alpha: 0, delay: 160, duration: 200 });
    } else {
      await tween(s, { targets: arrow, y: arrow.y + 18, angle: arrow.angle + 50, alpha: 0, duration: 300 });
    }
    arrow.destroy();
  },
  async fan(s, va, g, hit, crit) {
    await tween(s, { targets: va.body, scale: 1.12, duration: 140, yoyo: true });
    const winds = [];
    for (let k = 0; k < (crit ? 5 : 3); k++) {
      const w = s.add.graphics().setDepth(D).setPosition(g.A.x, g.A.y);
      w.lineStyle(3, 0xd8f4ff, 0.9).beginPath().arc(0, 0, 9 + k * 2, 0, Math.PI * 1.4).strokePath();
      w.lineStyle(1.5, 0x8ad0f0, 0.9).beginPath().arc(0, 0, 5 + k, Math.PI, Math.PI * 2.3).strokePath();
      winds.push(tween(s, { targets: w, x: g.B.x, y: g.B.y, angle: 720, delay: k * 70, duration: 320, ease: 'Sine.easeIn' })
        .then(() => tween(s, { targets: w, scale: 2.4, alpha: 0, angle: 1080, duration: 260 })).then(() => w.destroy()));
    }
    s.time.delayedCall(330, () => { hit(); ring(s, g.B.x, g.B.y, 0xbfe8ff, 6, 28, 300); });
    await Promise.all(winds);
  },
  async staff(s, va, g, hit, crit) {
    await charge(s, va, g, 0.3, 120, 'Quad.easeOut');
    const m = s.add.graphics().setDepth(D).setPosition(g.B.x, g.B.y + 8).setScale(0.2);
    m.lineStyle(2, 0xffd84a, 1).strokeCircle(0, 0, 20).strokeCircle(0, 0, 13);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3, b = a + Math.PI * 2 / 3 * 2;
      m.lineBetween(Math.cos(a) * 13, Math.sin(a) * 13, Math.cos(b) * 13, Math.sin(b) * 13);
      m.fillStyle(0xc87aff, 1).fillCircle(Math.cos(a) * 20, Math.sin(a) * 20, 2.2);
    }
    m.scaleY = 0.2;
    await tween(s, { targets: m, scaleX: 1, scaleY: 0.55, angle: 180, duration: 320, ease: 'Back.easeOut' });
    hit();
    sparks(s, g.B.x, g.B.y, 0xffe08a, crit ? 12 : 8, 26);
    ring(s, g.B.x, g.B.y, 0xc87aff, 6, crit ? 36 : 26, 320, 3);
    s.tweens.add({ targets: m, alpha: 0, angle: 360, duration: 300, onComplete: () => m.destroy() });
    await back(s, va, g);
  },
};

// 新兵器复用 / 扩展
STYLES.glaive = STYLES.halberd;
STYLES.axe = STYLES.halberd;
STYLES.twin = async (s, va, g, hit, crit) => {
  await windup(s, va, g, 6, 90);
  await charge(s, va, g, 0.48, 110);
  s.time.delayedCall(70, hit);
  await sweepArc(s, g.B.x, g.B.y, 20, g.ang - 1.7, g.ang + 0.9, 0xbfe4ff, 4, 140);
  await sweepArc(s, g.B.x, g.B.y, 20, g.ang + 1.7, g.ang - 0.9, crit ? 0xffe05a : 0xbfe4ff, 4, 140);
  await back(s, va, g);
};
STYLES.fist = async (s, va, g, hit, crit) => {
  await windup(s, va, g, 5, 80);
  await charge(s, va, g, 0.55, 90, 'Expo.easeIn');
  for (let i = 0; i < (crit ? 3 : 2); i++) {
    if (i === 0) hit();
    ring(s, g.B.x + (i % 2 ? 5 : -5), g.B.y - 4, 0xffe8b0, 3, 18, 200, 3);
    s.cameras.main.shake(60, 0.004);
    await tween(s, { targets: va.c, x: va.c.x - g.ux * 5, y: va.c.y - g.uy * 5, duration: 70, yoyo: true });
  }
  await back(s, va, g);
};
STYLES.catapult = async (s, va, g, hit, crit, missed) => {
  await tween(s, { targets: va.body, angle: -8, duration: 160, yoyo: true });
  const rock = s.add.circle(g.A.x + 18, g.A.y - 22, crit ? 7 : 5.5, 0x8a7a62).setStrokeStyle(1.5, 0x3a2e20).setDepth(D);
  const sx = rock.x, sy = rock.y, ex = missed ? g.B.x + g.ux * 26 : g.B.x, ey = missed ? g.B.y + g.uy * 26 : g.B.y;
  const prog = { t: 0 };
  await tween(s, {
    targets: prog, t: 1, duration: 420 + g.len * 1.2, ease: 'Sine.easeIn',
    onUpdate: () => rock.setPosition(lerp(sx, ex, prog.t), lerp(sy, ey, prog.t) - Math.sin(Math.PI * prog.t) * (50 + g.len * 0.3)).setAngle(prog.t * 540),
  });
  hit();
  rock.destroy();
  s.cameras.main.shake(crit ? 220 : 140, crit ? 0.012 : 0.007);
  dust(s, ex, ey, crit ? 10 : 7, 30);
  ring(s, ex, ey, 0xe8d8b0, 6, crit ? 38 : 28, 360, 3);
  sparks(s, ex, ey, 0xd8c8a0, 8, 24);
};

// 播放一次攻击：attacker 攻击 defender，r 为结算结果 { hit, crit }
export async function playAttack(s, attacker, defender, r, onImpact) {
  const va = s.views.get(attacker), vd = s.views.get(defender);
  const g = geo(attacker, defender);
  va.face(defender);
  vd.face(attacker);
  if (r.crit) await critCutIn(s, attacker);
  let done = false;
  const hit = () => {
    if (done) return;
    done = true;
    if (r.hit) {
      if (!['bow', 'staff'].includes(weapon)) sparks(s, g.B.x, g.B.y, r.crit ? 0xffe05a : 0xffffff, r.crit ? 10 : 6, r.crit ? 30 : 20);
      vd.flashHit();
      vd.knockback(attacker, r.crit ? 12 : 7);
      if (!['halberd', 'club'].includes(weapon)) s.cameras.main.shake(r.crit ? 180 : 70, r.crit ? 0.008 : 0.002);
    } else {
      vd.dodge(attacker);
    }
    onImpact();
  };
  const weapon = weaponOf(attacker);
  await (STYLES[weapon] || STYLES.sword)(s, va, g, hit, r.crit, !r.hit);
  hit();
  va.snap();
  await delay(s, 120);
  va.faceDefault();
  vd.faceDefault();
}
