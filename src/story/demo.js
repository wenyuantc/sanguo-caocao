const NAMES = ['曹操', '夏侯惇', '荀彧', '许褚', '关羽', '典韦', '张辽', '郭嘉', '吕布', '貂蝉', '赵云', '张飞', '诸葛亮'];

// 演示场景（调试入口 ?scene=demo / gallery / poses）：覆盖全部指令、背景、动作与表情，用于验证场景管线。不属于任何关卡。
export const DEMO_SCENES = {
  // 温酒斩华雄（示例：手写场景的写法）
  demo: [
    { chapter: '演示', sub: '温酒斩华雄' },
    { bg: 'china', view: 'central', place: '汜水关' },
    { map: { show: '袁绍', at: '陈留', side: 'ally' } },
    { map: { show: '曹操', at: '陈留', side: 'player' } },
    { arrow: ['陈留', '荥阳', '汜水关'], side: 'player' },
    { map: { move: '曹操', to: '汜水关' } },
    { map: { show: '华雄', at: '洛阳', side: 'enemy' } },
    { arrow: ['洛阳', '汜水关'], side: 'enemy' },
    { map: { text: '十八路诸侯会盟', at: '颍川' } },
    { narr: '初平元年，十八路诸侯会盟讨董。董卓遣骁将华雄据守汜水关，连斩联军数将。' },
    { bg: 'tent', place: '汜水关　联军大帐', time: 'night' },
    { actor: '袁绍', side: 'ally', at: [3, 3], face: 'dr' },
    { actor: '曹操', side: 'player', at: [3, 9], face: 'dr' },
    { actor: '孙坚', side: 'ally', at: [9, 3], face: 'dl' },
    { actor: '关羽', side: 'ally', at: [12, 18], face: 'ur' },
    { say: [{ who: '袁绍', side: 'ally', text: '华雄连斩我军上将，谁敢出战？' }] },
    { emote: '孙坚', icon: 'sweat' },
    { act: '孙坚', pose: 'kneel' },
    { say: [{ who: '孙坚', side: 'ally', text: '惭愧……末将已败一阵。' }] },
    { move: '关羽', to: [6, 10], face: 'ur' },
    { act: '关羽', pose: 'bow' },
    { say: [{ who: '关羽', side: 'ally', text: '小将愿往，斩华雄之头，献于帐下！' }] },
    { emote: '袁绍', icon: 'anger' },
    { say: [{ who: '袁绍', side: 'ally', text: '一弓手安敢乱言！与我打出！' }] },
    { act: '关羽', pose: 'stand' },
    { face: '曹操', dir: 'dl' },
    { emote: '曹操', icon: 'question' },
    {
      say: [{
        who: '曹操', side: 'player', text: '此人仪表不俗，华雄安知他是弓手？', choices: [
          { text: '热酒一杯，为将军壮行（演示：红色 +0）', reply: [{ who: '关羽', side: 'ally', text: '酒且斟下，某去便来。' }] },
          { text: '静观其变', reply: [{ who: '曹操', side: 'player', text: '……且看他本事。' }] },
        ],
      }],
    },
    { exit: '关羽', to: [12, 20] },
    { shake: 500 },
    { narr: '关外鼓声大振，喊声大举，如天摧地塌，岳撼山崩。' },
    { actor: '关羽', side: 'ally', at: [12, 20], face: 'ul' },
    { move: '关羽', to: [6, 10], face: 'ur' },
    { act: '关羽', pose: 'raise1' },
    { say: [{ who: '关羽', side: 'ally', text: '华雄之头在此！' }] },
    { emote: '曹操', icon: 'joy' },
    { act: '曹操', pose: 'excite', ms: 600 },
    { say: [{ who: '曹操', side: 'player', text: '其酒尚温！真乃神勇！' }] },
    { act: '曹操', pose: 'stand' },
    { camera: [3, 9], zoom: 1.5, ms: 600 },
    { wait: 500 },
    { camera: 'reset', ms: 400 },
    { fade: 'out', ms: 500 },
  ],

  // 全部背景、动作与表情一览
  gallery: [
    ...['field', 'citygate', 'river', 'mountain'].flatMap((bg, i) => [
      { bg, time: ['day', 'dusk', 'night', 'day'][i], place: `外场景：${bg}` },
      { actor: '曹操', side: 'player', at: [7, 9], face: 'dr' },
      { actor: '吕布', side: 'enemy', at: [11, 5], face: 'dl' },
      { wait: 900 },
    ]),
    ...['palace', 'tent', 'hall', 'street', 'camp'].flatMap((bg, i) => [
      { bg, time: ['day', 'dusk', 'day', 'night', 'day'][i], place: `内场景：${bg}` },
      { actor: '献帝', side: 'ally', at: [3, 3], face: 'dr' },
      { actor: '荀彧', side: 'player', at: [3, 9], face: 'dr' },
      { actor: '夏侯惇', side: 'player', at: [9, 3], face: 'dl' },
      { wait: 900 },
    ]),
    ...['all', 'north', 'central', 'south', 'west'].flatMap((view) => [
      { bg: 'china', view, place: `中国地图：${view}` },
      { map: { show: '曹操', at: '许昌', side: 'player' } },
      { arrow: ['许昌', '宛', '襄阳', '江陵'], side: 'player' },
      { map: { show: '刘备', at: '江陵', side: 'ally' } },
      { map: { show: '孙权', at: '建业', side: 'enemy' } },
      { wait: 600 },
    ]),
    { fade: 'out' },
  ],

  // 动作、表情与朝向一览
  poses: [
    { bg: 'tent', place: '动作一览' },
    ...NAMES.map((name, i) => {
      const s = i < 7 ? -12 + i * 4 : -10 + (i - 7) * 4, d = i < 7 ? 12 : 20;
      return { actor: name, id: `p${i}`, side: i % 3 ? 'player' : 'enemy', at: [(d + s) / 2, (d - s) / 2], face: 'dr' };
    }),
    ...['stand', 'walk', 'bow', 'raise', 'raise1', 'reach', 'sit', 'kneel', 'cry', 'fall', 'swing', 'bound', 'excite'].map((pose, i) => ({ act: `p${i}`, pose, ms: 0 })),
    ...['shock', 'anger', 'joy', 'sweat', 'question', 'dots'].map((icon, i) => ({ emote: `p${i}`, icon, ms: 0 })),
    { wait: 1500 },
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ face: `p${i}`, dir: ['ur', 'ul', 'dl', 'ur', 'ul', 'dl', 'ur'][i] })),
    { wait: 4000 },
    { fade: 'out' },
  ],
};
