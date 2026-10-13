// 战场镜头：地图大于 18×13 视口时滚动查看
// 实现：两台相机。主相机（cameras.main）只渲染地图层，视口限定在地图区并随镜头滚动；界面相机覆盖整屏、不滚动，渲染 HUD / 对话 / 弹窗。
// 每帧渲染前按 isMapSpace 把显示对象分给两台相机（cameraFilter），所以地图层对象仍按世界坐标（tileCenter）摆放，
// 界面对象仍按屏幕坐标摆放；新增显示对象只要遵守下面的层级约定即可，无需手动登记。
// 坐标：世界坐标 = 旧版的地图坐标（MAP_X + x*TILE, MAP_Y + y*TILE），屏幕坐标 = 1200×672 的界面坐标；
//   镜头位置 (this.x, this.y) 为视口左上角对应的世界坐标，初始为 (MAP_X, MAP_Y)，与旧版 18×13 地图完全一致。
import { TILE, MAP_X, MAP_Y, VIEW_W, VIEW_H, VIEW_COLS, VIEW_ROWS, RES, WIDTH, HEIGHT } from './config.js';

const DRAG = 6; // 拖动阈值（像素），以内视为点击
const DRAG_TOUCH = 18; // 触屏点击容差：手机横屏画面约缩小到 0.58 倍，6 像素只有 3 个多 CSS 像素，手指轻微抖动就会判成拖动
const EDGE = 24; // 边缘滚动区宽度
const EDGE_DELAY = 250; // 鼠标在边缘停留多久后开始滚动（毫秒），避免移向右侧面板时误滚
const EDGE_SPEED = 520; // 边缘滚动速度（世界像素 / 秒）
const KEY_SPEED = 640; // 键盘滚动速度

// 地图层：depth < 50（地图、目标格、高亮、光标、单位、天气）或 700~799（攻击 / 策略特效），或显式标记 mapSpace = true（飘字）；
// 其余（HUD 50+、菜单 600、横幅 800、遮罩 / 单挑 900+、对话 1000、弹窗 3000）为界面层；mapSpace = false 可强制归入界面
export const isMapSpace = (go) => go.mapSpace ?? (go.depth < 50 || (go.depth >= 700 && go.depth < 800));

// 当前视口对应的世界矩形（没有镜头的场景返回固定地图区）
export const viewRect = (s) => (s.cam ? s.cam.rect() : { x: MAP_X, y: MAP_Y, w: VIEW_W, h: VIEW_H });

export class MapCamera {
  // canScroll()：场景回调，是否允许玩家手动滚动（弹窗、对话、指令菜单时禁止）
  constructor(scene, map, { canScroll = () => true } = {}) {
    this.scene = scene;
    this.cols = map[0].length;
    this.rows = map.length;
    this.canScroll = canScroll;
    this.scrollable = this.cols > VIEW_COLS || this.rows > VIEW_ROWS;
    // 主相机：地图层
    this.cam = scene.cameras.main;
    this.cam.setViewport(MAP_X * RES, MAP_Y * RES, VIEW_W * RES, VIEW_H * RES).setZoom(RES);
    // 界面相机：整屏、不滚动（与 hiDpi 的主相机设置相同）
    this.ui = scene.cameras.add(0, 0, WIDTH * RES, HEIGHT * RES).setZoom(RES).centerOn(WIDTH / 2, HEIGHT / 2);
    this.x = MAP_X;
    this.y = MAP_Y;
    this.drag = null;
    this.edgeSince = 0;
    this.moved = false; // 本帧镜头是否移动（供悬停刷新）
    this.apply();
    this.keys = scene.input.keyboard?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    const sort = () => this.sort();
    const tick = (t, dt) => this.update(t, dt);
    scene.events.on('prerender', sort);
    scene.events.on('update', tick);
    scene.events.once('shutdown', () => {
      scene.events.off('prerender', sort);
      scene.events.off('update', tick);
      this.panTween?.stop();
    });
  }

  // 每帧渲染前把显示对象分给两台相机
  sort() {
    const mapId = this.cam.id, uiId = this.ui.id;
    for (const go of this.scene.children.list) go.cameraFilter = isMapSpace(go) ? uiId : mapId;
  }

  // ---------- 坐标 ----------
  rect() {
    return { x: this.x, y: this.y, w: VIEW_W, h: VIEW_H };
  }

  // 指针 → 屏幕坐标（界面坐标）
  screenOf(p) {
    return { x: p.x / RES, y: p.y / RES };
  }

  inView(sx, sy) {
    return sx >= MAP_X && sx < MAP_X + VIEW_W && sy >= MAP_Y && sy < MAP_Y + VIEW_H;
  }

  toWorld(sx, sy) {
    return { x: this.x + sx - MAP_X, y: this.y + sy - MAP_Y };
  }

  toScreen(wx, wy) {
    return { x: wx - this.x + MAP_X, y: wy - this.y + MAP_Y };
  }

  // 格子左上角的屏幕坐标
  tileToScreen(tx, ty) {
    return this.toScreen(MAP_X + tx * TILE, MAP_Y + ty * TILE);
  }

  // 指针所在格子（不在地图视口内或超出地图时返回 null）
  tileAt(p) {
    const s = this.screenOf(p);
    if (!this.inView(s.x, s.y)) return null;
    const w = this.toWorld(s.x, s.y);
    const x = Math.floor((w.x - MAP_X) / TILE), y = Math.floor((w.y - MAP_Y) / TILE);
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows ? { x, y } : null;
  }

  // 格子是否在视口内（margin 为留边格数）
  tileVisible(tx, ty, margin = 0) {
    const l = (this.x - MAP_X) / TILE, t = (this.y - MAP_Y) / TILE;
    return tx >= l + margin - 1e-6 && ty >= t + margin - 1e-6 && tx + 1 <= l + VIEW_COLS - margin + 1e-6 && ty + 1 <= t + VIEW_ROWS - margin + 1e-6;
  }

  // ---------- 移动 ----------
  clamp(x, y) {
    const maxX = MAP_X + Math.max(0, this.cols * TILE - VIEW_W), maxY = MAP_Y + Math.max(0, this.rows * TILE - VIEW_H);
    return { x: Math.min(Math.max(x, MAP_X), maxX), y: Math.min(Math.max(y, MAP_Y), maxY) };
  }

  apply() {
    this.cam.centerOn(this.x + VIEW_W / 2, this.y + VIEW_H / 2);
  }

  // 立即移动到视口左上角 (x, y)（世界坐标）
  set(x, y) {
    const c = this.clamp(x, y);
    if (c.x === this.x && c.y === this.y) return;
    this.x = c.x;
    this.y = c.y;
    this.moved = true;
    this.apply();
  }

  scrollBy(dx, dy) {
    this.panTween?.stop();
    this.set(this.x + dx, this.y + dy);
  }

  // 平滑移动到视口左上角 (x, y)；返回 Promise。ms 缺省时按距离取 180~450 毫秒；被新的移动打断时也会 resolve
  panTo(x, y, ms) {
    const c = this.clamp(x, y);
    this.panTween?.stop();
    const d = Math.hypot(c.x - this.x, c.y - this.y);
    if (d < 1) return Promise.resolve();
    const duration = ms ?? Math.min(450, Math.max(180, d * 0.6));
    if (duration <= 0) { this.set(c.x, c.y); return Promise.resolve(); }
    return new Promise((resolve) => {
      this.panTween = this.scene.tweens.add({
        targets: this, x: c.x, y: c.y, duration, ease: 'Cubic.easeOut',
        onUpdate: () => { this.moved = true; this.apply(); },
        onComplete: () => { this.panTween = null; resolve(); },
        onStop: () => resolve(),
      });
    });
  }

  // 把格子 (tx, ty) 移到视口中央
  centerTile(tx, ty, ms) {
    return this.panTo(MAP_X + tx * TILE + TILE / 2 - VIEW_W / 2, MAP_Y + ty * TILE + TILE / 2 - VIEW_H / 2, ms);
  }

  // 镜头跟随：tiles（{x, y} 数组）都已在视口内（留 margin 格）时不动；否则把它们的包围框移到中央，
  // 包围框比视口大时以第一个格子为准
  follow(tiles, ms, margin = 1) {
    const list = tiles.filter((t) => t && Number.isFinite(t.x) && Number.isFinite(t.y));
    if (!this.scrollable || !list.length || list.every((t) => this.tileVisible(t.x, t.y, margin))) return Promise.resolve();
    const xs = list.map((t) => t.x), ys = list.map((t) => t.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x1 - x0 + 1 > VIEW_COLS - 2 * margin || y1 - y0 + 1 > VIEW_ROWS - 2 * margin) return this.centerTile(list[0].x, list[0].y, ms);
    return this.centerTile((x0 + x1) / 2, (y0 + y1) / 2, ms);
  }

  // ---------- 输入：拖动 / 点击 ----------
  // 场景级 pointerdown（按钮会阻止冒泡，不会到这里）：在地图视口内按下时记录，抬起时由 release 判断是点击还是拖动
  press(p) {
    const s = this.screenOf(p);
    this.drag = this.inView(s.x, s.y) ? { sx: s.x, sy: s.y, x: this.x, y: this.y, moved: false, allow: this.scrollable && this.canScroll() } : null;
  }

  move(p) {
    const d = this.drag;
    if (!d || !p.isDown) return;
    const s = this.screenOf(p);
    if (!d.moved && Math.hypot(s.x - d.sx, s.y - d.sy) <= (p.wasTouch ? DRAG_TOUCH : DRAG)) return;
    d.moved = true;
    if (!d.allow) return;
    this.panTween?.stop();
    this.set(d.x - (s.x - d.sx), d.y - (s.y - d.sy));
  }

  // 返回 true 表示这是一次点击（按下与抬起之间没有拖动）
  release(p) {
    const d = this.drag;
    this.drag = null;
    if (!d) return false;
    const s = this.screenOf(p);
    return !d.moved && Math.hypot(s.x - d.sx, s.y - d.sy) <= (p.wasTouch ? DRAG_TOUCH : DRAG);
  }

  // ---------- 每帧：键盘与边缘滚动 ----------
  update(t, dt) {
    if (!this.scrollable) return;
    const step = Math.min(dt, 50) / 1000;
    if (!this.canScroll()) { this.edgeSince = 0; return; }
    const k = this.keys;
    let vx = 0, vy = 0;
    if (k) {
      vx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      vy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    }
    if (vx || vy) { this.scrollBy(vx * KEY_SPEED * step, vy * KEY_SPEED * step); return; }
    // 边缘滚动：鼠标在画布内、未拖动、位于地图视口边缘（排除小地图等界面元素）；触屏不做（抬起后指针停在原处且 isOver 恒为真，会一直滚）
    const p = this.scene.input.activePointer;
    const s = this.screenOf(p);
    let ex = 0, ey = 0;
    if (this.scene.input.isOver && !p.wasTouch && !this.drag && this.inView(s.x, s.y) && !this.scene.minimap?.hit(s.x, s.y)) {
      ex = s.x < MAP_X + EDGE ? -1 : s.x >= MAP_X + VIEW_W - EDGE ? 1 : 0;
      ey = s.y < MAP_Y + EDGE ? -1 : s.y >= MAP_Y + VIEW_H - EDGE ? 1 : 0;
    }
    if (!ex && !ey) { this.edgeSince = 0; return; }
    if (!this.edgeSince) this.edgeSince = t;
    if (t - this.edgeSince >= EDGE_DELAY) this.scrollBy(ex * EDGE_SPEED * step, ey * EDGE_SPEED * step);
  }
}
