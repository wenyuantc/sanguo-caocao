// 营中寻路测试：node scripts/test-path.mjs
// 覆盖：直线、绕障碍、目标不可达、目标被占时走到最近的相邻格、对角不切拐角；另检查全部营地布局的连通性
import { findPath, pathCost, canStep } from '../src/story/path.js';
import { LAYOUTS, layoutGrid, checkLayout } from '../src/camp/layouts.js';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  通过', msg);
  else { failed += 1; console.log('  失败', msg); }
};

// 用字符画建网格：行 = b，列 = a；'#' 障碍、'P' 被人物占用、其余可走
const grid = (rows) => {
  const block = new Set();
  rows.forEach((r, b) => [...r].forEach((ch, a) => { if (ch === '#' || ch === 'P') block.add(`${a},${b}`); }));
  return (a, b) => a >= 0 && b >= 0 && b < rows.length && a < rows[0].length && !block.has(`${a},${b}`);
};
// 路径逐步合法：每步都是八方向之一，且满足不切拐角
const valid = (pass, from, steps) => {
  let [a, b] = from;
  for (const [na, nb] of steps) {
    const da = na - a, db = nb - b;
    if (Math.abs(da) > 1 || Math.abs(db) > 1 || (!da && !db) || !canStep(pass, a, b, da, db)) return false;
    a = na; b = nb;
  }
  return true;
};

console.log('直线');
{
  const pass = grid(['..........', '..........', '..........']);
  const p = findPath(pass, [0, 1], [6, 1]);
  ok(p && p.length === 6 && p.at(-1).join() === '6,1', `沿 a 轴 6 步：${JSON.stringify(p)}`);
  const d = findPath(pass, [0, 0], [2, 2]);
  ok(d && d.length === 2 && Math.abs(pathCost([0, 0], d) - 2.8) < 1e-9, `对角 2 步：${JSON.stringify(d)}`);
  ok(JSON.stringify(findPath(pass, [3, 1], [3, 1])) === '[]', '已在终点返回空路径');
}

console.log('绕障碍');
{
  const rows = [
    '..........',
    '....#.....',
    '....#.....',
    '....#.....',
    '..........',
  ];
  const pass = grid(rows);
  const p = findPath(pass, [1, 2], [8, 2]);
  ok(p && valid(pass, [1, 2], p) && p.at(-1).join() === '8,2', `绕过竖墙：${JSON.stringify(p)}`);
  ok(p && !p.some(([a, b]) => a === 4 && b >= 1 && b <= 3), '路径不经过障碍格');
  // 拐角：两格斜向相接的障碍之间不能斜穿
  const corner = grid(['.#', '#.']);
  ok(findPath(corner, [0, 0], [1, 1]) === null, '不能斜穿两块障碍的缝隙');
}

console.log('目标不可达');
{
  const rows = [
    '.......',
    '.......',
    '...###.',
    '...#.#.',
    '...###.',
  ];
  const pass = grid(rows);
  ok(findPath(pass, [0, 0], [4, 3]) === null, '目标被障碍围住：返回 null');
  ok(findPath(pass, [0, 0], [4, 2]) === null, '目标是障碍（不允许走到旁边）：返回 null');
  ok(findPath(pass, [0, 0], [20, 20]) === null, '目标越界：返回 null');
  const sealed = grid(['.#...', '##...', '.....']);
  ok(findPath(sealed, [0, 0], [4, 2]) === null, '起点被围住：返回 null');
}

console.log('目标被占时走到最近的相邻格');
{
  const rows = [
    '.........',
    '.........',
    '.....P...',
    '.........',
    '.........',
  ];
  const pass = grid(rows);
  const p = findPath(pass, [0, 2], [5, 2], { near: true });
  const end = p?.at(-1);
  ok(p && valid(pass, [0, 2], p) && end.join() === '4,2', `走到人物左侧相邻格：${JSON.stringify(end)}`);
  ok(JSON.stringify(findPath(pass, [4, 1], [5, 2], { near: true })) === '[]', '已在旁边：返回空路径');
  ok(findPath(pass, [0, 2], [5, 2]) === null, '不开 near 时目标被占返回 null');
  // 相邻格部分被挡：选路程最短的那一格
  const rows2 = [
    '.........',
    '...###...',
    '...#P....',
    '...###...',
    '.........',
  ];
  const pass2 = grid(rows2);
  const q = findPath(pass2, [0, 2], [4, 2], { near: true });
  ok(q && valid(pass2, [0, 2], q) && q.at(-1).join() === '5,2', `左侧被挡，绕到右侧唯一空格：${JSON.stringify(q?.at(-1))}`);
  const boxed = grid(['###', '#P#', '###', '...']);
  ok(findPath(boxed, [0, 3], [1, 1], { near: true }) === null, '相邻格全被挡：返回 null');
}

console.log('营地布局');
for (const L of Object.values(LAYOUTS)) {
  const errs = checkLayout(L);
  ok(!errs.length, `${L.id}（${L.name}）：${errs.length ? errs.join('；') : '出生点可走到全部功能点与人物站位'}`);
  const g = layoutGrid(L);
  ok(g.free.length >= 40, `${L.id} 可走格 ${g.free.length} 个`);
}

console.log(failed ? `\n寻路测试失败：${failed} 项` : '\n寻路测试全部通过');
process.exit(failed ? 1 : 0);
