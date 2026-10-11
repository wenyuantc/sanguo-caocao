// 等角网格寻路（纯函数，不依赖 Phaser，Node 可直接导入；测试见 scripts/test-path.mjs）
// 格子坐标 [a, b] 与剧情场景的站位坐标一致（defs.isoToScreen）。八方向移动：
//   沿 a / b 轴一步（屏幕上的斜向）代价 1，对角一步（屏幕上的正上下左右）代价 1.4；对角移动不能切过被挡住的拐角。
// passable(a, b) 判断格子能否站立（障碍、越界、被人物占用都返回 false）。

export const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const DIAG = 1.4;

export const stepCost = (da, db) => (da && db ? DIAG : 1);

// 八方向距离（启发值）
export function octile(a0, b0, a1, b1) {
  const dx = Math.abs(a1 - a0), dy = Math.abs(b1 - b0);
  return Math.max(dx, dy) + (DIAG - 1) * Math.min(dx, dy);
}

// 从 (a, b) 走一步 (da, db) 是否可行：目标格可站，对角时两侧拐角格也必须可站
export function canStep(passable, a, b, da, db) {
  if (!passable(a + da, b + db)) return false;
  if (da && db) return passable(a + da, b) && passable(a, b + db);
  return true;
}

// 简单二叉堆（按 f 取最小）
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

// A* 寻路：返回从 from 到 to 的步骤数组（不含起点，含终点），已在终点时返回 []，走不到返回 null。
// opts.near：终点不可站（障碍或被占）时，改为走到终点周围八格中路程最短的可站格（站在旁边对话 / 使用功能点）；
//            起点已在终点旁边时返回 []。
// opts.limit：最多展开的格子数（默认 4000），防止大网格上无解时耗时过长。
export function findPath(passable, from, to, opts = {}) {
  const [sa, sb] = from, [ta, tb] = to;
  const key = (a, b) => `${a},${b}`;
  let goals;
  if (passable(ta, tb) || (sa === ta && sb === tb)) goals = new Set([key(ta, tb)]);
  else if (opts.near) {
    goals = new Set();
    for (const [da, db] of STEPS) {
      const a = ta + da, b = tb + db;
      if (a === sa && b === sb) return [];
      if (passable(a, b)) goals.add(key(a, b));
    }
    if (!goals.size) return null;
  } else return null;
  if (goals.has(key(sa, sb))) return [];
  // 走到旁边时启发值减去一步的距离，仍不会高估
  const slack = goals.size > 1 || !passable(ta, tb) ? DIAG : 0;
  const h = (a, b) => Math.max(0, octile(a, b, ta, tb) - slack);
  const limit = opts.limit ?? 4000;
  const open = new Heap();
  const g = new Map([[key(sa, sb), 0]]);
  const prev = new Map();
  const closed = new Set();
  open.push({ a: sa, b: sb, f: h(sa, sb) });
  let n = 0;
  while (open.size) {
    const cur = open.pop();
    const ck = key(cur.a, cur.b);
    if (closed.has(ck)) continue;
    if (goals.has(ck)) {
      const out = [];
      for (let k = ck; k !== key(sa, sb); k = prev.get(k)) out.push(k.split(',').map(Number));
      return out.reverse();
    }
    closed.add(ck);
    if (++n > limit) return null;
    const cg = g.get(ck);
    for (const [da, db] of STEPS) {
      const a = cur.a + da, b = cur.b + db;
      const k = key(a, b);
      if (closed.has(k) || !canStep(passable, cur.a, cur.b, da, db)) continue;
      const ng = cg + stepCost(da, db);
      if (ng < (g.get(k) ?? Infinity)) {
        g.set(k, ng);
        prev.set(k, ck);
        open.push({ a, b, f: ng + h(a, b) });
      }
    }
  }
  return null;
}

// 路径长度（按步代价累计）
export function pathCost(from, steps) {
  let [a, b] = from, s = 0;
  for (const [na, nb] of steps) { s += stepCost(na - a, nb - b); a = na; b = nb; }
  return s;
}
