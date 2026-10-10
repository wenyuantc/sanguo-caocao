import { SPELLS, ITEMS, classOf } from './data.js';
import {
  canAttackFrom, rollAttack, spellDamage, spellHit, healAmount, expFor, levelUp, promote, planAI, reachable, pathTo, key, terrainAt,
} from './logic.js';
import { tileCenter } from './unitView.js';
import { floatText, wait } from './ui.js';
import { castFx, spellFx, itemFx, deathFx, promoteFx } from './spellFx.js';
import { playAttack } from './attackFx.js';

export async function doAttack(s, a, d) {
  const duel = s.findDuel?.(a, d);
  if (duel) { await s.runDuel(duel); return; }
  await strike(s, a, d, false);
  if (d.alive && a.alive && canAttackFrom(d, d.x, d.y, a)) {
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

export async function doSpell(s, a, spellId, t) {
  const sp = SPELLS[spellId];
  a.mp -= sp.mp;
  s.hud.log(`${a.name} 使用了「${sp.name}」`);
  const p = tileCenter(t.x, t.y);
  const failed = sp.kind !== 'heal' && Math.random() * 100 >= spellHit(a, t);
  await castFx(s, a, spellId, t);
  await spellFx(s, spellId, t, { strong: spellId === 'fire' && (terrainAt(s.map, t.x, t.y).fire || 1) > 1, failed });
  s.views.get(a).faceDefault();
  if (sp.kind === 'heal') {
    const amt = Math.min(t.stats.hp - t.hp, healAmount(a, spellId));
    t.hp += amt;
    s.views.get(t).updateHp();
    floatText(s, p.x, p.y - 20, `+${amt}`, '#7dff9a');
    s.hud.log(`${t.name} 兵力恢复 ${amt}`);
    await wait(s, 300);
    await gainExp(s, a, 12);
    return;
  }
  if (failed) {
    floatText(s, p.x, p.y - 20, '无效', '#cfe8ff');
    s.hud.log(`${t.name} 识破了计策`);
    await wait(s, 300);
    await gainExp(s, a, 3);
    return;
  }
  const dmg = Math.round(spellDamage(s.map, a, t, spellId) * (0.9 + Math.random() * 0.2));
  t.hp = Math.max(0, t.hp - dmg);
  s.views.get(t).updateHp();
  s.views.get(t).flashHit(spellId === 'fire' ? 0xff7a2a : 0xfff0d0);
  s.views.get(t).hurt();
  floatText(s, p.x, p.y - 20, `-${dmg}`, '#ff9a3a', 24);
  s.hud.log(`${t.name} 损失 ${dmg}`);
  await wait(s, 380);
  const killed = t.hp <= 0;
  await gainExp(s, a, expFor(a, t, killed) + 4);
  if (killed) await killUnit(s, t);
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
  if (it.hp) {
    const amt = Math.min(t.stats.hp - t.hp, it.hp);
    t.hp += amt;
    floatText(s, p.x, p.y - 20, `兵力 +${amt}`, '#7dff9a');
  }
  if (it.mp) {
    const amt = Math.min(t.stats.mp - t.mp, it.mp);
    t.mp += amt;
    floatText(s, p.x, p.y - 20, `策略 +${amt}`, '#8ac8ff');
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
    const diff = levelUp(u);
    const p = tileCenter(u.x, u.y);
    floatText(s, p.x, p.y - 30, `升级！Lv${u.lvl}`, '#ffe08a', 26);
    s.hud.log(`★ ${u.name} 升至 ${u.lvl} 级（攻击+${diff.atk} 防御+${diff.def} 兵力+${diff.hp}）`);
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
    if (!u.alive) continue;
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
