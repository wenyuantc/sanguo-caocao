// 武将登记表：名字 -> 外形字段（战场小人与头像共用）
// hat: helmet|crown|feather|cap|scholar|turban|taoist|headscarf|emperor|band
// beard: mustache|goatee|short|full|long|stubble    brow: 0~0.5 眉毛凶狠程度
// weapon: sword|spear|halberd|glaive|axe|twin|fist|bow|fan|staff|club|none（缺省按兵种）
// horse: 马的颜色；armor: 盔甲颜色（覆盖阵营色）；hatColor: 盔/巾颜色
// skin: 'red'|'dark'|'#hex'；hairColor: 发须颜色；young/wide：年轻 / 宽脸；robe/robeColor/cape
import extraA from './characters/extra_a.js';
import extraB from './characters/extra_b.js';
import extraC from './characters/extra_c.js';
import extraD from './characters/extra_d.js';
import extraE from './characters/extra_e.js';
import extraF from './characters/extra_f.js';

const GREY = '#8a847c', WHITE_HAIR = '#e2ded6';

const BASE = {
  // ---------- 曹营 ----------
  曹操: { hat: 'crown', beard: 'goatee', brow: 0.18, cape: true, horse: '#3c3530' },
  夏侯惇: { hat: 'helmet', beard: 'mustache', brow: 0.3, horse: '#e8e0d0' },
  夏侯渊: { hat: 'cap', beard: 'mustache', brow: 0.2, horse: '#8a5a2a' },
  曹仁: { hat: 'helmet', beard: 'short', brow: 0.15 },
  曹洪: { hat: 'helmet', beard: 'short', brow: 0.25, horse: '#8a5a30' },
  曹彰: { hat: 'helmet', beard: 'short', brow: 0.35, hairColor: '#c8a040' },
  曹丕: { hat: 'crown', young: true, brow: 0.2, cape: true },
  荀彧: { hat: 'scholar', robe: true, young: true, brow: 0.05 },
  荀攸: { hat: 'scholar', robe: true, beard: 'goatee', brow: 0.08 },
  郭嘉: { hat: 'scholar', robe: true, robeColor: '#b8c8e8', young: true, brow: 0.1 },
  程昱: { hat: 'scholar', robe: true, beard: 'long', hairColor: GREY, brow: 0.22 },
  贾诩: { hat: 'scholar', robe: true, robeColor: '#8a7aa8', beard: 'goatee', brow: 0.3 },
  刘晔: { hat: 'scholar', robe: true, young: true, brow: 0.12 },
  司马懿: { hat: 'scholar', robe: true, robeColor: '#5a4a7a', beard: 'goatee', brow: 0.38 },
  满宠: { hat: 'helmet', beard: 'goatee', brow: 0.3 },
  典韦: { hat: 'helmet', beard: 'full', brow: 0.4, wide: true, weapon: 'halberd' },
  许褚: { hat: 'band', hatColor: '#b8302a', beard: 'stubble', brow: 0.42, wide: true, weapon: 'fist' },
  于禁: { hat: 'helmet', beard: 'mustache', brow: 0.25 },
  乐进: { hat: 'helmet', beard: 'short', brow: 0.32 },
  李典: { hat: 'helmet', young: true, brow: 0.1 },
  张辽: { hat: 'helmet', hatColor: '#3a3a48', beard: 'goatee', brow: 0.3, weapon: 'halberd', horse: '#5a4030' },
  徐晃: { hat: 'helmet', beard: 'short', brow: 0.36, weapon: 'axe', horse: '#6a4a30' },
  张郃: { hat: 'helmet', young: true, brow: 0.26, weapon: 'spear', horse: '#7a5a3a' },
  庞德: { hat: 'helmet', beard: 'full', brow: 0.42, weapon: 'glaive', horse: '#4a3a2a' },
  // ---------- 刘备军 ----------
  刘备: { hat: 'crown', beard: 'goatee', brow: 0.05, cape: true, weapon: 'twin', horse: '#ece4d0' },
  关羽: { hat: 'headscarf', hatColor: '#2f8a4a', armor: '#2f8a4a', beard: 'long', skin: 'red', brow: 0.32, weapon: 'glaive', horse: '#b83020' },
  张飞: { hat: 'helmet', hatColor: '#3a3430', beard: 'full', skin: 'dark', brow: 0.5, wide: true, weapon: 'spear', horse: '#2a2420' },
  赵云: { hat: 'helmet', hatColor: '#e8e8ec', armor: '#e4e6ea', young: true, brow: 0.2, weapon: 'spear', horse: '#f2f0ea' },
  诸葛亮: { hat: 'scholar', robe: true, robeColor: '#f0eee6', beard: 'mustache', brow: 0.1, weapon: 'fan' },
  庞统: { hat: 'scholar', robe: true, robeColor: '#8a7a5a', wide: true, skin: '#c89870', beard: 'short', brow: 0.22 },
  法正: { hat: 'scholar', robe: true, beard: 'goatee', brow: 0.3 },
  黄忠: { hat: 'helmet', beard: 'long', hairColor: WHITE_HAIR, brow: 0.3, weapon: 'glaive', horse: '#8a6a4a' },
  魏延: { hat: 'helmet', beard: 'full', brow: 0.46, weapon: 'glaive', horse: '#4a3a30' },
  马超: { hat: 'helmet', hatColor: '#d8dce4', armor: '#cfd4dc', young: true, brow: 0.3, cape: true, weapon: 'spear', horse: '#f2f0ea' },
  马岱: { hat: 'helmet', hatColor: '#c8ccd4', young: true, brow: 0.22, weapon: 'spear' },
  姜维: { hat: 'helmet', young: true, brow: 0.2, weapon: 'spear', horse: '#8a6a4a' },
  关平: { hat: 'helmet', young: true, brow: 0.15, weapon: 'glaive' },
  周仓: { hat: 'band', hatColor: '#3a3430', beard: 'full', skin: 'dark', brow: 0.45, wide: true, weapon: 'glaive' },
  // ---------- 孙吴 ----------
  孙坚: { hat: 'helmet', beard: 'short', brow: 0.2, cape: true, horse: '#c89a5a' },
  孙权: { hat: 'crown', beard: 'full', hairColor: '#8a3a5a', brow: 0.2, cape: true },
  周瑜: { hat: 'helmet', young: true, brow: 0.15, cape: true, weapon: 'sword' },
  鲁肃: { hat: 'scholar', robe: true, beard: 'short', brow: 0.08 },
  吕蒙: { hat: 'helmet', beard: 'mustache', brow: 0.3 },
  陆逊: { hat: 'scholar', robe: true, young: true, brow: 0.12 },
  黄盖: { hat: 'helmet', beard: 'long', hairColor: GREY, brow: 0.36 },
  程普: { hat: 'helmet', beard: 'long', hairColor: GREY, brow: 0.3 },
  甘宁: { hat: 'band', hatColor: '#c8281e', beard: 'short', brow: 0.42, weapon: 'glaive' },
  太史慈: { hat: 'helmet', beard: 'short', brow: 0.3, weapon: 'spear' },
  张昭: { hat: 'scholar', robe: true, beard: 'long', hairColor: WHITE_HAIR, brow: 0.15 },
  // ---------- 群雄 ----------
  张角: { hat: 'taoist', robe: true, robeColor: '#d6ae36', beard: 'long', brow: 0.3 },
  张宝: { hat: 'taoist', robe: true, robeColor: '#d6ae36', beard: 'long', brow: 0.3 },
  张梁: { hat: 'turban', beard: 'full', brow: 0.4, wide: true },
  华雄: { hat: 'helmet', beard: 'full', brow: 0.45, wide: true, horse: '#4a4038' },
  吕布: { hat: 'feather', young: true, brow: 0.35, cape: true, weapon: 'halberd', horse: '#b8241a' },
  董卓: { hat: 'crown', beard: 'full', brow: 0.42, wide: true, cape: true },
  李傕: { hat: 'helmet', beard: 'full', brow: 0.42 },
  郭汜: { hat: 'helmet', beard: 'short', brow: 0.42 },
  李儒: { hat: 'scholar', robe: true, beard: 'goatee', brow: 0.36 },
  徐荣: { hat: 'helmet', beard: 'short', brow: 0.32 },
  陈宫: { hat: 'scholar', robe: true, beard: 'long', brow: 0.1 },
  李肃: { hat: 'scholar', robe: true, beard: 'mustache', brow: 0.25 },
  高顺: { hat: 'helmet', beard: 'short', brow: 0.36 },
  张绣: { hat: 'helmet', young: true, brow: 0.3, weapon: 'spear' },
  胡车儿: { hat: 'band', hatColor: '#6a4a2a', beard: 'full', skin: 'dark', wide: true, brow: 0.45, weapon: 'fist' },
  袁术: { hat: 'emperor', beard: 'goatee', brow: 0.3, cape: true },
  纪灵: { hat: 'helmet', beard: 'full', brow: 0.4, weapon: 'glaive' },
  袁绍: { hat: 'crown', beard: 'short', brow: 0.2, cape: true, armor: '#c8a040' },
  颜良: { hat: 'helmet', beard: 'full', brow: 0.46, wide: true, weapon: 'glaive' },
  文丑: { hat: 'helmet', beard: 'full', brow: 0.46, weapon: 'spear' },
  淳于琼: { hat: 'helmet', beard: 'full', brow: 0.22 },
  审配: { hat: 'scholar', robe: true, beard: 'goatee', brow: 0.3 },
  沮授: { hat: 'scholar', robe: true, beard: 'long', brow: 0.15 },
  袁谭: { hat: 'helmet', young: true, brow: 0.3 },
  袁尚: { hat: 'helmet', young: true, brow: 0.22, cape: true },
  蹋顿: { hat: 'band', hatColor: '#7a5a3a', beard: 'full', skin: '#d8a070', brow: 0.42 },
  张鲁: { hat: 'taoist', robe: true, robeColor: '#d6ae36', beard: 'long', brow: 0.15 },
  刘璋: { hat: 'crown', beard: 'goatee', brow: 0.08 },
  献帝: { hat: 'emperor', young: true, robe: true, robeColor: '#e8c040', brow: 0.02 },
};

// 兵种登记：敌军 / 友军按名字指定原版兵种系列（覆盖关卡数据中的兵种，同时影响外形）
// 我军武将的兵种以 generals.js 为准；与总表同名的敌将（如张辽、张郃、贾诩）也沿用总表兵种（见 logic.roleOf）
export const CLASS_BY_NAME = {
  吕布: 'xiliang', 马超: 'xiliang', 马腾: 'xiliang', 马岱: 'xiliang', 董卓: 'xiliang', 华雄: 'xiliang', 高顺: 'xiliang',
  周瑜: 'dudu', 陆逊: 'dudu',
  诸葛亮: 'sorcerer', 孔明幻影: 'sorcerer', 魔王孔明: 'sorcerer',
  甘宁: 'pirate', 周泰: 'pirate',
  袁绍: 'lord', 刘备: 'lord', 孙坚: 'lord', 孙策: 'lord', 孙权: 'lord',
  献帝: 'emperor', 粮草车: 'transport',
};

export const CHARACTERS = { ...BASE, ...extraA, ...extraB, ...extraC, ...extraD, ...extraE, ...extraF };
export const getCharacter = (name) => CHARACTERS[name];

export function hexShade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('')}`;
}

// 肤色解析：返回 [主色, 暗部]
const SKINS = { red: ['#d8664a', '#a83a26'], dark: ['#9a6a48', '#6a4228'] };
export function skinOf(look) {
  if (!look?.skin) return null;
  return SKINS[look.skin] || [look.skin, hexShade(look.skin, 0.72)];
}

// 盔甲颜色覆盖阵营色
export const armorPalette = (hex) => ({ a: hex, d: hexShade(hex, 0.45), l: hexShade(hex, 1.5) });
