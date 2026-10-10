import { WIDTH, HEIGHT, FONT } from './config.js';
import { portrait, text, wait } from './ui.js';
import { killUnit } from './actions.js';

// 单挑过场：双方头像对峙、三回合交锋，胜者一击定胜负
// ev: { duel: { a, b, winner: 'a'|'b', result: 'kill'|'hurt'|'draw' }, dialog: 单挑前对白, after: 单挑后对白 }
const tween = (s, cfg) => new Promise((r) => s.tweens.add({ ...cfg, onComplete: r }));

export async function playDuel(s, ua, ub, ev) {
  const { winner = 'a', result = 'kill' } = ev.duel;
  const root = s.add.container(0, 0).setDepth(950);
  const shade = s.add.rectangle(0, 0, WIDTH, HEIGHT, 0x0a0604, 0.82).setOrigin(0).setInteractive();
  const band = s.add.rectangle(WIDTH / 2, HEIGHT / 2 - 40, WIDTH, 260, 0x3a1a0a, 0.65);
  const title = text(s, WIDTH / 2, 70, '单　挑', 46, '#ffd36a', FONT).setOrigin(0.5).setStroke('#5a1000', 8).setScale(2).setAlpha(0);
  const size = 190, cy = HEIGHT / 2 - 50;
  const pa = portrait(s, -200, cy, ua.name, ua.faction, size);
  const pb = portrait(s, WIDTH + 200, cy, ub.name, ub.faction, size);
  const vs = text(s, WIDTH / 2, cy, 'VS', 40, '#ffffff', FONT).setOrigin(0.5).setStroke('#7a1200', 6).setAlpha(0);
  root.add([shade, band, title, pa, pb, vs]);
  s.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
  await Promise.all([
    tween(s, { targets: pa, x: WIDTH / 2 - 230, duration: 380, ease: 'Cubic.easeOut' }),
    tween(s, { targets: pb, x: WIDTH / 2 + 230, duration: 380, ease: 'Cubic.easeOut' }),
  ]);
  s.tweens.add({ targets: vs, alpha: 1, scale: { from: 2, to: 1 }, duration: 250 });
  await s.dialog.show(ev.dialog);

  // 三回合交锋
  const clash = async (strong) => {
    await Promise.all([
      tween(s, { targets: pa, x: WIDTH / 2 - 110, duration: 160, ease: 'Quad.easeIn' }),
      tween(s, { targets: pb, x: WIDTH / 2 + 110, duration: 160, ease: 'Quad.easeIn' }),
    ]);
    const flash = s.add.circle(WIDTH / 2, cy, 20, 0xffffff, 0.95).setDepth(951);
    s.tweens.add({ targets: flash, radius: strong ? 140 : 90, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = s.add.rectangle(WIDTH / 2, cy, 14, 3, 0xffe08a).setRotation(ang).setDepth(951);
      s.tweens.add({ targets: sp, x: WIDTH / 2 + Math.cos(ang) * 90, y: cy + Math.sin(ang) * 90, alpha: 0, duration: 320, onComplete: () => sp.destroy() });
    }
    const clang = text(s, WIDTH / 2, cy - 110, strong ? '斩！' : '铛！', strong ? 40 : 30, strong ? '#ff7a5a' : '#ffffff', FONT)
      .setOrigin(0.5).setStroke('#000', 6).setDepth(952);
    s.tweens.add({ targets: clang, y: clang.y - 20, alpha: 0, delay: 200, duration: 400, onComplete: () => clang.destroy() });
    s.cameras.main.shake(strong ? 300 : 150, strong ? 0.012 : 0.006);
    await Promise.all([
      tween(s, { targets: pa, x: WIDTH / 2 - 230, duration: 220, ease: 'Quad.easeOut' }),
      tween(s, { targets: pb, x: WIDTH / 2 + 230, duration: 220, ease: 'Quad.easeOut' }),
    ]);
    await wait(s, 160);
  };
  await clash(false);
  await clash(false);
  if (result === 'draw') {
    // 平局：再交一合，双方各退，不分胜负
    await clash(true);
    const tie = text(s, WIDTH / 2, cy + size / 2 + 26, '平 分 秋 色', 26, '#ffe08a', FONT).setOrigin(0.5).setStroke('#000', 5);
    root.add(tie);
    await s.dialog.show(ev.after);
    await tween(s, { targets: root, alpha: 0, duration: 300 });
    root.destroy();
    s.hud.log(`单挑：${ua.name} 与 ${ub.name} 不分胜负`);
    return;
  }
  // 决胜一击：胜者冲向败者
  const [win, lose, winUnit, loseUnit] = winner === 'a' ? [pa, pb, ua, ub] : [pb, pa, ub, ua];
  const dir = winner === 'a' ? 1 : -1;
  await tween(s, { targets: win, x: WIDTH / 2 + dir * 60, duration: 180, ease: 'Expo.easeIn' });
  await clash(true);
  s.tweens.add({ targets: win, x: WIDTH / 2 - dir * 230, duration: 200 });
  await tween(s, { targets: lose, x: lose.x + dir * 40, angle: dir * 12, alpha: 0.35, duration: 380, ease: 'Quad.easeOut' });
  const tag = text(s, lose.x, cy + size / 2 + 26, result === 'kill' ? '败　走' : '负　伤', 24, '#ff8a7a', FONT).setOrigin(0.5).setStroke('#000', 5);
  root.add(tag);
  await s.dialog.show(ev.after);
  await tween(s, { targets: root, alpha: 0, duration: 300 });
  root.destroy();

  // 结算
  if (result === 'kill') {
    loseUnit.hp = 0;
    s.views.get(loseUnit)?.updateHp();
    s.hud.log(`单挑：${winUnit.name} 击败了 ${loseUnit.name}！`);
    await killUnit(s, loseUnit);
  } else {
    loseUnit.hp = Math.max(1, Math.round(loseUnit.hp * 0.3));
    s.views.get(loseUnit)?.updateHp();
    s.hud.log(`单挑：${loseUnit.name} 被 ${winUnit.name} 击伤`);
    s.views.get(loseUnit)?.flashHit();
  }
}
