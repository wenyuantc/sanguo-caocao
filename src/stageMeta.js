// 关卡元信息（不依赖关卡数据，校验脚本也会单独引用）
export const normalizeStage = (s) => ({
  ...s,
  title: s.name,
  events: s.events || [],
  victory: Array.isArray(s.victory) ? s.victory : [s.victory],
});

// 全部计划中的关卡 id（与 docs/STAGE_GUIDE.md 一致）
export const PLANNED_IDS = [
  'yingchuan', 'sishui', 'hulao', 'dongzhuo', 'qingzhou', 'xuzhou_fuchou', 'puyang1', 'puyang2', 'puyang3',
  'xiandi', 'zhangxiu1', 'yuanshu', 'zhangxiu2', 'xuzhou_jiuyuan', 'lvbu_baowei',
  'xuzhou_ruqin', 'baima', 'yanjin', 'guandu', 'cangting', 'rangshan', 'liyang', 'yecheng', 'nanpi', 'liucheng',
  'bowangpo', 'changban', 'chibi', 'chibi_tuwei', 'hefei', 'machao',
  'z_dingjun', 'z_maicheng', 'z_jiangling', 'z_chibi2', 'z_ruxu', 'z_jianye', 'z_yufupu', 'z_baidi', 'z_jiange', 'z_yangping', 'z_wuzhang1', 'z_wuzhang2',
  'j_zhanglu', 'j_xiaoyao', 'j_ruxu', 'j_dingjun', 'j_hanshui', 'j_xiegu', 'j_fancheng', 'j_yangping', 'j_jiange', 'j_chengdu', 'j_baidi', 'j_chibi2', 'j_ruxu2', 'j_jianye',
];

export const FIRST_STAGE = 'yingchuan';
export const ENDINGS = { END_LOYAL: 'loyal', END_VILLAIN: 'villain' };
// 旧存档用数字下标记录关卡
export const LEGACY = ['yingchuan', 'sishui', 'puyang1'];
