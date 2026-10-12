import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, RES, SETTINGS, IS_TOUCH } from './config.js';
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
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: 'game' },
  // 不用 Phaser 的声音系统（没有音频文件，声音由 src/audio 实时合成），避免多建一个 AudioContext
  audio: { noAudio: true },
  // StoryScene 排在 BattleScene 之后：结尾场景叠加在战场之上播放；CampScene 为两关之间的营中
  scene: [TitleScene, BattleScene, StoryScene, CampScene, EndingScene],
});

// 触屏设备：首次触摸（touchend 才算浏览器认可的用户操作）时尝试全屏，进入全屏后锁定横屏；不支持时静默忽略
if (IS_TOUCH) {
  const scale = window.game.scale;
  scale.once(Phaser.Scale.Events.ENTER_FULLSCREEN, () => { try { screen.orientation?.lock?.('landscape')?.catch(() => {}); } catch (e) { /* 不支持 */ } });
  // 等同 scale.startFullscreen()，但接住 requestFullscreen 返回的 Promise（被拒时不产生未处理的 rejection）；进入全屏后 Phaser 的 fullscreenchange 监听照常 refresh 并发出 ENTER_FULLSCREEN
  window.addEventListener('touchend', () => {
    const fs = scale.fullscreen, el = scale.fullscreenTarget;
    if (!fs?.available || fs.active || !el) return;
    try { el[fs.request]({ navigationUI: 'hide' })?.catch?.(() => {}); } catch (e) { /* 不支持 */ }
  }, { once: true });
  // iOS Safari 忽略 user-scalable=no，双指缩放要阻止 gesturestart
  document.addEventListener('gesturestart', (e) => e.preventDefault());
}

// 帧率角标：DOM 叠加，与场景无关
if (SETTINGS.showFps) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:4px;left:6px;z-index:10;font:12px monospace;color:#9ce0a8;background:rgba(0,0,0,.5);padding:1px 5px;pointer-events:none';
  document.body.appendChild(el);
  setInterval(() => { el.textContent = `FPS ${Math.round(window.game.loop.actualFps)}`; }, 500);
}
