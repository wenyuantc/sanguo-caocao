import { WIDTH, HEIGHT, FONT, COLORS, RES, SETTINGS } from './config.js';
import { panel, text, button } from './ui.js';
import { SETTING_OPTIONS, saveSettings, resolveRes } from './settings.js';

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
  zone.on('pointerdown', (p, lx, ly, ev) => { ev?.stopPropagation?.(); onClick(); });
  c.add([bg, t, zone]);
  c.setOn = (v) => { on = v; draw(false); };
  return c;
}

// 标题页的游戏设置：改动先记在草稿里，保存后重载页面生效（全屏立即生效）
export function openSettingsMenu(scene) {
  const draft = { ...SETTINGS };
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const w = 680, h = 490, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 36, '游 戏 设 置', 30, '#ffd36a', FONT).setOrigin(0.5));
  const hint = text(scene, WIDTH / 2, y0 + h - 104, '', 15, '#e8d6ae').setOrigin(0.5).setAlign('center').setLineSpacing(6);
  root.add(hint);

  const chips = [];
  const refresh = () => {
    chips.forEach(({ c, k, v }) => c.setOn(draft[k] === v));
    const r = resolveRes(draft);
    const changed = Object.keys(draft).some((k) => draft[k] !== SETTINGS[k]);
    hint.setText(`当前画布 ${WIDTH * RES}×${HEIGHT * RES}　→　保存后 ${WIDTH * r}×${HEIGHT * r}\n`
      + (changed ? '设置已修改，保存后将重新加载页面' : '卡顿时可降低分辨率或将画质设为“低”'));
  };
  ROWS.forEach(([k, label], i) => {
    const y = y0 + 84 + i * 56;
    root.add(text(scene, x0 + 40, y + 19, label, 20, '#e9c46a', FONT).setOrigin(0, 0.5));
    SETTING_OPTIONS[k].forEach(([v, name], j) => {
      const c = chip(scene, x0 + 190 + j * 116, y, 106, 38, name, () => { draft[k] = v; refresh(); });
      chips.push({ c, k, v });
      root.add(c);
    });
  });
  // 全屏：立即切换，不需要保存
  const fy = y0 + 84 + ROWS.length * 56;
  root.add(text(scene, x0 + 40, fy + 19, '全　　屏', 20, '#e9c46a', FONT).setOrigin(0, 0.5));
  const fsBtn = button(scene, x0 + 190, fy, 222, 38, '', () => { scene.scale.toggleFullscreen(); }, 17);
  const fsLabel = () => fsBtn.label.setText(scene.scale.isFullscreen ? '退 出 全 屏' : '进 入 全 屏');
  scene.scale.on('enterfullscreen', fsLabel);
  scene.scale.on('leavefullscreen', fsLabel);
  fsLabel();
  root.add(fsBtn);

  const close = () => {
    scene.input.keyboard?.off('keydown-ESC', close);
    scene.scale.off('enterfullscreen', fsLabel);
    scene.scale.off('leavefullscreen', fsLabel);
    root.destroy();
  };
  const apply = () => {
    if (!Object.keys(draft).some((k) => draft[k] !== SETTINGS[k])) return close();
    saveSettings(draft);
    location.reload();
  };
  root.add(button(scene, WIDTH / 2 - 190, y0 + h - 62, 180, 42, '保存并应用', apply, 18));
  root.add(button(scene, WIDTH / 2 + 10, y0 + h - 62, 180, 42, '返　回', close, 18));
  scene.input.keyboard?.on('keydown-ESC', close);
  refresh();
}
