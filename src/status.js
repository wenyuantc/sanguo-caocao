// 异常状态与增减益（纯函数，不依赖 Phaser）
// u.status = { poison?, paralyze?, confuse?, silence? }：值为剩余回合数
// u.buffs = { atk?, int?, def?, burst?, morale?: { mult, turns }, move?: { add, turns } }
import { classOf } from './data.js';

export const STATUS = {
  poison: { name: '中毒', short: '毒', color: 0x6ad040, css: '#9ce07a' },
  paralyze: { name: '麻痹', short: '麻', color: 0xf0d030, css: '#ffe07a' },
  confuse: { name: '混乱', short: '乱', color: 0xb070ff, css: '#d0a8ff' },
  silence: { name: '禁咒', short: '禁', color: 0x9a9ab0, css: '#c8c8d8' },
};
export const STATUS_KEYS = Object.keys(STATUS);
// 自行设计：异常最多持续 4 回合（含施加当回合），增减益持续 3 回合
export const STATUS_TURNS = 4;
export const BUFF_TURNS = 3;
export const BUFF_NAME = { atk: '攻击', int: '精神', def: '防御', burst: '爆发', morale: '士气', move: '移动' };
// 中毒：每回合损失最大兵力的 10%
export const POISON_RATE = 0.1;
// 主将（曹操）与关卡 protect 单位（u.guard）受到的伤害倍率（自行设计，logic.js 再导出）：
// 原版三阶射程（连弩 2~4、霹雳车 4~5、步兵周围 8 格）让能打到主将的敌人成倍增加，而关卡站位按旧射程设计；中毒扣血同样减轻
export const GUARD_TAKEN = 0.7;
// 自然恢复概率（自行设计）：10% + 士气 / 800，最高 50%
export const recoverChance = (u) => Math.min(0.5, 0.1 + effStats(u).morale / 800);

// 文官（策士系、都督、咒术士等 type 为 mage 的兵种）：“攻击 / 精神”类增减益作用于精神，其他作用于攻击
export const isScholar = (u) => classOf(u.cls, u.tier).type === 'mage';
// 增减益实际作用的能力项：power → 攻击 / 精神；all（霸气）→ 攻击或精神 + 防御 + 爆发 + 士气
export function buffStats(u, stat) {
  const pw = isScholar(u) ? 'int' : 'atk';
  if (stat === 'power') return [pw];
  if (stat === 'all') return [pw, 'def', 'burst', 'morale'];
  return [stat];
}

export const has = (u, key) => !!u.status?.[key];
export const canMove = (u) => !has(u, 'paralyze') && !has(u, 'confuse');
export const canAct = (u) => !has(u, 'confuse');
export const canCast = (u) => !has(u, 'silence') && !has(u, 'confuse');
export const canCounter = (u) => !has(u, 'confuse');
// 混乱的目标被攻击、被施策必中
export const alwaysHit = (t) => has(t, 'confuse');

// 套用增减益后的能力（无增减益时直接返回 stats）
export function effStats(u) {
  const b = u.buffs;
  if (!b) return u.stats;
  let s = null;
  for (const k in b) {
    if (k === 'move' || !b[k]) continue;
    s ??= { ...u.stats };
    s[k] = Math.round(u.stats[k] * b[k].mult);
  }
  return s || u.stats;
}
export const moveBonus = (u) => u.buffs?.move?.add || 0;

export function applyStatus(u, key) {
  u.status = { ...u.status, [key]: STATUS_TURNS };
}

// 解除异常：key 为状态名或 'all'；返回被解除的状态列表
export function cure(u, key) {
  const keys = (key === 'all' ? STATUS_KEYS : [key]).filter((k) => has(u, k));
  if (!keys.length) return [];
  const s = { ...u.status };
  keys.forEach((k) => delete s[k]);
  u.status = s;
  return keys;
}

// 增减益：同一能力不叠加，只刷新回合数（新效果覆盖旧效果）；返回作用的能力项
export function applyBuff(u, buff) {
  const b = { ...u.buffs };
  if (buff.stat === 'move') {
    b.move = { add: buff.add, turns: BUFF_TURNS };
    u.buffs = b;
    return ['move'];
  }
  const keys = buffStats(u, buff.stat);
  for (const k of keys) b[k] = { mult: buff.mult, turns: BUFF_TURNS };
  u.buffs = b;
  return keys;
}

// 是否已有同方向的增减益（AI 避免重复施放）
export function hasBuff(u, buff) {
  if (buff.stat === 'move') return !!u.buffs?.move;
  return buffStats(u, buff.stat).every((k) => u.buffs?.[k] && (u.buffs[k].mult > 1) === (buff.mult > 1));
}

// 所属阵营阶段开始时调用：中毒扣血（最低留 1，主将按 GUARD_TAKEN 减轻）、异常按士气概率自然恢复或到期、增减益回合递减
// rate：中毒每回合扣血比例（关卡 poisonRate，缺省 POISON_RATE）
// 返回事件列表 [{ type: 'poison', dmg } | { type: 'recover', key } | { type: 'expire', key }]
export function tickStatus(u, rng = Math.random, rate = POISON_RATE) {
  const ev = [];
  if (has(u, 'poison')) {
    const dmg = Math.min(u.hp - 1, Math.round(u.stats.hp * rate * (u.guard ? GUARD_TAKEN : 1)));
    if (dmg > 0) { u.hp -= dmg; ev.push({ type: 'poison', dmg }); }
  }
  if (u.status) {
    const s = { ...u.status };
    const p = recoverChance(u);
    for (const k of STATUS_KEYS) {
      if (!s[k]) continue;
      s[k] -= 1;
      if (s[k] <= 0 || rng() < p) { delete s[k]; ev.push({ type: 'recover', key: k }); }
    }
    u.status = s;
  }
  if (u.buffs) {
    const b = {};
    for (const [k, v] of Object.entries(u.buffs)) {
      if (!v) continue;
      if (v.turns > 1) b[k] = { ...v, turns: v.turns - 1 };
      else ev.push({ type: 'expire', key: k });
    }
    u.buffs = b;
  }
  return ev;
}

// 状态摘要（信息面板 / 部队情报）：[{ text, color }]
export function statusList(u) {
  const out = [];
  for (const k of STATUS_KEYS) if (has(u, k)) out.push({ text: `${STATUS[k].name}${u.status[k]}`, color: STATUS[k].css });
  for (const [k, v] of Object.entries(u.buffs || {})) {
    if (!v) continue;
    const up = k === 'move' || v.mult > 1;
    out.push({ text: `${up ? '↑' : '↓'}${BUFF_NAME[k]}${v.turns}`, color: up ? '#9ce0a8' : '#ff8a7a' });
  }
  return out;
}
