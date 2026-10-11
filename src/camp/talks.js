// 营中台词汇总与选择（纯数据 + 纯函数，不依赖 Phaser，校验脚本可直接导入）
// 本关专属台词按关卡分组写在 talks_<组>.js（分组与 src/stages/<组>.js 相同），键为即将开始的关卡 id；
// 通用台词写在 generic.js。格式见 docs/STAGE_GUIDE.md §13。
import { CAMP_TALKS_A } from './talks_a.js';
import { CAMP_TALKS_B } from './talks_b.js';
import { CAMP_TALKS_C } from './talks_c.js';
import { CAMP_TALKS_D } from './talks_d.js';
import { CAMP_TALKS_E } from './talks_e.js';
import { CAMP_TALKS_F } from './talks_f.js';
import { GENERIC_TALKS, FOLK_TALKS } from './generic.js';

export { GENERIC_TALKS, FOLK_TALKS };
export const TALKS_BY_GROUP = { a: CAMP_TALKS_A, b: CAMP_TALKS_B, c: CAMP_TALKS_C, d: CAMP_TALKS_D, e: CAMP_TALKS_E, f: CAMP_TALKS_F };
export const CAMP_TALKS = Object.assign({}, ...Object.values(TALKS_BY_GROUP));

// 对白中是否带选项（含选项回复里的嵌套选项）
export const hasChoices = (lines) => (lines || []).some((l) => l.choices?.length);

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// 本关专属台词条目（按 ifFlag / unlessFlag 过滤；同一人物取第一条）
export function stageTalks(stageId, flagOk = () => true) {
  const out = new Map();
  for (const e of CAMP_TALKS[stageId] || []) if (flagOk(e) && !out.has(e.who)) out.set(e.who, e);
  return out;
}

// 选择一段台词：
//   1. 有本关专属台词且还没谈过：播放 lines（选项在这一次生效）；
//   2. 已谈过：有 again 播 again；lines 不带选项时重播 lines；否则改用通用台词（选项不能重复获得）；
//   3. 没有专属台词：通用台词（武将按 id、通用角色按名字），按关卡与对话次数轮换。
// 返回 { lines, specific }；specific 为真时调用方把 name 记入已对话。
export function pickTalk({ stageId, name, gid, talked = [], count = 0, flagOk = () => true }) {
  const e = stageTalks(stageId, flagOk).get(name);
  if (e && !talked.includes(name)) return { lines: e.lines, specific: true };
  if (e?.again) return { lines: e.again, specific: false };
  if (e && !hasChoices(e.lines)) return { lines: e.lines, specific: false };
  const pool = (gid && GENERIC_TALKS[gid]) || FOLK_TALKS[name] || [];
  if (!pool.length) return { lines: [{ who: name, text: gid ? '主公，末将随时听候差遣。' : '……' }], specific: false };
  return { lines: pool[(hash(`${stageId}:${name}`) + count) % pool.length], specific: false };
}
