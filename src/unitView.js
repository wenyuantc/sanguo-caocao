import * as Phaser from 'phaser';
import { TILE, MAP_X, MAP_Y, COLORS, FONT, SETTINGS } from './config.js';
import { unitTexture, TEX, LW, LH, PAD, ANCHOR_X, FEET_Y } from './heroSprites.js';
import { STATUS, STATUS_KEYS } from './status.js';

export const tileCenter = (x, y) => ({ x: MAP_X + x * TILE + TILE / 2, y: MAP_Y + y * TILE + TILE / 2 });

// 剧情小人姿态名 → 战场动作（见 act）
const ACT_ALIAS = {
  raise: 'jump', excited: 'jump', cheer: 'jump',
  bow: 'bow', kneel: 'bow', sit: 'bow',
  cry: 'shake', sitcry: 'shake', bound: 'shake', fall: 'shake', hurt: 'shake',
  sword: 'spin', slash: 'spin',
};

export class UnitView {
  constructor(scene, unit) {
    this.scene = scene;
    this.unit = unit;
    const p = tileCenter(unit.x, unit.y);
    this.c = scene.add.container(p.x, p.y).setDepth(10 + unit.y);
    this.body = scene.add.container(0, 0);
    const g = scene.add.graphics();
    const col = COLORS[unit.faction];
    // 脚下阵营光圈
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 18, 38, 12);
    g.lineStyle(unit.leader ? 3 : 2, unit.leader ? COLORS.gold : col, 1).strokeEllipse(0, 18, 36, 11);
    // 像素小人
    this.sprite = scene.add.image(0, 21, unitTexture(scene, unit))
      .setOrigin(ANCHOR_X / LW, (PAD + FEET_Y) / (LH + PAD))
      .setScale(0.76 / TEX);
    if (unit.faction === 'enemy') this.sprite.setFlipX(true);
    // 姓名牌
    const tx = unit.faction === 'enemy' ? 10 : -25; // 姓名牌放在马头的另一侧
    const tag = scene.add.graphics();
    tag.fillStyle(col, 1).fillRoundedRect(tx, -24, 15, 15, 3);
    tag.lineStyle(1, unit.leader ? COLORS.gold : 0xf1e3c2, 1).strokeRoundedRect(tx, -24, 15, 15, 3);
    const name = scene.add.text(tx + 7.5, -16.5, unit.mark || unit.name[0], { fontFamily: FONT, fontSize: '12px', color: '#fff8e6' }).setOrigin(0.5);
    // 阶级标记：姓名牌下方的金色菱形（二阶 1 个，三阶 2 个）
    this.tagX = tx;
    this.tierMark = scene.add.graphics();
    this.body.add([g, this.sprite, tag, name, this.tierMark]);
    this.drawTier();
    this.hpBar = scene.add.graphics();
    // 状态图标：在姓名牌的另一侧竖排（异常为彩色圆徽章，增益 / 减益为上 / 下箭头）
    this.statusMark = scene.add.container(unit.faction === 'enemy' ? -17 : 17, -20);
    this.c.add([this.body, this.hpBar, this.statusMark]);
    this.updateHp();
    this.updateStatus();
    // 待机呼吸动画：画质为“低”时省略
    if (SETTINGS.quality !== 'low') this.idle = scene.tweens.add({ targets: this.body, y: -2, yoyo: true, repeat: -1, duration: 600 + Math.random() * 300, ease: 'Sine.easeInOut' });
  }

  drawTier() {
    const g = this.tierMark.clear();
    const n = (this.unit.tier || 1) - 1;
    for (let i = 0; i < n; i++) {
      const cx = this.tagX + 7.5 + (i - (n - 1) / 2) * 7, cy = -5;
      const pts = [{ x: cx, y: cy - 3 }, { x: cx + 3, y: cy }, { x: cx, y: cy + 3 }, { x: cx - 3, y: cy }];
      g.fillStyle(0xffd36a, 1).fillPoints(pts, true);
      g.lineStyle(1, 0x5a3a10, 1).strokePoints(pts, true);
    }
  }

  // 转职后更新外形与阶级标记
  refresh() {
    this.sprite.setTexture(unitTexture(this.scene, this.unit));
    this.drawTier();
    this.updateHp();
    this.updateStatus();
  }

  updateStatus() {
    const m = this.statusMark;
    if (!m.active) return;
    m.removeAll(true);
    const u = this.unit;
    let y = 0;
    for (const k of STATUS_KEYS) {
      if (!u.status?.[k]) continue;
      const g = this.scene.add.graphics();
      g.fillStyle(STATUS[k].color, 1).fillCircle(0, y, 5.5);
      g.lineStyle(1, 0x1a1008, 1).strokeCircle(0, y, 5.5);
      const t = this.scene.add.text(0, y, STATUS[k].short, { fontFamily: FONT, fontSize: '9px', color: '#1a1008' }).setOrigin(0.5);
      m.add([g, t]);
      y += 12;
    }
    const b = Object.values(u.buffs || {}).filter(Boolean);
    const up = b.some((v) => v.add || v.mult > 1), down = b.some((v) => v.mult < 1);
    for (const [on, ch, col] of [[up, '▲', '#9ce07a'], [down, '▼', '#ff7a6a']]) {
      if (!on) continue;
      m.add(this.scene.add.text(0, y, ch, { fontFamily: FONT, fontSize: '10px', color: col }).setOrigin(0.5).setStroke('#1a1008', 3));
      y += 11;
    }
  }

  // 兵力条平滑过渡
  updateHp() {
    const target = Math.max(0, this.unit.hp / this.unit.stats.hp);
    if (this.shownHp == null) { this.shownHp = target; this.drawHp(); return; }
    this.hpTween?.stop();
    this.hpTween = this.scene.tweens.add({ targets: this, shownHp: target, duration: 450, ease: 'Cubic.easeOut', onUpdate: () => this.drawHp() });
  }

  drawHp() {
    if (!this.hpBar.active) return;
    const r = this.shownHp;
    const g = this.hpBar.clear();
    g.fillStyle(0x000000, 0.8).fillRect(-18, 20, 36, 5);
    g.fillStyle(r > 0.5 ? 0x4cd964 : r > 0.25 ? 0xf0c040 : 0xe04030, 1).fillRect(-17, 21, 34 * r, 3);
  }

  // 面向目标（贴图默认朝右，敌军默认朝左）
  face(target) {
    if (target.x !== this.unit.x) this.sprite.setFlipX(target.x < this.unit.x);
  }

  // 战场演出的转向：left / right 左右翻转；up / down 没有背面贴图，用压扁 / 拉伸一下示意；也可传 {x, y} 面向某格
  faceDir(dir) {
    if (dir && typeof dir === 'object') return this.face(dir);
    if (dir === 'left' || dir === 'right') this.sprite.setFlipX(dir === 'left');
    else if (dir === 'up' || dir === 'down') {
      this.scene.tweens.add({ targets: this.sprite, scaleY: this.sprite.scaleY * (dir === 'up' ? 1.08 : 0.92), duration: 120, yoyo: true });
    }
  }

  // 战场演出的动作（返回 Promise）：jump 跳起、bow 俯身、shake 颤抖、flash 闪光、spin 回转；
  // 剧情小人的姿态名也可直接使用，按相近的动作表现（举手 / 激动 → 跳起，作揖 / 跪 → 俯身，哭 / 被缚 → 颤抖，挥剑 → 回转）
  act(pose) {
    const kind = ACT_ALIAS[pose] || pose;
    const s = this.scene, b = this.body;
    const tw = (cfg) => new Promise((r) => s.tweens.add({ targets: b, ...cfg, onComplete: () => r() }));
    this.idle?.pause();
    const done = () => { b.setPosition(0, 0).setScale(1).setAngle(0); if (!this.acted) this.idle?.resume(); };
    if (kind === 'bow') return tw({ scaleY: 0.82, y: 4, duration: 220, yoyo: true, hold: 260, ease: 'Quad.easeOut' }).then(done);
    if (kind === 'shake') return tw({ x: { from: -3, to: 3 }, duration: 60, yoyo: true, repeat: 5 }).then(done);
    if (kind === 'spin') return tw({ angle: 360, duration: 420, ease: 'Cubic.easeInOut' }).then(done);
    if (kind === 'flash') {
      return new Promise((r) => {
        let n = 0;
        const blink = () => {
          if (!this.sprite.active) { r(); return; }
          this.flashHit(0xfff2c0);
          if (++n < 3) s.time.delayedCall(220, blink); else s.time.delayedCall(160, () => { done(); r(); });
        };
        blink();
      });
    }
    return tw({ y: -14, duration: 150, yoyo: true, repeat: 1, ease: 'Quad.easeOut' }).then(done);
  }

  faceDefault() {
    this.sprite.setFlipX(this.unit.faction === 'enemy');
  }

  // 受击闪红
  flashHit(color = 0xff4030) {
    this.sprite.setTintMode(Phaser.TintModes.FILL).setTint(color);
    this.scene.time.delayedCall(110, () => {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.acted) this.sprite.setTint(0x777777); else this.sprite.clearTint();
    });
  }

  // 被击退 / 闪避：沿攻击方向推开或侧身
  knockback(from, dist = 7) {
    const a = tileCenter(from.x, from.y), b = tileCenter(this.unit.x, this.unit.y);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    this.scene.tweens.add({ targets: this.body, x: ((b.x - a.x) / len) * dist, y: ((b.y - a.y) / len) * dist, duration: 70, yoyo: true, ease: 'Quad.easeOut', onComplete: () => this.body.setPosition(0, 0) });
  }

  dodge(from) {
    const a = tileCenter(from.x, from.y), b = tileCenter(this.unit.x, this.unit.y);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const px = -(b.y - a.y) / len, py = (b.x - a.x) / len;
    this.scene.tweens.add({ targets: this.body, x: px * 14, y: py * 14 - 4, duration: 110, yoyo: true, hold: 120, ease: 'Quad.easeOut', onComplete: () => this.body.setPosition(0, 0) });
  }

  setActed(v) {
    this.acted = v;
    this.body.setAlpha(v ? 0.75 : 1);
    if (v) this.sprite.setTint(0x777777); else this.sprite.clearTint();
    if (v) this.idle?.pause(); else this.idle?.resume();
  }

  snap() {
    const p = tileCenter(this.unit.x, this.unit.y);
    this.c.setPosition(p.x, p.y).setDepth(10 + this.unit.y);
  }

  // 沿路径逐格移动；ms 为每格时长（剧情演出、援军走入用较慢的步速）
  moveAlong(path, ms = 90) {
    return new Promise((resolve) => {
      if (path.length <= 1) { this.snap(); resolve(); return; }
      const steps = path.slice(1).map((pt) => {
        const p = tileCenter(pt.x, pt.y);
        return { x: p.x, y: p.y, duration: ms, ease: 'Linear', onStart: () => this.c.setDepth(10 + Math.max(0, pt.y)) };
      });
      this.scene.tweens.chain({ targets: this.c, tweens: steps, onComplete: () => { this.snap(); resolve(); } });
    });
  }

  hurt() {
    this.scene.tweens.add({ targets: this.body, x: { from: -5, to: 5 }, duration: 50, yoyo: true, repeat: 3, onComplete: () => this.body.setX(0) });
  }
}
