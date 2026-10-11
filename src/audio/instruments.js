import { engine } from './engine.js';

// 乐器音色：统一签名 play(dest, time, note, dur, vel = 0.8, opts = {})
//   dest：'music' / 'sfx' / AudioNode；time：AudioContext 时间（null 为立即）；note：MIDI 号（≤127）或频率（Hz）；
//   dur：音符时值（秒，之后进入释音）；vel：力度 0–1。返回发声结束时间。
// 所有节点经 engine.track 登记，声源结束后自动断开。未解锁时无操作（返回 time）。配乐子任务的音序器直接复用这些函数。

export const hz = (note) => (note > 127 ? note : 440 * 2 ** ((note - 69) / 12));

// ---------- 节点工具 ----------
const C = () => engine.ctx;
function osc(type, f) {
  const o = C().createOscillator();
  o.type = type;
  o.frequency.value = f;
  return o;
}
function amp(v = 0) {
  const g = C().createGain();
  g.gain.value = v;
  return g;
}
function filt(type, f, q = 0.7, gain = 0) {
  const b = C().createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = gain;
  return b;
}
// 噪音声源：从共用噪音缓冲的随机位置开始
function noiseSrc() {
  const s = C().createBufferSource();
  s.buffer = engine.noise();
  s.loop = true;
  s.loopStart = 0;
  s.loopEnd = s.buffer.duration;
  return s;
}
const startNoise = (s, t, end) => { s.start(t, Math.random() * 1.5); s.stop(end); };

// 打击包络：t 起 attack 秒升到 peak，再按 decay 秒指数衰减
function hit(p, t, peak, attack, decay) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.setTargetAtTime(0, t + attack, decay / 4);
}
// 持续音包络：attack 升起，保持到 t + dur，再 release 秒收尾
function sustain(p, t, peak, attack, dur, release, level = 1) {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  if (level !== 1) p.setTargetAtTime(peak * level, t + attack, 0.15);
  p.setValueAtTime(peak * level, Math.max(t + attack, t + dur));
  p.setTargetAtTime(0, Math.max(t + attack, t + dur), release / 4);
}

// 颤音：LFO → 频率参数，delay 秒后渐入
function vibrato(target, t, end, rate, depth, delay) {
  const lfo = osc('sine', rate), g = amp(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0, t + delay);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.3);
  lfo.connect(g);
  for (const p of target) g.connect(p);
  lfo.start(t);
  lfo.stop(end);
  return [lfo, g];
}

function begin(time) {
  if (!engine.ready) return null;
  return Math.max(time ?? 0, engine.now + 0.005);
}

// ---------- 拨弦：Karplus-Strong（噪音激励 + 反馈延迟）预先算成缓冲并缓存 ----------
const KS_RATE = 24000;
const ksCache = new Map();
function ksBuffer(kind, f, sec, t60, bright, pos) {
  const key = `${kind}:${f.toFixed(2)}`;
  if (ksCache.has(key)) return ksCache.get(key);
  const N = Math.max(2, Math.floor(KS_RATE / f - 0.5));
  const n = Math.floor(KS_RATE * sec);
  const buf = C().createBuffer(1, n, KS_RATE);
  const d = buf.getChannelData(0);
  const line = new Float32Array(N);
  // 激励：低通噪音（bright 越大越亮），再按拨弦位置做梳状相减（离琴码越近越亮、越薄）
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += ((Math.random() * 2 - 1) - lp) * bright; line[i] = lp; }
  const off = Math.max(1, Math.floor(N * pos));
  const ex = line.map((v, i) => v - line[(i + off) % N] * 0.9);
  line.set(ex);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += line[i];
  mean /= N;
  for (let i = 0; i < N; i++) line[i] -= mean;
  // 每个周期的损耗：t60 秒衰减 60dB
  const g = 0.001 ** (1 / ((KS_RATE / (N + 0.5)) * t60));
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const idx = i % N;
    const v = line[idx];
    d[i] = v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
    line[idx] = g * 0.5 * (v + line[(idx + 1) % N]);
  }
  if (peak > 0) for (let i = 0; i < n; i++) d[i] /= peak;
  // 实际周期为 N + 0.5 个采样：播放速率补正到目标频率
  const out = { buf, rate: f / (KS_RATE / (N + 0.5)) };
  if (ksCache.size > 96) ksCache.delete(ksCache.keys().next().value);
  ksCache.set(key, out);
  return out;
}

function pluck(kind, dest, t, f, dur, vel, cfg, opts) {
  const { buf, rate } = ksBuffer(kind, f, cfg.sec, cfg.t60, cfg.bright, cfg.pos);
  const src = C().createBufferSource();
  src.buffer = buf;
  src.playbackRate.setValueAtTime(rate, t);
  // 按音 / 吟揉：opts.bend 半音数，拨弦后滑到目标音
  if (opts.bend) src.playbackRate.setTargetAtTime(rate * 2 ** (opts.bend / 12), t + 0.08, 0.06);
  const body = filt('peaking', cfg.body, 1.2, 4);
  const tone = filt('lowpass', Math.min(12000, f * cfg.lp + 1500), 0.5);
  const g = amp(0);
  const release = opts.release ?? cfg.release;
  const stopAt = Math.min(t + buf.duration / rate, t + dur + release);
  g.gain.setValueAtTime(vel * cfg.gain, t);
  g.gain.setValueAtTime(vel * cfg.gain, Math.max(t, stopAt - release));
  g.gain.linearRampToValueAtTime(0, stopAt);
  src.connect(body).connect(tone).connect(g).connect(engine.bus(dest));
  src.start(t);
  src.stop(stopAt + 0.02);
  engine.track([src, body, tone, g], [src]);
  return stopAt;
}

// 古筝：明亮、余音长
export function playZheng(dest, time, note, dur = 1, vel = 0.8, opts = {}) {
  const t = begin(time);
  if (t == null) return time;
  return pluck('zheng', dest, t, hz(note), dur, vel, { sec: 3, t60: 2.6, bright: 0.55, pos: 0.18, body: 320, lp: 6, gain: 0.5, release: 0.6 }, opts);
}

// 琵琶：清脆、衰减快；opts.tremolo 轮指（时值内连续弹挑）
export function playPipa(dest, time, note, dur = 0.6, vel = 0.8, opts = {}) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note), cfg = { sec: 1.6, t60: 1.1, bright: 0.8, pos: 0.1, body: 600, lp: 8, gain: 0.45, release: 0.25 };
  if (!opts.tremolo) return pluck('pipa', dest, t, f, dur, vel, cfg, opts);
  for (let x = 0; x < dur; x += 0.065) pluck('pipa', dest, t + x, f, 0.07, vel * (x === 0 ? 1 : 0.6 + Math.random() * 0.15), cfg, { release: 0.12 });
  return pluck('pipa', dest, t + dur, f, 0.05, vel * 0.5, cfg, {});
}

// 笛子：正弦 + 少量三角泛音，延迟颤音，气声噪音；opts.slide 起音滑入的半音数
export function playDizi(dest, time, note, dur = 0.8, vel = 0.8, opts = {}) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note), end = t + dur + 0.15;
  const o1 = osc('sine', f), o2 = osc('triangle', f * 2);
  if (opts.slide) {
    for (const [o, k] of [[o1, 1], [o2, 2]]) {
      o.frequency.setValueAtTime(f * k * 2 ** (-opts.slide / 12), t);
      o.frequency.exponentialRampToValueAtTime(f * k, t + 0.09);
    }
  }
  const g2 = amp(0.12);
  const g = amp(0);
  sustain(g.gain, t, vel * 0.32, 0.05, dur, 0.12, 0.85);
  const [lfo, lg] = vibrato([o1.frequency], t, end, 5.4, f * 0.007, 0.22);
  const lg2 = amp(2);
  lg.connect(lg2).connect(o2.frequency);
  // 气声：带通噪音，起音处更明显（吐音）
  const ns = noiseSrc(), bp = filt('bandpass', Math.min(9000, f * 3), 0.9), ng = amp(0);
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(vel * 0.09, t + 0.02);
  ng.gain.setTargetAtTime(vel * 0.025, t + 0.03, 0.05);
  ng.gain.setValueAtTime(vel * 0.025, t + dur);
  ng.gain.setTargetAtTime(0, t + dur, 0.03);
  const out = engine.bus(dest);
  o1.connect(g);
  o2.connect(g2).connect(g);
  ns.connect(bp).connect(ng).connect(out);
  g.connect(out);
  o1.start(t); o2.start(t); o1.stop(end); o2.stop(end);
  startNoise(ns, t, end);
  engine.track([o1, o2, g2, g, lfo, lg, lg2, ns, bp, ng], [o1, o2, lfo, ns]);
  return end;
}

// 二胡：锯齿波经低通与鼻音峰，起音滑音 + 颤音；opts.slide 半音数（默认从下方 1 个半音滑入）
export function playErhu(dest, time, note, dur = 0.8, vel = 0.8, opts = {}) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note), end = t + dur + 0.2;
  const o = osc('sawtooth', f);
  const slide = opts.slide ?? 1;
  if (slide) {
    o.frequency.setValueAtTime(f * 2 ** (-slide / 12), t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
  }
  const lp = filt('lowpass', Math.min(8000, f * 4 + 900), 1.1);
  const nasal = filt('peaking', 1300, 2.2, 5);
  const hp = filt('highpass', 180, 0.7);
  const g = amp(0);
  sustain(g.gain, t, vel * 0.22, 0.09, dur, 0.16, 0.9);
  const [lfo, lg] = vibrato([o.frequency], t, end, 6.2, f * 0.013, 0.15);
  // 擦弦噪音
  const ns = noiseSrc(), bp = filt('bandpass', 2500, 1.5), ng = amp(0);
  sustain(ng.gain, t, vel * 0.02, 0.05, dur, 0.1, 0.6);
  const out = engine.bus(dest);
  o.connect(lp).connect(nasal).connect(hp).connect(g).connect(out);
  ns.connect(bp).connect(ng).connect(out);
  o.start(t); o.stop(end);
  startNoise(ns, t, end);
  engine.track([o, lp, nasal, hp, g, lfo, lg, ns, bp, ng], [o, lfo, ns]);
  return end;
}

// 编钟：一钟双音的非谐和泛音，高泛音衰减快
const BELL = [[1, 1, 1], [1.19, 0.45, 0.8], [2.0, 0.3, 0.55], [2.92, 0.22, 0.35], [4.1, 0.14, 0.22], [5.43, 0.1, 0.15]];
export function playBell(dest, time, note, dur = 2, vel = 0.8) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note), ring = Math.max(0.6, dur) + 0.8, end = t + ring + 0.3;
  const out = engine.bus(dest);
  const nodes = [], srcs = [];
  for (const [r, a, k] of BELL) {
    const o = osc('sine', f * r * (1 + (Math.random() - 0.5) * 0.002)), g = amp(0);
    hit(g.gain, t, vel * a * 0.22, 0.003, ring * k * 1.6);
    o.connect(g).connect(out);
    o.start(t); o.stop(end);
    nodes.push(o, g); srcs.push(o);
  }
  // 敲击声
  const ns = noiseSrc(), bp = filt('bandpass', Math.min(8000, f * 3), 1.5), ng = amp(0);
  hit(ng.gain, t, vel * 0.08, 0.002, 0.05);
  ns.connect(bp).connect(ng).connect(out);
  startNoise(ns, t, t + 0.15);
  engine.track([...nodes, ns, bp, ng], [...srcs, ns]);
  return end;
}

// 大鼓：低频正弦下滑 + 鼓皮噪音；note 为音高（默认 MIDI 35，约 62Hz）
export function playBigDrum(dest, time, note = 35, dur = 0.8, vel = 0.8) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note);
  const dec = Math.max(0.3, Math.min(1.2, dur)), end = t + dec + 0.2;
  const o = osc('sine', f * 2.2), g = amp(0);
  o.frequency.setValueAtTime(f * 2.2, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
  hit(g.gain, t, vel * 0.9, 0.003, dec);
  const o2 = osc('triangle', f * 1.5), g2 = amp(0);
  hit(g2.gain, t, vel * 0.18, 0.003, dec * 0.5);
  const ns = noiseSrc(), lp = filt('lowpass', 700, 0.8), ng = amp(0);
  hit(ng.gain, t, vel * 0.35, 0.002, 0.12);
  const out = engine.bus(dest);
  o.connect(g).connect(out);
  o2.connect(g2).connect(out);
  ns.connect(lp).connect(ng).connect(out);
  o.start(t); o.stop(end); o2.start(t); o2.stop(end);
  startNoise(ns, t, t + 0.25);
  engine.track([o, g, o2, g2, ns, lp, ng], [o, o2, ns]);
  return end;
}

// 小鼓（板鼓）：短促清脆
export function playSmallDrum(dest, time, note = 55, dur = 0.2, vel = 0.8) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note);
  const dec = Math.max(0.08, Math.min(0.4, dur)), end = t + dec + 0.1;
  const o = osc('triangle', f * 1.4), g = amp(0);
  o.frequency.setValueAtTime(f * 1.4, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  hit(g.gain, t, vel * 0.35, 0.002, dec * 0.6);
  const ns = noiseSrc(), bp = filt('bandpass', 2400, 0.9), ng = amp(0);
  hit(ng.gain, t, vel * 0.5, 0.001, dec);
  const out = engine.bus(dest);
  o.connect(g).connect(out);
  ns.connect(bp).connect(ng).connect(out);
  o.start(t); o.stop(end);
  startNoise(ns, t, end);
  engine.track([o, g, ns, bp, ng], [o, ns]);
  return end;
}

// 锣：一组非谐和泛音 + 带通噪音，余音长；opts.rise 音高上扬（小锣），否则略下沉（大锣）
const GONG = [1, 1.47, 1.98, 2.44, 2.97, 3.53, 4.21, 5.12];
export function playGong(dest, time, note = 180, dur = 2.5, vel = 0.8, opts = {}) {
  const t = begin(time);
  if (t == null) return time;
  const f = hz(note);
  const ring = Math.max(0.5, dur), end = t + ring + 0.4;
  const out = engine.bus(dest);
  const bend = opts.rise ? 1.12 : 0.97;
  const nodes = [], srcs = [];
  GONG.forEach((r, i) => {
    const o = osc('sine', f * r * (1 + (Math.random() - 0.5) * 0.01)), g = amp(0);
    o.frequency.setTargetAtTime(o.frequency.value * bend, t + 0.02, opts.rise ? 0.12 : 0.6);
    hit(g.gain, t, (vel * 0.16) / (1 + i * 0.35), 0.004 + i * 0.002, ring * (1 - i * 0.07));
    o.connect(g).connect(out);
    o.start(t); o.stop(end);
    nodes.push(o, g); srcs.push(o);
  });
  const ns = noiseSrc(), bp = filt('bandpass', f * 9, 0.6), ng = amp(0);
  hit(ng.gain, t, vel * 0.18, 0.003, ring * 0.45);
  ns.connect(bp).connect(ng).connect(out);
  startNoise(ns, t, end);
  engine.track([...nodes, ns, bp, ng], [...srcs, ns]);
  return end;
}

export const INSTRUMENTS = {
  zheng: playZheng, pipa: playPipa, dizi: playDizi, erhu: playErhu,
  bell: playBell, bigDrum: playBigDrum, smallDrum: playSmallDrum, gong: playGong,
};

// 试听：五声音阶短句（打击乐为节奏型），输出到配乐总线
const PHRASE = [62, 64, 67, 69, 72, 69, 67, 64];
export function audition(name) {
  if (!engine.ready) return 'audio locked: click the page first';
  const t0 = engine.now + 0.05;
  if (!name) {
    // 依次试听全部音色
    let t = t0;
    for (const k of Object.keys(INSTRUMENTS)) { setTimeout(() => audition(k), (t - t0) * 1000); t += 3; }
    return Object.keys(INSTRUMENTS);
  }
  const play = INSTRUMENTS[name];
  if (!play) return `unknown: ${Object.keys(INSTRUMENTS).join(' / ')}`;
  if (name === 'bigDrum' || name === 'smallDrum') {
    [0, 0.5, 0.75, 1, 1.5].forEach((x, i) => play('music', t0 + x, undefined, 0.6, i % 2 ? 0.6 : 0.9));
  } else if (name === 'gong') {
    play('music', t0, 160, 2.5, 0.9);
    play('music', t0 + 1.2, 520, 0.6, 0.6, { rise: true });
  } else if (name === 'bell') {
    [69, 72, 74, 76].forEach((n, i) => play('music', t0 + i * 0.45, n, 1.5, 0.8));
  } else {
    const step = name === 'pipa' || name === 'zheng' ? 0.22 : 0.32;
    PHRASE.forEach((n, i) => play('music', t0 + i * step, n + (name === 'dizi' ? 12 : 0), i === PHRASE.length - 1 ? 1 : step, 0.8));
    if (name === 'pipa') play('music', t0 + PHRASE.length * step, 74, 0.8, 0.7, { tremolo: true });
  }
  return name;
}
