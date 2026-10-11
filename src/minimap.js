// 小地图：悬浮在地图视口右上角，显示地形、各方单位与当前视口框；点击 / 拖动跳转镜头，可折叠（按钮或 M 键）
// 只在地图大于视口时创建。界面层（depth 60），每格 PX 像素
import * as Phaser from 'phaser';
import { TILE, MAP_X, MAP_Y, VIEW_W, VIEW_COLS, VIEW_ROWS, COLORS } from './config.js';
import { TERRAIN } from './data.js';
import { panel, button } from './ui.js';

const PX = 3;
const DEPTH = 60;
const KEY = 'mm-terrain';
const DOT = { player: 0x6aa8ff, enemy: 0xff5a4a, ally: 0x6ae07a };

export class Minimap {
  constructor(scene, map, cam) {
    this.scene = scene;
    this.cam = cam;
    this.cols = map[0].length;
    this.rows = map.length;
    const w = (this.w = this.cols * PX), h = (this.h = this.rows * PX);
    const right = MAP_X + VIEW_W - 8;
    this.bx = right - w - 6;
    this.by = MAP_Y + 36;
    this.root = scene.add.container(0, 0).setDepth(DEPTH);
    this.body = scene.add.container(0, 0);
    const bg = panel(scene, this.bx - 6, this.by - 6, w + 12, h + 12, 0.9);
    const img = scene.add.image(this.bx, this.by, this.bakeTerrain(map)).setOrigin(0).setScale(PX);
    this.g = scene.add.graphics();
    // 点击 / 拖动跳转
    const zone = scene.add.zone(this.bx, this.by, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); this.jump(p, 200); });
    zone.on('pointermove', (p) => { if (p.isDown) this.jump(p, 0); });
    this.body.add([bg, img, this.g, zone]);
    this.toggleBtn = button(scene, right - 86, MAP_Y + 6, 86, 24, '', () => this.toggle(), 13);
    this.root.add([this.body, this.toggleBtn]);
    this.open = true;
    this.sig = '';
    this.setOpen(true);
    const key = () => this.toggle();
    scene.input.keyboard?.on('keydown-M', key);
    scene.events.once('shutdown', () => scene.input.keyboard?.off('keydown-M', key));
  }

  // 地形：每格 1 像素的画布贴图，显示时按 PX 倍最近邻放大
  bakeTerrain(map) {
    const tm = this.scene.textures;
    if (tm.exists(KEY)) tm.remove(KEY);
    const tex = tm.createCanvas(KEY, this.cols, this.rows);
    this.paintTerrain(map, tex);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return KEY;
  }

  // 重画地形像素（地形变化时调用，贴图对象不变）
  paintTerrain(map, tex = this.scene.textures.get(KEY)) {
    const ctx = tex.getContext();
    const data = ctx.createImageData(this.cols, this.rows);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        const c = TERRAIN[map[y][x]]?.color ?? 0;
        const i = (y * this.cols + x) * 4;
        data.data[i] = (c >> 16) & 255;
        data.data[i + 1] = (c >> 8) & 255;
        data.data[i + 2] = c & 255;
        data.data[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    tex.refresh();
  }

  toggle() {
    if (this.scene.modal || this.scene.dialog?.root.visible) return;
    this.setOpen(!this.open);
  }

  setOpen(v) {
    this.open = v;
    this.body.setVisible(v);
    this.toggleBtn.label.setText(v ? '小地图 ▲' : '小地图 ▼');
    this.sig = '';
  }

  // 屏幕坐标是否落在小地图（含按钮）上
  hit(sx, sy) {
    const b = this.toggleBtn;
    if (sx >= b.x && sx < b.x + 86 && sy >= b.y && sy < b.y + 24) return true;
    return this.open && sx >= this.bx - 6 && sx < this.bx + this.w + 6 && sy >= this.by - 6 && sy < this.by + this.h + 6;
  }

  jump(p, ms) {
    const s = this.cam.screenOf(p);
    const tx = Math.floor((s.x - this.bx) / PX), ty = Math.floor((s.y - this.by) / PX);
    this.cam.centerTile(Math.min(Math.max(tx, 0), this.cols - 1), Math.min(Math.max(ty, 0), this.rows - 1), ms);
  }

  // 每帧调用：单位或视口变化时重画
  update(units) {
    if (!this.open) return;
    let sig = `${Math.round(this.cam.x)},${Math.round(this.cam.y)}`;
    for (const u of units) if (u.alive) sig += `|${u.x},${u.y},${u.faction[0]}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const g = this.g.clear();
    for (const u of units) {
      if (!u.alive) continue;
      const x = this.bx + u.x * PX, y = this.by + u.y * PX;
      g.fillStyle(DOT[u.faction] || 0xffffff, 1).fillRect(x, y, PX, PX);
      if (u.leader || u.id === 'caocao') g.lineStyle(1, COLORS.gold, 1).strokeRect(x - 0.5, y - 0.5, PX + 1, PX + 1);
    }
    const vx = this.bx + ((this.cam.x - MAP_X) / TILE) * PX, vy = this.by + ((this.cam.y - MAP_Y) / TILE) * PX;
    g.lineStyle(1, 0xffffff, 0.95).strokeRect(vx, vy, VIEW_COLS * PX, VIEW_ROWS * PX);
  }
}
