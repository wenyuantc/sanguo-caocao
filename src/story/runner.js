// 场景脚本解释器：按顺序执行指令（指令格式见 defs.js / docs），每条指令是一个 async 方法。
// 对白与选项复用 DialogBox（StoryDialog 在一段对白结束后不立即关闭，人物走位时对白框保持显示，避免闪烁）。
import { WIDTH, HEIGHT, FONT, COLORS } from '../config.js';
import { DialogBox, panel, text, portrait, wait } from '../ui.js';
import { typeOf, mapProjector, mapPoint, BACKGROUNDS, DIRS, CITIES, MAJOR_CITIES } from './defs.js';
import { backgroundTexture, purgeBackgrounds } from './backgrounds.js';
import { StoryActor, actorClass } from './actors.js';
import { GENERALS } from '../generals.js';

// 执行前先等待并行移动结束的指令（对白、换背景等）
const JOIN_FIRST = new Set(['bg', 'chapter', 'say', 'narr', 'fade', 'camera', 'map', 'arrow', 'clear', 'join']);
// 执行时关闭对白框的指令（其余指令执行时对白框保持上一句）
const HIDE_DIALOG = new Set(['bg', 'chapter', 'fade', 'camera', 'map', 'arrow', 'clear']);
const SIDE_COLOR = { player: COLORS.player, enemy: COLORS.enemy, ally: COLORS.ally };
const GENERAL_NAMES = new Set(Object.values(GENERALS).map((g) => g.name));

export class StoryDialog extends DialogBox {
  constructor(scene) {
    super(scene);
    this.root.setDepth(1000);
  }

  next() {
    if (!this.resolve) return;
    const idle = !this.choiceBox && !this.typing && !(this.current?.choices && !this.current.chosen);
    if (idle && !this.lines.length) {
      // 本段对白结束：保持显示，由解释器决定何时关闭
      const r = this.resolve;
      this.resolve = null;
      r();
      return;
    }
    const before = this.current;
    super.next();
    if (this.current && this.current !== before) this.onLine?.(this.current);
  }

  hide() {
    this.root.setVisible(false);
  }
}

export class StoryRunner {
  constructor(scene) {
    this.s = scene;
    this.actors = new Map();
    this.markers = new Map();
    this.extras = []; // 地图文字、箭头等随背景清除的对象
    this.pending = [];
    this.bgImg = null;
    this.kind = null;
    this.proj = mapProjector('all');
    // 黑幕：场景层最上方，开场为全黑，第一张背景出现时淡入
    this.black = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 1).setOrigin(0).setDepth(990);
    this.labels = new Set(); // 中国地图上已标出的城市名（主要城市已画在背景上）
    this.mapTexts = []; // 地图文字占用的区域（布局避让用）
    scene.dialog.onLine = (line) => { const a = this.speaker(line); if (a) this.bounce(a); };
  }

  // 对白行的说话人：line.actor（出场时的 id）→ 以 who 为 id 出场的人物 → 第一个名字为 who 的人物
  speaker(line) {
    const key = line.actor ?? line.who;
    if (this.actors.has(key)) return this.actors.get(key);
    for (const a of this.actors.values()) if (a.info.name === line.who) return a;
    return null;
  }

  async run(script) {
    for (const c of script || []) {
      if (this.s.stopped) return;
      const t = typeOf(c);
      if (!t) { console.warn('未知剧情指令', c); continue; }
      if (!this.s.flagOk(c)) continue;
      if (JOIN_FIRST.has(t)) await this.join();
      if (HIDE_DIALOG.has(t)) this.s.dialog.hide();
      try {
        await this[t](c);
      } catch (e) {
        console.error('剧情指令出错', c, e);
      }
    }
    await this.join();
    this.s.dialog.hide();
  }

  async join() {
    const list = this.pending;
    this.pending = [];
    await Promise.all(list);
  }

  actor(c) {
    const key = c.id || c.actor;
    this.actors.get(key)?.destroy();
    const side = c.side || (GENERAL_NAMES.has(c.actor) ? 'player' : 'enemy');
    const a = new StoryActor(this.s, { name: c.actor, side, cls: c.cls && actorClass(c.actor, c.cls), at: c.at, face: c.face, pose: c.pose });
    this.actors.set(key, a);
    if (c.fade !== false) {
      a.c.setAlpha(0);
      this.pending.push(a.fade(1, 260));
    }
  }

  get(key) {
    const a = this.actors.get(key);
    if (!a) console.warn('剧情人物未出场', key);
    return a;
  }

  async move(c) {
    const a = this.get(c.move);
    if (!a) return;
    const p = a.moveTo(c.to, c.speed, !!c.line).then(() => c.face && a.setFace(c.face));
    if (c.wait === false) this.pending.push(p); else await p;
  }

  async exit(c) {
    const key = c.exit;
    const a = this.get(key);
    if (!a) return;
    this.actors.delete(key);
    const p = (async () => {
      if (c.to) await a.moveTo(c.to, c.speed, !!c.line);
      await a.fade(0, 240);
      a.destroy();
    })();
    if (c.wait === false) this.pending.push(p); else await p;
  }

  face(c) {
    this.get(c.face)?.setFace(DIRS[c.dir] || c.dir);
  }

  async act(c) {
    const a = this.get(c.act);
    if (!a) return;
    await a.setPose(c.pose);
    await wait(this.s, c.ms ?? 260);
  }

  async emote(c) {
    const a = this.get(c.emote);
    if (!a) return;
    await a.emote(c.icon, c.hold);
    await wait(this.s, c.ms ?? 380);
  }

  // 说话人轻轻一跳，提示是谁在说话
  bounce(a) {
    this.s.tweens.add({ targets: a.img, y: -5, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
  }

  say(c) {
    return this.s.dialog.show(c.say);
  }

  narr(c) {
    return this.s.dialog.show([{ who: '旁白', text: c.narr }]);
  }

  wait(c) {
    return wait(this.s, c.wait);
  }

  // 黑幕淡入淡出：color 只对这一轮转场生效——从透明开始变暗时未指定 color 就用黑色，完全淡出（alpha 0）后恢复黑色
  fadeTo(alpha, ms = 360, color) {
    if (color != null) this.black.setFillStyle(color, 1);
    else if (alpha > 0 && this.black.alpha === 0) this.black.setFillStyle(0x000000, 1);
    return new Promise((r) => this.s.tweens.add({
      targets: this.black, alpha, duration: ms,
      onComplete: () => { if (alpha === 0) this.black.setFillStyle(0x000000, 1); r(); },
    }));
  }

  fade(c) {
    return this.fadeTo(c.fade === 'out' ? 1 : 0, c.ms ?? 400, c.color);
  }

  async bg(c) {
    const first = !this.bgImg;
    if (!first && c.fade !== false) await this.fadeTo(1, 300);
    if (!c.keep) this.clear();
    this.clearExtras();
    this.kind = BACKGROUNDS[c.bg]?.kind || 'outer';
    this.proj = mapProjector(c.view);
    const key = backgroundTexture(this.s, c.bg, { time: c.time, view: c.view });
    this.bgImg?.destroy();
    purgeBackgrounds(this.s, key);
    this.bgImg = this.s.add.image(0, 0, key).setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setDepth(0);
    if (c.fade !== false || first) await this.fadeTo(0, first ? 500 : 360);
    if (c.place) this.place({ place: c.place });
  }

  // 地点名：左上角卷轴，显示约两秒后淡出（不阻塞后续指令）
  place(c) {
    this.placeBox?.destroy();
    const t = text(this.s, 0, 0, c.place, 22, '#f6e7c1', FONT);
    const w = t.width + 56, h = 46;
    const box = this.s.add.container(30, 24).setDepth(1200).setAlpha(0);
    t.setPosition(28, h / 2).setOrigin(0, 0.5);
    box.add([panel(this.s, 0, 0, w, h, 0.9), t]);
    this.placeBox = box;
    this.s.tweens.add({ targets: box, alpha: 1, x: 40, duration: 300 });
    this.s.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 500, onComplete: () => box.destroy() });
    return wait(this.s, 300);
  }

  // 章节名：黑底大字，淡入淡出
  async chapter(c) {
    const root = this.s.add.container(0, 0).setDepth(1500).setAlpha(0);
    const shade = this.s.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 1).setOrigin(0);
    const t = text(this.s, WIDTH / 2, HEIGHT / 2 - (c.sub ? 26 : 0), c.chapter, 46, '#ffd36a', FONT).setOrigin(0.5).setStroke('#3a1200', 8);
    root.add([shade, t]);
    if (c.sub) root.add(text(this.s, WIDTH / 2, HEIGHT / 2 + 40, c.sub, 28, '#f1e3c2', FONT).setOrigin(0.5));
    await new Promise((r) => this.s.tweens.add({ targets: root, alpha: 1, duration: 500, onComplete: r }));
    await wait(this.s, c.ms ?? 1300);
    await new Promise((r) => this.s.tweens.add({ targets: root, alpha: 0, duration: 500, onComplete: r }));
    root.destroy();
  }

  // 镜头：推近到某个站位 / 复位
  camera(c) {
    const cam = this.s.stageCam;
    const z = c.camera === 'reset' ? 1 : (c.zoom || 1.4);
    let x = WIDTH / 2, y = HEIGHT / 2;
    if (c.camera !== 'reset') {
      const p = this.s.iso(c.camera[0], c.camera[1]);
      const hw = WIDTH / 2 / z, hh = HEIGHT / 2 / z;
      x = Math.min(Math.max(p.x, hw), WIDTH - hw);
      y = Math.min(Math.max(p.y - 60, hh), HEIGHT - hh);
    }
    return new Promise((r) => this.s.tweens.add({
      targets: cam, z, x, y, duration: c.ms ?? 700, ease: 'Sine.easeInOut', onUpdate: () => this.s.applyCam(), onComplete: r,
    }));
  }

  shake(c) {
    const root = this.bgImg;
    if (!root) return wait(this.s, c.shake);
    this.s.cameras.main.shake(c.shake, 0.006);
    return wait(this.s, c.shake);
  }

  clear() {
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
    for (const m of this.markers.values()) m.destroy();
    this.markers.clear();
  }

  clearExtras() {
    for (const o of this.extras) o.destroy();
    this.extras = [];
    this.labels.clear();
    this.mapTexts = [];
  }

  // 中国地图：被头像或箭头引用过的城市标出地名（主要城市已画在背景上），之后一直保留到换背景
  cityLabel(at) {
    if (typeof at !== 'string' || this.kind !== 'map' || this.labels.has(at) || MAJOR_CITIES.includes(at) || !CITIES[at]) return;
    this.labels.add(at);
    const p = this.screenOf(at);
    const g = this.s.add.graphics().setDepth(410);
    g.fillStyle(0x5a2a1a, 1).fillRect(p.x - 4, p.y - 4, 8, 8);
    g.lineStyle(1.5, 0xf0e0b0, 1).strokeRect(p.x - 4, p.y - 4, 8, 8);
    const t = text(this.s, p.x, p.y - 9, at, Math.round(14 * Math.sqrt(this.proj.zoom || 1)), '#3a200e', FONT).setOrigin(0.5, 1).setDepth(410);
    this.extras.push(g, t);
  }

  // 头像框（68×68）中心放在圆点的 (ox, oy) 处（默认正上方，中间留出城市名）；不在正上方时画一条引线从圆点连到头像框边缘
  setHead(box, ox, oy) {
    box.headX = ox; box.headY = oy;
    box.head.forEach((o) => o.setPosition(ox, oy));
    box.lead.clear();
    if (Math.abs(ox) < 2 && Math.abs(oy - this.headUp()) < 2) return;
    const t = Math.min(34 / Math.max(Math.abs(ox), 1e-6), 34 / Math.max(Math.abs(oy), 1e-6), 1);
    const ex = ox * (1 - t), ey = oy * (1 - t);
    box.lead.lineStyle(5, 0x000000, 0.35).lineBetween(0, 0, ex, ey).lineStyle(3, box.color, 1).lineBetween(0, 0, ex, ey);
  }

  screenOf(at) {
    const m = mapPoint(at);
    return this.proj(m.x, m.y);
  }

  // 中国地图：势力头像（show / move / hide）与地图文字（text）
  async map(c) {
    const m = c.map;
    if (m.show != null) {
      this.markers.get(m.show)?.destroy();
      this.markers.delete(m.show);
      const p = this.screenOf(m.at);
      const side = m.side || (GENERAL_NAMES.has(m.show) ? 'player' : 'enemy');
      const col = SIDE_COLOR[side] ?? COLORS.player;
      this.cityLabel(m.at);
      // 头像与已有头像、城市名重叠时（相邻城市，如陈留与汜水关），圆点留在地点上，头像按周围空位错开并画引线
      const box = this.s.add.container(p.x, p.y).setDepth(500).setScale(0);
      const lead = this.s.add.graphics();
      const g = this.s.add.graphics();
      g.fillStyle(0x000000, 0.35).fillEllipse(0, 4, 26, 10);
      g.fillStyle(col, 1).fillCircle(0, 0, 6);
      g.lineStyle(2, 0xffffff, 1).strokeCircle(0, 0, 6);
      const pt = portrait(this.s, 0, 0, m.show, side, 64);
      const ring = this.s.add.graphics();
      ring.lineStyle(4, col, 1).strokeRect(-34, -34, 68, 68);
      box.add([lead, g, pt, ring]);
      Object.assign(box, { lead, head: [pt, ring], color: col });
      this.setHead(box, ...this.headOffset(p));
      this.markers.set(m.show, box);
      await new Promise((r) => this.s.tweens.add({ targets: box, scale: 1, duration: 260, ease: 'Back.easeOut', onComplete: r }));
    } else if (m.move != null) {
      const box = this.markers.get(m.move);
      if (!box) return;
      this.cityLabel(m.to);
      const p = this.screenOf(m.to);
      // 目标处同样避让其他头像：头像偏移随移动一起过渡
      const [tx, ty] = this.headOffset(p, box);
      const o = { x: box.x, y: box.y, ox: box.headX, oy: box.headY };
      await new Promise((r) => this.s.tweens.add({
        targets: o, x: p.x, y: p.y, ox: tx, oy: ty, duration: m.ms ?? 900, ease: 'Sine.easeInOut',
        onUpdate: () => { box.setPosition(o.x, o.y); this.setHead(box, o.ox, o.oy); }, onComplete: r,
      }));
    } else if (m.hide != null) {
      const box = this.markers.get(m.hide);
      this.markers.delete(m.hide);
      if (box) await new Promise((r) => this.s.tweens.add({ targets: box, alpha: 0, duration: 260, onComplete: () => { box.destroy(); r(); } }));
    } else if (m.text != null) {
      const p = this.screenOf(m.at);
      const t = text(this.s, p.x, p.y, m.text, 22, '#3a1a08', FONT).setOrigin(0.5).setStroke('#f6e7c1', 5).setDepth(450).setAlpha(0);
      // 避让：在原位与上下左右挑一个不压住头像、城市名的位置
      const w = t.width, h = t.height;
      const cands = [[0, 0], [0, -30], [0, 30], [0, -60], [0, 60], [-(w / 2 + 50), 0], [w / 2 + 50, 0], [0, -95], [0, 95]].map(([x, y]) => ({ x: p.x + x, y: p.y + y }));
      const c = this.pick(cands, w, h, this.obstacles(), p);
      t.setPosition(c.x, c.y);
      this.mapTexts.push({ x: c.x - w / 2, y: c.y - h / 2, w, h });
      this.extras.push(t);
      await new Promise((r) => this.s.tweens.add({ targets: t, alpha: 1, duration: 300, onComplete: r }));
    }
  }

  // ---------- 中国地图布局 ----------
  // 已占用的区域（屏幕矩形）：其他头像框与圆点、城市名（主要城市 + 已标出的城市）、地图文字
  obstacles(self) {
    const R = [];
    for (const o of this.markers.values()) {
      if (o === self) continue;
      R.push({ x: o.x + o.headX - 36, y: o.y + o.headY - 36, w: 72, h: 72, cost: 1000 });
      R.push({ x: o.x - 9, y: o.y - 9, w: 18, h: 18, cost: 400 });
    }
    const fs = 14 * Math.sqrt(this.proj.zoom || 1);
    for (const name of [...MAJOR_CITIES, ...this.labels]) {
      const p = this.screenOf(name), w = name.length * fs + 6;
      R.push({ x: p.x - w / 2, y: p.y - 11 - fs, w, h: fs + 4, cost: 40 });
      R.push({ x: p.x - 5, y: p.y - 5, w: 10, h: 10, cost: 60 });
    }
    for (const b of this.mapTexts) R.push({ ...b, cost: 300 });
    return R;
  }

  // 在候选位置中选代价最小的：与占用区域重叠的代价 + 出屏惩罚 + 离首选位置的距离
  pick(cands, w, h, R, pref) {
    let best = cands[0], bestCost = Infinity;
    for (const c of cands) {
      const x = c.x - w / 2, y = c.y - h / 2;
      let cost = Math.hypot(c.x - pref.x, c.y - pref.y) / 8;
      if (x < 18 || y < 18 || x + w > WIDTH - 18 || y + h > HEIGHT - 18) cost += 1e4;
      for (const r of R) if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) cost += r.cost;
      if (cost < bestCost) { bestCost = cost; best = c; }
    }
    return best;
  }

  // 头像框默认在圆点正上方：框底边与圆点之间留出城市名的高度
  headUp() {
    return -(46 + 14 * Math.sqrt(this.proj.zoom || 1));
  }

  // 头像框相对圆点的偏移：先试正上方，再试上下左右与四角（两圈），按周围空位选择，避开其他头像、城市名与地图文字
  headOffset(p, self) {
    const R = this.obstacles(self);
    R.push({ x: p.x - 9, y: p.y - 9, w: 18, h: 18, cost: 400 }); // 自己的圆点
    const up = this.headUp();
    const ring = [[0, up], [76, -52], [-76, -52], [80, 0], [-80, 0], [0, 62], [76, 52], [-76, 52]];
    const cands = [1, 1.95].flatMap((k) => ring.map(([x, y]) => ({ x: p.x + x * k, y: p.y + y * k })));
    const c = this.pick(cands, 68, 68, R, { x: p.x, y: p.y + up });
    return [c.x - p.x, c.y - p.y];
  }

  // 行军箭头：沿地点连线逐渐画出，末端箭头
  arrow(c) {
    c.arrow.forEach((p) => this.cityLabel(p));
    const pts = c.arrow.map((p) => this.screenOf(p));
    const color = c.color ?? SIDE_COLOR[c.side || 'player'];
    const g = this.s.add.graphics().setDepth(400);
    this.extras.push(g);
    const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
    const total = segs.reduce((s, v) => s + v, 0) || 1;
    const draw = (t) => {
      g.clear();
      let left = total * t;
      const path = [pts[0]];
      for (let i = 0; i < segs.length && left > 0; i++) {
        const f = Math.min(1, left / (segs[i] || 1));
        path.push({ x: pts[i].x + (pts[i + 1].x - pts[i].x) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f });
        left -= segs[i];
      }
      for (const [w, col, alpha] of [[11, 0x000000, 0.3], [7, color, 0.95]]) {
        g.lineStyle(w, col, alpha);
        g.beginPath();
        g.moveTo(path[0].x, path[0].y);
        for (const p of path.slice(1)) g.lineTo(p.x, p.y);
        g.strokePath();
      }
      const e = path[path.length - 1], s = path[path.length - 2] || pts[0];
      const ang = Math.atan2(e.y - s.y, e.x - s.x);
      if (path.length > 1) {
        const tri = (r) => [
          e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r,
          e.x + Math.cos(ang + 2.5) * r, e.y + Math.sin(ang + 2.5) * r,
          e.x + Math.cos(ang - 2.5) * r, e.y + Math.sin(ang - 2.5) * r,
        ];
        g.fillStyle(0x000000, 0.3).fillTriangle(...tri(19));
        g.fillStyle(color, 1).fillTriangle(...tri(15));
      }
    };
    const o = { t: 0 };
    return new Promise((r) => this.s.tweens.add({
      targets: o, t: 1, duration: c.ms ?? Math.min(1800, 500 + total * 2.2), ease: 'Sine.easeInOut', onUpdate: () => draw(o.t), onComplete: () => { draw(1); r(); },
    }));
  }

  destroy() {
    this.clear();
    this.clearExtras();
    this.bgImg?.destroy();
    this.bgImg = null;
  }
}
