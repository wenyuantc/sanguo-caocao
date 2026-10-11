// 剧情场景背景：Canvas 2D 程序化绘制，按 RES 倍分辨率烘焙成一张 1200×672 的贴图（key：sbg-<名>-<时段>-<视野>）
// 外场景（远景透视）：field 野外、citygate 城下、river 河畔、mountain 山路
// 内场景（等角，与人物站位共用 defs.isoToScreen）：palace 宫殿、tent 军营大帐、hall 公馆 / 相府、street 城内街道、camp 军营
// 中国地图：china（view：all / north / central / south / west / zhongyuan）
import { WIDTH as W, HEIGHT as H, RES, FONT } from '../config.js';
import {
  BACKGROUNDS, ISO, isoToScreen, lonLatToMap, mapProjector, CITIES, MAJOR_CITIES,
} from './defs.js';

// 确定性伪随机：同一背景每次绘制完全一致
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const lin = (ctx, x0, y0, x1, y1, ...cols) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
  return g;
};
const path = (ctx, pts, close = true) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  if (close) ctx.closePath();
};
const fillPath = (ctx, pts, style, stroke, lw = 1) => {
  path(ctx, pts);
  ctx.fillStyle = style; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
};

// ---------- 等角工具 ----------
const P = (a, b, h = 0) => { const p = isoToScreen(a, b); return [p.x, p.y - h]; };
const quad = (ctx, pts, style, stroke, lw) => fillPath(ctx, pts.map((p) => P(...p)), style, stroke, lw);
// 等角方块：底面 [a0,a1]×[b0,b1]，高 h；画顶面与朝向镜头的两个侧面
function isoBox(ctx, a0, b0, a1, b1, h, top, left, right, stroke = 'rgba(0,0,0,0.35)') {
  quad(ctx, [[a0, b1, 0], [a1, b1, 0], [a1, b1, h], [a0, b1, h]], left, stroke, 0.8);
  quad(ctx, [[a1, b0, 0], [a1, b1, 0], [a1, b1, h], [a1, b0, h]], right, stroke, 0.8);
  quad(ctx, [[a0, b0, h], [a1, b0, h], [a1, b1, h], [a0, b1, h]], top, stroke, 0.8);
}
// 地板：菱形格子
function isoFloor(ctx, n, colorAt, line = 'rgba(0,0,0,0.18)') {
  for (let a = -2; a < n; a++) for (let b = -2; b < n; b++) quad(ctx, [[a, b], [a + 1, b], [a + 1, b + 1], [a, b + 1]], colorAt(a, b), line, 0.6);
}
// 两面后墙：左墙沿 a = 0（b 从 0 到 len），右墙沿 b = 0
function isoWalls(ctx, h, leftStyle, rightStyle, len = 22) {
  quad(ctx, [[0, 0, 0], [0, len, 0], [0, len, h], [0, 0, h]], leftStyle);
  quad(ctx, [[0, 0, 0], [len, 0, 0], [len, 0, h], [0, 0, h]], rightStyle);
}
// 墙面上的矩形（左墙 side = 'l'：沿 b；右墙 'r'：沿 a），t0~t1 为墙上的位置，h0~h1 为高度
function wallRect(ctx, side, t0, t1, h0, h1, style, stroke, lw) {
  const pt = (t, h) => (side === 'l' ? P(0, t, h) : P(t, 0, h));
  fillPath(ctx, [pt(t0, h0), pt(t1, h0), pt(t1, h1), pt(t0, h1)], style, stroke, lw);
}
// 立柱：底部中心在 (a, b)
function pillar(ctx, a, b, h, col, dark, w = 9) {
  const [x, y] = P(a, b);
  ctx.fillStyle = lin(ctx, x - w, 0, x + w, 0, dark, col, dark);
  ctx.fillRect(x - w, y - h, w * 2, h);
  ctx.fillStyle = '#d8b050';
  ctx.fillRect(x - w - 2, y - 8, w * 2 + 4, 8);
  ctx.fillRect(x - w - 2, y - h, w * 2 + 4, 7);
}
// 灯光（夜景用）
function glow(ctx, x, y, r, color = 'rgba(255,190,90,0.55)') {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

// ---------- 外场景公共部分 ----------
const SKY = {
  day: ['#6aa6d8', '#a9d0ea', '#eef0dc'],
  dusk: ['#2a2046', '#a85a5a', '#f0a868'],
  night: ['#04081a', '#141e40', '#2e3c60'],
};
const HAZE = { day: '#b8cad8', dusk: '#c88a7a', night: '#2a3450' };
function sky(ctx, time, horizon, rand) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, horizon + 40, ...SKY[time]);
  ctx.fillRect(0, 0, W, horizon + 60);
  if (time === 'night') {
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,240,${0.3 + rand() * 0.7})`;
      ctx.fillRect(rand() * W, rand() * horizon * 0.9, rand() < 0.1 ? 2 : 1.2, rand() < 0.1 ? 2 : 1.2);
    }
    glow(ctx, 930, 80, 70, 'rgba(240,240,210,0.35)');
    ctx.fillStyle = '#f4f0d8'; ctx.beginPath(); ctx.arc(930, 80, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKY.night[1]; ctx.beginPath(); ctx.arc(942, 72, 21, 0, Math.PI * 2); ctx.fill();
  } else if (time === 'dusk') {
    glow(ctx, 260, horizon - 10, 220, 'rgba(255,200,120,0.55)');
    ctx.fillStyle = '#ffd890'; ctx.beginPath(); ctx.arc(260, horizon - 10, 38, 0, Math.PI * 2); ctx.fill();
  } else {
    glow(ctx, 980, 70, 120, 'rgba(255,255,230,0.5)');
  }
  // 云
  const cloud = time === 'night' ? 'rgba(80,90,130,0.35)' : time === 'dusk' ? 'rgba(255,190,150,0.45)' : 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 6; i++) {
    const cx = rand() * W, cy = 30 + rand() * (horizon * 0.5), w = 80 + rand() * 120;
    ctx.fillStyle = cloud;
    for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(cx + (j - 2) * w * 0.22, cy + Math.sin(j) * 5, w * 0.22, 11 + rand() * 7, 0, 0, Math.PI * 2); ctx.fill(); }
  }
}
// 山脊：base 为山脚线，amp 为起伏
function ridge(ctx, base, amp, color, seed, step = 16) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + step; x += step) {
    const y = base - Math.abs(Math.sin(x * 0.0045 + seed)) * amp - Math.sin(x * 0.017 + seed * 2) * amp * 0.25 - Math.sin(x * 0.05 + seed) * amp * 0.05;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}
function ground(ctx, horizon, top, bottom, rand, specks = '#4e6a30') {
  ctx.fillStyle = lin(ctx, 0, horizon, 0, H, top, bottom);
  ctx.fillRect(0, horizon, W, H - horizon);
  for (let i = 0; i < 500; i++) {
    const y = horizon + Math.pow(rand(), 0.7) * (H - horizon), x = rand() * W, s = 0.6 + (y - horizon) / 160;
    ctx.fillStyle = specks; ctx.globalAlpha = 0.25 + rand() * 0.35;
    ctx.fillRect(x, y, s * 2.2, s * 0.9);
  }
  ctx.globalAlpha = 1;
}
function tuft(ctx, x, y, s, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 1.2 * s; ctx.lineCap = 'round';
  for (const dx of [-3, -1, 1, 3]) { ctx.beginPath(); ctx.moveTo(x + dx * s, y); ctx.quadraticCurveTo(x + dx * s * 1.4, y - 5 * s, x + dx * s * 2, y - 9 * s); ctx.stroke(); }
}
function tree(ctx, x, y, s, rand, col = '#3e6a32', dark = '#24401e') {
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lin(ctx, x - 5 * s, 0, x + 5 * s, 0, '#6a4a2a', '#3a2614');
  ctx.fillRect(x - 4 * s, y - 40 * s, 8 * s, 40 * s);
  for (let i = 0; i < 7; i++) {
    const cx = x + (rand() - 0.5) * 44 * s, cy = y - 50 * s - rand() * 34 * s, r = (16 + rand() * 12) * s;
    ctx.fillStyle = lin(ctx, cx, cy - r, cx, cy + r, col, dark);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
}
function pine(ctx, x, y, s, col = '#2e5032', dark = '#18301e') {
  ctx.fillStyle = '#4a3420'; ctx.fillRect(x - 3 * s, y - 16 * s, 6 * s, 16 * s);
  for (let i = 0; i < 4; i++) {
    const w = (30 - i * 6) * s, ty = y - 14 * s - i * 16 * s;
    fillPath(ctx, [[x - w, ty], [x + w, ty], [x, ty - 26 * s]], lin(ctx, x - w, 0, x + w, 0, dark, col, dark));
  }
}
function flag(ctx, x, y, h, col, rand) {
  ctx.fillStyle = '#2a1a0c'; ctx.fillRect(x - 1.5, y - h, 3, h);
  const w = 26 + rand() * 6;
  fillPath(ctx, [[x + 1.5, y - h], [x + 1.5 + w, y - h + 4], [x + 1.5 + w - 4, y - h + 18], [x + 1.5 + w, y - h + 32], [x + 1.5, y - h + 34]], col, 'rgba(0,0,0,0.4)');
}

// ---------- 外场景 ----------
function drawField(ctx, time, rand) {
  const hz = 236;
  ridge(ctx, hz - 6, 70, HAZE[time], 1.3);
  ridge(ctx, hz + 4, 34, time === 'night' ? '#1e2a30' : '#7a9a6a', 4.1, 12);
  ground(ctx, hz, '#a8c070', '#6a8c3c', rand);
  // 小路
  ctx.fillStyle = lin(ctx, 0, hz, 0, H, '#c8b48a', '#a88a5a');
  ctx.beginPath(); ctx.moveTo(560, hz + 2); ctx.quadraticCurveTo(480, 400, 640, H); ctx.lineTo(860, H); ctx.quadraticCurveTo(620, 400, 590, hz + 2); ctx.closePath(); ctx.fill();
  // 远处树丛
  for (let i = 0; i < 16; i++) {
    const x = rand() * W, y = hz + 6 + rand() * 22;
    if (x > 470 && x < 720) continue;
    tree(ctx, x, y, 0.35 + rand() * 0.15, rand, '#5a7a48', '#3a5430');
  }
  for (const [x, y, s] of [[70, 470, 1.4], [150, 330, 0.9], [1120, 450, 1.5], [1040, 310, 0.85], [230, 600, 1.6], [1000, 620, 1.3]]) tree(ctx, x, y, s, rand);
  for (let i = 0; i < 70; i++) { const y = hz + 30 + rand() * (H - hz - 30); tuft(ctx, rand() * W, y, 0.5 + (y - hz) / 300, '#4e7a34'); }
  for (let i = 0; i < 40; i++) {
    const y = hz + 40 + rand() * (H - hz), x = rand() * W;
    ctx.fillStyle = ['#f0e070', '#f0a0b0', '#ffffff'][i % 3];
    ctx.beginPath(); ctx.arc(x, y, 1.6 + (y - hz) / 220, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCityGate(ctx, time, rand) {
  const hz = 250;
  ridge(ctx, hz - 30, 60, HAZE[time], 2.2);
  ground(ctx, hz, '#b8a878', '#8a7448', rand, '#6a5a38');
  // 城墙
  const top = 128, base = 268;
  ctx.fillStyle = lin(ctx, 0, top, 0, base, '#8a8478', '#5a554c');
  ctx.fillRect(0, top, W, base - top);
  ctx.strokeStyle = 'rgba(30,26,20,0.35)'; ctx.lineWidth = 1;
  for (let y = top + 14; y < base; y += 14) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    for (let x = (y / 14) % 2 ? 0 : 22; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y); ctx.stroke(); }
  }
  // 垛口
  ctx.fillStyle = '#7a756a';
  for (let x = 0; x < W; x += 34) ctx.fillRect(x, top - 16, 22, 16);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, base - 8, W, 8);
  // 城门洞
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath(); ctx.moveTo(540, base); ctx.lineTo(540, 196); ctx.quadraticCurveTo(600, 150, 660, 196); ctx.lineTo(660, base); ctx.closePath(); ctx.fill();
  ctx.fillStyle = lin(ctx, 548, 0, 652, 0, '#5a2e18', '#8a4a24', '#5a2e18');
  ctx.beginPath(); ctx.moveTo(548, base); ctx.lineTo(548, 200); ctx.quadraticCurveTo(600, 160, 652, 200); ctx.lineTo(652, base); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(600, 172); ctx.lineTo(600, base); ctx.stroke();
  ctx.fillStyle = '#d8b050';
  for (let y = 205; y < base - 6; y += 16) for (const x of [566, 584, 616, 634]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  // 城楼
  const tx = 600;
  ctx.fillStyle = '#7a1e14'; ctx.fillRect(tx - 120, 66, 240, 46);
  ctx.fillStyle = '#3a1a10'; for (let x = tx - 110; x < tx + 110; x += 36) ctx.fillRect(x + 10, 74, 16, 30);
  for (let x = tx - 120; x <= tx + 120; x += 40) { ctx.fillStyle = '#a02a1a'; ctx.fillRect(x - 4, 64, 8, 50); }
  ctx.fillStyle = '#4a4a50';
  fillPath(ctx, [[tx - 170, 70], [tx + 170, 70], [tx + 120, 36], [tx - 120, 36]], lin(ctx, 0, 36, 0, 70, '#5a5a62', '#2a2a30'));
  fillPath(ctx, [[tx - 120, 36], [tx + 120, 36], [tx + 80, 8], [tx - 80, 8]], lin(ctx, 0, 8, 0, 36, '#5a5a62', '#2a2a30'));
  fillPath(ctx, [[tx - 140, 116], [tx + 140, 116], [tx + 120, 108], [tx - 120, 108]], '#3a3a40');
  ctx.fillStyle = '#d8b050'; ctx.fillRect(tx - 34, 88, 68, 18);
  ctx.fillStyle = '#2a1a0c'; ctx.font = `bold 13px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('城 门', tx, 102);
  // 城上旌旗
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 136 + (i % 2) * 20;
    if (Math.abs(x - tx) < 180) continue;
    flag(ctx, x, top - 14, 54, i % 2 ? '#b8281e' : '#2f5fb6', rand);
  }
  // 门前道路
  ctx.fillStyle = lin(ctx, 0, base, 0, H, '#9a9488', '#7a7468');
  ctx.beginPath(); ctx.moveTo(540, base); ctx.lineTo(660, base); ctx.lineTo(820, H); ctx.lineTo(380, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(40,36,30,0.25)';
  for (let i = 1; i < 10; i++) { const t = i / 10, y = base + (H - base) * t * t; ctx.beginPath(); ctx.moveTo(540 - 160 * t * t, y); ctx.lineTo(660 + 160 * t * t, y); ctx.stroke(); }
  for (let i = 0; i < 40; i++) { const y = base + 20 + rand() * (H - base); tuft(ctx, rand() < 0.5 ? rand() * 330 : 870 + rand() * 330, y, 0.6 + (y - base) / 300, '#6a7a3a'); }
  tree(ctx, 90, 520, 1.3, rand); tree(ctx, 1110, 540, 1.4, rand);
}

function drawRiver(ctx, time, rand) {
  const hz = 200;
  ridge(ctx, hz, 80, HAZE[time], 0.6);
  ridge(ctx, hz + 14, 30, time === 'night' ? '#1a2630' : '#6a8a70', 3.3, 10);
  // 江面
  const water = time === 'night' ? ['#1a2a44', '#0e1a2c'] : time === 'dusk' ? ['#c88a70', '#4a4a6a'] : ['#7ab0d0', '#3a7aa8'];
  ctx.fillStyle = lin(ctx, 0, hz + 10, 0, 330, ...water);
  ctx.fillRect(0, hz + 10, W, 330 - hz);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 60; i++) {
    const y = hz + 16 + rand() * 110, x = rand() * W, w = 10 + (y - hz) * 0.25;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y - 2, x + w, y); ctx.stroke();
  }
  // 船
  for (const [x, y, s] of [[260, 248, 0.7], [820, 236, 0.5], [1000, 268, 0.9]]) {
    fillPath(ctx, [[x - 50 * s, y], [x + 54 * s, y], [x + 40 * s, y + 14 * s], [x - 38 * s, y + 14 * s]], '#5a3a1e', '#2a1a0a');
    ctx.fillStyle = '#3a2410'; ctx.fillRect(x - 2 * s, y - 70 * s, 4 * s, 70 * s);
    fillPath(ctx, [[x + 2 * s, y - 66 * s], [x + 40 * s, y - 50 * s], [x + 38 * s, y - 12 * s], [x + 2 * s, y - 10 * s]], 'rgba(230,220,190,0.95)', '#6a5a40');
  }
  // 近岸
  ctx.fillStyle = lin(ctx, 0, 300, 0, H, '#b8a878', '#8a7a4a');
  ctx.beginPath(); ctx.moveTo(0, 320);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 312 + Math.sin(x * 0.02) * 10 + Math.sin(x * 0.07) * 4);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 300; i++) { ctx.fillStyle = 'rgba(90,70,40,0.25)'; ctx.fillRect(rand() * W, 330 + rand() * 340, 2, 1); }
  // 芦苇
  for (let i = 0; i < 26; i++) {
    const x = rand() < 0.5 ? rand() * 300 : 900 + rand() * 300, y = 318 + rand() * 30;
    for (let j = 0; j < 7; j++) {
      const bx = x + j * 4, hgt = 40 + rand() * 30;
      ctx.strokeStyle = '#8a8a4a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.quadraticCurveTo(bx + 3, y - hgt / 2, bx + 6, y - hgt); ctx.stroke();
      ctx.fillStyle = '#c8b480'; ctx.beginPath(); ctx.ellipse(bx + 6, y - hgt, 2, 6, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const [x, y, s] of [[60, 560, 1.4], [1140, 600, 1.3]]) tree(ctx, x, y, s, rand, '#4a7040', '#2a4424');
}

function drawMountain(ctx, time, rand) {
  const hz = 230;
  ridge(ctx, hz - 30, 110, HAZE[time], 5.1);
  ground(ctx, hz, '#9a8a68', '#6a5a40', rand, '#4a3e2a');
  const rock = time === 'night' ? ['#2a2a34', '#14141a'] : ['#7a7068', '#3e3830'];
  // 左右山崖
  const cliff = (pts) => {
    fillPath(ctx, pts, lin(ctx, 0, 0, W, 0, ...rock), 'rgba(0,0,0,0.4)', 1.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const p = pts[1 + Math.floor(rand() * (pts.length - 2))];
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + (rand() - 0.5) * 60, p[1] + 40 + rand() * 80); ctx.stroke();
    }
  };
  cliff([[0, H], [0, 20], [90, 50], [160, 140], [220, 180], [250, 300], [300, 420], [250, 560], [330, H]]);
  cliff([[W, H], [W, 0], [1100, 60], [1020, 150], [980, 210], [940, 320], [900, 430], [960, 560], [880, H]]);
  // 山路
  ctx.fillStyle = lin(ctx, 0, hz, 0, H, '#b8a07a', '#8a7050');
  ctx.beginPath(); ctx.moveTo(580, hz); ctx.quadraticCurveTo(700, 330, 520, 450); ctx.quadraticCurveTo(420, 540, 520, H); ctx.lineTo(820, H); ctx.quadraticCurveTo(700, 540, 760, 450); ctx.quadraticCurveTo(820, 330, 620, hz); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 40; i++) {
    const x = 330 + rand() * 560, y = hz + 30 + rand() * 400, r = 3 + rand() * 7;
    ctx.fillStyle = lin(ctx, x, y - r, x, y + r, '#9a9088', '#4a443c');
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (const [x, y, s] of [[120, 160, 0.7], [200, 260, 0.9], [60, 420, 1.2], [1060, 180, 0.8], [1000, 300, 1], [1140, 470, 1.3], [380, 250, 0.5], [860, 240, 0.5]]) pine(ctx, x, y, s);
}

// ---------- 内场景 ----------
const N = ISO.size;
function drawPalace(ctx, time, rand) {
  ctx.fillStyle = '#2a1610'; ctx.fillRect(0, 0, W, H);
  isoFloor(ctx, 30, (a, b) => ((a + b) % 2 ? '#6a5446' : '#5a463a'), 'rgba(0,0,0,0.22)');
  // 红毯：沿中轴
  const sd = (s, d) => [(d + s) / 2, (d - s) / 2];
  quad(ctx, [sd(-1.6, 6), sd(1.6, 6), sd(1.6, 60), sd(-1.6, 60)], '#8a1e18');
  for (const s0 of [-1.3, 1.3]) quad(ctx, [sd(s0 - 0.1, 6), sd(s0 + 0.1, 6), sd(s0 + 0.1, 60), sd(s0 - 0.1, 60)], '#d8b050');
  const wallH = 190;
  isoWalls(ctx, wallH, lin(ctx, 0, 0, 600, 0, '#7a1c12', '#a82a1c'), lin(ctx, 600, 0, W, 0, '#a82a1c', '#7a1c12'));
  // 金色横带与格窗
  for (const side of ['l', 'r']) {
    wallRect(ctx, side, 0, 22, wallH - 18, wallH - 8, '#c89a3a');
    wallRect(ctx, side, 0, 22, 18, 26, '#c89a3a');
    for (let t = 3; t < 21; t += 4) {
      wallRect(ctx, side, t, t + 2.4, 60, 140, '#3a1008', '#c89a3a', 2);
      for (let k = 1; k < 4; k++) wallRect(ctx, side, t, t + 2.4, 60 + k * 20, 61 + k * 20, '#c89a3a');
    }
  }
  // 宝座台阶
  isoBox(ctx, 0, 0, 4.4, 4.4, 10, '#6a4a2a', '#4a3018', '#3a2410');
  isoBox(ctx, 0, 0, 3.4, 3.4, 20, '#8a6a3a', '#5a3a1a', '#4a2c14');
  // 屏风（墙角）
  for (const side of ['l', 'r']) wallRect(ctx, side, 0.2, 3.4, 20, 150, lin(ctx, 0, 0, 0, 160, '#d8b050', '#8a6a20'), '#5a3a10', 2);
  // 宝座
  isoBox(ctx, 0.8, 0.8, 2.4, 2.4, 44, '#c89a3a', '#8a6a20', '#7a5a18');
  // 立柱
  for (let t = 2; t <= 20; t += 6) { pillar(ctx, 0.3, t, wallH - 6, '#b8281e', '#5a0c08', 10); pillar(ctx, t, 0.3, wallH - 6, '#b8281e', '#5a0c08', 10); }
  // 灯
  for (const [a, b] of [[1, 9], [9, 1], [1, 16], [16, 1]]) {
    isoBox(ctx, a - 0.3, b - 0.3, a + 0.3, b + 0.3, 50, '#d8b050', '#8a6a20', '#7a5a18');
    const [x, y] = P(a, b, 58);
    if (time === 'night') glow(ctx, x, y, 90);
    ctx.fillStyle = '#ffd070'; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawTent(ctx, time, rand) {
  ctx.fillStyle = '#1a120a'; ctx.fillRect(0, 0, W, H);
  isoFloor(ctx, 30, (a, b) => (((a * 7 + b * 13) % 5) ? '#7a6a4a' : '#72624a'), 'rgba(0,0,0,0.08)');
  // 地毯
  quad(ctx, [[3, 3], [17, 3], [17, 17], [3, 17]], '#7a2a1e', '#c8a050', 3);
  quad(ctx, [[4, 4], [16, 4], [16, 16], [4, 16]], 'rgba(0,0,0,0)', '#c8a050', 1.5);
  for (let a = 5; a < 16; a += 3) for (let b = 5; b < 16; b += 3) quad(ctx, [[a + 0.8, b], [a + 1.6, b + 0.8], [a + 0.8, b + 1.6], [a, b + 0.8]], 'rgba(200,160,80,0.35)');
  // 帐壁：帆布 + 竖缝 + 顶部垂边
  const wallH = 200;
  isoWalls(ctx, wallH, lin(ctx, 0, 0, 600, 0, '#9a8a64', '#d8c8a0'), lin(ctx, 600, 0, W, 0, '#d8c8a0', '#9a8a64'));
  for (const side of ['l', 'r']) {
    for (let t = 0; t < 22; t += 2.2) wallRect(ctx, side, t, t + 0.12, 0, wallH, 'rgba(90,70,40,0.35)');
    for (let t = 0; t < 22; t += 1.1) {
      const pt = (tt, h) => (side === 'l' ? P(0, tt, h) : P(tt, 0, h));
      fillPath(ctx, [pt(t, wallH), pt(t + 1.1, wallH), pt(t + 0.55, wallH - 16)], '#8a2a1e');
    }
    wallRect(ctx, side, 0, 22, wallH - 4, wallH, '#c8a050');
  }
  // 帅旗（墙角）
  for (const side of ['l', 'r']) wallRect(ctx, side, 0.3, 2.6, 40, 140, '#a8241a', '#d8b050', 2);
  const [fx, fy] = P(0, 0, 96);
  ctx.fillStyle = '#f0d070'; ctx.font = `bold 42px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('帅', fx, fy + 14);
  // 帅案（主位之后）+ 地图
  isoBox(ctx, 0.6, 0.6, 2.4, 2.4, 26, '#7a4a24', '#5a3418', '#4a2a12');
  quad(ctx, [[0.9, 0.9, 26.5], [2.1, 0.9, 26.5], [2.1, 2.1, 26.5], [0.9, 2.1, 26.5]], '#e8d8a8', '#8a6a3a');
  // 兵器架
  for (const [a, b, side] of [[0.4, 7, 'l'], [7, 0.4, 'r'], [0.4, 15, 'l'], [15, 0.4, 'r']]) {
    isoBox(ctx, a - 0.25, b - 1.2, a + 0.25, b + 1.2, 12, '#6a4424', '#4a2c14', '#3a2210');
    if (side === 'l') for (let k = -1; k <= 1; k++) {
      const [x0, y0] = P(a, b + k * 0.7, 0), [x1, y1] = P(a, b + k * 0.7, 120);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      fillPath(ctx, [[x1, y1], [x1 - 4, y1 + 10], [x1, y1 - 12], [x1 + 4, y1 + 10]], '#d8dce4', '#5a5a60');
    } else for (let k = -1; k <= 1; k++) {
      const [x0, y0] = P(a + k * 0.7, b, 0), [x1, y1] = P(a + k * 0.7, b, 120);
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      fillPath(ctx, [[x1, y1], [x1 - 4, y1 + 10], [x1, y1 - 12], [x1 + 4, y1 + 10]], '#d8dce4', '#5a5a60');
    }
  }
  // 火盆
  for (const [a, b] of [[1.2, 11], [11, 1.2]]) {
    isoBox(ctx, a - 0.5, b - 0.5, a + 0.5, b + 0.5, 22, '#3a3030', '#2a2020', '#1a1414');
    const [x, y] = P(a, b, 28);
    glow(ctx, x, y, time === 'night' ? 110 : 50);
    fillPath(ctx, [[x - 10, y + 4], [x - 4, y - 18], [x, y - 6], [x + 5, y - 22], [x + 10, y + 4]], '#ffb030', '#d85010');
  }
}

function drawHall(ctx, time, rand) {
  ctx.fillStyle = '#140e08'; ctx.fillRect(0, 0, W, H);
  // 木地板：沿 a 方向的长条
  for (let b = -2; b < 30; b++) for (let a = -2; a < 30; a += 3) {
    const o = (b % 2) * 1.5;
    quad(ctx, [[a + o, b], [a + o + 3, b], [a + o + 3, b + 1], [a + o, b + 1]], (a + b * 3) % 4 ? '#b07c48' : '#a27040', 'rgba(60,36,16,0.5)', 0.8);
  }
  const wallH = 185;
  isoWalls(ctx, wallH, lin(ctx, 0, 0, 600, 0, '#c8bca0', '#efe6d0'), lin(ctx, 600, 0, W, 0, '#efe6d0', '#c8bca0'));
  for (const side of ['l', 'r']) {
    wallRect(ctx, side, 0, 22, 0, 16, '#5a3a1e');
    wallRect(ctx, side, 0, 22, wallH - 14, wallH, '#5a3a1e');
    for (let t = 0; t <= 22; t += 4.4) wallRect(ctx, side, t - 0.2, t + 0.2, 0, wallH, '#6a4424');
    // 格窗
    for (const t of [5.4, 14.2]) {
      wallRect(ctx, side, t, t + 2.6, 60, 140, '#f6eed8', '#6a4424', 3);
      for (let k = 1; k < 4; k++) wallRect(ctx, side, t, t + 2.6, 60 + k * 20, 61.5 + k * 20, '#6a4424');
      for (let k = 1; k < 3; k++) wallRect(ctx, side, t + k * 0.87, t + k * 0.87 + 0.08, 60, 140, '#6a4424');
    }
  }
  // 挂轴（左墙）
  wallRect(ctx, 'l', 10.2, 12.2, 40, 160, '#f2ead6', '#8a6a3a', 2);
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2;
  { const [x0, y0] = P(0, 10.8, 140), [x1, y1] = P(0, 11.6, 60); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + 30, (y0 + y1) / 2, x1, y1); ctx.stroke(); }
  // 屏风（墙角）
  for (const side of ['l', 'r']) for (let k = 0; k < 3; k++) wallRect(ctx, side, 0.3 + k * 1.1, 1.3 + k * 1.1, 6, 130, lin(ctx, 0, 0, 0, 140, '#f0e6c8', '#c8b88a'), '#5a3a1e', 2);
  // 书案（主位之后）+ 书卷
  isoBox(ctx, 0.7, 0.7, 2.6, 2.2, 18, '#5a341a', '#42260e', '#36200c');
  isoBox(ctx, 1.0, 1.0, 1.6, 1.4, 22, '#e8dcb8', '#c8b890', '#b8a880');
  // 盆栽
  for (const [a, b] of [[1, 17], [17, 1], [1, 7], [7, 1]]) {
    isoBox(ctx, a - 0.5, b - 0.5, a + 0.5, b + 0.5, 18, '#6a4a3a', '#4a3020', '#3a2418');
    const [x, y] = P(a, b, 18);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#3a6a32' : '#4e8040';
      ctx.beginPath(); ctx.ellipse(x + (i - 2.5) * 6, y - 18 - (i % 3) * 8, 10, 6, (i - 2.5) * 0.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 灯笼
  for (const [a, b] of [[0, 8.5], [8.5, 0], [0, 18], [18, 0]]) {
    const [x, y] = P(a, b, 150);
    if (time === 'night') glow(ctx, x, y + 20, 100);
    ctx.fillStyle = '#c82a1e'; ctx.beginPath(); ctx.ellipse(x, y + 20, 11, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8b050'; ctx.fillRect(x - 6, y + 3, 12, 4); ctx.fillRect(x - 6, y + 33, 12, 4);
  }
}

function drawStreet(ctx, time, rand) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, 300, ...SKY[time]); ctx.fillRect(0, 0, W, H);
  isoFloor(ctx, 30, (a, b) => ['#a8a294', '#9e988a', '#b0aa9c'][(a * 5 + b * 3 + 30) % 3], 'rgba(60,56,48,0.35)');
  // 屋舍：沿两条后边排列，屋顶为灰瓦
  const house = (side, t0, t1, h, wall, door) => {
    wallRect(ctx, side, t0, t1, 0, h, wall, 'rgba(0,0,0,0.3)', 1);
    wallRect(ctx, side, t0, t1, h - 10, h, '#6a4424');
    for (let t = t0 + 0.6; t < t1 - 0.6; t += 1.6) wallRect(ctx, side, t, t + 0.9, 50, 80, '#5a3a20', '#3a2410', 1);
    if (door) wallRect(ctx, side, (t0 + t1) / 2 - 0.7, (t0 + t1) / 2 + 0.7, 0, 60, '#4a2a14', '#2a160a', 1.5);
    const pt = (t, hh, out) => (side === 'l' ? P(-out, t, hh) : P(t, -out, hh));
    fillPath(ctx, [pt(t0 - 0.3, h, -1.4), pt(t1 + 0.3, h, -1.4), pt(t1 + 0.3, h + 46, 0.6), pt(t0 - 0.3, h + 46, 0.6)], lin(ctx, 0, 0, 0, 200, '#5a5a62', '#34343a'), '#1e1e22', 1.2);
    for (let t = t0; t < t1; t += 0.5) {
      const [x0, y0] = pt(t, h, -1.4), [x1, y1] = pt(t, h + 46, 0.6);
      ctx.strokeStyle = 'rgba(20,20,24,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  };
  house('l', 0, 6.5, 120, '#d8ccb0', true); house('l', 7, 13, 105, '#c8bca0', true); house('l', 13.5, 22, 125, '#d8ccb0', true);
  house('r', 0, 7, 115, '#c8bca0', true); house('r', 7.5, 14, 130, '#d8ccb0', true); house('r', 14.5, 22, 110, '#c8bca0', true);
  // 酒旗 / 招牌
  for (const [side, t, txt] of [['l', 9.8, '酒'], ['r', 10.5, '茶'], ['r', 3.5, '药']]) {
    wallRect(ctx, side, t, t + 0.9, 70, 102, '#f0e6c8', '#5a3a1e', 1.5);
    const [x, y] = side === 'l' ? P(0, t + 0.45, 86) : P(t + 0.45, 0, 86);
    ctx.fillStyle = '#2a1a0c'; ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(txt, x, y + 5);
  }
  // 灯笼
  for (const [side, t] of [['l', 6.75], ['l', 13.25], ['r', 7.25], ['r', 14.25]]) {
    const [x, y] = side === 'l' ? P(0.2, t, 96) : P(t, 0.2, 96);
    if (time === 'night') glow(ctx, x, y, 90);
    ctx.fillStyle = '#d0301e'; ctx.beginPath(); ctx.ellipse(x, y, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 水井、货车
  isoBox(ctx, 1.5, 11, 3, 12.5, 16, '#7a7468', '#5a554c', '#4a463e');
  quad(ctx, [[1.8, 11.3, 16.5], [2.7, 11.3, 16.5], [2.7, 12.2, 16.5], [1.8, 12.2, 16.5]], '#1a2a3a');
  isoBox(ctx, 12, 1.4, 14.2, 2.6, 14, '#9a6a3a', '#6a4424', '#5a381c');
  for (const [a, b] of [[12.4, 2.6], [13.8, 2.6]]) { const [x, y] = P(a, b, 4); ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 6; i++) { const [x, y] = P(12.4 + (i % 3) * 0.6, 1.6 + Math.floor(i / 3) * 0.5, 22); ctx.fillStyle = '#e8d8a8'; ctx.beginPath(); ctx.ellipse(x, y, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); }
}

function drawCamp(ctx, time, rand) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, 300, ...SKY[time]); ctx.fillRect(0, 0, W, H);
  ridge(ctx, 170, 70, HAZE[time], 1.7);
  isoFloor(ctx, 30, (a, b) => (((a * 3 + b * 5) % 7) ? '#8a9a5a' : '#829254'), 'rgba(0,0,0,0.05)');
  for (let i = 0; i < 160; i++) { const [x, y] = P(rand() * 24, rand() * 24); tuft(ctx, x, y, 0.6, '#5a7a34'); }
  // 栅栏（后边）
  for (let t = -1; t < 23; t += 0.55) {
    for (const [a, b] of [[-0.5, t], [t, -0.5]]) {
      const [x, y] = P(a, b);
      ctx.fillStyle = lin(ctx, x - 3, 0, x + 3, 0, '#8a5a2a', '#5a3818');
      fillPath(ctx, [[x - 3, y], [x + 3, y], [x + 3, y - 58], [x, y - 66], [x - 3, y - 58]], ctx.fillStyle, '#2a1a0a', 0.8);
    }
  }
  for (const [a0, b0, a1, b1] of [[-0.5, -1, -0.5, 23], [-1, -0.5, 23, -0.5]]) {
    for (const h of [18, 44]) { const p0 = P(a0, b0, h), p1 = P(a1, b1, h); ctx.strokeStyle = '#4a2e14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke(); }
  }
  // 营帐：方底尖顶
  const tent = (a, b, s, col, dark) => {
    const apex = P(a, b, 90 * s);
    const c = [P(a - 1.6 * s, b - 1.6 * s), P(a + 1.6 * s, b - 1.6 * s), P(a + 1.6 * s, b + 1.6 * s), P(a - 1.6 * s, b + 1.6 * s)];
    fillPath(ctx, [c[3], c[2], apex], col, '#5a4a2a', 1.2);
    fillPath(ctx, [c[1], c[2], apex], dark, '#5a4a2a', 1.2);
    const m = P(a, b + 1.6 * s);
    fillPath(ctx, [[m[0] - 10 * s, m[1] - 4 * s], [m[0] + 14 * s, m[1] + 2 * s], [(m[0] + apex[0]) / 2 + 2, (m[1] + apex[1]) / 2 + 8]], '#3a2a14');
    ctx.fillStyle = '#3a2410'; ctx.fillRect(apex[0] - 1.5, apex[1] - 26, 3, 26);
    fillPath(ctx, [[apex[0] + 1.5, apex[1] - 26], [apex[0] + 22, apex[1] - 21], [apex[0] + 1.5, apex[1] - 15]], '#b8281e');
  };
  tent(1.8, 9.5, 1, '#e8dcb8', '#c8b890');
  tent(9.5, 1.8, 1, '#e8dcb8', '#c8b890');
  tent(2, 17, 1.1, '#e0d4b0', '#c0b088');
  tent(17, 2, 1.1, '#e0d4b0', '#c0b088');
  // 帅旗
  const [fx, fy] = P(1.2, 1.2);
  ctx.fillStyle = '#3a2410'; ctx.fillRect(fx - 2.5, fy - 200, 5, 200);
  fillPath(ctx, [[fx + 2.5, fy - 196], [fx + 70, fy - 186], [fx + 64, fy - 150], [fx + 72, fy - 116], [fx + 2.5, fy - 122]], '#a8241a', '#d8b050', 2);
  ctx.fillStyle = '#f0d070'; ctx.font = `bold 34px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('帅', fx + 36, fy - 144);
  // 篝火
  for (const [a, b] of [[9.5, 9.5]]) {
    const [x, y] = P(a, b);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 6; k++) { const ang = k * Math.PI / 3; ctx.fillStyle = '#6a6460'; ctx.beginPath(); ctx.ellipse(x + Math.cos(ang) * 20, y + Math.sin(ang) * 9, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    glow(ctx, x, y - 10, time === 'night' ? 160 : 60);
    fillPath(ctx, [[x - 14, y], [x - 6, y - 30], [x, y - 12], [x + 6, y - 36], [x + 14, y]], '#ffb030', '#d85010');
  }
}

// ---------- 中国地图 ----------
const COAST = [[124.5, 40.0], [123, 39.6], [121.2, 38.8], [122, 40.4], [121.3, 40.9], [119.5, 39.9], [118, 39.1], [117.7, 38.4], [118.9, 37.5], [119.4, 37.2],
  [120.7, 37.8], [122.5, 37.3], [121.6, 36.7], [120.3, 36.0], [119.3, 35.1], [120.3, 34.3], [120.9, 32.6], [121.9, 31.5], [121.0, 30.6], [122.1, 29.8],
  [121.5, 28.3], [120.6, 27.2], [119.6, 25.6], [118.5, 24.5], [117.1, 23.5], [115.4, 22.8], [113.7, 22.4], [112.3, 21.8], [110.5, 21.2], [109.7, 21.6],
  [108.5, 21.6], [107.5, 21.2]];
const RIVERS = {
  黄河: [[98, 35.2], [101.5, 36.0], [103.8, 36.1], [105.5, 37.5], [106.5, 39.3], [107.5, 40.6], [110, 40.6], [111, 40.2], [111.3, 38.5], [110.5, 36.5],
    [110.3, 34.7], [111.5, 34.8], [113, 34.95], [114.5, 35.1], [115.5, 35.9], [117, 36.8], [118.8, 37.7]],
  长江: [[98, 27.5], [101, 26.8], [103, 28.0], [104.6, 28.8], [106.5, 29.6], [108.4, 30.8], [109.5, 31.0], [111.3, 30.7], [112.2, 30.3], [113, 29.5],
    [114.3, 30.6], [116, 29.8], [117.5, 30.8], [118.8, 32.0], [120, 32.3], [121.2, 31.6]],
  汉水: [[106.6, 33.1], [109, 32.7], [111, 32.6], [112.1, 32.0], [113, 30.9], [114.3, 30.6]],
  渭水: [[104.5, 34.6], [107.6, 34.3], [109, 34.4], [110.3, 34.6]],
  淮河: [[113.3, 32.4], [115.4, 32.5], [116.8, 32.6], [118.5, 33.2], [119.6, 33.8]],
};
const PROVINCES = {
  幽州: [117.5, 40.6], 冀州: [115.6, 38.2], 并州: [111.6, 38.4], 青州: [119.4, 36.2], 兖州: [116.2, 35.3], 徐州: [118.5, 33.8], 豫州: [115.4, 33.4],
  司隶: [110.8, 35.2], 凉州: [103.5, 37.2], 雍州: [106.2, 35.3], 益州: [103.2, 30.0], 荆州: [112.4, 28.5], 扬州: [118.3, 29.4], 交州: [109.2, 23.2],
};
const MOUNTAINS = [[104, 33.5], [105.5, 33.8], [107, 33.7], [108.5, 33.6], [110, 33.9], [113.4, 36.5], [113.6, 37.6], [113.2, 38.6], [101.5, 30.5], [102.5, 31.8], [101.8, 29], [110, 29.5], [111, 26.5], [116, 26.5], [118, 28], [109, 25]];
const GREAT_WALL = [[103, 38], [106.5, 38.5], [110, 40.4], [114, 40.8], [118, 40.3], [119.8, 40.0]];

function drawChina(ctx, view) {
  const proj = mapProjector(view);
  const z = proj.zoom;
  const pt = (lon, lat) => { const m = lonLatToMap(lon, lat); const s = proj(m.x, m.y); return [s.x, s.y]; };
  // 陆地（羊皮纸色）+ 海
  ctx.fillStyle = lin(ctx, 0, 0, W, H, '#e2cf9e', '#d0b880', '#c8ac70'); ctx.fillRect(0, 0, W, H);
  const sea = [...COAST.map((p) => pt(...p)), pt(107.5, 15), pt(130, 15), pt(130, 40)];
  fillPath(ctx, sea, lin(ctx, 0, 0, W, H, '#7a9aa0', '#5a7a88'));
  path(ctx, COAST.map((p) => pt(...p)), false);
  ctx.strokeStyle = '#4a5a58'; ctx.lineWidth = 2 * Math.sqrt(z); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 6 * Math.sqrt(z); ctx.stroke();
  // 海浪纹
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  for (let i = 0; i < 30; i++) {
    const [x, y] = pt(121 + (i % 5) * 1.5, 22 + Math.floor(i / 5) * 3);
    ctx.beginPath(); ctx.arc(x, y, 8 * z, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  // 山脉
  for (const [lon, lat] of MOUNTAINS) {
    const [x, y] = pt(lon, lat), s = 14 * Math.sqrt(z);
    for (const dx of [-1, 0, 1]) fillPath(ctx, [[x + dx * s * 1.2 - s, y + (dx ? 3 : 0)], [x + dx * s * 1.2, y - s * (dx ? 1.1 : 1.6)], [x + dx * s * 1.2 + s, y + (dx ? 3 : 0)]], 'rgba(120,96,60,0.55)', 'rgba(80,60,30,0.6)', 1);
  }
  // 长城
  path(ctx, GREAT_WALL.map((p) => pt(...p)), false);
  ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 4 * Math.sqrt(z); ctx.setLineDash([6, 3]); ctx.stroke(); ctx.setLineDash([]);
  // 河流
  for (const [name, pts] of Object.entries(RIVERS)) {
    path(ctx, pts.map((p) => pt(...p)), false);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a7a98'; ctx.lineWidth = (name === '黄河' || name === '长江' ? 4.5 : 2.5) * Math.sqrt(z); ctx.stroke();
    if (name === '黄河' || name === '长江') {
      const [x, y] = pt(...pts[Math.floor(pts.length * 0.62)]);
      ctx.fillStyle = 'rgba(40,70,100,0.8)'; ctx.font = `${Math.round(15 * Math.sqrt(z))}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(name, x, y - 10);
    }
  }
  // 州名
  ctx.font = `bold ${Math.round(24 * Math.sqrt(z))}px ${FONT}`; ctx.textAlign = 'center';
  for (const [name, p] of Object.entries(PROVINCES)) {
    const [x, y] = pt(...p);
    ctx.fillStyle = 'rgba(110,70,30,0.42)'; ctx.fillText(name, x, y);
  }
  // 主要城市
  for (const name of MAJOR_CITIES) {
    const [x, y] = pt(...CITIES[name]);
    ctx.fillStyle = '#5a2a1a'; ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.strokeStyle = '#f0e0b0'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = '#3a200e'; ctx.font = `${Math.round(14 * Math.sqrt(z))}px ${FONT}`; ctx.fillText(name, x, y - 9);
  }
  // 边框与暗角
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
  vg.addColorStop(0, 'rgba(60,30,10,0)'); vg.addColorStop(1, 'rgba(60,30,10,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#6a4a20'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, W - 10, H - 10);
  ctx.strokeStyle = '#d8b050'; ctx.lineWidth = 2; ctx.strokeRect(14, 14, W - 28, H - 28);
}

const DRAW = {
  field: drawField, citygate: drawCityGate, river: drawRiver, mountain: drawMountain,
  palace: drawPalace, tent: drawTent, hall: drawHall, street: drawStreet, camp: drawCamp,
};
// 时段色调（只叠加在已有像素上）
const TINT = { dusk: 'rgba(200,110,60,0.22)', night: 'rgba(14,22,60,0.42)' };

// 生成背景贴图并返回 key；同一时刻只保留当前背景的贴图（每张 1200×672×RES²，体积较大）
export function backgroundTexture(scene, name, { time = 'day', view = 'all' } = {}) {
  const def = BACKGROUNDS[name] || BACKGROUNDS.field;
  if (!BACKGROUNDS[name]) name = 'field';
  const key = def.kind === 'map' ? `sbg-${name}-${view}` : `sbg-${name}-${time}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, W * RES, H * RES);
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(RES, RES);
  ctx.lineJoin = 'round';
  const rand = rng([...name].reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  if (def.kind === 'map') {
    drawChina(ctx, view);
  } else {
    DRAW[name](ctx, time, rand);
    if (TINT[time]) {
      // 夜晚 / 黄昏：整体着色；外场景的天空已按时段绘制，只给地面部分着色
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = TINT[time];
      ctx.fillRect(0, def.kind === 'outer' ? 180 : 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (def.kind === 'outer') {
      // 天空画在已有图像之后（只填透明处），不受地面着色影响
      const sc = document.createElement('canvas');
      sc.width = W * RES; sc.height = H * RES;
      const sx = sc.getContext('2d');
      sx.scale(RES, RES);
      sky(sx, time, 260, rand);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(sc, 0, 0);
      ctx.restore();
    }
    if (time === 'night') {
      // 夜晚灯火在着色后补一层亮光
      ctx.globalCompositeOperation = 'lighter';
      DRAW_LIGHTS[name]?.(ctx);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
  tex.refresh();
  return key;
}

// 夜景灯光位置（与各背景中的灯 / 火位置一致）
const lights = (pts, r = 80) => (ctx) => pts.forEach(([a, b, h]) => { const [x, y] = P(a, b, h); glow(ctx, x, y, r, 'rgba(255,170,70,0.35)'); });
const DRAW_LIGHTS = {
  palace: lights([[1, 9, 58], [9, 1, 58], [1, 16, 58], [16, 1, 58]]),
  tent: lights([[1.2, 11, 30], [11, 1.2, 30]], 120),
  hall: lights([[0, 8.5, 130], [8.5, 0, 130], [0, 18, 130], [18, 0, 130]]),
  street: lights([[0.2, 6.75, 96], [0.2, 13.25, 96], [7.25, 0.2, 96], [14.25, 0.2, 96]]),
  camp: lights([[9.5, 9.5, 10]], 170),
  citygate: (ctx) => { glow(ctx, 600, 230, 120, 'rgba(255,170,70,0.3)'); },
};

export function purgeBackgrounds(scene, keep) {
  for (const k of scene.textures.getTextureKeys()) if (k.startsWith('sbg-') && k !== keep) scene.textures.remove(k);
}

export { N as FLOOR_SIZE };
