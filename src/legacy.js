// 二周目继承（research newgame-plus.md）：结局记录与宝物图鉴，存于 localStorage sanguo-legacy，不随单个存档。
// 结构 { endings: { villain?, middle?, loyal? }, codex: [宝物id] }；等级、装备、金钱不跨周目继承，
// 只在新游戏第一关开场由许劭（许子将）按结局数与图鉴给出升级 / 全部宝物 / 金钱的选项。
import { EQUIP, issueKit, newGear, owns } from './equipment.js';
import { GENERALS } from './generals.js';
import { tierFor } from './logic.js';
import { getStage, FIRST_STAGE } from './stages.js';

const KEY = 'sanguo-legacy';
// 三种结局（原版标题下的鸟）：红 = 奸雄线、黄 = 中间路线、蓝 = 忠臣线
export const ENDING_ROUTES = ['villain', 'middle', 'loyal'];
export const ENDING_INFO = {
  villain: { name: '奸雄篇', color: 0xd8432e },
  middle: { name: '魏王篇', color: 0xe8b830 },
  loyal: { name: '忠臣篇', color: 0x3f7fd8 },
};
// 图鉴登记的宝物（EQUIP 中 treasure 为真的 50 件，按表中顺序）
export const TREASURES = Object.keys(EQUIP).filter((id) => EQUIP[id].treasure);

// 容错：缺字段、类型不对、未知结局 / 宝物 id 一律丢弃
export function normalizeLegacy(d) {
  const endings = {};
  for (const r of ENDING_ROUTES) if (d?.endings?.[r]) endings[r] = true;
  const codex = Array.isArray(d?.codex) ? [...new Set(d.codex.filter((id) => TREASURES.includes(id)))] : [];
  return { endings, codex };
}

export function readLegacy() {
  try { return normalizeLegacy(JSON.parse(localStorage.getItem(KEY))); } catch { return normalizeLegacy(null); }
}

export function writeLegacy(d) {
  localStorage.setItem(KEY, JSON.stringify(normalizeLegacy(d)));
}

// 合并两份记录（导入时用）：结局取或，图鉴取并集
export function mergeLegacy(a, b) {
  const x = normalizeLegacy(a), y = normalizeLegacy(b);
  return normalizeLegacy({ endings: { ...x.endings, ...y.endings }, codex: [...x.codex, ...y.codex] });
}

export function recordEnding(route) {
  if (!ENDING_ROUTES.includes(route)) return;
  const d = readLegacy();
  if (d.endings[route]) return;
  d.endings[route] = true;
  writeLegacy(d);
}

// 得到宝物时登记图鉴（普通装备忽略）
export function recordTreasures(ids) {
  const add = ids.filter((id) => EQUIP[id]?.treasure);
  if (!add.length) return;
  const d = readLegacy();
  const n = d.codex.length;
  d.codex = [...new Set([...d.codex, ...add])];
  if (d.codex.length !== n) writeLegacy(d);
}

export const endingCount = (d) => ENDING_ROUTES.filter((r) => d.endings[r]).length;
export const codexFull = (d) => TREASURES.every((id) => d.codex.includes(id));

// 许劭的对白（原文按 research §2）；没有结局记录且图鉴未满时返回 null（一周目不出现）
export function ngPlusLines(d = readLegacy()) {
  const n = endingCount(d), full = codexFull(d);
  if (!n && !full) return null;
  const X = (text, extra) => ({ who: '许劭', side: 'ally', text, ...extra });
  const N = (text) => ({ who: '旁白', text });
  const up = (lvl) => ({ ngplus: { lvl }, reply: [N(`曹操的等级上升了 ${lvl} 级！`)] });
  const gold = (g) => ({ text: '没有这个必要', ngplus: { gold: g }, reply: [N(`得到了黄金 ${g}！`)] });
  const lines = [X(n ? '曹大人，看您似乎不像是初次上阵的样子……' : '因为我听人家说，这是曹大人第一次上阵。所以就赶来了。')];
  if (n === 1) {
    lines.push(X('我最近学会了神奇的法术了。这个法术好像可以让您的Lv上升１级呢。', {
      choices: [{ text: '真是求之不得', ...up(1) }, gold(2000)],
    }));
  } else if (n === 2) {
    lines.push(X('我先前学到的神奇的法术，又变强了一点。这个法术好像可以让您的Lv上升２级呢。', {
      choices: [{ text: '真是求之不得', ...up(2) }, gold(4000)],
    }));
  } else if (n >= 3) {
    lines.push(X('现在我可以调整您想提升的Lv级数了。……您希望我给您提升几个等级？', {
      choices: [{ text: '希望提升６级', ...up(6) }, { text: '希望提升３级', ...up(3) }, gold(10000)],
    }));
  }
  if (full) {
    lines.push(X('话说回来，没想到您居然集满了宝物图鉴。……它的主人可以得到全部宝物。不知您意下如何？曹大人。'));
    lines.push(X('您希望接受这些宝物吗？', {
      choices: [
        { text: '非常乐于接受', ngplus: { treasures: true }, reply: [N('得到了所有宝物！')] },
        { text: '不要那些宝物', ngplus: { gold: 30000 }, reply: [X('是吗……？那么请你务必收下这件东西。'), N('得到了黄金 30000！')] },
      ],
    }));
  }
  lines.push(X('那么小老儿告辞了。呵、呵、呵、呵。'));
  return lines;
}

// 插入第一关开场脚本的演出：曹军大营，许劭来访（插在最后的黑幕淡出之前）
export function withNgPlus(script, d = readLegacy()) {
  const lines = ngPlusLines(d);
  if (!lines) return script;
  const seg = [
    { bg: 'tent', place: '颍川　曹军大营', time: 'day' },
    { actor: '曹操', side: 'player', at: [5, 6], face: 'dr' },
    { actor: '许劭', side: 'ally', at: [16, 20], face: 'ul' },
    { move: '许劭', to: [8, 10], face: 'ul' },
    { act: '许劭', pose: 'bow', ms: 400 },
    { act: '许劭', pose: 'stand', ms: 0 },
    { say: lines },
    { exit: '许劭', to: [16, 20], speed: 5 },
  ];
  const i = script.length && script[script.length - 1].fade === 'out' ? script.length - 1 : script.length;
  return [...script.slice(0, i), ...seg, ...script.slice(i)];
}

const lordBase = () => getStage(FIRST_STAGE)?.units.find((u) => u.id === 'caocao')?.lvl || 1;

// 许劭选项的结果写入新游戏的战役状态：{ lvl } 曹操升级、{ gold } 金钱、{ treasures } 全部宝物（等级 = 曹操等级 / 4 + 1）
export function grantNgPlus(registry, b) {
  const roster = { ...(registry.get('roster') || {}) };
  const cls = GENERALS.caocao.cls;
  const lvl = Math.max(lordBase(), roster.caocao?.lvl || 0);
  if (b.lvl) {
    const lv = lvl + b.lvl;
    roster.caocao = { ...roster.caocao, lvl: lv, exp: 0, cls, tier: tierFor(cls, lv) };
    registry.set('roster', roster);
  }
  if (b.gold) registry.set('gold', (registry.get('gold') || 0) + b.gold);
  if (b.treasures) {
    const inv = (registry.get('inventory') || []).map((it) => ({ ...it }));
    // 先发曹操的初始装备（倚天剑已装备），再补齐其余宝物
    if (!roster.caocao?.equip) roster.caocao = { ...roster.caocao, equip: issueKit(inv, 'caocao', cls, lvl) };
    for (const id of TREASURES) if (!owns(inv, id)) newGear(inv, id, lvl);
    registry.set('roster', roster);
    registry.set('inventory', inv);
  }
}
