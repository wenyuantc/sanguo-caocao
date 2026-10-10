// 装备与宝物（原版 87 种，见 research equipment.md）：纯数据与纯函数，不依赖 Phaser（Node 可导入）
// 装备实例 { uid?, id, lvl, exp }：我军实例带 uid（registry inventory 中唯一），敌军 / 临时成员的默认装备没有 uid
// 单位 u.equip = { weapon, armor, acc }：各栏为实例或 null
import { SERIES } from './data.js';

export const SLOTS = ['weapon', 'armor', 'acc'];
export const SLOT_NAME = { weapon: '武器', armor: '护具', acc: '辅助' };
// 装备经验：满 100 升 1 级；普通装备最高 3 级，宝物最高 9 级；辅助类不升级（未能查证，自行设计）
export const EXP_PER_LVL = 100;
export const NORMAL_CAP = 3;
export const TREASURE_CAP = 9;
// 每次攻击 / 被攻击获得的装备经验（原版增量未能查证，自行设计）：命中 8、落空 3；被攻击命中 6
export const GEAR_EXP = { hit: 8, miss: 3, struck: 6 };
// 吃果子：对应能力 +2（原版）；经验果 +50 经验（自行设计）
export const FRUIT_GAIN = 2;
export const FRUIT_EXP = 50;
// 战后金钱 = 曹操等级 × 100 + 700（research §7）
export const goldFor = (lordLvl) => lordLvl * 100 + 700;
// 宝物取得 / 自带等级 = 等级 / 4 + 1（research §3）
export const treasureLvl = (lvl) => Math.min(TREASURE_CAP, Math.floor(lvl / 4) + 1);

// 类别：名称、栏位、可装备系列（武器、护具按 research §2；普通辅助品的可装备系列原版查不到，自行设计）
const ARMORED = ['lord', 'infantry', 'archer', 'cavalry', 'archercav', 'xiliang'];
const ROBED = ['catapult', 'taoist', 'healer', 'strategist', 'bandit', 'fighter', 'mountstrat', 'dancer', 'yellow', 'pirate', 'dudu', 'sorcerer'];
const FIGHTERS = Object.keys(SERIES).filter((c) => !['mage', 'noble'].includes(SERIES[c].type));
const MAGES = Object.keys(SERIES).filter((c) => SERIES[c].type === 'mage');
const RIDERS = Object.keys(SERIES).filter((c) => SERIES[c].moveType === 'horse' && SERIES[c].type !== 'noble');
const ANY = Object.keys(SERIES).filter((c) => SERIES[c].type !== 'noble');
export const KINDS = {
  sword: { name: '剑', slot: 'weapon', series: ['lord', 'infantry', 'bandit', 'yellow', 'pirate'] },
  spear: { name: '枪', slot: 'weapon', series: ['cavalry', 'xiliang'] },
  bow: { name: '弓', slot: 'weapon', series: ['archer', 'archercav'] },
  staff: { name: '棍', slot: 'weapon', series: ['fighter', 'dancer'] },
  cata: { name: '投石机', slot: 'weapon', series: ['catapult'] },
  fan: { name: '扇', slot: 'weapon', series: ['strategist', 'mountstrat', 'dudu'] },
  jian: { name: '宝剑', slot: 'weapon', series: ['healer', 'taoist', 'sorcerer'] },
  mail: { name: '铠', slot: 'armor', series: ARMORED },
  robe: { name: '衣', slot: 'armor', series: ROBED },
  shield: { name: '盾', slot: 'acc', series: ARMORED },
  barding: { name: '马铠', slot: 'acc', series: RIDERS },
  helm: { name: '盔', slot: 'acc', series: FIGHTERS },
  scarf: { name: '巾', slot: 'acc', series: MAGES },
  glove: { name: '手套', slot: 'acc', series: ANY },
  horse: { name: '马', slot: 'acc', series: ANY },
  book: { name: '书', slot: 'acc', series: ANY },
  jade: { name: '宝玉', slot: 'acc', series: ANY },
  wheel: { name: '轮', slot: 'acc', series: ANY },
  seal: { name: '印', slot: 'acc', series: ANY },
  dart: { name: '暗器', slot: 'acc', series: ANY },
  bag: { name: '袋', slot: 'acc', series: ANY },
};

// 普通装备 3 级卖出得到的果子（research §4）；辅助品不换果子
const FRUIT_OF = { sword: 'fruit_exp', spear: 'fruit_atk', cata: 'fruit_atk', bow: 'fruit_morale', staff: 'fruit_morale', fan: 'fruit_int', jian: 'fruit_int', mail: 'fruit_def', robe: 'fruit_burst' };

// 普通武器、护具数值（原版查不到，自行设计）：初 / 中 / 高三档的 [1 级, 3 级]；价格自行设计
const TIER_VAL = [[8, 16], [20, 30], [34, 46]];
const TIER_PRICE = [300, 900, 2000];
const MAIN_OF = { sword: 'atk', spear: 'atk', bow: 'atk', staff: 'atk', cata: 'atk', fan: 'int', jian: 'int', mail: 'def', robe: 'def' };
const normal = (kind, tier, name) => ({
  name, kind, slot: KINDS[kind].slot, treasure: false, tier,
  main: MAIN_OF[kind], base: TIER_VAL[tier - 1][0], max: TIER_VAL[tier - 1][1],
  price: TIER_PRICE[tier - 1], sellFruit: FRUIT_OF[kind], effects: [], selfDesigned: ['数值', '价格'],
});
// 普通辅助品：数值、价格、可装备系列均为自行设计（盔加兵力、巾加策略值，参考 E12 对铁盔 / 诸葛巾的说明）
const accessory = (kind, tier, name, extra, price) => ({
  name, kind, slot: 'acc', treasure: false, tier, main: null, base: 0, max: 0, extra, price, effects: [],
  selfDesigned: ['数值', '价格', '可装备系列'],
});
// 宝物：main 为随等级成长的能力（Lv9 值 = research §5 的 LV9 最大值，Lv1 值取其 1/4，自行设计）；extra 为不随等级变化的固定加成
// 扇 / 宝剑类按游戏内说明加精神（E1 写 AT+，E12 写精神力+，取后者）
const treasure = (kind, name, max, effects = [], extra = null, series = null) => ({
  name, kind, slot: KINDS[kind].slot, treasure: true,
  main: max ? MAIN_OF[kind] : null, base: max ? Math.round(max / 4) : 0, max: max || 0,
  extra, effects, ...(series && { series }),
});

export const EQUIP = {
  // ---------- 普通武器（21） ----------
  sword1: normal('sword', 1, '短剑'), sword2: normal('sword', 2, '大剑'), sword3: normal('sword', 3, '钢剑'),
  spear1: normal('spear', 1, '短枪'), spear2: normal('spear', 2, '长枪'), spear3: normal('spear', 3, '钢枪'),
  bow1: normal('bow', 1, '短弓'), bow2: normal('bow', 2, '大弓'), bow3: normal('bow', 3, '铁弓'),
  staff1: normal('staff', 1, '木棍'), staff2: normal('staff', 2, '铜棍'), staff3: normal('staff', 3, '铁棍'),
  cata1: normal('cata', 1, '木制投石机'), cata2: normal('cata', 2, '铜制投石机'), cata3: normal('cata', 3, '铁制投石机'),
  fan1: normal('fan', 1, '竹扇'), fan2: normal('fan', 2, '军扇'), fan3: normal('fan', 3, '铁扇'),
  jian1: normal('jian', 1, '石制宝剑'), jian2: normal('jian', 2, '铜制宝剑'), jian3: normal('jian', 3, '铁制宝剑'),
  // ---------- 普通护具（6） ----------
  mail1: normal('mail', 1, '皮铠'), mail2: normal('mail', 2, '铜铠'), mail3: normal('mail', 3, '铁铠'),
  robe1: normal('robe', 1, '布衣'), robe2: normal('robe', 2, '皮衣'), robe3: normal('robe', 3, '战斗服'),
  // ---------- 普通辅助（10） ----------
  shield1: accessory('shield', 1, '皮盾', { def: 8 }, 400), shield2: accessory('shield', 2, '铜盾', { def: 16 }, 1000),
  barding1: accessory('barding', 1, '皮制马铠', { def: 5, hp: 10 }, 400), barding2: accessory('barding', 2, '铜制马铠', { def: 10, hp: 20 }, 1000),
  helm1: accessory('helm', 1, '皮盔', { hp: 15 }, 400), helm2: accessory('helm', 2, '铜盔', { hp: 30 }, 1000),
  scarf1: accessory('scarf', 1, '方巾', { mp: 10 }, 400), scarf2: accessory('scarf', 2, '纶巾', { mp: 25 }, 1000),
  glove1: accessory('glove', 1, '布手套', { burst: 5 }, 400), glove2: accessory('glove', 2, '皮手套', { burst: 10 }, 1000),
  // ---------- 宝物武器（17） ----------
  cixiong: treasure('sword', '雌雄双剑', 88, [{ type: 'reCounter' }]),
  qinggang: treasure('sword', '青釭剑', 90, [{ type: 'vsHorse', mult: 1.5 }]),
  yitian: treasure('sword', '倚天剑', 88, [{ type: 'hitDown', v: 15 }]),
  guding: treasure('sword', '古锭刀', 90, [], { burst: 10 }),
  qinglong: treasure('spear', '青龙偃月刀', 90, [{ type: 'noCounter' }]),
  shemao: treasure('spear', '蛇矛', 90, [{ type: 'pierce' }]),
  fangtian: treasure('spear', '方天画戟', 90, [{ type: 'chain' }]),
  lvbu_bow: treasure('bow', '吕布之弓', 84, [{ type: 'onHitStatus', status: 'paralyze' }]),
  liguang_bow: treasure('bow', '李广之弓', 86, [{ type: 'onHitStatus', status: 'silence' }]),
  liuxing: treasure('staff', '流星锤', 84, [{ type: 'onHitStatus', status: 'confuse' }]),
  shuangbian: treasure('staff', '双鞭', 86, [{ type: 'reCounter' }]),
  jinhuo: treasure('cata', '金火罐炮', 88, [{ type: 'onHitStatus', status: 'poison' }]),
  bajiao: treasure('fan', '芭蕉扇', 90, [{ type: 'elemUp', elem: 'wind', mult: 1.2 }]),
  wuhuo: treasure('fan', '五火神焰扇', 90, [{ type: 'elemUp', elem: 'fire', mult: 1.2 }]),
  baiyu: treasure('fan', '白羽扇', 88, [{ type: 'mpHalf' }]),
  qixing: treasure('jian', '七星剑', 86, [{ type: 'spellHitUp', v: 15 }]),
  shengzhe: treasure('jian', '圣者宝剑', 86, [], { mp: 20 }),
  // ---------- 宝物护具（9） ----------
  jingkai: treasure('mail', '镜铠', 88, [{ type: 'rangedImmune' }]),
  huangjin: treasure('mail', '黄金铠', 90, [{ type: 'noCrit' }]),
  // 连环铠“防御两次攻击”：本游戏没有原版的连击，改为同一阶段内第 2 次起受到的普通攻击伤害减半（自行设计）
  lianhuan: treasure('mail', '连环铠', 90, [{ type: 'secondHalf' }]),
  baiyin_kai: treasure('mail', '白银铠', 90, [{ type: 'spellTaken', mult: 0.5 }]),
  longlin: treasure('mail', '龙鳞铠', 88, [{ type: 'mpShield' }]),
  feilong: treasure('robe', '飞龙道袍', 86, [], { burst: 10 }),
  hechang: treasure('robe', '鹤氅', 92, [], { int: 10 }),
  qihei: treasure('robe', '漆黑道服', 84, [], { mp: 20 }),
  fenghuang: treasure('robe', '凤凰羽衣', 90, [{ type: 'healEachTurn', rate: 0.2 }]),
  // ---------- 宝物辅助（24） ----------
  baiyin_dun: treasure('shield', '白银盾', 0, [{ type: 'spellHitDown', v: 15 }], null, ANY),
  fengshen: treasure('shield', '风神盾', 0, [{ type: 'hitDown', v: 15 }, { type: 'spellHitDown', v: 15 }], null, ANY),
  fengche: treasure('wheel', '风车轮', 0, [{ type: 'move', v: 2 }], null, ['catapult']),
  zhuahuang: treasure('horse', '爪黄飞电', 0, [{ type: 'move', v: 2 }]),
  jueying: treasure('horse', '绝影', 0, [{ type: 'move', v: 1 }]),
  chitu: treasure('horse', '赤兔马', 0, [{ type: 'passThrough' }]),
  dilu: treasure('horse', '的卢', 0, [{ type: 'allTerrain' }]),
  tiekui: treasure('helm', '铁盔', 0, [], { hp: 45 }, ['infantry']),
  zhuge_scarf: treasure('scarf', '诸葛巾', 0, [], { mp: 45 }, ANY),
  meiyu: treasure('dart', '没羽箭', 0, [{ type: 'range', range: 'r12' }], null, ['bandit']),
  sunzi: treasure('book', '孙子兵法', 0, [{ type: 'expPerTurn', v: 4 }]),
  mengde: treasure('book', '孟德新书', 0, [{ type: 'expMul', v: 1.5 }]),
  qingnang: treasure('book', '青囊书', 0, [{ type: 'healEachTurn', rate: 0.2 }]),
  taiping_qing: treasure('book', '太平清领道', 0, [{ type: 'cureEachTurn' }]),
  taiping_yao: treasure('book', '太平要术', 0, [{ type: 'mpEachTurn', v: 10 }]),
  dunjia: treasure('book', '遁甲天书', 0, [{ type: 'copySpells' }]),
  // 六韬 / 三略每回合的装备经验原版查不到，自行设计为 10
  liutao: treasure('book', '六韬', 0, [{ type: 'weaponExpPerTurn', v: 10 }]),
  sanlue: treasure('book', '三略', 0, [{ type: 'armorExpPerTurn', v: 10 }]),
  // 豆袋：兵力降到六成以下时自动吃一颗军需中的豆（触发线自行设计）
  doudai: treasure('bag', '豆袋', 0, [{ type: 'autoBean', below: 0.6 }]),
  yuxi: treasure('seal', '玉玺', 0, [{ type: 'alwaysCrit' }]),
  // 四神宝玉：使用四神的前提（另需习得等级与天气条件，见 spells.js / logic.spellUsable）
  jade_qinglong: treasure('jade', '青龙宝玉', 0, [{ type: 'fourGod', god: '青龙' }], null, ['mountstrat']),
  jade_zhuque: treasure('jade', '朱雀宝玉', 0, [{ type: 'fourGod', god: '朱雀' }], null, ['strategist']),
  jade_xuanwu: treasure('jade', '玄武宝玉', 0, [{ type: 'fourGod', god: '玄武' }], null, ['taoist']),
  jade_baihu: treasure('jade', '白虎宝玉', 0, [{ type: 'fourGod', god: '白虎' }], null, ['healer']),
};
for (const [id, e] of Object.entries(EQUIP)) {
  e.id = id;
  e.series ??= KINDS[e.kind].series;
  e.cap = e.treasure ? TREASURE_CAP : NORMAL_CAP;
  // 辅助类不升级
  if (e.slot === 'acc') e.cap = 1;
}

// 宝物效果说明（整备界面 / 奖励面板）
const FX_DESC = {
  reCounter: () => '被反击后再反击一次', vsHorse: () => '攻击骑马的骑兵类伤害 +50%', hitDown: (e) => `敌人攻击的命中率 −${e.v}%`,
  noCounter: () => '被攻击的敌人不能反击', pierce: () => '同时攻击目标身后一格的敌人', chain: () => '击破目标后继续攻击相邻防御最低的敌人',
  onHitStatus: (e) => `攻击命中附带${{ paralyze: '麻痹', silence: '禁咒', confuse: '混乱', poison: '中毒' }[e.status]}`,
  elemUp: (e) => `${{ wind: '风', fire: '火' }[e.elem]}系策略伤害 +20%`, mpHalf: () => '策略消耗减半', spellHitUp: (e) => `策略成功率 +${e.v}%`,
  rangedImmune: () => '远距离攻击无效', noCrit: () => '不会被会心一击', secondHalf: () => '同一阶段第 2 次起受到的攻击伤害减半',
  spellTaken: () => '受到的策略伤害减半', mpShield: () => '以策略值代替兵力承受普通攻击', healEachTurn: (e) => `每回合恢复兵力 ${e.rate * 100}%`,
  spellHitDown: (e) => `敌人策略的成功率 −${e.v}%`, move: (e) => `移动力 +${e.v}`, passThrough: () => '可以穿过敌军移动',
  allTerrain: () => '可通行地形的移动消耗都为 1', range: () => '攻击范围扩大为周围两格', expPerTurn: (e) => `每回合获得经验 ${e.v}`,
  expMul: () => '获得经验 ×1.5', cureEachTurn: () => '每回合解除异常状态', mpEachTurn: (e) => `每回合恢复策略值 ${e.v}`,
  copySpells: () => '可使用相邻友军会的策略', weaponExpPerTurn: (e) => `每回合武器经验 +${e.v}`, armorExpPerTurn: (e) => `每回合护具经验 +${e.v}`,
  autoBean: () => '兵力不足六成时自动吃豆', alwaysCrit: () => '每次攻击都是会心一击', fourGod: (e) => `可以使用四神「${e.god}」（需达到习得等级）`,
};
const STAT_LABEL = { hp: '兵力', mp: '策略', atk: '攻击', int: '精神', def: '防御', burst: '爆发', morale: '士气' };

// 等级 lvl 的能力加成：main 从 1 级值线性提升到上限等级的值，extra 固定
export function gearStats(id, lvl = 1) {
  const e = EQUIP[id];
  const out = { ...(e.extra || {}) };
  if (e.main) {
    const t = e.cap > 1 ? (Math.min(lvl, e.cap) - 1) / (e.cap - 1) : 0;
    out[e.main] = (out[e.main] || 0) + Math.round(e.base + (e.max - e.base) * t);
  }
  return out;
}

// 单位全部装备的能力加成合计
export function equipStats(equip) {
  const out = {};
  for (const s of SLOTS) {
    const it = equip?.[s];
    if (!it) continue;
    for (const [k, v] of Object.entries(gearStats(it.id, it.lvl))) out[k] = (out[k] || 0) + v;
  }
  return out;
}

// 装备说明：能力加成 + 特效
export function gearDesc(id, lvl = 1) {
  const e = EQUIP[id];
  const st = Object.entries(gearStats(id, lvl)).map(([k, v]) => `${STAT_LABEL[k]}+${v}`);
  return [...st, ...e.effects.map((f) => FX_DESC[f.type](f))].join('　') || '无';
}
export const gearName = (it) => `${EQUIP[it.id].name}${EQUIP[it.id].cap > 1 ? ` Lv${it.lvl}` : ''}`;

export const canEquip = (id, cls) => EQUIP[id].series.includes(cls);

// 装备特效查询：fx 取第一个同类效果，fxSum 合计数值
export function fx(u, type) {
  for (const s of SLOTS) {
    const it = u.equip?.[s];
    if (!it) continue;
    const f = EQUIP[it.id].effects.find((e) => e.type === type);
    if (f) return f;
  }
  return null;
}
export function fxSum(u, type, key = 'v') {
  let n = 0;
  for (const s of SLOTS) {
    const it = u.equip?.[s];
    if (it) for (const e of EQUIP[it.id].effects) if (e.type === type) n += e[key];
  }
  return n;
}
// 不叠加的效果取最高值（凤凰羽衣与青囊书）
export function fxMax(u, type, key = 'v') {
  let n = 0;
  for (const s of SLOTS) {
    const it = u.equip?.[s];
    if (it) for (const e of EQUIP[it.id].effects) if (e.type === type) n = Math.max(n, e[key]);
  }
  return n;
}

export const copyKit = (kit) => Object.fromEntries(SLOTS.map((s) => [s, kit?.[s] ? { ...kit[s] } : null]));

// 装备得经验并升级：返回升了几级（已到上限时不再累积）
export function addGearExp(it, amt) {
  const cap = EQUIP[it.id].cap;
  if (it.lvl >= cap) return 0;
  it.exp = (it.exp || 0) + amt;
  let n = 0;
  while (it.exp >= EXP_PER_LVL && it.lvl < cap) { it.exp -= EXP_PER_LVL; it.lvl += 1; n += 1; }
  if (it.lvl >= cap) it.exp = 0;
  return n;
}

// ---------- 初始装备（research §3，E10） ----------
// 武将等级 1~7 带初级 1 级，之后每 4 级升一档：8~11 初级 2 级 … 28~31 高级 1 级，32 级以上高级 2 级
export function normalGrade(lvl) {
  const step = Math.max(0, Math.min(7, Math.floor(lvl / 4) - 1));
  return { tier: Math.floor(step / 3) + 1, lvl: (step % 3) + 1 };
}
const kindOf = (cls, slot) => Object.keys(KINDS).find((k) => KINDS[k].slot === slot && k in MAIN_OF && KINDS[k].series.includes(cls));
const normalId = (kind, tier) => Object.keys(EQUIP).find((id) => EQUIP[id].kind === kind && !EQUIP[id].treasure && EQUIP[id].tier === tier);

// 按兵种与等级的默认普通装备（敌军、友军、临时成员也使用，使双方数值量级一致）；不能装备武器的兵种（皇帝、百姓、辎重队）为空
export function defaultKit(cls, lvl) {
  const g = normalGrade(lvl);
  const kit = { weapon: null, armor: null, acc: null };
  for (const s of ['weapon', 'armor']) {
    const k = kindOf(cls, s);
    if (k) kit[s] = { id: normalId(k, g.tier), lvl: g.lvl, exp: 0 };
  }
  return kit;
}

// 武将自带的宝物（research §6）：曹操倚天剑、曹丕孟德新书、忠臣线关羽青龙偃月刀与赤兔马、庞德铁盔
export const STARTER_TREASURES = { caocao: ['yitian'], caopi: ['mengde'], guanyu_z: ['qinglong', 'chitu'], pangde: ['tiekui'] };

export const nextUid = (inv) => inv.reduce((m, it) => Math.max(m, it.uid || 0), 0) + 1;
export const owns = (inv, id) => inv.some((it) => it.id === id);

// 为新加入的武将生成初始装备：写入背包 inv，返回 { weapon, armor, acc }（uid 或 null）
export function issueKit(inv, gid, cls, lvl) {
  const kit = defaultKit(cls, lvl);
  for (const id of STARTER_TREASURES[gid] || []) {
    if (owns(inv, id) || !canEquip(id, cls)) continue;
    kit[EQUIP[id].slot] = { id, lvl: EQUIP[id].cap > 1 ? treasureLvl(lvl) : 1, exp: 0 };
  }
  const ref = { weapon: null, armor: null, acc: null };
  for (const s of SLOTS) {
    if (!kit[s]) continue;
    const it = { uid: nextUid(inv), ...kit[s] };
    inv.push(it);
    ref[s] = it.uid;
  }
  return ref;
}

// 新的装备实例（商店买入 / 奖励 / 掉落）；宝物等级按曹操等级
export function newGear(inv, id, lordLvl = 1) {
  const e = EQUIP[id];
  const it = { uid: nextUid(inv), id, lvl: e.treasure && e.cap > 1 ? treasureLvl(lordLvl) : 1, exp: 0 };
  inv.push(it);
  return it;
}

// 按 roster 中的引用取出装备实例的副本（战斗中的单位持有副本，胜利时写回背包）
export function kitFrom(inv, ref) {
  const out = { weapon: null, armor: null, acc: null };
  if (!ref) return out;
  for (const s of SLOTS) {
    const it = ref[s] != null && inv.find((o) => o.uid === ref[s]);
    if (it) out[s] = { ...it };
  }
  return out;
}

// ---------- 取得：关卡奖励、敌将掉落（research §6；冲突条目已按可信度取舍） ----------
// 奖励条目：{ item?: 装备id | [依次取第一件未拥有的], gold?, ifFlag?, unlessFlag?, annihilate?: bool, maxTurn?, alive?: 单位id, via?: 胜利条件类型, outcome?, note? }
// 宝物只能拥有一件：已拥有时跳过（备选取得途径因此自然失效）
export const REWARDS = {
  sishui: [{ item: 'guding', alive: 'sunjian', note: '孙坚未撤退，战后赠送' }],
  dongzhuo: [{ item: 'jueying', annihilate: true, note: '全灭敌军（E2/E3/E12，另说击退李儒）' }],
  qingzhou: [{ item: 'qihei', note: '原版采纳荀彧 / 荀攸意见；本作无此选项，直接获得' }],
  puyang1: [{ item: 'liguang_bow', annihilate: true }],
  puyang2: [{ item: 'lianhuan', annihilate: true, note: '全灭敌军（E5/E15）' }],
  puyang3: [
    { item: 'lvbu_bow', unlessFlag: 'puyang_merchant_fined', note: '放过商人或未触发商人剧情' },
    { gold: 3000, ifFlag: 'puyang_merchant_fined', note: '没收商人家财' },
  ],
  xiandi: [{ item: 'shengzhe', annihilate: true, note: '歼灭敌军' }, { item: 'huangjin', via: 'reach', note: '护送献帝' }],
  zhangxiu1: [{ item: 'fenghuang', ifFlag: 'dianwei_dead', note: '典韦战死' }],
  yuanshu: [{ item: 'bajiao' }, { item: 'fengche' }],
  guandu: [{ item: 'jinhuo' }],
  liucheng: [{ item: 'dunjia', ifFlag: 'guojia_dead', note: '郭嘉病逝' }],
  chibi: [{ item: 'shuangbian', annihilate: true }],
  // 忠臣线（蓝线）
  z_dingjun: [
    { item: 'cixiong', note: '刘备赠送' }, { item: 'dilu', note: '刘备赠送' },
    { item: 'yuxi', annihilate: true, maxTurn: 10, note: '10 回合内全灭敌军' },
  ],
  z_maicheng: [{ item: 'shemao', alive: 'guanyu_z', note: '关羽未撤退' }],
  z_chibi2: [{ item: 'qihei' }],
  z_yufupu: [{ item: 'zhuge_scarf' }, { item: 'jade_qinglong' }],
  z_baidi: [{ item: 'jade_zhuque' }],
  z_jiange: [{ item: 'jade_xuanwu' }],
  z_yangping: [{ item: 'jade_baihu' }],
  // 奸雄线（红线）
  j_zhanglu: [{ item: 'shengzhe', outcome: 'surrender', note: '说服张鲁' }],
  j_dingjun: [{ item: 'zhuahuang', ifFlag: 'j_xiahouyuan_dead', note: '夏侯渊单挑黄忠战败' }, { item: 'yuxi', annihilate: true }],
  j_hanshui: [{ item: 'zhuge_scarf', annihilate: true, maxTurn: 12, note: '12 回合内全灭敌军' }],
  j_xiegu: [{ item: 'dilu' }],
  j_fancheng: [{ item: 'liuxing', ifFlag: 'j_pangde_dead', note: '庞德单挑周仓阵亡' }],
  // 白羽扇：本作剑阁之战没有诸葛亮，改为战利品
  j_jiange: [{ item: 'baiyu' }, { item: 'jade_qinglong' }],
  j_chengdu: [{ item: 'jade_zhuque' }],
  j_baidi: [{ item: 'jade_baihu' }],
  j_chibi2: [{ item: 'jade_xuanwu' }],
};

// 敌将掉落：关卡 id → { 敌军单位 id: 装备 id | [依次取第一件未拥有的] }，击破时即时获得
export const DROPS = {
  yingchuan: { zhangbao: 'taiping_qing' },
  xuzhou_fuchou: { taoqian: 'baiyin_kai' },
  zhangxiu1: { hucheer: 'feilong' },
  xuzhou_jiuyuan: { zangba: 'meiyu' },
  lvbu_baowei: { lvbu: 'fangtian' },
  baima: { yanliang: 'doudai' },
  yanjin: { wenchou: 'baiyin_dun' },
  cangting: { yuanshao: 'fengshen' },
  liyang: { fengji: 'qixing' },
  yecheng: { shenpei: 'wuhuo' },
  nanpi: { yuantan: 'huangjin' },
  bowangpo: { zhugeliang: 'hechang' },
  // 青釭剑：原版另需夏侯恩被赵云单挑杀死、选“放过婴儿”，本作简化为击退赵云
  changban: { zhaoyun: 'qinggang', mifang: 'liutao', mizhu: 'sanlue' },
  chibi: { handang: 'longlin', huanggai: 'qingnang', zhouyu: 'taiping_yao' },
  // 孙子兵法：张纮（E5/E12）与张昭（E2）冲突，取张纮
  hefei: { taishici: 'jingkai', zhanghong: 'sunzi' },
  z_dingjun: { huangzhong: 'zhuahuang' },
  z_ruxu: { xusheng: 'lianhuan' },
  z_jianye: { zhugejin: 'shengzhe', lingtong: 'baiyin_dun', panzhang: 'tiekui' },
  // 白羽扇（蓝线）：取 E5/E7/E13 的“白帝城之战击退诸葛亮”
  z_baidi: { zhugeliang: 'baiyu' },
  j_zhanglu: { yanpu: 'qihei' },
  // 濡须口之战的陈武在本作逍遥津之战登场：没有吕布之弓时得吕布之弓，否则得李广之弓（E5）
  j_xiaoyao: { chenwu: ['lvbu_bow', 'liguang_bow'] },
  j_ruxu: { ganning: 'feilong' },
  j_xiegu: { liubei: 'cixiong', zhangfei: 'shemao' },
  j_fancheng: { wangfu: 'tiekui' },
};

// 取得的装备 id：数组按顺序取第一件未拥有的宝物；单个宝物已拥有时返回 null（普通装备可重复取得）
export function pickGear(inv, item) {
  const list = Array.isArray(item) ? item : [item];
  return list.find((id) => !EQUIP[id].treasure || !owns(inv, id)) || null;
}

// 胜利时的关卡奖励：ctx = { flags, outcome, via, annihilated, turn, alive(id) }；返回满足条件的条目
export function stageRewards(stageId, ctx) {
  return (REWARDS[stageId] || []).filter((r) => (!r.ifFlag || ctx.flags[r.ifFlag]) && (!r.unlessFlag || !ctx.flags[r.unlessFlag])
    && (r.annihilate == null || r.annihilate === ctx.annihilated) && (!r.maxTurn || ctx.turn <= r.maxTurn)
    && (!r.alive || ctx.alive(r.alive)) && (!r.via || r.via === ctx.via) && (!r.outcome || r.outcome === ctx.outcome));
}

// ---------- 商店（research §7） ----------
// 消耗品价格：豆 100、米 300 按原版，其余自行设计；果子、桃、神秘酒不出售
export const ITEM_PRICE = { bean: 100, rice: 300, antidote: 150, plaster: 150, stimulant: 200, cough: 200, panacea: 600, water: 500, seal: 3000 };
// 卖出价为买入价的一半（自行设计）
export const sellPrice = (price) => Math.floor(price / 2);
// 各关新上架的商品（关卡编号按 E5；木制投石机原版上架关卡未能查证，自行放在青州）；红蓝线分别列出
export const SHOP_UNLOCK = {
  sishui: ['sword1', 'spear1', 'bow1', 'mail1', 'bean'],
  qingzhou: ['staff1', 'fan1', 'jian1', 'robe1', 'cata1', 'antidote'],
  xuzhou_fuchou: ['shield1', 'glove1'],
  xiandi: ['plaster'],
  zhangxiu1: ['helm1'],
  xuzhou_jiuyuan: ['sword2', 'spear2', 'bow2', 'stimulant'],
  xuzhou_ruqin: ['staff2', 'cata2', 'fan2', 'jian2', 'barding1', 'scarf1', 'rice', 'seal'],
  yanjin: ['mail2', 'robe2'],
  cangting: ['cough'],
  rangshan: ['shield2', 'glove2'],
  nanpi: ['panacea'],
  bowangpo: ['helm2', 'barding2', 'water'],
  hefei: ['scarf2'],
  j_zhanglu: ['sword3', 'spear3', 'bow3'],
  j_ruxu: ['staff3', 'cata3', 'fan3', 'jian3'],
  j_hanshui: ['mail3', 'robe3'],
  z_dingjun: ['sword3', 'spear3', 'bow3', 'staff3', 'cata3', 'fan3', 'jian3', 'mail3', 'robe3'],
};
