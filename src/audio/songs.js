// 配乐曲目（纯数据）：全部为五声音阶原创曲，不取材于原版旋律。简谱语法见 sequencer.js 的 parseJianpu。
// 每首：id、name、bpm、beats（每小节拍数）、key（简谱 1 的 MIDI 号）、mode（调式：宫 / 商 / 角 / 徵 / 羽，只作说明，
// 主音由旋律落音体现）、loop（从第几小节起循环，0 起算；之前为引子）、gain（整曲增益）、
// voices：[{ inst（instruments.js 的音色名）, notes（简谱）, oct（移调半音数）, vel（力度）, pitch（打击乐音高）, dur（打击乐固定时值，秒）, fill（短声部重复填满全曲）, legato, opts }]

// ---------- 记谱工具 ----------
const bars = (...xs) => xs.join(' | ');
const rest = (n, beats = 4) => Array(n).fill(['0', ...Array(beats - 1).fill('-')].join(' ')).join(' | ');
// 只在第 at 个小节（0 起）出现一次 hit，其余休止；总长 n 小节
const once = (n, at, hit = 'X - - -') => Array.from({ length: n }, (_, i) => (i === at ? hit : '0 - - -')).join(' | ');
const every = (n, k, from = 0, hit = 'X - - -') => Array.from({ length: n }, (_, i) => (i >= from && (i - from) % k === 0 ? hit : '0 - - -')).join(' | ');

// 古筝分解和弦（八分音符一小节，相对调号的五声和弦：宫 1 / 商 2 / 角 3 / 徵 5 / 羽 6）
const ARP = {
  1: "1,_ 5,_ 1_ 2_ 3_ 2_ 1_ 5,_",
  2: "2,_ 6,_ 2_ 3_ 5_ 3_ 2_ 6,_",
  3: "3,_ 6,_ 3_ 5_ 6_ 5_ 3_ 6,_",
  5: "5,,_ 2,_ 5,_ 6,_ 1_ 6,_ 5,_ 2,_",
  6: "6,,_ 3,_ 6,_ 1_ 2_ 1_ 6,_ 3,_",
};
const arps = (roots) => roots.map((r) => ARP[r]).join(' | ');

// 疾奏型低音（八分音符反复主音，战斗曲用）
const RUN = {
  1: "1_ 1_ 5_ 1_ 6_ 1_ 5_ 1_",
  2: "2,_ 2,_ 5,_ 2,_ 6,_ 2,_ 5,_ 2,_",
  3: "3,_ 3,_ 6,_ 3,_ 5,_ 3,_ 6,_ 3,_",
  5: "5,_ 5,_ 2_ 5,_ 6,_ 5,_ 2_ 5,_",
  6: "6,_ 6,_ 3_ 6,_ 1_ 6,_ 3_ 6,_",
};
const runs = (roots) => roots.map((r) => RUN[r]).join(' | ');

// 跳动低音（八分音符，主音 + 五度）
const PULSE = { 1: ['1,', '5,,'], 2: ['2,', '6,,'], 3: ['3,', '6,,'], 5: ['5,,', '2,'], 6: ['6,,', '3,'] };
const pulses = (roots) => roots.map((r) => { const [a, b] = PULSE[r]; return `${a}_ 0_ ${a}_ ${a}_ 0_ ${a}_ ${b}_ ${a}_`; }).join(' | ');

// 重音型低音（大战）
const DRIVE = {
  1: "1_ 1_ 1_ 5_ 1_ 1_ 2_ 3_",
  3: "3,_ 3,_ 3,_ 6,_ 3,_ 3,_ 5,_ 6,_",
  5: "5,_ 5,_ 5,_ 2_ 5,_ 5,_ 6,_ 1_",
  6: "6,_ 6,_ 6,_ 3_ 6,_ 6,_ 1_ 2_",
};
const drives = (roots) => roots.map((r) => DRIVE[r]).join(' | ');

const BIG = 35, SMALL = 55;

// ---------- 曲目 ----------

// 标题《征途》：宫调，笛子主奏，古筝分解和弦，二胡后半段对位，大鼓与锣
const title = (() => {
  const mel = bars(
    rest(2),
    "5. 6_ 1' 6", "5 - 3 2_ 3_", "1. 2_ 3 5", "2 - - -",
    "3. 5_ 6 1'", "2'. 1'_ 6 5", "6 1' 5 3_ 2_", "1 - - -",
    "6, 1 2. 3_", "5 3 2 -", "1 2 3 5_ 6_", "5 - - -",
    "1'. 6_ 5 3", "2 3_ 5_ 6 5", "3. 2_ 1 6,", "1 - - -",
  );
  const counter = bars(rest(10), "3 - 5 -", "6 - 5 -", "3 - 2 -", "3 - - -", "5 - 3 -", "2 - 3 -", "5 - 6, -", "1 - - -");
  return {
    id: 'title', name: '征途', bpm: 76, beats: 4, key: 62, mode: '宫', loop: 2, gain: 1,
    voices: [
      { inst: 'dizi', notes: mel, oct: 12, vel: 0.72 },
      { inst: 'erhu', notes: counter, vel: 0.5, legato: 0.98 },
      { inst: 'zheng', notes: arps([1, 1, 1, 5, 1, 2, 6, 2, 5, 1, 6, 2, 1, 5, 1, 2, 6, 1]), vel: 0.38, human: 0.12 },
      { inst: 'bigDrum', notes: bars(rest(2), ...Array(16).fill('X - - x_ x_')), pitch: BIG, vel: 0.55, dur: 0.9 },
      { inst: 'gong', notes: once(18, 2), pitch: 150, vel: 0.5, dur: 3 },
    ],
  };
})();

// 剧情《长河》（对应原版“悠久”）：羽调，舒缓。古筝先奏，笛子接奏，编钟点缀
const story = (() => {
  const a = ["6 - 1' 6_ 5_", "3 - - -", "5 6 3. 2_", "1 2 3 -", "2 3 5 6_ 1'_", "6 5 3 2_ 1_", "2 - 3 5_ 3_", "6 - - -"];
  const b = ["3' - 2' 1'_ 6_", "1' - 6 5", "3 5 6 1'_ 2'_", "3' - - -", "2' 1' 6 5_ 3_", "5 6 1' 2'_ 1'_", "6 5 3. 5_", "6 - - -"];
  return {
    id: 'story', name: '长河', bpm: 63, beats: 4, key: 64, mode: '羽', loop: 0, gain: 2.2,
    voices: [
      { inst: 'zheng', notes: bars(...a, rest(8)), vel: 0.75 },
      { inst: 'dizi', notes: bars(rest(8), ...b), vel: 0.6 },
      { inst: 'zheng', notes: arps([6, 3, 1, 1, 2, 6, 5, 6, 1, 6, 6, 3, 2, 5, 3, 6]), vel: 0.3, human: 0.15 },
      { inst: 'bell', notes: every(16, 8, 0, "6 - - -"), oct: 12, vel: 0.35, dur: 2 },
    ],
  };
})();

// 军营《营中》（对应原版“本阵”）：徵调，琵琶与笛子轮流主奏，轻快的板鼓
const camp = (() => {
  const a = ["5 3_ 5_ 6 5_ 3_", "2_ 3_ 5 3 -", "1_ 2_ 3_ 5_ 6 5", "3 2_ 1_ 2 -", "5_ 6_ 1'_ 6_ 5 3", "2_ 3_ 2_ 1_ 6, 5,", "6,_ 1_ 2_ 3_ 2 1_ 6,_", "5, - - -"];
  const b = ["1' - 6 5_ 6_", "5 3 2 -", "3_ 5_ 6_ 1'_ 2' 1'_ 6_", "5 - - -", "6 5_ 3_ 2 3_ 5_", "6 1' 5 -", "3_ 2_ 1_ 2_ 3 2_ 1_", "5, - - -"];
  return {
    id: 'camp', name: '营中', bpm: 92, beats: 4, key: 67, mode: '徵', loop: 0, gain: 2,
    voices: [
      { inst: 'pipa', notes: bars(...a, rest(8)), vel: 0.8 },
      { inst: 'dizi', notes: bars(rest(8), ...b), vel: 0.6 },
      { inst: 'zheng', notes: arps([5, 2, 1, 2, 1, 5, 6, 5, 1, 2, 6, 5, 6, 1, 2, 5]), vel: 0.32, human: 0.15 },
      { inst: 'smallDrum', notes: 'x_ x_ X 0_ x_ x', pitch: 62, vel: 0.3, dur: 0.12, fill: true },
    ],
  };
})();

// 军议《密议》（对应原版“阴谋”）：商 / 羽交替，低沉的二胡、心跳般的古筝低音，偶有钟声
const council = (() => {
  const mel = bars(
    "6, - - 1", "2 - 1 6,", "3, - 5, 6,", "6, - - -",
    "2 - 3 5", "3 - 2 1_ 6,_", "1 - 2 3,", "3, - - -",
    "6 - 5 3_ 2_", "3 - - 2_ 1_", "6, 1 2. 3_", "2 - - -",
    "1 - 6, 5,_ 3,_", "5, 6, 1 2", "3, - 5, -", "6, - - -",
  );
  const P = { 6: "6,, 0 3, 6,,_ 0_", 2: "2, 0 6, 2,_ 0_", 3: "3, 0 6, 3,_ 0_", 1: "1, 0 5, 1,_ 0_", 5: "5,, 0 2, 5,,_ 0_" };
  return {
    id: 'council', name: '密议', bpm: 66, beats: 4, key: 62, mode: '羽', loop: 0, gain: 1.3,
    voices: [
      { inst: 'erhu', notes: mel, vel: 0.62, legato: 0.97 },
      { inst: 'zheng', notes: [6, 2, 3, 6, 2, 3, 1, 3, 6, 3, 6, 2, 1, 5, 3, 6].map((r) => P[r]).join(' | '), vel: 0.5 },
      { inst: 'smallDrum', notes: '0 0 0 x_ x_', pitch: 48, vel: 0.22, dur: 0.15, fill: true },
      { inst: 'bell', notes: every(16, 8, 0, "6 - - -"), oct: 12, vel: 0.28, dur: 2.5 },
      { inst: 'gong', notes: once(16, 0), pitch: 45, vel: 0.3, dur: 3 },
    ],
  };
})();

// 战斗一《疾风》（急袭 / 暴走一类）：羽调快板，琵琶疾奏型伴奏，笛子主奏、二胡隔段低八度重奏
const battle1 = (() => {
  const p1 = ["6 - 1' 2'", "3' - 2' 1'_ 6_", "5 6 1'. 6_", "6 - - -"];
  const p2 = ["3' 5' 3'. 2'_", "1' 2' 6 -", "5_ 6_ 1'_ 2'_ 3' 2'", "3' - - -"];
  const p3 = ["1' - 6 5", "6 1'_ 2'_ 1' 6", "5 3 5. 6_", "6 - - -"];
  const p4 = ["3' 2' 1' 6_ 5_", "3 5 6 1'", "2'_ 1'_ 6_ 5_ 3 5", "6 - >6 0"];
  return {
    id: 'battle1', name: '疾风', bpm: 132, beats: 4, key: 64, mode: '羽', loop: 2, gain: 0.95,
    voices: [
      { inst: 'dizi', notes: bars(rest(2), ...p1, ...p2, ...p3, ...p4), vel: 0.68 },
      { inst: 'erhu', notes: bars(rest(6), ...p2, rest(4), ...p4), oct: -12, vel: 0.5 },
      { inst: 'pipa', notes: runs([6, 6, 6, 6, 5, 6, 3, 6, 5, 3, 1, 6, 5, 6, 3, 5, 2, 6]), vel: 0.42, human: 0.1 },
      { inst: 'bigDrum', notes: 'X - x_ x_ x', pitch: BIG, vel: 0.6, dur: 0.5, fill: true },
      { inst: 'smallDrum', notes: bars(rest(2), ...Array(16).fill('0 x 0_ x_ x')), pitch: SMALL, vel: 0.4, dur: 0.15 },
      { inst: 'gong', notes: every(18, 8, 2), pitch: 170, vel: 0.42, dur: 2.5 },
    ],
  };
})();

// 战斗二《霸道》（霸道 / 互角一类）：宫调进行曲，二胡与笛子齐奏，古筝分解和弦，大鼓板鼓行军节奏
const battle2 = (() => {
  const mel = [
    "1 1_ 2_ 3 5", "6 5 3 -", "2 2_ 3_ 5 3", "2 1 2 -",
    "3 5 6 1'", "2' 1' 6 5", "6 1'_ 6_ 5 3", "5 - - -",
    "6 6_ 1'_ 6 5", "3 5 6 -", "1' 1'_ 2'_ 1' 6", "5 3 2 -",
    "3 3_ 5_ 6 1'", "6 5 3 2", "1. 2_ 3 2", "1 - - -",
  ];
  return {
    id: 'battle2', name: '霸道', bpm: 108, beats: 4, key: 62, mode: '宫', loop: 1, gain: 1,
    voices: [
      { inst: 'dizi', notes: bars(rest(1), ...mel), oct: 12, vel: 0.6 },
      { inst: 'erhu', notes: bars(rest(1), ...mel), vel: 0.55 },
      { inst: 'zheng', notes: arps([1, 1, 6, 2, 5, 1, 2, 6, 5, 6, 6, 1, 2, 1, 6, 2, 1]), vel: 0.36, human: 0.1 },
      { inst: 'bigDrum', notes: 'X - x -', pitch: BIG, vel: 0.6, dur: 0.6, fill: true },
      { inst: 'smallDrum', notes: 'x_ x_ x x_ x_ x', pitch: SMALL, vel: 0.35, dur: 0.12, fill: true },
      { inst: 'gong', notes: every(17, 8, 1), pitch: 160, vel: 0.42, dur: 2.5 },
    ],
  };
})();

// 战斗三《对垒》（舌战一类）：商调，紧张的中板。二胡先奏，琵琶轮指作答，跳动低音
const battle3 = (() => {
  const a = ["2 - 3 5_ 3_", "2 1 6, -", "2 3 5 6_ 5_", "3 - - -", "5 - 6 1'_ 6_", "5 3 2 -", "3 5 3 2_ 1_", "2 - - -"];
  const b = ["6 - 5 3", "2 3 5 -", "6 1' 2' 1'_ 6_", "5 - - -", "3 5 6 5_ 3_", "2 1 6, 1", "2 - 3~ -", "2~ - - -"];
  return {
    id: 'battle3', name: '对垒', bpm: 96, beats: 4, key: 62, mode: '商', loop: 0, gain: 1,
    voices: [
      { inst: 'erhu', notes: bars(...a, rest(8)), vel: 0.62 },
      { inst: 'pipa', notes: bars(rest(8), ...b), vel: 0.6 },
      { inst: 'dizi', notes: bars(rest(8), "2 - - -", "6, - - -", "2 - - -", "3 - - -", "5, - - -", "6, - - -", "1 - - -", "2 - - -"), oct: 12, vel: 0.3, legato: 0.98 },
      { inst: 'zheng', notes: pulses([2, 6, 2, 3, 5, 2, 3, 2, 6, 2, 6, 5, 3, 6, 2, 2]), vel: 0.42, human: 0.1 },
      { inst: 'bigDrum', notes: 'X 0 0 x_ x_', pitch: BIG, vel: 0.55, dur: 0.6, fill: true },
      { inst: 'smallDrum', notes: 'x_ x_ 0 x 0', pitch: SMALL, vel: 0.33, dur: 0.12, fill: true },
    ],
  };
})();

// 决战《大战》（大战 / 暗云一类）：羽调，重音型低音、笛子二胡齐奏、密集鼓点与锣
const decisive = (() => {
  const mel = [
    "6 - - 3'", "2' - 1' 6", "5 - 6 1'", "6 - - -",
    "3' - - 5'", "3' 2' 1' 2'_ 3'_", "2' - 1' 6", "5 - - -",
    "6 1' 2' 3'", "5' - 3' 2'", "1' 2' 6 5", "3 - - -",
    "5 6 1' 2'", "3' - 2' 1'_ 6_", "5 6 3 5", "6 - - -",
  ];
  return {
    id: 'decisive', name: '大战', bpm: 120, beats: 4, key: 64, mode: '羽', loop: 2, gain: 0.95,
    voices: [
      { inst: 'dizi', notes: bars(rest(2), ...mel), vel: 0.66 },
      { inst: 'erhu', notes: bars(rest(2), ...mel), oct: -12, vel: 0.55 },
      { inst: 'zheng', notes: drives([6, 6, 6, 3, 5, 6, 1, 1, 5, 5, 6, 3, 1, 3, 5, 1, 3, 6]), oct: -12, vel: 0.5, human: 0.08 },
      { inst: 'bigDrum', notes: 'X x_ x_ X x_ x_', pitch: 33, vel: 0.62, dur: 0.5, fill: true },
      { inst: 'smallDrum', notes: bars(rest(2), ...Array(16).fill('0_ x_ x_ x_ 0_ x_ x_ x_')), pitch: SMALL, vel: 0.32, dur: 0.1 },
      { inst: 'gong', notes: every(18, 4, 2), pitch: 140, vel: 0.45, dur: 3 },
    ],
  };
})();

// 危急《危局》：羽调急板，琵琶疾奏、板鼓连击，二胡在中低音区紧逼
const crisis = (() => {
  const mel = [
    "3' - 2' -", "1' 2' 6 -", "3' - 5' 3'", "2' - - -",
    "1' - 6 -", "5 6 3 -", "6 5 3 2", "3 - - -",
    "6 6_ 5_ 6 1'", "2' 1' 2' 3'", "5' 3' 2' 1'", "2' - 3' -",
    "6' - 5' 3'", "2' 3' 1' 6", "5 6_ 5_ 3 2", "3 - 6, -",
  ];
  const C = { 6: "6,_ 1_ 6,_ 2_ 6,_ 3_ 6,_ 2_", 5: "5,_ 6,_ 5,_ 1_ 5,_ 2_ 5,_ 1_", 3: "3,_ 5,_ 3,_ 6,_ 3,_ 1_ 3,_ 6,_" };
  return {
    id: 'crisis', name: '危局', bpm: 144, beats: 4, key: 62, mode: '羽', loop: 0, gain: 1.1,
    voices: [
      { inst: 'erhu', notes: bars(...mel), oct: -12, vel: 0.62 },
      { inst: 'pipa', notes: [3, 6, 3, 5, 6, 3, 6, 3, 6, 5, 5, 5, 6, 5, 3, 6].map((r) => C[r]).join(' | '), vel: 0.45, human: 0.1 },
      { inst: 'smallDrum', notes: 'x__ x__ x__ x__ X x__ x__ x__ x__ X', pitch: SMALL, vel: 0.33, dur: 0.08, fill: true },
      { inst: 'bigDrum', notes: 'X x_ x_ X 0', pitch: BIG, vel: 0.55, dur: 0.4, fill: true },
      { inst: 'gong', notes: every(16, 8, 0, 'X - - -'), pitch: 210, vel: 0.35, dur: 1.5, opts: { rise: true } },
    ],
  };
})();

// 单挑《单骑》：羽调急板，琵琶轮指主奏，大鼓滚奏与锣
const duel = (() => {
  const mel = [
    "6~ - - -", "3'~ - 2'~ -", "1' 6 1' 2'", "3'~ - - -",
    "5' 3' 2' 3'", "1' 6 5 6", "3 5 6 1'", "6~ - - -",
  ];
  return {
    id: 'duel', name: '单骑', bpm: 152, beats: 4, key: 64, mode: '羽', loop: 1, gain: 0.95,
    voices: [
      { inst: 'pipa', notes: bars(rest(1), ...mel), vel: 0.75 },
      { inst: 'erhu', notes: bars(rest(5), ...mel.slice(4)), oct: -12, vel: 0.5 },
      { inst: 'zheng', notes: runs([6, 6, 3, 1, 3, 5, 6, 3, 6]), oct: -12, vel: 0.42, human: 0.08 },
      { inst: 'bigDrum', notes: 'X x_ x_ x_ x_ x', pitch: BIG, vel: 0.6, dur: 0.4, fill: true },
      { inst: 'smallDrum', notes: 'x__ x__ x__ x__ x__ x__ x__ x__ X_ x_ X', pitch: SMALL, vel: 0.3, dur: 0.08, fill: true },
      { inst: 'gong', notes: every(9, 4, 0), pitch: 190, vel: 0.5, dur: 2.5 },
    ],
  };
})();

// 胜利《凯旋》：宫调，笛子号角式引子，编钟、分解和弦、鼓
const victory = (() => {
  const mel = [
    "1' 1'_ 1'_ 5 1'_ 2'_", "3' - - -",
    "3 5 6 1'", "2'. 3'_ 2' 1'", "6 1' 5 6_ 5_", "3 - - -",
    "5 6 1' 2'", "3' 2'_ 1'_ 6 5", "6 1' 2'_ 1'_ 6", "1' - - -",
  ];
  return {
    id: 'victory', name: '凯旋', bpm: 104, beats: 4, key: 62, mode: '宫', loop: 2, gain: 1,
    voices: [
      { inst: 'dizi', notes: bars(...mel), vel: 0.7 },
      { inst: 'bell', notes: "1' - 5 -", vel: 0.3, dur: 1.2, fill: true },
      { inst: 'zheng', notes: arps([1, 1, 1, 2, 6, 1, 5, 1, 6, 1]), vel: 0.36, human: 0.1 },
      { inst: 'bigDrum', notes: 'X - x x', pitch: BIG, vel: 0.55, dur: 0.6, fill: true },
      { inst: 'smallDrum', notes: '0 x_ x_ 0 x', pitch: SMALL, vel: 0.3, dur: 0.12, fill: true },
      { inst: 'gong', notes: bars(once(2, 0), every(8, 8, 0)), pitch: 150, vel: 0.45, dur: 3 },
    ],
  };
})();

// 败北《残阳》：羽调慢板，二胡独奏，古筝低音
const defeat = {
  id: 'defeat', name: '残阳', bpm: 56, beats: 4, key: 64, mode: '羽', loop: 0, gain: 1.4,
  voices: [
    { inst: 'erhu', notes: bars("6 - 5 3", "2 - 3 -", "1 2 6, 5,_ 6,_", "6, - - -", "3 - 2 1", "6, 1 2 3_ 2_", "1 - 6, 5,", "6, - - -"), vel: 0.6, legato: 0.97 },
    { inst: 'zheng', notes: bars("6,, - - -", "2, - - -", "1, - 5,, -", "6,, - - -", "3, - - -", "6,, - 2, -", "1, - 5,, -", "6,, - - -"), vel: 0.5 },
    { inst: 'gong', notes: once(8, 0), pitch: 43, vel: 0.28, dur: 3 },
  ],
};

// 结局《太平》：宫调，温暖的笛子与古筝，二胡后半段和声，编钟
const ending = (() => {
  const mel = [
    "1 2 3 5", "6 5 3 -", "5 6 1' 6_ 5_", "3 - 2 -",
    "1 2 3 2_ 1_", "6, 1 2 -", "3 5 2 3_ 2_", "1 - - -",
    "5 6 1' 2'", "3' 2' 1' -", "6 1' 5 3_ 5_", "6 - - -",
    "1' 6 5 3", "2 3 5 6_ 5_", "3 2 3. 2_", "1 - - -",
  ];
  return {
    id: 'ending', name: '太平', bpm: 72, beats: 4, key: 62, mode: '宫', loop: 0, gain: 1,
    voices: [
      { inst: 'dizi', notes: bars(...mel), oct: 12, vel: 0.62 },
      { inst: 'erhu', notes: bars(rest(8), "3 - 5 -", "1' - 6 -", "3 - 5 -", "3 - - -", "5 - 3 -", "6, - 2 -", "5, - 5, -", "3, - - -"), vel: 0.4, legato: 0.98 },
      { inst: 'zheng', notes: arps([1, 6, 5, 2, 1, 6, 2, 1, 5, 1, 6, 6, 1, 2, 5, 1]), vel: 0.36, human: 0.12 },
      { inst: 'bell', notes: every(16, 8, 0, "1' - 5 -"), oct: 12, vel: 0.3, dur: 2 },
    ],
  };
})();

export const SONGS = Object.fromEntries(
  [title, story, camp, council, battle1, battle2, battle3, decisive, crisis, duel, victory, defeat, ending].map((s) => [s.id, s]),
);
