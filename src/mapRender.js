import { TILE, COLS, ROWS, MAP_X, MAP_Y } from './config.js';
import { TERRAIN } from './data.js';

const rnd = (x, y, i = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

function shade(color, f) {
  const r = Math.min(255, ((color >> 16) & 255) * f), g = Math.min(255, ((color >> 8) & 255) * f), b = Math.min(255, (color & 255) * f);
  return (r << 16) | (g << 8) | b;
}

export function drawMap(scene, map) {
  const g = scene.add.graphics().setDepth(0);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = map[y][x];
      const t = TERRAIN[ch];
      const px = MAP_X + x * TILE, py = MAP_Y + y * TILE;
      g.fillStyle(shade(t.color, 0.93 + rnd(x, y) * 0.14), 1).fillRect(px, py, TILE, TILE);
      drawDetail(g, ch, px, py, x, y);
    }
  }
  // 网格
  g.lineStyle(1, 0x000000, 0.12);
  for (let x = 0; x <= COLS; x++) g.lineBetween(MAP_X + x * TILE, MAP_Y, MAP_X + x * TILE, MAP_Y + ROWS * TILE);
  for (let y = 0; y <= ROWS; y++) g.lineBetween(MAP_X, MAP_Y + y * TILE, MAP_X + COLS * TILE, MAP_Y + y * TILE);
  return g;
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
    default:
  }
}
