// 关卡登记表：汇总各分组关卡，按 id 串联（含条件分支与红色指数分路）
import groupA from './stages/a.js';
import groupB from './stages/b.js';
import groupC from './stages/c.js';
import groupD from './stages/d.js';
import groupE from './stages/e.js';
import groupF from './stages/f.js';
import { DEBUG_STAGES } from './stages/debug.js';
import { normalizeStage, FIRST_STAGE, ENDINGS, LEGACY, PLANNED_IDS } from './stageMeta.js';

export { FIRST_STAGE, ENDINGS, PLANNED_IDS };

export const STAGES = [...groupA, ...groupB, ...groupC, ...groupD, ...groupE, ...groupF].map(normalizeStage);

const BY_ID = new Map(STAGES.map((s) => [s.id, s]));
// 调试关卡（?stage=test_bigmap）：可以按 id 取到，但不在 STAGES 中
const DEBUG = new Map(DEBUG_STAGES.map(normalizeStage).map((s) => [s.id, s]));


export function getStage(id) {
  if (typeof id === 'number') id = LEGACY[id];
  return BY_ID.get(id) || DEBUG.get(id);
}

// 红色指数：>= 3 忠臣线（黄），<= -3 奸雄线（橙），其余为中间路线（剧情同奸雄线）
export function routeOf(red = 0) {
  if (red >= 3) return 'loyal';
  if (red <= -3) return 'villain';
  return 'middle';
}

// 解析下一关：next 可以是字符串，或 { annihilate, retreat, <outcome>, default, route: { loyal, villain } }
export function resolveNext(stage, outcome, annihilated, red) {
  const n = stage.next;
  if (!n || typeof n === 'string') return n;
  if (n.route) {
    const r = routeOf(red);
    return r === 'loyal' ? n.route.loyal : n.route.villain;
  }
  if (annihilated && n.annihilate) return n.annihilate;
  return n[outcome] || n.default;
}
