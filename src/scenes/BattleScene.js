import * as Phaser from 'phaser';
import { TILE, MAP_X, MAP_Y, VIEW_W, VIEW_H, FONT, PANEL_X, WIDTH, HEIGHT, IS_TOUCH, SETTINGS, hiDpi } from '../config.js';
import { getStage, resolveNext, routeOf, FIRST_STAGE, PLANNED_IDS } from '../stages.js';
import { classOf, RANGES, SPELLS, ITEMS, SEAL_FROM, LOOT, diffOf, passable } from '../data.js';
import {
  createUnit, restoreUnit, promoteBlock, reachable, pathTo, key, inMap, isFoe, attackTiles, spellTiles, terrainAt,
  physDamage, hitRate, spellDamage, spellHit, healAmount, spellBlock, spellTargetOk, spellVictims,
  areaTiles, roleOf, spellDrainMp, usableSpells, spellCost, counterOk, tickGear, spellUsable, gemSpells,
} from '../logic.js';
import { WEATHERS, weatherOf, stepWeather, stageWeather, validIdx, weatherSpellIdx } from '../weather.js';
import { WeatherFx } from '../weatherFx.js';
import { STATUS, BUFF_NAME, POISON_RATE, tickStatus, canAct, canCast, has } from '../status.js';
import { drawMap } from '../mapRender.js';
import { MapCamera } from '../mapCamera.js';
import { Minimap } from '../minimap.js';
import { UnitView, tileCenter } from '../unitView.js';
import { stageCmd, entryRoute, replayPatches, WALK_MS } from '../battleStage.js';
import { Hud } from '../hud.js';
import { DialogBox, button, wait, text, floatText } from '../ui.js';
import { doAttack, doSpell, doItem, runAI, gainExp, gainGear } from '../actions.js';
import { writeAuto, applyLoad, restoreRegistry, stageStartSave } from '../saves.js';
import { openSaveMenu } from '../saveMenu.js';
import { openSettingsMenu } from '../settingsMenu.js';
import { openCheatMenu } from '../cheatMenu.js';
import { cheatOn, markCheat } from '../cheat.js';
import { isGeneral, generalOf } from '../generals.js';
import { ensurePool, START_GOLD } from '../recruit.js';
import { planDeploy, buildPlayerDefs, initialDeploy } from '../deploy.js';
import { openPrep } from '../prep.js';
import { openInfo } from '../infoPanel.js';
import { openRewards } from '../rewardPanel.js';
import { ensureTextures, lootFx } from '../spellFx.js';
import { playDuel } from '../duel.js';
import { playPost, goNext } from '../story/flow.js';
import {
  SLOTS, DROPS, issueKit, kitFrom, copyKit, newGear, pickGear, stageRewards, goldFor, gearName,
} from '../equipment.js';
import { sfx } from '../audio/sfx.js';
import { recordTreasures } from '../legacy.js';
import { playMusic, battleMusic, isCrisis } from '../audio/music.js';

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
    this.touchAim = null; // 触屏选目标：第一次点击预览的目标格，再点同一格才执行
    this.aimTag = null;
    this.cancelBtn = null;
    this.endGuard = 0; // 取消按钮消失后“结束回合”延迟出现的时刻，防止连点取消误结束回合
    this.mapReset = false;
    // 开场场景（StoryScene）播完后进入时为 true；否则新开一关先转去开场场景（读档、重新挑战除外）
    this.skipStory = !!data?.skipStory;
    this.redirecting = false;
    // 营中整备选好的出阵武将（经开场场景带入）：作为整备界面的初始阵容
    this.campDeploy = Array.isArray(data?.deploy) ? data.deploy : null;
    // 配乐：危急判定结果；单挑期间不按战况换曲
    this.crisis = false;
    this.inDuel = false;
  }

  // 地图版本不一致时，把 registry 恢复为本关开头的战役状态（道具、红色指数、剧情标记、成长、装备、金钱）：
  // 1. 第一关：开头状态就是新游戏（同 TitleScene.newGame），按存档难度重建；
  // 2. 其他关：用 stage 指向本关的自动存档（营门出征时写入的 'stage'，或上一关胜利时写入的 'camp'，见 stageStartSave）。
  // 3. 都没有时退回：沿用 applyLoad 已写入的战斗存档数据。已知限制：道具消耗、红色指数、剧情标记、
  //    roster / 装备（整备后写入的值）停留在存档时刻，开场剧情选项可能再次累加红色指数。
  restartFromStageStart(load, stage) {
    const difficulty = load.difficulty || 'normal';
    if (stage.id === FIRST_STAGE) {
      restoreRegistry(this, {
        difficulty, roster: {}, joined: [], items: { ...diffOf(difficulty).items }, red: 0, flags: {}, inventory: [], gold: START_GOLD,
        cheated: load.cheated,
      });
      return;
    }
    const start = stageStartSave(load, stage.id, (id) => getStage(id)?.id);
    if (start) restoreRegistry(this, start);
    else console.warn('地图版本不一致且没有本关开头的自动存档，沿用战斗存档中的战役状态', stage.id);
    // 金手指标记不随重开清除
    if (load.cheated) this.registry.set('cheated', true);
  }

  // 释放上一关生成的人物 / 头像贴图，避免连续游玩时内存持续增长（按需重新生成）
  purgeTextures() {
    for (const k of this.textures.getTextureKeys()) {
      if (k.startsWith('hero-') || k.startsWith('pt-')) this.textures.remove(k);
    }
  }

  create() {
    hiDpi(this);
    this.applySpeed();
    this.purgeTextures();
    const stage = (this.stage = getStage(this.stageId) || getStage(FIRST_STAGE));
    this.stageId = stage.id;
    // 每局一份可改写的地图（字符串数组，地形变化时按行替换），改动记在 mapPatches 并写入存档
    this.map = [...stage.map];
    this.mapPatches = [];
    this.map.forEach((r, i) => r.length !== this.map[0].length && console.warn('地图行长度错误', i, r));
    // 关卡地图已重做（mapVersion 不同）：战斗中存档的坐标失效，从本关开头重新开始
    if (this.load && (this.load.mapVersion ?? 1) !== stage.mapVersion) {
      this.restartFromStageStart(this.load, stage);
      this.load = null;
      this.mapReset = true;
    }
    // 金手指开着进入战斗：本周目永久标记
    markCheat(this);
    // 新开一关：先播开场场景（prologue 在场景中演出），场景结束后带 skipStory 回来整备
    if (!this.load && !this.skipStory) {
      this.redirecting = true;
      this.scene.start('Story', {
        stage: stage.id, part: 'pre', deploy: this.campDeploy,
        notice: this.mapReset ? '关卡地图已更新，将从本关开头重新开始（等级、装备等成长数据保留）。' : null,
      });
      return;
    }
    replayPatches(this, this.load?.mapPatches);
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
    // 本关开头（开场场景之后、整备之前）的红色指数与标记：重新挑战时恢复，避免战斗中的剧情选项重复累加（旧存档缺失时取存档值）
    const st = load ? load.start : null;
    this.startState = { red: st?.red ?? this.red, flags: { ...(st?.flags || this.flags) } };
    // 装备背包与金钱：战斗中的掉落只记在副本里，胜利时写回 registry
    this.inventory = (load?.inventory || this.registry.get('inventory') || []).map((it) => ({ ...it }));
    this.gold = load?.gold ?? this.registry.get('gold') ?? 0;
    this.gained = [];
    // 本关的招募候选：先生成并写入 registry，战斗中存档随之保存（读档不会换批）
    ensurePool(this.registry, this.stageId);
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
    // 触屏单击不会触发 pointermove：点击前先按悬停刷新光标、信息面板、伤害预测与范围预览
    const up = (p) => { if (!this.cam.release(p)) return; if (p.wasTouch) this.onHover(p); this.onClick(p); };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', () => { this.cam.drag = null; });
    this.input.keyboard?.on('keydown-ESC', () => this.cancel());
    // 触屏设备：右侧面板底部的“取消”按钮代替右键（与“结束回合”同位置，选中单位期间替换显示，不遮挡地图）
    if (IS_TOUCH) {
      this.cancelBtn = button(this, PANEL_X + 20, HEIGHT - 58, WIDTH - PANEL_X - 40, 40, '取　消', () => {
        if (!this.dialog.root.visible && !this.modal && this.state !== 'busy' && !this.over) this.cancel();
      }, 20).setDepth(53).setVisible(false);
    }
    // 开局 / 读档时镜头对准曹操（曹操不在场时对准第一个我军）
    const lead = this.units.find((u) => u.alive && u.id === 'caocao') || this.units.find((u) => u.alive && u.faction === 'player');
    if (lead) this.cam.centerTile(lead.x, lead.y, 0);
    this.start();
  }

  update() {
    if (this.redirecting) return;
    // 镜头移动后，鼠标下的格子变了：刷新光标与悬停信息
    if (this.cam.moved) {
      this.cam.moved = false;
      const p = this.input.activePointer;
      // 触屏抬起后指针停在原处，不按旧位置刷新
      if (this.input.isOver && !p.wasTouch && !this.cam.drag?.moved) this.onHover(p);
    }
    this.minimap?.update(this.units);
    if (this.cancelBtn) {
      const c = ['move', 'menu', 'target'].includes(this.state) && !this.dialog.root.visible && !this.modal && !this.over;
      // 两个按钮同位置：取消按钮刚消失时“结束回合”晚 0.4 秒出现，连点取消不会落到结束回合上
      if (this.cancelBtn.visible && !c) this.endGuard = this.time.now + 400;
      this.cancelBtn.setVisible(c);
      this.hud.endBtn.setVisible(!c && this.time.now >= this.endGuard);
    }
  }

  // 镜头跟随：把相关格子（单位或 {x, y}）移入视口，返回 Promise
  follow(...tiles) {
    return this.cam.follow(tiles.flat());
  }

  async start() {
    if (this.load) return this.resume();
    // 开场对白已在开场场景（StoryScene）中演出；整备时播放军议曲，开战后换本关战斗曲
    playMusic('council');
    await this.startPrep();
    this.updateMusic();
    await this.hud.banner(`${this.stage.chapter}　${this.stage.name}`);
    await this.startPhase('player');
  }

  // 战斗配乐：本关战斗曲，危急时换危急曲（我军 / 友军 / 敌军阶段不换曲）；战斗结束后、单挑期间不处理
  updateMusic() {
    if (this.over || this.inDuel || !this.units) return;
    this.crisis = isCrisis({ stage: this.stage, units: this.units, turn: this.turn }, this.crisis);
    playMusic(this.crisis ? 'crisis' : battleMusic(this.stageId));
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
    sfx('weather', { weather: this.weather });
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
      roster[id] = { ...roster[id], equip: issueKit(this.inventory, id, generalOf(id).cls, lv) };
      recordTreasures(this.inventory.slice(n).map((it) => it.id));
      this.registry.set('roster', { ...roster });
      this.registry.set('inventory', [...(this.registry.get('inventory') || []), ...this.inventory.slice(n).map((it) => ({ ...it }))]);
    }
    return kitFrom(this.inventory, roster[id].equip);
  }

  // 整备中招募后重新推导出阵（新成员补发初始装备），之后的重建与胜利时的 joined 都用新结果
  replan() {
    const plan = planDeploy(this.stage, { roster: this.registry.get('roster') || {}, joined: this.registry.get('joined') || [], flags: this.flags });
    this.deployPlan = plan;
    this.joined = plan.joined;
    plan.pool.forEach((c) => this.kitFor(c.id, c.lvl));
    return plan;
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
    const ids = await new Promise((r) => openPrep(this, plan, r, { selected: this.campDeploy && initialDeploy(plan, this.campDeploy), replan: () => this.replan() }));
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
    this.updateMusic();
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
      start: { red: this.startState.red, flags: { ...this.startState.flags } },
      turn: this.turn,
      items: { ...this.items },
      inventory: this.inventory.map((it) => ({ ...it })),
      gold: this.gold,
      roster: this.registry.get('roster') || {},
      joined: [...this.joined],
      recruits: this.registry.get('recruits') || {},
      recruitPool: this.registry.get('recruitPool') || null,
      firedEvents: [...this.firedEvents],
      mapPatches: this.mapPatches.map((p) => [...p]),
      weatherIdx: this.weatherIdx,
      units: this.units.map(({ stats, ...u }) => ({
        ...u, status: { ...u.status }, buffs: { ...u.buffs }, equip: copyKit(u.equip), fruits: u.fruits && { ...u.fruits }, items: u.items && { ...u.items },
      })),
      summary: { lordLvl: lord.lvl },
      cheated: !!this.registry.get('cheated'),
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

  // 游戏速度：战斗内全部补间与计时器按设置倍率播放
  applySpeed() {
    this.tweens.timeScale = this.time.timeScale = SETTINGS.speed;
  }

  // 战斗设置（只显示游戏速度与音量相关的行）：弹窗期间不响应地图输入
  openSettings() {
    if (this.modal || this.over || this.dialog.root.visible) return;
    this.modal = true;
    // 敌军阶段中打开时战斗可能已结束（战果面板会自行设 modal），关闭时不要覆盖
    openSettingsMenu(this, {
      audioOnly: true,
      onClose: () => { this.applySpeed(); if (!this.over) this.modal = false; },
      onCheat: () => this.openCheat(),
    });
  }

  // 金手指面板（总开关打开时，从战斗设置进入）：修改军资金 / 道具 / 装备，直接胜利
  openCheat() {
    if (!cheatOn() || this.modal || this.over || this.dialog.root.visible) return;
    if (this.phase !== 'player' || !['idle', 'move'].includes(this.state)) {
      this.hud.log('请在我军阶段打开金手指面板');
      return;
    }
    this.clearSelection();
    this.state = 'idle';
    this.modal = true;
    openCheatMenu(this, {
      lordLvl: this.lordLvl(),
      onWin: () => this.cheatWin(),
      onClose: () => { this.hud.setItems(this.items); if (!this.over) this.modal = false; },
    });
  }

  // 直接胜利：按本关正常胜利流程结算（victory 开头即设 over，不会重复结算）
  cheatWin() {
    if (this.over || this.phase !== 'player' || this.state !== 'idle') return;
    this.clearSelection();
    this.victory('win', 'all');
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
    this.updateMusic();
    // 第 2 回合起，每到我军阶段开始天气随机变化一次（research weather.md §3）
    if (faction === 'player' && this.turn > 1) await this.changeWeather(stepWeather(this.weatherIdx));
    const mine = this.units.filter((u) => u.alive && u.faction === faction);
    if (faction !== 'player' && !mine.length && faction === 'ally') return this.nextPhase();
    // 我军阶段开始：曹操不在视口内时把镜头移过去
    if (faction === 'player') {
      const lord = mine.find((u) => u.id === 'caocao');
      if (lord) await this.follow(lord);
    }
    sfx('turn', { faction });
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
    recordTreasures([it.id]);
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
    // 金手指无敌：我军中毒不扣兵力
    const rate = u.faction === 'player' && cheatOn('cheatGod') ? 0 : this.stage.poisonRate ?? POISON_RATE;
    for (const e of tickStatus(u, undefined, rate)) {
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

  // 援军登场：从地图边缘（或 def.from）逐格走到落点，路线太远 / 走不通时原地淡入；全部到位后才返回
  async spawn(defs = []) {
    const out = [], walks = [], fades = [];
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
      const route = entryRoute(this, u, d);
      if (route) {
        const p = tileCenter(route[0].x, route[0].y);
        v.c.setPosition(p.x, p.y);
        walks.push([v, route]);
      } else fades.push(v);
      out.push(u);
    }
    if (!out.length) return out;
    // 镜头：落点与（地图内的）入场格尽量同时入镜
    await this.follow(out, walks.map(([, r]) => r.find((t) => inMap(t.x, t.y, this.map))));
    const tween = (cfg) => new Promise((r) => this.tweens.add({ ...cfg, onComplete: r }));
    await Promise.all([
      ...fades.map((v) => tween({ targets: v.c, alpha: 1, duration: 400 })),
      ...walks.map(([v, route]) => {
        this.tweens.add({ targets: v.c, alpha: 1, duration: 200 });
        return v.moveAlong(route, WALK_MS);
      }),
    ]);
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

  // 事件执行顺序：setFlag → stage 演出指令（按顺序 await）→ 援军登场 → setAi → dialog。
  // stage 中写 { spawn: true } 可把援军登场（及 setAi）提前到该位置；指令可带 ifFlag / unlessFlag；演出期间禁止输入
  async runEvent(i, ev) {
    this.firedEvents.add(i);
    if (ev.setFlag) this.setFlag(ev.setFlag);
    const prev = this.state;
    this.state = 'busy';
    let spawned = false;
    const arrive = async () => {
      if (spawned) return;
      spawned = true;
      await this.spawn(ev.units);
      for (const [id, ai] of Object.entries(ev.setAi || {})) {
        const u = this.units.find((o) => o.id === id && o.alive);
        if (u) u.ai = ai;
      }
    };
    for (const cmd of ev.stage || []) {
      if (!this.flagOk(cmd)) continue;
      try {
        if (cmd.spawn) await arrive();
        else await stageCmd(this, cmd);
      } catch (e) {
        console.error('战场演出出错', cmd, e);
      }
    }
    await arrive();
    await this.dialog.show(ev.dialog);
    this.state = prev;
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
    this.inDuel = true;
    playMusic('duel', { maxWait: 0.4 });
    try {
      await playDuel(this, a, b, ev);
    } finally {
      // 单挑结束：恢复战斗曲（或危急曲）
      this.inDuel = false;
      this.updateMusic();
    }
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
    this.updateMusic();
    return false;
  }

  async victory(outcome = 'win', via = 'all') {
    this.over = true;
    this.state = 'busy';
    this.clearSelection();
    const annihilated = !this.units.some((u) => u.alive && u.faction === 'enemy');
    playMusic('victory', { maxWait: 0.5 });
    await this.hud.banner(outcome === 'retreat' ? '撤　退' : '胜　利', '#ffe08a');
    // 胜利时按单位存亡设置剧情标记（例如郭嘉未撤退则战后病逝），先于结尾对白，便于对白按标记分支
    for (const r of this.stage.victoryFlags || []) {
      const u = this.units.find((o) => o.id === r.unit);
      if (u && u.alive === r.alive && (!r.outcome || r.outcome === outcome)) this.setFlag(r.flag);
    }
    // 结尾场景：叠加在战场上演出（对白按 annihilate → epilogues[outcome] → epilogue 选择，见 story/auto.postLines）；
    // 场景中的选项写入 registry，播完同步回本场景（影响奖励、自动存档与路线）
    this.registry.set('red', this.red);
    this.registry.set('flags', { ...this.flags });
    await playPost(this, { outcome, annihilated });
    this.red = this.registry.get('red') ?? this.red;
    this.flags = { ...(this.registry.get('flags') || this.flags) };
    // 分路关卡（马超迎击战）：中间路线剧情走奸雄线，记标记 route_middle，终关胜利后显示中间路线结局
    if (this.stage.next?.route) {
      if (routeOf(this.red) === 'middle') this.flags.route_middle = true;
      else delete this.flags.route_middle;
      this.registry.set('flags', { ...this.flags });
    }
    this.hud.setRed(this.red);
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
    // 击破掉落已在 dropLoot 登记，这里只登记关卡奖励
    recordTreasures(gear.slice(this.gained.length).map((it) => it.id));
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
    // 自动存档：下一关存在时（goNext 进营中）写营中存档，读取后回到营中；没有下一关（结局）时保持关卡开头类型
    const toCamp = !!(next && getStage(next) && next !== FIRST_STAGE);
    // 下一关的招募候选在此生成并写入自动存档：读取营中存档不会换批、不会重置刷新次数
    if (toCamp) ensurePool(this.registry, next);
    if (!this.stage.debug) writeAuto({
      stage: next, roster, joined, items, difficulty: this.difficultyId, red: this.red, flags: { ...this.flags },
      inventory: this.inventory, gold: this.gold, summary: { lordLvl },
      recruits: this.registry.get('recruits') || {}, recruitPool: this.registry.get('recruitPool') || null,
      cheated: !!this.registry.get('cheated'),
      ...(toCamp ? { talked: [], deploy: null } : {}),
    }, toCamp ? 'camp' : 'stage');
    const supplies = { ...this.difficulty.reward };
    if (seal) supplies.seal = (supplies.seal || 0) + 1;
    supplies[loot] = (supplies[loot] || 0) + 1;
    this.modal = true;
    playMusic('victory');
    await openRewards(this, { gold, gear, items: supplies });
    goNext(this, next);
  }

  async defeat(reason) {
    this.over = true;
    this.state = 'busy';
    this.clearSelection();
    this.hud.log(reason);
    playMusic('defeat', { maxWait: 0.5 });
    await this.hud.banner('败　北', '#ff8a7a');
    const cx = VIEW_W / 2, cy = MAP_Y + 300;
    this.add.rectangle(0, 0, 2000, 2000, 0x000000, 0.55).setOrigin(0).setDepth(900).setInteractive();
    text(this, cx, cy - 70, reason, 26, '#f1e3c2', FONT).setOrigin(0.5).setDepth(901);
    button(this, cx - 170, cy, 150, 48, '重新挑战', () => this.retry()).setDepth(901);
    button(this, cx + 20, cy, 150, 48, '返回标题', () => this.scene.start('Title')).setDepth(901);
  }

  // 重新挑战：不重播开场场景，红色指数与标记恢复为本关开头的值（战斗事件会重新触发）
  retry() {
    this.registry.set('red', this.startState.red);
    this.registry.set('flags', { ...this.startState.flags });
    this.scene.start('Battle', { stage: this.stageId, skipStory: true, deploy: this.campDeploy });
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
      if (u && u.faction === 'player' && !u.acted) { sfx('select'); this.select(u); }
      else if (u) { sfx('select'); this.inspect(u); }
      else this.hl.clear();
    } else if (this.state === 'move') {
      const node = this.sel.range.get(key(t.x, t.y));
      if (node) this.moveSelected(node);
      else if (u && u !== this.sel.unit) { this.clearSelection(); this.state = 'idle'; this.onClick(p); }
      else this.cancel();
    } else if (this.state === 'target') {
      const inRange = this.sel.targets.some((o) => o.x === t.x && o.y === t.y);
      // 触屏：第一次点击只预览（onHover 已显示预测与范围），再点同一格才执行；点了别的格子则重新预览
      const aimed = this.touchAim === key(t.x, t.y);
      this.aimAt(null);
      if (inRange && u && this.validTarget(u)) {
        if (p.wasTouch && !aimed) { this.aimAt(t); return; }
        this.execute(u);
      }
      else if (inRange && u && this.sel.action.kind === 'spell' && isFoe(u, this.sel.unit) && SPELLS[this.sel.action.id].target === 'foe') this.hud.log(spellBlock(this.map, this.sel.action.id, u.x, u.y) || '无法以此为目标');
      else if (inRange && u && this.sel.action.kind === 'item' && ITEMS[this.sel.action.id].promote && !isFoe(u, this.sel.unit)) this.hud.log(promoteBlock(u));
    }
  }

  cancel() {
    if (this.modal) return;
    this.aimAt(null);
    if (['move', 'menu', 'target'].includes(this.state)) sfx('cancel');
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

  // 触屏选目标：记下第一次点击的目标格，并在格子上方标“再点确认”（地图层，不占右侧预测区）；t 为 null 时清除
  aimAt(t) {
    this.touchAim = t ? key(t.x, t.y) : null;
    this.aimTag?.destroy();
    this.aimTag = null;
    if (!t) return;
    const c = tileCenter(t.x, t.y), top = t.y === 0;
    this.aimTag = text(this, c.x, c.y + (top ? TILE / 2 : -TILE / 2), '再点确认', 14, '#ffe08a', FONT)
      .setOrigin(0.5, top ? 0 : 1).setStroke('#000', 4).setDepth(40);
  }

  clearSelection() {
    this.aimAt(null);
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
    this.hud.forecast(`策略值 ${u.mp}/${u.stats.mp}　天气 ${WEATHERS[this.weather]}　共 ${spells.length} 种策略\n${IS_TOUCH ? '选择策略后显示说明' : '将鼠标移到策略上查看说明'}`);
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
    this.hud.forecast(IS_TOUCH ? '选择道具后显示说明' : '将鼠标移到道具上查看说明');
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
    this.aimAt(null);
    const healish = kind === 'item' || (kind === 'spell' && SPELLS[id].target !== 'foe');
    this.paint(tiles, healish ? 0x40e080 : 0xff3a2a, 0.22);
    this.paint(tiles.filter((t) => { const o = this.unitAt(t.x, t.y); return o && this.validTarget(o); }), healish ? 0x40e080 : 0xff3a2a, 0.45);
    // 触屏没有悬停：把策略 / 道具说明放进选目标提示
    const desc = kind === 'spell' ? `【${SPELLS[id].name}】${SPELLS[id].desc}\n` : kind === 'item' ? `【${ITEMS[id].name}】${ITEMS[id].desc}\n` : '';
    this.hud.forecast(IS_TOUCH ? `${desc}请选择目标（点目标预览，再点一次确认）` : '请选择目标（右键取消）');
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
    // 金手指无限行动：我军行动后不置灰，可再次移动与行动，需手动结束回合
    const again = u.faction === 'player' && cheatOn('cheatMove') && canAct(u);
    if (!again) u.acted = true;
    if (u.alive) this.views.get(u)?.setActed(u.acted);
    await this.tryEscape(u);
    if (await this.checkEnd()) return;
    this.state = 'idle';
    if (again) return;
    if (!this.units.some((o) => o.alive && o.faction === 'player' && !o.acted)) {
      await wait(this, 300);
      this.endPlayerPhase();
    }
  }
}
