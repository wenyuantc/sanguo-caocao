import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, FONT, hiDpi } from '../config.js';
import { button, text, panel, DialogBox } from '../ui.js';
import { getStage } from '../stages.js';
import { STAGE_PLACE, isoToScreen } from '../story/defs.js';
import { backgroundTexture, purgeBackgrounds } from '../story/backgrounds.js';
import { StoryActor } from '../story/actors.js';
import { findPath, canStep, octile } from '../story/path.js';
import { campLayoutOf, layoutGrid, reservedCells, FOLK } from '../camp/layouts.js';
import { drawProp } from '../camp/props.js';
import { pickTalk, stageTalks } from '../camp/talks.js';
import { GENERALS, isGeneral } from '../generals.js';
import { planDeploy, initialDeploy } from '../deploy.js';
import { issueKit } from '../equipment.js';
import { openPrep } from '../prep.js';
import { openSaveMenu } from '../saveMenu.js';
import { applyLoad, writeAuto } from '../saves.js';
import { goStage } from '../story/flow.js';
import { playMusic } from '../audio/music.js';

// 营中（两关之间）：曹操在军营 / 城镇里自由走动，与部下、百姓对话，整备、购物、存档，从营门出征。
// data：{ stage: 下一关 id, talked?: 已对话（本关专属台词已播放）的人物名, deploy?: 已选好的出阵阵容, pos?: 曹操位置 }
// 两台相机：主相机渲染场景层（depth < 1000：背景、物件、人物、提示），放大并跟随曹操；ui 相机渲染界面（顶栏、按钮、对白、弹窗）。
// 布局见 camp/layouts.js，台词见 camp/talks.js；寻路见 story/path.js。
const ZOOM = 1.3; // 场景层放大倍数
const SPEED = 230; // 曹操行走速度（屏幕像素 / 秒）
const NPC_SPEED = 110;
const KEY_DIRS = { up: [-1, -1], down: [1, 1], left: [-1, 1], right: [1, -1] }; // 方向键 → 屏幕上的上下左右
const GENERAL_ID = Object.fromEntries(Object.entries(GENERALS).map(([id, g]) => [g.name, id]));
const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export class CampScene extends Phaser.Scene {
  constructor() { super('Camp'); }

  init(data) {
    this.stageId = data?.stage;
    this.talked = Array.isArray(data?.talked) ? [...data.talked] : [];
    this.deploy = Array.isArray(data?.deploy) ? [...data.deploy] : null;
    this.startPos = data?.pos;
    this.modal = false;
    this.leaving = false;
    this.counts = new Map();
    this.ents = [];
    this.objects = [];
    this.path = null;
    this.pending = null;
  }

  create() {
    hiDpi(this);
    const stage = (this.stage = getStage(this.stageId));
    if (!stage) { this.scene.start('Title'); return; }
    playMusic('camp');
    const L = (this.layout = campLayoutOf(stage));
    this.grid = layoutGrid(L);
    this.reserved = reservedCells(L);

    // 相机：主相机（场景层）放大跟随，ui 相机（界面层）固定
    this.ui = this.cameras.add(0, 0, WIDTH * RES, HEIGHT * RES).setZoom(RES).centerOn(WIDTH / 2, HEIGHT / 2);
    this.sortCams = () => {
      const m = this.cameras.main.id, u = this.ui.id;
      for (const go of this.children.list) go.cameraFilter = go.depth >= 1000 ? m : u;
    };
    this.events.on('prerender', this.sortCams);
    this.events.once('shutdown', () => this.cleanup());

    // 背景与物件
    const key = backgroundTexture(this, L.bg, { time: L.time });
    purgeBackgrounds(this, key);
    this.add.image(0, 0, key).setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setDepth(0);
    for (const p of L.props || []) drawProp(this, p.type === 'gate' ? { ...p, label: L.gate.label } : p);

    // 战役状态副本（整备界面直接读写 scene.inventory / gold / items，并立即写回 registry）
    this.inventory = (this.registry.get('inventory') || []).map((it) => ({ ...it }));
    this.gold = this.registry.get('gold') ?? 0;
    this.items = { ...(this.registry.get('items') || {}) };

    this.makeObjects();
    this.makePeople();
    this.makeHud();
    this.dialog = new DialogBox(this);
    this.dialog.onChoice = (c) => this.applyChoice(c);

    this.prompt = this.worldText(0, 0, '', 15, '#fff2cc').setOrigin(0.5, 1).setDepth(905).setBackgroundColor('#2a1a0ccc').setPadding(8, 4, 8, 4).setVisible(false);

    // 输入
    this.keys = this.input.keyboard?.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D');
    const act = () => this.onAction();
    this.input.keyboard?.on('keydown-SPACE', act);
    this.input.keyboard?.on('keydown-ENTER', act);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p) => this.onPointer(p));

    // 镜头：开场直接对准曹操
    const c = this.player.actor.c;
    this.camPos = this.camTarget(c.x, c.y);
    this.applyCam();
    this.cameras.main.fadeIn(400);
    this.ui.fadeIn(400);
  }

  // ---------- 搭建 ----------
  worldText(x, y, str, size, color) {
    // 场景层放大 ZOOM 倍：文字分辨率相应提高，避免发虚
    return text(this, x, y, str, size, color, FONT).setResolution(RES * ZOOM).setStroke('#000', 3);
  }

  // 物件功能点：整备（大帐 / 书案）、营门
  makeObjects() {
    const L = this.layout;
    const add = (kind, at, label, labelAt) => {
      const p = isoToScreen(at[0], at[1]);
      const lp = labelAt ? isoToScreen(labelAt[0], labelAt[1]) : p;
      const ly = lp.y - (labelAt?.[2] ?? 120);
      const o = { kind, a: at[0], b: at[1], label, hit: { x0: Math.min(p.x, lp.x) - 70, x1: Math.max(p.x, lp.x) + 70, y0: ly - 20, y1: p.y + 12 }, top: { x: lp.x, y: ly } };
      if (kind === 'prep') this.worldText(lp.x, ly, `${label}（整备）`, 16, '#ffe08a').setOrigin(0.5, 1).setDepth(890);
      this.objects.push(o);
    };
    add('gate', L.gate.at, L.gate.label, [L.gate.at[0], L.gate.at[1], 150]);
    if (!L.hq.npc) add('prep', L.hq.at, L.hq.label, L.hq.labelAt);
  }

  newEnt(o) {
    const actor = new StoryActor(this, { name: o.name, side: o.side || 'player', cls: o.cls, at: o.at, face: o.face || 'dr' });
    const e = { actor, a: o.at[0], b: o.at[1], to: null, moving: false, facing: [1, 1], path: null, nextAt: 0, ...o };
    delete e.at;
    this.ents.push(e);
    return e;
  }

  // 人物：曹操、已加入的我军武将、本关台词中的客人（非我军武将）、商人 / 军需官、城镇百姓
  makePeople() {
    const L = this.layout;
    const reg = this.registry;
    const flags = reg.get('flags') || {};
    // 曹操
    let pos = L.spawn;
    if (Array.isArray(this.startPos) && this.grid.pass(this.startPos[0], this.startPos[1])) pos = this.startPos;
    this.player = this.newEnt({ kind: 'player', name: '曹操', at: [pos[0], pos[1]], face: L.face });
    this.faceEnt(this.player, ...dirVec(L.face));

    // 功能人物
    this.newEnt({ kind: 'npc', role: 'shop', name: L.shop.name, ...FOLK[L.shop.name], at: L.shop.at, face: L.shop.face, mode: 'post' });
    if (L.hq.npc) this.newEnt({ kind: 'npc', role: 'prep', name: L.hq.npc, ...FOLK[L.hq.npc], at: L.hq.at, face: L.hq.face, mode: 'post' });
    for (const e of this.ents.filter((o) => o.role)) {
      const label = `${e.name}（${e.role === 'shop' ? '商店' : '整备'}）`;
      e.tag = this.worldText(0, 0, label, 15, '#ffe08a').setOrigin(0.5, 1).setDepth(890);
    }

    // 已加入的武将（阵亡 / 离队、本关作为敌军登场的除外）
    const plan = this.makePlan();
    const joined = (reg.get('joined') || []).filter((id) => isGeneral(id) && id !== 'caocao'
      && !(GENERALS[id].gone && flags[GENERALS[id].gone]) && !plan.blocked.has(id));
    const people = joined.map((id) => ({ name: GENERALS[id].name, gid: id, side: 'player' }));
    // 本关台词里的武将尚未记入 joined、但已是本关出阵候选（预设我军 / joinAt 到达，如汉中战后归降的庞德）：也在营中；
    // 客人：本关台词里不是我军武将的人物（如暂居营中的刘备）；
    // 与登记武将同名但写明 side、且尚未在营中的（如暂投曹营的关羽）也作为客人
    const poolIds = new Set(plan.pool.map((c) => c.id));
    const talks = stageTalks(this.stageId, (d) => this.flagOk(d));
    for (const [who, e] of talks) {
      const gid = GENERAL_ID[who];
      if (people.some((p) => p.name === who) || gid === 'caocao') continue;
      if (gid && poolIds.has(gid)) { people.push({ name: who, gid, side: 'player' }); continue; }
      if (gid && !e.side) continue;
      people.push({ name: who, side: e.side || 'ally', cls: e.cls || FOLK[who]?.cls, guest: true });
    }
    for (const f of L.folk || []) people.push({ name: f.name, ...FOLK[f.name], folkAt: f.at, folkRoam: !!f.roam });

    const posts = shuffle(L.posts || []);
    const crew = shuffle(people.filter((p) => p.gid));
    let nPost = Math.min(posts.length, Math.ceil(crew.length / 3));
    const place = (p, mode, at, face) => this.newEnt({ kind: 'npc', role: 'talk', mode, at, face, ...p });
    for (const p of [...crew, ...people.filter((o) => !o.gid)]) {
      if (p.folkAt) { place(p, p.folkRoam ? 'roam' : 'post', p.folkAt, 'dr'); continue; }
      if (p.gid && nPost > 0) {
        const s = posts.find((q) => !this.occupied(q[0], q[1]));
        if (s) { nPost -= 1; place(p, 'post', [s[0], s[1]], s[2]); continue; }
      }
      const cell = this.randomCell();
      if (!cell) { console.warn('营中没有空位安置人物', p.name); continue; }
      place(p, 'roam', cell, Math.random() < 0.5 ? 'dr' : 'dl');
    }
    for (const e of this.ents) {
      if (e.kind !== 'npc' || e.role !== 'talk') continue;
      e.home = [e.a, e.b];
      e.nextAt = this.time.now + 800 + Math.random() * 3000;
      e.marker = this.worldText(0, 0, '！', 22, '#ffd36a').setOrigin(0.5, 1).setDepth(895).setVisible(false);
      e.nameTag = this.worldText(0, 0, e.name, 13, '#f6ecd2').setOrigin(0.5, 0).setDepth(880).setAlpha(0.85);
    }
    this.updateMarkers();
  }

  // 闲逛区域内随机空格（避开功能点旁边、出生点）；优先选周围一圈没有人的格子，免得人物挤成一团
  randomCell(near, range = 99, self = null) {
    const L = this.layout;
    const cells = this.grid.free.filter(([a, b]) => L.roam.some(([a0, b0, a1, b1]) => a >= a0 && a <= a1 && b >= b0 && b <= b1)
      && !this.reserved.has(`${a},${b}`) && !this.occupied(a, b, self)
      && (!near || octile(a, b, near[0], near[1]) <= range));
    const roomy = cells.filter(([a, b]) => !this.ents.some((e) => e !== self && Math.max(Math.abs(e.a - a), Math.abs(e.b - b)) <= 1));
    const pick = roomy.length ? roomy : cells;
    return pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
  }

  makeHud() {
    const st = this.stage;
    const place = STAGE_PLACE[st.id]?.place || st.name;
    const L = this.layout;
    const w = 420;
    panel(this, 16, 12, w, 70, 0.9).setDepth(1000);
    text(this, 34, 22, `${place} · ${L.name}`, 22, '#ffd36a', FONT).setDepth(1000);
    text(this, 34, 54, `下一战：${st.chapter}　${st.name}`, 15, '#f1e3c2').setDepth(1000);
    const bw = 96;
    button(this, WIDTH - (bw + 16) * 2, 20, bw, 38, '存　档', () => this.openSave('save'), 17).setDepth(1000);
    button(this, WIDTH - (bw + 16), 20, bw, 38, '读　档', () => this.openSave('load'), 17).setDepth(1000);
    this.toastText = text(this, WIDTH / 2, 96, '', 17, '#ffd27a', FONT).setOrigin(0.5).setStroke('#000', 4).setDepth(1000);
    text(this, WIDTH / 2, HEIGHT - 18, '点击地面行走　方向键 / WASD 移动　走到人物旁按空格 / 回车或点击人物对话　右键取消', 14, '#e8d6ae')
      .setOrigin(0.5, 1).setStroke('#000', 3).setDepth(1000);
  }

  toast(msg) {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1600, duration: 500 });
  }

  // ---------- 战役状态 ----------
  flagOk(d) {
    const flags = this.registry.get('flags') || {};
    return (!d?.ifFlag || flags[d.ifFlag]) && (!d?.unlessFlag || !flags[d.unlessFlag]);
  }

  // 对白选项：与 StoryScene.applyChoice 相同，累加红色指数、设置剧情标记（写入 registry）
  applyChoice(c) {
    if (c.red) this.registry.set('red', (this.registry.get('red') || 0) + c.red);
    if (c.flag) this.registry.set('flags', { ...(this.registry.get('flags') || {}), [c.flag]: true });
  }

  // 下一关的出阵推导；候选武将没有装备记录时补发初始装备（同 BattleScene.kitFor）
  makePlan() {
    const reg = this.registry;
    const plan = planDeploy(this.stage, { roster: reg.get('roster') || {}, joined: reg.get('joined') || [], flags: reg.get('flags') || {} });
    const roster = reg.get('roster') || {};
    const n = this.inventory.length;
    let changed = false;
    for (const c of plan.pool) {
      if (!isGeneral(c.id) || roster[c.id]?.equip) continue;
      const lv = Math.max(c.lvl || 1, roster[c.id]?.lvl || 0);
      roster[c.id] = { ...roster[c.id], equip: issueKit(this.inventory, c.id, GENERALS[c.id].cls, lv) };
      changed = true;
    }
    if (changed) {
      reg.set('roster', { ...roster });
      reg.set('inventory', [...(reg.get('inventory') || []), ...this.inventory.slice(n).map((it) => ({ ...it }))]);
    }
    return plan;
  }

  snapshot() {
    const r = this.registry;
    const roster = r.get('roster') || {};
    return {
      kind: 'camp',
      stage: this.stageId,
      talked: [...this.talked],
      deploy: this.deploy ? [...this.deploy] : null,
      pos: [this.player.a, this.player.b],
      difficulty: r.get('difficulty') || 'normal',
      roster,
      joined: [...(r.get('joined') || [])],
      items: { ...(r.get('items') || {}) },
      red: r.get('red') ?? 0,
      flags: { ...(r.get('flags') || {}) },
      inventory: (r.get('inventory') || []).map((it) => ({ ...it })),
      gold: r.get('gold') ?? 0,
      summary: { lordLvl: roster.caocao?.lvl || 1 },
    };
  }

  // ---------- 功能 ----------
  busy() {
    return this.modal || this.leaving || this.dialog.root.visible;
  }

  openSave(mode) {
    if (this.busy()) return;
    this.halt();
    this.modal = true;
    openSaveMenu(this, {
      mode,
      getData: () => this.snapshot(),
      onLoad: (data) => applyLoad(this, data),
      onClose: () => { this.modal = false; },
    });
  }

  // 整备（大帐 / 军需官）：阵容、装备、道具；商人：商店
  openPrepUI(shop) {
    if (this.busy()) return;
    this.halt();
    this.modal = true;
    const plan = this.makePlan();
    this.items = { ...(this.registry.get('items') || {}) };
    const opts = shop
      ? { tabs: ['shop'], title: '商　　店', confirmLabel: '离　开' }
      : { tabs: ['deploy', 'equip', 'items'], title: '营 中 整 备', confirmLabel: '完　成', selected: this.deploy && initialDeploy(plan, this.deploy) };
    openPrep(this, plan, (ids) => {
      if (!shop) this.deploy = ids;
      this.modal = false;
    }, opts);
  }

  confirmDepart() {
    if (this.busy()) return;
    this.halt();
    this.modal = true;
    const root = this.add.container(0, 0).setDepth(3000);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.55).setOrigin(0).setInteractive();
    shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
    const w = 480, h = 200, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
    root.add([shade, panel(this, x0, y0, w, h, 0.98)]);
    root.add(text(this, WIDTH / 2, y0 + 36, '出　征', 26, '#ffd36a', FONT).setOrigin(0.5));
    root.add(text(this, WIDTH / 2, y0 + 86, `离开营中，进军「${this.stage.name}」？`, 18, '#f1e3c2', FONT).setOrigin(0.5));
    // 回车确认、ESC 取消。键盘监听下一帧再注册：打开本框的那次回车 / 空格不会立刻确认；按住不放的重复事件忽略
    let done = false;
    const kb = this.input.keyboard;
    const close = () => {
      if (done) return;
      done = true;
      kb?.off('keydown-ESC', onEsc);
      kb?.off('keydown-ENTER', onEnter);
      root.destroy();
      this.modal = false;
    };
    const go = () => { if (done) return; close(); this.depart(); };
    const onEsc = () => close();
    const onEnter = (ev) => { if (!ev?.repeat) go(); };
    root.add(button(this, WIDTH / 2 - 150, y0 + h - 64, 130, 44, '出　征', go, 19));
    root.add(button(this, WIDTH / 2 + 20, y0 + h - 64, 130, 44, '再等等', close, 19));
    this.time.delayedCall(0, () => {
      if (done) return;
      kb?.on('keydown-ESC', onEsc);
      kb?.on('keydown-ENTER', onEnter);
    });
  }

  depart() {
    if (this.leaving) return;
    this.leaving = true;
    this.halt();
    // 出征自动存档（关卡开头类型）：含营中选项改动后的红色指数 / 标记、道具、装备、金钱与选好的阵容，读取后播下一关开场
    const { talked, pos, kind, ...data } = this.snapshot();
    if (!this.stage.debug) writeAuto(data, 'stage');
    this.cameras.main.fadeOut(400);
    this.ui.fadeOut(400);
    this.time.delayedCall(420, () => goStage(this, this.stageId, { deploy: this.deploy }));
  }

  // ---------- 对话 ----------
  async talk(n) {
    const res = pickTalk({
      stageId: this.stageId, name: n.name, gid: n.gid, talked: this.talked,
      count: this.counts.get(n.name) || 0, flagOk: (d) => this.flagOk(d),
    });
    this.counts.set(n.name, (this.counts.get(n.name) || 0) + 1);
    const sideOf = (who) => (who === n.name ? n.side : GENERAL_ID[who] ? 'player' : undefined);
    const fill = (lines) => lines.map((l) => ({
      ...l, side: l.side || sideOf(l.who),
      choices: l.choices?.map((c) => ({ ...c, reply: c.reply && fill(c.reply) })),
    }));
    await this.dialog.show(fill(res.lines));
    if (res.specific && !this.talked.includes(n.name)) this.talked.push(n.name);
    this.updateMarkers();
  }

  updateMarkers() {
    const talks = stageTalks(this.stageId, (d) => this.flagOk(d));
    for (const e of this.ents) if (e.marker) e.unread = talks.has(e.name) && !this.talked.includes(e.name);
  }

  activate(t) {
    if (this.busy()) return;
    this.halt();
    const p = this.player;
    this.faceEnt(p, sign(t.a - p.a), sign(t.b - p.b));
    if (t.kind === 'gate') return this.confirmDepart();
    if (t.kind === 'prep' || t.role === 'prep') return this.openPrepUI(false);
    if (t.role === 'shop') return this.openPrepUI(true);
    if (!t.moving) this.faceEnt(t, sign(p.a - t.a), sign(p.b - t.b));
    t.path = null;
    return this.talk(t).catch((e) => console.error('营中对话出错', e));
  }

  // 曹操旁边可以互动的对象：优先面朝的格子，否则最近的一个
  nearTarget() {
    const p = this.player;
    if (p.moving) return null;
    const list = [...this.ents.filter((e) => e.kind === 'npc' && !e.moving), ...this.objects]
      .filter((t) => Math.max(Math.abs(t.a - p.a), Math.abs(t.b - p.b)) === 1);
    if (!list.length) return null;
    const [fa, fb] = p.facing;
    return list.find((t) => t.a === p.a + fa && t.b === p.b + fb)
      || list.sort((x, y) => octile(p.a, p.b, x.a, x.b) - octile(p.a, p.b, y.a, y.b))[0];
  }

  onAction() {
    if (this.leaving) return;
    if (this.dialog.root.visible) { if (!this.dialog.choiceBox) this.dialog.next(); return; }
    if (this.busy()) return;
    const t = this.nearTarget();
    if (t) this.activate(t);
  }

  // ---------- 输入与移动 ----------
  // 屏幕坐标 → 等角格子
  cellAt(x, y) {
    const u = (x - 600) / 28, v = (y - 150) / 14;
    return [Math.round((u + v) / 2), Math.round((v - u) / 2)];
  }

  // 点中的人物（按身体范围）或物件
  hitTarget(x, y) {
    let best = null;
    for (const e of this.ents) {
      if (e.kind !== 'npc') continue;
      const c = e.actor.c;
      if (Math.abs(x - c.x) < 24 && y > c.y - 96 && y < c.y + 8 && (!best || c.y > best.actor.c.y)) best = e;
    }
    if (best) return best;
    return this.objects.find((o) => x >= o.hit.x0 && x <= o.hit.x1 && y >= o.hit.y0 && y <= o.hit.y1) || null;
  }

  onPointer(p) {
    if (p.rightButtonDown()) { this.halt(); return; }
    if (this.busy()) return;
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const t = this.hitTarget(w.x, w.y);
    const pl = this.player;
    if (t) {
      if (!pl.moving && Math.max(Math.abs(t.a - pl.a), Math.abs(t.b - pl.b)) === 1) { this.activate(t); return; }
      this.goTo([t.a, t.b], t);
      return;
    }
    this.goTo(this.cellAt(w.x, w.y), null);
  }

  // 寻路走向 to（目标被占 / 是障碍时走到旁边）；target 为到达后要互动的对象
  goTo(to, target) {
    const p = this.player;
    const from = p.to || [p.a, p.b];
    const path = findPath(this.passFor(p, true, target), from, to, { near: true, limit: 2500 });
    if (!path) { this.toast('走不过去'); return; }
    this.path = path;
    this.goal = to;
    this.pending = target;
  }

  halt() {
    this.path = null;
    this.pending = null;
  }

  occupied(a, b, self) {
    return this.ents.some((e) => e !== self && ((e.a === a && e.b === b) || (e.to && e.to[0] === a && e.to[1] === b)));
  }

  // 可走判断：静态障碍 + 其他人物；ignoreRoaming 为真时（规划长路径）忽略离得较远、正在闲逛的人物（keep 除外），走到跟前再重新规划
  passFor(self, ignoreRoaming = false, keep = null) {
    return (a, b) => this.grid.pass(a, b) && !this.ents.some((e) => e !== self
      && !(ignoreRoaming && e !== keep && e.mode === 'roam' && octile(a, b, self.a, self.b) > 2)
      && ((e.a === a && e.b === b) || (e.to && e.to[0] === a && e.to[1] === b)));
  }

  // 朝向：屏幕上向右（a − b 增大）为 r，向左为 l；向下（a + b 增大）为正面 d，向上为背面 u
  faceEnt(e, da, db) {
    if (!da && !db) return;
    e.facing = [da, db];
    const sx = da - db, sy = da + db;
    const cur = e.actor.dir || 'dr';
    const h = sx > 0 ? 'r' : sx < 0 ? 'l' : cur[1];
    const v = sy < 0 ? 'u' : 'd';
    e.actor.setFace(v + h);
  }

  step(e, na, nb, speed) {
    const da = na - e.a, db = nb - e.b;
    e.to = [na, nb];
    e.moving = true;
    this.faceEnt(e, da, db);
    if (e.actor.pose !== 'walk') e.actor.setPose('walk');
    const p = isoToScreen(na, nb);
    const c = e.actor.c;
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    this.tweens.add({
      targets: c, x: p.x, y: p.y, duration: Math.max(80, (dist / speed) * 1000),
      onUpdate: () => e.actor.sort(),
      onComplete: () => {
        e.a = na; e.b = nb; e.actor.a = na; e.actor.b = nb;
        e.to = null;
        e.moving = false;
      },
    });
  }

  keyDir() {
    const k = this.keys;
    if (!k) return null;
    let a = 0, b = 0;
    const add = ([da, db]) => { a += da; b += db; };
    if (k.UP.isDown || k.W.isDown) add(KEY_DIRS.up);
    if (k.DOWN.isDown || k.S.isDown) add(KEY_DIRS.down);
    if (k.LEFT.isDown || k.A.isDown) add(KEY_DIRS.left);
    if (k.RIGHT.isDown || k.D.isDown) add(KEY_DIRS.right);
    a = sign(a); b = sign(b);
    return a || b ? [a, b] : null;
  }

  updatePlayer() {
    const p = this.player;
    if (p.moving) return;
    const pass = this.passFor(p);
    const kd = this.busy() ? null : this.keyDir();
    if (kd) {
      this.halt();
      // 斜向被挡时沿墙滑动（只走其中一个分量）
      const tries = [kd, [kd[0], 0], [0, kd[1]]].filter(([a, b]) => a || b);
      const ok = tries.find(([a, b]) => canStep(pass, p.a, p.b, a, b));
      if (ok) { this.step(p, p.a + ok[0], p.b + ok[1], SPEED); return; }
      this.faceEnt(p, ...kd);
    } else if (this.path?.length && !this.busy()) {
      const [na, nb] = this.path[0];
      if (canStep(pass, p.a, p.b, na - p.a, nb - p.b)) {
        this.path.shift();
        this.step(p, na, nb, SPEED);
        return;
      }
      // 前方被人挡住：重新规划（这次把附近的人物都算作障碍）
      const again = findPath(pass, [p.a, p.b], this.goal, { near: true, limit: 2500 });
      if (again?.length) { this.path = again; return; }
      this.path = null;
      if (!again) this.pending = null;
    } else if (this.pending && !this.busy()) {
      const t = this.pending;
      this.pending = null;
      this.path = null;
      if (Math.max(Math.abs(t.a - p.a), Math.abs(t.b - p.b)) === 1) this.activate(t);
    }
    if (!p.moving && p.actor.pose === 'walk') p.actor.setPose('stand');
  }

  updateNpc(e, time) {
    if (e.moving) return;
    if (this.busy() || e.mode !== 'roam') { if (e.actor.pose === 'walk') e.actor.setPose('stand'); return; }
    if (e.path?.length) {
      const [na, nb] = e.path[0];
      if (canStep(this.passFor(e), e.a, e.b, na - e.a, nb - e.b)) { e.path.shift(); this.step(e, na, nb, NPC_SPEED); return; }
      e.path = null;
    }
    if (e.actor.pose === 'walk') e.actor.setPose('stand');
    if (time < e.nextAt) return;
    e.nextAt = time + 2500 + Math.random() * 4500;
    const p = this.player;
    // 曹操在旁边时停下等候对话
    if (Math.max(Math.abs(p.a - e.a), Math.abs(p.b - e.b)) <= 1) { this.faceEnt(e, sign(p.a - e.a), sign(p.b - e.b)); return; }
    const to = this.randomCell(e.home, 4, e);
    if (!to) return;
    const path = findPath(this.passFor(e), [e.a, e.b], to, { limit: 400 });
    if (path && path.length <= 8) e.path = path;
  }

  // ---------- 镜头 ----------
  camTarget(x, y) {
    const hw = WIDTH / 2 / ZOOM, hh = HEIGHT / 2 / ZOOM;
    return { x: Phaser.Math.Clamp(x, hw, WIDTH - hw), y: Phaser.Math.Clamp(y - 50, hh, HEIGHT - hh) };
  }

  applyCam() {
    this.cameras.main.setZoom(RES * ZOOM).centerOn(this.camPos.x, this.camPos.y);
  }

  update(time, delta) {
    if (!this.player) return;
    this.updatePlayer();
    for (const e of this.ents) if (e.kind === 'npc') this.updateNpc(e, time);
    // 镜头平滑跟随
    const c = this.player.actor.c;
    const t = this.camTarget(c.x, c.y);
    const k = Math.min(1, (delta / 1000) * 6);
    this.camPos.x += (t.x - this.camPos.x) * k;
    this.camPos.y += (t.y - this.camPos.y) * k;
    this.applyCam();
    // 头顶标记与提示
    for (const e of this.ents) {
      const ec = e.actor.c;
      e.marker?.setPosition(ec.x, ec.y - 100).setVisible(!!e.unread);
      e.tag?.setPosition(ec.x, ec.y - 100);
      e.nameTag?.setPosition(ec.x, ec.y + 4);
    }
    const target = this.busy() ? null : this.nearTarget();
    if (target) {
      const verb = target.kind === 'gate' ? '出征' : target.kind === 'prep' || target.role === 'prep' ? '整备' : target.role === 'shop' ? '商店' : `与${target.name}对话`;
      const at = target.actor ? { x: target.actor.c.x, y: target.actor.c.y - (target.unread || target.tag ? 124 : 100) } : target.top;
      this.prompt.setText(`［空格］${verb}`).setPosition(at.x, at.y - (target.actor ? 0 : 22)).setVisible(true);
    } else this.prompt.setVisible(false);
  }

  cleanup() {
    this.events.off('prerender', this.sortCams);
    this.tweens.killAll();
    for (const e of this.ents) e.actor.destroy();
    this.ents = [];
    this.player = null;
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('st-') || k.startsWith('sbg-')) this.textures.remove(k);
  }
}

// 布局里的朝向名 → 格子方向
function dirVec(face) {
  return { dr: [1, 0], dl: [0, 1], ur: [0, -1], ul: [-1, 0] }[face] || [1, 1];
}

