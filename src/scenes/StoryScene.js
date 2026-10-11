import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, hiDpi } from '../config.js';
import { button, text } from '../ui.js';
import { getStage } from '../stages.js';
import { StoryDialog, StoryRunner } from '../story/runner.js';
import { sceneFor } from '../story/auto.js';
import { isoToScreen } from '../story/defs.js';
import { DEMO_SCENES } from '../story/demo.js';
import { afterPre } from '../story/flow.js';
import { playMusic } from '../audio/music.js';

// 剧情场景：执行场景脚本（手写 scenes 或由 prologue / epilogue 自动生成），结束后按 flow.js 跳转。
// data：{ stage, part: 'pre' | 'post' | 'preview', outcome?, annihilated?, onDone?（叠加在战场上播放时的回调）, script?, demo?, notice?, deploy?（营中选好的出阵武将，转交战场） }
// 两台相机：主相机渲染场景层（depth < 1000：背景、人物、地图标记、黑幕），可推近；界面相机渲染对白、标题、按钮。
// 加速：按住鼠标 / Ctrl 时 5 倍速并自动推进对白，单击后短暂 3 倍速；“跳过演出”快速播完（选项仍需选择）。场景中不能存档。
export class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }

  init(data) {
    this.opts = data || {};
    this.stopped = false;
    this.finished = false;
    this.skip = false;
    this.speed = 0;
    this.boostUntil = 0;
    this.wasDown = false;
    this.lastAdv = 0;
    this.bgCount = 0;
  }

  create() {
    hiDpi(this);
    const o = this.opts;
    this.stage = o.stage ? getStage(o.stage) : null;
    this.tweens.timeScale = this.time.timeScale = 1;
    // 场景层镜头（camera 指令补间 stageCam，再由 applyCam 应用）
    this.stageCam = { z: 1, x: WIDTH / 2, y: HEIGHT / 2 };
    this.ui = this.cameras.add(0, 0, WIDTH * RES, HEIGHT * RES).setZoom(RES).centerOn(WIDTH / 2, HEIGHT / 2);
    this.sortCams = () => {
      const m = this.cameras.main.id, u = this.ui.id;
      for (const go of this.children.list) go.cameraFilter = go.depth >= 1000 ? m : u;
    };
    this.events.on('prerender', this.sortCams);
    this.events.once('shutdown', () => this.cleanup());

    this.dialog = new StoryDialog(this);
    this.dialog.onChoice = (c) => this.applyChoice(c);
    this.runner = new StoryRunner(this);
    this.makeControls();

    let script = [];
    try {
      script = o.script || (o.demo && DEMO_SCENES[o.demo]) || (this.stage ? sceneFor(this.stage, o.part === 'preview' ? 'pre' : o.part, o) : []);
    } catch (e) {
      // 生成脚本出错时不演出，直接按流程继续（叠加在战场上时，战场仍会恢复）
      console.error('剧情场景脚本生成出错', e);
    }
    if (o.notice) script = [{ narr: o.notice }, ...script];
    this.runner.run(script)
      .catch((e) => console.error('剧情演出出错', e))
      .finally(() => this.finish());
  }

  // 配乐随背景切换：中国地图为剧情曲；开场（军议）其余背景为军议曲；结尾的主营为军营曲、其余为剧情曲
  musicFor(bg) {
    const o = this.opts;
    if (bg === 'china' || o.demo) return 'story';
    if (o.part === 'post') return bg === 'tent' || bg === 'camp' ? 'camp' : 'story';
    return 'council';
  }

  // runner 换背景时调用。叠加在战场上的结尾场景：第一张背景沿用胜利曲，之后再按背景切换
  onBg(bg) {
    if (this.bgCount++ === 0 && this.opts.part === 'post' && this.opts.onDone) return;
    playMusic(this.musicFor(bg));
  }

  iso(a, b) {
    return isoToScreen(a, b);
  }

  applyCam() {
    const c = this.stageCam;
    this.cameras.main.setZoom(RES * c.z).centerOn(c.x, c.y);
  }

  // ---------- 战役状态 ----------
  flagOk(d) {
    const flags = this.registry.get('flags') || {};
    return (!d?.ifFlag || flags[d.ifFlag]) && (!d?.unlessFlag || !flags[d.unlessFlag]);
  }

  // 剧情选项：与 BattleScene.applyChoice 相同，累加红色指数、设置标记（直接写入 registry）
  applyChoice(c) {
    if (c.red) this.registry.set('red', (this.registry.get('red') || 0) + c.red);
    if (c.flag) this.registry.set('flags', { ...(this.registry.get('flags') || {}), [c.flag]: true });
  }

  // ---------- 加速 / 跳过 ----------
  makeControls() {
    this.skipBtn = button(this, WIDTH - 150, 14, 132, 38, '跳过演出', () => this.skipAll(), 17).setDepth(1600);
    this.hint = text(this, WIDTH - 160, 33, '按住鼠标加速', 14, '#e8d6ae').setOrigin(1, 0.5).setDepth(1600).setStroke('#000', 3);
    const adv = () => { if (!this.dialog.choiceBox) this.dialog.next(); };
    this.keys = this.input.keyboard?.addKeys('CTRL');
    this.input.keyboard?.on('keydown-SPACE', adv);
    this.input.keyboard?.on('keydown-ENTER', adv);
  }

  skipAll() {
    this.skip = true;
    this.skipBtn.setDisabled(true);
    this.hint.setText('跳过中……');
  }

  update(time) {
    const p = this.input.activePointer;
    const down = p.isDown || !!this.keys?.CTRL.isDown;
    if (down && !this.wasDown) { this.downAt = time; this.boostUntil = time + 600; }
    this.wasDown = down;
    const holding = down && time - this.downAt > 220;
    const speed = this.skip ? 60 : holding ? 5 : time < this.boostUntil ? 3 : 1;
    if (speed !== this.speed) {
      this.speed = speed;
      this.tweens.timeScale = speed;
      this.time.timeScale = speed;
    }
    // 跳过 / 按住时自动推进对白（遇到选项停下，等玩家选择）
    if ((this.skip || holding) && this.dialog.resolve && !this.dialog.choiceBox && time - this.lastAdv > (this.skip ? 0 : 110)) {
      this.lastAdv = time;
      this.dialog.next();
    }
  }

  // ---------- 结束 ----------
  finish() {
    if (this.finished || this.stopped) return;
    this.finished = true;
    const o = this.opts;
    if (o.onDone) {
      // 等本场景真正关闭（shutdown 清理完）后再回调，回调里立刻再开剧情场景也不会被这次关闭打断
      this.events.once('shutdown', () => o.onDone());
      this.scene.stop();
      return;
    }
    if (o.part === 'pre' && this.stage) { afterPre(this, this.stage.id, o.deploy); return; }
    this.scene.start('Title'); // 预览 / 演示
  }

  cleanup() {
    this.stopped = true;
    this.events.off('prerender', this.sortCams);
    this.runner?.destroy();
    this.tweens.timeScale = this.time.timeScale = 1;
    for (const k of this.textures.getTextureKeys()) if (k.startsWith('st-') || k.startsWith('sbg-')) this.textures.remove(k);
  }
}
