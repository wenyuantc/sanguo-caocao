// 行军分析：敌人接战回合、曹操到首领 / 撤离点的回合、单位连通性、出阵格是否可站
// 用法：node scripts/mapgen/analyze.mjs <组字母> [关卡 id ...]
const [group, ...ids] = process.argv.slice(2);
if (!group) throw new Error('用法：node scripts/mapgen/analyze.mjs <组字母> [关卡 id ...]');
const { default: STAGES } = await import(`../../src/stages/${group}.js`);
const { moveCost, IMPASSABLE } = await import('../../src/terrain.js');
const { roleOf } = await import('../../src/logic.js');
const { classOf, SERIES } = await import('../../src/data.js');

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const dist = (map, cls, sx, sy) => {
  const H = map.length, W = map[0].length, D = Array.from({ length: H }, () => Array(W).fill(Infinity));
  D[sy][sx] = 0;
  const q = [[0, sx, sy]];
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = q.shift();
    if (d > D[y][x]) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = moveCost(cls, map[ny][nx]);
      if (c >= IMPASSABLE) continue;
      if (d + c < D[ny][nx]) { D[ny][nx] = d + c; q.push([d + c, nx, ny]); }
    }
  }
  return D;
};
const info = (u) => { const cls = roleOf(u).cls; return { cls, move: classOf(cls).move ?? SERIES[cls].tiers[0].move }; };

for (const s of STAGES) {
  if (ids.length && !ids.includes(s.id)) continue;
  // 事件单位附带登场回合（turn 事件），按开局站位估算接战时需自行加上
  const all = [...s.units, ...(s.events || []).flatMap((e) => (e.units || []).map((u) => ({ ...u, at: e.turn ?? '事件' })))];
  const P = s.units.filter((u) => u.faction === 'player');
  const cc = P.find((u) => u.id === 'caocao') || P[0];
  console.log(`\n== ${s.id} ${s.map[0].length}x${s.map.length} turns ${s.turns}`);
  if (!cc) { console.log('  （无预设我军，跳过）'); continue; }
  // 敌人走到任一我军开局位置相邻格的最少回合（h = hold，@N = 第 N 回合登场）
  const out = [];
  for (const e of all.filter((u) => u.faction === 'enemy')) {
    const { cls, move } = info(e);
    const D = dist(s.map, cls, e.x, e.y);
    let best = Infinity;
    for (const p of P) for (const [dx, dy] of DIRS) { const v = D[p.y + dy]?.[p.x + dx]; if (v < best) best = v; }
    out.push(`${e.id}${e.ai === 'hold' ? '(h)' : ''}${e.at !== undefined ? `@${e.at}` : ''}:${best === Infinity ? 'X' : Math.ceil(best / move)}`);
  }
  console.log('敌到我军(回合):', out.join(' '));
  for (const c of [].concat(s.victory || [])) {
    if (c.type === 'boss') {
      const b = all.find((u) => u.id === c.target);
      if (!b) continue;
      const D = dist(s.map, 'infantry', cc.x, cc.y);
      console.log(`步兵到首领 ${c.target}: ${(D[b.y][b.x] / 4).toFixed(1)} 回合`);
    }
    if (c.type === 'reach' || c.type === 'escape') {
      // reach 指定单位时按该单位计算，'any' 或未指定时按曹操
      const who = (c.unit && c.unit !== 'any' && all.find((u) => u.id === c.unit)) || cc;
      const { cls, move } = info(who);
      const D = dist(s.map, cls, who.x, who.y);
      console.log(`${who.id}到${c.type}格:`, (c.tiles || []).map(([x, y]) => (D[y][x] / move).toFixed(1)).join(' '));
    }
  }
  for (const u of all) {
    const D = dist(s.map, info(u).cls, u.x, u.y);
    if (D[cc.y][cc.x] === Infinity) console.log('  不连通:', u.id, info(u).cls);
  }
  for (const [x, y] of s.deploy?.slots || []) if (moveCost('cavalry', s.map[y][x]) >= IMPASSABLE) console.log('  骑兵不可站 slot', x, y);
}
