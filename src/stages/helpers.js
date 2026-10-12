// 关卡数据辅助：P 我军 / E 敌军 / A 友军
// extra 常用字段：leader 主将、ai('aggressive'|'hold')、bonus 属性加成、mark 棋子上的字、focus 优先攻击目标 id
// spellMult 策略伤害倍率（缺省 1）、items 友军自带补给（缺省 ALLY_ITEMS，由 AI 使用，不占我军军需）
export const P = (id, name, cls, lvl, x, y, extra = {}) => ({ id, name, cls, lvl, x, y, faction: 'player', ...extra });
export const E = (id, name, cls, lvl, x, y, extra = {}) => ({ id, name, cls, lvl, x, y, faction: 'enemy', ai: 'aggressive', ...extra });
export const A = (id, name, cls, lvl, x, y, extra = {}) => ({ id, name, cls, lvl, x, y, faction: 'ally', ai: 'aggressive', ...extra });
