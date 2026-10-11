// 音频引擎：Web Audio 实时合成（项目没有音频文件）。单例管理 AudioContext、主音量、配乐 / 音效两个总线与混响。
// 浏览器要求首次用户操作后才能出声：unlock() 之前 ready 为假，所有播放调用静默忽略。
// 切到后台时 suspend，回来 resume。activeNodes 统计尚未断开的节点数（window.__audioStats，回归测试查泄漏用）。

// 0–100 的音量映射为增益（平方曲线，低音量段更细）
const gainOf = (v) => (Math.max(0, Math.min(100, v)) / 100) ** 2;

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.volumes = { music: 70, sfx: 80, mute: false };
    this.activeNodes = 0;
    this.noiseBuf = null;
  }

  // 已解锁且上下文在运行（后台挂起时为假）
  get ready() {
    return this.unlocked && this.ctx?.state === 'running';
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // 首次用户操作时调用：创建 / 恢复 AudioContext。必须在用户事件的处理函数中同步调用
  unlock() {
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) this.build(new AC());
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  // 节点图：musicBus / sfxBus → master → 压限 → 输出；两个总线各有一路发送到混响，混响 → master
  build(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.4, 2.6);
    this.reverb.connect(this.master);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    for (const [bus, send] of [[this.musicBus, 0.28], [this.sfxBus, 0.14]]) {
      bus.connect(this.master);
      const g = ctx.createGain();
      g.gain.value = send;
      bus.connect(g).connect(this.reverb);
    }
    this.applyVolumes(true);
  }

  // 程序生成的脉冲响应：双声道衰减噪音（前段略暗，模拟厅堂）
  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        lp += ((Math.random() * 2 - 1) - lp) * (0.25 + 0.6 * (1 - t));
        d[i] = lp * (1 - t) ** decay * (i < 200 ? i / 200 : 1);
      }
    }
    return buf;
  }

  // 共用白噪音（2 秒，循环取用）
  noise() {
    if (!this.noiseBuf) {
      const ctx = this.ctx, n = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  // 音量：{ music, sfx }（0–100）、mute；未解锁时只记下数值
  setVolumes(v) {
    Object.assign(this.volumes, v);
    this.applyVolumes();
  }

  applyVolumes(instant) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (p, v) => (instant ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.03));
    set(this.master.gain, this.volumes.mute ? 0 : 1);
    set(this.musicBus.gain, gainOf(this.volumes.music));
    set(this.sfxBus.gain, gainOf(this.volumes.sfx));
  }

  // 输出目标：'music' / 'sfx' 或任意 AudioNode
  bus(dest) {
    if (dest === 'music') return this.musicBus;
    if (!dest || dest === 'sfx') return this.sfxBus;
    return dest;
  }

  // 登记一组节点：sources 全部结束（onended）后断开 nodes 中的所有节点并扣减计数。
  // 每个声源只计一次（实测 Chrome 偶有同一声源重复触发 ended）
  track(nodes, sources) {
    this.activeNodes += nodes.length;
    let left = sources.length;
    for (const s of sources) {
      let ended = false;
      s.onended = () => {
        if (ended) return;
        ended = true;
        if (--left > 0) return;
        for (const n of nodes) { try { n.disconnect(); } catch { /* 已断开 */ } }
        this.activeNodes -= nodes.length;
      };
    }
  }
}

export const engine = new AudioEngine();

// 启动时调用：初始化音量，注册首次操作解锁与后台暂停
export function initAudio(settings) {
  engine.setVolumes({ music: settings.music, sfx: settings.sfx, mute: settings.mute });
  if (typeof window === 'undefined') return;
  // 有的按键（如 ESC）不算浏览器认可的用户操作，上下文仍是 suspended：保留监听，直到真正运行起来再移除
  const off = () => { for (const ev of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(ev, unlock, true); };
  const unlock = () => {
    engine.unlock();
    if (!engine.ctx) return;
    if (engine.ctx.state === 'running') off();
    else if (!document.hidden) engine.ctx.resume().then(() => { if (engine.ctx.state === 'running') off(); }).catch(() => {});
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, true);
  document.addEventListener('visibilitychange', () => {
    if (!engine.ctx) return;
    if (document.hidden) engine.ctx.suspend().catch(() => {});
    else if (engine.unlocked) engine.ctx.resume().catch(() => {});
  });
  window.__audioStats = {
    get activeNodes() { return engine.activeNodes; },
    get state() { return engine.ctx?.state || 'none'; },
    get unlocked() { return engine.unlocked; },
    engine,
  };
}
