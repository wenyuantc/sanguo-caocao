// 天气（原版，见 research weather.md）：纯数据与纯函数，不依赖 Phaser（Node 可导入）
// 实际天气 = TABLE[天气类别][天气序号]；类别 0~4 由关卡决定，序号 0~5 每回合随机游走
export const WEATHERS = ['晴', '阴', '雨', '豪雨', '雪'];
export const SUN = 0, CLOUD = 1, RAIN = 2, STORM = 3, SNOW = 4;
// 雨、豪雨、雪为“恶劣天气”（火系不能用、青龙才能用）
export const isBad = (w) => w >= RAIN;

// 原版主程序的 5×6 天气表（research §2）
export const TABLE = [
  [SUN, SUN, SUN, CLOUD, RAIN, STORM],
  [SUN, SUN, SUN, SUN, CLOUD, RAIN],
  [SUN, CLOUD, RAIN, RAIN, STORM, STORM],
  [SUN, SUN, CLOUD, CLOUD, SNOW, SNOW],
  [SUN, CLOUD, SNOW, SNOW, SNOW, SNOW],
];
// 类别名：0~2 为原版编辑器名称；3、4 原版名称未能查证，按表内容自行命名
export const TYPE_NAME = ['普通', '晴好', '阴雨', '小雪', '大雪'];
export const IDX_COUNT = 6;

export const weatherOf = (type, idx) => TABLE[type][idx];
// 本类别可能出现的天气（按 WEATHERS 顺序）
export const possibleWeathers = (type) => [...new Set(TABLE[type])].sort((a, b) => a - b);

// 每回合变化（research §3，原版 0x449F91）：A = 0~7 随机，B = 序号 + 1；B > A 减 1，B < A 加 1；两端回绕
// 结果：序号 i 减 1 的概率 (i+1)/8，不变 1/8，加 1 的概率 (6−i)/8
export function stepWeather(idx, rnd = Math.random) {
  const a = Math.floor(rnd() * 8);
  let b = idx + 1;
  if (b > a) b -= 1;
  else if (b < a) b += 1;
  if (b === 0) return IDX_COUNT - 1;
  if (b === 7) return 0;
  return b - 1;
}

// 天气策略的新序号（research §6）：晴明 / 昙天从序号 0 往后找第一个晴 / 阴；豪雨从序号 5 往前找第一个恶劣天气
// 找不到时返回原序号
export const SET_WEATHER = { sun: SUN, cloud: CLOUD, rain: RAIN };
export function weatherSpellIdx(type, idx, kind) {
  const row = TABLE[type];
  if (kind === 'rain') {
    for (let i = IDX_COUNT - 1; i >= 0; i--) if (isBad(row[i])) return i;
    return idx;
  }
  const i = row.indexOf(SET_WEATHER[kind]);
  return i < 0 ? idx : i;
}

// 各关开局天气（research §4，原版 S 剧本编号 → 本项目关卡 id）：{ type 天气类别, start 起始序号 }
// 赤壁之战取原版“赤壁之战（前）”（S27，与后篇 S28 相同）；奸雄线 S32~S45、忠臣线 S46~S57 按关卡顺序对应
const W = (type, start) => ({ type, start });
export const STAGE_WEATHER = {
  yingchuan: W(1, 1), sishui: W(0, 1), hulao: W(0, 1), dongzhuo: W(2, 1), qingzhou: W(0, 1), xuzhou_fuchou: W(0, 1),
  puyang1: W(1, 1), puyang2: W(1, 1), puyang3: W(1, 1), xiandi: W(0, 1), zhangxiu1: W(1, 1), yuanshu: W(2, 4),
  zhangxiu2: W(0, 1), xuzhou_jiuyuan: W(0, 1), lvbu_baowei: W(4, 4),
  xuzhou_ruqin: W(0, 1), baima: W(0, 1), yanjin: W(0, 1), guandu: W(0, 1), cangting: W(0, 1), rangshan: W(0, 1),
  liyang: W(0, 1), yecheng: W(1, 1), nanpi: W(3, 1), liucheng: W(2, 2),
  bowangpo: W(1, 1), changban: W(0, 1), chibi: W(1, 1), chibi_tuwei: W(2, 2), hefei: W(1, 1), machao: W(4, 2),
  j_zhanglu: W(0, 1), j_xiaoyao: W(2, 2), j_ruxu: W(0, 1), j_dingjun: W(0, 1), j_hanshui: W(0, 1), j_xiegu: W(1, 1),
  j_fancheng: W(2, 3), j_yangping: W(0, 1), j_jiange: W(0, 1), j_chengdu: W(0, 1), j_baidi: W(0, 1), j_chibi2: W(0, 1),
  j_ruxu2: W(0, 1), j_jianye: W(0, 1),
  z_dingjun: W(0, 1), z_maicheng: W(0, 1), z_jiangling: W(0, 1), z_chibi2: W(0, 1), z_ruxu: W(0, 1), z_jianye: W(0, 1),
  z_yufupu: W(2, 2), z_baidi: W(0, 1), z_jiange: W(0, 1), z_yangping: W(0, 1), z_wuzhang1: W(2, 4), z_wuzhang2: W(1, 2),
};
// 没有原版对应的关卡（自行设计）：普通类别、序号 1（开局晴）
export const DEFAULT_WEATHER = W(0, 1);

// 关卡天气：关卡对象的 weather 字段优先，其次原版映射
export const stageWeather = (stage) => stage.weather || STAGE_WEATHER[stage.id] || DEFAULT_WEATHER;
export const validIdx = (v) => Number.isInteger(v) && v >= 0 && v < IDX_COUNT;
