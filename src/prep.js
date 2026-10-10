import * as Phaser from 'phaser';
import { WIDTH, HEIGHT, FONT, COLORS } from './config.js';
import { classOf, ITEMS, STAT5, STAT_NAME } from './data.js';
import { calcStats } from './logic.js';
import { shopStock } from './deploy.js';
import {
  SLOTS, SLOT_NAME, EQUIP, EXP_PER_LVL, NORMAL_CAP, FRUIT_EXP, ITEM_PRICE,
  canEquip, gearDesc, gearName, kitFrom, newGear, sellPrice,
} from './equipment.js';
import { ensureTextures, gearIcon } from './spellFx.js';
import { panel, text, button, portrait } from './ui.js';

// 第一页不叫“出阵”：确认按钮“出　阵”按文字查找，不能重名
const TABS = [['deploy', '阵　容'], ['equip', '装　备'], ['items', '道　具'], ['shop', '商　店']];
const HINT = {
  deploy: '点选武将上场 / 下场，锁定的武将必须出阵',
  equip: '选择武将与栏位，再从背包中点选装备；鼠标移到装备上可比较能力',
  items: '果子只能在整备时使用：选择武将后点“使用”',
  shop: '购买普通装备与消耗品；卖出价为买入价的一半，3 级普通装备卖出另得果子，宝物不能卖出',
};
const STAT_ROWS = [['hp', '兵力'], ['mp', '策略'], ...STAT5.map((k) => [k, STAT_NAME[k]])];

// 出阵整备：阵容 / 装备 / 道具 / 商店四页；onConfirm(选中的武将 id 数组)
// 装备、道具、商店的改动立即写入战役状态（registry），重新挑战本关时保留
export function openPrep(scene, plan, onConfirm) {
  ensureTextures(scene);
  const root = scene.add.container(0, 0).setDepth(3000);
  const shade = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.65).setOrigin(0).setInteractive();
  shade.on('pointerdown', (p, x, y, e) => e?.stopPropagation?.());
  const w = 1000, h = 600, x0 = (WIDTH - w) / 2, y0 = (HEIGHT - h) / 2;
  const COLS_N = 4, ROWS_N = 3, PER_PAGE = COLS_N * ROWS_N, cw = 230, ch = 124, gap = 12;
  root.add([shade, panel(scene, x0, y0, w, h, 0.98)]);
  root.add(text(scene, WIDTH / 2, y0 + 30, '出 阵 整 备', 30, '#ffd36a', FONT).setOrigin(0.5));
  const hint = text(scene, x0 + 30, y0 + 64, '', 15, '#cdbd98');
  const countText = text(scene, x0 + w - 30, y0 + 60, '', 20, '#f1e3c2', FONT).setOrigin(1, 0);
  const goldText = text(scene, x0 + w - 30, y0 + 22, '', 18, '#ffe08a', FONT).setOrigin(1, 0);
  const toast = text(scene, x0 + 30, y0 + h - 92, '', 15, '#ff8a7a');
  const pageText = text(scene, x0 + 340, y0 + h - 36, '', 16, '#e9c46a', FONT).setOrigin(0.5);
  const list = scene.add.container(0, 0);
  root.add([list, hint, countText, goldText, toast, pageText]);

  const cards = [...plan.pool.filter((c) => c.preset), ...plan.fixedCards, ...plan.pool.filter((c) => !c.preset)];
  const generals = cards.filter((c) => !c.fixed);
  const locked = (c) => c.fixed || plan.required.has(c.id);
  const PAGES = Math.max(1, Math.ceil(cards.length / PER_PAGE));
  const GEN_PER = 11, GEN_PAGES = Math.max(1, Math.ceil(generals.length / GEN_PER));
  let selected = new Set(plan.defaults);
  let tab = 'deploy';
  const pages = { deploy: 0, gen: 0, bag: 0, buy: 0, sell: 0 };
  let cur = generals[0]?.id;
  let slot = 'weapon';
  let closed = false;
  const count = () => plan.fixed.length + selected.size;
  const refresh = () => scene.time.delayedCall(0, render);

  // ---------- 战役状态读写 ----------
  const inv = scene.inventory;
  const roster = () => scene.registry.get('roster') || {};
  const save = (r) => {
    if (r) scene.registry.set('roster', { ...r });
    scene.registry.set('inventory', inv.map((it) => ({ ...it })));
    scene.registry.set('gold', scene.gold);
    scene.registry.set('items', { ...scene.items });
  };
  const kitOf = (id) => kitFrom(inv, roster()[id]?.equip);
  const unitOf = (c, kit = kitOf(c.id)) => ({ cls: c.cls, tier: c.tier, lvl: c.lvl, bonus: c.bonus, gradeMod: c.gradeMod, equip: kit, fruits: roster()[c.id]?.fruits });
  const ownerOf = (uid) => {
    for (const [gid, r] of Object.entries(roster())) if (r.equip && SLOTS.some((s) => r.equip[s] === uid)) return gid;
    return null;
  };
  const nameOf = (gid) => cards.find((c) => c.id === gid)?.name || gid;
  const diffText = (a, b) => STAT_ROWS.filter(([k]) => b[k] !== a[k]).map(([k, n]) => `${n}${b[k] > a[k] ? '+' : ''}${b[k] - a[k]}`).join(' ') || '能力不变';

  const turn = (dp) => {
    const key = tab === 'deploy' ? 'deploy' : 'gen';
    const max = (tab === 'deploy' ? PAGES : GEN_PAGES) - 1;
    const np = Phaser.Math.Clamp(pages[key] + dp, 0, max);
    if (np !== pages[key]) { pages[key] = np; refresh(); }
  };
  const prevKey = () => turn(-1), nextKey = () => turn(1);
  const dispose = () => {
    closed = true;
    scene.input.keyboard?.off('keydown-LEFT', prevKey);
    scene.input.keyboard?.off('keydown-RIGHT', nextKey);
    root.destroy();
  };
  const toggle = (c) => {
    toast.setText('');
    if (locked(c)) toast.setText(`${c.name}必须出阵`);
    else if (selected.has(c.id)) selected.delete(c.id);
    else if (count() >= plan.max) toast.setText(`出阵人数已满（上限 ${plan.max} 人）`);
    else selected.add(c.id);
    refresh();
  };

  const tabBtns = TABS.map(([id, label], i) => button(scene, x0 + 24 + i * 92, y0 + 16, 84, 34, label, () => {
    if (tab === id) return;
    tab = id;
    toast.setText('');
    refresh();
  }, 16));
  const prevBtn = button(scene, x0 + 24, y0 + h - 56, 110, 40, '◀ 上一页', prevKey, 17);
  const nextBtn = button(scene, x0 + 144, y0 + h - 56, 110, 40, '下一页 ▶', nextKey, 17);
  const resetBtn = button(scene, x0 + w - 300, y0 + h - 56, 130, 40, '恢复默认', () => {
    selected = new Set(plan.defaults);
    toast.setText('');
    refresh();
  }, 18);
  const okBtn = button(scene, x0 + w - 154, y0 + h - 56, 130, 40, '出　阵', () => {
    if (closed) return;
    dispose();
    onConfirm(plan.pool.filter((c) => selected.has(c.id)).map((c) => c.id));
  }, 20);
  root.add([...tabBtns, prevBtn, nextBtn, resetBtn, okBtn]);
  scene.input.keyboard?.on('keydown-LEFT', prevKey);
  scene.input.keyboard?.on('keydown-RIGHT', nextKey);

  // ---------- 通用部件 ----------
  // 列表行：icon 贴图键、标题、副标题、右侧文字、行内按钮；onClick 点整行，onHover(true/false) 悬停
  const row = (x, y, rw, rh, o) => {
    const g = scene.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(o.active ? 0x1c2a44 : hover ? 0x3a2a18 : 0x22160c, 1).fillRoundedRect(x, y, rw, rh, 6);
      g.lineStyle(o.active ? 2 : 1, o.active ? 0x6ab8ff : COLORS.gold, o.active || hover ? 0.9 : 0.35).strokeRoundedRect(x, y, rw, rh, 6);
    };
    draw(false);
    const parts = [g];
    if (o.onClick || o.onHover) {
      const zone = scene.add.zone(x, y, rw, rh).setOrigin(0).setInteractive({ useHandCursor: !!o.onClick });
      zone.on('pointerover', () => { draw(true); o.onHover?.(true); });
      zone.on('pointerout', () => { draw(false); o.onHover?.(false); });
      zone.on('pointerdown', (p, lx, ly, e) => { e?.stopPropagation?.(); o.onClick?.(); });
      parts.push(zone);
    }
    let tx = x + 10;
    if (o.icon) { parts.push(scene.add.image(x + 6 + (rh - 12) / 2, y + rh / 2, o.icon).setScale((rh - 12) / 72)); tx = x + rh + 2; }
    parts.push(text(scene, tx, y + (o.sub ? 4 : rh / 2 - 10), o.title, 16, o.color || '#f1e3c2', FONT));
    if (o.sub) parts.push(text(scene, tx, y + rh - 20, o.sub, 12, '#bfae88'));
    if (o.right) parts.push(text(scene, x + rw - (o.btn ? 76 : 10), y + rh / 2 - 9, o.right, 14, o.rightColor || '#e9c46a').setOrigin(1, 0));
    if (o.btn) parts.push(button(scene, x + rw - 68, y + (rh - 28) / 2, 60, 28, o.btn, o.onBtn, 14).setDisabled(!!o.btnOff));
    list.add(parts);
  };
  // 小翻页：列表右上角的 ▲ ▼
  const pager = (x, y, key, total, per) => {
    const n = Math.max(1, Math.ceil(total / per));
    pages[key] = Math.min(pages[key], n - 1);
    if (n <= 1) return pages[key];
    const go = (d) => { pages[key] = Phaser.Math.Clamp(pages[key] + d, 0, n - 1); refresh(); };
    list.add([
      button(scene, x - 98, y, 30, 24, '▲', () => go(-1), 13).setDisabled(pages[key] === 0),
      text(scene, x - 50, y + 3, `${pages[key] + 1}/${n}`, 13, '#e9c46a').setOrigin(0.5, 0),
      button(scene, x - 30, y, 30, 24, '▼', () => go(1), 13).setDisabled(pages[key] === n - 1),
    ]);
    return pages[key];
  };
  // 左侧武将列表（装备 / 道具页共用）
  const genList = () => {
    const px = x0 + 22, py = y0 + 92;
    generals.slice(pages.gen * GEN_PER, (pages.gen + 1) * GEN_PER).forEach((c, i) => {
      row(px, py + i * 37, 210, 33, {
        title: c.name, right: `Lv ${c.lvl}${selected.has(c.id) ? '　出' : ''}`, active: c.id === cur,
        onClick: () => { cur = c.id; toast.setText(''); refresh(); },
      });
    });
  };
  // 中部：武将能力；showPreview(能力) 显示悬停装备后的变化，传 null 恢复（只改文字，不重建列表）
  let statTexts = [];
  let baseStats = null;
  const showPreview = (next) => {
    STAT_ROWS.forEach(([k], i) => {
      const t = statTexts[i], v = next ? next[k] : baseStats[k];
      if (!t?.active) return;
      t.setText(next && v !== baseStats[k] ? `${baseStats[k]} → ${v}` : String(v));
      t.setColor(v > baseStats[k] ? '#9ce0a8' : v < baseStats[k] ? '#ff8a7a' : '#f6ecd2');
    });
  };
  const statBox = (c, px, py) => {
    baseStats = calcStats(unitOf(c));
    list.add(portrait(scene, px + 40, py + 40, c.name, 'player', 76));
    list.add(text(scene, px + 90, py + 6, c.name, 22, '#fff2cc', FONT));
    list.add(text(scene, px + 90, py + 38, `${classOf(c.cls, c.tier).name}　Lv ${c.lvl}`, 15, '#f1e3c2'));
    statTexts = STAT_ROWS.map(([, n], i) => {
      const x = px + (i % 2) * 160, y = py + 90 + Math.floor(i / 2) * 22;
      const t = text(scene, x + 44, y, '', 15, '#f6ecd2');
      list.add([text(scene, x, y, n, 15, '#e9c46a', FONT), t]);
      return t;
    });
    showPreview(null);
    return baseStats;
  };

  // ---------- 出阵页 ----------
  const renderDeploy = () => {
    countText.setText(`出阵 ${count()} / ${plan.max}`);
    pageText.setText(`第 ${pages.deploy + 1} / ${PAGES} 页`);
    prevBtn.setDisabled(pages.deploy === 0);
    nextBtn.setDisabled(pages.deploy === PAGES - 1);
    cards.slice(pages.deploy * PER_PAGE, (pages.deploy + 1) * PER_PAGE).forEach((c, i) => {
      const cx = x0 + 22 + (i % COLS_N) * (cw + gap), cy = y0 + 92 + Math.floor(i / COLS_N) * (ch + gap);
      const on = c.fixed || selected.has(c.id);
      const lock = locked(c);
      const g = scene.add.graphics();
      const draw = (hover) => {
        g.clear();
        g.fillStyle(on ? 0x1c2a44 : hover ? 0x3a2a18 : 0x22160c, 1).fillRoundedRect(cx, cy, cw, ch, 8);
        g.lineStyle(on ? 3 : 1, on ? (lock ? COLORS.gold : 0x6ab8ff) : COLORS.gold, on || hover ? 1 : 0.4).strokeRoundedRect(cx, cy, cw, ch, 8);
      };
      draw(false);
      const zone = scene.add.zone(cx, cy, cw, ch).setOrigin(0).setInteractive({ useHandCursor: !lock });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', (p, lx, ly, e) => { e?.stopPropagation?.(); toggle(c); });
      const pt = portrait(scene, cx + 52, cy + ch / 2, c.name, 'player', 84);
      if (!on) pt.setAlpha(0.5);
      const hp = calcStats(c.fixed ? c : unitOf(c)).hp;
      const tag = lock ? ['必须出阵', '#ffd36a'] : on ? ['出　阵', '#9cc8ff'] : ['待　命', '#8a7a60'];
      list.add([g, zone, pt,
        text(scene, cx + 104, cy + 10, c.name, 22, on ? '#fff2cc' : '#bfae88', FONT),
        text(scene, cx + 104, cy + 42, `${classOf(c.cls, c.tier).name}　Lv ${c.lvl}`, 15, '#f1e3c2'),
        text(scene, cx + 104, cy + 66, `兵力 ${hp}`, 15, '#9ce0a8'),
        text(scene, cx + 104, cy + 92, tag[0], 15, tag[1], FONT)]);
    });
  };

  // ---------- 装备页 ----------
  const equipTo = (c, s, uid) => {
    const r = roster();
    for (const [gid, e] of Object.entries(r)) {
      if (e.equip?.[s] === uid && uid != null) r[gid] = { ...e, equip: { ...e.equip, [s]: null } };
    }
    const e = r[c.id] || {};
    r[c.id] = { ...e, equip: { weapon: null, armor: null, acc: null, ...e.equip, [s]: uid } };
    save(r);
    refresh();
  };
  const renderEquip = () => {
    const c = generals.find((o) => o.id === cur);
    if (!c) return;
    genList();
    const mx = x0 + 248, my = y0 + 92;
    const now = statBox(c, mx, my);
    const kit = kitOf(c.id);
    SLOTS.forEach((s, i) => {
      const it = kit[s], e = it && EQUIP[it.id];
      const lv = e && e.cap > 1 ? `　经验 ${it.exp}/${EXP_PER_LVL}` : '';
      row(mx, my + 186 + i * 74, 326, 68, {
        icon: e ? gearIcon(it.id) : null,
        title: `${SLOT_NAME[s]}：${e ? gearName(it) : '（空）'}`, color: e?.treasure ? '#ffd36a' : '#f1e3c2',
        sub: e ? `${gearDesc(it.id, it.lvl)}${lv}`.slice(0, 30) : '点选后从右侧背包装备', active: s === slot,
        btn: e ? '卸下' : null, onBtn: () => equipTo(c, s, null),
        onClick: () => { slot = s; pages.bag = 0; refresh(); },
      });
    });
    const bx = x0 + 590, by = y0 + 92;
    const bag = inv.filter((it) => EQUIP[it.id].slot === slot && canEquip(it.id, c.cls) && it.uid !== kit[slot]?.uid);
    list.add(text(scene, bx, by + 2, `背包·${SLOT_NAME[slot]}（可装备 ${bag.length} 件）`, 16, '#e9c46a', FONT));
    const pg = pager(bx + 388, by, 'bag', bag.length, 8);
    if (!bag.length) list.add(text(scene, bx, by + 40, '没有可装备的物品', 15, '#8a7a60'));
    bag.slice(pg * 8, (pg + 1) * 8).forEach((it, i) => {
      const e = EQUIP[it.id];
      const next = calcStats(unitOf(c, { ...kit, [slot]: it }));
      const owner = ownerOf(it.uid);
      row(bx, by + 32 + i * 46, 388, 42, {
        icon: gearIcon(it.id), title: gearName(it), color: e.treasure ? '#ffd36a' : '#f1e3c2',
        sub: diffText(now, next), right: owner ? `${nameOf(owner)}装备中` : '', rightColor: '#9cc8ff',
        onClick: () => equipTo(c, slot, it.uid),
        onHover: (on) => showPreview(on ? next : null),
      });
    });
  };

  // ---------- 道具页 ----------
  const eat = (c, id) => {
    const r = roster();
    const e = { ...r[c.id] };
    const f = ITEMS[id].fruit;
    if (f === 'exp') {
      if (!e.lvl) Object.assign(e, { lvl: c.lvl, exp: 0, cls: c.cls, tier: c.tier });
      e.exp = (e.exp || 0) + FRUIT_EXP;
      while (e.exp >= 100) { e.exp -= 100; e.lvl += 1; }
      if (e.lvl > c.lvl) toast.setText(`${c.name}升到了 ${e.lvl} 级！`);
      c.lvl = e.lvl;
    } else {
      e.fruits = { ...e.fruits, [f]: (e.fruits?.[f] || 0) + 1 };
      toast.setText(`${c.name}的${STAT_NAME[f]} +2`);
    }
    r[c.id] = e;
    scene.items[id] -= 1;
    save(r);
    refresh();
  };
  const renderItems = () => {
    const c = generals.find((o) => o.id === cur);
    if (!c) return;
    genList();
    const mx = x0 + 248, my = y0 + 92;
    statBox(c, mx, my);
    const r = roster()[c.id] || {};
    const eaten = Object.entries(r.fruits || {}).filter(([, n]) => n > 0).map(([k, n]) => `${STAT_NAME[k]}+${n * 2}`);
    list.add(text(scene, mx, my + 186, `果子加成：${eaten.join('　') || '无'}`, 15, '#cdbd98').setWordWrapWidth(326));
    list.add(text(scene, mx, my + 214, `经验 ${r.exp || 0}/100`, 15, '#cdbd98'));
    const bx = x0 + 590, by = y0 + 92;
    const fruits = Object.keys(ITEMS).filter((id) => ITEMS[id].fruit);
    list.add(text(scene, bx, by + 2, '果　子', 16, '#e9c46a', FONT));
    fruits.forEach((id, i) => {
      const n = scene.items[id] || 0;
      row(bx, by + 32 + i * 46, 388, 42, {
        icon: `fx-${id}`, title: `${ITEMS[id].name} ×${n}`, sub: ITEMS[id].desc,
        btn: '使用', btnOff: n <= 0, onBtn: () => eat(c, id),
      });
    });
    const rest = Object.keys(ITEMS).filter((id) => !ITEMS[id].fruit && scene.items[id] > 0).map((id) => `${ITEMS[id].name}×${scene.items[id]}`);
    list.add(text(scene, bx, by + 42 + fruits.length * 46, `战斗道具：${rest.join('　') || '无'}`, 14, '#bfae88').setWordWrapWidth(388));
  };

  // ---------- 商店页 ----------
  const stock = shopStock(plan.stageId);
  const priceOf = (id) => EQUIP[id]?.price ?? ITEM_PRICE[id];
  const buy = (id) => {
    const p = priceOf(id);
    if (scene.gold < p) { toast.setText('军资金不足'); return; }
    scene.gold -= p;
    if (EQUIP[id]) newGear(inv, id, 1);
    else scene.items[id] = (scene.items[id] || 0) + 1;
    toast.setText(`购买了「${EQUIP[id]?.name || ITEMS[id].name}」`);
    save();
    refresh();
  };
  const sell = (o) => {
    if (o.gear) {
      const i = inv.indexOf(o.gear);
      if (i < 0) return;
      inv.splice(i, 1);
      if (o.fruit) scene.items[o.fruit] = (scene.items[o.fruit] || 0) + 1;
    } else scene.items[o.id] -= 1;
    scene.gold += o.price;
    toast.setText(`卖出「${o.name}」，得 ${o.price} 金${o.fruit ? `与「${ITEMS[o.fruit].name}」` : ''}`);
    save();
    refresh();
  };
  const renderShop = () => {
    const bx = x0 + 22, by = y0 + 92, sx = x0 + 512;
    list.add(text(scene, bx, by + 2, `购　买（${stock.length} 种）`, 16, '#e9c46a', FONT));
    const pb = pager(bx + 466, by, 'buy', stock.length, 8);
    stock.slice(pb * 8, (pb + 1) * 8).forEach((id, i) => {
      const e = EQUIP[id], p = priceOf(id);
      row(bx, by + 32 + i * 46, 466, 42, {
        icon: e ? gearIcon(id) : `fx-${id}`, title: e?.name || ITEMS[id].name,
        sub: e ? `${SLOT_NAME[e.slot]}　${gearDesc(id, 1)}` : ITEMS[id].desc, right: `${p} 金`,
        btn: '购买', btnOff: scene.gold < p, onBtn: () => buy(id),
      });
    });
    const equipped = new Set(Object.values(roster()).flatMap((r) => (r.equip ? SLOTS.map((s) => r.equip[s]) : [])));
    const goods = [
      ...inv.filter((it) => !EQUIP[it.id].treasure && !equipped.has(it.uid)).map((it) => {
        const e = EQUIP[it.id];
        const fruit = it.lvl >= NORMAL_CAP && e.sellFruit ? e.sellFruit : null;
        return { gear: it, name: gearName(it), icon: gearIcon(it.id), price: sellPrice(e.price), fruit, sub: fruit ? `另得「${ITEMS[fruit].name}」` : SLOT_NAME[e.slot] };
      }),
      ...Object.keys(ITEM_PRICE).filter((id) => scene.items[id] > 0).map((id) => ({
        id, name: `${ITEMS[id].name} ×${scene.items[id]}`, icon: `fx-${id}`, price: sellPrice(ITEM_PRICE[id]), sub: '消耗品',
      })),
    ];
    list.add(text(scene, sx, by + 2, `出　售（未装备的物品 ${goods.length} 种）`, 16, '#e9c46a', FONT));
    const ps = pager(sx + 466, by, 'sell', goods.length, 8);
    if (!goods.length) list.add(text(scene, sx, by + 40, '没有可以卖出的物品（装备中的物品与宝物不能卖出）', 14, '#8a7a60'));
    goods.slice(ps * 8, (ps + 1) * 8).forEach((o, i) => {
      row(sx, by + 32 + i * 46, 466, 42, {
        icon: o.icon, title: o.name, sub: o.sub, right: `${o.price} 金`, btn: '卖出', onBtn: () => sell(o),
      });
    });
  };

  const render = () => {
    if (closed) return;
    list.removeAll(true);
    hint.setText(HINT[tab]);
    goldText.setText(`军资金 ${scene.gold}`);
    tabBtns.forEach((b, i) => b.label.setColor(TABS[i][0] === tab ? '#ffd36a' : '#f6e7c1'));
    const deploy = tab === 'deploy';
    countText.setVisible(deploy);
    resetBtn.setVisible(deploy);
    const paged = tab === 'deploy' || tab === 'equip' || tab === 'items';
    prevBtn.setVisible(paged);
    nextBtn.setVisible(paged);
    pageText.setVisible(paged);
    if (deploy) renderDeploy();
    else {
      if (paged) {
        pageText.setText(`第 ${pages.gen + 1} / ${GEN_PAGES} 页`);
        prevBtn.setDisabled(pages.gen === 0);
        nextBtn.setDisabled(pages.gen === GEN_PAGES - 1);
      }
      if (tab === 'equip') renderEquip();
      else if (tab === 'items') renderItems();
      else renderShop();
    }
  };
  render();
  return root;
}
