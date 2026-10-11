// 剧情小人：复用 heroSprites 的人物绘制（drawHuman 的姿态参数 S），生成正面 / 背面、各动作各帧的贴图；侧向用镜像。
// 贴图 key：st-<名>-<阵营>-<兵种>-<动作>-<帧>-<f|b>；StoryScene 关闭时释放。
import { C, kit, shade, lookOf, drawHuman, FACTION, ANCHOR_X, FEET_Y } from '../heroSprites.js';
import { getCharacter, CLASS_BY_NAME } from '../characters.js';
import { GENERALS } from '../generals.js';
import { FONT } from '../config.js';
import { POSES, DIRS, EMOTES, isoToScreen } from './defs.js';

const ST = 3; // 贴图分辨率倍数
const SW = 84, SH = 106, OX = 12, TOP = 38; // 逻辑画布：左右留白给挥剑 / 倒下，上方留白给帽饰与举手
const AX = OX + ANCHOR_X, AY = TOP + FEET_Y; // 脚底锚点
export const ACTOR_SCALE = 1.7; // 场景中的显示倍数（逻辑 1 像素 = 1.7 世界像素）

const GENERAL_CLS = Object.fromEntries(Object.values(GENERALS).map((g) => [g.name, g.cls]));
// 兵种：参数 → 武将总表 → 兵种登记 → 外形推断（袍服为谋士）；车类兵种按步兵画
export function actorClass(name, cls) {
  let c = cls || GENERAL_CLS[name] || CLASS_BY_NAME[name];
  if (!c) {
    const ch = getCharacter(name);
    c = ch?.robe ? 'strategist' : name.includes('黄巾') ? 'yellow' : name.includes('术士') ? 'taoist' : 'infantry';
  }
  return c === 'transport' || c === 'catapult' ? 'infantry' : c;
}

function storyLook(name, cls, faction) {
  const L = lookOf({ name, cls, faction });
  const ch = getCharacter(name);
  if (ch?.robe) { L.robe = true; if (ch.robeColor) L.robeColor = ch.robeColor; }
  L.tier = 1;
  return L;
}

// ---------- 姿态 ----------
// 手臂：[[肩 x, y], [手 x, y], 画手?]（身体坐标，与战场小人一致：头在 y≈17，腰带 y≈39，脚 y≈57）
const ARM = {
  downL: [[16, 29], [14.5, 39]], downR: [[36, 29], [38, 37.5]],
  swingL: [[16, 29], [15.5, 38.5]], swingR: [[36, 29], [37, 38.2]],
  bowL: [[16, 29], [23.6, 33.6]], bowR: [[36, 29], [28.4, 33.6]],
  upL: [[16, 28], [11, 14]], upR: [[36, 28], [41, 14]],
  reachR: [[36, 29], [47, 29.5]],
  faceL: [[16, 29], [22.2, 20.6]], faceR: [[36, 29], [29.8, 20.6]],
  fistL: [[16, 29], [12.6, 23]], fistR: [[36, 29], [39.4, 23]],
  kneeL: [[16, 29], [18.5, 42]], kneeR: [[36, 29], [33.5, 42]],
  backL: [[16, 29], [18.6, 37, false]], backR: [[36, 29], [33.4, 37, false]],
  slashUp: [[36, 28], [41, 12]], slashDown: [[36, 29], [46, 35]],
  elbowL: [[16, 29], [11.8, 34.5, false]], elbowR: [[36, 29], [40.2, 34.5, false]],
  kneeUpR: [[36, 29], [37, 40.4]],
};
// 跪姿上半身下移的量（身体高约 54：跪坐降低约 1/3，单膝跪地约 1/5）
export const SEAT_DROP = { sit: 17, kneel: 11 };
const hidden = (a) => [a[0], a[1], false];

// 动作 → 绘制参数（frame 为帧序号，back 为背面）
function poseSpec(pose, frame, back) {
  const s = { back, gaze: back ? 0 : 0.9, arms: { l: ARM.downL, r: ARM.downR } };
  switch (pose) {
    case 'walk':
      s.step = [0, 1, -1][frame];
      s.bob = frame ? -1 : 0;
      if (frame) s.arms = { l: [[16, 29], [14.5 + s.step * 1.2, 39]], r: [[36, 29], [38 - s.step * 1.2, 37.5]] };
      break;
    case 'bow':
      // 上半身前倾（以腰为轴压扁），背面只露出向两侧张开的手肘
      s.arms = back ? { l: ARM.elbowL, r: ARM.elbowR } : { l: ARM.bowL, r: ARM.bowR };
      s.eyes = 'closed'; s.bend = 0.84; s.sleeves = !back;
      break;
    case 'raise': s.arms = { l: ARM.upL, r: ARM.upR }; s.mouth = 'open'; break;
    case 'raise1': s.arms = { l: ARM.downL, r: ARM.upR }; s.mouth = 'open'; break;
    case 'reach': s.arms = { l: ARM.downL, r: ARM.reachR }; break;
    case 'sit':
      s.seat = 'sit'; s.drop = SEAT_DROP.sit; s.legs = 'none';
      s.arms = back ? { l: hidden(ARM.kneeL), r: hidden(ARM.kneeR) } : { l: ARM.kneeL, r: ARM.kneeR };
      break;
    case 'kneel':
      s.seat = 'kneel'; s.drop = SEAT_DROP.kneel; s.legs = 'none'; s.eyes = 'closed';
      s.arms = { l: ARM.downL, r: back ? hidden(ARM.kneeUpR) : ARM.kneeUpR };
      break;
    case 'sitcry':
      // 跪坐哭泣：跪坐的下半身 + 哭泣的上半身
      s.seat = 'sit'; s.drop = SEAT_DROP.sit; s.legs = 'none';
      s.arms = back ? { l: hidden(ARM.faceL), r: hidden(ARM.faceR) } : { l: ARM.faceL, r: ARM.faceR };
      s.armsOver = true; s.eyes = 'closed'; s.tears = frame ? 3 : 1.5; s.bob = frame; s.blush = 0.5;
      break;
    case 'cry':
      s.arms = back ? { l: hidden(ARM.faceL), r: hidden(ARM.faceR) } : { l: ARM.faceL, r: ARM.faceR };
      s.armsOver = true; s.eyes = 'closed'; s.tears = frame ? 3 : 1.5; s.bob = frame; s.blush = 0.5;
      break;
    case 'fall': s.eyes = 'closed'; s.rot = true; break;
    case 'swing':
      s.arms = { l: ARM.downL, r: frame ? ARM.slashDown : ARM.slashUp };
      s.sword = frame ? 'down' : 'up'; s.brow = 'angry'; s.mouth = 'open'; s.step = frame ? 1 : 0;
      break;
    case 'bound':
      s.arms = { l: ARM.backL, r: ARM.backR }; s.rope = true; s.bob = 1; s.eyes = frame ? 'closed' : undefined;
      break;
    case 'excite':
      s.arms = { l: ARM.fistL, r: ARM.fistR }; s.blush = 0.85; s.mouth = 'open'; s.bob = frame ? -3 : 0;
      break;
    default:
  }
  return s;
}

// 跪姿的下半身（drawHuman 的上半身裁到腰带为止）。oy 为上半身下移后的偏移，腰带下沿 y = 40.6 + oy，地面 y ≈ 62。
// sit 跪坐：双膝着地、臀部坐在脚跟上，下摆在地上铺开；kneel 单膝跪地：左膝着地，右腿屈膝立起，右手搭在膝上。
// under 画在上半身之前（被身体挡住的部分），over 画在之后（背面露出的脚底）
function drawSeat(k, L, F, seat, oy, back, layer) {
  const { ctx, grad, fill, ell, line, poly } = k;
  const P = L.cloth || F;
  const robe = !!L.robe;
  const col = robe ? (L.robeColor || F.l) : P.a;
  const leg = robe ? shade(col, 0.82) : P.d;
  const belt = 40.6 + oy;
  const shoe = (x, yy, rx = 4.2) => fill(grad(0, yy - 2.5, 0, yy + 2.5, '#5a3a22', '#21140a'), ell(x, yy, rx, 2.3));
  const sole = (x, yy) => fill(grad(0, yy - 2, 0, yy + 2, '#8a6a48', '#4a3018'), ell(x, yy, 3, 2.1), C.ink, 0.5);
  if (layer === 'over') {
    if (!back) return;
    if (seat === 'sit') { sole(22, 61.2); sole(30, 61.2); } else sole(19.5, 62);
    return;
  }
  if (seat === 'sit') {
    // 铺开的下摆 / 甲裙 + 两个膝头
    const w = robe ? 17 : 15;
    fill(grad(0, belt - 3, 0, 65, shade(col, 1.1), shade(col, 0.68)), () => {
      ctx.moveTo(17, belt - 1.5); ctx.lineTo(35, belt - 1.5);
      ctx.quadraticCurveTo(26 + w + 2, 58, 26 + w, 62.5); ctx.quadraticCurveTo(26, 66, 26 - w, 62.5);
      ctx.quadraticCurveTo(26 - w - 2, 58, 17, belt - 1.5); ctx.closePath();
    }, C.ink, 0.5);
    if (!back) {
      fill(grad(0, 56, 0, 65, shade(leg, 1.2), shade(leg, 0.8)), ell(20, 61.4, 6.4, 3.4), C.ink, 0.5);
      fill(grad(0, 56, 0, 65, shade(leg, 1.2), shade(leg, 0.8)), ell(32, 61.4, 6.4, 3.4), C.ink, 0.5);
    }
    if (robe) {
      ctx.strokeStyle = shade(col, 0.6); ctx.lineWidth = 0.6;
      for (const fx of [14, 38]) { ctx.beginPath(); ctx.moveTo(fx + (fx < 26 ? 4 : -4), belt + 1); ctx.lineTo(fx, 62); ctx.stroke(); }
    } else {
      // 甲裙鳞片
      ctx.strokeStyle = shade(P.d, 0.6); ctx.lineWidth = 0.5;
      for (let x = 15; x < 37; x += 3) { ctx.beginPath(); ctx.arc(x, belt + 1.5, 1.5, 0, Math.PI); ctx.stroke(); }
    }
    return;
  }
  // kneel：左腿大腿向下、膝盖着地；右腿大腿前伸、小腿竖直、脚踩地
  if (robe) {
    fill(grad(0, belt - 3, 0, 63, shade(col, 1.1), shade(col, 0.7)), () => {
      ctx.moveTo(16, belt - 1.5); ctx.lineTo(36, belt - 1.5); ctx.lineTo(40, 55);
      ctx.lineTo(39, 62); ctx.quadraticCurveTo(26, 64, 13, 62); ctx.quadraticCurveTo(14, 56, 16, belt - 1.5); ctx.closePath();
    }, C.ink, 0.5);
    fill(grad(32, 50, 42, 58, shade(col, 1.2), shade(col, 0.8)), ell(37.5, 54.2, 4.6, 3.6), C.ink, 0.5);
    shoe(39.2, 62);
    if (!back) fill(shade(col, 0.75), ell(19.5, 61.6, 4.4, 2), C.ink, 0.4);
  } else {
    line(22, belt - 1, 19.5, 60.8, 5, leg);
    fill(shade(leg, 1.15), ell(19.5, 61, 3, 2.3), C.ink, 0.5);
    line(30, belt - 1, 37, 54.2, 5.2, leg);
    line(37, 54.2, 37.6, 60.6, 4.6, leg);
    fill(shade(leg, 1.2), ell(37.2, 54, 2.8, 2.6), C.ink, 0.5);
    shoe(38.8, 61.6);
    // 短甲裙
    fill(grad(0, belt - 2, 0, belt + 5, shade(P.a, 1.15), P.d), poly([17, belt - 1.5], [35, belt - 1.5], [36.6, belt + 4], [15.4, belt + 4]), C.ink, 0.5);
  }
}

// 手臂（跪姿时上半身裁到腰带，手可能落在腰带以下，单独补画）
function drawArms(k, L, F, S, oy) {
  const sleeve = L.robe ? shade(L.robeColor || F.l, 0.9) : (L.cloth || F).a;
  for (const a of [S.arms.l, S.arms.r]) {
    k.line(a[0][0], a[0][1] + oy, a[1][0], a[1][1] + oy, 4, sleeve);
    if (a[2] !== false) k.fill(C.skin, k.ell(a[1][0], a[1][1] + oy + 0.6, 2.3, 2.3), C.ink, 0.6);
  }
}

function drawSword(k, hand, dir) {
  const { ctx, grad, line } = k;
  const [hx, hy] = hand;
  const tip = dir === 'up' ? [hx - 7, hy - 24] : [hx + 20, hy + 9];
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(...tip);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3.4; ctx.stroke();
  ctx.strokeStyle = grad(hx, hy, tip[0], tip[1], C.white, C.metal, C.metalD); ctx.lineWidth = 2.2; ctx.stroke();
  const nx = (tip[1] - hy) * 0.12, ny = -(tip[0] - hx) * 0.12;
  line(hx - nx * 0.8, hy - ny * 0.8, hx + nx * 0.8, hy + ny * 0.8, 1.6, C.gold);
}

function drawRope(k, back) {
  const { ctx, line } = k;
  const y = (v) => v + 4;
  for (const ry of [31, 35.5]) line(15.5, y(ry), 36.5, y(ry + 0.6), 1.3, '#a8844a');
  if (back) { line(18.5, y(37), 33.5, y(37), 1.4, '#a8844a'); line(26, y(31), 26, y(40), 1.2, '#a8844a'); }
  else line(26, y(31.3), 27, y(36), 1.1, '#a8844a');
  ctx.lineCap = 'round';
}

export function actorTexture(scene, { name, side = 'player', cls }, pose = 'stand', frame = 0, back = false) {
  const c = actorClass(name, cls);
  const key = `st-${name}-${side}-${c}-${pose}-${frame}-${back ? 'b' : 'f'}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, SW * ST, SH * ST);
  const ctx = tex.getContext();
  ctx.scale(ST, ST);
  ctx.translate(OX, TOP);
  ctx.lineJoin = 'round';
  const k = kit(ctx);
  const F = FACTION[side] || FACTION.player;
  const L = storyLook(name, c, side);
  const S = poseSpec(pose, frame, back);
  const saved = { skin: C.skin, skinD: C.skinD, hair: C.hair };
  if (L.skin) [C.skin, C.skinD] = L.skin;
  if (L.hairColor) C.hair = L.hairColor;
  try {
    // 脚下阴影
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(26, 62, S.rot ? 30 : 15, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (S.rot) {
      // 倒下：整个人逆时针转 90°，头朝左躺在地上
      ctx.save();
      ctx.translate(-3, 72);
      ctx.rotate(-Math.PI / 2);
      drawHuman(k, L, F, 3, false, S);
      ctx.restore();
    } else if (S.seat) {
      // 跪姿：上半身整体下移（裁到腰带为止），下半身画成折叠的腿和铺开的下摆；手臂单独补画（手落在腰带以下）
      const oy = 3 + S.drop + (S.bob || 0);
      drawSeat(k, L, F, S.seat, oy, back, 'under');
      ctx.save();
      ctx.beginPath(); ctx.rect(-OX, -TOP, SW, 40.6 + oy + TOP); ctx.clip();
      drawHuman(k, L, F, oy, false, S);
      ctx.restore();
      if (!S.armsOver) drawArms(k, L, F, S, oy);
      drawSeat(k, L, F, S.seat, oy, back, 'over');
    } else if (S.bend) {
      // 作揖：腰以下照常，腰以上以腰为轴纵向压扁（前倾），头随之降低
      const oy = 3, waist = 40 + oy;
      ctx.save();
      ctx.beginPath(); ctx.rect(-OX, waist, SW, SH); ctx.clip();
      drawHuman(k, L, F, oy, false, S);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(-OX, -TOP, SW, waist + TOP); ctx.clip();
      ctx.translate(0, waist); ctx.scale(1, S.bend); ctx.translate(0, -waist);
      drawHuman(k, L, F, oy, false, S);
      if (S.sleeves) {
        // 双手拢在袖中
        const sl = L.robe ? shade(L.robeColor || F.l, 0.9) : (L.cloth || F).a;
        k.fill(sl, k.ell(26, 34.4 + oy, 5.4, 3.2), C.ink, 0.6);
        k.fill(C.skin, k.ell(26, 33.6 + oy, 2.4, 1.8), C.ink, 0.5);
      }
      ctx.restore();
    } else {
      const oy = 3 + (S.bob || 0);
      drawHuman(k, L, F, oy, false, S);
      if (S.sword) drawSword(k, [S.arms.r[1][0], S.arms.r[1][1] + oy + 0.6], S.sword);
      if (S.rope) drawRope(k, back);
    }
  } finally {
    Object.assign(C, saved);
  }
  tex.refresh();
  return key;
}

// ---------- 表情气泡 ----------
export function emoteTexture(scene, icon) {
  const key = `st-emo-${icon}`;
  if (scene.textures.exists(key)) return key;
  const R = 3, S = 40;
  const tex = scene.textures.createCanvas(key, S * R, S * R);
  const ctx = tex.getContext();
  ctx.scale(R, R);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const bubble = () => {
    ctx.beginPath();
    ctx.ellipse(20, 17, 16, 14, 0, 0, Math.PI * 2);
    ctx.moveTo(14, 28); ctx.lineTo(11, 37); ctx.lineTo(21, 30);
    ctx.fillStyle = '#fffaf0'; ctx.fill();
    ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = 1.6; ctx.stroke();
  };
  const glyph = (t, color, size = 22) => {
    ctx.fillStyle = color; ctx.font = `bold ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, 20, 18);
  };
  switch (icon) {
    case 'shock': bubble(); glyph('！', '#d8281e', 24); break;
    case 'question': bubble(); glyph('？', '#2a5ab8', 24); break;
    case 'joy': bubble(); glyph('♪', '#d0408a', 24); break;
    case 'dots': bubble(); glyph('…', '#3a2a1a', 22); break;
    case 'anger': {
      // 青筋：四段弧
      ctx.strokeStyle = '#d8281e'; ctx.lineWidth = 3.6;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, cx = 20 + Math.cos(a) * 8, cy = 18 + Math.sin(a) * 8;
        ctx.beginPath(); ctx.arc(cx, cy, 6, a + Math.PI * 0.6, a + Math.PI * 1.4); ctx.stroke();
      }
      break;
    }
    case 'sweat': {
      ctx.beginPath(); ctx.moveTo(22, 4); ctx.quadraticCurveTo(34, 22, 22, 32); ctx.quadraticCurveTo(10, 22, 22, 4);
      ctx.fillStyle = '#8ad0ff'; ctx.fill(); ctx.strokeStyle = '#2a6aa8'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.ellipse(19, 22, 2, 4, 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: bubble();
  }
  tex.refresh();
  return key;
}

// 移动方向 → 朝向
export function dirOf(da, db) {
  if (Math.abs(da) >= Math.abs(db)) return da >= 0 ? 'dr' : 'ul';
  return db >= 0 ? 'dl' : 'ur';
}

// 场景中的人物：Container（小人 + 表情气泡），按脚底 y 排序
export class StoryActor {
  constructor(scene, { name, side = 'player', cls, at, face = 'dr', pose = 'stand' }) {
    this.scene = scene;
    this.info = { name, side, cls };
    this.a = at[0]; this.b = at[1];
    const p = isoToScreen(this.a, this.b);
    this.c = scene.add.container(p.x, p.y);
    this.img = scene.add.image(0, 0, actorTexture(scene, this.info)).setOrigin(AX / SW, AY / SH).setScale(ACTOR_SCALE / ST);
    this.c.add(this.img);
    this.dir = DIRS[face] || 'dr';
    this.pose = 'stand';
    this.frame = 0;
    this.sort();
    this.setPose(pose);
  }

  sort() { this.c.setDepth(100 + this.c.y / 4); }

  // 刷新贴图：背面方向用背面贴图，dl / ul 水平镜像
  draw() {
    const back = this.dir === 'ur' || this.dir === 'ul';
    this.img.setTexture(actorTexture(this.scene, this.info, this.pose, this.frame, back));
    this.img.setFlipX(this.dir === 'dl' || this.dir === 'ul');
  }

  setFace(dir) {
    this.dir = DIRS[dir] || this.dir;
    this.draw();
  }

  // 设置动作：循环动作按 loop 间隔换帧，once 动作播放一次后停在最后一帧；返回动作完成的 Promise
  setPose(pose) {
    const def = POSES[pose] || POSES.stand;
    this.anim?.remove();
    this.anim = null;
    this.pose = POSES[pose] ? pose : 'stand';
    this.frame = def.seq ? def.seq[0] : 0;
    this.draw();
    if (def.loop) {
      let i = 0;
      const seq = def.seq || [...Array(def.frames).keys()];
      this.anim = this.scene.time.addEvent({ delay: def.loop, loop: true, callback: () => { i = (i + 1) % seq.length; this.frame = seq[i]; this.draw(); } });
      return Promise.resolve();
    }
    if (def.once) {
      return new Promise((r) => {
        this.anim = this.scene.time.addEvent({
          delay: def.once, repeat: def.frames - 2,
          callback: () => { this.frame += 1; this.draw(); if (this.frame >= def.frames - 1) r(); },
        });
      });
    }
    return Promise.resolve();
  }

  // 走到 [a, b]：默认沿格子先走 a 方向再走 b 方向（折线）；straight 为真时直线走过去。speed 为格 / 秒
  async moveTo([a, b], speed = 5.5, straight = false) {
    const legs = (straight ? [[a, b]] : [[a, this.b], [a, b]]).filter(([na, nb], i, arr) => {
      const [pa, pb] = i ? arr[0] : [this.a, this.b];
      return na !== pa || nb !== pb;
    });
    if (!legs.length) return;
    const prev = this.pose;
    if (prev !== 'walk') this.setPose('walk');
    for (const [na, nb] of legs) {
      const da = na - this.a, db = nb - this.b;
      this.setFace(dirOf(da, db));
      const p = isoToScreen(na, nb);
      const ms = (Math.hypot(da, db) / speed) * 1000;
      await new Promise((r) => this.scene.tweens.add({
        targets: this.c, x: p.x, y: p.y, duration: Math.max(60, ms), onUpdate: () => this.sort(), onComplete: r,
      }));
      this.a = na; this.b = nb;
    }
    this.setPose(prev === 'walk' ? 'stand' : prev);
  }

  // 瞬移（不播放动画）
  place([a, b]) {
    this.a = a; this.b = b;
    const p = isoToScreen(a, b);
    this.c.setPosition(p.x, p.y);
    this.sort();
  }

  // 表情气泡：弹出后保持 hold 毫秒再淡出（默认约 2.5 秒）；返回弹出完成的 Promise
  emote(icon, hold = 2500) {
    if (!EMOTES[icon]) return Promise.resolve();
    this.bubble?.destroy();
    const drop = this.pose === 'kneel' ? SEAT_DROP.kneel : this.pose === 'sit' || this.pose === 'sitcry' ? SEAT_DROP.sit : 0;
    const top = -(FEET_Y - 2) * ACTOR_SCALE + drop * ACTOR_SCALE + (this.pose === 'fall' ? 70 : 0);
    const flip = this.img.flipX ? -1 : 1;
    const b = this.scene.add.image(18 * flip, top, emoteTexture(this.scene, icon)).setScale(0).setOrigin(0.5, 1);
    if (flip < 0) b.setFlipX(true);
    this.c.add(b);
    this.bubble = b;
    return new Promise((r) => {
      this.scene.tweens.add({
        targets: b, scale: 1 / 3 * 1.1, duration: 160, ease: 'Back.easeOut',
        onComplete: () => {
          r();
          this.scene.tweens.add({ targets: b, alpha: 0, delay: Math.max(0, hold - 460), duration: 300, onComplete: () => { b.destroy(); if (this.bubble === b) this.bubble = null; } });
        },
      });
    });
  }

  fade(to, ms = 260) {
    return new Promise((r) => this.scene.tweens.add({ targets: this.c, alpha: to, duration: ms, onComplete: r }));
  }

  destroy() {
    this.anim?.remove();
    this.c.destroy();
  }
}
