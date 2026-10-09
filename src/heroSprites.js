// 高清矢量人物：Canvas 2D 程序化绘制，逻辑坐标 LW x LH，贴图按 TEX 倍分辨率生成
export const TEX = 3;
export const LW = 60, LH = 66, PAD = 34;
export const ANCHOR_X = 26, FEET_Y = 63;

export const C = {
  skin: '#f6cfa2', skinD: '#d9996a', hair: '#1e140e', gold: '#f0cc62', goldD: '#9a7420', metal: '#eef2f6', metalD: '#7d8896',
  wood: '#9a6638', woodD: '#4e3016', red: '#d42e22', redD: '#6e100a', yellow: '#f6d43e', yellowD: '#a8820e', white: '#fbf8ef', ink: '#1a1008',
};
const FACTION = {
  player: { a: '#4a86e8', d: '#1c3a7c', l: '#b4d0f6' },
  enemy: { a: '#d4402f', d: '#661409', l: '#e8b49a' },
  ally: { a: '#38a957', d: '#165226', l: '#b0e8c0' },
};

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

export function kit(ctx) {
  const grad = (x0, y0, x1, y1, ...cols) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c));
    return g;
  };
  const fill = (style, path, stroke = C.ink, lw = 0.7) => {
    ctx.beginPath(); path(); ctx.fillStyle = style; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  const ell = (x, y, rx, ry, rot = 0, a0 = 0, a1 = Math.PI * 2) => () => ctx.ellipse(x, y, rx, ry, rot, a0, a1);
  const poly = (...pts) => () => { ctx.moveTo(...pts[0]); pts.slice(1).forEach((p) => ctx.lineTo(...p)); ctx.closePath(); };
  const line = (x0, y0, x1, y1, w, color, outline = true) => {
    ctx.lineCap = 'round';
    if (outline) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = C.ink; ctx.lineWidth = w + 1.3; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
  };
  return { ctx, grad, fill, ell, poly, line };
}

function lookOf(unit) {
  const look = {
    lord: { head: 'crown', weapon: 'sword', horse: '#3c3530', cape: true, beard: 'goatee' },
    cavalry: { head: 'helmet', weapon: 'spear', horse: '#9a6232' },
    infantry: { head: 'helmet', weapon: 'sword', shield: true },
    archer: { head: 'cap', weapon: 'bow', quiver: true },
    strategist: { head: 'scholar', weapon: 'fan', robe: true },
    bandit: { head: 'turban', weapon: 'club', cloth: { a: '#9a7444', d: '#4e3418', l: '#d8bc8a' } },
    taoist: { head: 'taoist', weapon: 'staff', robe: true, robeColor: '#d6ae36', beard: 'long' },
  }[unit.cls];
  const special = {
    lvbu: { weapon: 'halberd', horse: '#b8241a', head: 'feather' },
    dianwei: { weapon: 'halberd', shield: false, beard: 'full' },
    huaxiong: { beard: 'full', horse: '#4a4038' },
    xiahoudun: { beard: 'goatee', horse: '#e8e0d0' },
    sunjian: { horse: '#c89a5a', cape: true },
    zhangbao: { beard: 'long' },
  }[unit.id];
  return { ...look, ...special };
}

// ---------- 人物 ----------
function drawHuman(k, L, F, oy, mounted) {
  const { ctx, grad, fill, ell, poly, line } = k;
  const y = (v) => v + oy;
  const P = L.cloth || F;
  if (L.cape) fill(grad(0, y(26), 0, y(54), C.red, C.redD), poly([18, y(25)], [34, y(25)], [40, y(mounted ? 40 : 52)], [26, y(mounted ? 43 : 55)], [12, y(mounted ? 40 : 52)]));
  if (L.quiver) {
    fill(grad(31, 0, 37, 0, C.wood, C.woodD), poly([31, y(22)], [36, y(20)], [39, y(38)], [34, y(40)]));
    for (const dx of [0, 2, 4]) fill(C.white, poly([31.5 + dx, y(15)], [33 + dx, y(21)], [30.5 + dx, y(21)]), C.ink, 0.4);
  }
  if (!mounted && !L.robe) {
    line(22, y(40), 21, y(54), 4.6, P.d);
    line(30, y(40), 31, y(54), 4.6, P.d);
    fill(grad(0, y(54), 0, y(59), '#5a3a22', '#21140a'), ell(20, y(57), 4.2, 2.6));
    fill(grad(0, y(54), 0, y(59), '#5a3a22', '#21140a'), ell(32, y(57), 4.2, 2.6));
  }
  if (L.robe) {
    const rc = L.robeColor || F.l;
    fill(grad(0, y(25), 0, y(60), shade(rc, 1.15), shade(rc, 0.7)), () => {
      ctx.moveTo(18, y(25)); ctx.lineTo(34, y(25)); ctx.lineTo(38, y(mounted ? 38 : 57));
      ctx.quadraticCurveTo(26, y(mounted ? 41 : 61), 14, y(mounted ? 38 : 57)); ctx.closePath();
    });
    fill(C.white, poly([22, y(25)], [26, y(33)], [30, y(25)]), C.ink, 0.5);
    fill(grad(0, y(37), 0, y(40), C.gold, C.goldD), poly([17, y(37)], [35, y(37)], [35.3, y(40)], [16.7, y(40)]));
    line(26, y(40), 25, y(48), 1.4, C.gold, false);
    fill(grad(9, 0, 20, 0, shade(rc, 1.1), shade(rc, 0.75)), ell(15, y(35), 5, 7.5, 0.15));
    fill(grad(32, 0, 43, 0, shade(rc, 1.1), shade(rc, 0.75)), ell(37, y(34), 5, 7, -0.15));
  } else {
    fill(grad(0, y(39), 0, y(49), P.a, P.d), poly([17, y(39)], [35, y(39)], [39, y(48)], [13, y(48)]));
    ctx.strokeStyle = shade(P.d, 0.6); ctx.lineWidth = 0.5;
    for (const ry of [42, 45]) for (let x = 15 + (ry % 2); x < 37; x += 3) { ctx.beginPath(); ctx.arc(x, y(ry), 1.5, 0, Math.PI); ctx.stroke(); }
    fill(grad(0, y(25), 0, y(40), shade(P.a, 1.25), P.a, P.d), poly([17, y(25)], [35, y(25)], [34, y(40)], [18, y(40)]));
    fill(grad(20, y(28), 32, y(36), shade(P.l, 1.05), shade(P.a, 0.95)), ell(26, y(32), 6, 4.8), C.ink, 0.4);
    fill(grad(24, y(30), 28, y(34), C.white, C.gold, C.goldD), ell(26, y(32), 2.3, 2.3), C.ink, 0.5);
    fill(grad(0, y(38), 0, y(41), C.gold, C.goldD), poly([17, y(38)], [35, y(38)], [35.2, y(40.6)], [16.8, y(40.6)]));
    fill(C.goldD, poly([24.5, y(37.6)], [27.5, y(37.6)], [27.5, y(41)], [24.5, y(41)]), C.ink, 0.4);
    fill(grad(12, y(24), 18, y(32), shade(P.a, 1.3), P.d), ell(17, y(28), 5.2, 4), C.gold, 0.8);
    fill(grad(34, y(24), 40, y(32), shade(P.a, 1.3), P.d), ell(35, y(28), 5.2, 4), C.gold, 0.8);
  }
  // 手臂
  const sleeve = L.robe ? shade(L.robeColor || F.l, 0.9) : P.a;
  if (L.weapon === 'bow') line(16, y(29), 10, y(36), 4, sleeve); else line(16, y(29), 14.5, y(39), 4, sleeve);
  line(36, y(29), 38, y(37), 4, sleeve);
  fill(C.skin, ell(L.weapon === 'bow' ? 9.5 : 14.5, y(L.weapon === 'bow' ? 37 : 40), 2.3, 2.3), C.ink, 0.6);
  drawHead(k, L, P, oy);
  drawWeapon(k, L, oy);
  fill(C.skin, ell(38.3, y(38.5), 2.3, 2.3), C.ink, 0.6);
  if (L.shield) {
    fill(grad(6, y(32), 18, y(48), '#b07a44', '#5a3518'), ell(12, y(40), 6.2, 8.2), C.metalD, 1.4);
    fill(grad(10, y(38), 14, y(42), C.white, C.gold, C.goldD), ell(12, y(40), 2, 2), C.ink, 0.5);
    ctx.strokeStyle = shade(P.a, 1); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(12, y(40), 4.4, 6.2, 0, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawHead(k, L, P, oy) {
  const { ctx, grad, fill, ell, poly, line } = k;
  const y = (v) => v + oy;
  fill(C.skinD, poly([23.5, y(22)], [28.5, y(22)], [28.5, y(27)], [23.5, y(27)]), null);
  fill(C.skin, ell(17.6, y(17), 1.6, 2.2));
  fill(C.skin, ell(34.4, y(17), 1.6, 2.2));
  const fg = ctx.createRadialGradient(24, y(14), 1, 26, y(17), 10);
  fg.addColorStop(0, '#fde3c2'); fg.addColorStop(1, C.skinD);
  fill(fg, ell(26, y(17), 8.4, 8.6));
  fill(C.hair, ell(26, y(15.5), 8.9, 7.6, 0, Math.PI, 0), null);
  fill(C.hair, poly([17.2, y(15)], [19.4, y(15)], [19, y(20)], [17.4, y(19)]), null);
  fill(C.hair, poly([34.8, y(15)], [32.6, y(15)], [33, y(20)], [34.6, y(19)]), null);
  line(20.3, y(14.6), 23.8, y(15.3), 0.9, C.hair, false);
  line(28.2, y(15.3), 31.7, y(14.6), 0.9, C.hair, false);
  for (const ex of [22.4, 29.6]) {
    fill(C.ink, ell(ex, y(17.8), 1.25, 1.75), null);
    fill(C.white, ell(ex + 0.4, y(17.2), 0.45, 0.5), null);
  }
  fill('rgba(235,120,100,0.35)', ell(20.4, y(20.2), 1.8, 1), null);
  fill('rgba(235,120,100,0.35)', ell(31.6, y(20.2), 1.8, 1), null);
  line(25, y(22), 27.4, y(21.8), 0.7, '#9a4a34', false);
  if (L.beard === 'goatee') { fill(C.hair, poly([24.5, y(23.3)], [27.5, y(23.3)], [26, y(27)]), null); line(23.5, y(21.3), 25.2, y(21), 0.6, C.hair, false); line(26.8, y(21), 28.5, y(21.3), 0.6, C.hair, false); }
  if (L.beard === 'full') fill(C.hair, () => { ctx.moveTo(18.5, y(18)); ctx.quadraticCurveTo(19, y(28), 26, y(29)); ctx.quadraticCurveTo(33, y(28), 33.5, y(18)); ctx.quadraticCurveTo(26, y(24), 18.5, y(18)); }, null);
  if (L.beard === 'long') fill('#5a5048', () => { ctx.moveTo(23, y(22.5)); ctx.lineTo(29, y(22.5)); ctx.lineTo(26, y(33)); ctx.closePath(); }, null);
  drawHat(k, L, P, oy);
}

function drawHat(k, L, P, oy) {
  const { ctx, grad, fill, ell, poly, line } = k;
  const y = (v) => v + oy;
  const helmet = (main, dark) => {
    fill(dark, poly([16.5, y(12)], [15.5, y(20)], [19, y(19)], [19.2, y(12)]));
    fill(dark, poly([35.5, y(12)], [36.5, y(20)], [33, y(19)], [32.8, y(12)]));
    fill(grad(20, y(3), 30, y(13), shade(main, 1.35), main, dark), ell(26, y(12.5), 10, 8.5, 0, Math.PI, 0));
    fill(grad(0, y(11), 0, y(14.5), C.gold, C.goldD), poly([15.6, y(11.5)], [36.4, y(11.5)], [36, y(14.2)], [16, y(14.2)]), C.ink, 0.5);
    fill(C.gold, poly([26, y(5.5)], [28, y(11.2)], [24, y(11.2)]), C.ink, 0.4);
    line(26, y(4.5), 26, y(1), 1.1, C.metal);
  };
  switch (L.head) {
    case 'helmet':
      helmet(P.a, P.d);
      fill(grad(0, y(-3), 0, y(3), '#ff5a40', C.redD), () => { ctx.moveTo(26, y(1)); ctx.quadraticCurveTo(31, y(-3), 33, y(4)); ctx.quadraticCurveTo(29, y(1), 26, y(2)); }, C.ink, 0.4);
      break;
    case 'crown':
      helmet(C.gold, C.goldD);
      fill(C.red, ell(26, y(0.5), 2.6, 2.4));
      line(17, y(8), 12.5, y(3), 1.3, C.gold); line(35, y(8), 39.5, y(3), 1.3, C.gold);
      fill(C.red, ell(26, y(9.5), 1.3, 1.3), null);
      break;
    case 'feather':
      helmet(C.gold, C.goldD);
      for (const [x0, cx, x1] of [[22, 12, 5], [30, 40, 47]]) {
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y(6)); ctx.quadraticCurveTo(cx, y(-6), x1, y(-17));
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2.6; ctx.stroke();
        ctx.strokeStyle = '#c8281e'; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.setLineDash([1.2, 1.6]); ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([]);
      }
      fill(C.red, ell(26, y(1), 2.4, 2.2));
      break;
    case 'cap':
      fill(grad(0, y(5), 0, y(13), shade(P.a, 1.3), P.d), ell(26, y(12.8), 9.6, 7, 0, Math.PI, 0));
      fill(P.d, poly([16.4, y(11.5)], [35.6, y(11.5)], [35.6, y(13.6)], [16.4, y(13.6)]), C.ink, 0.5);
      line(35, y(12.5), 40, y(18), 1.6, P.d);
      break;
    case 'scholar':
      fill(grad(0, y(1), 0, y(13), '#3a342e', '#141110'), poly([19, y(12.5)], [33, y(12.5)], [31.2, y(1.5)], [20.8, y(1.5)]));
      fill('#141110', poly([18, y(10.5)], [34, y(10.5)], [34, y(13.4)], [18, y(13.4)]), C.ink, 0.5);
      line(19, y(13), 17, y(24), 0.9, '#2a2420', false); line(33, y(13), 35, y(24), 0.9, '#2a2420', false);
      line(21, y(4), 31, y(4), 0.5, '#5a524a', false);
      break;
    case 'turban':
      fill(grad(0, y(4), 0, y(14), shade(C.yellow, 1.2), C.yellowD), ell(26, y(12.6), 10.2, 7.6, 0, Math.PI, 0));
      for (const ty of [8, 11]) line(17, y(ty + 1), 35, y(ty), 0.6, C.yellowD, false);
      line(35, y(11), 40.5, y(17), 1.8, C.yellow); line(35, y(12), 38, y(20), 1.6, C.yellow);
      break;
    case 'taoist':
      fill(C.hair, ell(26, y(6.5), 4, 3));
      fill(grad(0, y(1), 0, y(8), shade(C.yellow, 1.2), C.yellowD), poly([22.5, y(8)], [29.5, y(8)], [28.5, y(2)], [23.5, y(2)]));
      line(19.5, y(5), 32.5, y(5), 0.9, C.gold);
      break;
    default:
  }
}

function drawWeapon(k, L, oy) {
  const { ctx, grad, fill, ell, poly, line } = k;
  const y = (v) => v + oy;
  const metal = (x0, y0, x1, y1) => grad(x0, y0, x1, y1, C.white, C.metal, C.metalD);
  switch (L.weapon) {
    case 'spear':
    case 'halberd': {
      line(41, y(L.weapon === 'halberd' ? 3 : 5), 38, y(61), 1.7, C.wood);
      fill(metal(39, y(-4), 43, y(6)), poly([41.4, y(-5)], [43.2, y(1.5)], [41.2, y(5.5)], [39.6, y(1.5)]));
      if (L.weapon === 'halberd') {
        fill(metal(41, y(3), 49, y(14)), () => {
          ctx.moveTo(41.5, y(4)); ctx.quadraticCurveTo(51, y(5), 49, y(15)); ctx.quadraticCurveTo(47, y(9), 41, y(11)); ctx.closePath();
        });
        fill(metal(34, y(4), 40, y(10)), poly([40.5, y(6)], [35, y(5)], [36.5, y(8)], [40.2, y(9)]));
      }
      fill(grad(0, y(6), 0, y(12), '#ff5a40', C.redD), () => { ctx.moveTo(40, y(6.5)); ctx.lineTo(42.5, y(6.5)); ctx.lineTo(43.5, y(12)); ctx.lineTo(38.5, y(12)); ctx.closePath(); }, C.ink, 0.4);
      break;
    }
    case 'sword':
      fill(metal(38, y(16), 44, y(36)), poly([39.4, y(36)], [41, y(36.5)], [45.5, y(17)], [44.6, y(14.5)], [43.6, y(16.5)]));
      line(42.2, y(18), 39.8, y(34), 0.4, C.metalD, false);
      line(37, y(35), 42.5, y(37.3), 1.5, C.gold);
      line(39.2, y(37.5), 38.4, y(40.5), 1.3, C.woodD);
      break;
    case 'bow':
      ctx.beginPath(); ctx.moveTo(10, y(17)); ctx.quadraticCurveTo(-1, y(37), 10, y(57));
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3.2; ctx.stroke();
      ctx.strokeStyle = C.wood; ctx.lineWidth = 2; ctx.stroke();
      line(10, y(17), 10, y(57), 0.5, '#efe8d6', false);
      fill(C.gold, ell(4.6, y(37), 1.4, 2.4), C.ink, 0.4);
      break;
    case 'fan':
      fill(grad(36, y(20), 46, y(36), C.white, '#d8d0c0'), () => {
        ctx.moveTo(39, y(38)); ctx.arc(39, y(38), 12, -2.25, -0.85); ctx.closePath();
      }, C.ink, 0.6);
      ctx.strokeStyle = '#a8a090'; ctx.lineWidth = 0.4;
      for (let a = -2.15; a < -0.9; a += 0.18) { ctx.beginPath(); ctx.moveTo(39, y(38)); ctx.lineTo(39 + Math.cos(a) * 11.5, y(38) + Math.sin(a) * 11.5); ctx.stroke(); }
      line(39, y(38), 39.6, y(42), 1.3, C.woodD);
      break;
    case 'staff':
      line(41, y(6), 39, y(61), 1.7, C.wood);
      ctx.beginPath(); ctx.arc(41.3, y(3), 3.4, 0, Math.PI * 2); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.9; ctx.stroke();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 1.1; ctx.stroke();
      fill(C.yellow, poly([40.5, y(7)], [43, y(7)], [44.5, y(13)], [39.5, y(13)]), C.ink, 0.4);
      break;
    case 'club':
      fill(grad(37, y(20), 45, y(30), '#b07a48', C.woodD), poly([37.3, y(40)], [39.6, y(40.4)], [45.8, y(22)], [41.6, y(19.5)]));
      for (const [nx, ny] of [[42.5, 23], [44, 25], [41.4, 27]]) fill(C.metalD, ell(nx, y(ny), 0.6, 0.6), null);
      break;
    default:
  }
}

function drawHorse(k, color, F) {
  const { ctx, grad, fill, ell, poly, line } = k;
  const mane = shade(color, 0.4);
  line(20, 49, 18.5, 62, 3.1, shade(color, 0.65));
  line(35, 49, 37, 62, 3.1, shade(color, 0.65));
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(12.5, 42); ctx.quadraticCurveTo(4, 46, 6.5, 59);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4.2; ctx.stroke(); ctx.strokeStyle = mane; ctx.lineWidth = 3; ctx.stroke();
  fill(grad(0, 37, 0, 53, shade(color, 1.3), color, shade(color, 0.6)), ell(26, 45.5, 14.5, 7.6));
  fill(grad(34, 28, 44, 46, shade(color, 1.25), shade(color, 0.8)), poly([33, 42], [37.5, 29.5], [44.5, 30], [41.5, 46.5]));
  fill(grad(40, 26, 52, 37, shade(color, 1.25), shade(color, 0.75)), ell(46.5, 32, 7, 3.7, 0.55));
  fill(shade(color, 0.55), ell(50.6, 35.2, 2.6, 2.1, 0.5), null);
  fill(C.ink, ell(51.3, 35.4, 0.5, 0.5), null);
  fill(C.ink, ell(44.6, 29.6, 0.95, 0.95), null);
  fill(C.white, ell(44.9, 29.3, 0.35, 0.35), null);
  fill(shade(color, 0.85), poly([40.6, 27.5], [42, 22.5], [43.8, 27.6]));
  line(40.5, 25.5, 35, 41, 2.4, mane, false);
  line(41.5, 26, 39, 28, 1.8, mane, false);
  line(43.6, 30.2, 50, 35.4, 0.7, C.red, false);
  line(45.5, 31.8, 34, 38, 0.6, '#3a2010', false);
  line(22, 49, 22, 62, 3.3, color);
  line(33, 49, 33.5, 62, 3.3, color);
  for (const hx of [22, 33.5]) fill('#2a1a10', poly([hx - 2, 61], [hx + 2, 61], [hx + 2.2, 63.4], [hx - 2.2, 63.4]), null);
  fill(grad(0, 38, 0, 50, F.a, F.d), poly([18.5, 38], [33.5, 38], [34.5, 49], [17.5, 49]), C.gold, 0.9);
  fill(grad(0, 35, 0, 39, '#8a5a30', '#4a2c14'), ell(26, 37.5, 7.5, 2.4));
}

export function unitTexture(scene, unit) {
  const L = lookOf(unit);
  const key = `hero-${unit.cls}-${unit.faction}-${unit.id}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, LW * TEX, (LH + PAD) * TEX);
  const ctx = tex.getContext();
  ctx.scale(TEX, TEX);
  ctx.translate(0, PAD);
  ctx.lineJoin = 'round';
  const k = kit(ctx);
  const F = FACTION[unit.faction];
  if (L.horse) {
    drawHorse(k, L.horse, F);
    drawHuman(k, L, F, -14, true);
    k.line(28, 34, 29, 47, 3.6, (L.cloth || F).d);
    k.fill('#2a1a10', k.ell(29.4, 48.5, 2.6, 1.6));
  } else {
    drawHuman(k, L, F, 3, false);
  }
  tex.refresh();
  return key;
}


export const weaponOf = (unit) => lookOf(unit).weapon;
export const mountedOf = (unit) => !!lookOf(unit).horse;
