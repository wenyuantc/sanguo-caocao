// 战场演出：事件的 stage 指令、援军走入路线、地形变化（城门开关、放火、船）
// 与 actions.js 一样以战斗场景 s 为第一个参数，直接读写 s.map / s.units / s.views / s.cam
import { TILE, MAP_X, MAP_Y } from './config.js';
import { TERRAIN, passable } from './data.js';
import { TERRAIN_PRESETS } from './terrain.js';
import { inMap, isFoe, key } from './logic.js';
import { redrawTiles } from './mapRender.js';
import { wait } from './ui.js';

// 援军默认从最近的地图边缘走入：路线超过这么多格（伏兵等深入地图内部的单位）时改为原地淡入
export const MAX_WALK = 6;
export const WALK_MS = 130; // 演出走位每格时长

const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const cols = (s) => s.map[0].length;
const rows = (s) => s.map.length;
const onEdge = (s, x, y) => x === 0 || y === 0 || x === cols(s) - 1 || y === rows(s) - 1;

// 边缘格外侧一格（地图外的虚拟起点，单位从视口之外走进来）
function outside(s, x, y) {
  if (x === 0) return { x: -1, y };
  if (x === cols(s) - 1) return { x: cols(s), y };
  if (y === 0) return { x, y: -1 };
  return { x, y: rows(s) };
}

// 单位 u 能否经过 / 停在 (x, y)：在地图内、兵种可通行、没有敌对单位（友方可穿过）
function walkable(s, u, x, y) {
  if (!inMap(x, y, s.map) || !passable(u.cls, s.map[y][x])) return false;
  return !s.units.some((o) => o.alive && o !== u && o.x === x && o.y === y && isFoe(o, u));
}

// 广度优先找路：从 start 出发到第一个满足 goal 的格子，返回格子路径（含两端）；limit 为最多步数
function bfs(s, u, start, goal, limit = Infinity) {
  if (!walkable(s, u, start.x, start.y)) return null;
  const prev = new Map([[key(start.x, start.y), null]]);
  let layer = [start];
  for (let d = 0; layer.length; d++) {
    for (const c of layer) {
      if (goal(c.x, c.y)) {
        const path = [];
        for (let n = c; n; n = prev.get(key(n.x, n.y))) path.unshift({ x: n.x, y: n.y });
        return path;
      }
    }
    if (d >= limit) return null;
    const next = [];
    for (const c of layer) {
      for (const [dx, dy] of D4) {
        const x = c.x + dx, y = c.y + dy, k = key(x, y);
        if (prev.has(k) || !walkable(s, u, x, y)) continue;
        prev.set(k, c);
        next.push({ x, y });
      }
    }
    layer = next;
  }
  return null;
}

// 援军登场路线（u 已在目标格）：def.from 指定起点格；def.from === false 或 enter: 'fade' 时淡入；
// 未指定时找最近的地图边缘（≤ MAX_WALK 格）。起点在边缘时补一个地图外的虚拟格。走不通返回 null（淡入）
export function entryRoute(s, u, def) {
  if (def.from === false || def.enter === 'fade') return null;
  let path;
  if (Array.isArray(def.from)) {
    const [fx, fy] = def.from;
    path = bfs(s, u, { x: fx, y: fy }, (x, y) => x === u.x && y === u.y);
  } else {
    path = bfs(s, u, { x: u.x, y: u.y }, (x, y) => onEdge(s, x, y), MAX_WALK);
    path?.reverse();
  }
  if (!path) return null;
  const head = path[0];
  return onEdge(s, head.x, head.y) ? [outside(s, head.x, head.y), ...path] : path;
}

// 演出走位的路线：path 为途经点（相邻两点之间先横后竖补齐），to 为终点（自动找路）；不合法时返回 null
function walkRoute(s, u, cmd) {
  const end = cmd.to || cmd.path?.at(-1);
  if (!end) return null;
  const [tx, ty] = end;
  if (s.units.some((o) => o.alive && o !== u && o.x === tx && o.y === ty)) return null;
  if (cmd.path) {
    const route = [{ x: u.x, y: u.y }];
    for (const [px, py] of cmd.path) {
      let { x, y } = route.at(-1);
      while (x !== px) { x += Math.sign(px - x); route.push({ x, y }); }
      while (y !== py) { y += Math.sign(py - y); route.push({ x, y }); }
    }
    if (route.slice(1).every((c) => walkable(s, u, c.x, c.y))) return route;
    console.warn('演出路径不可通行，改为自动找路', u.id, cmd.path);
  }
  return bfs(s, u, { x: u.x, y: u.y }, (x, y) => x === tx && y === ty);
}

const unitOf = (s, id) => s.units.find((o) => o.alive && o.id === id);
// 指令里的格子：[x, y] 或单位 id
const tileOf = (s, t) => (Array.isArray(t) ? { x: t[0], y: t[1] } : unitOf(s, t));

// ---------- 地形变化 ----------
// spec：{ at: [x, y], set: 预设名（open / close / fire / douse / ship）或地形字符, size?: 1 | 3, from?: '可改写的地形字符' }
// 返回实际改写的格子 [{ x, y, ch }]：跳过地图外、地形不在 from 中、已是目标地形、有单位且新地形对其不可通行的格子
export function terrainCells(s, spec) {
  const preset = TERRAIN_PRESETS[spec.set];
  const ch = preset?.ch ?? spec.set;
  if (!TERRAIN[ch]) { console.warn('未知地形', spec.set); return []; }
  const from = spec.from ?? preset?.from;
  const [ax, ay] = spec.at;
  const r = spec.size === 3 ? 1 : 0;
  const out = [];
  for (let y = ay - r; y <= ay + r; y++) {
    for (let x = ax - r; x <= ax + r; x++) {
      if (!inMap(x, y, s.map) || s.map[y][x] === ch || (from && !from.includes(s.map[y][x]))) continue;
      const o = s.units.find((v) => v.alive && v.x === x && v.y === y);
      if (o && !passable(o.cls, ch)) continue;
      out.push({ x, y, ch });
    }
  }
  return out;
}

// 改写地图格（字符串数组按行替换），记入 s.mapPatches（同一格只保留最后一次）；不重绘
export function patchMap(s, cells) {
  for (const { x, y, ch } of cells) {
    if (!inMap(x, y, s.map) || !TERRAIN[ch]) continue;
    const row = s.map[y];
    s.map[y] = row.slice(0, x) + ch + row.slice(x + 1);
    s.mapPatches = s.mapPatches.filter(([px, py]) => px !== x || py !== y);
    s.mapPatches.push([x, y, ch]);
  }
}

// 地形变化演出：specs 为一条或多条（数组时一起演出）——镜头一次移过去，所有格子同时闪光，重烘地图分块与小地图，记一条日志
export async function changeTerrain(s, specs) {
  const groups = [specs].flat().map((spec) => ({ spec, cells: terrainCells(s, spec) })).filter((g) => g.cells.length);
  const cells = groups.flatMap((g) => g.cells);
  if (!cells.length) return;
  await s.follow(cells);
  const g = s.add.graphics().setDepth(7).setAlpha(0);
  for (const { spec, cells: cs } of groups) {
    const color = TERRAIN_PRESETS[spec.set]?.color ?? TERRAIN[cs[0].ch].color;
    for (const c of cs) g.fillStyle(color, 0.85).fillRect(MAP_X + c.x * TILE, MAP_Y + c.y * TILE, TILE, TILE);
  }
  await new Promise((r) => s.tweens.add({ targets: g, alpha: 1, duration: 220, onComplete: r }));
  patchMap(s, cells);
  redrawTiles(s, s.map, cells);
  s.minimap?.paintTerrain(s.map);
  if (s.minimap) s.minimap.sig = '';
  await new Promise((r) => s.tweens.add({ targets: g, alpha: 0, duration: 380, onComplete: r }));
  g.destroy();
  const names = [...new Set(groups.map(({ spec, cells: cs }) => TERRAIN_PRESETS[spec.set]?.name || `地形变为${TERRAIN[cs[0].ch].name}`))];
  s.hud.log(names.join('，'));
}

// 读档：重放地形变化（只改地图数据，随后由 drawMap 绘制）
export function replayPatches(s, patches) {
  if (!Array.isArray(patches)) return;
  patchMap(s, patches.filter((p) => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1])).map(([x, y, ch]) => ({ x, y, ch })));
}

// ---------- 高亮 ----------
async function highlight(s, cmd) {
  const tiles = (cmd.highlight || []).map((t) => tileOf(s, t)).filter((t) => t && inMap(t.x, t.y, s.map));
  if (!tiles.length) return;
  await s.follow(tiles);
  const g = s.add.graphics().setDepth(6);
  const color = cmd.color ?? 0xffe08a;
  for (const t of tiles) {
    const px = MAP_X + t.x * TILE, py = MAP_Y + t.y * TILE;
    g.fillStyle(color, 0.35).fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    g.lineStyle(3, color, 1).strokeRect(px + 2, py + 2, TILE - 4, TILE - 4);
  }
  const ms = cmd.ms ?? 1200;
  await new Promise((r) => s.tweens.add({ targets: g, alpha: { from: 1, to: 0.15 }, duration: ms / 6, yoyo: true, repeat: 2, onComplete: r }));
  g.destroy();
}

// ---------- 单位走位 ----------
async function walk(s, cmd) {
  const u = unitOf(s, cmd.walk);
  const v = u && s.views.get(u);
  if (!v) { console.warn('演出走位：单位不在场', cmd.walk); return; }
  const route = walkRoute(s, u, cmd);
  if (!route) { console.warn('演出走位：无法到达', cmd.walk, cmd.to || cmd.path); return; }
  const end = route.at(-1);
  await s.follow(u, end);
  u.x = end.x;
  u.y = end.y;
  await v.moveAlong(route, cmd.ms ?? WALK_MS);
}

// 执行一条 stage 指令（spawn 由 runEvent 处理）
export async function stageCmd(s, cmd) {
  if (cmd.camera) {
    const t = tileOf(s, cmd.camera);
    if (t) await s.cam.centerTile(t.x, t.y, cmd.ms);
  } else if (cmd.walk) await walk(s, cmd);
  else if (cmd.highlight) await highlight(s, cmd);
  else if (cmd.terrain) await changeTerrain(s, cmd.terrain);
  else if (cmd.face) {
    const u = unitOf(s, cmd.face);
    // dir：left / right / up / down，或 [x, y] / 单位 id（面向该处）
    const dir = ['left', 'right', 'up', 'down'].includes(cmd.dir) ? cmd.dir : tileOf(s, cmd.dir);
    s.views.get(u)?.faceDir(dir);
    await wait(s, 150);
  } else if (cmd.act) {
    const u = unitOf(s, cmd.act);
    const v = u && s.views.get(u);
    if (v) { await s.follow(u); await v.act(cmd.pose); }
  } else if (cmd.say) await s.dialog.show(cmd.say);
  else if (cmd.wait != null) await wait(s, cmd.wait);
  else console.warn('未知的战场演出指令', cmd);
}
