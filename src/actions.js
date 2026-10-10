import { SPELLS, ITEMS, classOf } from './data.js';
import {
  canAttackFrom, rollAttack, resolveSpell, applySpell, expFor, levelUp, promote, planAI, reachable, pathTo, key, knownSpells,
} from './logic.js';
import { STATUS, BUFF_NAME, canCounter, canAct, cure } from './status.js';
import { tileCenter } from './unitView.js';
import { floatText, wait } from './ui.js';
import { castFx, spellFx, itemFx, deathFx, promoteFx } from './spellFx.js';
import { playAttack } from './attackFx.js';

export async function doAttack(s, a, d) {
  const duel = s.findDuel?.(a, d);
  if (duel) { await s.runDuel(duel); return; }
  await strike(s, a, d, false);
  // 混乱的单位不能反击
  if (d.alive && a.alive && canCounter(d) && canAttackFrom(d, d.x, d.y, a)) {
    await wait(s, 150);
    await strike(s, d, a, true);
  }
}

async function strike(s, a, d, counter) {
  const vd = s.views.get(d);
  const r = rollAttack(s.map, a, d);
  const p = tileCenter(d.x, d.y);
  const verb = counter ? '反击' : '攻击';
  await playAttack(s, a, d, r, () => {
    if (!r.hit) {
      floatText(s, p.x, p.y - 20, '闪避', '#cfe8ff');
      s.hud.log(`${d.name} 闪开了 ${a.name} 的${verb}`);
      return;
    }
    d.hp = Math.max(0, d.hp - r.dmg);
    vd.updateHp();
    floatText(s, p.x, p.y - 20, `${r.crit ? '会心 ' : ''}-${r.dmg}`, r.crit ? '#ffe05a' : '#ff6b5a', r.crit ? 28 : 22);
    s.hud.log(`${a.name} ${r.crit ? '会心一击！' : verb} ${d.name} 损失 ${r.dmg}`);
  });
  await wait(s, 200);
  const killed = d.hp <= 0;
  await gainExp(s, a, r.hit ? expFor(a, d, killed) : 2);
  if (killed) await killUnit(s, d);
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

async function gainExp(s, u, amt) {
  if (!u.alive || u.faction !== 'player') return;
  u.exp += amt;
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
