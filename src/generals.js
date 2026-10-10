// 武将总表：全部可加入的我军武将（纯数据，校验脚本与出阵推导共用）
// { [id]: { name, mark? 姓名牌字（与关卡预设多数一致）, cls 默认兵种, bonus, gone?: 阵亡/离队剧情标记, joinAt?: 关卡id | { loyal, villain } } }
// 关卡数据中作为预设我军出现过的武将自动加入；joinAt 用于关卡里没有、原版却有的武将（到达该关即加入）。
// 不在本表中的我军单位（献帝 xiandi_emp、暂投曹营的关羽 guanyu）视为临时成员，按关卡原样出阵。
export const GENERALS = {
  caocao: { name: '曹操', cls: 'lord', bonus: { atk: 4, int: 6 } },
  xiahoudun: { name: '夏侯惇', mark: '惇', cls: 'cavalry', bonus: { atk: 6 } },
  xiahouyuan: { name: '夏侯渊', mark: '渊', cls: 'archer', bonus: { atk: 4, agi: 4 }, gone: 'j_xiahouyuan_dead' },
  caoren: { name: '曹仁', mark: '仁', cls: 'infantry', bonus: { def: 6 } },
  xunyu: { name: '荀彧', cls: 'strategist', bonus: { int: 8 } },
  yuejin: { name: '乐进', cls: 'infantry', bonus: { atk: 4 } },
  lidian: { name: '李典', cls: 'archer', bonus: { int: 4 } },
  caohong: { name: '曹洪', mark: '洪', cls: 'cavalry', bonus: { def: 4 } },
  chengyu: { name: '程昱', cls: 'strategist', bonus: { int: 6 } },
  yujin: { name: '于禁', cls: 'infantry', bonus: { def: 4, atk: 2 }, gone: 'j_yujin_captured' },
  dianwei: { name: '典韦', cls: 'fighter', bonus: { atk: 12, hp: 30 }, gone: 'dianwei_dead' },
  xuchu: { name: '许褚', cls: 'fighter', bonus: { atk: 10, hp: 30 } },
  xuhuang: { name: '徐晃', cls: 'infantry', bonus: { atk: 6 } },
  guojia: { name: '郭嘉', cls: 'strategist', bonus: { int: 10 }, gone: 'guojia_dead' },
  manchong: { name: '满宠', cls: 'healer', bonus: { int: 6 }, joinAt: 'zhangxiu1' },
  xunyou: { name: '荀攸', cls: 'strategist', bonus: { int: 8 } },
  zhangliao: { name: '张辽', mark: '辽', cls: 'cavalry', bonus: { atk: 8 } },
  jiaxu: { name: '贾诩', cls: 'strategist', bonus: { int: 10 } },
  diaochan: { name: '貂蝉', cls: 'fighter', bonus: { agi: 8 }, joinAt: 'xuzhou_ruqin' },
  zhanghe: { name: '张郃', mark: '郃', cls: 'cavalry', bonus: { atk: 6 } },
  caopi: { name: '曹丕', cls: 'archercav', bonus: { atk: 4, int: 4 }, joinAt: 'yecheng' },
  liuye: { name: '刘晔', cls: 'healer', bonus: { int: 6 } },
  simayi: { name: '司马懿', mark: '懿', cls: 'strategist', bonus: { int: 12 } },
  pangde: { name: '庞德', cls: 'cavalry', bonus: { atk: 10 }, gone: 'j_pangde_dead' },
  caozhang: { name: '曹彰', mark: '彰', cls: 'cavalry', bonus: { atk: 8 } },
  guanyu_z: { name: '关羽', cls: 'cavalry', bonus: { atk: 14, hp: 20 } },
};

export const isGeneral = (id) => Object.hasOwn(GENERALS, id);
