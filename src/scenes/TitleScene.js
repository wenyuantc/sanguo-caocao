import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, COLORS, IS_TOUCH, hiDpi } from '../config.js';
import { button, text, panel } from '../ui.js';
import { DIFFICULTIES } from '../data.js';
import { applyLoad } from '../saves.js';
import { FIRST_STAGE, getStage } from '../stages.js';
import { openSaveMenu } from '../saveMenu.js';
import { openSettingsMenu } from '../settingsMenu.js';
import { goStage, goCamp } from '../story/flow.js';
import { planDeploy } from '../deploy.js';
import { setRecruits } from '../generals.js';
import { START_GOLD } from '../recruit.js';
import { DEMO_SCENES } from '../story/demo.js';
import { engine } from '../audio/engine.js';
import { playMusic } from '../audio/music.js';
import { readLegacy, ENDING_ROUTES, ENDING_INFO, TREASURES } from '../legacy.js';
import { EQUIP, SLOT_NAME, gearDesc } from '../equipment.js';
import { ensureTextures, gearIcon } from '../spellFx.js';

// 调试入口只在页面加载后第一次进入标题时生效（返回标题后正常显示）
let debugEntered = false;
// 首次进入标题时提示“点击开始”：浏览器要求用户操作后才能出声，借这次点击解锁音频
let started = false;

export class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    hiDpi(this);
    // 调试入口（只在首次进入标题时生效）：
    //   ?stage=<关卡 id>（如 test_bigmap）以普通难度新开该关（先播开场场景）；加 &story=0 跳过开场场景直接整备
    //   ?scene=<关卡 id>:pre|post 预览该关的开场 / 结尾场景（新游戏状态，播完回到标题），可加 &flags=a,b 预设剧情标记以预览分支；
    //   ?scene=demo / gallery / poses 播放演示场景
    //   ?camp=<关卡 id> 以普通难度进入该关之前的营中（已加入的武将取该关的候选名单），可加 &flags=a,b
    const q = new URLSearchParams(location.search);
    const debugCamp = !debugEntered && q.get('camp');
    if (debugCamp && getStage(debugCamp)) {
      debugEntered = true;
      this.resetCampaign('normal');
      const flags = (q.get('flags') || '').split(',').map((f) => f.trim()).filter(Boolean);
      if (flags.length) this.registry.set('flags', Object.fromEntries(flags.map((f) => [f, true])));
      this.registry.set('joined', planDeploy(getStage(debugCamp), { flags: this.registry.get('flags') }).pool.map((c) => c.id));
      goCamp(this, debugCamp);
      return;
    }
    const debugStage = !debugEntered && q.get('stage');
    if (debugStage && getStage(debugStage)) {
      debugEntered = true;
      this.newGame('normal', debugStage, q.get('story') === '0');
      return;
    }
    const preview = !debugEntered && q.get('scene');
    if (preview) {
      debugEntered = true;
      const [id, part = 'pre'] = preview.split(':');
      if (DEMO_SCENES[id] || getStage(id)) {
        this.resetCampaign('normal');
        const flags = (q.get('flags') || '').split(',').map((f) => f.trim()).filter(Boolean);
        if (flags.length) this.registry.set('flags', Object.fromEntries(flags.map((f) => [f, true])));
        this.scene.start('Story', DEMO_SCENES[id] ? { demo: id, part: 'preview' } : { stage: id, part: part === 'post' ? 'post' : 'preview', outcome: q.get('outcome') || 'win', annihilated: q.get('annihilate') === '1' });
        return;
      }
    }
    // 标题曲：音频未解锁时先登记，首次点击解锁后自动开始（渐入）
    playMusic('title', { fadeIn: 1.5 });
    const g = this.add.graphics();
    // 背景：暮色渐变 + 远山
    for (let i = 0; i < 40; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x3a1a10), Phaser.Display.Color.ValueToColor(0xc8783a), 39, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, (i * HEIGHT) / 40, WIDTH, HEIGHT / 40 + 1);
    }
    g.fillStyle(0xf6d58a, 0.9).fillCircle(WIDTH * 0.72, HEIGHT * 0.42, 70);
    const ridge = (base, amp, color, seed) => {
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 20) g.lineTo(x, base - Math.abs(Math.sin(x * 0.006 + seed) * amp) - Math.sin(x * 0.02 + seed) * amp * 0.2);
      g.lineTo(WIDTH, HEIGHT);
      g.closePath();
      g.fillPath();
    };
    ridge(HEIGHT * 0.66, 90, 0x5a2e1c, 1);
    ridge(HEIGHT * 0.76, 70, 0x3a1e12, 3);
    ridge(HEIGHT * 0.88, 40, 0x1e100a, 5);
    // 旌旗
    for (let i = 0; i < 9; i++) {
      const x = 80 + i * 120 + (i % 2) * 30, y = HEIGHT * 0.86 - (i % 3) * 14;
      g.fillStyle(0x1a0c06, 1).fillRect(x, y - 70, 3, 70);
      g.fillStyle(i % 3 === 0 ? COLORS.player : 0x8a1a12, 1).fillRect(x + 3, y - 70, 26, 34);
    }
    text(this, WIDTH / 2, 150, '三國志', 54, '#f6e7c1', FONT).setOrigin(0.5).setStroke('#2a1200', 8);
    const title = text(this, WIDTH / 2, 230, '曹 操 傳', 96, '#ffd36a', FONT).setOrigin(0.5).setStroke('#3a1200', 12);
    title.setShadow(4, 4, '#000', 8, true, true);
    this.tweens.add({ targets: title, scale: { from: 0.96, to: 1.02 }, yoyo: true, repeat: -1, duration: 1800, ease: 'Sine.easeInOut' });
    text(this, WIDTH / 2, 310, '— Phaser 4 战棋复刻版 —', 20, '#f1e3c2', FONT).setOrigin(0.5);
    this.drawBirds();
    if (started || engine.unlocked) this.showMenu();
    else this.pressStart();
  }

  // 点击开始：首次点击 / 按键后解锁音频，再显示菜单
  pressStart() {
    const hint = text(this, WIDTH / 2, 470, '— 点 击 开 始 —', 28, '#ffe08a', FONT).setOrigin(0.5).setStroke('#2a1200', 6);
    this.tweens.add({ targets: hint, alpha: 0.25, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut' });
    const go = () => {
      if (started) return;
      started = true;
      engine.unlock();
      this.input.off('pointerdown', go);
      this.input.keyboard?.off('keydown', go);
      hint.destroy();
      // 延后一帧显示菜单，避免这次点击落到新出现的按钮上
      this.time.delayedCall(0, () => this.showMenu());
    };
    this.input.on('pointerdown', go);
    this.input.keyboard?.on('keydown', go);
    this.events.once('shutdown', () => { this.input.off('pointerdown', go); this.input.keyboard?.off('keydown', go); });
  }

  // 结局标记（原版标题下的鸟）：红 = 奸雄、黄 = 中间路线、蓝 = 忠臣；未达成为暗色剪影
  drawBirds() {
    const lg = readLegacy();
    ENDING_ROUTES.forEach((r, i) => {
      const got = !!lg.endings[r];
      const g = this.add.graphics().setPosition(WIDTH / 2 + (i - 1) * 64, 346);
      const col = got ? ENDING_INFO[r].color : 0x2a1a10, a = got ? 1 : 0.45;
      g.fillStyle(col, a);
      // 双翼上扬，身体、头、尾
      g.fillTriangle(-3, 0, -24, -13, -13, 3);
      g.fillTriangle(-12, -6, -26, -9, -20, -2);
      g.fillTriangle(3, 0, 24, -13, 13, 3);
      g.fillTriangle(12, -6, 26, -9, 20, -2);
      g.fillEllipse(0, 2, 10, 15);
      g.fillCircle(0, -6, 4);
      g.fillTriangle(-5, 7, 5, 7, 0, 15);
      if (got) {
        g.lineStyle(1, 0xfff2c0, 0.7).strokeEllipse(0, 2, 10, 15);
        this.tweens.add({ targets: g, y: 340, yoyo: true, repeat: -1, duration: 1400 + i * 200, ease: 'Sine.easeInOut' });
      }
    });
  }

  // 宝物图鉴：曾经得到过的宝物（永久记录，不随存档），未收集的显示剪影
  openCodex() {
    ensureTextures(this);
    const lg = readLegacy();
    const root = this.add.container(0, 0).setDepth(3000);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
    shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
    const w = 940, h = 620, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
    root.add([shade, panel(this, x0, y0, w, h, 0.98)]);
    root.add(text(this, WIDTH / 2, y0 + 32, '宝 物 图 鉴', 28, '#ffd36a', FONT).setOrigin(0.5));
    const got = TREASURES.filter((id) => lg.codex.includes(id)).length;
    root.add(text(this, x0 + 30, y0 + 64, `已收集　${got} / ${TREASURES.length}`, 18, got === TREASURES.length ? '#ffd36a' : '#f1e3c2'));
    root.add(text(this, x0 + w - 30, y0 + 64, ENDING_ROUTES.map((r) => `${ENDING_INFO[r].name}${lg.endings[r] ? '　已达成' : '　未达成'}`).join('　｜　'), 16, '#bfae88').setOrigin(1, 0));
    const info = text(this, WIDTH / 2, y0 + 524, IS_TOUCH ? '点击宝物查看说明' : '将鼠标移到宝物上查看说明', 16, '#bfae88').setOrigin(0.5, 0).setAlign('center').setWordWrapWidth(w - 60);
    root.add(info);
    const cw = 88, ch = 86, gx = x0 + (w - cw * 10) / 2, gy = y0 + 94;
    TREASURES.forEach((id, i) => {
      const e = EQUIP[id], known = lg.codex.includes(id);
      const cx = gx + (i % 10) * cw, cy = gy + Math.floor(i / 10) * ch;
      const icon = this.add.image(cx + cw / 2, cy + 28, gearIcon(id)).setScale(48 / 72);
      if (!known) icon.setTint(0x000000).setAlpha(0.5);
      const name = text(this, cx + cw / 2, cy + 58, known ? e.name : '？？？', 13, known ? '#f1e3c2' : '#7a6a50').setOrigin(0.5, 0);
      const zone = this.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive();
      zone.on('pointerover', () => info.setText(known ? `${e.name}（${SLOT_NAME[e.slot]}）　Lv9：${gearDesc(id, 9)}` : '尚未取得').setColor(known ? '#f1e3c2' : '#bfae88'));
      root.add([icon, name, zone]);
    });
    const close = () => { this.input.keyboard?.off('keydown-ESC', close); root.destroy(); };
    root.add(button(this, WIDTH / 2 - 60, y0 + h - 56, 120, 40, '关　闭', close, 18));
    this.input.keyboard?.on('keydown-ESC', close);
  }

  showMenu() {
    button(this, WIDTH - 170, 20, 150, 42, '宝物图鉴', () => this.openCodex(), 18);
    button(this, WIDTH / 2 - 110, 380, 220, 52, '新 的 征 程', () => this.chooseDifficulty(), 24);
    button(this, WIDTH / 2 - 110, 446, 220, 52, '读 取 进 度', () => {
      openSaveMenu(this, { mode: 'load', onLoad: (data) => applyLoad(this, data) });
    }, 24);
    button(this, WIDTH / 2 - 110, 512, 220, 52, '游 戏 设 置', () => openSettingsMenu(this), 24);
    text(this, WIDTH / 2, HEIGHT - 70,
      `${IS_TOUCH ? '点击：选择 / 移动 / 指令　取消按钮：取消　选目标时再点一次确认　拖动地图滚动' : '左键：选择 / 移动 / 指令　右键或 ESC：取消'}　骑兵克步兵，步兵克弓兵，弓兵克骑兵`, 16, '#e8d6ae').setOrigin(0.5);
  }

  // 新游戏：重置全部战役状态后进入 stage（先播开场场景；skipStory 为调试用，直接进入整备）；等级、装备、金钱不跨周目继承
  newGame(id, stage, skipStory = false) {
    this.resetCampaign(id);
    if (skipStory) this.scene.start('Battle', { stage, skipStory: true });
    // 第一关开场：已达成结局或图鉴集满时，许劭给出二周目选项（legacy.js）
    else goStage(this, stage, { ngplus: stage === FIRST_STAGE });
  }

  resetCampaign(id) {
    this.registry.set('difficulty', id);
    this.registry.set('roster', {});
    this.registry.set('joined', []);
    this.registry.set('items', { ...DIFFICULTIES[id].items });
    this.registry.set('red', 0);
    this.registry.set('flags', {});
    this.registry.set('inventory', []);
    this.registry.set('gold', START_GOLD);
    this.registry.set('recruits', {});
    this.registry.set('recruitPool', null);
    setRecruits({});
  }

  // 难度选择
  chooseDifficulty() {
    const root = this.add.container(0, 0).setDepth(3000);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
    shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
    const w = 860, h = 440, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
    root.add([shade, panel(this, x0, y0, w, h, 0.98)]);
    root.add(text(this, WIDTH / 2, y0 + 36, '选 择 难 度', 30, '#ffd36a', FONT).setOrigin(0.5));
    const close = () => { this.input.keyboard?.off('keydown-ESC', close); root.destroy(); };
    Object.entries(DIFFICULTIES).forEach(([id, d], i) => {
      const cw = 250, ch = 290, cx = x0 + 30 + i * (cw + 30), cy = y0 + 74;
      const col = Phaser.Display.Color.HexStringToColor(d.color).color;
      const g = this.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(hover ? 0x4a2e14 : 0x22160c, 1).fillRoundedRect(cx, cy, cw, ch, 10);
        g.lineStyle(hover ? 3 : 2, col, hover ? 1 : 0.6).strokeRoundedRect(cx, cy, cw, ch, 10);
        g.fillStyle(col, hover ? 0.25 : 0.12).fillRoundedRect(cx + 4, cy + 4, cw - 8, 78, 8);
      };
      draw(false);
      const zone = this.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation?.();
        close();
        this.newGame(id, FIRST_STAGE);
      });
      root.add([g, zone,
        text(this, cx + cw / 2, cy + 43, d.name, 40, d.color, FONT).setOrigin(0.5).setStroke('#000', 5),
        text(this, cx + 24, cy + 102, d.desc.join('\n'), 17, '#f1e3c2').setLineSpacing(14)]);
    });
    root.add(button(this, WIDTH / 2 - 60, y0 + h - 62, 120, 42, '返　回', close, 18));
    this.input.keyboard?.on('keydown-ESC', close);
  }
}
