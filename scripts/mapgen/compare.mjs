// 与基线版本比较关卡结构：去掉坐标、回合后，对白、事件、单位、胜负条件应完全一致
// 用法：node scripts/mapgen/compare.mjs <组字母> [git 基线，默认 HEAD]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { pathToFileURL, fileURLToPath } from 'url';

const [group, ref = 'HEAD'] = process.argv.slice(2);
if (!group) throw new Error('用法：node scripts/mapgen/compare.mjs <组字母> [git 基线]');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stages-base-'));
execSync(`git archive ${ref} src | tar -x -C ${tmp}`, { cwd: root });
const { default: O } = await import(pathToFileURL(path.join(tmp, `src/stages/${group}.js`)).href);
const { default: N } = await import(pathToFileURL(path.join(root, `src/stages/${group}.js`)).href);
fs.rmSync(tmp, { recursive: true, force: true });

const SKIP = ['x', 'y', 'turn', 'tiles'];
const strip = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v, (k, x) => (SKIP.includes(k) ? undefined : x))));
const KEYS = ['id', 'name', 'next', 'victoryText', 'victory', 'prologue', 'epilogue', 'epilogues', 'events', 'protect', 'victoryFlags'];
let bad = 0;
O.forEach((o, i) => {
  const n = N[i];
  if (!n) { bad++; console.log('缺少关卡', o.id); return; }
  for (const k of KEYS) if (JSON.stringify(strip(o[k])) !== JSON.stringify(strip(n[k]))) { bad++; console.log('差异', o.id, k); }
  if (JSON.stringify(strip(o.units)) !== JSON.stringify(strip(n.units))) { bad++; console.log('单位差异', o.id); }
  const turns = (s) => (s.events || []).map((e) => e.turn ?? '-').join(',');
  console.log(o.id, 'turns', o.turns, '->', n.turns, '| 事件回合', turns(o), '->', turns(n));
});
if (N.length !== O.length) { bad++; console.log('关卡数量不同', O.length, '->', N.length); }
console.log(bad ? `有 ${bad} 处结构差异` : '结构一致');
process.exitCode = bad ? 1 : 0;
