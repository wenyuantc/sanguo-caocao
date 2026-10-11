import { loadSettings, resolveRes } from './settings.js';

export const TILE = 48;
// 地图视口：屏幕上的地图区固定为 18 × 13 格；地图实际尺寸由关卡数据决定（map[0].length × map.length），超出部分滚动查看
export const VIEW_COLS = 18;
export const VIEW_ROWS = 13;
export const MAP_X = 0;
export const MAP_Y = 40;
export const VIEW_W = VIEW_COLS * TILE;
export const VIEW_H = VIEW_ROWS * TILE;
export const PANEL_X = VIEW_W;
export const WIDTH = 1200;
export const HEIGHT = MAP_Y + VIEW_H + 8;
export const FONT = '"STKaiti","KaiTi","Kaiti SC","PingFang SC","Microsoft YaHei",serif';
export const UI_FONT = '"PingFang SC","Microsoft YaHei","Heiti SC",sans-serif';

export const COLORS = {
  player: 0x2f6fd6,
  enemy: 0xc8352e,
  ally: 0x2f9a4a,
  gold: 0xd9b25f,
  panel: 0x1d140c,
  panelLight: 0x3a2a18,
  paper: 0xf1e3c2,
  ink: 0x2a1b0e,
};

export const FACTION_NAME = { player: '我军', enemy: '敌军', ally: '友军' };

// 高分辨率渲染：画布按 RES 倍尺寸创建，镜头放大 RES 倍，世界坐标保持不变（倍率取自游戏设置）
export const SETTINGS = loadSettings();
export const RES = resolveRes(SETTINGS);
export function hiDpi(scene) {
  scene.cameras.main.setZoom(RES).centerOn(WIDTH / 2, HEIGHT / 2);
  // 场景实例在重启之间复用，scene.events 的监听不会随 shutdown 清除：只注册一次，避免每次进入场景叠加一个（文字被重复重绘）
  if (scene.hiDpiBound) return;
  scene.hiDpiBound = true;
  scene.events.on('addedtoscene', (go) => { if (go.type === 'Text') go.setResolution(RES); });
}
