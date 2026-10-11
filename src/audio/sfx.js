import { engine } from './engine.js';
import { playZheng, playPipa, playBell, playBigDrum, playSmallDrum, playGong, playDizi } from './instruments.js';

// 音效：sfx(name, opts) 按事件名查表实时合成，输出到音效总线。未解锁 / 后台挂起时无操作，返回 false。
// 每次发声是一个“声部”（独立 GainNode）：同时最多 MAX_VOICES 个，超出时淡出最早的一个；
// 低优先级的音效（脚步）在满员时直接忽略。

const MAX_VOICES = 8;
const voices = [];
// 同一音效（同参数）在 40ms 内重复触发时只播一次（范围策略、连击等同时触发多次）
const recent = new Map();

// ---------- 合成工具（输出到声部 d） ----------
const rnd = (a, b) => a + Math.random() * (b - a);

// 参数曲线：number 为常数，[[比例, 值], ...] 为按时长比例的指数折线
function curve(p, t, dur, v) {
  if (typeof v === 'number') { p.setValueAtTime(v, t); return; }
  p.setValueAtTime(v[0][1], t + v[0][0] * dur);
  for (let i = 1; i < v.length; i++) p.exponentialRampToValueAtTime(v[i][1], t + v[i][0] * dur);
}
// 音量包络：attack 秒升起，之后指数衰减到 t + dur
function envelope(p, t, dur, vol, attack) {
  p.setValueAtTime(0.0001, t);
  p.exponentialRampToValueAtTime(vol, t + Math.min(attack, dur * 0.9));
  p.exponentialRampToValueAtTime(0.0001, t + dur);
}

// 振荡音：f 为频率或折线
function tone(d, t, type, f, dur, vol, attack = 0.004) {
  const ctx = engine.ctx;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  curve(o.frequency, t, dur, f);
  envelope(g.gain, t, dur, vol, attack);
  o.connect(g).connect(d);
  o.start(t);
  o.stop(t + dur + 0.02);
  engine.track([o, g], [o]);
}

// 滤波噪音：f 为滤波频率或折线
function hiss(d, t, dur, vol, { type = 'bandpass', f = 1000, q = 1, attack = 0.004 } = {}) {
  const ctx = engine.ctx;
  const s = ctx.createBufferSource(), b = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = engine.noise();
  s.loop = true;
  b.type = type;
  b.Q.value = q;
  curve(b.frequency, t, dur, f);
  envelope(g.gain, t, dur, vol, attack);
  s.connect(b).connect(g).connect(d);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.02);
  engine.track([s, b, g], [s]);
}

// 金属声：几个非谐和正弦快速衰减
function metal(d, t, f, dur, vol) {
  for (const [r, a] of [[1, 1], [2.41, 0.6], [3.93, 0.4], [5.6, 0.25]]) tone(d, t, 'sine', f * r, dur * (1.2 - a * 0.4), vol * a, 0.002);
}

// 挥动声：带通噪音由低到高扫过
const swish = (d, t, dur, vol, f0 = 500, f1 = 2400, q = 1.4) => hiss(d, t, dur, vol, { f: [[0, f0], [0.6, f1], [1, f1 * 0.7]], q, attack: dur * 0.55 });
// 闷响：低频正弦下滑 + 低通噪音
function thud(d, t, vol, f = 130, dur = 0.22) {
  tone(d, t, 'sine', [[0, f * 1.8], [0.3, f], [1, f * 0.6]], dur, vol);
  hiss(d, t, dur * 0.5, vol * 0.7, { type: 'lowpass', f: 900, q: 0.6 });
}

// ---------- 兵器 ----------
// 挥动时机（秒）大致对齐 attackFx 各兵器的出手时刻；命中声由 hit 单独播放
const BLADE = ['sword', 'spear', 'halberd', 'glaive', 'twin', 'none'];
const BLUNT = ['club', 'fist', 'axe', 'catapult'];
const SWING = {
  sword: (d, t) => { swish(d, t + 0.14, 0.2, 0.35, 700, 3200); metal(d, t + 0.02, 2600, 0.18, 0.04); },
  spear: (d, t) => { swish(d, t + 0.17, 0.14, 0.35, 900, 3800, 2); metal(d, t + 0.05, 3100, 0.12, 0.03); },
  halberd: (d, t) => { swish(d, t + 0.2, 0.32, 0.4, 260, 1500, 1); metal(d, t + 0.05, 1500, 0.3, 0.035); },
  glaive: (d, t) => { swish(d, t + 0.2, 0.3, 0.4, 320, 1900, 1.1); metal(d, t + 0.06, 1900, 0.28, 0.035); },
  axe: (d, t) => { swish(d, t + 0.22, 0.28, 0.42, 220, 1200, 0.9); },
  club: (d, t) => { swish(d, t + 0.12, 0.3, 0.38, 180, 900, 0.8); },
  bow: (d, t) => {
    // 弓弦：短促拨弦 + 箭矢破空（由高到低）
    playPipa(d, t + 0.14, 43, 0.12, 0.9, { release: 0.1 });
    tone(d, t + 0.14, 'triangle', [[0, 180], [1, 110]], 0.12, 0.2);
    hiss(d, t + 0.17, 0.32, 0.18, { f: [[0, 4200], [1, 1600]], q: 3, attack: 0.04 });
  },
  fan: (d, t) => { hiss(d, t + 0.1, 0.6, 0.25, { f: [[0, 500], [0.5, 1800], [1, 900]], q: 3, attack: 0.25 }); playBell(d, t + 0.12, 88, 0.4, 0.25); },
  staff: (d, t) => {
    // 法杖：上行的清亮泛音
    [84, 88, 91, 96].forEach((n, i) => tone(d, t + 0.12 + i * 0.05, 'sine', 440 * 2 ** ((n - 69) / 12), 0.35, 0.06));
    hiss(d, t + 0.1, 0.4, 0.06, { type: 'highpass', f: 5000, attack: 0.15 });
  },
  twin: (d, t) => { swish(d, t + 0.12, 0.15, 0.3, 800, 3400); swish(d, t + 0.28, 0.15, 0.3, 900, 3600); metal(d, t + 0.03, 2900, 0.12, 0.03); },
  fist: (d, t) => { swish(d, t + 0.08, 0.1, 0.3, 400, 1600, 1); },
  catapult: (d, t) => {
    // 炮车：木架吱呀 + 抛射闷响 + 石块破空
    tone(d, t, 'sawtooth', [[0, 90], [1, 130]], 0.18, 0.05, 0.05);
    thud(d, t + 0.3, 0.45, 90, 0.25);
    hiss(d, t + 0.34, 0.45, 0.12, { f: [[0, 600], [1, 300]], q: 1.5, attack: 0.1 });
  },
};
SWING.none = SWING.sword;

// 命中：刃器为劈砍 + 金属碰撞，钝器为重击，箭为扎入，扇 / 杖为法术爆开
function impact(d, t, weapon, crit) {
  const k = crit ? 1.35 : 1;
  if (BLUNT.includes(weapon)) {
    thud(d, t, 0.6 * k, weapon === 'fist' ? 160 : 110, weapon === 'catapult' ? 0.4 : 0.25);
    hiss(d, t, 0.08, 0.25 * k, { type: 'highpass', f: 1500 });
  } else if (weapon === 'bow') {
    hiss(d, t, 0.06, 0.35 * k, { f: 900, q: 1.5 });
    tone(d, t, 'triangle', [[0, 320], [1, 180]], 0.08, 0.25 * k);
  } else if (weapon === 'fan' || weapon === 'staff') {
    hiss(d, t, 0.25, 0.25 * k, { f: [[0, 3000], [1, 800]], q: 1, attack: 0.01 });
    playBell(d, t, weapon === 'fan' ? 81 : 86, 0.3, 0.35 * k);
  } else {
    hiss(d, t, 0.1, 0.4 * k, { type: 'highpass', f: 2200, q: 0.7 });
    thud(d, t, 0.35 * k, 150, 0.16);
    metal(d, t, weapon === 'halberd' || weapon === 'glaive' ? 1700 : 2300, 0.2, 0.06 * k);
  }
  if (crit) {
    playBigDrum(d, t, 33, 0.6, 0.6);
    metal(d, t + 0.01, 1200, 0.5, 0.06);
  }
}

// ---------- 策略 ----------
const SCHOOL = {
  fire(d, t) {
    hiss(d, t, 1.1, 0.4, { type: 'lowpass', f: [[0, 300], [0.35, 2600], [1, 500]], q: 1.2, attack: 0.25 });
    tone(d, t, 'sine', [[0, 70], [1, 45]], 1.0, 0.25, 0.2);
    // 噼啪声
    for (let i = 0; i < 14; i++) hiss(d, t + rnd(0.1, 1), 0.03, rnd(0.08, 0.2), { f: rnd(1500, 4500), q: 4 });
  },
  water(d, t) {
    hiss(d, t, 1.3, 0.35, { type: 'lowpass', f: [[0, 300], [0.4, 1800], [1, 250]], q: 2, attack: 0.45 });
    hiss(d, t + 0.3, 0.9, 0.15, { f: [[0, 2500], [1, 900]], q: 1, attack: 0.2 });
    for (let i = 0; i < 9; i++) {
      const f0 = rnd(300, 700);
      tone(d, t + rnd(0.15, 1.1), 'sine', [[0, f0], [1, f0 * 2.2]], 0.05, 0.08);
    }
  },
  earth(d, t) {
    hiss(d, t, 1.2, 0.45, { type: 'lowpass', f: [[0, 120], [0.5, 260], [1, 90]], q: 1, attack: 0.3 });
    [0.25, 0.48, 0.66, 0.82].forEach((x, i) => {
      playBigDrum(d, t + x, 31 + i * 2, 0.5, 0.7);
      hiss(d, t + x, 0.12, 0.2, { f: 1200, q: 0.8 });
    });
  },
  wind(d, t) {
    hiss(d, t, 1.3, 0.3, { f: [[0, 500], [0.45, 2400], [1, 700]], q: 7, attack: 0.4 });
    hiss(d, t + 0.1, 1.1, 0.2, { f: [[0, 900], [0.5, 3200], [1, 1200]], q: 9, attack: 0.35 });
    hiss(d, t, 1.2, 0.12, { type: 'lowpass', f: 600, attack: 0.4 });
  },
  thunder(d, t) {
    hiss(d, t, 0.08, 0.6, { type: 'highpass', f: 1200, q: 0.5, attack: 0.001 });
    hiss(d, t + 0.02, 1.3, 0.55, { type: 'lowpass', f: [[0, 1400], [1, 120]], q: 0.8, attack: 0.02 });
    tone(d, t, 'sine', [[0, 60], [1, 35]], 1.0, 0.4, 0.01);
  },
  status(d, t) {
    // 异常 / 减益：两个失谐的下行音 + 低音嗡鸣
    for (const [f0, f1] of [[660, 330], [698, 349]]) tone(d, t, 'triangle', [[0, f0], [1, f1]], 0.9, 0.09, 0.1);
    tone(d, t, 'sine', [[0, 110], [1, 98]], 1.0, 0.18, 0.2);
    hiss(d, t, 0.9, 0.08, { f: [[0, 3000], [1, 400]], q: 2, attack: 0.5 });
  },
  buff(d, t) {
    [72, 76, 79, 84].forEach((n, i) => playBell(d, t + i * 0.08, n, 0.5, 0.45));
    hiss(d, t, 0.6, 0.06, { type: 'highpass', f: 6000, attack: 0.3 });
  },
  heal(d, t) {
    [72, 74, 79, 81, 84].forEach((n, i) => playZheng(d, t + i * 0.09, n, 0.5, 0.45));
    tone(d, t, 'sine', 523.25, 0.9, 0.08, 0.3);
    tone(d, t, 'sine', 784, 0.9, 0.05, 0.4);
  },
};

// 回合开始：我军战鼓 + 小锣，敌军低沉的大鼓 + 大锣，友军板鼓 + 钟
const TURN = {
  player(d, t) {
    [0, 0.14, 0.28].forEach((x, i) => playBigDrum(d, t + x, 36, 0.5, i === 2 ? 0.95 : 0.7));
    playGong(d, t + 0.42, 420, 0.8, 0.5, { rise: true });
  },
  enemy(d, t) {
    playBigDrum(d, t, 31, 0.8, 0.95);
    playBigDrum(d, t + 0.3, 31, 0.8, 0.95);
    playGong(d, t + 0.3, 150, 1.4, 0.55);
  },
  ally(d, t) {
    [0, 0.1, 0.2].forEach((x) => playSmallDrum(d, t + x, 57, 0.15, 0.6));
    playBell(d, t + 0.3, 76, 0.8, 0.5);
  },
};

// 天气：0 晴 / 1 阴 / 2 雨 / 3 豪雨 / 4 雪
const WEATHER = [
  (d, t) => { [79, 84, 88].forEach((n, i) => playBell(d, t + i * 0.12, n, 0.8, 0.35)); },
  (d, t) => { hiss(d, t, 1.4, 0.2, { type: 'lowpass', f: [[0, 200], [0.5, 600], [1, 200]], attack: 0.6 }); },
  (d, t) => { hiss(d, t, 1.6, 0.18, { type: 'highpass', f: 2500, q: 0.5, attack: 0.6 }); },
  (d, t) => { hiss(d, t, 1.8, 0.28, { type: 'highpass', f: 1600, q: 0.5, attack: 0.5 }); SCHOOL.thunder(d, t + 0.5); },
  (d, t) => {
    hiss(d, t, 1.6, 0.08, { type: 'lowpass', f: 900, attack: 0.7 });
    [91, 96, 93, 98].forEach((n, i) => playBell(d, t + 0.2 + i * 0.22, n, 0.5, 0.15));
  },
];

// ---------- 音效表：dur 为声部占用时长（秒），play(d, t, opts) ----------
const SOUNDS = {
  select: { dur: 0.3, play: (d, t) => playZheng(d, t, 81, 0.15, 0.4) },
  confirm: { dur: 0.35, play: (d, t) => { playPipa(d, t, 76, 0.08, 0.45); playPipa(d, t + 0.06, 83, 0.15, 0.5); } },
  cancel: { dur: 0.35, play: (d, t) => { playPipa(d, t, 79, 0.08, 0.35); playPipa(d, t + 0.07, 72, 0.15, 0.35); } },
  // 脚步：opts.kind 'foot' | 'horse' | 'wheel'
  step: {
    dur: 0.18, low: true,
    play(d, t, o) {
      if (o.kind === 'horse') {
        for (const x of [0, 0.06]) { hiss(d, t + x, 0.04, 0.05, { f: 1400, q: 2 }); tone(d, t + x, 'sine', [[0, 260], [1, 160]], 0.05, 0.03); }
      } else if (o.kind === 'wheel') {
        hiss(d, t, 0.14, 0.14, { type: 'lowpass', f: 300, attack: 0.03 });
        tone(d, t, 'sawtooth', [[0, 70], [1, 60]], 0.1, 0.03, 0.02);
      } else {
        hiss(d, t, 0.07, 0.16, { type: 'lowpass', f: rnd(450, 650), q: 0.8 });
      }
    },
  },
  attack: { dur: 0.75, play: (d, t, o) => (SWING[o.weapon] || SWING.sword)(d, t) },
  hit: { dur: 0.7, play: (d, t, o) => impact(d, t, o.weapon, o.crit) },
  // 会心：切入画面时的蓄势 + 战鼓
  crit: {
    dur: 0.8,
    play(d, t) {
      hiss(d, t, 0.25, 0.25, { f: [[0, 600], [1, 4000]], q: 1.5, attack: 0.2 });
      playBigDrum(d, t + 0.05, 35, 0.6, 1);
      playSmallDrum(d, t + 0.05, 60, 0.2, 0.8);
      playGong(d, t + 0.08, 600, 0.5, 0.35, { rise: true });
    },
  },
  miss: { dur: 0.3, play: (d, t) => { swish(d, t, 0.18, 0.22, 1200, 4500, 1.8); tone(d, t + 0.03, 'sine', [[0, 500], [1, 900]], 0.1, 0.05); } },
  // 施法：脚下法阵升起
  cast: {
    dur: 0.8,
    play(d, t) {
      [67, 71, 74, 79].forEach((n, i) => tone(d, t + i * 0.07, 'sine', 440 * 2 ** ((n - 69) / 12), 0.45, 0.06, 0.03));
      hiss(d, t, 0.6, 0.1, { f: [[0, 800], [1, 5000]], q: 2, attack: 0.4 });
    },
  },
  // 策略：opts.school 'fire' | 'water' | 'earth' | 'wind' | 'thunder' | 'status' | 'buff' | 'heal'
  spell: { dur: 1.4, play: (d, t, o) => (SCHOOL[o.school] || SCHOOL.status)(d, t) },
  levelup: {
    dur: 1.4,
    play(d, t) {
      [67, 72, 76, 79].forEach((n, i) => playPipa(d, t + i * 0.08, n, 0.2, 0.6));
      playZheng(d, t + 0.32, 84, 0.8, 0.6);
      playBell(d, t + 0.32, 84, 0.8, 0.35);
    },
  },
  promote: {
    dur: 2.2,
    play(d, t) {
      playGong(d, t, 330, 1.6, 0.5, { rise: true });
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => playZheng(d, t + 0.1 + i * 0.05, n, 0.6, 0.45));
      [72, 76, 79].forEach((n) => playBell(d, t + 0.5, n, 1.2, 0.35));
    },
  },
  // 得到道具 / 宝物
  item: { dur: 0.9, play: (d, t) => { playBell(d, t, 84, 0.5, 0.45); playBell(d, t + 0.12, 91, 0.7, 0.45); } },
  treasure: {
    dur: 1.6,
    play(d, t) {
      [79, 84, 88, 91].forEach((n, i) => playBell(d, t + i * 0.1, n, 0.9, 0.45));
      playGong(d, t + 0.4, 700, 0.8, 0.25, { rise: true });
      playDizi(d, t + 0.4, 91, 0.5, 0.35);
    },
  },
  // 撤退：倒地闷响 + 下行叹息；主将另加低锣
  retreat: {
    dur: 1.4,
    play(d, t, o) {
      thud(d, t + 0.35, 0.4, 100, 0.3);
      tone(d, t, 'triangle', [[0, 392], [1, 196]], 0.7, 0.08, 0.05);
      hiss(d, t + 0.4, 0.6, 0.08, { type: 'lowpass', f: 800, attack: 0.1 });
      if (o.leader) playGong(d, t + 0.1, 47, 1.2, 0.6); // MIDI 47 ≈ 123Hz
    },
  },
  weather: { dur: 2.2, play: (d, t, o) => (WEATHER[o.weather] || WEATHER[1])(d, t) },
  turn: { dur: 1.6, play: (d, t, o) => (TURN[o.faction] || TURN.player)(d, t) },
};

// 各音效的整体增益（按实测峰值校准：界面音约 0.1–0.15，命中约 0.35，会心 / 回合开始约 0.4–0.5）
const GAIN = {
  step: 4,
  miss: 1.6,
  cast: 2.5,
  hit: (o) => (o.crit ? 0.6 : ['bow', 'fan', 'staff'].includes(o.weapon) ? 1.6 : 0.7),
  spell: (o) => ({ wind: 3, water: 1.8, earth: 0.6 }[o.school] ?? 1),
  turn: (o) => (o.faction === 'ally' ? 1 : 0.65),
  weather: (o) => [1, 2.5, 1.2, 0.8, 2][o.weather] ?? 1,
};

// 声部：独立 GainNode → 音效总线；时长到后先短淡出（避免截断余音出现爆音）再断开
function release(v) {
  if (v.done) return;
  v.done = true;
  const i = voices.indexOf(v);
  if (i >= 0) voices.splice(i, 1);
  try { v.g.gain.setTargetAtTime(0, engine.now, 0.03); } catch { /* 上下文已关闭 */ }
  setTimeout(() => {
    try { v.g.disconnect(); } catch { /* 已断开 */ }
    engine.activeNodes -= 1;
  }, 200);
}

function voice(dur, low, gain) {
  const now = engine.now;
  for (const v of [...voices]) if (v.end < now) voices.splice(voices.indexOf(v), 1);
  if (voices.length >= MAX_VOICES) {
    if (low) return null;
    // 淡出最早的声部（节点随后由各自的定时器断开）
    const old = voices.shift();
    old.g.gain.setTargetAtTime(0, now, 0.015);
  }
  const g = engine.ctx.createGain();
  g.gain.value = gain;
  g.connect(engine.sfxBus);
  engine.activeNodes += 1;
  const v = { g, end: now + dur };
  voices.push(v);
  setTimeout(() => release(v), (dur + 0.4) * 1000);
  return v;
}

export function sfx(name, opts = {}) {
  if (!engine.ready) return false;
  const def = SOUNDS[name];
  if (!def) { console.warn('未知音效', name); return false; }
  const key = name + JSON.stringify(opts);
  const now = performance.now();
  if (now - (recent.get(key) ?? -1e9) < 40) return false;
  recent.set(key, now);
  if (recent.size > 64) recent.clear();
  try {
    const k = GAIN[name];
    const v = voice(def.dur, def.low, typeof k === 'function' ? k(opts) : k ?? 1);
    if (!v) return false;
    def.play(v.g, engine.now + 0.005, opts);
    return true;
  } catch (e) {
    // 音效出错不能影响游戏流程
    console.error('音效出错', name, e);
    return false;
  }
}

export const SFX_NAMES = Object.keys(SOUNDS);
export const sfxVoices = () => voices.length;

// 策略 → 音效系别
export function spellSchool(sp) {
  if (!sp) return 'status';
  if (sp.special === 'thunder') return 'thunder';
  if (sp.special === 'zhuque') return 'fire';
  if (sp.special === 'xuanwu') return 'water';
  if (sp.elem) return sp.elem;
  if (sp.cat === 'buff') return 'buff';
  if (['heal', 'mp', 'cure'].includes(sp.cat) || sp.special === 'again' || sp.special === 'meditate') return 'heal';
  return 'status';
}

// 脚步类型：骑马 / 车辆 / 步行
export function stepKind(look) {
  if (look?.machine) return 'wheel';
  return look?.horse ? 'horse' : 'foot';
}
