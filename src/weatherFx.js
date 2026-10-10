// 天气画面：雨 / 豪雨为斜线粒子，雪为飘落的白点，阴天整体变暗；顶部栏天气图标
// 粒子是一张 Graphics 每帧重画（不用贴图），同屏最多 MAX_PARTICLES 个；遮罩与粒子位于单位之上、HUD 之下
import { TILE, COLS, ROWS, MAP_X, MAP_Y, FONT } from './config.js';
import { text } from './ui.js';
import { WEATHERS, SUN, CLOUD, RAIN, STORM, SNOW } from './weather.js';

const DEPTH = 30;
export const MAX_PARTICLES = 200;
// 各天气的粒子数与遮罩（数值自行设计）
const LOOK = {
  [SUN]: { n: 0, veil: 0x000000, alpha: 0 },
  [CLOUD]: { n: 0, veil: 0x1a2232, alpha: 0.22 },
  [RAIN]: { n: 90, veil: 0x1a2232, alpha: 0.16, kind: 'rain' },
  [STORM]: { n: 180, veil: 0x101828, alpha: 0.3, kind: 'rain' },
  [SNOW]: { n: 110, veil: 0xdce6f4, alpha: 0.12, kind: 'snow' },
};
export const WEATHER_CSS = ['#ffd36a', '#c8ccd4', '#8ac8ff', '#6a9cff', '#f0f6ff'];

const rand = (a, b) => a + Math.random() * (b - a);
const tween = (s, cfg) => new Promise((r) => s.tweens.add({ ...cfg, onComplete: r }));

export class WeatherFx {
  constructor(scene) {
    this.scene = scene;
    this.rect = { x: MAP_X, y: MAP_Y, w: COLS * TILE, h: ROWS * TILE };
    this.veil = scene.add.rectangle(MAP_X, MAP_Y, this.rect.w, this.rect.h, 0x000000, 0).setOrigin(0).setDepth(DEPTH);
    this.g = scene.add.graphics().setDepth(DEPTH + 1);
    this.drops = [];
    this.kind = null;
    this.weather = SUN;
    this.tick = (t, dt) => this.update(dt);
    scene.events.on('update', this.tick);
    scene.events.once('shutdown', () => scene.events.off('update', this.tick));
  }

  // 立即切换（开局 / 读档）
  set(w) {
    const L = LOOK[w];
    this.weather = w;
    this.veil.setFillStyle(L.veil, L.alpha);
    this.spawn(L);
  }

  spawn(L) {
    this.kind = L.kind || null;
    this.drops = Array.from({ length: Math.min(L.n, MAX_PARTICLES) }, () => this.drop(true));
  }

  // 新粒子：anywhere 时散布在整个地图内，否则从地图上方落下
  drop(anywhere) {
    const r = this.rect, snow = this.kind === 'snow';
    return {
      x: r.x + rand(0, r.w + (snow ? 0 : r.h * 0.25)),
      y: anywhere ? r.y + rand(0, r.h) : r.y - rand(0, 40),
      v: snow ? rand(28, 60) : rand(520, 780),
      len: rand(10, 18),
      sway: rand(0, Math.PI * 2),
      size: rand(1.2, 2.6),
    };
  }

  update(dt) {
    const g = this.g.clear();
    if (!this.kind) return;
    const t = Math.min(dt, 100) / 1000, r = this.rect, bottom = r.y + r.h;
    if (this.kind === 'rain') {
      g.lineStyle(this.weather === STORM ? 1.4 : 1.2, 0xd0e2f4, this.weather === STORM ? 0.7 : 0.6);
      for (const d of this.drops) {
        d.y += d.v * t;
        d.x -= d.v * 0.25 * t;
        if (d.y > bottom || d.x < r.x - 20) Object.assign(d, this.drop(false));
        g.lineBetween(d.x, d.y, d.x + d.len * 0.25, d.y - d.len);
      }
      // 豪雨偶尔打闪（自行设计）
      if (this.weather === STORM && Math.random() < t / 7) this.scene.cameras.main.flash(70, 200, 210, 230);
      return;
    }
    g.fillStyle(0xffffff, 0.85);
    for (const d of this.drops) {
      d.sway += t * 1.6;
      d.y += d.v * t;
      d.x += Math.sin(d.sway) * 14 * t;
      if (d.y > bottom) Object.assign(d, this.drop(false));
      g.fillCircle(d.x, d.y, d.size);
    }
  }

  // 天气切换动画：粒子与遮罩淡出，换成新天气后淡入，地图中央显示新天气
  async transition(w) {
    const s = this.scene, L = LOOK[w];
    const label = text(s, this.rect.x + this.rect.w / 2, this.rect.y + 120, `天气转为「${WEATHERS[w]}」`, 30, WEATHER_CSS[w], FONT)
      .setOrigin(0.5).setStroke('#1a1008', 6).setDepth(801).setAlpha(0);
    s.tweens.add({ targets: label, alpha: 1, y: label.y - 10, duration: 300 });
    await Promise.all([
      tween(s, { targets: this.g, alpha: 0, duration: 300 }),
      tween(s, { targets: this.veil, fillAlpha: 0, duration: 300 }),
    ]);
    this.weather = w;
    this.veil.setFillStyle(L.veil, 0);
    this.spawn(L);
    await Promise.all([
      tween(s, { targets: this.g, alpha: 1, duration: 450 }),
      tween(s, { targets: this.veil, fillAlpha: L.alpha, duration: 450 }),
    ]);
    await tween(s, { targets: label, alpha: 0, y: label.y - 10, delay: 350, duration: 300 });
    label.destroy();
  }
}

// 顶部栏天气图标：以 (x, y) 为中心、约 24 像素见方
export function drawWeatherIcon(g, x, y, w) {
  g.clear();
  const cloud = (cx, cy, col) => {
    g.fillStyle(col, 1);
    g.fillCircle(cx - 5, cy + 1, 4.5).fillCircle(cx + 1, cy - 2.5, 5.5).fillCircle(cx + 6, cy + 1, 4).fillRect(cx - 5, cy + 1, 11, 4.5);
  };
  if (w === SUN) {
    g.lineStyle(2, 0xffb030, 1);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      g.lineBetween(x + Math.cos(a) * 8, y + Math.sin(a) * 8, x + Math.cos(a) * 11, y + Math.sin(a) * 11);
    }
    g.fillStyle(0xffd36a, 1).fillCircle(x, y, 6);
    return;
  }
  if (w === CLOUD) { cloud(x, y, 0xc8ccd4); return; }
  cloud(x, y - 4, w === STORM ? 0x7a8090 : w === SNOW ? 0xe0e6f0 : 0xa8b0bc);
  if (w === SNOW) {
    g.fillStyle(0xffffff, 1);
    for (const [dx, dy] of [[-5, 6], [0, 9], [5, 6], [-2, 12], [3, 12]]) g.fillCircle(x + dx, y + dy, 1.4);
    return;
  }
  g.lineStyle(1.6, w === STORM ? 0x6a9cff : 0x8ac8ff, 1);
  const n = w === STORM ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const dx = -6 + (12 / (n - 1)) * i;
    g.lineBetween(x + dx + 1.5, y + 4, x + dx - 1.5, y + 11);
  }
}
