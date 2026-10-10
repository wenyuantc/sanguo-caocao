import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, COLORS } from './config.js';
import { getStage } from './stages.js';
import { diffOf } from './data.js';
import { panel, text, button } from './ui.js';
import {
  listSlots, writeSlot, deleteSlot, readAuto, formatTime, SLOT_COUNT, exportAll, exportSlot, planImport, applyImport, pickFile,
} from './saves.js';

function describe(data) {
  if (!data) return { title: '— 空存档 —', sub: '' };
  const stage = getStage(data.stage);
  if (!stage) return { title: '已通关', sub: formatTime(data.savedAt) };
  const where = data.kind === 'battle' ? `第 ${data.turn} 回合` : '开战前';
  const lvl = data.summary?.lordLvl ? `　曹操 Lv${data.summary.lordLvl}` : '';
  return { title: `${stage.title}　${where}${lvl}`, sub: formatTime(data.savedAt) };
}

// mode: 'save' | 'load'；getData 返回待保存数据；onLoad(data) 读取
export function openSaveMenu(scene, { mode, getData, onLoad, onClose }) {
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.6).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const PER_PAGE = 10, PAGES = Math.ceil(SLOT_COUNT / PER_PAGE);
  const rowH = 42, gap = 4, autoRow = mode === 'load' ? 1 : 0;
  const w = 720, h = 140 + (PER_PAGE + autoRow) * (rowH + gap);
  const x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 30, mode === 'save' ? '保 存 进 度' : '读 取 进 度', 28, '#ffd36a', FONT).setOrigin(0.5));
  const toast = text(scene, x0 + w - 30, y0 + 22, '', 15, '#9ce0a8').setOrigin(1, 0);
  const pageText = text(scene, x0 + 430, y0 + h - 36, '', 16, '#e9c46a', FONT).setOrigin(0.5);
  const list = scene.add.container(0, 0);
  root.add([list, toast, pageText]);

  // 初始页：存档时定位到第一个空位，读档时定位到最近一次存档
  const initial = listSlots();
  let start = 0;
  if (mode === 'save') start = Math.max(0, initial.findIndex((d) => !d));
  else initial.forEach((d, i) => { if (d && (!initial[start] || d.savedAt > initial[start].savedAt)) start = i; });
  let page = Math.floor(start / PER_PAGE);

  let closed = false;
  const turn = (dp) => { const np = Phaser.Math.Clamp(page + dp, 0, PAGES - 1); if (np !== page) { page = np; scene.time.delayedCall(0, render); } };
  const prevKey = () => turn(-1), nextKey = () => turn(1);
  const dispose = () => {
    closed = true;
    scene.input.keyboard?.off('keydown-ESC', close);
    scene.input.keyboard?.off('keydown-LEFT', prevKey);
    scene.input.keyboard?.off('keydown-RIGHT', nextKey);
    root.destroy();
  };
  function close() { if (!closed) { dispose(); onClose?.(); } }
  const prevBtn = button(scene, x0 + 24, y0 + h - 56, 120, 40, '◀ 上一页', prevKey, 17);
  const nextBtn = button(scene, x0 + 154, y0 + h - 56, 120, 40, '下一页 ▶', nextKey, 17);
  root.add([prevBtn, nextBtn, button(scene, x0 + w - 134, y0 + h - 56, 110, 40, '关　闭', close, 18)]);
  scene.input.keyboard?.on('keydown-ESC', close);

  // 导入 / 导出
  const say = (msg, color = '#9ce0a8') => toast.setColor(color).setText(msg);
  let pending = null;
  const importBtn = button(scene, x0 + 24, y0 + 14, 92, 32, '导　入', async () => {
    if (pending) {
      applyImport(pending);
      say(`已导入 ${pending.count} 个存档`);
      pending = null;
      importBtn.label.setText('导　入');
      scene.time.delayedCall(0, render);
      return;
    }
    const content = await pickFile();
    if (!content || closed) return;
    try {
      const plan = planImport(content);
      if (plan.overwrite) {
        pending = plan;
        importBtn.label.setText('确认覆盖');
        say(`将覆盖 ${plan.overwrite} 个存档，再点确认`, '#ffd27a');
        return;
      }
      applyImport(plan);
      if (plan.target != null) page = Math.floor(plan.target / PER_PAGE);
      say(plan.target != null ? `已导入到存档 ${String(plan.target + 1).padStart(3, '0')}` : `已导入 ${plan.count} 个存档`);
      scene.time.delayedCall(0, render);
    } catch (e) {
      say(e.message, '#ff8a7a');
    }
  }, 15);
  const exportBtn = button(scene, x0 + 124, y0 + 14, 92, 32, '导出全部', () => {
    if (!readAuto() && !listSlots().some(Boolean)) { say('暂无可导出的存档', '#ff8a7a'); return; }
    exportAll();
    say('已导出全部存档');
  }, 15);
  root.add([importBtn, exportBtn]);
  scene.input.keyboard?.on('keydown-LEFT', prevKey);
  scene.input.keyboard?.on('keydown-RIGHT', nextKey);

  const render = () => {
    if (closed) return;
    list.removeAll(true);
    const slots = listSlots();
    const rows = [];
    if (autoRow) rows.push({ auto: true });
    for (let i = page * PER_PAGE; i < Math.min(SLOT_COUNT, (page + 1) * PER_PAGE); i++) rows.push({ index: i });
    pageText.setText(`第 ${page + 1} / ${PAGES} 页　已用 ${slots.filter(Boolean).length} / ${SLOT_COUNT}`);
    prevBtn.setDisabled(page === 0);
    nextBtn.setDisabled(page === PAGES - 1);
    rows.forEach((row, i) => {
      const data = row.auto ? readAuto() : slots[row.index];
      const y = y0 + 62 + i * (rowH + gap);
      const d = describe(data);
      const canClick = mode === 'save' ? !row.auto : !!data && !!getStage(data.stage);
      const g = scene.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(hover && canClick ? 0x5a3a1a : row.auto ? 0x1c2434 : 0x2a1c10, 1).fillRoundedRect(x0 + 24, y, w - 48, rowH, 6);
        g.lineStyle(1, COLORS.gold, hover && canClick ? 1 : 0.4).strokeRoundedRect(x0 + 24, y, w - 48, rowH, 6);
      };
      draw(false);
      const label = row.auto ? '自动存档' : `存档 ${String(row.index + 1).padStart(3, '0')}`;
      const zone = scene.add.zone(x0 + 24, y, w - 240, rowH).setOrigin(0).setInteractive({ useHandCursor: canClick });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', (p, lx, ly, e) => {
        e?.stopPropagation?.();
        if (!canClick) return;
        if (mode === 'save') {
          try {
            writeSlot(row.index, getData());
            toast.setColor('#9ce0a8').setText(`已保存到 ${label}`);
          } catch {
            toast.setColor('#ff8a7a').setText('存储空间不足，请删除部分存档');
          }
          scene.time.delayedCall(0, render);
        } else {
          dispose();
          onLoad(data);
        }
      });
      const title = text(scene, x0 + 160, y + 4, d.title, 16, data ? '#f6ecd2' : '#7a6a50');
      list.add([g, zone, title,
        text(scene, x0 + 40, y + 11, label, 17, row.auto ? '#9cc8ff' : '#e9c46a', FONT),
        text(scene, x0 + 160, y + 24, d.sub, 12, '#a8987a')]);
      if (data) {
        const df = diffOf(data.difficulty);
        const tag = text(scene, x0 + 160, y + 4, `［${df.name}］`, 15, df.color, FONT);
        title.setX(tag.x + tag.width + 6);
        list.add(tag);
      }
      if (data && !row.auto) {
        let armed = false;
        const del = button(scene, x0 + w - 112, y + 7, 76, 28, '删除', () => {
          if (!armed) { armed = true; del.label.setText('确认?'); return; }
          deleteSlot(row.index);
          toast.setColor('#9ce0a8').setText(`已删除 ${label}`);
          scene.time.delayedCall(0, render);
        }, 14);
        const exp = button(scene, x0 + w - 196, y + 7, 76, 28, '导出', () => { exportSlot(row.index); say(`已导出 ${label}`); }, 14);
        list.add([del, exp]);
      }
    });
  };
  render();
  return root;
}
