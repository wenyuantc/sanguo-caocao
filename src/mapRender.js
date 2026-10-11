import { TILE, MAP_X, MAP_Y, RES } from './config.js';
import { TERRAIN } from './data.js';

const rnd = (x, y, i = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

function shade(color, f) {
  const r = Math.min(255, ((color >> 16) & 255) * f), g = Math.min(255, ((color >> 8) & 255) * f), b = Math.min(255, (color & 255) * f);
  return (r << 16) | (g << 8) | b;
}

// 地图是静态的：按 CHUNK × CHUNK 格分块，每块用 Graphics 画完后按 RES 倍烘焙成一张贴图并销毁 Graphics，
// 避免每帧重新处理数千条绘制指令；分块使 40×40 地图的单张贴图也不超过显卡尺寸上限
const BAKE_KEY = 'map-bake', BAKE_M = 4; // 每块上方留边：栅栏 / 营寨尖略高出格子
const CHUNK = 20;
export function drawMap(scene, map) {
  const rows = map.length, cols = map[0].length;
  for (const k of scene.textures.getTextureKeys()) if (k.startsWith(BAKE_KEY)) scene.textures.remove(k);
  const images = [];
  for (let cy = 0; cy < rows; cy += CHUNK) {
    for (let cx = 0; cx < cols; cx += CHUNK) {
      const w = Math.min(CHUNK, cols - cx), h = Math.min(CHUNK, rows - cy);
      const g = scene.add.graphics().setDepth(0);
      for (let y = cy; y < cy + h; y++) {
        for (let x = cx; x < cx + w; x++) {
          const ch = map[y][x];
          const t = TERRAIN[ch];
          const px = MAP_X + x * TILE, py = MAP_Y + y * TILE;
          g.fillStyle(shade(t.color, 0.93 + rnd(x, y) * 0.14), 1).fillRect(px, py, TILE, TILE);
          drawDetail(g, ch, px, py, x, y);
        }
      }
      // 网格
      const left = MAP_X + cx * TILE, top = MAP_Y + cy * TILE;
      g.lineStyle(1, 0x000000, 0.12);
      for (let x = 0; x <= w; x++) g.lineBetween(left + x * TILE, top, left + x * TILE, top + h * TILE);
      for (let y = 0; y <= h; y++) g.lineBetween(left, top + y * TILE, left + w * TILE, top + y * TILE);
      images.push(bake(scene, g, `${BAKE_KEY}-${cx}-${cy}`, left, top, w, h));
    }
  }
  return images;
}

function bake(scene, g, key, left, top, w, h) {
  const y0 = top - BAKE_M;
  const dt = scene.textures.addDynamicTexture(key, w * TILE * RES, (h * TILE + BAKE_M) * RES);
  g.setScale(RES);
  dt.draw(g, -left * RES, -y0 * RES).render();
  g.destroy();
  return scene.add.image(left, y0, key).setOrigin(0).setScale(1 / RES).setDepth(0);
}

function drawDetail(g, ch, px, py, x, y) {
  const T = TILE;
  switch (ch) {
    case '.':
      g.fillStyle(0x6f8f45, 0.5);
      for (let i = 0; i < 3; i++) g.fillRect(px + rnd(x, y, i) * 40 + 4, py + rnd(x, y, i + 9) * 40 + 4, 3, 2);
      break;
    case ',':
      g.lineStyle(2, 0x5b8a3a, 0.9);
      for (let i = 0; i < 5; i++) {
        const gx = px + 6 + rnd(x, y, i) * 34, gy = py + 10 + rnd(x, y, i + 5) * 30;
        g.lineBetween(gx, gy, gx - 3, gy - 7);
        g.lineBetween(gx, gy, gx + 3, gy - 7);
      }
      break;
    case 'F':
      for (let i = 0; i < 3; i++) {
        const tx = px + 10 + i * 13 + rnd(x, y, i) * 4, ty = py + 8 + (i % 2) * 14 + rnd(x, y, i + 3) * 6;
        g.fillStyle(0x5a3a1e, 1).fillRect(tx - 2, ty + 18, 4, 7);
        g.fillStyle(0x24502a, 1).fillTriangle(tx - 11, ty + 20, tx + 11, ty + 20, tx, ty - 4);
        g.fillStyle(0x2f6b33, 1).fillTriangle(tx - 8, ty + 12, tx + 8, ty + 12, tx, ty - 8);
      }
      break;
    case 'M':
      g.fillStyle(0x6b5536, 1).fillTriangle(px + 2, py + T - 4, px + T - 2, py + T - 4, px + T * 0.45, py + 6);
      g.fillStyle(0x917a55, 1).fillTriangle(px + T * 0.45, py + 6, px + T - 2, py + T - 4, px + T * 0.62, py + T - 4);
      g.fillStyle(0xefe7d8, 1).fillTriangle(px + T * 0.36, py + 16, px + T * 0.56, py + 16, px + T * 0.45, py + 6);
      break;
    case 'V':
      for (const [ox, oy] of [[6, 18], [26, 10], [22, 28]]) {
        g.fillStyle(0xd9c7a0, 1).fillRect(px + ox, py + oy + 6, 16, 11);
        g.fillStyle(0x8a3a24, 1).fillTriangle(px + ox - 3, py + oy + 7, px + ox + 19, py + oy + 7, px + ox + 8, py + oy - 2);
        g.fillStyle(0x3a2a18, 1).fillRect(px + ox + 6, py + oy + 11, 4, 6);
      }
      break;
    case 'W':
      g.lineStyle(2, 0x9fd0f0, 0.7);
      for (let i = 0; i < 3; i++) {
        const wy = py + 10 + i * 13 + rnd(x, y, i) * 4, wx = px + 4 + rnd(x, y, i + 2) * 14;
        g.beginPath(); g.moveTo(wx, wy);
        g.lineTo(wx + 6, wy - 3); g.lineTo(wx + 12, wy); g.lineTo(wx + 18, wy - 3); g.strokePath();
      }
      break;
    case 'B':
      g.fillStyle(0x3f7fb5, 1).fillRect(px, py, T, T);
      g.fillStyle(0x8a6238, 1).fillRect(px, py + 6, T, T - 12);
      g.lineStyle(2, 0x5a3a1e, 1);
      for (let i = 0; i < 6; i++) g.lineBetween(px + i * 8 + 4, py + 6, px + i * 8 + 4, py + T - 6);
      g.fillStyle(0x4a2e14, 1).fillRect(px, py + 4, T, 3).fillRect(px, py + T - 7, T, 3);
      break;
    case 'C':
      g.fillStyle(0x55524e, 1).fillRect(px, py, T, T);
      g.lineStyle(1, 0x34322f, 1);
      for (let r = 0; r < 4; r++) {
        g.lineBetween(px, py + r * 12, px + T, py + r * 12);
        for (let c = 0; c < 4; c++) g.lineBetween(px + c * 12 + (r % 2) * 6, py + r * 12, px + c * 12 + (r % 2) * 6, py + r * 12 + 12);
      }
      g.fillStyle(0x7d7a74, 1);
      for (let i = 0; i < 4; i++) g.fillRect(px + i * 12 + 1, py, 8, 6);
      break;
    case 'G':
      g.fillStyle(0x8f8370, 1).fillRect(px + 2, py + 2, T - 4, T - 4);
      g.lineStyle(1, 0x6d6355, 1);
      for (let i = 1; i < 4; i++) g.lineBetween(px + 2, py + i * 12, px + T - 2, py + i * 12);
      g.fillStyle(0xb5322a, 1).fillRect(px + T / 2 - 1, py + 6, 2, 22);
      g.fillTriangle(px + T / 2 + 1, py + 6, px + T / 2 + 15, py + 11, px + T / 2 + 1, py + 16);
      break;
    case 'S':
      // 战船甲板：水面上的木船
      g.fillStyle(0x3f7fb5, 1).fillRect(px, py, T, T);
      g.fillStyle(0x5a3a1e, 1).fillRect(px + 2, py + 4, T - 4, T - 8);
      g.fillStyle(0x9a6a3a, 1).fillRect(px + 4, py + 6, T - 8, T - 12);
      g.lineStyle(1, 0x6a4422, 1);
      for (let i = 1; i < 5; i++) g.lineBetween(px + 4, py + 6 + i * 7, px + T - 4, py + 6 + i * 7);
      g.fillStyle(0x3a2412, 1);
      for (let i = 0; i < 5; i++) g.fillRect(px + 4 + i * 10, py + 3, 3, 4);
      if ((x + y) % 2 === 0) {
        g.fillStyle(0x4a2e14, 1).fillRect(px + T / 2 - 1, py + 8, 3, 28);
        g.fillStyle(0xe8dcc0, 1).fillTriangle(px + T / 2 + 2, py + 10, px + T / 2 + 16, py + 22, px + T / 2 + 2, py + 30);
      }
      break;
    case 'T':
      // 营寨：栅栏 + 军帐
      g.fillStyle(0x6a4a2a, 1);
      for (let i = 0; i < 7; i++) {
        g.fillRect(px + 2 + i * 7, py + 2, 3, 9);
        g.fillTriangle(px + 2 + i * 7, py + 2, px + 5 + i * 7, py + 2, px + 3.5 + i * 7, py - 1);
      }
      g.fillStyle(0xd8c8a0, 1).fillTriangle(px + 8, py + 40, px + 40, py + 40, px + 24, py + 16);
      g.fillStyle(0xb8a478, 1).fillTriangle(px + 24, py + 16, px + 40, py + 40, px + 30, py + 40);
      g.fillStyle(0x4a3018, 1).fillTriangle(px + 21, py + 40, px + 27, py + 40, px + 24, py + 30);
      g.fillStyle(0xb5322a, 1).fillRect(px + 23, py + 8, 2, 9).fillTriangle(px + 25, py + 8, px + 33, py + 11, px + 25, py + 14);
      break;
    case 'D':
      // 荒地：龟裂与碎石
      g.lineStyle(1.5, 0x8a7048, 0.8);
      for (let i = 0; i < 2; i++) {
        const cx = px + 8 + rnd(x, y, i) * 28, cy = py + 10 + rnd(x, y, i + 4) * 26;
        g.lineBetween(cx, cy, cx + 7, cy + 3); g.lineBetween(cx + 7, cy + 3, cx + 10, cy + 9); g.lineBetween(cx + 7, cy + 3, cx + 14, cy + 1);
      }
      g.fillStyle(0x9a8462, 1);
      for (let i = 0; i < 4; i++) g.fillEllipse(px + 5 + rnd(x, y, i + 7) * 38, py + 5 + rnd(x, y, i + 11) * 38, 4, 3);
      break;
    case 'X':
      // 岩山：灰色岩峰
      g.fillStyle(0x4e4840, 1).fillTriangle(px + 1, py + T - 3, px + T * 0.55, py + 4, px + T - 1, py + T - 3);
      g.fillStyle(0x7c746a, 1).fillTriangle(px + 1, py + T - 3, px + T * 0.55, py + 4, px + T * 0.45, py + T - 3);
      g.fillStyle(0x5c554c, 1).fillTriangle(px + 4, py + T - 3, px + T * 0.25, py + 18, px + T * 0.48, py + T - 3);
      g.lineStyle(1, 0x9a9288, 0.9).lineBetween(px + T * 0.55, py + 4, px + T * 0.4, py + 24);
      break;
    case '^':
      // 山崖：竖向岩层与阴影
      g.fillStyle(0x5e4a36, 1).fillRect(px, py + T - 12, T, 12);
      g.lineStyle(2, 0x5a4632, 0.9);
      for (let i = 0; i < 5; i++) {
        const lx = px + 4 + i * 9 + rnd(x, y, i) * 3;
        g.lineBetween(lx, py + 4 + rnd(x, y, i + 5) * 8, lx + 2, py + T - 12);
      }
      g.fillStyle(0x9a8062, 1);
      for (let i = 0; i < 4; i++) g.fillTriangle(px + i * 12, py + 6, px + i * 12 + 12, py + 6, px + i * 12 + 6, py);
      break;
    case '*':
      // 雪原：雪堆与浅蓝阴影
      g.fillStyle(0xc8d6e2, 0.9);
      for (let i = 0; i < 3; i++) g.fillEllipse(px + 8 + rnd(x, y, i) * 32, py + 12 + rnd(x, y, i + 3) * 28, 14, 5);
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 3; i++) g.fillEllipse(px + 8 + rnd(x, y, i) * 32, py + 10 + rnd(x, y, i + 3) * 28, 12, 4);
      break;
    case '~':
      // 浅滩：沙洲与涟漪
      g.fillStyle(0xcdb98a, 0.9).fillEllipse(px + 14 + rnd(x, y) * 18, py + 30 + rnd(x, y, 1) * 8, 22, 9);
      g.lineStyle(1.5, 0xe0f2fa, 0.8);
      for (let i = 0; i < 2; i++) {
        const wy = py + 10 + i * 12 + rnd(x, y, i + 2) * 4, wx = px + 6 + rnd(x, y, i + 4) * 16;
        g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + 6, wy - 2); g.lineTo(wx + 12, wy); g.strokePath();
      }
      break;
    case '%':
      // 沼泽：水洼与芦苇
      g.fillStyle(0x3f5a52, 0.9);
      for (let i = 0; i < 2; i++) g.fillEllipse(px + 10 + rnd(x, y, i) * 26, py + 14 + rnd(x, y, i + 2) * 22, 18, 7);
      g.lineStyle(1.5, 0x8a9a4a, 1);
      for (let i = 0; i < 4; i++) {
        const rx = px + 6 + rnd(x, y, i + 5) * 36, ry = py + 18 + rnd(x, y, i + 9) * 24;
        g.lineBetween(rx, ry, rx - 1, ry - 9); g.lineBetween(rx + 3, ry, rx + 4, ry - 7);
      }
      break;
    case 'O':
      // 池塘：草地中的圆形水面
      g.fillStyle(0x7fa653, 1).fillRect(px, py, T, T);
      g.fillStyle(0x3a7aa8, 1).fillEllipse(px + T / 2, py + T / 2, T - 8, T - 12);
      g.fillStyle(0x5a9ac8, 1).fillEllipse(px + T / 2 - 3, py + T / 2 - 2, T - 18, T - 22);
      g.lineStyle(1, 0xbfe2f6, 0.8).lineBetween(px + 16, py + 22, px + 26, py + 22);
      break;
    case 'R':
      // 大河：深水与成排波纹
      g.lineStyle(2, 0x7fb8e0, 0.75);
      for (let i = 0; i < 4; i++) {
        const wy = py + 8 + i * 11 + rnd(x, y, i) * 3, wx = px + 2 + rnd(x, y, i + 2) * 10;
        g.beginPath(); g.moveTo(wx, wy);
        g.lineTo(wx + 8, wy - 3); g.lineTo(wx + 16, wy); g.lineTo(wx + 24, wy - 3); g.lineTo(wx + 32, wy); g.strokePath();
      }
      break;
    case '#':
      // 栅栏：横档 + 尖头木桩
      g.fillStyle(0x9db86a, 1).fillRect(px, py, T, T);
      g.fillStyle(0x5a3a1e, 1).fillRect(px, py + 18, T, 4).fillRect(px, py + 32, T, 4);
      g.fillStyle(0x7a5430, 1);
      for (let i = 0; i < 5; i++) {
        const sx = px + 2 + i * 10;
        g.fillRect(sx, py + 10, 5, 32);
        g.fillTriangle(sx, py + 10, sx + 5, py + 10, sx + 2.5, py + 4);
      }
      break;
    case '+':
      // 城内：石板路
      g.lineStyle(1, 0x8f8572, 0.9);
      for (let r = 1; r < 4; r++) g.lineBetween(px, py + r * 12, px + T, py + r * 12);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const lx = px + c * 16 + (r % 2) * 8;
        g.lineBetween(lx, py + r * 12, lx, py + r * 12 + 12);
      }
      break;
    case 'E':
      // 城门：城墙 + 拱形木门
      g.fillStyle(0x55524e, 1).fillRect(px, py, T, T);
      g.fillStyle(0x7d7a74, 1);
      for (let i = 0; i < 4; i++) g.fillRect(px + i * 12 + 1, py, 8, 6);
      g.fillStyle(0x3a2412, 1).fillRect(px + 10, py + 20, 28, 28).fillCircle(px + 24, py + 20, 14);
      g.fillStyle(0x7a4a22, 1).fillRect(px + 12, py + 22, 24, 26).fillCircle(px + 24, py + 22, 12);
      g.lineStyle(1, 0x4a2a12, 1).lineBetween(px + 24, py + 10, px + 24, py + 48);
      g.fillStyle(0xd9b25f, 1).fillCircle(px + 20, py + 34, 1.5).fillCircle(px + 28, py + 34, 1.5);
      break;
    case 'P':
      // 关隘：石砌关楼与屋檐
      g.fillStyle(0x6d6a66, 1).fillRect(px + 2, py + 18, T - 4, T - 18);
      g.fillStyle(0x2a2420, 1).fillRect(px + 16, py + 30, 16, 18).fillCircle(px + 24, py + 30, 8);
      g.fillStyle(0x8a2a1e, 1).fillTriangle(px - 1, py + 20, px + T + 1, py + 20, px + T / 2, py + 4);
      g.fillStyle(0x5a1a12, 1).fillRect(px, py + 18, T, 3);
      g.lineStyle(1, 0x4a4844, 1);
      for (let r = 0; r < 2; r++) g.lineBetween(px + 2, py + 26 + r * 10, px + 14, py + 26 + r * 10);
      break;
    case 'Z':
      // 鹿砦：交叉的尖木
      g.lineStyle(4, 0x6a4422, 1);
      for (const ox of [4, 26]) {
        g.lineBetween(px + ox, py + 38, px + ox + 18, py + 12);
        g.lineBetween(px + ox + 18, py + 38, px + ox, py + 12);
      }
      g.lineStyle(2, 0x8a6036, 1).lineBetween(px + 2, py + 26, px + T - 2, py + 26);
      g.fillStyle(0xd8c8a0, 1);
      for (const ox of [4, 22, 26, 44]) g.fillCircle(px + ox, py + 12, 1.5);
      break;
    case 'H':
      // 民居：白墙黑瓦的大屋
      g.fillStyle(0xe8dcc0, 1).fillRect(px + 7, py + 22, 34, 20);
      g.fillStyle(0x3e3a38, 1).fillTriangle(px + 2, py + 24, px + T - 2, py + 24, px + T / 2, py + 8);
      g.fillStyle(0x2a2624, 1).fillRect(px + 2, py + 22, T - 4, 3);
      g.fillStyle(0x5a3a1e, 1).fillRect(px + 20, py + 30, 8, 12);
      g.fillStyle(0x8aa0b0, 1).fillRect(px + 10, py + 28, 6, 5).fillRect(px + 32, py + 28, 6, 5);
      break;
    case '$':
      // 宝物库：仓房 + 金色门钉
      g.fillStyle(0x7a5a36, 1).fillRect(px + 5, py + 18, 38, 26);
      g.fillStyle(0x5a3a1e, 1).fillTriangle(px + 1, py + 20, px + T - 1, py + 20, px + T / 2, py + 5);
      g.fillStyle(0x3a2412, 1).fillRect(px + 16, py + 26, 16, 18);
      g.fillStyle(0xe8c050, 1);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) g.fillCircle(px + 20 + c * 8, py + 30 + r * 5, 1.4);
      g.lineStyle(1.5, 0xe8c050, 1).strokeRect(px + 16, py + 26, 16, 18);
      break;
    case 'Q':
      // 水池：石砌方池
      g.fillStyle(0x8f8370, 1).fillRect(px, py, T, T);
      g.fillStyle(0x3f7fb5, 1).fillRect(px + 5, py + 5, T - 10, T - 10);
      g.lineStyle(2, 0x6d6355, 1).strokeRect(px + 4, py + 4, T - 8, T - 8);
      g.lineStyle(1.5, 0xa8d4f0, 0.8).lineBetween(px + 12, py + 18, px + 22, py + 18).lineBetween(px + 24, py + 30, px + 36, py + 30);
      break;
    case '!':
      // 火：烈焰
      for (let i = 0; i < 3; i++) {
        const fx = px + 10 + i * 14 + rnd(x, y, i) * 4, fy = py + T - 6;
        g.fillStyle(0xb8321a, 1).fillTriangle(fx - 9, fy, fx + 9, fy, fx, fy - 30 - rnd(x, y, i + 3) * 8);
        g.fillStyle(0xf09a2a, 1).fillTriangle(fx - 6, fy, fx + 6, fy, fx, fy - 20);
        g.fillStyle(0xffe07a, 1).fillTriangle(fx - 3, fy, fx + 3, fy, fx, fy - 10);
      }
      break;
    case 'A':
      // 祭坛：三层石台与火盆
      g.fillStyle(0x6e646e, 1).fillRect(px + 3, py + 34, T - 6, 10);
      g.fillStyle(0x857a86, 1).fillRect(px + 9, py + 26, T - 18, 9);
      g.fillStyle(0xa498a6, 1).fillRect(px + 15, py + 19, T - 30, 8);
      g.fillStyle(0x3a3236, 1).fillRect(px + 20, py + 13, 8, 6);
      g.fillStyle(0xf09a2a, 1).fillTriangle(px + 20, py + 13, px + 28, py + 13, px + 24, py + 3);
      break;
    case 'U':
      // 地下：洞窟碎岩
      g.fillStyle(0x2e2620, 1);
      for (let i = 0; i < 5; i++) g.fillEllipse(px + 4 + rnd(x, y, i) * 40, py + 4 + rnd(x, y, i + 5) * 40, 8, 5);
      g.fillStyle(0x6a5a4a, 1);
      for (let i = 0; i < 3; i++) g.fillRect(px + 6 + rnd(x, y, i + 9) * 36, py + 6 + rnd(x, y, i + 12) * 36, 3, 2);
      break;
    default:
  }
}
