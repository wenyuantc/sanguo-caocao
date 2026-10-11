import { sequencer } from './sequencer.js';
import { SONGS } from './songs.js';

// 配乐接入：场景只调用 playMusic(场合或曲目 id)。同一首正在播放（或等待开始）时不会从头重播。
// 场合与原版用曲习惯对应（research/audio.md §3）；我军 / 友军 / 敌军阶段不换曲，危急时切换危急曲。

// 场合 → 曲目 id
export const OCCASION = {
  title: 'title', // 标题
  story: 'story', // 剧情、中国地图（原版“悠久”）
  camp: 'camp', // 军营 / 营中（原版“本阵”）
  council: 'council', // 战前军议、整备（原版“阴谋”）
  battle: 'battle2', // 未登记关卡的战斗曲
  crisis: 'crisis', // 危急
  duel: 'duel', // 单挑
  victory: 'victory', // 胜利（原版“凯旋”）
  defeat: 'defeat', // 败北
  ending: 'ending', // 结局
};

// 每关战斗曲：按原版各关 S 剧本开场最后指定的战斗曲（research §3.1）归并为四类——
//   暴走 / 急袭 → battle1《疾风》；霸道 / 互角 → battle2《霸道》；舌战 → battle3《对垒》；大战 / 暗云 → decisive《大战》
const ORIGINAL = {
  yingchuan: '舌戦', sishui: '暴走', hulao: '急襲', dongzhuo: '互角', qingzhou: '暴走', xuzhou_fuchou: '覇道',
  puyang1: '急襲', puyang2: '舌戦', puyang3: '急襲', xiandi: '覇道', zhangxiu1: '舌戦', yuanshu: '互角',
  zhangxiu2: '暴走', xuzhou_jiuyuan: '覇道', lvbu_baowei: '急襲', xuzhou_ruqin: '覇道', baima: '暴走', yanjin: '互角',
  guandu: '大戦', cangting: '暴走', rangshan: '覇道', liyang: '互角', yecheng: '急襲', nanpi: '覇道', liucheng: '暴走',
  bowangpo: '舌戦', changban: '急襲', chibi: '大戦', chibi_tuwei: '舌戦', hefei: '互角', machao: '急襲',
  // 奸雄线
  j_zhanglu: '覇道', j_xiaoyao: '互角', j_ruxu: '暴走', j_dingjun: '舌戦', j_hanshui: '互角', j_xiegu: '舌戦',
  j_fancheng: '暴走', j_yangping: '急襲', j_jiange: '暴走', j_chengdu: '覇道', j_baidi: '互角', j_chibi2: '大戦',
  j_ruxu2: '覇道', j_jianye: '大戦',
  // 忠臣线
  z_dingjun: '舌戦', z_maicheng: '覇道', z_jiangling: '急襲', z_chibi2: '大戦', z_ruxu: '互角', z_jianye: '覇道',
  z_yufupu: '舌戦', z_baidi: '暴走', z_jiange: '急襲', z_yangping: '覇道', z_wuzhang1: '大戦', z_wuzhang2: '暗雲',
};
const KIND = { 暴走: 'battle1', 急襲: 'battle1', 覇道: 'battle2', 互角: 'battle2', 舌戦: 'battle3', 大戦: 'decisive', 暗雲: 'decisive' };
export const BATTLE_MUSIC = Object.fromEntries(Object.entries(ORIGINAL).map(([id, k]) => [id, KIND[k]]));

export const battleMusic = (stageId) => BATTLE_MUSIC[stageId] || OCCASION.battle;

const songOf = (name) => SONGS[name] || SONGS[OCCASION[name]];

// 播放场合或曲目；同一首正在播放时不重播。返回是否切换了曲目
export function playMusic(name, opts) {
  const song = songOf(name);
  if (!song) { console.warn('未知配乐', name); return false; }
  if (sequencer.songId === song.id) return false;
  try {
    sequencer.play(song, opts);
  } catch (e) {
    console.error('配乐出错', name, e);
    return false;
  }
  return true;
}

export function stopMusic(fadeOut = 1.2) {
  sequencer.stop(fadeOut);
}

export const currentMusic = () => sequencer.songId;

// 危急判定（纯函数）：曹操或胜利条件 / 受保护的关键我军单位兵力低于 ENTER（解除要回到 LEAVE 以上，避免来回切换），
// 或离回合上限只剩 TURNS_LEFT 回合以内（有坚守胜利条件的关卡不算：坚守判定先于时限，撑到上限即胜利）。prev 为上一次的判定结果
const ENTER = 0.3, LEAVE = 0.5, TURNS_LEFT = 2;
export function isCrisis({ stage, units, turn }, prev = false) {
  const keys = new Set(['caocao', ...(stage.protect || [])]);
  for (const c of stage.victory || []) if (c.type === 'reach' && c.unit && c.unit !== 'any') keys.add(c.unit);
  const low = units.some((u) => u.alive && u.faction === 'player' && keys.has(u.id) && u.stats?.hp
    && u.hp / u.stats.hp < (prev ? LEAVE : ENTER));
  if (low) return true;
  const hold = (stage.victory || []).some((c) => c.type === 'survive' && c.turns <= stage.turns);
  return !hold && stage.turns > 0 && stage.turns - turn < TURNS_LEFT;
}
