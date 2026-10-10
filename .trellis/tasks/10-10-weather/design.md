# 设计：天气系统

## 数据
- `src/weather.js`（纯数据与纯函数，Node 可导入）：
  - `WEATHERS = ['晴', '阴', '雨', '豪雨', '雪']`；`BAD = (w) => w >= 2`；
  - `TABLE[类别][序号]`（research §2）；
  - `stepWeather(idx, rnd)`：research §3 的随机游走算法，传入随机函数，便于测试；
  - `STAGE_WEATHER`：关卡 id → `{ type, start }`（research §4 映射）；也允许关卡对象写 `weather: { type, start }` 覆盖。
- `spells.js`：
  - 火系条目加 `noBadWeather: true`；
  - 新增 `qinglong / zhuque / xuanwu / baihu`，字段 `needGem`、`weather`；
  - 新增 `tiantan`（昙天）、`qingming`（晴明）、`haoyu`（豪雨），字段 `setWeather: 'cloud' | 'sun' | 'rain'`。

## 流程
- `BattleScene`：
  - `this.weatherIdx`：开局取关卡起始值，读档时取存档值；
  - 我军阶段开始时（第 1 回合除外）调用 `stepWeather`；实际天气改变时播放 `weatherFx` 并在日志提示；
  - `snapshot` 保存 `weatherIdx`。
- `logic.js`：新增 `spellUsable(spell, caster, weather, ctx)`，菜单、AI、预测共用；包含天气、禁咒、地形、宝玉的检查，返回 `{ ok, reason }`。
- `doSpell`：处理 `setWeather`，以及四神的特殊结算（多段雷击、全图随机状态、全体回复）。

## 画面
- `src/weatherFx.js`：
  - 雨、豪雨：斜线粒子，豪雨更密；雪：缓慢飘落的白点；阴：全屏半透明灰色遮罩；
  - 粒子层位于地图之上、HUD 之下，大地图子任务完成后跟随镜头视口；
  - 天气切换动画：遮罩与粒子渐变。
- `hud.js` 顶部栏：程序化绘制的天气小图标 + 名称。

## 兼容
- 旧存档的战斗快照没有 `weatherIdx` 时，取关卡起始值。
