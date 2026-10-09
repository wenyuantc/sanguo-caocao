import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, hiDpi } from '../config.js';
import { button, text } from '../ui.js';
import { clearAuto } from '../saves.js';

export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  create() {
    hiDpi(this);
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x120a06).setOrigin(0);
    const lines = [
      '濮阳一役，曹操终退吕布，重定兖州。',
      '此后迎天子于许都，挟天子以令诸侯，',
      '官渡破袁绍，北征定乌桓，统一中原。',
      '',
      '对酒当歌，人生几何。',
      '周公吐哺，天下归心。',
      '',
      '— 全剧终 —',
    ];
    const t = text(this, WIDTH / 2, HEIGHT + 20, lines.join('\n'), 30, '#f1e3c2', FONT).setOrigin(0.5, 0).setAlign('center').setLineSpacing(16);
    this.tweens.add({ targets: t, y: 90, duration: 9000, ease: 'Sine.easeOut' });
    clearAuto();
    this.time.delayedCall(6000, () => {
      button(this, WIDTH / 2 - 100, HEIGHT - 90, 200, 50, '返回标题', () => this.scene.start('Title'), 22);
    });
  }
}
