// 子代理补充的武将外形（名字 -> 外形字段，格式见 src/characters.js）
// E 组（忠臣线 / 魔王复活）新出现的具名武将
export default {
  // ---------- 蜀汉 ----------
  严颜: { hat: 'helmet', beard: 'long', hairColor: '#e2ded6', brow: 0.3, weapon: 'glaive' },
  雷铜: { hat: 'helmet', beard: 'short', brow: 0.34, weapon: 'spear', horse: '#6a4a30' },
  吴兰: { hat: 'helmet', beard: 'mustache', brow: 0.3, weapon: 'spear', horse: '#8a6a4a' },
  孟达: { hat: 'helmet', beard: 'goatee', brow: 0.32, weapon: 'sword', horse: '#5a4a3a' },
  关兴: { hat: 'helmet', hatColor: '#2f8a4a', young: true, brow: 0.2, weapon: 'glaive', horse: '#8a5a30' },
  廖化: { hat: 'helmet', beard: 'short', brow: 0.26, weapon: 'glaive' },
  王甫: { hat: 'scholar', robe: true, robeColor: '#7a8a9a', beard: 'goatee', brow: 0.1 },
  张翼: { hat: 'helmet', beard: 'mustache', brow: 0.3, weapon: 'spear' },
  张嶷: { hat: 'helmet', beard: 'short', brow: 0.32, weapon: 'spear' },
  马良: { hat: 'scholar', robe: true, robeColor: '#a8b0b8', beard: 'mustache', hairColor: '#e2ded6', brow: 0.08 },
  吴懿: { hat: 'helmet', beard: 'goatee', brow: 0.26, weapon: 'spear', horse: '#7a5a3a' },
  王平: { hat: 'helmet', beard: 'short', brow: 0.24, weapon: 'spear' },
  李严: { hat: 'helmet', beard: 'goatee', brow: 0.3, weapon: 'sword', horse: '#6a5a4a' },
  马谡: { hat: 'scholar', robe: true, robeColor: '#8a9ab0', young: true, brow: 0.16, weapon: 'fan' },
  黄权: { hat: 'scholar', robe: true, robeColor: '#7a6a5a', beard: 'goatee', brow: 0.14 },
  徐庶: { hat: 'scholar', robe: true, robeColor: '#6a7a8a', beard: 'mustache', brow: 0.12, weapon: 'sword' },
  黄承彦: { hat: 'taoist', robe: true, robeColor: '#c8c0a8', beard: 'long', hairColor: '#e2ded6', brow: 0.04, weapon: 'staff' },
  // ---------- 南蛮 ----------
  孟获: { hat: 'band', hatColor: '#c8a040', beard: 'full', skin: 'dark', brow: 0.44, wide: true, weapon: 'club' },
  祝融: { hat: 'band', hatColor: '#c8281e', young: true, skin: '#c89070', brow: 0.2, weapon: 'twin' },
  兀突骨: { hat: 'band', hatColor: '#6a5a2a', beard: 'stubble', skin: '#7a8a5a', brow: 0.5, wide: true, weapon: 'club', armor: '#b89a5a' },
  // ---------- 孙吴 ----------
  潘璋: { hat: 'helmet', beard: 'full', brow: 0.4, weapon: 'glaive', horse: '#5a4030' },
  蒋钦: { hat: 'band', hatColor: '#3a6a8a', beard: 'short', brow: 0.34, weapon: 'spear' },
  朱然: { hat: 'helmet', young: true, brow: 0.22, weapon: 'sword' },
  马忠: { hat: 'cap', beard: 'stubble', brow: 0.36, weapon: 'bow' },
  诸葛瑾: { hat: 'scholar', robe: true, robeColor: '#8a7a6a', beard: 'long', wide: true, brow: 0.06 },
  孙策: { hat: 'helmet', hatColor: '#c8281e', young: true, brow: 0.3, cape: true, weapon: 'spear', horse: '#c89a5a' },
  // ---------- 魔王与亡灵 ----------
  魔王孔明: { hat: 'scholar', robe: true, robeColor: '#3a2448', beard: 'mustache', skin: '#b8aec8', hairColor: '#2a1a3a', brow: 0.5, cape: true, weapon: 'fan' },
  孔明幻影: { hat: 'scholar', robe: true, robeColor: '#c8d0e8', beard: 'mustache', skin: '#d8dcec', brow: 0.3, weapon: 'fan' },
  亡灵集合体: { hat: 'band', hatColor: '#3a2a4a', armor: '#4a3a5a', skin: '#9aa0b8', brow: 0.5, wide: true, weapon: 'halberd' },
};
