// 武将总表：全部可加入的我军武将（纯数据，校验脚本与出阵推导共用）
// { [id]: { name, mark? 姓名牌字（与关卡预设多数一致）, cls 兵种系列, gradeMod? 个人成长档修正, bonus, gone?: 阵亡/离队剧情标记, joinAt?: 关卡id | { loyal, villain } } }
// cls / gradeMod / bonus 以本表为准（覆盖关卡数据中的兵种与加成）；兵种与个人修正按原版（research class-tiers §6），
// bonus.hp / bonus.mp 为原版武将加成，其余五项加成沿用原有设定（agi 已改名 burst）。
// 关卡数据中作为预设我军出现过的武将自动加入；joinAt 用于关卡里没有、原版却有的武将（到达该关即加入）。
// 不在本表中的我军单位（献帝 xiandi_emp、暂投曹营的关羽 guanyu）视为临时成员，按关卡原样出阵。
export const GENERALS = {
  caocao: { name: '曹操', cls: 'lord', bonus: { hp: 2, atk: 4, int: 6 } },
  xiahoudun: { name: '夏侯惇', mark: '惇', cls: 'cavalry', gradeMod: { burst: 'A' }, bonus: { hp: 6, atk: 6 } },
  xiahouyuan: { name: '夏侯渊', mark: '渊', cls: 'archercav', bonus: { hp: 5, mp: 7, atk: 4, burst: 4 }, gone: 'j_xiahouyuan_dead' },
  caoren: { name: '曹仁', mark: '仁', cls: 'cavalry', gradeMod: { atk: 'A' }, bonus: { mp: 4, def: 6 } },
  xunyu: { name: '荀彧', cls: 'strategist', bonus: { hp: 6, mp: 1, int: 8 } },
  yuejin: { name: '乐进', cls: 'infantry', bonus: { hp: 8, mp: 5, atk: 4 } },
  lidian: { name: '李典', cls: 'infantry', gradeMod: { int: 'B' }, bonus: { hp: 4, mp: 7, int: 4 } },
  caohong: { name: '曹洪', mark: '洪', cls: 'infantry', gradeMod: { def: 'A' }, bonus: { mp: 3, def: 4 } },
  chengyu: { name: '程昱', cls: 'strategist', bonus: { hp: 1, mp: 3, int: 6 } },
  yujin: { name: '于禁', cls: 'archer', gradeMod: { burst: 'A' }, bonus: { hp: 6, mp: 4, def: 4, atk: 2 }, gone: 'j_yujin_captured' },
  dianwei: { name: '典韦', cls: 'fighter', bonus: { hp: 12, mp: 3, atk: 12 }, gone: 'dianwei_dead' },
  xuchu: { name: '许褚', cls: 'bandit', gradeMod: { def: 'A' }, bonus: { hp: 19, mp: 1, atk: 10 } },
  xuhuang: { name: '徐晃', cls: 'archer', gradeMod: { def: 'A' }, bonus: { hp: 13, mp: 1, atk: 6 } },
  guojia: { name: '郭嘉', cls: 'taoist', gradeMod: { morale: 'A' }, bonus: { mp: 6, int: 10 }, gone: 'guojia_dead' },
  manchong: { name: '满宠', cls: 'healer', bonus: { hp: 1, mp: -1, int: 6 }, joinAt: 'zhangxiu1' },
  xunyou: { name: '荀攸', cls: 'healer', gradeMod: { def: 'B' }, bonus: { hp: 2, int: 8 } },
  zhangliao: { name: '张辽', mark: '辽', cls: 'cavalry', gradeMod: { morale: 'A' }, bonus: { hp: 3, mp: 8, atk: 8 } },
  jiaxu: { name: '贾诩', cls: 'taoist', bonus: { hp: 8, int: 10 } },
  diaochan: { name: '貂蝉', cls: 'dancer', bonus: { hp: -3, mp: 15, burst: 8 }, joinAt: 'xuzhou_ruqin' },
  zhanghe: { name: '张郃', mark: '郃', cls: 'archercav', bonus: { hp: 2, mp: 6, atk: 6 } },
  caopi: { name: '曹丕', cls: 'archercav', gradeMod: { atk: 'A', def: 'A' }, bonus: { hp: 1, mp: 11, atk: 4, int: 4 }, joinAt: 'yecheng' },
  liuye: { name: '刘晔', cls: 'catapult', gradeMod: { atk: 'A' }, bonus: { hp: 1, mp: 12, int: 6 } },
  simayi: { name: '司马懿', mark: '懿', cls: 'mountstrat', gradeMod: { burst: 'C' }, bonus: { mp: 8, int: 12 } },
  pangde: { name: '庞德', cls: 'infantry', gradeMod: { atk: 'A' }, bonus: { hp: 10, mp: 1, atk: 10 }, gone: 'j_pangde_dead' },
  caozhang: { name: '曹彰', mark: '彰', cls: 'cavalry', bonus: { hp: 2, mp: -2, atk: 8 } },
  guanyu_z: { name: '关羽', cls: 'cavalry', gradeMod: { int: 'A' }, bonus: { hp: 7, mp: 2, atk: 14 } },
};

// 招募武将 / 小兵（registry.recruits 的镜像，结构同上：{ name, cls, bonus, kind }）：花名册判定与出阵推导共用。
// 只在新游戏（清空）、读档、招募成功时由 setRecruits 同步，避免把 registry 传遍各调用点
const RECRUITS = {};
export const setRecruits = (map) => {
  for (const id of Object.keys(RECRUITS)) delete RECRUITS[id];
  Object.assign(RECRUITS, map || {});
};
export const generalOf = (id) => (Object.hasOwn(GENERALS, id) ? GENERALS[id] : Object.hasOwn(RECRUITS, id) ? RECRUITS[id] : undefined);
export const isRecruit = (id) => Object.hasOwn(RECRUITS, id);
export const isGeneral = (id) => Object.hasOwn(GENERALS, id) || isRecruit(id);
