import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, hiDpi } from '../config.js';
import { button, text } from '../ui.js';
import { clearAuto } from '../saves.js';
import { playMusic } from '../audio/music.js';

// 两种结局：忠臣线（魔王复活）/ 奸雄线（天下统一）
const ENDING_TEXT = {
  loyal: [
    '五丈原一役，魔王终被击退，天下重归太平。',
    '曹操扶持汉室，不改臣节，',
    '与诸侯共守大汉江山。',
    '',
    '对酒当歌，人生几何。',
    '周公吐哺，天下归心。',
    '',
    '— 忠臣篇 · 全剧终 —',
  ],
  villain: [
    '建业城破，江东归附，',
    '曹操扫平群雄，一统天下。',
    '乱世百年，至此终结。',
    '',
    '老骥伏枥，志在千里；',
    '烈士暮年，壮心不已。',
    '',
    '— 奸雄篇 · 全剧终 —',
  ],
};

export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  init(data) {
    this.route = data?.route || 'villain';
  }

  create() {
    hiDpi(this);
    playMusic('ending', { fadeIn: 1.5, fadeOut: 2 });
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120a06).setOrigin(0);
    const lines = ENDING_TEXT[this.route] || ENDING_TEXT.villain;
    const t = text(this, WIDTH / 2, HEIGHT + 20, lines.join('\n'), 30, '#f1e3c2', FONT).setOrigin(0.5, 0).setAlign('center').setLineSpacing(16);
    this.tweens.add({ targets: t, y: 90, duration: 9000, ease: 'Sine.easeOut' });
    clearAuto();
    this.time.delayedCall(6000, () => {
      button(this, WIDTH / 2 - 100, HEIGHT - 90, 200, 50, '返回标题', () => this.scene.start('Title'), 22);
    });
  }
}
