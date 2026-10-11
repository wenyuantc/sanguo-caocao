// 剧情场景的静态定义（纯数据 + 纯函数，不依赖 Phaser，校验脚本可直接导入）
// 场景脚本 = 按顺序执行的指令数组，每条指令是一个普通对象，类型由第一个出现的指令键决定（见 TYPES）。

// ---------- 场景坐标 ----------
// 人物站位用等角格子坐标 [a, b]（外场景也按同一地面网格摆放）：a 增大 → 向右下，b 增大 → 向左下。
// 屏幕坐标（1200×672 世界坐标）：x = 600 + (a − b) × 28，y = 150 + (a + b) × 14。
// 地板（内场景）为 0~20 的菱形：上角 (0,0)、右角 (20,0)、左角 (0,20)、下角 (20,20)；站位允许 −6~26（场外入场 / 离场）。
export const ISO = { ox: 600, oy: 150, dx: 28, dy: 14, size: 20, min: -6, max: 26 };
export const isoToScreen = (a, b) => ({ x: ISO.ox + (a - b) * ISO.dx, y: ISO.oy + (a + b) * ISO.dy });
export const inStage = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && v >= ISO.min && v <= ISO.max);

// ---------- 背景 ----------
// kind：outer 外场景（远景透视）/ inner 内场景（等角）/ map 中国地图
export const BACKGROUNDS = {
  field: { kind: 'outer', name: '野外' },
  citygate: { kind: 'outer', name: '城下' },
  river: { kind: 'outer', name: '河畔' },
  mountain: { kind: 'outer', name: '山路' },
  palace: { kind: 'inner', name: '宫殿' },
  tent: { kind: 'inner', name: '军营大帐' },
  hall: { kind: 'inner', name: '公馆 / 相府' },
  street: { kind: 'inner', name: '城内街道' },
  camp: { kind: 'inner', name: '军营' },
  china: { kind: 'map', name: '中国地图' },
};
// 时段（外场景 / 内场景通用）
export const TIMES = ['day', 'dusk', 'night'];
// 中国地图视野（bg: 'china' 的 view）：center 为经纬度，zoom 为放大倍数
export const MAP_VIEWS = {
  all: { center: [111.7, 31.2], zoom: 1 },
  north: { center: [115, 37], zoom: 1.7 },
  central: { center: [112.5, 33.3], zoom: 1.7 },
  south: { center: [115, 30.5], zoom: 1.7 },
  west: { center: [107, 32], zoom: 1.7 },
  // 中原近景：洛阳—官渡—白马一带（汜水关、虎牢关、荥阳、陈留等城市相距很近）
  zhongyuan: { center: [113.8, 35.0], zoom: 3 },
};

// 地图坐标：中国地图整图 1200×672（view = all 时等于屏幕坐标），由经纬度换算
export const lonLatToMap = (lon, lat) => ({ x: (lon - 99) * 46 + 30, y: (42.2 - lat) * 30.5 });

// 地点（城市名或地图坐标 [x, y]）→ 地图坐标
export const mapPoint = (p) => (typeof p === 'string' ? lonLatToMap(...CITIES[p]) : { x: p[0], y: p[1] });
// 视野投影：地图坐标 → 屏幕坐标（视野中心夹在地图范围内，放大后不露出地图边缘）
export function mapProjector(view = 'all') {
  const v = MAP_VIEWS[view] || MAP_VIEWS.all;
  const c = lonLatToMap(...v.center);
  const z = v.zoom, hw = 600 / z, hh = 336 / z;
  const cx = Math.min(Math.max(c.x, hw), 1200 - hw), cy = Math.min(Math.max(c.y, hh), 672 - hh);
  const fn = (mx, my) => ({ x: (mx - cx) * z + 600, y: (my - cy) * z + 336 });
  fn.zoom = z;
  return fn;
}

// 城市 / 地点：经纬度（大致位置），地图标记与行军箭头可直接写城市名
export const CITIES = {
  洛阳: [112.4, 34.7], 长安: [108.9, 34.3], 许昌: [113.8, 34.0], 邺: [114.4, 36.3], 陈留: [114.6, 34.8], 谯: [115.8, 33.9],
  颍川: [113.3, 34.3], 汜水关: [113.0, 34.9], 虎牢关: [113.5, 34.95], 荥阳: [113.6, 34.6], 青州: [118.5, 36.7], 濮阳: [115.0, 35.7],
  徐州: [117.2, 34.3], 下邳: [117.9, 34.0], 小沛: [116.9, 34.7], 寿春: [116.8, 32.6], 宛: [112.5, 33.0], 汝南: [114.4, 33.0],
  白马: [114.7, 35.6], 延津: [114.2, 35.3], 官渡: [114.0, 34.7], 仓亭: [115.8, 36.1], 黎阳: [114.4, 35.75], 南皮: [116.7, 38.0],
  柳城: [120.4, 41.6], 蓟: [116.4, 39.9], 襄阳: [112.1, 32.0], 樊城: [112.2, 32.15], 新野: [112.4, 32.5], 博望坡: [112.8, 33.2],
  长坂: [111.8, 30.8], 江陵: [112.2, 30.3], 麦城: [111.7, 30.95], 赤壁: [113.9, 29.9], 华容: [112.6, 29.5], 合肥: [117.3, 31.8],
  濡须口: [117.9, 31.3], 建业: [118.8, 32.0], 吴: [120.6, 31.3], 成都: [104.1, 30.7], 汉中: [107.0, 33.1], 阳平关: [106.3, 33.2],
  定军山: [106.7, 32.95], 汉水: [107.6, 32.9], 斜谷: [107.6, 34.1], 剑阁: [105.5, 32.2], 白帝城: [109.5, 31.05], 鱼腹浦: [109.2, 31.2],
  五丈原: [107.6, 34.4], 潼关: [110.3, 34.6], 襄平: [123.2, 41.3],
};
// 地图上始终标出的主要城市（其余城市只在被标记 / 箭头引用时显示）
export const MAJOR_CITIES = ['洛阳', '长安', '许昌', '邺', '成都', '建业', '襄阳', '江陵', '汉中', '寿春', '徐州'];

// 各关地点：city 为地图上的位置，place 为场景地点名
export const STAGE_PLACE = {
  yingchuan: { city: '颍川', place: '颍川' }, sishui: { city: '汜水关', place: '汜水关' }, hulao: { city: '虎牢关', place: '虎牢关' },
  dongzhuo: { city: '荥阳', place: '荥阳' }, qingzhou: { city: '青州', place: '青州' }, xuzhou_fuchou: { city: '徐州', place: '徐州郊外' },
  puyang1: { city: '濮阳', place: '濮阳郊外' }, puyang2: { city: '濮阳', place: '濮阳城' }, puyang3: { city: '濮阳', place: '濮阳' },
  xiandi: { city: '洛阳', place: '洛阳近郊' }, zhangxiu1: { city: '宛', place: '宛城' }, yuanshu: { city: '寿春', place: '寿春郊外' },
  zhangxiu2: { city: '宛', place: '宛郊外' }, xuzhou_jiuyuan: { city: '小沛', place: '小沛' }, lvbu_baowei: { city: '下邳', place: '下邳郊外' },
  xuzhou_ruqin: { city: '徐州', place: '徐州' }, baima: { city: '白马', place: '白马' }, yanjin: { city: '延津', place: '延津' },
  guandu: { city: '官渡', place: '官渡' }, cangting: { city: '仓亭', place: '仓亭' }, rangshan: { city: '汝南', place: '穰山' },
  liyang: { city: '黎阳', place: '黎阳郊外' }, yecheng: { city: '邺', place: '邺城' }, nanpi: { city: '南皮', place: '南皮郊外' },
  liucheng: { city: '柳城', place: '柳城近郊' }, bowangpo: { city: '博望坡', place: '博望坡' }, changban: { city: '长坂', place: '长坂坡' },
  chibi: { city: '赤壁', place: '乌林' }, chibi_tuwei: { city: '华容', place: '华容道' }, hefei: { city: '合肥', place: '合肥' },
  machao: { city: '潼关', place: '渭水' },
  j_zhanglu: { city: '汉中', place: '汉中' }, j_xiaoyao: { city: '合肥', place: '逍遥津' }, j_ruxu: { city: '濡须口', place: '濡须口' },
  j_dingjun: { city: '定军山', place: '定军山' }, j_hanshui: { city: '汉水', place: '汉水' }, j_xiegu: { city: '斜谷', place: '斜谷' },
  j_fancheng: { city: '樊城', place: '樊城' }, j_yangping: { city: '阳平关', place: '阳平关' }, j_jiange: { city: '剑阁', place: '剑阁' },
  j_chengdu: { city: '成都', place: '成都郊外' }, j_baidi: { city: '白帝城', place: '白帝城' }, j_chibi2: { city: '赤壁', place: '赤壁' },
  j_ruxu2: { city: '濡须口', place: '濡须口' }, j_jianye: { city: '建业', place: '建业' },
  z_dingjun: { city: '定军山', place: '定军山' }, z_maicheng: { city: '麦城', place: '麦城' }, z_jiangling: { city: '江陵', place: '江陵' },
  z_chibi2: { city: '赤壁', place: '赤壁' }, z_ruxu: { city: '濡须口', place: '濡须口' }, z_jianye: { city: '建业', place: '建业' },
  z_yufupu: { city: '鱼腹浦', place: '鱼腹浦' }, z_baidi: { city: '白帝城', place: '白帝城' }, z_jiange: { city: '剑阁', place: '剑阁' },
  z_yangping: { city: '阳平关', place: '阳平关' }, z_wuzhang1: { city: '五丈原', place: '五丈原' }, z_wuzhang2: { city: '五丈原', place: '五丈原' },
};

// ---------- 人物 ----------
// 朝向：dr 正面朝右下、dl 正面朝左下（镜像）、ur 背面朝右上、ul 背面朝左上（镜像）；right/left/down/up 为别名
export const DIRS = { dr: 'dr', dl: 'dl', ur: 'ur', ul: 'ul', right: 'dr', left: 'dl', down: 'dr', up: 'ur' };
// 动作：frames 为帧数，loop 为循环播放（毫秒 / 帧），once 为播放一次后停在最后一帧
export const POSES = {
  stand: { name: '站立', frames: 1 },
  walk: { name: '行走', frames: 3, seq: [0, 1, 0, 2], loop: 140 },
  bow: { name: '作揖', frames: 1 },
  raise: { name: '双手举起', frames: 1 },
  raise1: { name: '单手举起', frames: 1 },
  reach: { name: '伸手', frames: 1 },
  sit: { name: '跪坐', frames: 1 },
  kneel: { name: '单膝跪地', frames: 1 },
  sitcry: { name: '跪坐哭泣', frames: 2, loop: 320 },
  cry: { name: '哭泣', frames: 2, loop: 320 },
  fall: { name: '倒下', frames: 1 },
  swing: { name: '挥剑', frames: 2, once: 180 },
  bound: { name: '被缚', frames: 1 },
  excite: { name: '激动 / 脸红', frames: 2, loop: 200 },
};
// 表情气泡
export const EMOTES = {
  shock: '惊', anger: '怒', joy: '喜', sweat: '汗', question: '疑问', dots: '无语',
};
export const SIDES = ['player', 'enemy', 'ally'];

// ---------- 指令 ----------
// 指令类型按此顺序判定（{ actor, at, face } 是出场而不是转向，{ move, wait: false } 是移动而不是等待）
export const TYPES = [
  'bg', 'chapter', 'place', 'actor', 'exit', 'move', 'face', 'act', 'emote', 'say', 'narr',
  'wait', 'join', 'fade', 'camera', 'shake', 'map', 'arrow', 'clear',
];
export const typeOf = (cmd) => TYPES.find((k) => cmd && Object.hasOwn(cmd, k)) || null;

const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number');
const mapPointOk = (p) => (typeof p === 'string' ? Object.hasOwn(CITIES, p) : isPoint(p) && p[0] >= 0 && p[0] <= 1200 && p[1] >= 0 && p[1] <= 672);

// 对白行：{ who, side?, text, ifFlag?, unlessFlag?, choices?: [{ text, red?, flag?, reply?: [对白] }] }
function checkLines(lines, err, at) {
  if (!Array.isArray(lines) || !lines.length) return err(`${at} say 需要非空对白数组`);
  for (const l of lines) {
    if (!l || typeof l.who !== 'string' || typeof l.text !== 'string') err(`${at} 对白行缺少 who / text`);
    if (l?.side && !SIDES.includes(l.side)) err(`${at} 对白 side 无效：${l.side}`);
    for (const c of l?.choices || []) {
      if (typeof c.text !== 'string') err(`${at} 选项缺少 text`);
      if (c.red != null && typeof c.red !== 'number') err(`${at} 选项 red 必须是数字`);
      if (c.reply) checkLines(c.reply, err, `${at} 选项回复`);
    }
  }
}

// 校验一段场景脚本：返回错误信息数组。opts.known(name) 判断人物名是否已登记（不传则不检查）
export function checkScript(script, opts = {}) {
  const errs = [];
  const err = (m) => errs.push(m);
  if (!Array.isArray(script)) return ['场景脚本必须是数组'];
  const actors = new Set();
  let kind = null;
  script.forEach((c, i) => {
    const at = `#${i}`;
    const t = typeOf(c);
    if (!t) return err(`${at} 未知指令：${JSON.stringify(c)}`);
    switch (t) {
      case 'bg':
        if (!BACKGROUNDS[c.bg]) err(`${at} 背景不存在：${c.bg}`);
        else kind = BACKGROUNDS[c.bg].kind;
        if (c.time && !TIMES.includes(c.time)) err(`${at} 时段无效：${c.time}`);
        if (c.view && !MAP_VIEWS[c.view]) err(`${at} 地图视野无效：${c.view}`);
        if (!c.keep) actors.clear();
        break;
      case 'actor': {
        if (typeof c.actor !== 'string') err(`${at} actor 必须是人物名`);
        else if (opts.known && !opts.known(c.actor)) err(`${at} 人物未登记：${c.actor}`);
        if (!inStage(c.at)) err(`${at} 站位超出场景范围：${JSON.stringify(c.at)}`);
        if (c.face && !DIRS[c.face]) err(`${at} 朝向无效：${c.face}`);
        if (c.pose && !POSES[c.pose]) err(`${at} 动作无效：${c.pose}`);
        if (c.side && !SIDES.includes(c.side)) err(`${at} side 无效：${c.side}`);
        if (kind === 'map') err(`${at} 中国地图上请用 map 指令显示势力头像`);
        actors.add(c.id || c.actor);
        break;
      }
      case 'move':
        if (!inStage(c.to)) err(`${at} 移动目标超出场景范围：${JSON.stringify(c.to)}`);
      // fallthrough：检查人物是否已出场
      case 'exit': case 'face': case 'act': case 'emote': {
        const key = c[t];
        if (!actors.has(key) && !c.ifFlag && !c.unlessFlag) err(`${at} ${t} 引用了未出场的人物：${key}`);
        if (t === 'exit') { if (c.to && !inStage(c.to)) err(`${at} 离场目标超出场景范围`); actors.delete(key); }
        if (t === 'face' && !DIRS[c.dir]) err(`${at} 朝向无效：${c.dir}`);
        if (t === 'act' && !POSES[c.pose]) err(`${at} 动作无效：${c.pose}`);
        if (t === 'emote' && !EMOTES[c.icon]) err(`${at} 表情无效：${c.icon}`);
        break;
      }
      case 'say': checkLines(c.say, err, at); break;
      case 'narr': if (typeof c.narr !== 'string') err(`${at} narr 必须是文字`); break;
      case 'wait': if (typeof c.wait !== 'number' || c.wait < 0) err(`${at} wait 必须是非负毫秒数`); break;
      case 'fade': if (!['in', 'out'].includes(c.fade)) err(`${at} fade 只能是 in / out`); break;
      case 'camera': if (c.camera !== 'reset' && !inStage(c.camera)) err(`${at} 镜头坐标超出场景范围`); break;
      case 'map': {
        const m = c.map || {};
        if (kind !== 'map') err(`${at} map 指令需要先设置中国地图背景`);
        if (m.show != null && !mapPointOk(m.at)) err(`${at} 地图位置无效：${JSON.stringify(m.at)}`);
        if (m.move != null && !mapPointOk(m.to)) err(`${at} 地图位置无效：${JSON.stringify(m.to)}`);
        if (m.text != null && !mapPointOk(m.at)) err(`${at} 地图文字位置无效`);
        if (m.show == null && m.move == null && m.hide == null && m.text == null) err(`${at} map 需要 show / move / hide / text`);
        break;
      }
      case 'arrow':
        if (kind !== 'map') err(`${at} arrow 需要先设置中国地图背景`);
        if (!Array.isArray(c.arrow) || c.arrow.length < 2 || !c.arrow.every(mapPointOk)) err(`${at} 行军箭头至少两个有效地点`);
        break;
      case 'clear': actors.clear(); break;
      default:
    }
  });
  return errs;
}
