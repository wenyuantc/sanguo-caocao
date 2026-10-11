// 打印地图预览（带坐标）：node scripts/mapgen/show.mjs <地图模块路径> [关卡 id ...]
// 地图模块需导出 MAPS = { 关卡id: string[] }
import path from 'path';
import { pathToFileURL } from 'url';
import { show } from './lib.mjs';

const [mod, ...ids] = process.argv.slice(2);
if (!mod) throw new Error('用法：node scripts/mapgen/show.mjs <地图模块路径> [关卡 id ...]');
const { MAPS } = await import(pathToFileURL(path.resolve(mod)).href);
for (const [k, v] of Object.entries(MAPS)) if (!ids.length || ids.includes(k)) show(k, v);
