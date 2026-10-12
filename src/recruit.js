// 招募：花金币招募通用小兵与非剧情武将（纯函数 + registry 读写，不依赖 Phaser，Node 可直接导入）
// registry 键：recruits { [id]: { name, cls, kind: 'general'|'soldier', bonus } }、recruitPool { stageId, names, refreshLeft }
// 招募后同时写入 roster / joined，成长、装备、果子沿用我军武将的通路（generals.js 的 generalOf / isGeneral 认得招募 id）
import { SERIES, STAT5 } from './data.js';
import { tierFor } from './logic.js';
import { GENERALS, setRecruits } from './generals.js';
import { CHARACTERS, CLASS_BY_NAME } from './characters.js';
import { STAGES } from './stages.js';

export const START_GOLD = 1000; // 新游戏的军资金（开局即可招募）
export const POOL_SIZE = 4; // 每批武将候选人数
export const REFRESHES = 3; // 每关免费刷新次数
export const SOLDIER_CLS = ['infantry', 'archer', 'cavalry', 'strategist', 'healer'];
// 君主 / 非战斗 / 特殊人物：不进候选
export const RECRUIT_EXCLUDE = new Set([
  '刘备', '孙坚', '孙策', '孙权', '袁绍', '袁术', '董卓', '张角', '张鲁', '刘璋', '陶谦', '孟获', '韩遂',
  '献帝', '魔王孔明', '孔明幻影', '亡灵集合体', '许劭', '田氏', '黄承彦',
]);
const BAD_CLS = new Set(['lord', 'emperor', 'commoner', 'transport']);
const STEMS = '甲乙丙丁戊己庚辛壬癸';

// 关卡数据中同名单位的兵种（取首次出现），兵种登记表优先
const STAGE_CLS = {};
for (const s of STAGES) {
  for (const u of [...s.units, ...s.events.flatMap((e) => e.units || [])]) if (!(u.name in STAGE_CLS)) STAGE_CLS[u.name] = u.cls;
}
const GENERAL_NAMES = new Set(Object.values(GENERALS).map((g) => g.name));
export const recruitClassOf = (name) => CLASS_BY_NAME[name] || STAGE_CLS[name];

// 武将候选全集（不含已招募的武将）
export function generalPool(recruits = {}) {
  const taken = new Set(Object.values(recruits).map((r) => r.name));
  return Object.keys(CHARACTERS).filter((n) => {
    const cls = recruitClassOf(n);
    return !GENERAL_NAMES.has(n) && !RECRUIT_EXCLUDE.has(n) && !taken.has(n) && cls && SERIES[cls] && !BAD_CLS.has(cls);
  });
}

// 曹操等级：roster 记录，首战之前取关卡预设
export const lordLevel = (roster, stage) => roster?.caocao?.lvl || stage?.units.find((u) => u.id === 'caocao')?.lvl || 1;
export const recruitLevel = (lordLvl) => Math.max(1, lordLvl - 1);
export const soldierPrice = (lvl) => 300 + lvl * 10;
export const generalPrice = (lvl) => 800 + lvl * 30;

// 强弱靠加成区分：武将主属性（策士类为精神，其余为攻击）+6、兵力 +4；小兵五项与兵力各 -4
export function recruitBonus(kind, cls) {
  if (kind === 'general') return { hp: 4, [SERIES[cls].type === 'mage' ? 'int' : 'atk']: 6 };
  return Object.fromEntries([['hp', -4], ...STAT5.map((k) => [k, -4])]);
}

// 随机抽一批候选：尽量避开 avoid（刷新前的一批），不够时再从 avoid 中补
export function rollCandidates(recruits, avoid = [], n = POOL_SIZE, rng = Math.random) {
  const all = generalPool(recruits);
  const pick = (arr, k) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  };
  const fresh = pick(all.filter((x) => !avoid.includes(x)), n);
  return [...fresh, ...pick(all.filter((x) => avoid.includes(x)), n - fresh.length)];
}

// 本关的候选：没有或属于别的关卡时重新生成（每关换批、刷新次数重置），写入 registry
export function ensurePool(registry, stageId) {
  const pool = registry.get('recruitPool');
  if (pool && pool.stageId === stageId) return pool;
  const next = { stageId, names: rollCandidates(registry.get('recruits') || {}), refreshLeft: REFRESHES };
  registry.set('recruitPool', next);
  return next;
}

// 手动刷新：次数用尽时返回 null
export function refreshPool(registry, stageId) {
  const pool = ensurePool(registry, stageId);
  if (pool.refreshLeft <= 0) return null;
  const next = { stageId, names: rollCandidates(registry.get('recruits') || {}, pool.names), refreshLeft: pool.refreshLeft - 1 };
  registry.set('recruitPool', next);
  return next;
}

// id 用 rec 前缀：关卡单位已有 r1~r6（穰山之战敌军），不能重名
const nextId = (recruits) => `rec${Math.max(0, ...Object.keys(recruits).map((id) => Number(id.slice(3)) || 0)) + 1}`;

// 小兵自动命名：兵种名 + 天干（步兵甲、步兵乙……），十个用完后加数字（步兵甲2）
export function soldierName(recruits, cls) {
  const i = Object.values(recruits).filter((r) => r.kind === 'soldier' && r.cls === cls).length;
  return `${SERIES[cls].name}${STEMS[i % 10]}${i >= 10 ? Math.floor(i / 10) + 1 : ''}`;
}

// 招募一名单位（金币由调用方扣除）：写入 recruits / roster / joined 并同步镜像；武将从候选中移除。返回新 id
// spec：{ kind: 'soldier', cls } 或 { kind: 'general', name }
export function recruitUnit(registry, spec, lvl) {
  const recruits = { ...(registry.get('recruits') || {}) };
  const cls = spec.kind === 'general' ? recruitClassOf(spec.name) : spec.cls;
  const name = spec.kind === 'general' ? spec.name : soldierName(recruits, cls);
  const id = nextId(recruits);
  recruits[id] = { name, cls, kind: spec.kind, bonus: recruitBonus(spec.kind, cls) };
  registry.set('recruits', recruits);
  setRecruits(recruits);
  registry.set('roster', { ...(registry.get('roster') || {}), [id]: { lvl, exp: 0, cls, tier: tierFor(cls, lvl) } });
  registry.set('joined', [...(registry.get('joined') || []), id]);
  const pool = registry.get('recruitPool');
  if (spec.kind === 'general' && pool) registry.set('recruitPool', { ...pool, names: pool.names.filter((n) => n !== name) });
  return id;
}
