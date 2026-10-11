// 关卡元信息（不依赖关卡数据，校验脚本也会单独引用）
// mapVersion：地图版本（1 = 旧版 18×13，2 = 按原版尺寸重做的大地图）；战斗中存档记录此值，读档时不一致则从本关开头重开
export const normalizeStage = (s) => ({
  ...s,
  mapVersion: s.mapVersion || 1,
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

// 各关地图尺寸 [列, 行]：取原版对应战场（research maps.md §3，注释为原版 Hm 编号）；mapVersion 2 的关卡必须一致
export const MAP_SIZES = {
  yingchuan: [20, 20], // 00 颍川之战
  sishui: [20, 20], // 01 汜水关之战
  hulao: [20, 20], // 02 虎牢关之战
  dongzhuo: [28, 20], // 03 董卓追击战
  qingzhou: [20, 20], // 04 青州黄巾讨伐战
  xuzhou_fuchou: [24, 24], // 05 徐州复仇战
  puyang1: [28, 24], // 06 濮阳之战
  puyang2: [32, 28], // 07 濮阳之战 贰
  puyang3: [24, 24], // 08 濮阳之战 叁
  xiandi: [20, 20], // 09 献帝救出战
  zhangxiu1: [24, 20], // 10 张绣讨伐战
  yuanshu: [24, 24], // 11 袁术讨伐战
  zhangxiu2: [28, 20], // 12 张绣讨伐战 贰
  xuzhou_jiuyuan: [20, 28], // 13 徐州救援战
  lvbu_baowei: [28, 28], // 14 吕布包围战
  xuzhou_ruqin: [32, 20], // 15 徐州入侵战
  baima: [20, 20], // 16 白马之战
  yanjin: [24, 24], // 17 延津之战
  guandu: [32, 32], // 18 官渡之战
  cangting: [20, 40], // 19 仓亭之战
  rangshan: [24, 28], // 20 穰山之战
  liyang: [20, 40], // 21 黎阳之战
  yecheng: [32, 20], // 22 邺城之战
  nanpi: [20, 20], // 23 南皮攻略战
  liucheng: [24, 24], // 24 柳城平定战
  bowangpo: [20, 32], // 25 博望坡之战
  changban: [32, 24], // 26 长阪坡之战
  chibi: [32, 40], // 27 赤壁之战
  chibi_tuwei: [36, 20], // 29 赤壁突围战
  hefei: [20, 20], // 30 合淝之战
  machao: [20, 32], // 31 马超迎击战
  // 奸雄线
  j_zhanglu: [28, 20], // 32 张鲁讨伐战
  j_xiaoyao: [20, 32], // 33 逍遥津之战
  j_ruxu: [24, 40], // 34 濡须口之战
  j_dingjun: [28, 36], // 35 定军山之战
  j_hanshui: [28, 28], // 36 汉水之战
  j_xiegu: [20, 24], // 37 斜谷之战
  j_fancheng: [24, 32], // 38 樊城救援战
  j_yangping: [24, 32], // 39 阳平关之战
  j_jiange: [36, 32], // 40 剑阁之战
  j_chengdu: [40, 28], // 41 成都入侵战
  j_baidi: [24, 24], // 42 白帝城之战
  j_chibi2: [32, 40], // 43 赤壁之战 贰
  j_ruxu2: [24, 40], // 44 濡须口之战
  j_jianye: [40, 24], // 45 建业入侵战
  // 忠臣线
  z_dingjun: [28, 36], // 46 定军山之战
  z_maicheng: [24, 24], // 47 麦城救援战
  z_jiangling: [20, 24], // 48 江陵之战
  z_chibi2: [32, 40], // 49 赤壁之战 贰
  z_ruxu: [24, 40], // 50 濡须口之战
  z_jianye: [40, 24], // 51 建业入侵战
  z_yufupu: [20, 24], // 52 鱼腹浦之战
  z_baidi: [24, 24], // 53 白帝城之战
  z_jiange: [40, 32], // 54 剑阁之战
  z_yangping: [24, 36], // 55 阳平关之战
  z_wuzhang1: [40, 40], // 56 五丈原之战
  z_wuzhang2: [40, 40], // 57 五丈原之战 贰
};
// 旧版地图尺寸（mapVersion 1）
export const LEGACY_MAP_SIZE = [18, 13];
