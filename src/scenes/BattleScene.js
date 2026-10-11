import * as Phaser from 'phaser';
import { TILE, MAP_X, MAP_Y, VIEW_W, VIEW_H, FONT, hiDpi } from '../config.js';
import { getStage, resolveNext, FIRST_STAGE, ENDINGS, PLANNED_IDS } from '../stages.js';
import { classOf, RANGES, SPELLS, ITEMS, SEAL_FROM, LOOT, diffOf, passable } from '../data.js';
import {
  createUnit, restoreUnit, promoteBlock, reachable, pathTo, key, inMap, isFoe, attackTiles, spellTiles, terrainAt,
  physDamage, hitRate, spellDamage, spellHit, healAmount, spellBlock, spellTargetOk, spellVictims,
  areaTiles, roleOf, spellDrainMp, usableSpells, spellCost, counterOk, tickGear, spellUsable, gemSpells,
} from '../logic.js';
import { WEATHERS, weatherOf, stepWeather, stageWeather, validIdx, weatherSpellIdx } from '../weather.js';
import { WeatherFx } from '../weatherFx.js';
import { STATUS, BUFF_NAME, tickStatus, canAct, canCast, has } from '../status.js';
import { drawMap } from '../mapRender.js';
import { MapCamera } from '../mapCamera.js';
import { Minimap } from '../minimap.js';
import { UnitView } from '../unitView.js';
import { Hud } from '../hud.js';
import { DialogBox, button, wait, text, floatText } from '../ui.js';
import { doAttack, doSpell, doItem, runAI, gainExp, gainGear } from '../actions.js';
import { writeAuto, applyLoad, restoreRegistry, stageStartSave } from '../saves.js';
import { openSaveMenu } from '../saveMenu.js';
import { GENERALS, isGeneral } from '../generals.js';
import { planDeploy, buildPlayerDefs } from '../deploy.js';
import { openPrep } from '../prep.js';
import { openInfo } from '../infoPanel.js';
import { openRewards } from '../rewardPanel.js';
import { ensureTextures, lootFx } from '../spellFx.js';
import { playDuel } from '../duel.js';
import {
  SLOTS, DROPS, issueKit, kitFrom, copyKit, newGear, pickGear, stageRewards, goldFor, gearName,
} from '../equipment.js';

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.stageId = data?.stage ?? FIRST_STAGE;
    this.load = data?.load || null;
    this.modal = false;
    this.over = false;
    this.state = 'busy';
    this.sel = null;
    this.menu = null;
    this.hoverKey = null;
    this.mapReset = false;
  }

  // 地图版本不一致时，把 registry 恢复为本关开头的战役状态（道具、红色指数、剧情标记、成长、装备、金钱）：
  // 1. 第一关：开头状态就是新游戏（同 TitleScene.newGame），按存档难度重建；
  // 2. 其他关：用 stage 指向本关的自动存档（上一关胜利时写入，见 stageStartSave）。
  // 3. 都没有时退回：沿用 applyLoad 已写入的战斗存档数据。已知限制：道具消耗、红色指数、剧情标记、
  //    roster / 装备（整备后写入的值）停留在存档时刻，开场剧情选项可能再次累加红色指数。
  restartFromStageStart(load, stage) {
    const difficulty = load.difficulty || 'normal';
    if (stage.id === FIRST_STAGE) {
      restoreRegistry(this, {
        difficulty, roster: {}, joined: [], items: { ...diffOf(difficulty).items }, red: 0, flags: {}, inventory: [], gold: 0,
      });
      return;
    }
    const start = stageStartSave(load, stage.id, (id) => getStage(id)?.id);
    if (start) restoreRegistry(this, start);
    else console.warn('地图版本不一致且没有本关开头的自动存档，沿用战斗存档中的战役状态', stage.id);
  }

  // 释放上一关生成的人物 / 头像贴图，避免连续游玩时内存持续增长（按需重新生成）
  purgeTextures() {
    for (const k of this.textures.getTextureKeys()) {
      if (k.startsWith('hero-') || k.startsWith('pt-')) this.textures.remove(k);
    }
  }

  create() {
    hiDpi(this);
    this.purgeTextures();
    const stage = (this.stage = getStage(this.stageId) || getStage(FIRST_STAGE));
    this.stageId = stage.id;
    this.map = stage.map;
    this.map.forEach((r, i) => r.length !== this.map[0].length && console.warn('地图行长度错误', i, r));
    // 关卡地图已重做（mapVersion 不同）：战斗中存档的坐标失效，从本关开头重新开始
    if (this.load && (this.load.mapVersion ?? 1) !== stage.mapVersion) {
      this.restartFromStageStart(this.load, stage);
      this.load = null;
      this.mapReset = true;
    }
    drawMap(this, this.map);
    // 镜头：地图层随镜头滚动，界面层固定；弹窗、对话、指令菜单时禁止手动滚动
    this.cam = new MapCamera(this, this.map, {
      canScroll: () => !this.modal && !this.dialog?.root.visible && this.state !== 'menu',
    });
    // 天气：类别取关卡设定，序号开局取起始值，读档取存档值（旧存档缺失时取起始值）
    const wt = stageWeather(stage);
    this.weatherType = wt.type;
    this.weatherIdx = validIdx(this.load?.weatherIdx) ? this.load.weatherIdx : wt.start;
    this.weatherFx = new WeatherFx(this);
    this.weatherFx.set(this.weather);
    const roster = this.registry.get('roster') || {};
    const load = this.load;
    this.difficultyId = load?.difficulty || this.registry.get('difficulty') || 'normal';
    this.difficulty = diffOf(this.difficultyId);
    this.items = { ...(load?.items || this.registry.get('items') || this.difficulty.items) };
    this.red = load?.red ?? this.registry.get('red') ?? 0;
    this.flags = { ...(load?.flags || this.registry.get('flags') || {}) };
    // 装备背包与金钱：战斗中的掉落只记在副本里，胜利时写回 registry
    this.inventory = (load?.inventory || this.registry.get('inventory') || []).map((it) => ({ ...it }));
    this.gold = load?.gold ?? this.registry.get('gold') ?? 0;
    this.gained = [];
    // applyLoad 已把存档中的 joined 写入 registry（旧存档按 roster 推导）
    const joined = this.registry.get('joined') || Object.keys(roster).filter(isGeneral);
    this.deployPlan = null;
    if (load) {
      this.joined = [...joined];
      // 旧存档的我军武将没有装备：按 roster 记录（缺失时按原版规则生成初始装备）补上
      this.units = load.units.map((u) => restoreUnit(u.equip || u.faction !== 'player' || !isGeneral(u.id) ? u : { ...u, equip: this.kitFor(u.id, u.lvl) }, this.difficulty));
    } else {
      // 新战斗：先按默认阵容生成我军（开场剧情时显示），整备确认后再按选择重建
      this.deployPlan = planDeploy(stage, { roster, joined, flags: this.flags });
      this.joined = this.deployPlan.joined;
      this.deployPlan.pool.forEach((c) => this.kitFor(c.id, c.lvl));
      const others = stage.units.filter((d) => d.faction !== 'player' && this.flagOk(d)).map((d) => createUnit(d, null, this.difficulty));
      this.units = [...this.playerUnits(this.deployPlan.defaults), ...others];
    }
    // 主将与受保护单位：受到伤害减轻（GUARD_TAKEN），AI 控制时不冒进
    this.guardIds = new Set(['caocao', ...(stage.protect || [])]);
    this.units.forEach((u) => this.markGuard(u));
    this.views = new Map();
    this.units.filter((u) => u.alive).forEach((u) => this.views.set(u, new UnitView(this, u)));
    this.hl = this.add.graphics().setDepth(5);
    this.aoe = this.add.graphics().setDepth(5); // 范围策略的作用范围预览
    this.cursor = this.add.graphics().setDepth(6);
    this.hud = new Hud(this, stage);
    this.hud.setItems(this.items);
    this.hud.setWeather(this.weather, this.weatherType);
    this.dialog = new DialogBox(this);
    this.turn = load?.turn ?? 1;
    this.firedEvents = new Set(load?.firedEvents || []);
    this.hud.setRed(this.red);
    this.drawGoals();
    this.dialog.onChoice = (c) => this.applyChoice(c);
    this.minimap = this.cam.scrollable ? new Minimap(this, this.map, this.cam) : null;

    // 输入：左键在地图上按下 → 抬起时没有拖动才算点击（拖动用于滚动镜头）；右键立即取消
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p) => { this.cam.move(p); this.onHover(p); });
    this.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) {
        if (!this.dialog.root.visible && !this.modal && this.state !== 'busy' && !this.over) this.cancel();
        return;
      }
      // 对白 / 弹窗显示时的按下不算地图点击（对白遮罩自身也会阻止冒泡）
      if (this.dialog.root.visible || this.modal) { this.cam.drag = null; return; }
      this.cam.press(p);
    });
    const up = (p) => { if (this.cam.release(p)) this.onClick(p); };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', () => { this.cam.drag = null; });
    this.input.keyboard?.on('keydown-ESC', () => this.cancel());
    // 开局 / 读档时镜头对准曹操（曹操不在场时对准第一个我军）
    const lead = this.units.find((u) => u.alive && u.id === 'caocao') || this.units.find((u) => u.alive && u.faction === 'player');
    if (lead) this.cam.centerTile(lead.x, lead.y, 0);
    this.start();
  }

  update() {
    // 镜头移动后，鼠标下的格子变了：刷新光标与悬停信息
    if (this.cam.moved) {
      this.cam.moved = false;
      const p = this.input.activePointer;
      if (this.input.isOver && !this.cam.drag?.moved) this.onHover(p);
    }
    this.minimap?.update(this.units);
  }

  // 镜头跟随：把相关格子（单位或 {x, y}）移入视口，返回 Promise
  follow(...tiles) {
    return this.cam.follow(tiles.flat());
  }

  async start() {
    if (this.load) return this.resume();
    if (this.mapReset) {
      this.hud.log('关卡地图已更新，已从本关开头重新开始');
      await this.dialog.show([{ who: '旁白', text: '关卡地图已更新，将从本关开头重新开始（等级、装备等成长数据保留）。' }]);
    }
    await this.dialog.show(this.stage.prologue);
    await this.startPrep();
    await this.hud.banner(`${this.stage.chapter}　${this.stage.name}`);
    await this.startPhase('player');
  }

  // 当前天气（0 晴 / 1 阴 / 2 雨 / 3 豪雨 / 4 雪）
  get weather() {
    return weatherOf(this.weatherType, this.weatherIdx);
  }

  // 改变天气序号；实际天气改变时播放切换动画、更新顶部栏并记日志，返回是否改变
  async changeWeather(idx) {
    const old = this.weather;
    this.weatherIdx = idx;
    if (this.weather === old) return false;
    this.hud.setWeather(this.weather, this.weatherType);
    this.hud.log(`天气由${WEATHERS[old]}转为${WEATHERS[this.weather]}`);
    await this.weatherFx.transition(this.weather);
    return true;
  }

  markGuard(u) {
    u.guard = this.guardIds.has(u.id);
  }

  // ---------- 出阵整备 ----------
  // 我军武将的装备副本：没有装备记录（新加入 / 旧存档）时按原版规则生成初始装备，立即写入战役状态
  kitFor(id, lvl) {
    if (!isGeneral(id)) return undefined;
    const roster = this.registry.get('roster') || {};
    if (!roster[id]?.equip) {
      const n = this.inventory.length;
      const lv = Math.max(lvl || 1, roster[id]?.lvl || 0);
      roster[id] = { ...roster[id], equip: issueKit(this.inventory, id, GENERALS[id].cls, lv) };
      this.registry.set('roster', { ...roster });
      this.registry.set('inventory', [...(this.registry.get('inventory') || []), ...this.inventory.slice(n).map((it) => ({ ...it }))]);
    }
    return kitFrom(this.inventory, roster[id].equip);
  }

  playerUnits(ids) {
    const defs = buildPlayerDefs(this.deployPlan, ids);
    const kits = defs.map((d) => this.kitFor(d.id, d.lvl));
    const roster = this.registry.get('roster') || {};
    return defs.map((d, i) => createUnit(d, roster[d.id], this.difficulty, kits[i]));
  }

  // 开场剧情后整备（出阵、装备、道具、商店）；整备中可能换装，确认后一律重建我军单位与视图
  async startPrep() {
    const plan = this.deployPlan;
    if (!plan) return;
    this.modal = true;
    const ids = await new Promise((r) => openPrep(this, plan, r));
    this.modal = false;
    this.hud.setItems(this.items);
    for (const u of this.units.filter((o) => o.faction === 'player')) {
      const v = this.views.get(u);
      v.idle?.remove();
      v.c.destroy();
      this.views.delete(u);
    }
    const players = this.playerUnits(ids);
    players.forEach((u) => this.markGuard(u));
    this.units = [...players, ...this.units.filter((u) => u.faction !== 'player')];
    players.forEach((u) => this.views.set(u, new UnitView(this, u)));
  }

  // 部队情报
  openInfo() {
    if (this.modal || this.over || this.dialog.root.visible) return;
    if (this.phase !== 'player' || !['idle', 'move'].includes(this.state)) {
      this.hud.log('请在我军阶段查看部队情报');
      return;
    }
    this.clearSelection();
    this.state = 'idle';
    this.modal = true;
    openInfo(this, { onPick: (u) => this.focusUnit(u), onClose: () => { this.modal = false; } });
  }

  // 光标移到单位并在右侧面板显示其信息
  focusUnit(u) {
    this.cam.centerTile(u.x, u.y);
    this.setCursor(u.x, u.y);
    this.hud.showUnit(u, terrainAt(this.map, u.x, u.y));
    this.hoverKey = null;
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
      stage: this.stageId,
      mapVersion: this.stage.mapVersion,
      red: this.red,
      flags: { ...this.flags },
      turn: this.turn,
      items: { ...this.items },
      inventory: this.inventory.map((it) => ({ ...it })),
      gold: this.gold,
      roster: this.registry.get('roster') || {},
      joined: [...this.joined],
      firedEvents: [...this.firedEvents],
      weatherIdx: this.weatherIdx,
      units: this.units.map(({ stats, ...u }) => ({
        ...u, status: { ...u.status }, buffs: { ...u.buffs }, equip: copyKit(u.equip), fruits: u.fruits && { ...u.fruits },
      })),
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

  // 指针所在格子：按镜头换算；指针在小地图上时视为不在地图上
  tileAt(p) {
    const s = this.cam.screenOf(p);
    if (this.minimap?.hit(s.x, s.y)) return null;
    return this.cam.tileAt(p);
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
    // 第 2 回合起，每到我军阶段开始天气随机变化一次（research weather.md §3）
    if (faction === 'player' && this.turn > 1) await this.changeWeather(stepWeather(this.weatherIdx));
    const mine = this.units.filter((u) => u.alive && u.faction === faction);
    if (faction !== 'player' && !mine.length && faction === 'ally') return this.nextPhase();
    // 我军阶段开始：曹操不在视口内时把镜头移过去
    if (faction === 'player') {
      const lord = mine.find((u) => u.id === 'caocao');
      if (lord) await this.follow(lord);
    }
    await this.hud.banner(`第${this.turn}回合　${{ player: '我军', ally: '友军', enemy: '敌军' }[faction]}阶段`,
      { player: '#9cc8ff', ally: '#9ce0a8', enemy: '#ff9a8a' }[faction]);
    await this.fireEvents(faction);
    // 连环铠按阶段计算受到攻击的次数
    for (const u of this.units) u.hitsTaken = 0;
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
      await this.gearTurn(u);
      this.tickUnit(u);
    }
    if (faction === 'player') {
      this.state = 'idle';
      // 我军全部混乱时直接结束本阶段
      if (!this.units.some((o) => o.alive && o.faction === 'player' && !o.acted)) { await wait(this, 400); this.endPlayerPhase(); }
      return;
    }
    await runAI(this, faction);
    if (!this.over) this.nextPhase();
  }

  // 阶段开始时的装备效果（先于异常结算，太平清领道可使混乱的单位照常行动）：回复兵力 / 策略值、解除异常、每回合经验
  async gearTurn(u) {
    const g = tickGear(u);
    const v = this.views.get(u);
    const p = { x: MAP_X + u.x * TILE + TILE / 2, y: MAP_Y + u.y * TILE + TILE / 2 };
    if (g.heal) { floatText(this, p.x, p.y - 20, `+${g.heal}`, '#7dff9a', 20); this.hud.log(`${u.name} 的装备恢复兵力 +${g.heal}`); }
    if (g.mp) { floatText(this, p.x, p.y - 38, `策略 +${g.mp}`, '#8ac8ff', 18); this.hud.log(`${u.name} 的太平要术恢复策略值 +${g.mp}`); }
    if (g.cured.length) this.hud.log(`${u.name} 的太平清领道解除了${g.cured.map((k) => STATUS[k].name).join('、')}`);
    if (g.heal || g.mp || g.cured.length) { v?.updateHp(); v?.updateStatus(); }
    gainGear(this, u, 'weapon', g.weapon);
    gainGear(this, u, 'armor', g.armor);
    if (g.exp) await gainExp(this, u, g.exp);
  }

  // 敌将击破时掉落装备（宝物已拥有则不掉落），即时进入背包；等级按曹操等级
  async dropLoot(u) {
    const item = u.faction === 'enemy' && DROPS[this.stageId]?.[u.id];
    const id = item && pickGear(this.inventory, item);
    if (!id) return;
    const it = newGear(this.inventory, id, this.lordLvl());
    this.gained.push(it);
    this.hud.log(`★ 获得宝物「${gearName(it)}」`);
    await lootFx(this, u.x, u.y, it.id, `获得「${gearName(it)}」`);
  }

  lordLvl() {
    return this.units.find((u) => u.id === 'caocao').lvl;
  }

  // 阶段开始时的状态处理：中毒扣血、异常自然恢复 / 到期、增减益递减；混乱的单位本阶段不能行动
  tickUnit(u) {
    const v = this.views.get(u);
    const p = { x: MAP_X + u.x * TILE + TILE / 2, y: MAP_Y + u.y * TILE + TILE / 2 };
    for (const e of tickStatus(u)) {
      if (e.type === 'poison') {
        floatText(this, p.x, p.y - 20, `中毒 -${e.dmg}`, STATUS.poison.css, 20);
        this.hud.log(`${u.name} 中毒，兵力 -${e.dmg}`);
      } else if (e.type === 'recover') this.hud.log(`${u.name} 从${STATUS[e.key].name}中恢复`);
      else this.hud.log(`${u.name} 的${BUFF_NAME[e.key]}${e.key === 'move' ? '加成' : '变化'}结束`);
    }
    v?.updateHp();
    v?.updateStatus();
    if (!canAct(u)) {
      u.acted = true;
      if (u.faction === 'player') v?.setActed(true);
      this.hud.log(`${u.name} 陷入混乱，无法行动`);
    }
  }

  nextPhase() {
    if (this.over) return;
    if (this.phase === 'player') return this.startPhase('ally');
    if (this.phase === 'ally') return this.startPhase('enemy');
    this.turn += 1;
    const hold = this.stage.victory.find((c) => c.type === 'survive' && this.turn > c.turns);
    if (hold) return this.victory(hold.outcome, 'survive');
    if (this.turn > this.stage.turns) return this.defeat('时限已到，我军粮草耗尽……');
    return this.startPhase('player');
  }

  // ---------- 剧情事件 ----------
  // 剧情标记：ifFlag 需要有该标记才出场，unlessFlag 有该标记则不出场
  flagOk(d) {
    return (!d.ifFlag || this.flags[d.ifFlag]) && (!d.unlessFlag || !this.flags[d.unlessFlag]);
  }

  setFlag(name) {
    this.flags[name] = true;
    this.registry.set('flags', { ...this.flags });
  }

  spawn(defs = []) {
    const out = [];
    for (let d of defs) {
      if (!this.flagOk(d)) continue;
      const at = this.spawnTile(d);
      if (!at) continue;
      if (at.x !== d.x || at.y !== d.y) d = { ...d, ...at };
      const mine = d.faction === 'player';
      const kit = mine ? this.kitFor(d.id, d.lvl) : undefined;
      const u = createUnit(d, mine ? (this.registry.get('roster') || {})[d.id] : null, this.difficulty, kit);
      this.markGuard(u);
      this.units.push(u);
      const v = new UnitView(this, u);
      this.views.set(u, v);
      v.c.setAlpha(0);
      this.tweens.add({ targets: v.c, alpha: 1, duration: 400 });
      out.push(u);
    }
    return out;
  }

  // 援军落点：原定格子被占时，就近（曼哈顿距离 3 格内）找该兵种可站的空格；都没有则放弃该单位
  spawnTile(d) {
    const cls = roleOf(d).cls;
    for (let r = 0; r <= 3; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (const dy of new Set([r - Math.abs(dx), Math.abs(dx) - r])) {
          const x = d.x + dx, y = d.y + dy;
          if (inMap(x, y, this.map) && passable(cls, this.map[y][x]) && !this.unitAt(x, y)) return { x, y };
        }
      }
    }
    return null;
  }

  async runEvent(i, ev) {
    this.firedEvents.add(i);
    if (ev.setFlag) this.setFlag(ev.setFlag);
    // 援军登场：镜头移到新出现的单位
    const spawned = this.spawn(ev.units);
    if (spawned.length) await this.follow(spawned);
    for (const [id, ai] of Object.entries(ev.setAi || {})) {
      const u = this.units.find((o) => o.id === id && o.alive);
      if (u) u.ai = ai;
    }
    await this.dialog.show(ev.dialog);
  }

  async fireEvents(faction) {
    for (const [i, ev] of this.stage.events.entries()) {
      if (this.firedEvents.has(i) || ev.turn == null || ev.turn !== this.turn || (ev.faction || 'enemy') !== faction) continue;
      await this.runEvent(i, ev);
    }
  }

  // 单位撤退时触发的剧情
  async fireDeathEvents(u) {
    for (const [i, ev] of this.stage.events.entries()) {
      if (!this.firedEvents.has(i) && ev.onDeath === u.id) await this.runEvent(i, ev);
    }
  }

  // 单挑：a 与 b 首次交手时触发
  findDuel(a, b) {
    for (const [i, ev] of this.stage.events.entries()) {
      const d = ev.duel;
      if (!d || this.firedEvents.has(i)) continue;
      if ((d.a === a.id && d.b === b.id) || (d.a === b.id && d.b === a.id)) return [i, ev];
    }
    return null;
  }

  async runDuel([i, ev]) {
    this.firedEvents.add(i);
    const a = this.units.find((u) => u.id === ev.duel.a);
    const b = this.units.find((u) => u.id === ev.duel.b);
    await playDuel(this, a, b, ev);
  }

  applyChoice(c) {
    if (c.red) {
      this.red += c.red;
      this.registry.set('red', this.red);
      this.hud.setRed(this.red);
    }
    if (c.flag) this.setFlag(c.flag);
  }

  // 撤离：指定武将行动结束时停在撤离点，即安全撤出战场（不算阵亡）
  async tryEscape(u) {
    const esc = this.stage.escape;
    if (!u.alive || !esc?.units.includes(u.id) || !esc.tiles.some(([x, y]) => u.x === x && u.y === y)) return;
    u.alive = false;
    u.escaped = true;
    this.hud.log(`${u.name} 撤离了战场`);
    const v = this.views.get(u);
    this.views.delete(u);
    if (v) await new Promise((r) => this.tweens.add({ targets: v.c, alpha: 0, y: v.c.y - 16, duration: 500, onComplete: () => { v.c.destroy(); r(); } }));
  }

  // 到达类胜利条件 / 撤离点：在地图上标出目标格（金色为胜利目标，蓝色为撤离点）
  drawGoals() {
    const g = this.add.graphics().setDepth(4);
    for (const [x, y] of this.stage.escape?.tiles || []) {
      const px = MAP_X + x * TILE, py = MAP_Y + y * TILE;
      g.fillStyle(0x6ab8ff, 0.25).fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
      g.lineStyle(2, 0x6ab8ff, 0.9).strokeRect(px + 5, py + 5, TILE - 10, TILE - 10);
    }
    for (const c of this.stage.victory) {
      if (c.type !== 'reach') continue;
      for (const [x, y] of c.tiles) {
        const px = MAP_X + x * TILE, py = MAP_Y + y * TILE;
        g.fillStyle(0xffd36a, 0.28).fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        g.lineStyle(2, 0xffd36a, 0.9).strokeRect(px + 3, py + 3, TILE - 6, TILE - 6);
      }
    }
    this.tweens.add({ targets: g, alpha: 0.45, yoyo: true, repeat: -1, duration: 700 });
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
    for (const id of this.stage.protect || []) {
      const u = this.units.find((o) => o.id === id);
      if (u && !u.alive) { await this.defeat(`${u.name}撤退了……`); return true; }
    }
    const enemiesLeft = this.units.some((u) => u.alive && u.faction === 'enemy');
    for (const c of this.stage.victory) {
      let ok = false;
      if (c.type === 'boss') ok = this.units.some((u) => u.id === c.target && !u.alive);
      else if (c.type === 'all') ok = !enemiesLeft;
      else if (c.type === 'reach' && this.turn >= (c.fromTurn || 1)) {
        ok = this.units.some((u) => u.alive && u.faction === 'player' && (c.unit === 'any' || u.id === c.unit)
          && c.tiles.some(([x, y]) => u.x === x && u.y === y));
      }
      if (ok) { await this.victory(c.outcome, c.type); return true; }
    }
    if (!enemiesLeft) { await this.victory('win', 'all'); return true; }
    return false;
  }

  async victory(outcome = 'win', via = 'all') {
    this.over = true;
    this.state = 'busy';
    this.clearSelection();
    const annihilated = !this.units.some((u) => u.alive && u.faction === 'enemy');
    await this.hud.banner(outcome === 'retreat' ? '撤　退' : '胜　利', '#ffe08a');
    // 胜利时按单位存亡设置剧情标记（例如郭嘉未撤退则战后病逝），先于结尾对白，便于对白按标记分支
    for (const r of this.stage.victoryFlags || []) {
      const u = this.units.find((o) => o.id === r.unit);
      if (u && u.alive === r.alive && (!r.outcome || r.outcome === outcome)) this.setFlag(r.flag);
    }
    const eps = this.stage.epilogues || {};
    await this.dialog.show((annihilated && eps.annihilate) || eps[outcome] || this.stage.epilogue);
    // 成长记录与装备 / 果子引用合并保存；战斗中的装备熟练度按 uid 写回背包
    const roster = this.registry.get('roster') || {};
    for (const u of this.units) {
      if (u.faction !== 'player') continue;
      roster[u.id] = { ...roster[u.id], lvl: u.lvl, exp: u.exp, cls: u.cls, tier: u.tier };
      for (const s of SLOTS) {
        const g = u.equip?.[s];
        const it = g?.uid != null && this.inventory.find((o) => o.uid === g.uid);
        if (it) Object.assign(it, { lvl: g.lvl, exp: g.exp });
      }
    }
    this.registry.set('roster', roster);
    const lordLvl = this.lordLvl();
    const rewards = stageRewards(this.stageId, {
      flags: this.flags, outcome, via, annihilated, turn: this.turn,
      alive: (id) => this.units.some((o) => o.id === id && o.alive),
    });
    let gold = goldFor(lordLvl);
    const gear = [...this.gained];
    for (const r of rewards) {
      if (r.gold) gold += r.gold;
      const id = r.item && pickGear(this.inventory, r.item);
      if (id) gear.push(newGear(this.inventory, id, lordLvl));
    }
    this.gold += gold;
    this.registry.set('inventory', this.inventory.map((it) => ({ ...it })));
    this.registry.set('gold', this.gold);
    const joined = [...new Set([...this.joined, ...this.units.filter((u) => u.faction === 'player' && isGeneral(u.id)).map((u) => u.id)])];
    this.registry.set('joined', joined);
    this.registry.set('red', this.red);
    // 过关奖励补给
    const items = { ...this.items };
    for (const [k, n] of Object.entries(this.difficulty.reward)) items[k] = (items[k] || 0) + n;
    // 印绶：从徐州入侵战起每关胜利 +1
    const idx = PLANNED_IDS.indexOf(this.stageId);
    const seal = idx >= PLANNED_IDS.indexOf(SEAL_FROM);
    if (seal) items.seal = (items.seal || 0) + 1;
    // 战利品：按关卡序号轮流获得一件（桃等只能由此获得）
    const loot = LOOT[Math.max(0, idx) % LOOT.length];
    items[loot] = (items[loot] || 0) + 1;
    this.registry.set('items', items);
    const next = resolveNext(this.stage, outcome, annihilated, this.red);
    if (!this.stage.debug) writeAuto({
      stage: next, roster, joined, items, difficulty: this.difficultyId, red: this.red, flags: { ...this.flags },
      inventory: this.inventory, gold: this.gold, summary: { lordLvl },
    });
    const supplies = { ...this.difficulty.reward };
    if (seal) supplies.seal = (supplies.seal || 0) + 1;
    supplies[loot] = (supplies[loot] || 0) + 1;
    this.modal = true;
    await openRewards(this, { gold, gear, items: supplies });
    if (next && getStage(next)) this.scene.start('Battle', { stage: next });
    else this.scene.start('Ending', { route: ENDINGS[next] || 'villain' });
  }

  async defeat(reason) {
    this.over = true;
    this.state = 'busy';
    this.clearSelection();
    this.hud.log(reason);
    await this.hud.banner('败　北', '#ff8a7a');
    const cx = VIEW_W / 2, cy = MAP_Y + 300;
    this.add.rectangle(0, 0, 2000, 2000, 0x000000, 0.55).setOrigin(0).setDepth(900).setInteractive();
    text(this, cx, cy - 70, reason, 26, '#f1e3c2', FONT).setOrigin(0.5).setDepth(901);
    button(this, cx - 170, cy, 150, 48, '重新挑战', () => this.scene.start('Battle', { stage: this.stageId })).setDepth(901);
    button(this, cx + 20, cy, 150, 48, '返回标题', () => this.scene.start('Title')).setDepth(901);
  }

  // ---------- 输入 ----------
  onHover(p) {
    const t = this.tileAt(p);
    if (!t || this.dialog.root.visible || this.modal) return;
    if (this.state !== 'busy') this.setCursor(t.x, t.y);
    // 信息面板重建开销大（头像 + 多个文字）：同一格、同一状态下鼠标移动不重复刷新
    const hk = `${t.x},${t.y},${this.state}`;
    if (hk !== this.hoverKey) {
      this.hoverKey = hk;
      this.hud.showUnit(this.unitAt(t.x, t.y), terrainAt(this.map, t.x, t.y));
    }
    // 菜单状态下预测区用于显示按钮说明，不随鼠标移动清空
    if (this.state !== 'menu') this.hud.forecast(this.state === 'target' ? this.forecastFor(t) : '');
    this.previewArea(t);
  }

  onClick(p) {
    if (this.dialog.root.visible || this.modal || this.state === 'busy' || this.over) return;
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
      const inRange = this.sel.targets.some((o) => o.x === t.x && o.y === t.y);
      if (inRange && u && this.validTarget(u)) this.execute(u);
      else if (inRange && u && this.sel.action.kind === 'spell' && isFoe(u, this.sel.unit) && SPELLS[this.sel.action.id].target === 'foe') this.hud.log(spellBlock(this.map, this.sel.action.id, u.x, u.y) || '无法以此为目标');
      else if (inRange && u && this.sel.action.kind === 'item' && ITEMS[this.sel.action.id].promote && !isFoe(u, this.sel.unit)) this.hud.log(promoteBlock(u));
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
      this.aoe.clear();
      this.hud.forecast('');
      this.openMenu();
    }
  }

  clearSelection() {
    this.closeMenu();
    this.hl.clear();
    this.aoe.clear();
    this.hud.forecast('');
    this.sel = null;
  }

  inspect(u) {
    this.hl.clear();
    const range = reachable(this.map, this.units, u);
    const tiles = [...range.values()];
    this.paint(tiles, u.faction === 'enemy' ? 0xff5040 : 0x50d070, 0.3);
    const atk = new Map();
    for (const t of tiles) for (const a of attackTiles(this.map, u, t.x, t.y)) if (!range.has(key(a.x, a.y))) atk.set(key(a.x, a.y), a);
    this.paint([...atk.values()], 0xff2020, 0.15);
  }

  select(u) {
    this.clearSelection();
    this.follow(u);
    const range = reachable(this.map, this.units, u);
    this.sel = { unit: u, origin: { x: u.x, y: u.y }, range };
    this.state = 'move';
    this.paint([...range.values()], 0x3a8cff, 0.4);
    const atk = new Map();
    for (const t of range.values()) for (const a of attackTiles(this.map, u, t.x, t.y)) if (!range.has(key(a.x, a.y))) atk.set(key(a.x, a.y), a);
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
    // 菜单在界面层：按单位格子的屏幕位置摆放（菜单打开期间禁止滚动）
    const at = this.cam.tileToScreen(u.x, u.y);
    let x = at.x + TILE + 6;
    if (x + w > MAP_X + VIEW_W) x = at.x - w - 6;
    let y = at.y - 10;
    y = Phaser.Math.Clamp(y, MAP_Y + 4, MAP_Y + VIEW_H - entries.length * (h + 4) - 4);
    this.menu = this.add.container(x, y).setDepth(600);
    // 第 5 项为说明：鼠标移到按钮上时显示在预测区
    entries.forEach(([label, fn, disabled, icon, hint], i) => {
      const b = button(this, 0, i * (h + 4), w, h, label, fn, 17);
      if (hint) b.list[2].on('pointerover', () => this.hud.forecast(hint));
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
    this.hud.forecast('');
    const foes = attackTiles(this.map, u).some((t) => { const o = this.unitAt(t.x, t.y); return o && isFoe(o, u); });
    const spells = this.menuSpells(u);
    const hasItem = Object.entries(this.items).some(([id, n]) => n > 0 && !ITEMS[id]?.fruit);
    const silent = has(u, 'silence') ? `${u.name}处于禁咒状态，无法使用策略` : '';
    this.buildMenu([
      ['攻　击', () => this.startTarget('attack'), !foes],
      ['策　略', () => this.spellMenu(), !spells.length || !canCast(u), null, silent || (spells.length ? '' : '尚未习得策略')],
      ['道　具', () => this.itemMenu(), !hasItem],
      ['待　机', () => this.finishUnit(u)],
    ]);
  }

  // 策略菜单列出的策略：可用策略（含遁甲天书借用）+ 装备了宝玉但未习得的四神（置灰说明等级）
  menuSpells(u) {
    const known = usableSpells(this.units, u);
    return [...known, ...gemSpells(u, known)];
  }

  // 策略列表分页显示（每页 10 个）；鼠标移到策略上显示说明，不可用时置灰并说明原因（天气、宝玉、等级、策略值）
  spellMenu(page = 0) {
    const u = this.sel.unit;
    const spells = this.menuSpells(u);
    const known = usableSpells(this.units, u);
    const PER = 10, pages = Math.ceil(spells.length / PER);
    const entries = spells.slice(page * PER, (page + 1) * PER).map((id) => {
      const sp = SPELLS[id], mp = spellCost(u, id);
      const { ok, reason } = spellUsable(id, u, this.weather, { known });
      return [`${sp.name} ${mp}`, () => this.startTarget('spell', id), !ok, null, `【${sp.name}】策略值 ${mp}　${sp.desc}${ok ? '' : `\n不可用：${reason}`}`];
    });
    if (pages > 1) entries.push([`下一页 ${page + 1}/${pages}`, () => this.spellMenu((page + 1) % pages)]);
    entries.push(['返　回', () => this.openMenu()]);
    this.buildMenu(entries);
    this.hud.forecast(`策略值 ${u.mp}/${u.stats.mp}　天气 ${WEATHERS[this.weather]}　共 ${spells.length} 种策略\n将鼠标移到策略上查看说明`);
  }

  // 道具目标格：自身与上下左右
  itemTiles(u) {
    return [{ x: u.x, y: u.y }, ...RANGES.cross.map(([dx, dy]) => ({ x: u.x + dx, y: u.y + dy })).filter((p) => inMap(p.x, p.y, this.map))];
  }

  itemMenu() {
    ensureTextures(this);
    const u = this.sel.unit;
    // 印绶：自身或相邻有可转职的我军时才可用，否则置灰并说明原因
    const near = this.itemTiles(u).map((t) => this.unitAt(t.x, t.y)).filter((o) => o && !isFoe(o, u));
    const sealOk = near.some((o) => !promoteBlock(o));
    const ids = Object.keys(ITEMS).filter((id) => this.items[id] > 0 && !ITEMS[id].fruit);
    const entries = ids.map((id) => {
      const it = ITEMS[id];
      const why = it.promote && !sealOk ? `　不可用：${promoteBlock(u) || '附近没有可转职的武将'}` : '';
      return [`${it.name} ×${this.items[id]}`, () => this.startTarget('item', id), !!why, `fx-${id}`, `【${it.name}】${it.desc}${why}`];
    });
    entries.push(['返　回', () => this.openMenu()]);
    this.buildMenu(entries);
    this.hud.forecast('将鼠标移到道具上查看说明');
  }

  startTarget(kind, id) {
    const u = this.sel.unit;
    this.closeMenu();
    let tiles;
    if (kind === 'attack') tiles = attackTiles(this.map, u);
    else if (kind === 'spell') tiles = spellTiles(this.map, u, id);
    else tiles = this.itemTiles(u);
    this.sel.action = { kind, id };
    this.sel.targets = tiles;
    this.state = 'target';
    const healish = kind === 'item' || (kind === 'spell' && SPELLS[id].target !== 'foe');
    this.paint(tiles, healish ? 0x40e080 : 0xff3a2a, 0.22);
    this.paint(tiles.filter((t) => { const o = this.unitAt(t.x, t.y); return o && this.validTarget(o); }), healish ? 0x40e080 : 0xff3a2a, 0.45);
    this.hud.forecast('请选择目标（右键取消）');
  }

  validTarget(o) {
    const { unit: u, action } = this.sel;
    if (action.kind === 'item') {
      const it = ITEMS[action.id];
      if (isFoe(o, u)) return false;
      if (it.promote) return !promoteBlock(o);
      if (it.cure) return it.cure === 'all' ? Object.keys(o.status || {}).length > 0 : has(o, it.cure);
      return true;
    }
    if (action.kind === 'spell') return spellTargetOk(u, action.id, o) && !(SPELLS[action.id].target === 'foe' && spellBlock(this.map, action.id, o.x, o.y));
    return isFoe(o, u);
  }

  forecastFor(t) {
    const o = this.unitAt(t.x, t.y);
    if (!o || !this.sel?.targets.some((p) => p.x === t.x && p.y === t.y)) return '';
    const { unit: u, action } = this.sel;
    if (action.kind === 'item' && ITEMS[action.id].promote && !isFoe(o, u)) {
      const why = promoteBlock(o);
      return why ? `【印绶】${why}` : `【印绶】${o.name}：${classOf(o.cls, o.tier).name} → ${classOf(o.cls, o.tier + 1).name}`;
    }
    if (action.kind === 'spell' && SPELLS[action.id].target === 'foe' && isFoe(o, u)) {
      const why = spellBlock(this.map, action.id, o.x, o.y);
      if (why) return `【${SPELLS[action.id].name}】${why}`;
    }
    if (!this.validTarget(o)) return '';
    if (action.kind === 'attack') {
      const d = physDamage(this.map, u, o);
      let s = `【攻击预测】\n伤害 ${d}　命中 ${hitRate(this.map, u, o)}%`;
      if (d < o.hp && counterOk(u, o)) s += `\n反击 ${physDamage(this.map, o, u)}　命中 ${hitRate(this.map, o, u)}%`;
      else if (d >= o.hp) s += '\n可击破目标！';
      return s;
    }
    if (action.kind === 'spell') return this.spellForecast(u, action.id, o);
    return `【${ITEMS[action.id].name}】${ITEMS[action.id].desc}`;
  }

  // 策略预测：伤害 / 回复 / 效果与成功率；范围策略列出作用人数
  spellForecast(u, id, o) {
    const sp = SPELLS[id];
    const victims = spellVictims(this.map, this.units, u, id, o);
    const head = `【${sp.name}】${sp.area ? `范围内 ${victims.length} 个目标　` : ''}`;
    const one = victims.includes(o) ? o : victims[0];
    if (!one) return `${head}范围内没有可作用的目标`;
    const parts = [];
    if (sp.setWeather) return `【${sp.name}】天气：${WEATHERS[this.weather]} → ${WEATHERS[weatherOf(this.weatherType, weatherSpellIdx(this.weatherType, this.weatherIdx, sp.setWeather))]}　必定成功`;
    if (sp.strikes) parts.push(`雷击 ${sp.strikes} 次，每次伤害约 ${spellDamage(this.map, u, one, id)}`);
    else if (sp.cat === 'damage') parts.push(sp.formula === 'kill' ? '兵力全失' : `伤害 ${spellDamage(this.map, u, one, id)}`);
    if (sp.special === 'xuanwu') parts.push('随机陷入异常或能力下降（不分敌我）');
    if (sp.status) parts.push(sp.status === 'random' ? '随机异常' : STATUS[sp.status].name);
    if (sp.special === 'drain') parts.push('吸取兵力');
    if (sp.special === 'drainMp') parts.push(`吸取策略 ${spellDrainMp(u, one)}`);
    if (sp.buff) parts.push(`${sp.buff.stat === 'move' ? '移动 +2' : `${sp.buff.stat === 'power' ? '攻击 / 精神' : sp.buff.stat === 'all' ? '全能力' : BUFF_NAME[sp.buff.stat]}${sp.buff.mult > 1 ? '上升' : '下降'}`}`);
    if (sp.cat === 'heal') parts.push(`恢复约 ${Math.min(healAmount(u, id), one.stats.hp - one.hp)}`);
    if (sp.mpGain) parts.push(`策略值 +${Math.min(sp.mpGain, one.stats.mp - one.mp)}`);
    if (sp.cure) parts.push('解除全部异常');
    if (sp.special === 'again') parts.push('再次行动');
    if (sp.special === 'meditate') parts.push('兵力 −50　策略值 +25');
    const hit = sp.target === 'foe' ? `　成功 ${spellHit(u, one, id)}%` : '';
    return `${head}\n${one.name}：${parts.join('，')}${hit}`;
  }

  // 范围策略：鼠标指向合法目标时预览作用范围
  previewArea(t) {
    this.aoe.clear();
    const act = this.sel?.action;
    if (this.state !== 'target' || act?.kind !== 'spell' || !SPELLS[act.id].area) return;
    const o = this.unitAt(t.x, t.y);
    if (!o || !this.sel.targets.some((p) => p.x === t.x && p.y === t.y) || !this.validTarget(o)) return;
    const col = SPELLS[act.id].target === 'foe' ? 0xffb030 : 0x60ffb0;
    for (const p of areaTiles(this.map, act.id, o)) {
      this.aoe.lineStyle(2, col, 0.9).strokeRect(MAP_X + p.x * TILE + 3, MAP_Y + p.y * TILE + 3, TILE - 6, TILE - 6);
    }
  }

  async execute(o) {
    const { unit: u, action } = this.sel;
    this.state = 'busy';
    this.hl.clear();
    this.aoe.clear();
    this.hud.forecast('');
    try {
      if (action.kind === 'attack') await doAttack(this, u, o);
      else if (action.kind === 'spell') await doSpell(this, u, action.id, o);
      else await doItem(this, u, action.id, o);
    } catch (e) {
      // 单个行动出错时不卡死整局，视为该单位行动结束
      console.error('行动出错', e);
    }
    await this.finishUnit(u);
  }

  async finishUnit(u) {
    this.closeMenu();
    this.hl.clear();
    this.sel = null;
    u.acted = true;
    if (u.alive) this.views.get(u)?.setActed(true);
    await this.tryEscape(u);
    if (await this.checkEnd()) return;
    this.state = 'idle';
    if (!this.units.some((o) => o.alive && o.faction === 'player' && !o.acted)) {
      await wait(this, 300);
      this.endPlayerPhase();
    }
  }
}
