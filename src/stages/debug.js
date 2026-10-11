// 调试关卡（不在正式关卡列表 STAGES 中，不参与关卡衔接）：用浏览器地址 ?stage=<id> 直接进入
// test_bigmap：40×40 测试地图，含全部 30 种地形，用于检查镜头滚动、小地图、地形绘制与大地图性能
import { P, E } from './helpers.js';

const W = 40, H = 40;
const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => ((x * 7 + y * 13) % 11 < 3 ? ',' : '.')));
const fill = (x0, y0, x1, y1, ch) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = ch;
};
const put = (ch, ...pts) => pts.forEach(([x, y]) => { grid[y][x] = ch; });

// 西北：山地、岩山，山崖横断，中间关隘与鹿砦
fill(2, 2, 9, 7, 'M');
fill(4, 3, 6, 4, 'X');
fill(2, 8, 9, 8, '^');
put('P', [6, 8]);
put('Z', [5, 9], [7, 9]);
// 树林、荒地、雪原
fill(12, 2, 16, 6, 'F');
fill(2, 12, 9, 17, 'D');
fill(26, 1, 37, 8, '*');
// 大河纵贯：两座桥、一段浅滩、一处船阵
fill(19, 0, 20, H - 1, 'R');
put('B', [19, 10], [20, 10], [19, 30], [20, 30]);
put('~', [19, 20], [20, 20]);
put('S', [19, 25], [20, 25], [19, 26]);
// 东侧小河与桥
fill(21, 14, 38, 14, 'W');
put('B', [28, 14]);
// 西南：沼泽、池塘、水池
fill(2, 22, 9, 28, '%');
put('O', [4, 24], [5, 24]);
put('Q', [12, 24]);
// 村庄、民居、宝物库、火
put('V', [12, 18], [14, 19]);
put('H', [13, 17]);
put('$', [15, 18]);
put('!', [14, 30], [15, 30]);
// 栅栏（中间留口）与兵营
fill(22, 18, 30, 18, '#');
put('.', [26, 18]);
put('T', [24, 20], [25, 20], [27, 20]);
// 东南城池：城墙一圈，北面城门旁留出入口（第 2 回合事件打开城门）
fill(26, 26, 37, 37, 'C');
fill(27, 27, 36, 36, '+');
put('E', [31, 26]);
put('+', [32, 26]);
put('G', [31, 31], [32, 31], [31, 32], [32, 32]);
put('A', [35, 35]);
put('$', [28, 35]);
put('H', [29, 29]);
// 地下（不可通行）
fill(2, 33, 6, 37, 'U');

const map = grid.map((r) => r.join(''));

export const DEBUG_STAGES = [
  {
    id: 'test_bigmap', no: 0, chapter: '调试', name: '大地图测试',
    debug: true, // 胜利时不写自动存档
    mapVersion: 2,
    next: 'END_VILLAIN',
    turns: 40,
    weather: { type: 2, start: 2 }, // 阴雨类，开局下雨：顺便检查天气粒子随镜头移动
    victoryText: '击败城中的守将',
    victory: [{ type: 'boss', target: 'boss' }],
    map,
    units: [
      P('caocao', '曹操', 'lord', 10, 10, 11, { leader: true }),
      P('xiahoudun', '夏侯惇', 'cavalry', 10, 11, 10, { mark: '惇' }),
      P('xiahouyuan', '夏侯渊', 'archercav', 10, 11, 12, { mark: '渊' }),
      P('caoren', '曹仁', 'cavalry', 10, 12, 11, { mark: '仁' }),
      P('xunyu', '荀彧', 'strategist', 10, 10, 12),
      P('dianwei', '典韦', 'fighter', 10, 12, 10),
      E('boss', '守将', 'infantry', 12, 32, 31, { leader: true, ai: 'hold' }),
      E('g1', '守城兵', 'infantry', 9, 30, 33, { ai: 'hold' }),
      E('g2', '守城兵', 'archer', 9, 34, 30, { ai: 'hold' }),
      E('e1', '伏兵', 'bandit', 8, 13, 4),
      E('e2', '伏兵', 'bandit', 8, 15, 5),
      E('e3', '雪原骑兵', 'cavalry', 9, 30, 4),
      E('e4', '雪原弓兵', 'archer', 9, 33, 6),
      E('e5', '荒地贼兵', 'bandit', 8, 5, 14),
      E('e6', '沼泽术士', 'taoist', 8, 6, 25),
      E('e7', '营寨步兵', 'infantry', 9, 24, 20),
      E('e8', '营寨弓兵', 'archer', 9, 25, 20),
      E('e9', '河东骑兵', 'cavalry', 9, 24, 10),
      E('e10', '河东弓兵', 'archer', 9, 28, 12),
      E('e11', '水军', 'pirate', 9, 19, 25),
      E('e12', '关隘守兵', 'infantry', 9, 6, 8),
    ],
    // 战场演出测试：镜头、高亮、船（3×3）、援军走入（默认 / 指定 from / 太远淡入）、开城门、放火、走位、转向、动作
    events: [
      {
        turn: 1, faction: 'player',
        stage: [
          { camera: [20, 15] },
          { highlight: [[19, 15], [20, 15]] },
          { terrain: { at: [19, 15], set: 'ship', size: 3 } },
          { act: 'caocao', pose: 'raise' },
          { say: [{ who: '曹操', side: 'player', text: '船已备好，可由此渡河。' }] },
        ],
        dialog: [{ who: '旁白', text: '演出测试：大河中央出现了船阵。' }],
      },
      {
        turn: 1, faction: 'enemy',
        units: [
          E('r1', '援军骑兵', 'cavalry', 9, 22, 1),
          E('r2', '援军步兵', 'infantry', 9, 37, 11, { from: [39, 11] }),
          E('r3', '伏兵', 'bandit', 8, 14, 9),
        ],
        dialog: [{ who: '旁白', text: '敌军援军从地图边缘赶到，林中另有伏兵。' }],
      },
      {
        turn: 2, faction: 'player',
        stage: [
          { camera: 'boss' },
          { face: 'boss', dir: 'up' },
          { act: 'boss', pose: 'jump' },
          { highlight: ['boss', [31, 26]] },
          { terrain: { at: [31, 26], set: 'open' } },
          { walk: 'g1', to: [31, 27] },
          { face: 'g1', dir: 'left' },
          { spawn: true },
          { terrain: { at: [14, 4], set: 'fire', size: 3 } },
          { act: 'e1', pose: 'shake' },
        ],
        units: [E('r4', '城外援军', 'archer', 9, 31, 24, { from: [31, 39] })],
        setAi: { boss: 'aggressive' },
        dialog: [{ who: '守将', side: 'enemy', text: '打开城门，出城迎敌！' }],
      },
    ],
    prologue: [{ who: '旁白', text: '大地图测试：拖动地图、方向键 / WASD、鼠标移到地图边缘都可以滚动；右上角小地图可点击跳转，M 键折叠。' }],
    epilogue: [{ who: '旁白', text: '测试结束。' }],
  },
];
