import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, SETTINGS } from './config.js';
import { TitleScene } from './scenes/TitleScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { StoryScene } from './scenes/StoryScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { CampScene } from './scenes/CampScene.js';
import { initAudio } from './audio/engine.js';
import { audition } from './audio/instruments.js';
import { sfx } from './audio/sfx.js';
import { playMusic, stopMusic, currentMusic } from './audio/music.js';

// 音频：实时合成，首次点击 / 按键后解锁；音量取自游戏设置
initAudio(SETTINGS);
// 调试：__audioTest('zheng') 试听音色（不传参依次试听全部），__sfxTest('attack', { weapon: 'spear' }) 触发音效
window.__audioTest = audition;
window.__sfxTest = sfx;
// 调试：__musicTest('battle1') 播放场合 / 曲目（不传参时停止），__musicNow() 当前曲目 id
window.__musicTest = (name) => (name ? playMusic(name) : stopMusic());
window.__musicNow = currentMusic;

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH * RES,
  height: HEIGHT * RES,
  backgroundColor: '#0d0a07',
  antialias: SETTINGS.quality !== 'low',
  fps: { limit: SETTINGS.fps },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // 不用 Phaser 的声音系统（没有音频文件，声音由 src/audio 实时合成），避免多建一个 AudioContext
  audio: { noAudio: true },
  // StoryScene 排在 BattleScene 之后：结尾场景叠加在战场之上播放；CampScene 为两关之间的营中
  scene: [TitleScene, BattleScene, StoryScene, CampScene, EndingScene],
});

// 帧率角标：DOM 叠加，与场景无关
if (SETTINGS.showFps) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:4px;left:6px;z-index:10;font:12px monospace;color:#9ce0a8;background:rgba(0,0,0,.5);padding:1px 5px;pointer-events:none';
  document.body.appendChild(el);
  setInterval(() => { el.textContent = `FPS ${Math.round(window.game.loop.actualFps)}`; }, 500);
}
