// 营中场景回归：逐关进入营中（?camp=<关卡 id>），检查人物、对话、整备 / 商店、存档快照，最后从营门出征进入开场场景
//
// 用法（先启动 dev server，例如 `npx vite --port 5191`）：
//   node scripts/camp-smoke.mjs [关卡id ...] [--port 5191] [--shot 目录]
//   不带关卡 id 时跑全部 56 关（第一关之前不进营中）；--shot 保存每关营中截图
// 环境变量同 ai-battle.mjs：PW_REQUIRE（playwright-core 所在 node_modules 目录）、PW_CHROME（chromium 路径）
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { PLANNED_IDS, FIRST_STAGE } from '../src/stageMeta.js';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def; };
const port = opt('port', '5191');
const shot = opt('shot', null);
const ids = args.length ? args : PLANNED_IDS.filter((id) => id !== FIRST_STAGE);
if (shot) mkdirSync(shot, { recursive: true });

const loadPW = () => {
  const dirs = [process.env.PW_REQUIRE, import.meta.url, `${process.env.HOME}/.npm/_npx/0b9ff77863cb6e9f/node_modules/`].filter(Boolean);
  for (const d of dirs) try { return createRequire(d)('playwright-core'); } catch { /* 尝试下一个 */ }
  console.error('找不到 playwright-core：请用 PW_REQUIRE 指向其所在的 node_modules 目录');
  process.exit(1);
};
const { chromium } = loadPW();
const exe = process.env.PW_CHROME || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1181/chrome-mac/headless_shell`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

const until = async (page, fn, arg, ms = 15000) => {
  const t0 = Date.now();
  for (;;) {
    if (await page.evaluate(fn, arg)) return true;
    if (Date.now() - t0 > ms) return false;
    await page.waitForTimeout(100);
  }
};

let failed = 0;
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 672 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const out = { id };
  try {
    await page.goto(`http://localhost:${port}/?camp=${id}`);
    const ok = await until(page, () => window.game?.scene.isActive('Camp') && window.game.scene.getScene('Camp').player);
    if (!ok) throw new Error('没有进入营中');
    await page.waitForTimeout(600);
    if (shot) await page.screenshot({ path: `${shot}/${id}.png` });
    // 人物与对话：逐个和带本关台词的人物对话（选项选第一个）
    Object.assign(out, await page.evaluate(async () => {
      const s = window.game.scene.getScene('Camp');
      const npcs = s.ents.filter((e) => e.kind === 'npc' && e.role === 'talk');
      const red0 = s.registry.get('red') || 0;
      let talks = 0;
      for (const n of npcs.filter((e) => e.unread)) {
        const p = s.talk(n);
        for (let k = 0; k < 60 && s.dialog.root.visible; k++) {
          if (s.dialog.choiceBox) s.dialog.choiceBox.list[0].list[2].emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
          else s.dialog.next();
          await new Promise((r) => setTimeout(r, 30));
        }
        await p;
        talks += 1;
      }
      // 通用台词（每人一段）
      for (const n of npcs.filter((e) => !e.unread).slice(0, 3)) {
        const p = s.talk(n);
        for (let k = 0; k < 40 && s.dialog.root.visible; k++) { s.dialog.next(); await new Promise((r) => setTimeout(r, 30)); }
        await p;
      }
      return {
        layout: s.layout.id, people: npcs.length, talked: s.talked.length, talks,
        redDelta: (s.registry.get('red') || 0) - red0, unread: npcs.filter((e) => e.unread).length,
      };
    }));
    // 整备与商店：打开再关闭
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Camp');
      s.openPrepUI(false);
    });
    await page.waitForTimeout(200);
    out.prep = await page.evaluate(() => {
      const s = window.game.scene.getScene('Camp');
      const root = s.children.list.find((o) => o.depth === 3000);
      const find = (c, label) => c.list?.find((o) => o.label?.text === label) || c.list?.map((o) => find(o, label)).find(Boolean);
      const done = root && find(root, '完　成');
      done?.list[2].emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
      return !!done && !s.modal && Array.isArray(s.deploy);
    });
    await page.evaluate(() => window.game.scene.getScene('Camp').openPrepUI(true));
    await page.waitForTimeout(200);
    out.shop = await page.evaluate(() => {
      const s = window.game.scene.getScene('Camp');
      const root = s.children.list.find((o) => o.depth === 3000);
      const find = (c, label) => c.list?.find((o) => o.label?.text === label) || c.list?.map((o) => find(o, label)).find(Boolean);
      const leave = root && find(root, '离　开');
      leave?.list[2].emit('pointerdown', {}, 0, 0, { stopPropagation() {} });
      return !!leave && !s.modal;
    });
    // 寻路走到营门旁边并出征
    out.snapshot = await page.evaluate(() => {
      const s = window.game.scene.getScene('Camp');
      const d = s.snapshot();
      return d.kind === 'camp' && d.stage === s.stageId && Array.isArray(d.talked) && d.talked.length === s.talked.length;
    });
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Camp');
      const g = s.objects.find((o) => o.kind === 'gate');
      s.goTo([g.a, g.b], g);
    });
    out.reachGate = await until(page, () => {
      const s = window.game.scene.getScene('Camp');
      return s.modal && s.children.list.some((o) => o.depth === 3000);
    }, null, 20000);
    await page.evaluate(() => window.game.scene.getScene('Camp').depart());
    out.story = await until(page, (sid) => window.game.scene.isActive('Story') && window.game.scene.getScene('Story').opts?.stage === sid, id, 5000);
  } catch (e) {
    errs.push(e.message);
  }
  out.errors = errs;
  const bad = errs.length || !out.prep || !out.shop || !out.snapshot || !out.reachGate || !out.story || out.unread;
  if (bad) failed += 1;
  console.log(bad ? '失败' : '通过', JSON.stringify(out));
  await page.close();
}
await browser.close();
console.log(failed ? `\n营中回归失败：${failed} 关` : `\n营中回归全部通过（${ids.length} 关）`);
process.exit(failed ? 1 : 0);
