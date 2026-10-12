// 金手指：开关存在游戏设置里（不进存档）；只作用于我军（player），友军与敌军不受影响
import { SETTINGS } from './config.js';

// 总开关打开且分项（k 缺省时只看总开关）打开
export const cheatOn = (k) => !!SETTINGS.cheat && (!k || !!SETTINGS[k]);
// 我方无敌：我军单位受到的伤害为 0
export const godOf = (d) => d?.faction === 'player' && cheatOn('cheatGod');
// 我方秒杀：我军攻击 / 伤害策略命中敌军即击破
export const killBy = (a, d) => a?.faction === 'player' && d?.faction === 'enemy' && cheatOn('cheatKill');

// 本周目永久标记为金手指进度（进入战斗 / 营中，或在战役中打开开关时调用）
export function markCheat(scene) {
  if (SETTINGS.cheat) scene.registry.set('cheated', true);
}

// 伤害修正：a 攻击方、d 受击方，返回最终伤害
export function cheatDmg(a, d, dmg) {
  if (godOf(d)) return 0;
  if (killBy(a, d)) return d.hp;
  return dmg;
}
