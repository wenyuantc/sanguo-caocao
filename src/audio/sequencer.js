import { engine } from './engine.js';
import { INSTRUMENTS } from './instruments.js';

// 音序器：把 songs.js 的曲目（简谱字符串）编译成音符事件，用 look-ahead 方式提前排程到 AudioContext 时间轴上。
//   - setInterval 每 TICK_MS 检查一次，把 LOOKAHEAD 秒之内的音符交给 instruments.js 的音色函数（输出到本曲的增益节点 → 配乐总线）；
//   - 曲目可从第 loop 小节起循环；切换曲目时旧曲渐出，新曲在旧曲的下一小节线（等待超过 maxWait 时立即）渐入；
//   - 未解锁 / 后台挂起（engine.ready 为假）时不排程：上下文挂起期间 currentTime 停止走动，恢复后从原处接着排；
//     主线程卡顿导致已经错过的音符直接丢弃，不补发（节拍网格不变，不会跑拍）。
//
// 简谱语法（parseJianpu）：空白分隔的记号，`|` 为小节线（只做长度校验）。
//   1–7 音级（相对 song.key 的大调音级：1=宫 2=商 3=角 5=徵 6=羽，4 / 7 为变音），0 休止；
//   x / X 打击乐一击（X 为重音），音高取声部的 pitch；
//   后缀：' 高八度、, 低八度（可重复）；_ 时值减半（八分音符，相当于简谱下划线），__ 十六分；. 附点（×1.5）；~ 轮指（琵琶 tremolo）；
//   前缀：# / b 升降半音；> 重音（力度 ×1.25）；
//   单独的 - 把前一个音（或休止）延长一拍。
//   例："5. 6_ 1' 6 | 5 - 3 2_ 3_ | 1 - - - |"

const TICK_MS = 25;
const LOOKAHEAD = 0.1;
const LATE = 0.03; // 迟到不超过这么多秒的音符仍然立即补上，再晚就丢弃
const TAIL = 7; // 渐出完成后，最长的余音（编钟 / 锣 / 古筝）还要这么多秒才结束，之后断开本曲的增益节点

const DEGREE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
const TOKEN = /^(>?)([#b]?)([0-7xX])([',]*)(_*)(\.?)(~?)$/;

// 解析一个声部：返回 { events: [{ beat, len, deg, oct, acc, accent, trem, hit }], length（拍）, bad: [出错的小节号] }
export function parseJianpu(str, beats = 4) {
  const events = [];
  let beat = 0, last = null, barStart = 0, bar = 0;
  const bad = [];
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') {
      if (Math.abs(beat - barStart - beats) > 1e-6) bad.push(bar);
      barStart = beat;
      bar++;
      continue;
    }
    if (tok === '-') {
      if (last) last.len += 1;
      beat += 1;
      continue;
    }
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`简谱记号无法识别：${tok}`);
    const [, accent, acc, d, octs, unders, dot, trem] = m;
    const len = (1 / 2 ** unders.length) * (dot ? 1.5 : 1);
    const oct = [...octs].reduce((n, c) => n + (c === "'" ? 1 : -1), 0);
    const ev = { beat, len };
    if (d === 'x' || d === 'X') Object.assign(ev, { hit: true, accent: d === 'X' || !!accent });
    else if (d !== '0') Object.assign(ev, { deg: +d, oct, acc: acc === '#' ? 1 : acc === 'b' ? -1 : 0, accent: !!accent, trem: !!trem });
    else ev.rest = true;
    events.push(ev);
    last = ev;
    beat += len;
  }
  if (beat - barStart > 1e-6 && Math.abs(beat - barStart - beats) > 1e-6) bad.push(bar);
  return { events: events.filter((e) => !e.rest), length: beat, bad };
}

// 编译整首曲目：全部声部合并成按拍排序的事件表（一次循环），声部 fill 为真时重复填满全曲
export function compileSong(song) {
  const beats = song.beats || 4;
  const voices = song.voices.map((v) => ({ v, ...parseJianpu(v.notes, beats) }));
  for (const p of voices) if (p.bad.length) console.warn(`曲目 ${song.id} 声部 ${p.v.inst} 小节长度不对：`, p.bad.map((b) => b + 1).join(', '));
  const length = Math.ceil(Math.max(...voices.filter((p) => !p.v.fill).map((p) => p.length), beats) / beats - 1e-6) * beats;
  const events = [];
  for (const { v, events: evs, length: vl } of voices) {
    const play = INSTRUMENTS[v.inst];
    if (!play) throw new Error(`曲目 ${song.id}：未知乐器 ${v.inst}`);
    const reps = v.fill ? Math.ceil(length / vl) : 1;
    for (let r = 0; r < reps; r++) {
      for (const e of evs) {
        const beat = e.beat + r * vl;
        if (beat >= length - 1e-6) break;
        const note = e.hit ? v.pitch : song.key + DEGREE[e.deg] + e.acc + 12 * e.oct + (v.oct || 0);
        const vel = (v.vel ?? 0.7) * (e.accent ? (e.hit ? 1 : 1.25) : e.hit ? 0.72 : 1);
        const opts = { ...(v.opts || {}), ...(e.trem ? { tremolo: true } : null) };
        events.push({ beat, len: e.len, play, note, vel: Math.min(1, vel), opts, legato: v.legato ?? 0.92, dur: v.dur, human: v.human ?? 0.06 });
      }
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  let loopBeat = (song.loop || 0) * beats;
  let loopIdx = events.findIndex((e) => e.beat >= loopBeat - 1e-6);
  if (loopIdx < 0 || loopBeat >= length) { loopBeat = 0; loopIdx = 0; }
  return { id: song.id, bpm: song.bpm, beats, length, loopBeat, loopIdx, events, gain: song.gain ?? 1 };
}

const compiled = new Map();
const compiledOf = (song) => {
  if (!compiled.has(song.id)) compiled.set(song.id, compileSong(song));
  return compiled.get(song.id);
};

class Sequencer {
  constructor() {
    this.cur = null; // 正在播放（或等待开始）的曲目
    this.dying = []; // 渐出中的旧曲（余音结束后断开）
    this.timer = null;
  }

  get songId() {
    return this.cur?.c.id ?? null;
  }

  // 播放曲目（song 为 songs.js 中的定义）；fadeIn 渐入秒数、fadeOut 旧曲渐出秒数、maxWait 等旧曲小节线的最长秒数
  play(song, { fadeIn = 0.08, fadeOut = 1.2, maxWait = 1.6 } = {}) {
    const c = compiledOf(song);
    const old = this.cur;
    const p = { c, out: null, base: null, idx: 0, startAt: null, fadeIn, stopAt: Infinity };
    if (old) {
      // 上一首还在等小节线（连续切换）：沿用它的开始时刻，避免与仍在渐出的更早曲目叠奏
      if (old.base == null) p.startAt = old.startAt;
      else if (engine.ready) {
        const now = engine.now;
        const bar = this.nextBar(old, now + LOOKAHEAD);
        p.startAt = bar - now <= maxWait ? bar : now + 0.12;
      }
      this.retire(old, fadeOut, p.startAt);
    }
    this.cur = p;
    this.ensureTimer();
  }

  // 停止：当前曲目渐出
  stop(fadeOut = 1.2) {
    if (!this.cur) return;
    this.retire(this.cur, fadeOut);
    this.cur = null;
  }

  // p 的下一条小节线（不早于 t）对应的上下文时间
  nextBar(p, t) {
    const spb = 60 / p.c.bpm, bar = p.c.beats;
    const b = (t - p.base) / spb;
    return p.base + Math.ceil(b / bar - 1e-6) * bar * spb;
  }

  // 旧曲渐出：从现在起 fade 秒降到 0，at 之后（新曲开始处）不再排新音符
  retire(p, fade, at) {
    if (!p.out) return; // 还没开始发声：直接丢弃
    const now = engine.now, g = p.out.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(now);
    else { g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); }
    g.linearRampToValueAtTime(0, now + Math.max(0.05, fade));
    p.stopAt = Math.min(at ?? Infinity, now + fade);
    p.endAt = now + fade + TAIL;
    this.dying.push(p);
    this.ensureTimer();
  }

  ensureTimer() {
    if (this.timer || typeof window === 'undefined') return;
    this.timer = setInterval(() => {
      try { this.tick(); } catch (e) { console.error('配乐排程出错', e); }
    }, TICK_MS);
  }

  tick() {
    if (!engine.ready) return; // 未解锁 / 后台挂起：时间轴停止，什么也不排
    const now = engine.now, horizon = now + LOOKAHEAD;
    const p = this.cur;
    if (p && p.base == null) this.begin(p, Math.max(p.startAt ?? 0, now + 0.06));
    if (p) this.schedule(p, now, horizon);
    for (const q of this.dying) if (q.stopAt > now) this.schedule(q, now, horizon);
    for (const q of [...this.dying]) {
      if (now < q.endAt) continue;
      try { q.out.disconnect(); } catch { /* 已断开 */ }
      engine.activeNodes -= 1;
      this.dying.splice(this.dying.indexOf(q), 1);
    }
    if (!this.cur && !this.dying.length) { clearInterval(this.timer); this.timer = null; }
  }

  // 开始发声：每首曲子一个增益节点 → 配乐总线（渐入 / 渐出都在这里做）
  begin(p, t) {
    const g = engine.ctx.createGain();
    g.gain.setValueAtTime(0, engine.now);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(p.c.gain, t + Math.max(0.02, p.fadeIn));
    g.connect(engine.musicBus);
    engine.activeNodes += 1;
    p.out = g;
    p.base = t;
    p.idx = 0;
  }

  schedule(p, now, horizon) {
    const c = p.c, spb = 60 / c.bpm, evs = c.events;
    if (!evs.length) return;
    const loopLen = (c.length - c.loopBeat) * spb;
    // 静音或配乐音量为 0 时照常走拍，但不创建任何节点
    const silent = engine.volumes.mute || engine.volumes.music <= 0;
    for (let guard = 0; guard < 4096; guard++) {
      if (p.idx >= evs.length) {
        p.base += loopLen;
        p.idx = c.loopIdx;
      }
      const e = evs[p.idx];
      let t = p.base + e.beat * spb;
      // 落后整整几个循环（长时间卡顿）：直接跳过这些循环
      if (p.idx >= c.loopIdx && now - t > loopLen + 1) {
        p.base += Math.floor((now - t) / loopLen) * loopLen;
        t = p.base + e.beat * spb;
      }
      if (t >= horizon || t >= p.stopAt) return;
      p.idx++;
      if (t < now - LATE || silent) continue; // 已错过：不补发
      const at = Math.max(t, now + 0.002);
      const dur = e.dur ?? e.len * spb * e.legato;
      const vel = e.vel * (1 + (Math.random() * 2 - 1) * e.human);
      try { e.play(p.out, at, e.note, dur, vel, e.opts); } catch (err) { console.error('配乐音符出错', err); }
    }
  }
}

export const sequencer = new Sequencer();
