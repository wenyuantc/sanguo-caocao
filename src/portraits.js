import { C, kit, shade } from './heroSprites.js';
import { getCharacter, skinOf, armorPalette, hexShade } from './characters.js';

// 高清半身头像：逻辑 100x100，按 PT 倍生成贴图
const PT = 4;
const SIDE = {
  player: { a: '#4a86e8', d: '#1c3a7c', l: '#b4d0f6', bg: ['#2c5aa8', '#0c1a38'] },
  enemy: { a: '#d4402f', d: '#661409', l: '#e8c4a8', bg: ['#a8382a', '#2a0806'] },
  ally: { a: '#38a957', d: '#165226', l: '#b0e8c0', bg: ['#2e8a48', '#082210'] },
  none: { a: '#8a7a5a', d: '#4a3a24', l: '#d8c8a0', bg: ['#6a5a40', '#1a120a'] },
};

function lookFor(name) {
  const ch = getCharacter(name);
  if (ch) return ch;
  if (name.includes('术士')) return { hat: 'taoist', robe: true, robeColor: '#d6ae36', beard: 'mustache', brow: 0.3 };
  if (name.includes('黄巾')) return { hat: 'turban', beard: 'stubble', brow: 0.35, cloth: true };
  if (name.includes('弓')) return { hat: 'cap', brow: 0.2 };
  return { hat: 'helmet', beard: 'mustache', brow: 0.3 };
}

export function portraitTexture(scene, name, side) {
  const key = `pt-${name}-${side}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 100 * PT, 100 * PT);
  const ctx = tex.getContext();
  ctx.scale(PT, PT);
  ctx.lineJoin = 'round';
  const k = kit(ctx);
  const S = SIDE[side] || SIDE.none;
  const L = lookFor(name);
  // 背景：阵营色径向渐变 + 水墨远山
  const bg = ctx.createRadialGradient(50, 40, 5, 50, 50, 75);
  bg.addColorStop(0, S.bg[0]); bg.addColorStop(1, S.bg[1]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 100, 100);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.moveTo(0, 70);
  for (let x = 0; x <= 100; x += 10) ctx.lineTo(x, 62 + Math.sin(x * 0.09) * 8);
  ctx.lineTo(100, 100); ctx.lineTo(0, 100); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.10)';
  ctx.beginPath(); ctx.arc(78, 22, 13, 0, Math.PI * 2); ctx.fill();
  const saved = { skin: C.skin, skinD: C.skinD, hair: C.hair };
  const skin = skinOf(L);
  if (skin) [C.skin, C.skinD] = skin;
  if (L.hairColor) C.hair = L.hairColor;
  try {
    drawBust(k, L, S);
    drawFace(k, L);
    drawHat(k, L, S);
  } finally {
    Object.assign(C, saved);
  }
  tex.refresh();
  return key;
}

function drawBust({ ctx, grad, fill, ell, poly, line }, L, S) {
  const P = L.armor ? armorPalette(L.armor) : L.cloth ? { a: '#9a7444', d: '#4e3418', l: '#d8bc8a' } : S;
  if (L.cape) fill(grad(0, 70, 0, 100, C.red, C.redD), poly([8, 100], [18, 74], [82, 74], [92, 100]));
  if (L.robe) {
    const rc = L.robeColor || P.l;
    fill(grad(0, 72, 0, 100, shade(rc, 1.1), shade(rc, 0.65)), () => {
      ctx.moveTo(12, 100); ctx.quadraticCurveTo(16, 76, 38, 72); ctx.lineTo(62, 72); ctx.quadraticCurveTo(84, 76, 88, 100); ctx.closePath();
    });
    fill(C.white, poly([40, 72], [50, 92], [60, 72], [56, 72], [50, 84], [44, 72]), C.ink, 0.6);
    fill(shade(rc, 0.55), poly([44, 72], [50, 84], [56, 72], [53, 72], [50, 78], [47, 72]), null);
    line(22, 86, 28, 100, 0.6, shade(rc, 0.5), false);
    line(78, 86, 72, 100, 0.6, shade(rc, 0.5), false);
    return;
  }
  fill(grad(0, 70, 0, 100, shade(P.a, 1.25), P.a, P.d), () => {
    ctx.moveTo(10, 100); ctx.quadraticCurveTo(14, 78, 36, 73); ctx.lineTo(64, 73); ctx.quadraticCurveTo(86, 78, 90, 100); ctx.closePath();
  });
  ctx.strokeStyle = shade(P.d, 0.6); ctx.lineWidth = 0.6;
  for (let ry = 80; ry < 100; ry += 4) for (let x = 20 + (ry % 8); x < 82; x += 5) { ctx.beginPath(); ctx.arc(x, ry, 2.4, 0, Math.PI); ctx.stroke(); }
  fill(grad(40, 80, 60, 98, shade(P.l, 1.1), shade(P.a, 0.9)), ell(50, 90, 11, 9), C.ink, 0.6);
  fill(grad(46, 86, 54, 94, C.white, C.gold, C.goldD), ell(50, 90, 4.5, 4.5), C.ink, 0.6);
  for (const sx of [17, 83]) {
    fill(grad(sx - 12, 72, sx + 12, 92, shade(P.a, 1.35), P.d), ell(sx, 82, 15, 10, sx < 50 ? -0.35 : 0.35), C.gold, 1.4);
    ctx.strokeStyle = shade(P.d, 0.7); ctx.lineWidth = 0.6;
    for (const r of [5, 9]) { ctx.beginPath(); ctx.ellipse(sx, 82, r * 1.4, r * 0.9, sx < 50 ? -0.35 : 0.35, 0, Math.PI * 2); ctx.stroke(); }
  }
  fill(grad(0, 68, 0, 78, C.red, C.redD), poly([36, 70], [64, 70], [62, 78], [50, 82], [38, 78]));
}

function drawFace({ ctx, grad, fill, ell, poly, line }, L) {
  const w = L.wide ? 19 : 17;
  fill(grad(43, 0, 57, 0, C.skinD, C.skin, C.skinD), poly([43, 58], [57, 58], [58, 74], [42, 74]));
  fill(C.skin, ell(50 - w, 47, 3.2, 5.6), C.ink, 0.6);
  fill(C.skin, ell(50 + w, 47, 3.2, 5.6), C.ink, 0.6);
  const fg = ctx.createRadialGradient(46, 44, 4, 50, 50, 28);
  fg.addColorStop(0, skinOf(L) ? C.skin : '#fde6c8'); fg.addColorStop(0.7, C.skin); fg.addColorStop(1, C.skinD);
  const chin = L.young ? 71 : 73;
  fill(fg, () => {
    ctx.moveTo(50 - w, 36); ctx.quadraticCurveTo(50 - w, 60, 42, chin - 5); ctx.quadraticCurveTo(50, chin + 1, 58, chin - 5);
    ctx.quadraticCurveTo(50 + w, 60, 50 + w, 36); ctx.quadraticCurveTo(50, 18, 50 - w, 36);
  }, C.ink, 0.8);
  // 发际线与鬓角
  fill(C.hair, () => {
    ctx.moveTo(50 - w - 1, 46); ctx.quadraticCurveTo(50 - w - 2, 22, 50, 21); ctx.quadraticCurveTo(50 + w + 2, 22, 50 + w + 1, 46);
    ctx.lineTo(50 + w - 2, 47); ctx.quadraticCurveTo(50 + w - 3, 36, 50, 33); ctx.quadraticCurveTo(50 - w + 3, 36, 50 - w + 2, 47); ctx.closePath();
  }, null);
  const b = L.brow * 7;
  for (const s of [-1, 1]) {
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(50 + s * 14, 40 - b * 0.3); ctx.quadraticCurveTo(50 + s * 9, 38.5, 50 + s * 3.5, 40 + b * 0.6);
    ctx.strokeStyle = C.hair; ctx.lineWidth = 2.4; ctx.stroke();
    const ex = 50 + s * 8.5;
    const eye = () => { ctx.moveTo(ex - 5, 47); ctx.quadraticCurveTo(ex, 43.2, ex + 5, 47); ctx.quadraticCurveTo(ex, 49.6, ex - 5, 47); ctx.closePath(); };
    fill('#fffaf0', eye, null);
    ctx.save(); ctx.beginPath(); eye(); ctx.clip();
    fill('#4a2c16', ell(ex - s * 0.4, 46.6, 2.5, 2.6), null);
    fill(C.ink, ell(ex - s * 0.4, 46.6, 1.2, 1.3), null);
    fill(C.white, ell(ex - s * 0.4 + 0.8, 45.7, 0.7, 0.7), null);
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(ex - 5.4, 47.2); ctx.quadraticCurveTo(ex, 42.8, ex + 5.4, 47.2);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3; ctx.stroke();
    line(ex - 3.5, 49.3, ex + 3.5, 49.3, 0.4, C.skinD, false);
  }
  line(50.5, 49, 48.8, 56, 0.7, C.skinD, false);
  ctx.beginPath(); ctx.moveTo(46.5, 56.5); ctx.quadraticCurveTo(50, 58.5, 53.5, 56.5); ctx.strokeStyle = '#b0704c'; ctx.lineWidth = 0.8; ctx.stroke();
  fill('rgba(235,120,100,0.25)', ell(39, 55, 4, 2), null);
  fill('rgba(235,120,100,0.25)', ell(61, 55, 4, 2), null);
  const mouth = () => {
    ctx.beginPath(); ctx.moveTo(45.5, 62); ctx.quadraticCurveTo(50, 62.8 + (L.brow > 0.3 ? -1 : 0.6), 54.5, 62);
    ctx.strokeStyle = '#7a3020'; ctx.lineWidth = 1; ctx.stroke();
    fill('rgba(180,80,60,0.35)', ell(50, 64, 3, 1), null);
  };
  mouth();
  const hair = C.hair;
  const mustache = () => {
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(50 + s * 0.8, 59.4); ctx.quadraticCurveTo(50 + s * 5, 58.6, 50 + s * 8, 63); ctx.strokeStyle = hair; ctx.lineWidth = 1.6; ctx.stroke(); }
  };
  switch (L.beard) {
    case 'mustache': mustache(); break;
    case 'goatee': mustache(); fill(C.hair, poly([47, 66], [53, 66], [50.5, 76]), null); break;
    case 'short':
      mustache();
      fill('rgba(30,20,14,0.85)', () => {
        ctx.moveTo(50 - w + 1, 50); ctx.quadraticCurveTo(50 - w + 2, 66, 42, chin - 3); ctx.quadraticCurveTo(50, chin + 3, 58, chin - 3);
        ctx.quadraticCurveTo(50 + w - 2, 66, 50 + w - 1, 50); ctx.quadraticCurveTo(50 + w - 4, 62, 50, 66); ctx.quadraticCurveTo(50 - w + 4, 62, 50 - w + 1, 50);
      }, null);
      break;
    case 'full':
      fill(C.hair, () => {
        ctx.moveTo(50 - w, 46); ctx.quadraticCurveTo(50 - w - 3, 74, 50, 86); ctx.quadraticCurveTo(50 + w + 3, 74, 50 + w, 46);
        ctx.quadraticCurveTo(50 + w - 3, 60, 55, 60); ctx.quadraticCurveTo(50, 58, 45, 60); ctx.quadraticCurveTo(50 - w + 3, 60, 50 - w, 46);
      }, null);
      ctx.strokeStyle = '#3e2c20'; ctx.lineWidth = 0.5;
      for (let x = 38; x <= 62; x += 3) { ctx.beginPath(); ctx.moveTo(x, 66); ctx.quadraticCurveTo(x + (x - 50) * 0.1, 76, 50 + (x - 50) * 0.5, 84); ctx.stroke(); }
      fill(C.skinD, ell(50, 62.4, 4.5, 1.6), null);
      mouth();
      break;
    case 'long':
      mustache();
      fill(grad(0, 64, 0, 96, shade(L.hairColor || '#3a2c20', 1.15), hexShade(L.hairColor || '#3a2c20', 0.55)), () => { ctx.moveTo(45, 65); ctx.quadraticCurveTo(50, 64, 55, 65); ctx.quadraticCurveTo(56, 82, 50, 96); ctx.quadraticCurveTo(44, 82, 45, 65); }, null);
      break;
    case 'stubble':
      ctx.fillStyle = 'rgba(40,28,20,0.35)';
      for (let i = 0; i < 40; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 40)); ctx.fillRect(50 + Math.cos(a) * (w - 4) * (i % 2 ? 1 : -1), 58 + Math.sin(a) * 12, 0.6, 0.6); }
      mustache();
      break;
    default:
  }
}

function drawHat({ ctx, grad, fill, ell, poly, line }, L, S) {
  const P = L.armor ? armorPalette(L.armor) : L.cloth ? { a: '#9a7444', d: '#4e3418' } : S;
  const helmet = (main, dark) => {
    fill(grad(28, 0, 36, 0, shade(dark, 1.3), dark), poly([30, 36], [27, 60], [35, 62], [36, 37]));
    fill(grad(64, 0, 72, 0, dark, shade(dark, 1.3)), poly([70, 36], [73, 60], [65, 62], [64, 37]));
    fill(grad(36, 10, 64, 38, shade(main, 1.45), main, dark), ell(50, 37, 22, 21, 0, Math.PI, 0), C.ink, 1);
    ctx.strokeStyle = shade(dark, 0.7); ctx.lineWidth = 0.7;
    for (const x of [40, 50, 60]) { ctx.beginPath(); ctx.moveTo(x, 17 + Math.abs(x - 50) * 0.3); ctx.lineTo(x + (x - 50) * 0.25, 36); ctx.stroke(); }
    fill(grad(0, 33, 0, 41, '#fff0b0', C.gold, C.goldD), poly([27, 34], [73, 34], [72, 41], [28, 41]), C.ink, 0.8);
    for (let x = 31; x < 72; x += 6) fill(C.goldD, ell(x, 37.5, 0.9, 0.9), null);
    fill(grad(46, 22, 54, 34, '#fff0b0', C.gold, C.goldD), poly([50, 20], [55, 34], [45, 34]), C.ink, 0.6);
    fill(C.red, ell(50, 29, 1.6, 1.6), null);
    line(50, 16, 50, 9, 1.6, C.metal);
  };
  switch (L.hat) {
    case 'helmet':
      if (L.hatColor) helmet(L.hatColor, hexShade(L.hatColor, 0.45)); else helmet(P.a, P.d);
      fill(grad(0, 0, 0, 14, '#ff6a50', C.redD), () => { ctx.moveTo(50, 10); ctx.quadraticCurveTo(62, 0, 70, 8); ctx.quadraticCurveTo(60, 6, 50, 12); }, C.ink, 0.6);
      break;
    case 'crown':
      helmet(C.gold, C.goldD);
      fill(C.red, ell(50, 8, 3.6, 3.6));
      for (const s of [-1, 1]) fill(grad(0, 8, 0, 30, '#fff0b0', C.gold), poly([50 + s * 20, 30], [50 + s * 30, 10], [50 + s * 24, 31]), C.ink, 0.7);
      break;
    case 'feather':
      for (const s of [-1, 1]) {
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(50 + s * 9, 20); ctx.quadraticCurveTo(50 + s * 16, -10, 50 + s * 46, 16);
        ctx.strokeStyle = C.ink; ctx.lineWidth = 4.2; ctx.stroke();
        ctx.strokeStyle = '#b8241a'; ctx.lineWidth = 3; ctx.stroke();
        ctx.setLineDash([2, 2.5]); ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
      }
      helmet('#9a4ac8', '#3a1250');
      fill(C.red, ell(50, 8, 4, 4));
      break;
    case 'cap':
      fill(grad(0, 16, 0, 38, shade(P.a, 1.35), P.d), ell(50, 38, 21, 17, 0, Math.PI, 0), C.ink, 0.9);
      fill(P.d, poly([29, 34], [71, 34], [71, 39], [29, 39]), C.ink, 0.6);
      line(70, 36, 80, 50, 2.6, P.d);
      break;
    case 'scholar':
      fill(grad(0, 8, 0, 38, '#3e3832', '#121010'), poly([34, 37], [66, 37], [62, 10], [38, 10]), C.ink, 0.8);
      fill('#121010', poly([31, 32], [69, 32], [69, 38], [31, 38]), C.ink, 0.6);
      line(38, 18, 62, 18, 0.6, '#5a524a', false);
      line(32, 37, 27, 62, 1.2, '#2a2420', false);
      line(68, 37, 73, 62, 1.2, '#2a2420', false);
      break;
    case 'turban':
      fill(grad(0, 14, 0, 40, '#fff08a', C.yellow, C.yellowD), ell(50, 39, 23, 20, 0, Math.PI, 0), C.ink, 0.9);
      for (const ty of [24, 30, 35]) line(29, ty + 4, 71, ty, 0.8, C.yellowD, false);
      line(70, 34, 82, 50, 3.4, C.yellow); line(70, 36, 76, 56, 3, C.yellow);
      break;
    case 'taoist':
      fill(C.hair, ell(50, 20, 8, 6));
      fill(grad(0, 6, 0, 22, '#fff08a', C.yellow, C.yellowD), poly([43, 22], [57, 22], [55, 8], [45, 8]), C.ink, 0.7);
      line(36, 15, 64, 15, 1.4, C.gold);
      break;
    case 'band': {
      const hc = L.hatColor || '#b8302a';
      fill(grad(0, 24, 0, 34, shade(hc, 1.2), hexShade(hc, 0.6)), poly([30, 28], [70, 26], [71, 33], [29, 35]), C.ink, 0.8);
      line(70, 29, 82, 40, 3, hc); line(70, 31, 78, 46, 2.6, hc);
      break;
    }
    case 'headscarf': {
      const hc = L.hatColor || '#2f8a4a';
      fill(grad(36, 10, 64, 38, shade(hc, 1.35), hc, hexShade(hc, 0.5)), ell(50, 38, 22.5, 21, 0, Math.PI, 0), C.ink, 1);
      ctx.strokeStyle = hexShade(hc, 0.55); ctx.lineWidth = 0.8;
      for (const ty of [24, 30]) { ctx.beginPath(); ctx.moveTo(30, ty + 6); ctx.quadraticCurveTo(50, ty - 4, 70, ty + 6); ctx.stroke(); }
      fill(hexShade(hc, 0.65), poly([27, 34], [73, 34], [73, 39], [27, 39]), C.ink, 0.7);
      fill(hc, () => { ctx.moveTo(70, 34); ctx.quadraticCurveTo(86, 40, 84, 62); ctx.lineTo(78, 60); ctx.quadraticCurveTo(80, 44, 68, 38); ctx.closePath(); }, C.ink, 0.6);
      break;
    }
    case 'emperor':
      fill(grad(0, 12, 0, 36, '#3a3430', '#0e0c0a'), poly([36, 36], [64, 36], [62, 16], [38, 16]), C.ink, 0.8);
      fill(grad(0, 8, 0, 16, '#3a3430', '#141210'), poly([22, 16], [78, 16], [78, 10], [22, 10]), C.ink, 0.8);
      fill(C.gold, poly([24, 16], [76, 16], [76, 17.5], [24, 17.5]), null);
      for (let bx = 24; bx <= 76; bx += 4) {
        if (bx > 34 && bx < 66) continue;
        line(bx, 17, bx, 34, 0.5, '#e8d8a0', false);
        for (const by of [22, 27, 32]) fill(by % 2 ? '#e84a3a' : '#f0d060', ell(bx, by, 1.1, 1.1), null);
      }
      break;
    default:
  }
}
