import { WIDTH, HEIGHT, FONT, COLORS, RES, SETTINGS } from './config.js';
import { panel, text, button, slider } from './ui.js';
import { SETTING_OPTIONS, RENDER_KEYS, saveSettings, resolveRes } from './settings.js';
import { engine } from './audio/engine.js';
import { sfx } from './audio/sfx.js';

const ROWS = [
  ['res', '渲染分辨率'],
  ['quality', '画　　质'],
  ['fps', '帧率上限'],
  ['showFps', '显示帧率'],
];

// 选项小按钮：选中时金底高亮
function chip(scene, x, y, w, h, label, onClick) {
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const t = text(scene, w / 2, h / 2, label, 17, '#f6e7c1', FONT).setOrigin(0.5);
  const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  let on = false;
  const draw = (hover) => {
    bg.clear();
    bg.fillStyle(on ? 0x8a5a1c : hover ? 0x5a3a18 : 0x2a1b0e, 1).fillRoundedRect(0, 0, w, h, 6);
    bg.lineStyle(on ? 2 : 1, COLORS.gold, on ? 1 : 0.5).strokeRoundedRect(0, 0, w, h, 6);
    t.setColor(on ? '#ffd36a' : '#f1e3c2');
  };
  zone.on('pointerover', () => draw(true));
  zone.on('pointerout', () => draw(false));
  zone.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); sfx('select'); onClick(); });
  c.add([bg, t, zone]);
  c.setOn = (v) => { on = v; draw(false); };
  return c;
}

// 音量类设置：写入 SETTINGS 并立即保存、生效（不重载页面）
function setAudio(k, v) {
  SETTINGS[k] = v;
  try { saveSettings({ ...SETTINGS }); } catch { /* localStorage 不可用时只在本次生效 */ }
  engine.setVolumes({ music: SETTINGS.music, sfx: SETTINGS.sfx, mute: SETTINGS.mute });
}

// 音量三行（配乐、音效、静音），从 y 起每行 step 高
function audioRows(scene, root, x0, y, step) {
  const label = (yy, s) => root.add(text(scene, x0 + 40, yy + 19, s, 20, '#e9c46a', FONT).setOrigin(0, 0.5));
  label(y, '配乐音量');
  root.add(slider(scene, x0 + 200, y + 19, 300, SETTINGS.music, (v) => setAudio('music', v)));
  label(y + step, '音效音量');
  // 拖动音效音量时试听（限频）
  let last = 0;
  root.add(slider(scene, x0 + 200, y + step + 19, 300, SETTINGS.sfx, (v) => {
    setAudio('sfx', v);
    if (performance.now() - last > 150) { last = performance.now(); sfx('select'); }
  }));
  label(y + step * 2, '静　　音');
  const chips = SETTING_OPTIONS.mute.map(([v, name], j) => {
    const c = chip(scene, x0 + 190 + j * 116, y + step * 2, 106, 38, name, () => {
      setAudio('mute', v);
      chips.forEach((o, i) => o.setOn(SETTING_OPTIONS.mute[i][0] === SETTINGS.mute));
    });
    root.add(c);
    return c;
  });
  chips.forEach((o, i) => o.setOn(SETTING_OPTIONS.mute[i][0] === SETTINGS.mute));
}

// 游戏速度一行：7 档，即时写入 SETTINGS 并保存（战斗场景在关闭面板时应用倍率）
function speedRow(scene, root, x0, y) {
  root.add(text(scene, x0 + 40, y + 19, '游戏速度', 20, '#e9c46a', FONT).setOrigin(0, 0.5));
  const opts = SETTING_OPTIONS.speed;
  const sync = () => chips.forEach((o, i) => o.setOn(opts[i][0] === SETTINGS.speed));
  const chips = opts.map(([v, name], j) => {
    const c = chip(scene, x0 + 190 + j * 66, y, 60, 38, name, () => {
      SETTINGS.speed = v;
      try { saveSettings({ ...SETTINGS }); } catch { /* localStorage 不可用时只在本次生效 */ }
      sync();
    });
    root.add(c);
    return c;
  });
  sync();
}

// 游戏设置：渲染类改动先记在草稿里，保存后重载页面生效（全屏立即生效）；音量类改动即时生效并保存。
// audioOnly：战斗中打开，只显示游戏速度与音量相关的行。onClose 在关闭后调用
export function openSettingsMenu(scene, { audioOnly = false, onClose } = {}) {
  const draft = { ...SETTINGS };
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const w = 680, h = audioOnly ? 400 : 660, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 36, audioOnly ? '战 斗 设 置' : '游 戏 设 置', 30, '#ffd36a', FONT).setOrigin(0.5));
  const hint = text(scene, WIDTH / 2, y0 + h - 104, '', 15, '#e8d6ae').setOrigin(0.5).setAlign('center').setLineSpacing(6);
  root.add(hint);

  let fsLabel = null;
  const close = () => {
    scene.input.keyboard?.off('keydown-ESC', close);
    if (fsLabel) {
      scene.scale.off('enterfullscreen', fsLabel);
      scene.scale.off('leavefullscreen', fsLabel);
    }
    root.destroy();
    onClose?.();
  };

  if (audioOnly) {
    speedRow(scene, root, x0, y0 + 80);
    audioRows(scene, root, x0, y0 + 132, 52);
    hint.setText('游戏速度与音量调整即时生效');
    root.add(button(scene, WIDTH / 2 - 90, y0 + h - 62, 180, 42, '返　回', close, 18));
    scene.input.keyboard?.on('keydown-ESC', close);
    return;
  }

  const renderChanged = () => RENDER_KEYS.some((k) => draft[k] !== SETTINGS[k]);
  const chips = [];
  const refresh = () => {
    chips.forEach(({ c, k, v }) => c.setOn(draft[k] === v));
    const r = resolveRes(draft);
    hint.setText(`当前画布 ${WIDTH * RES}×${HEIGHT * RES}　→　保存后 ${WIDTH * r}×${HEIGHT * r}\n`
      + (renderChanged() ? '画面设置已修改，保存后将重新加载页面' : '卡顿时可降低分辨率或将画质设为“低”；游戏速度（仅战斗）与音量即时生效'));
  };
  ROWS.forEach(([k, label], i) => {
    const y = y0 + 76 + i * 50;
    root.add(text(scene, x0 + 40, y + 19, label, 20, '#e9c46a', FONT).setOrigin(0, 0.5));
    SETTING_OPTIONS[k].forEach(([v, name], j) => {
      const c = chip(scene, x0 + 190 + j * 116, y, 106, 38, name, () => { draft[k] = v; refresh(); });
      chips.push({ c, k, v });
      root.add(c);
    });
  });
  // 全屏：立即切换，不需要保存
  const fy = y0 + 76 + ROWS.length * 50;
  root.add(text(scene, x0 + 40, fy + 19, '全　　屏', 20, '#e9c46a', FONT).setOrigin(0, 0.5));
  const fsBtn = button(scene, x0 + 190, fy, 222, 38, '', () => { scene.scale.toggleFullscreen(); }, 17);
  fsLabel = () => fsBtn.label.setText(scene.scale.isFullscreen ? '退 出 全 屏' : '进 入 全 屏');
  scene.scale.on('enterfullscreen', fsLabel);
  scene.scale.on('leavefullscreen', fsLabel);
  fsLabel();
  root.add(fsBtn);
  // 游戏速度与音量：与画面设置之间加一条分隔线
  const ay = fy + 60;
  const line = scene.add.graphics();
  line.lineStyle(1, COLORS.gold, 0.35).lineBetween(x0 + 30, ay - 11, x0 + w - 30, ay - 11);
  root.add(line);
  speedRow(scene, root, x0, ay);
  audioRows(scene, root, x0, ay + 50, 50);

  // 只有渲染类设置改动时才保存并重载；音量、游戏速度已即时保存
  const apply = () => {
    if (!renderChanged()) return close();
    const next = { ...SETTINGS };
    for (const k of RENDER_KEYS) next[k] = draft[k];
    saveSettings(next);
    location.reload();
  };
  root.add(button(scene, WIDTH / 2 - 190, y0 + h - 62, 180, 42, '保存并应用', apply, 18));
  root.add(button(scene, WIDTH / 2 + 10, y0 + h - 62, 180, 42, '返　回', close, 18));
  scene.input.keyboard?.on('keydown-ESC', close);
  refresh();
}
