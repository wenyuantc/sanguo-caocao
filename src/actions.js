import { SPELLS, ITEMS, classOf } from './data.js';
import {
  canAttackFrom, rollAttack, resolveSpell, applySpell, expFor, levelUp, promote, planAI, reachable, pathTo, key, knownSpells,
  counterOk, attackTiles, isFoe, refreshStats,
} from './logic.js';
import { STATUS, BUFF_NAME, canAct, cure, applyStatus, effStats } from './status.js';
import { EQUIP, GEAR_EXP, fx, addGearExp } from './equipment.js';
import { tileCenter } from './unitView.js';
import { floatText, wait } from './ui.js';
import { castFx, spellFx, itemFx, deathFx, promoteFx } from './spellFx.js';
import { playAttack } from './attackFx.js';

// 普通攻击：攻击 → 蛇矛穿透 → 方天画戟连击（击破时）/ 反击 → 双剑 / 双鞭再反击
export async function doAttack(s, a, d) {
  const duel = s.findDuel?.(a, d);
  if (duel) { await s.runDuel(duel); return; }
  const hit = await strike(s, a, d, false);
  if (hit && a.alive && fx(a, 'pierce')) await pierce(s, a, d);
  if (!d.alive) {
    if (a.alive && fx(a, 'chain')) await chain(s, a);
    return;
  }
  // 混乱的单位不能反击；青龙偃月刀封杀反击
  if (a.alive && counterOk(a, d)) {
    await wait(s, 150);
    await strike(s, d, a, true);
    if (a.alive && d.alive && fx(a, 'reCounter') && canAttackFrom(a, a.x, a.y, d)) {
      await wait(s, 150);
      s.hud.log(`${a.name} 再次反击！`);
      await strike(s, a, d, true);
    }
  }
}

// 蛇矛：同时攻击目标身后一格（攻击方向上）的敌人，不判定会心
async function pierce(s, a, d) {
  const x = d.x + Math.sign(d.x - a.x), y = d.y + Math.sign(d.y - a.y);
  const b = s.unitAt?.(x, y);
  if (!b || !isFoe(b, a)) return;
  await wait(s, 120);
  s.hud.log(`${a.name} 的蛇矛贯穿至 ${b.name}`);
  await strike(s, a, b, false, true);
}

// 方天画戟：击破目标后继续攻击攻击范围内防御最低的敌人（每次行动一次，反击时不触发）
async function chain(s, a) {
  const foes = attackTiles(a).map((t) => s.unitAt?.(t.x, t.y)).filter((o) => o && isFoe(o, a));
  if (!foes.length) return;
  const t = foes.reduce((m, o) => (effStats(o).def < effStats(m).def ? o : m));
  await wait(s, 150);
  s.hud.log(`${a.name} 乘势攻击 ${t.name}！`);
  await strike(s, a, t, false);
}

// 单次攻击；返回是否命中。装备：龙鳞铠以策略值代替兵力承受、连环铠同阶段第 2 次起伤害减半、攻击附带异常、豆袋自动吃豆
async function strike(s, a, d, counter, noCrit = false) {
  const vd = s.views.get(d);
  const r = rollAttack(s.map, a, d, noCrit);
  const p = tileCenter(d.x, d.y);
  const verb = counter ? '反击' : '攻击';
  if (r.hit && r.dmg > 0 && fx(d, 'secondHalf') && d.hitsTaken > 0) r.dmg = Math.max(1, Math.round(r.dmg / 2));
  await playAttack(s, a, d, r, () => {
    if (!r.hit) {
      floatText(s, p.x, p.y - 20, '闪避', '#cfe8ff');
      s.hud.log(`${d.name} 闪开了 ${a.name} 的${verb}`);
      return;
    }
    if (!r.dmg) {
      floatText(s, p.x, p.y - 20, '无效', '#cfe8ff');
      s.hud.log(`${d.name} 的镜铠挡住了 ${a.name} 的${verb}`);
      return;
    }
    d.hitsTaken = (d.hitsTaken || 0) + 1;
    if (fx(d, 'mpShield') && d.mp > 0) {
      const m = Math.min(d.mp, r.dmg);
      d.mp -= m;
      vd.updateHp();
      floatText(s, p.x, p.y - 20, `策略 -${m}`, '#8ac8ff', r.crit ? 28 : 22);
      s.hud.log(`${a.name} ${r.crit ? '会心一击！' : verb} ${d.name}，龙鳞铠以策略值承受 ${m}`);
      return;
    }
    d.hp = Math.max(0, d.hp - r.dmg);
    vd.updateHp();
    floatText(s, p.x, p.y - 20, `${r.crit ? '会心 ' : ''}-${r.dmg}`, r.crit ? '#ffe05a' : '#ff6b5a', r.crit ? 28 : 22);
    s.hud.log(`${a.name} ${r.crit ? '会心一击！' : verb} ${d.name} 损失 ${r.dmg}`);
  });
  await wait(s, 200);
  const killed = d.hp <= 0;
  const onHit = r.hit && r.dmg > 0 && !killed && fx(a, 'onHitStatus');
  if (onHit) {
    applyStatus(d, onHit.status);
    floatText(s, p.x, p.y - 44, STATUS[onHit.status].name, STATUS[onHit.status].css, 18);
    s.hud.log(`${d.name} 陷入${STATUS[onHit.status].name}`);
    vd.updateStatus();
  }
  if (r.hit && r.dmg > 0 && !killed) autoBean(s, d);
  gainGear(s, a, 'weapon', r.hit ? GEAR_EXP.hit : GEAR_EXP.miss);
  if (r.hit) gainGear(s, d, 'armor', GEAR_EXP.struck);
  await gainExp(s, a, r.hit ? expFor(a, d, killed) : 2);
  if (killed) await killUnit(s, d);
  return r.hit;
}

// 豆袋：兵力低于触发线时自动吃一颗军需中的豆
function autoBean(s, u) {
  const f = fx(u, 'autoBean');
  if (!f || u.faction !== 'player' || !(s.items?.bean > 0) || u.hp >= u.stats.hp * f.below) return;
  s.items.bean -= 1;
  s.hud.setItems(s.items);
  const amt = Math.min(u.stats.hp - u.hp, ITEMS.bean.hp);
  u.hp += amt;
  const p = tileCenter(u.x, u.y);
  floatText(s, p.x, p.y - 38, `豆袋 +${amt}`, '#7dff9a', 18);
  s.hud.log(`${u.name} 从豆袋中取出豆，兵力 +${amt}`);
  s.views.get(u)?.updateHp();
}

// 我军装备得经验并升级（敌军装备不成长）
export function gainGear(s, u, slot, amt) {
  const it = u.equip?.[slot];
  if (!amt || !it || u.faction !== 'player' || !u.alive) return;
  const n = addGearExp(it, amt);
  if (!n) return;
  refreshStats(u);
  s.views.get(u)?.updateHp();
  s.hud.log(`★ ${u.name} 的「${EQUIP[it.id].name}」升至 Lv${it.lvl}`);
}

// 施放策略：结算 → 施法与命中特效 → 写入结果 → 逐个目标显示数值与日志 → 经验 → 撤退
export async function doSpell(s, a, spellId, t) {
  const sp = SPELLS[spellId];
  const res = resolveSpell(s.map, s.units, a, spellId, t);
  s.hud.log(`${a.name} 使用了「${sp.name}」`);
  await castFx(s, a, spellId, t);
  await spellFx(s, res);
  s.views.get(a)?.faceDefault();
  applySpell(res);
  for (const e of res.effects) showEffect(s, e);
  for (const e of res.effects) if (e.hit && e.dmg && e.u.alive && e.u.hp > 0) autoBean(s, e.u);
  // 扇 / 宝剑等武器随策略攻击得经验
  if (sp.cat === 'damage') gainGear(s, a, 'weapon', res.effects.some((e) => e.hit) ? GEAR_EXP.hit : GEAR_EXP.miss);
  const va = s.views.get(a);
  if (res.self.hp || res.self.mp) {
    const p = tileCenter(a.x, a.y);
    if (res.self.hp) floatText(s, p.x, p.y - 34, `兵力 +${res.self.hp}`, '#7dff9a', 18);
    if (res.self.mp) floatText(s, p.x, p.y - 34, `策略 +${res.self.mp}`, '#8ac8ff', 18);
    va?.updateHp();
  }
  if (!res.effects.length) s.hud.log('范围内没有可作用的目标');
  await wait(s, 380);
  const hits = res.effects.filter((e) => e.hit);
  let exp = sp.target === 'foe' ? (hits.length ? 8 : 3) : sp.cat === 'heal' ? 12 : 10;
  for (const e of hits) if (e.dmg && e.u !== a) exp = Math.max(exp, expFor(a, e.u, e.u.hp <= 0) + 4);
  await gainExp(s, a, exp);
  for (const e of res.effects) if (e.u.alive && e.u.hp <= 0) await killUnit(s, e.u);
}

// 单个目标的结算表现：浮字、兵力条、状态图标与日志
function showEffect(s, e) {
  const u = e.u, v = s.views.get(u);
  const p = tileCenter(u.x, u.y);
  if (!e.hit) {
    floatText(s, p.x, p.y - 20, '无效', '#cfe8ff');
    s.hud.log(`${u.name} 识破了计策`);
    return;
  }
  const notes = [];
  if (e.dmg) {
    v?.flashHit(0xfff0d0);
    v?.hurt();
    floatText(s, p.x, p.y - 20, `-${e.dmg}`, '#ff9a3a', 24);
    notes.push(`损失 ${e.dmg}`);
  }
  if (e.heal) { floatText(s, p.x, p.y - 20, `+${e.heal}`, '#7dff9a'); notes.push(`兵力恢复 ${e.heal}`); }
  if (e.mp) { floatText(s, p.x, p.y - 38, `策略 +${e.mp}`, '#8ac8ff', 18); notes.push(`策略值恢复 ${e.mp}`); }
  if (e.mpDrain) { floatText(s, p.x, p.y - 38, `策略 -${e.mpDrain}`, '#8ac8ff', 18); notes.push(`策略值被吸取 ${e.mpDrain}`); }
  if (u.hp > 0) {
    if (e.status) { floatText(s, p.x, p.y - 44, STATUS[e.status].name, STATUS[e.status].css, 18); notes.push(`陷入${STATUS[e.status].name}`); }
    if (e.buffKeys) {
      const up = e.buff.stat === 'move' || e.buff.mult > 1;
      const names = e.buffKeys.map((k) => BUFF_NAME[k]).join('、');
      floatText(s, p.x, p.y - 44, `${names}${up ? '↑' : '↓'}`, up ? '#9ce0a8' : '#ff8a7a', 18);
      notes.push(`${names}${up ? '上升' : '下降'}`);
    }
    if (e.cure) notes.push(e.cured.length ? `解除了${e.cured.map((k) => STATUS[k].name).join('、')}` : '没有异常');
    if (e.again) { v?.setActed(false); notes.push('可以再次行动'); }
  }
  v?.updateHp();
  v?.updateStatus();
  if (notes.length) s.hud.log(`${u.name} ${notes.join('，')}`);
}

export async function doItem(s, a, itemId, t) {
  const it = ITEMS[itemId];
  s.items[itemId] -= 1;
  s.hud.setItems(s.items);
  s.hud.log(`${a.name} 对 ${t.name} 使用了「${it.name}」`);
  if (it.promote) {
    await doPromote(s, t);
    await gainExp(s, a, 6);
    return;
  }
  await itemFx(s, a, itemId, t);
  const p = tileCenter(t.x, t.y);
  if (it.hp || it.full === 'hp') {
    const amt = Math.min(t.stats.hp - t.hp, it.hp || t.stats.hp);
    t.hp += amt;
    floatText(s, p.x, p.y - 20, `兵力 +${amt}`, '#7dff9a');
  }
  if (it.mp || it.full === 'mp') {
    const amt = Math.min(t.stats.mp - t.mp, it.mp || t.stats.mp);
    t.mp += amt;
    floatText(s, p.x, p.y - 20, `策略 +${amt}`, '#8ac8ff');
  }
  if (it.cure) {
    const cured = cure(t, it.cure);
    s.hud.log(cured.length ? `${t.name} 解除了${cured.map((k) => STATUS[k].name).join('、')}` : `${t.name} 没有需要解除的异常`);
    if (cured.length) floatText(s, p.x, p.y - 20, '解除', '#fff2a0');
    s.views.get(t).updateStatus();
  }
  s.views.get(t).updateHp();
  await wait(s, 300);
  await gainExp(s, a, 6);
}

// 印绶转职：升阶、兵力策略回满、换装特效与日志
async function doPromote(s, t) {
  const from = classOf(t.cls, t.tier);
  const { diff, learned } = promote(t);
  const to = classOf(t.cls, t.tier);
  await promoteFx(s, t, `转职·${to.name}`, () => s.views.get(t).refresh());
  s.hud.log(`★ ${t.name} 由${from.name}转职为${to.name}（兵力+${diff.hp} 策略+${diff.mp} 移动${from.move}→${to.move}）`);
  if (learned.length) s.hud.log(`${t.name} 习得策略：${learned.map((id) => SPELLS[id].name).join('、')}`);
}

// 孟德新书：获得经验 ×1.5
export async function gainExp(s, u, amt) {
  if (!u.alive || u.faction !== 'player') return;
  u.exp += Math.round(amt * (fx(u, 'expMul')?.v || 1));
  while (u.exp >= 100) {
    u.exp -= 100;
    const before = knownSpells(u);
    const diff = levelUp(u);
    const p = tileCenter(u.x, u.y);
    floatText(s, p.x, p.y - 30, `升级！Lv${u.lvl}`, '#ffe08a', 26);
    s.hud.log(`★ ${u.name} 升至 ${u.lvl} 级（攻击+${diff.atk} 防御+${diff.def} 兵力+${diff.hp}）`);
    const learned = knownSpells(u).filter((id) => !before.includes(id));
    if (learned.length) s.hud.log(`${u.name} 习得策略：${learned.map((id) => SPELLS[id].name).join('、')}`);
    s.views.get(u).updateHp();
    await wait(s, 600);
  }
}

export async function killUnit(s, u) {
  u.alive = false;
  s.hud.log(`${u.name} 撤退了！`);
  await deathFx(s, s.views.get(u));
  s.views.delete(u);
  await s.dropLoot?.(u);
  await s.fireDeathEvents?.(u);
}

export async function runAI(s, faction) {
  const list = s.units.filter((u) => u.alive && u.faction === faction).sort((a, b) => (a.leader ? 1 : 0) - (b.leader ? 1 : 0));
  for (const u of list) {
    if (s.over) return;
    if (!u.alive || !canAct(u)) continue; // 混乱：本阶段不能行动
    const plan = planAI(s.map, s.units, u);
    s.setCursor(u.x, u.y);
    if (plan) {
      try {
        const node = reachable(s.map, s.units, u).get(key(plan.tile.x, plan.tile.y));
        const path = node ? pathTo(node) : [{ x: u.x, y: u.y }];
        const last = path[path.length - 1];
        u.x = last.x; u.y = last.y;
        await s.views.get(u).moveAlong(path);
        if (plan.type === 'attack') await doAttack(s, u, plan.target);
        else if (plan.type === 'spell') await doSpell(s, u, plan.spell, plan.target);
      } catch (e) {
        // 单个 AI 行动出错时跳过该单位，避免整个阶段卡死
        console.error('AI 行动出错', e);
      }
    }
    if (s.views.get(u)) s.views.get(u).setActed(false);
    await s.checkEnd();
    await wait(s, plan ? 160 : 40);
  }
}
