// AI 完整对战：用 planAI 同时驱动我军与敌军，把一关打到分出胜负，输出对战数据（难度复核用）
//
// 用法（先启动 dev server，例如 `npx vite --port 5191`）：
//   node scripts/ai-battle.mjs <关卡id> [局数=3] [--port 5191] [--par 2] [--speed 20] [--step 33] [--idle] [--reach] [--all]
//   --idle：我军每回合直接结束（看受保护单位 / 曹操能撑几回合）
//   --reach：撤退等分支结局的 reach 条件也作为行军目标（如赤壁撤至西北角）
//   --all：胜利条件替换为全歼敌军（测“全清”所需回合）；LOG=40 环境变量打印最后 40 条战斗日志
//   旧版本（没有 ?stage 入口）也能跑：把旧代码起在另一个端口，用 --port 指过去
// 环境变量：PW_REQUIRE（playwright-core 所在 node_modules 目录）、PW_CHROME（chromium / headless_shell 路径）
//
// 我军行动（模拟谨慎的玩家，见 decide）：攻击按 planAI；残兵后撤并用豆 / 米；没有目标时谨慎推进；
// 关卡有 reach 胜利条件（主线结局）时，无攻击目标的单位向目标格行军。对白选第一个选项，整备直接按默认阵容出阵。
// 输出每局：胜负、结束回合、我军撤退人数、首次接战回合、每波援军出场时双方态势。
import { createRequire } from 'module';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def; };
const port = opt('port', '5191');
const par = +opt('par', '2');
const speed = +opt('speed', '20');
const step = +opt('step', '33'); // 不渲染、手动推进游戏循环，每步的毫秒数（0 = 照常按 rAF 渲染）
const idle = args.includes('--idle') && !!args.splice(args.indexOf('--idle'), 1); // 我军不行动（检查受保护单位能撑几回合）
const anyReach = args.includes('--reach') && !!args.splice(args.indexOf('--reach'), 1); // 所有 reach 条件（含撤退等分支结局）都作为行军目标
const all = args.includes('--all') && !!args.splice(args.indexOf('--all'), 1); // 胜利条件改为全歼（测全清所需回合）
const [stage, runsArg] = args;
if (!stage) { console.error('用法：node scripts/ai-battle.mjs <关卡id> [局数] [--port 5191] [--par 2] [--idle] [--reach] [--all]'); process.exit(1); }
const runs = +(runsArg || 3);

// playwright-core 不是项目依赖：先按常规解析（全局 / 上级目录安装），失败再用 PW_REQUIRE 或本机 npx 缓存目录
const loadPW = () => {
  const dirs = [process.env.PW_REQUIRE, import.meta.url, `${process.env.HOME}/.npm/_npx/0b9ff77863cb6e9f/node_modules/`].filter(Boolean);
  for (const d of dirs) try { return createRequire(d)('playwright-core'); } catch { /* 尝试下一个 */ }
  console.error('找不到 playwright-core：请用 PW_REQUIRE 指向其所在的 node_modules 目录');
  process.exit(1);
};
const { chromium } = loadPW();
const exe = process.env.PW_CHROME || `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1181/chrome-mac/headless_shell`;
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

async function battle(n) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${port}/?stage=${stage}&story=0`); // story=0：跳过开场场景直接进战场
  // 旧版本（没有 ?stage 调试入口）：按新游戏重置 registry 后直接进关
  await page.waitForFunction(() => window.game?.scene?.getScene('Title')?.sys?.isActive() || window.game?.scene?.getScene('Battle')?.sys?.isActive(), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(async (stage) => {
    if (game.scene.getScene('Battle').sys.isActive()) return;
    const { DIFFICULTIES } = await import('/src/data.js');
    const t = game.scene.getScene('Title'), d = DIFFICULTIES.normal;
    const init = { difficulty: 'normal', roster: {}, joined: [], items: { ...d.items }, red: 0, flags: {}, inventory: [], gold: 0 };
    for (const [k, v] of Object.entries(init)) t.registry.set(k, v);
    t.scene.start('Battle', { stage });
  }, stage);
  await page.waitForFunction(() => window.game?.scene?.getScene('Battle')?.sys?.isActive(), null, { timeout: 30000 });
  await page.evaluate(async ([speed, step, all, idle, anyReach]) => {
    const s = (window.__s = game.scene.getScene('Battle'));
    if (all) s.stage = { ...s.stage, victory: [{ type: 'all' }] };
    // 跳过渲染：停掉 rAF 循环，用 MessageChannel 连续调用 headlessStep（对战只看结果，不需要画面）
    if (step > 0) {
      game.loop.sleep();
      let t = performance.now();
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { t += step; game.headlessStep(t, step); ch.port2.postMessage(0); };
      ch.port2.postMessage(0);
    }
    const L = await import('/src/logic.js');
    const A = await import('/src/actions.js');
    const D = await import('/src/data.js');
    const T = await import('/src/terrain.js').catch(() => null);
    // 移动消耗 / 攻击格：兼容旧版本（地形表在 data.js、按 moveType 分步行与骑马；attackTiles 不传地图）
    const IMPASSABLE = T?.IMPASSABLE ?? 99;
    const moveCost = T ? (u, ch) => T.moveCost(u.cls, ch) : (u, ch) => D.TERRAIN[ch].cost[D.classOf(u.cls, u.tier).moveType];
    const attackTiles = L.attackTiles.length >= 2 ? L.attackTiles : (map, u, x, y) => L.attackTiles(u, x, y);
    const S = await import('/src/status.js');
    s.tweens.timeScale = s.time.timeScale = speed;
    const R = (window.__r = { waves: [], timeline: [], contact: null, result: null });
    const side = (f) => s.units.filter((u) => u.faction === f);
    const pct = (list) => { const a = list.filter((u) => u.alive); return Math.round(100 * a.reduce((t, u) => t + u.hp, 0) / Math.max(1, a.reduce((t, u) => t + u.stats.hp, 0))); };
    const state = () => ({ turn: s.turn, phase: s.phase, p: side('player').filter((u) => u.alive).length, e: side('enemy').filter((u) => u.alive).length, a: side('ally').filter((u) => u.alive).length, pHp: pct(side('player')), eHp: pct(side('enemy')) });
    // 日志：带回合号保存，便于复盘
    R.log = [];
    const log = s.hud.log.bind(s.hud);
    s.hud.log = (m) => { R.log.push(`T${s.turn}${s.phase[0]} ${m}`); return log(m); };
    // 结果
    const vic = s.victory.bind(s), def = s.defeat.bind(s);
    s.victory = (outcome = 'win', via = 'all') => { if (!R.result) R.result = { win: true, outcome, via, ...state() }; return vic(outcome, via); };
    s.defeat = (reason) => { if (!R.result) R.result = { win: false, reason, ...state() }; return def(reason); };
    // 援军：记录出场时双方态势与新单位到我军的最近距离
    const runEvent = s.runEvent.bind(s);
    s.runEvent = async (i, ev) => {
      const before = s.units.length;
      // 援军走入、战场演出都是异步的：等事件执行完再统计
      const p = await runEvent(i, ev);
      const spawned = s.units.slice(before);
      if (spawned.length) {
        const pl = side('player').filter((u) => u.alive);
        const near = Math.min(...spawned.map((u) => Math.min(...pl.map((o) => Math.abs(o.x - u.x) + Math.abs(o.y - u.y)))));
        R.waves.push({ ev: i, n: spawned.length, side: spawned[0].faction, near, ...state() });
      }
      return p;
    };
    // 首次接战：任一方有单位受损
    setInterval(() => {
      if (R.contact || !s.units) return;
      const hurt = (f) => side(f).some((u) => !u.alive || u.hp < u.stats.hp);
      if (hurt('player') || hurt('enemy')) R.contact = { turn: s.turn, phase: s.phase };
    }, 100);
    // 推进对白 / 选项 / 整备 / 战果
    const find = (list, label) => {
      for (const o of list) {
        if (o.label && o.label.text?.replace(/[\s　]/g, '') === label) return o;
        if (o.list) { const r = find(o.list, label); if (r) return r; }
      }
    };
    const press = (b) => { const z = b.list.find((o) => o.type === 'Zone'); z.emit('pointerdown', s.input.activePointer, 0, 0, { stopPropagation() {} }); };
    setInterval(() => {
      if (!s.sys.isActive() || R.result) return;
      if (s.dialog?.choiceBox) { press(s.dialog.choiceBox.list[0]); return; }
      if (s.dialog?.root.visible) { s.dialog.next(); return; }
      const b = find(s.children.list, '出阵');
      if (b) press(b);
    }, 40);
    // 按兵种移动消耗从 sources 做 Dial 最短路，得到每格到最近 source 的移动消耗
    const W = s.map[0].length, H = s.map.length;
    function field(sources, u) {
      const f = new Array(W * H).fill(Infinity), buckets = [[]];
      for (const [x, y] of sources) { f[y * W + x] = 0; buckets[0].push([x, y]); }
      for (let c0 = 0; c0 < buckets.length; c0++) {
        for (const [x, y] of buckets[c0] || []) {
          if (f[y * W + x] < c0) continue;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const c = c0 + moveCost(u, s.map[ny][nx]);
            if (c >= IMPASSABLE || c >= f[ny * W + nx]) continue;
            f[ny * W + nx] = c; (buckets[c] ||= []).push([nx, ny]);
          }
        }
      }
      return f;
    }
    // 威胁图：每格能被多少个敌人在其下一阶段移动后攻击到
    function dangerMap() {
      const d = new Array(W * H).fill(0);
      for (const f of s.units) {
        if (!f.alive || f.faction !== 'enemy' || !S.canAct(f) || f.ai === 'peace') continue;
        const hit = new Set();
        const tiles = L.reachable(s.map, s.units, f).values();
        for (const t of tiles) for (const a of attackTiles(s.map, f, t.x, t.y)) hit.add(a.y * W + a.x);
        for (const k of hit) d[k] += 1;
      }
      return d;
    }
    const goals = (u) => s.stage.victory.filter((c) => c.type === 'reach' && (anyReach || !c.outcome || c.outcome === 'win') && s.turn >= (c.fromTurn || 1)
      && (c.unit === 'any' || c.unit === u.id));
    // 移动：在可达格中选 score 最小者（只移到空格）
    function bestTile(u, score) {
      let best = null, bs = Infinity;
      for (const t of L.reachable(s.map, s.units, u).values()) {
        const o = s.unitAt(t.x, t.y);
        if (o && o !== u) continue;
        const v = score(t);
        if (v < bs) { bs = v; best = t; }
      }
      return best;
    }
    // 我军策略（模拟谨慎的玩家）：兵力低于 40% 时后撤到威胁最少的格子并用豆 / 米；
    // 攻击按 planAI（视为受保护单位，避开多个敌人能打到的格子）；没有目标时谨慎推进：只走到至多 1~2 个敌人能打到的格子；
    // 关卡有 reach 主线胜利条件时，没有攻击目标的可行单位向目标格行军
    function decide(u, danger) {
      const r = u.hp / u.stats.hp;
      const ai = u.ai, guard = u.guard;
      u.ai = 'aggressive'; u.guard = true;
      let plan;
      try { plan = L.planAI(s.map, s.units, u, s.weather); } finally { u.ai = ai; u.guard = guard; }
      const kills = plan?.type === 'attack' && L.physDamage(s.map, u, plan.target) >= plan.target.hp;
      const heal = s.items.rice > 0 && u.stats.hp - u.hp >= 60 ? 'rice' : s.items.bean > 0 ? 'bean' : s.items.rice > 0 ? 'rice' : null;
      if (r < 0.4 && !kills && !(plan?.type === 'spell')) {
        const healCh = (t) => (L.terrainAt(s.map, t.x, t.y).heal ? 1 : 0);
        const tile = bestTile(u, (t) => danger[t.y * W + t.x] * 10 - healCh(t) * 5);
        return { tile, type: 'wait', item: heal };
      }
      if (plan && plan.type !== 'wait') return plan;
      const cap = r > 0.7 ? 2 : 1;
      const gs = goals(u);
      const f = gs.length ? field(gs.flatMap((c) => c.tiles), u)
        : field(s.units.filter((o) => o.alive && o.faction === 'enemy').map((o) => [o.x, o.y]), u);
      const here = f[u.y * W + u.x];
      const tile = bestTile(u, (t) => {
        const dg = danger[t.y * W + t.x];
        return (dg > cap && !gs.length ? 1e6 : 0) + f[t.y * W + t.x] * 4 + dg;
      });
      if (!tile || f[tile.y * W + tile.x] >= here) return null;
      return { tile, type: 'wait' };
    }
    async function playerTurn() {
      if (idle) { s.endPlayerPhase(); return; }
      s.state = 'busy';
      const danger = dangerMap();
      const list = side('player').filter((u) => u.alive && !u.acted).sort((a, b) => (a.guard ? 1 : 0) - (b.guard ? 1 : 0));
      for (const u of list) {
        if (s.over || s.phase !== 'player') return;
        if (!u.alive || u.acted) continue;
        const plan = S.canAct(u) ? decide(u, danger) : null;
        if (plan?.tile) {
          try {
            await s.follow?.(u, plan.tile, plan.target);
            const node = L.reachable(s.map, s.units, u).get(L.key(plan.tile.x, plan.tile.y));
            const path = node ? L.pathTo(node) : [{ x: u.x, y: u.y }];
            const last = path[path.length - 1];
            u.x = last.x; u.y = last.y;
            await s.views.get(u).moveAlong(path);
            if (plan.type === 'attack') await A.doAttack(s, u, plan.target);
            else if (plan.type === 'spell') await A.doSpell(s, u, plan.spell, plan.target);
            else if (plan.item) { R.items = (R.items || 0) + 1; await A.doItem(s, u, plan.item, u); }
          } catch (e) { console.error('我军 AI 行动出错', e); }
        }
        await s.finishUnit(u);
        if (s.over || s.phase !== 'player') return;
        s.state = 'busy';
      }
      if (!s.over && s.phase === 'player') { s.state = 'idle'; s.endPlayerPhase(); }
    }
    let driving = false, lastTurn = 0;
    setInterval(() => {
      if (driving || R.result || s.over || s.phase !== 'player' || s.state !== 'idle' || s.modal || s.dialog.root.visible) return;
      if (s.turn !== lastTurn) { lastTurn = s.turn; R.timeline.push(state()); }
      driving = true;
      playerTurn().catch((e) => console.error('我军回合出错', e)).finally(() => { driving = false; });
    }, 60);
  }, [speed, step, all, idle, anyReach]);
  const t0 = Date.now();
  await page.waitForFunction(() => window.__r?.result, null, { timeout: 30 * 60 * 1000, polling: 500 }).catch((e) => errs.push('timeout ' + e.message));
  const r = await page.evaluate(() => {
    const s = __s, R = __r;
    const pl = s.units.filter((u) => u.faction === 'player');
    return { ...R, retreated: pl.filter((u) => !u.alive && !u.escaped).map((u) => u.name), playerCount: pl.length, turns: s.stage.turns };
  }).catch((e) => ({ error: e.message }));
  await page.close();
  return { n, secs: Math.round((Date.now() - t0) / 1000), errs: errs.slice(0, 5), ...r };
}

const out = [];
let next = 0;
await Promise.all(Array.from({ length: Math.min(par, runs) }, async () => {
  while (next < runs) {
    const r = await battle(next++);
    out.push(r);
    const res = r.result || {};
    console.log(`[${stage}${all ? ' 全歼' : ''}${idle ? ' 不行动' : ''}${anyReach ? ' 目标格' : ''} #${r.n}] ${res.win ? '胜' : '负'} ${res.outcome || res.reason || ''} 回合 ${res.turn}/${r.turns}  撤退 ${r.retreated?.length}/${r.playerCount} ${JSON.stringify(r.retreated)}  用药 ${r.items || 0}  接战 ${r.contact?.turn}  ${r.secs}s`);
    for (const w of r.waves || []) console.log(`    援军 ev${w.ev} ${w.side}×${w.n} T${w.turn}${w.phase[0]} 距我军${w.near}  我${w.p}(${w.pHp}%) 敌${w.e}(${w.eHp}%) 友${w.a}`);
    console.log('    态势 ' + (r.timeline || []).map((t) => `T${t.turn}:${t.p}/${t.e}`).join(' '));
    if (r.errs?.length) console.log('    错误', r.errs);
    if (process.env.LOG) console.log((r.log || []).slice(-+process.env.LOG).join('\n'));
  }
}));
await browser.close();
