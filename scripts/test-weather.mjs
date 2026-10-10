// 天气系统测试：node scripts/test-weather.mjs
// 检查关卡天气映射、天气表、每回合随机游走的分布、天气策略、spellUsable 的天气 / 宝玉 / 等级限制、AI 可用策略、四神结算
import assert from 'node:assert/strict';
import { STAGES } from '../src/stages.js';
import {
  WEATHERS, TABLE, STAGE_WEATHER, SUN, CLOUD, RAIN, STORM, SNOW, weatherOf, possibleWeathers, stepWeather, weatherSpellIdx, stageWeather,
} from '../src/weather.js';
import { SPELLS } from '../src/data.js';
import { createUnit, spellUsable, castable, knownSpells, resolveSpell, applySpell, gemSpells } from '../src/logic.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`通过  ${name}`); } catch (e) { console.error(`失败  ${name}\n${e.stack}`); process.exitCode = 1; }
};

// 可复现的伪随机（mulberry32）
const seeded = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test('57 关都有原版天气映射，且与 research §4 一致', () => {
  assert.equal(STAGES.length, 57);
  for (const s of STAGES) assert.ok(STAGE_WEATHER[s.id], `${s.id} 缺少天气映射`);
  const first = (id) => WEATHERS[weatherOf(STAGE_WEATHER[id].type, STAGE_WEATHER[id].start)];
  const expect = {
    yingchuan: '晴', dongzhuo: '阴', yuanshu: '豪雨', lvbu_baowei: '雪', nanpi: '晴', liucheng: '雨', chibi_tuwei: '雨',
    machao: '雪', j_xiaoyao: '雨', j_fancheng: '雨', z_yufupu: '雨', z_wuzhang1: '豪雨', z_wuzhang2: '晴', guandu: '晴',
  };
  for (const [id, w] of Object.entries(expect)) assert.equal(first(id), w, id);
  assert.deepEqual(STAGE_WEATHER.lvbu_baowei, { type: 4, start: 4 });
  assert.deepEqual(STAGE_WEATHER.j_fancheng, { type: 2, start: 3 });
  assert.deepEqual(stageWeather({ id: 'yingchuan', weather: { type: 3, start: 0 } }), { type: 3, start: 0 }, '关卡 weather 字段优先');
});

test('天气表与各类别可能出现的天气（research §2）', () => {
  assert.deepEqual(TABLE[0], [SUN, SUN, SUN, CLOUD, RAIN, STORM]);
  assert.deepEqual(TABLE[1], [SUN, SUN, SUN, SUN, CLOUD, RAIN]);
  assert.deepEqual(TABLE[2], [SUN, CLOUD, RAIN, RAIN, STORM, STORM]);
  assert.deepEqual(TABLE[3], [SUN, SUN, CLOUD, CLOUD, SNOW, SNOW]);
  assert.deepEqual(TABLE[4], [SUN, CLOUD, SNOW, SNOW, SNOW, SNOW]);
  const names = (t) => possibleWeathers(t).map((w) => WEATHERS[w]).join('/');
  assert.equal(names(0), '晴/阴/雨/豪雨');
  assert.equal(names(1), '晴/阴/雨');
  assert.equal(names(2), '晴/阴/雨/豪雨');
  assert.equal(names(3), '晴/阴/雪');
  assert.equal(names(4), '晴/阴/雪');
});

// 序号 i 的理论分布：减 1 为 (i+1)/8，不变 1/8，加 1 为 (6−i)/8，两端回绕
const expected = (i) => ({ [(i + 5) % 6]: (i + 1) / 8, [i]: 1 / 8, [(i + 1) % 6]: (6 - i) / 8 });

test('随机游走：随机数 0~7 逐一枚举，结果与原版算法完全一致', () => {
  for (let i = 0; i < 6; i++) {
    const cnt = {};
    for (let a = 0; a < 8; a++) { const n = stepWeather(i, () => (a + 0.5) / 8); cnt[n] = (cnt[n] || 0) + 1; }
    const exp = Object.fromEntries(Object.entries(expected(i)).map(([k, p]) => [k, p * 8]));
    assert.deepEqual(cnt, exp, `序号 ${i}`);
  }
});

test('随机游走：连续 200 次变化每次只走 ±1 或不变（两端回绕）', () => {
  const rnd = seeded(20261010);
  for (const type of [0, 1, 2, 3, 4]) {
    let idx = 1;
    for (let k = 0; k < 200; k++) {
      const n = stepWeather(idx, rnd);
      assert.ok([idx, (idx + 1) % 6, (idx + 5) % 6].includes(n), `${idx} → ${n}`);
      assert.ok(possibleWeathers(type).includes(weatherOf(type, n)));
      idx = n;
    }
  }
});

test('随机游走：每个序号 200 次及 20000 次抽样的分布与算法一致', () => {
  const rnd = seeded(7);
  for (const [n, tol] of [[200, 0.12], [20000, 0.012]]) {
    for (let i = 0; i < 6; i++) {
      const cnt = {};
      for (let k = 0; k < n; k++) { const r = stepWeather(i, rnd); cnt[r] = (cnt[r] || 0) + 1; }
      const exp = expected(i);
      assert.deepEqual(Object.keys(cnt).sort(), Object.keys(exp).sort(), `序号 ${i} 出现了不可能的结果`);
      for (const [k, p] of Object.entries(exp)) assert.ok(Math.abs(cnt[k] / n - p) <= tol, `序号 ${i}→${k}：${cnt[k] / n} 与 ${p} 相差过大（n=${n}）`);
    }
  }
});

test('天气策略：昙天→阴、晴明→晴、豪雨→本类别最恶劣天气（含雪类别变下雪）', () => {
  for (let type = 0; type < 5; type++) {
    for (let idx = 0; idx < 6; idx++) {
      assert.equal(weatherOf(type, weatherSpellIdx(type, idx, 'sun')), SUN);
      assert.equal(weatherOf(type, weatherSpellIdx(type, idx, 'cloud')), CLOUD);
    }
  }
  const rain = (t) => WEATHERS[weatherOf(t, weatherSpellIdx(t, 1, 'rain'))];
  assert.equal(rain(0), '豪雨');
  assert.equal(rain(1), '雨');
  assert.equal(rain(2), '豪雨');
  assert.equal(rain(3), '雪');
  assert.equal(rain(4), '雪');
  assert.equal(weatherSpellIdx(0, 3, 'sun'), 0, '晴明从序号 0 往后找第一个晴');
  assert.equal(weatherSpellIdx(1, 0, 'cloud'), 4, '晴好类别的阴在序号 4');
});

// 测试单位：非武将总表的 id，兵种按关卡数据；35 级首次出阵自动定为三阶
const jade = (id) => ({ weapon: null, armor: null, acc: id ? { id, lvl: 1, exp: 0 } : null });
const mk = (cls, lvl, gem, extra = {}) => createUnit({ id: `t_${cls}_${lvl}`, name: '测试', cls, faction: 'player', lvl, x: 5, y: 5, ...extra }, null, null, jade(gem));

test('骑马策士习得：昙天 13 级、晴明 27 级（二阶）、豪雨 30 级（三阶）、青龙 35 级', () => {
  assert.ok(knownSpells(mk('mountstrat', 13)).includes('tiantan'));
  assert.ok(!knownSpells(mk('mountstrat', 12)).includes('tiantan'));
  assert.ok(knownSpells(mk('mountstrat', 27)).includes('qingming'));
  const m30 = mk('mountstrat', 30);
  assert.equal(m30.tier, 3);
  assert.ok(knownSpells(m30).includes('haoyu'));
  assert.ok(!knownSpells(mk('mountstrat', 29)).includes('haoyu'));
  assert.equal(SPELLS.tiantan.mp, 10);
  assert.equal(SPELLS.qingming.mp, 16);
  assert.equal(SPELLS.haoyu.mp, 16);
});

test('spellUsable：雨 / 豪雨 / 雪天火系不可用并给出原版提示，水地风不受影响', () => {
  const u = mk('strategist', 35);
  for (const id of ['burn', 'blaze', 'firearr', 'firedragon', 'explode']) {
    for (const w of [RAIN, STORM, SNOW]) assert.deepEqual(spellUsable(id, u, w), { ok: false, reason: '在恶劣天气时无法使用。' }, `${id} ${WEATHERS[w]}`);
    for (const w of [SUN, CLOUD]) assert.equal(spellUsable(id, u, w).ok, true, `${id} ${WEATHERS[w]}`);
  }
  for (const id of ['muddy', 'rock', 'whirl', 'tsunami']) for (const w of [SUN, CLOUD, RAIN, STORM, SNOW]) assert.equal(spellUsable(id, u, w).ok, true, `${id} ${WEATHERS[w]}`);
  u.status = { silence: 2 };
  assert.match(spellUsable('muddy', u, SUN).reason, /禁咒/);
});

test('AI：castable 在恶劣天气排除火系、天气策略不由 AI 使用', () => {
  const u = mk('strategist', 35);
  u.faction = 'enemy';
  assert.ok(castable(u, SUN).includes('burn'));
  for (const w of [RAIN, STORM, SNOW]) assert.ok(!castable(u, w).some((id) => SPELLS[id].noBadWeather), WEATHERS[w]);
  const m = mk('mountstrat', 35, 'jade_qinglong');
  assert.ok(!castable(m, SUN).some((id) => SPELLS[id].setWeather));
  assert.ok(castable(m, RAIN).includes('qinglong'));
  assert.ok(!castable(m, SUN).includes('qinglong'));
});

test('四神：宝玉、等级、天气全部满足才可用，否则说明原因', () => {
  const cases = [
    ['qinglong', 'mountstrat', 'jade_qinglong', [RAIN, STORM, SNOW], '只能在恶劣天气时使用。'],
    ['zhuque', 'strategist', 'jade_zhuque', [SUN], '只能在晴天时使用。'],
    ['xuanwu', 'taoist', 'jade_xuanwu', [CLOUD], '只能在阴天时使用。'],
    ['baihu', 'healer', 'jade_baihu', [SUN, CLOUD, RAIN, STORM, SNOW], null],
  ];
  for (const [id, cls, gem, okWeathers, why] of cases) {
    const u = mk(cls, 35, gem);
    for (let w = 0; w < 5; w++) {
      const r = spellUsable(id, u, w);
      if (okWeathers.includes(w)) assert.deepEqual(r, { ok: true, reason: '' }, `${id} ${WEATHERS[w]}`);
      else assert.deepEqual(r, { ok: false, reason: why }, `${id} ${WEATHERS[w]}`);
    }
    const noGem = mk(cls, 35);
    assert.match(spellUsable(id, noGem, okWeathers[0]).reason, /^需要装备.+宝玉$/, `${id} 无宝玉`);
    const low = mk(cls, 34, gem);
    assert.equal(spellUsable(id, low, okWeathers[0]).reason, '需 35 级（三阶）才能使用', `${id} 等级不足`);
    assert.deepEqual(gemSpells(low), [id], `${id} 装备宝玉未习得时列入菜单`);
    const poor = mk(cls, 35, gem);
    poor.mp = 10;
    assert.match(spellUsable(id, poor, okWeathers[0]).reason, /策略值不足/);
  }
});

const MAP = Array.from({ length: 13 }, () => '.'.repeat(18).split(''));
test('四神结算：青龙 5 次雷击、玄武全图随机异常 / 减益、白虎全体回复并解除异常', () => {
  const rnd = seeded(99);
  const m = mk('mountstrat', 35, 'jade_qinglong');
  const foes = [[6, 5], [7, 5], [6, 6]].map(([x, y], i) => createUnit({ id: `e${i}`, name: '敌兵', cls: 'infantry', faction: 'enemy', lvl: 10, x, y }, null, null));
  const r = resolveSpell(MAP, [m, ...foes], m, 'qinglong', foes[0], rnd);
  assert.equal(r.strikes.length, 5);
  assert.equal(r.effects.reduce((n, e) => n + e.strikes, 0), r.strikes.filter((s) => s.hit).length);
  const t = mk('taoist', 35, 'jade_xuanwu');
  const all = [t, m, ...foes];
  const rx = resolveSpell(MAP, all, t, 'xuanwu', t, rnd);
  assert.equal(rx.effects.length, all.length - 1, '玄武作用于施策者以外的全部单位（不分敌我）');
  for (const e of rx.effects) if (e.hit) assert.ok(e.status || e.buff?.mult === 0.7);
  const h = mk('healer', 35, 'jade_baihu');
  m.hp = 10; m.status = { poison: 3, confuse: 2 };
  const rb = resolveSpell(MAP, [h, m, ...foes], h, 'baihu', h, rnd);
  assert.deepEqual(rb.effects.map((e) => e.u), [h, m], '白虎只作用于我方');
  applySpell(rb);
  assert.ok(m.hp > 10);
  assert.deepEqual(m.status, {});
});

console.log(process.exitCode ? '\n天气测试失败' : `\n天气测试全部通过（${passed} 项）`);
