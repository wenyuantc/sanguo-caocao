import { PANEL_X, WIDTH, HEIGHT, MAP_Y, COLORS, FONT, FACTION_NAME } from './config.js';
import { classOf, ITEMS, STAT5, STAT_NAME } from './data.js';
import { GUARD_TAKEN } from './logic.js';
import { panel, text, portrait, button } from './ui.js';

const PW = WIDTH - PANEL_X;
const FACTION_COLOR = { player: '#7fb2ff', enemy: '#ff8a7a', ally: '#8ce09a' };

export class Hud {
  constructor(scene, stage) {
    this.scene = scene;
    // 顶部栏
    const top = scene.add.graphics().setDepth(50);
    top.fillStyle(COLORS.panel, 1).fillRect(0, 0, WIDTH, MAP_Y);
    top.lineStyle(2, COLORS.gold, 1).lineBetween(0, MAP_Y - 1, WIDTH, MAP_Y - 1);
    // 章节与关序：分支关 no 形如 '忠1' / '奸1'
    const no = typeof stage.no === 'string'
      ? `${stage.no[0] === '忠' ? '忠臣线' : '奸雄线'} 第 ${stage.no.slice(1)} 关`
      : `第 ${stage.no} 关`;
    text(scene, 14, 2, `${stage.chapter}　${no}`, 12, '#b9a57a', FONT).setDepth(51);
    text(scene, 14, 15, stage.title, 20, '#e9c46a', FONT).setDepth(51);
    const diff = scene.difficulty;
    text(scene, 250, 12, `［${diff.name}］`, 16, diff.color, FONT).setDepth(51);
    this.turnText = text(scene, 330, 10, '', 18, '#f1e3c2', FONT).setDepth(51);
    this.itemText = text(scene, 560, 11, '', 16, '#d8c8a0').setDepth(51);
    this.redText = text(scene, WIDTH - 16, 11, '', 16, '#ff6a5a', FONT).setOrigin(1, 0).setDepth(51);
    this.infoBtn = button(scene, 880, 5, 84, 30, '部　队', () => scene.openInfo(), 16).setDepth(52);

    // 右侧面板
    panel(scene, PANEL_X + 4, MAP_Y + 4, PW - 8, HEIGHT - MAP_Y - 8).setDepth(50);
    // 胜负条件按实际行高依次排布，下方区域随之下移
    let y = MAP_Y + 16;
    text(scene, PANEL_X + 20, y, '胜利条件', 15, '#e9c46a', FONT).setDepth(51);
    const win = text(scene, PANEL_X + 20, y + 20, stage.victoryText, 15, '#f1e3c2').setDepth(51).setWordWrapWidth(PW - 40);
    y += 24 + win.height;
    text(scene, PANEL_X + 20, y, '失败条件', 15, '#e9c46a', FONT).setDepth(51);
    const protect = (stage.protect || []).map((id) => stage.units.find((u) => u.id === id)?.name).filter(Boolean);
    const lose = stage.defeatText || [`曹操${protect.length ? '、' + protect.join('、') : ''}撤退`, `超过 ${stage.turns} 回合`].join(' / ');
    const loseText = text(scene, PANEL_X + 20, y + 20, lose, 15, '#f1e3c2').setDepth(51).setWordWrapWidth(PW - 40);
    const shift = Math.max(0, y + 24 + loseText.height - (MAP_Y + 104));
    this.info = scene.add.container(PANEL_X + 16, MAP_Y + 110 + shift).setDepth(51);
    this.forecastText = text(scene, PANEL_X + 20, MAP_Y + 352 + shift, '', 15, '#ffd27a').setDepth(51).setLineSpacing(4).setWordWrapWidth(PW - 40);
    const g = scene.add.graphics().setDepth(51);
    g.lineStyle(1, COLORS.gold, 0.4).lineBetween(PANEL_X + 16, MAP_Y + 104 + shift, WIDTH - 16, MAP_Y + 104 + shift);
    g.lineStyle(1, COLORS.gold, 0.4).lineBetween(PANEL_X + 16, MAP_Y + 410 + shift, WIDTH - 16, MAP_Y + 410 + shift);
    this.logText = text(scene, PANEL_X + 20, MAP_Y + 418 + shift, '', 14, '#cdbd98').setDepth(51).setLineSpacing(4).setWordWrapWidth(PW - 40);
    this.maxLogs = shift > 20 ? 4 : 5;
    this.logs = [];
    const half = (PW - 50) / 2;
    this.saveBtn = button(scene, PANEL_X + 20, HEIGHT - 102, half, 36, '保存进度', () => scene.openSave('save'), 17).setDepth(52);
    this.loadBtn = button(scene, PANEL_X + 30 + half, HEIGHT - 102, half, 36, '读取进度', () => scene.openSave('load'), 17).setDepth(52);
    this.endBtn = button(scene, PANEL_X + 20, HEIGHT - 58, PW - 40, 40, '结束回合', () => scene.endPlayerPhase(), 20).setDepth(52);
  }

  setTurn(turn, max, phase) {
    this.turnText.setText(`第 ${turn} / ${max} 回合　${FACTION_NAME[phase]}阶段`);
    this.endBtn.setDisabled(phase !== 'player');
    this.saveBtn.setDisabled(phase !== 'player');
    this.infoBtn.setDisabled(phase !== 'player');
  }

  // 红色指数：黄=忠臣、红=中立、橙=奸雄
  setRed(red) {
    const color = red >= 3 ? '#ffe04a' : red <= -3 ? '#ff9a2a' : '#ff5a4a';
    this.redText.setText(`红色指数 ${red > 0 ? '+' : ''}${red}`).setColor(color);
  }

  setItems(items) {
    this.itemText.setText('军需：' + Object.entries(items).map(([k, n]) => `${ITEMS[k].name}×${n}`).join('  '));
  }

  log(msg) {
    this.logs.push(msg);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    this.logText.setText(this.logs.join('\n'));
  }

  forecast(str) {
    this.forecastText.setText(str || '');
  }

  showUnit(u, terrain) {
    const s = this.scene;
    this.info.removeAll(true);
    if (!u) { if (terrain) this.showTerrain(terrain); return; }
    const cls = classOf(u.cls, u.tier);
    const items = [portrait(s, 36, 40, u.name, u.faction, 72)];
    // 兵种标识字：头像右下角的小印章，二阶以上金色
    const badge = s.add.graphics();
    badge.fillStyle(0x2a1b0e, 0.95).fillRoundedRect(56, 58, 22, 22, 4);
    badge.lineStyle(2, cls.tier > 1 ? COLORS.gold : 0x9a8a6a, 1).strokeRoundedRect(56, 58, 22, 22, 4);
    items.push(badge, text(s, 67, 69, cls.glyph, 15, cls.tier > 1 ? '#ffd36a' : '#f1e3c2', FONT).setOrigin(0.5));
    items.push(text(s, 86, 2, u.name, 24, '#fff2cc', FONT));
    const tierName = cls.tiers > 1 ? `（${['一', '二', '三'][cls.tier - 1]}阶）` : '';
    items.push(text(s, 86, 34, `${FACTION_NAME[u.faction]}·${cls.name}${tierName}`, 15, FACTION_COLOR[u.faction]));
    items.push(text(s, 86, 56, `Lv ${u.lvl}${u.faction === 'player' ? `　EXP ${u.exp}/100` : ''}`, 15, '#f1e3c2'));
    const bars = s.add.graphics();
    const bar = (y, label, v, max, col) => {
      items.push(text(s, 0, y - 3, label, 14, '#e9c46a'));
      bars.fillStyle(0x000000, 0.6).fillRect(40, y, 200, 12);
      bars.fillStyle(col, 1).fillRect(41, y + 1, max ? 198 * (v / max) : 0, 10);
      items.push(text(s, 248, y - 3, `${v}/${max}`, 14, '#f1e3c2'));
    };
    bar(94, '兵力', u.hp, u.stats.hp, 0x4cd964);
    bar(116, '策略', u.mp, u.stats.mp, 0x4a9df0);
    items.push(bars);
    const st = u.stats;
    // 五项能力 + 移动（三列），地形单独一行
    const rows = [...STAT5.map((k) => [STAT_NAME[k], st[k]]), ['移动', cls.move]];
    rows.forEach(([k, v], i) => {
      const x = (i % 3) * 100, y = 142 + Math.floor(i / 3) * 24;
      items.push(text(s, x, y, k, 15, '#e9c46a', FONT), text(s, x + 38, y, String(v), 15, '#f6ecd2'));
    });
    items.push(text(s, 0, 190, '地形', 15, '#e9c46a', FONT),
      text(s, 38, 190, terrain ? `${terrain.name} ${Math.round(terrain.def * 100)}%` : '-', 15, '#f6ecd2'));
    const status = u.faction === 'player' ? (u.acted ? '已行动' : '待命中') : u.ai === 'aggressive' ? '进攻' : '固守';
    items.push(text(s, 0, 216, `状态：${status}${u.guard ? `　主将·受到伤害 −${Math.round((1 - GUARD_TAKEN) * 100)}%` : ''}`, 14, '#bfae88'));
    this.info.add(items);
  }

  showTerrain(t) {
    const s = this.scene;
    const heal = t.heal ? `　回复 ${Math.round(t.heal * 100)}%` : '';
    const cost = t.cost.foot >= 99 ? '不可通行' : `步行 ${t.cost.foot}　骑马 ${t.cost.horse >= 99 ? '×' : t.cost.horse}`;
    this.info.add([
      text(s, 0, 0, t.name, 26, '#fff2cc', FONT),
      text(s, 0, 40, `防御加成 ${Math.round(t.def * 100)}%${heal}`, 15, '#f1e3c2'),
      text(s, 0, 64, `移动消耗：${cost}`, 15, '#f1e3c2'),
    ]);
  }

  banner(str, color = '#ffe08a') {
    const s = this.scene;
    const cx = PANEL_X / 2, cy = MAP_Y + 300;
    const bg = s.add.rectangle(cx, cy, PANEL_X, 80, 0x000000, 0.6).setDepth(800);
    const t = text(s, cx, cy, str, 40, color, FONT).setOrigin(0.5).setStroke('#2a1200', 6).setDepth(801);
    bg.scaleY = 0;
    return new Promise((resolve) => {
      s.tweens.add({ targets: bg, scaleY: 1, duration: 200 });
      s.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, x: { from: cx - 60, to: cx }, duration: 300 });
      s.time.delayedCall(1100, () => {
        s.tweens.add({ targets: [bg, t], alpha: 0, duration: 250, onComplete: () => { bg.destroy(); t.destroy(); resolve(); } });
      });
    });
  }
}
