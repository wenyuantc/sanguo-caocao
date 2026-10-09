import * as Phaser from 'phaser';
import { TILE, COLS, ROWS, MAP_X, MAP_Y, FONT, hiDpi } from '../config.js';
import { STAGES } from '../stages.js';
import { CLASSES, SPELLS, ITEMS, diffOf } from '../data.js';
import {
  createUnit, calcStats, reachable, pathTo, key, inMap, isFoe, attackTiles, spellTiles, terrainAt, dist,
  physDamage, hitRate, canAttackFrom, spellDamage, spellHit, healAmount,
} from '../logic.js';
import { drawMap } from '../mapRender.js';
import { UnitView } from '../unitView.js';
import { Hud } from '../hud.js';
import { DialogBox, button, wait, text } from '../ui.js';
import { doAttack, doSpell, doItem, runAI } from '../actions.js';
import { writeAuto, applyLoad } from '../saves.js';
import { openSaveMenu } from '../saveMenu.js';
import { ensureTextures } from '../spellFx.js';

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.stageIndex = data?.stage ?? 0;
    this.load = data?.load || null;
    this.modal = false;
    this.over = false;
    this.state = 'busy';
    this.sel = null;
    this.menu = null;
  }

  create() {
    hiDpi(this);
    const stage = (this.stage = STAGES[this.stageIndex]);
    this.map = stage.map;
    this.map.forEach((r, i) => r.length !== COLS && console.warn('地图行长度错误', i, r));
    drawMap(this, this.map);
    const roster = this.registry.get('roster') || {};
    const load = this.load;
    this.difficultyId = load?.difficulty || this.registry.get('difficulty') || 'normal';
    this.difficulty = diffOf(this.difficultyId);
    this.items = { ...(load?.items || this.registry.get('items') || this.difficulty.items) };
    this.units = load
      ? load.units.map((u) => ({ ...u, stats: calcStats(u.cls, u.lvl, u.bonus, u.mult) }))
      : stage.units.map((d) => createUnit(d, d.faction === 'player' ? roster[d.id] : null, this.difficulty));
    this.views = new Map();
    this.units.filter((u) => u.alive).forEach((u) => this.views.set(u, new UnitView(this, u)));
    this.hl = this.add.graphics().setDepth(5);
    this.cursor = this.add.graphics().setDepth(6);
    this.hud = new Hud(this, stage);
    this.hud.setItems(this.items);
    this.dialog = new DialogBox(this);
    this.turn = load?.turn ?? 1;
    this.firedEvents = new Set(load?.firedEvents || []);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p) => this.onHover(p));
    this.input.on('pointerdown', (p) => this.onClick(p));
    this.input.keyboard?.on('keydown-ESC', () => this.cancel());
    this.start();
  }

  async start() {
    if (this.load) return this.resume();
    await this.dialog.show(this.stage.prologue);
    await this.hud.banner(this.stage.title);
    await this.startPhase('player');
  }

  // ---------- 存档 ----------
  async resume() {
    this.phase = 'player';
    this.hud.setTurn(this.turn, this.stage.turns, 'player');
    this.units.forEach((u) => u.alive && u.faction === 'player' && this.views.get(u).setActed(u.acted));
    this.hud.log('已读取进度');
    await this.hud.banner(`${this.stage.title}　第${this.turn}回合`);
    this.state = 'idle';
  }

  snapshot() {
    const lord = this.units.find((u) => u.id === 'caocao');
    return {
      kind: 'battle',
      difficulty: this.difficultyId,
      stage: this.stageIndex,
      turn: this.turn,
      items: { ...this.items },
      roster: this.registry.get('roster') || {},
      firedEvents: [...this.firedEvents],
      units: this.units.map(({ stats, ...u }) => u),
      summary: { lordLvl: lord.lvl },
    };
  }

  openSave(mode) {
    if (this.modal || this.over || this.dialog.root.visible) return;
    if (this.phase !== 'player' || !['idle', 'move'].includes(this.state)) {
      this.hud.log(mode === 'save' ? '请先完成当前单位的行动再存档' : '当前无法读取进度');
      return;
    }
    this.clearSelection();
    this.state = 'idle';
    this.modal = true;
    openSaveMenu(this, {
      mode,
      getData: () => this.snapshot(),
      onLoad: (data) => applyLoad(this, data),
      onClose: () => { this.modal = false; },
    });
  }

  tileAt(p) {
    const x = Math.floor((p.worldX - MAP_X) / TILE), y = Math.floor((p.worldY - MAP_Y) / TILE);
    return inMap(x, y) ? { x, y } : null;
  }

  unitAt(x, y) {
    return this.units.find((u) => u.alive && u.x === x && u.y === y);
  }

  setCursor(x, y) {
    const g = this.cursor.clear();
    if (x == null) return;
    const px = MAP_X + x * TILE, py = MAP_Y + y * TILE;
    g.lineStyle(3, 0xffe08a, 1).strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
    g.fillStyle(0xffe08a, 1);
    for (const [cx, cy] of [[px, py], [px + TILE, py], [px, py + TILE], [px + TILE, py + TILE]]) g.fillCircle(cx, cy, 3);
  }

  paint(tiles, color, alpha = 0.38) {
    for (const t of tiles) {
      this.hl.fillStyle(color, alpha).fillRect(MAP_X + t.x * TILE + 1, MAP_Y + t.y * TILE + 1, TILE - 2, TILE - 2);
    }
  }

  // ---------- 回合流程 ----------
  async startPhase(faction) {
    this.phase = faction;
    this.state = 'busy';
    this.hud.setTurn(this.turn, this.stage.turns, faction);
    const mine = this.units.filter((u) => u.alive && u.faction === faction);
    if (faction !== 'player' && !mine.length && faction === 'ally') return this.nextPhase();
    await this.hud.banner(`第${this.turn}回合　${{ player: '我军', ally: '友军', enemy: '敌军' }[faction]}阶段`,
      { player: '#9cc8ff', ally: '#9ce0a8', enemy: '#ff9a8a' }[faction]);
    await this.fireEvents(faction);
    for (const u of this.units.filter((v) => v.alive && v.faction === faction)) {
      u.acted = false;
      this.views.get(u)?.setActed(false);
      const t = terrainAt(this.map, u.x, u.y);
      if (t.heal && u.hp < u.stats.hp) {
        const amt = Math.min(u.stats.hp - u.hp, Math.round(u.stats.hp * t.heal));
        u.hp += amt;
        this.views.get(u).updateHp();
        this.hud.log(`${u.name} 在${t.name}休整，兵力 +${amt}`);
      }
    }
    if (faction === 'player') { this.state = 'idle'; return; }
    await runAI(this, faction);
    if (!this.over) this.nextPhase();
  }

  nextPhase() {
    if (this.over) return;
    if (this.phase === 'player') return this.startPhase('ally');
    if (this.phase === 'ally') return this.startPhase('enemy');
    this.turn += 1;
    if (this.turn > this.stage.turns) return this.defeat('时限已到，我军粮草耗尽……');
    return this.startPhase('player');
  }

  async fireEvents(faction) {
    for (const [i, ev] of this.stage.events.entries()) {
      if (this.firedEvents.has(i) || ev.turn !== this.turn || ev.faction !== faction) continue;
      this.firedEvents.add(i);
      for (const d of ev.units) {
        if (this.unitAt(d.x, d.y)) continue;
        const u = createUnit(d, null, this.difficulty);
        this.units.push(u);
        const v = new UnitView(this, u);
        this.views.set(u, v);
        v.c.setAlpha(0);
        this.tweens.add({ targets: v.c, alpha: 1, duration: 400 });
      }
      for (const [id, ai] of Object.entries(ev.setAi || {})) {
        const u = this.units.find((o) => o.id === id && o.alive);
        if (u) u.ai = ai;
      }
      await this.dialog.show(ev.dialog);
    }
  }

  endPlayerPhase() {
    if (this.phase !== 'player' || this.state === 'busy' || this.over) return;
    this.clearSelection();
    this.state = 'busy';
    this.nextPhase();
  }

  async checkEnd() {
    if (this.over) return true;
    const lord = this.units.find((u) => u.id === 'caocao');
    if (!lord.alive) { await this.defeat('曹操撤退了……'); return true; }
    const v = this.stage.victory;
    const boss = this.units.find((u) => u.id === v.target);
    const enemiesLeft = this.units.some((u) => u.alive && u.faction === 'enemy');
    if ((boss && !boss.alive) || !enemiesLeft) { await this.victory(); return true; }
    return false;
  }

  async victory() {
    this.over = true;
    this.state = 'busy';
    this.clearSelection();
    await this.hud.banner('胜　利', '#ffe08a');
    await this.dialog.show(this.stage.epilogue);
    const roster = this.registry.get('roster') || {};
    for (const u of this.units) if (u.faction === 'player') roster[u.id] = { lvl: u.lvl, exp: u.exp };
    this.registry.set('roster', roster);
    // 过关奖励补给
    const items = { ...this.items };
    for (const [k, n] of Object.entries(this.difficulty.reward)) items[k] = (items[k] || 0) + n;
    this.registry.set('items', items);
    writeAuto({
      stage: this.stageIndex + 1, roster, items, difficulty: this.difficultyId,
      summary: { lordLvl: this.units.find((u) => u.id === 'caocao').lvl },
    });
    const next = this.stageIndex + 1;
    if (next < STAGES.length) this.scene.start('Battle', { stage: next });
    else this.scene.start('Ending');
  }

  async defeat(reason) {
    this.over = true;
    this.state = 'busy';
    this.clearSelection();
    this.hud.log(reason);
    await this.hud.banner('败　北', '#ff8a7a');
    const cx = (COLS * TILE) / 2, cy = MAP_Y + 300;
    this.add.rectangle(0, 0, 2000, 2000, 0x000000, 0.55).setOrigin(0).setDepth(900).setInteractive();
    text(this, cx, cy - 70, reason, 26, '#f1e3c2', FONT).setOrigin(0.5).setDepth(901);
    button(this, cx - 170, cy, 150, 48, '重新挑战', () => this.scene.start('Battle', { stage: this.stageIndex })).setDepth(901);
    button(this, cx + 20, cy, 150, 48, '返回标题', () => this.scene.start('Title')).setDepth(901);
  }

  // ---------- 输入 ----------
  onHover(p) {
    const t = this.tileAt(p);
    if (!t || this.dialog.root.visible || this.modal) return;
    if (this.state !== 'busy') this.setCursor(t.x, t.y);
    const u = this.unitAt(t.x, t.y);
    this.hud.showUnit(u, terrainAt(this.map, t.x, t.y));
    this.hud.forecast(this.state === 'target' ? this.forecastFor(t) : '');
  }

  onClick(p) {
    if (this.dialog.root.visible || this.modal || this.state === 'busy' || this.over) return;
    if (p.rightButtonDown()) { this.cancel(); return; }
    const t = this.tileAt(p);
    if (!t) return;
    const u = this.unitAt(t.x, t.y);
    if (this.state === 'idle') {
      if (u && u.faction === 'player' && !u.acted) this.select(u);
      else if (u) this.inspect(u);
      else this.hl.clear();
    } else if (this.state === 'move') {
      const node = this.sel.range.get(key(t.x, t.y));
      if (node) this.moveSelected(node);
      else if (u && u !== this.sel.unit) { this.clearSelection(); this.state = 'idle'; this.onClick(p); }
      else this.cancel();
    } else if (this.state === 'target') {
      if (this.sel.targets.some((o) => o.x === t.x && o.y === t.y) && u && this.validTarget(u)) this.execute(u);
    }
  }

  cancel() {
    if (this.modal) return;
    if (this.state === 'move' || (this.state === 'idle' && this.hl)) {
      this.clearSelection();
      this.state = 'idle';
    } else if (this.state === 'menu') {
      const { unit, origin } = this.sel;
      unit.x = origin.x; unit.y = origin.y;
      this.views.get(unit).snap();
      this.closeMenu();
      this.select(unit);
    } else if (this.state === 'target') {
      this.hl.clear();
      this.hud.forecast('');
      this.openMenu();
    }
  }

  clearSelection() {
    this.closeMenu();
    this.hl.clear();
    this.hud.forecast('');
    this.sel = null;
  }

  inspect(u) {
    this.hl.clear();
    const range = reachable(this.map, this.units, u);
    const tiles = [...range.values()];
    this.paint(tiles, u.faction === 'enemy' ? 0xff5040 : 0x50d070, 0.3);
    const atk = new Map();
    for (const t of tiles) for (const a of attackTiles(u, t.x, t.y)) if (!range.has(key(a.x, a.y))) atk.set(key(a.x, a.y), a);
    this.paint([...atk.values()], 0xff2020, 0.15);
  }

  select(u) {
    this.clearSelection();
    const range = reachable(this.map, this.units, u);
    this.sel = { unit: u, origin: { x: u.x, y: u.y }, range };
    this.state = 'move';
    this.paint([...range.values()], 0x3a8cff, 0.4);
    const atk = new Map();
    for (const t of range.values()) for (const a of attackTiles(u, t.x, t.y)) if (!range.has(key(a.x, a.y))) atk.set(key(a.x, a.y), a);
    this.paint([...atk.values()], 0xff3020, 0.18);
  }

  async moveSelected(node) {
    const u = this.sel.unit;
    this.state = 'busy';
    this.hl.clear();
    u.x = node.x; u.y = node.y;
    await this.views.get(u).moveAlong(pathTo(node));
    this.openMenu();
  }

  // ---------- 指令菜单 ----------
  closeMenu() {
    this.menu?.destroy();
    this.menu = null;
  }

  buildMenu(entries) {
    this.closeMenu();
    const u = this.sel.unit;
    const w = 128, h = 34;
    let x = MAP_X + (u.x + 1) * TILE + 6;
    if (x + w > MAP_X + COLS * TILE) x = MAP_X + u.x * TILE - w - 6;
    let y = MAP_Y + u.y * TILE - 10;
    y = Phaser.Math.Clamp(y, MAP_Y + 4, MAP_Y + ROWS * TILE - entries.length * (h + 4) - 4);
    this.menu = this.add.container(x, y).setDepth(600);
    entries.forEach(([label, fn, disabled, icon], i) => {
      const b = button(this, 0, i * (h + 4), w, h, label, fn, 17);
      if (icon) {
        const im = this.add.image(20, h / 2, icon);
        im.setScale(26 / im.width);
        b.add(im);
        b.label.setX(w / 2 + 12);
        if (disabled) im.setAlpha(0.4);
      }
      if (disabled) b.setDisabled(true);
      this.menu.add(b);
    });
  }

  openMenu() {
    const u = this.sel.unit;
    this.state = 'menu';
    this.hl.clear();
    this.setCursor(u.x, u.y);
    const foes = attackTiles(u).some((t) => { const o = this.unitAt(t.x, t.y); return o && isFoe(o, u); });
    const spells = CLASSES[u.cls].spells;
    const hasItem = Object.values(this.items).some((n) => n > 0);
    this.buildMenu([
      ['攻　击', () => this.startTarget('attack'), !foes],
      ['策　略', () => this.spellMenu(), !spells.length],
      ['道　具', () => this.itemMenu(), !hasItem],
      ['待　机', () => this.finishUnit(u)],
    ]);
  }

  spellMenu() {
    const u = this.sel.unit;
    const entries = CLASSES[u.cls].spells.map((id) => [`${SPELLS[id].name} ${SPELLS[id].mp}`, () => this.startTarget('spell', id), u.mp < SPELLS[id].mp]);
    entries.push(['返　回', () => this.openMenu()]);
    this.buildMenu(entries);
    this.hud.forecast(`策略值 ${u.mp}/${u.stats.mp}\n` + CLASSES[u.cls].spells.map((id) => `${SPELLS[id].name}：${SPELLS[id].desc}`).join('\n'));
  }

  itemMenu() {
    ensureTextures(this);
    const entries = Object.entries(this.items).map(([id, n]) => [`${ITEMS[id].name} ×${n}`, () => this.startTarget('item', id), n <= 0, `fx-${id}`]);
    entries.push(['返　回', () => this.openMenu()]);
    this.buildMenu(entries);
    this.hud.forecast(Object.values(ITEMS).map((it) => `${it.name}：${it.desc}`).join('\n'));
  }

  startTarget(kind, id) {
    const u = this.sel.unit;
    this.closeMenu();
    let tiles;
    if (kind === 'attack') tiles = attackTiles(u);
    else if (kind === 'spell') tiles = spellTiles(u, id);
    else tiles = [{ x: u.x, y: u.y }, ...attackTiles({ cls: 'infantry' }, u.x, u.y)];
    this.sel.action = { kind, id };
    this.sel.targets = tiles;
    this.state = 'target';
    const healish = kind === 'item' || (kind === 'spell' && SPELLS[id].kind === 'heal');
    this.paint(tiles, healish ? 0x40e080 : 0xff3a2a, 0.22);
    this.paint(tiles.filter((t) => { const o = this.unitAt(t.x, t.y); return o && this.validTarget(o); }), healish ? 0x40e080 : 0xff3a2a, 0.45);
    this.hud.forecast('请选择目标（右键取消）');
  }

  validTarget(o) {
    const { unit: u, action } = this.sel;
    const healish = action.kind === 'item' || (action.kind === 'spell' && SPELLS[action.id].kind === 'heal');
    return healish ? !isFoe(o, u) : isFoe(o, u);
  }

  forecastFor(t) {
    const o = this.unitAt(t.x, t.y);
    if (!o || !this.sel?.targets.some((p) => p.x === t.x && p.y === t.y) || !this.validTarget(o)) return '';
    const { unit: u, action } = this.sel;
    if (action.kind === 'attack') {
      const d = physDamage(this.map, u, o);
      let s = `【攻击预测】\n伤害 ${d}　命中 ${hitRate(this.map, u, o)}%`;
      if (d < o.hp && canAttackFrom(o, o.x, o.y, u)) s += `\n反击 ${physDamage(this.map, o, u)}　命中 ${hitRate(this.map, o, u)}%`;
      else if (d >= o.hp) s += '\n可击破目标！';
      return s;
    }
    if (action.kind === 'spell') {
      const sp = SPELLS[action.id];
      if (sp.kind === 'heal') return `【${sp.name}】恢复约 ${Math.min(healAmount(u), o.stats.hp - o.hp)}`;
      return `【${sp.name}】伤害 ${spellDamage(this.map, u, o, action.id)}　成功 ${spellHit(u, o)}%`;
    }
    return `【${ITEMS[action.id].name}】${ITEMS[action.id].desc}`;
  }

  async execute(o) {
    const { unit: u, action } = this.sel;
    this.state = 'busy';
    this.hl.clear();
    this.hud.forecast('');
    if (action.kind === 'attack') await doAttack(this, u, o);
    else if (action.kind === 'spell') await doSpell(this, u, action.id, o);
    else await doItem(this, u, action.id, o);
    await this.finishUnit(u);
  }

  async finishUnit(u) {
    this.closeMenu();
    this.hl.clear();
    this.sel = null;
    u.acted = true;
    if (u.alive) this.views.get(u)?.setActed(true);
    if (await this.checkEnd()) return;
    this.state = 'idle';
    if (!this.units.some((o) => o.alive && o.faction === 'player' && !o.acted)) {
      await wait(this, 300);
      this.endPlayerPhase();
    }
  }
}
