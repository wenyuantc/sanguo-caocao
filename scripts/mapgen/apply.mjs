// 把地图模块中的地图以字面字符串写回关卡文件，并补上 mapVersion: 2
// 用法：node scripts/mapgen/apply.mjs <组字母> <地图模块路径>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { lit } from './lib.mjs';

const [group, mod] = process.argv.slice(2);
if (!group || !mod) throw new Error('用法：node scripts/mapgen/apply.mjs <组字母> <地图模块路径>');
const file = new URL(`../../src/stages/${group}.js`, import.meta.url);
const { MAPS } = await import(pathToFileURL(path.resolve(mod)).href);
let src = fs.readFileSync(file, 'utf8');
for (const [id, rows] of Object.entries(MAPS)) {
  const at = src.indexOf(`id: '${id}'`);
  if (at < 0) throw new Error(`${group}.js 中找不到关卡 ${id}`);
  const ms = src.indexOf('    map: [', at);
  const me = src.indexOf('\n    ],', ms) + '\n    ],'.length;
  const hasVer = src.slice(at, ms).includes('mapVersion');
  const block = `${hasVer ? '' : '    mapVersion: 2,\n'}    map: [\n${lit(rows)}\n    ],`;
  src = src.slice(0, ms) + block + src.slice(me);
}
fs.writeFileSync(file, src);
console.log(`已写入 ${Object.keys(MAPS).length} 张地图到 src/stages/${group}.js`);
