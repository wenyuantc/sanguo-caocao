# Journal - sanguo (Part 1)

> AI development session journal
> Started: 2026-10-10

---



## Session 1: 填写前端规范（Bootstrap Guidelines）
<!-- trellis-session: v=2 fp=93f1d75e17179e9c -->

**Date**: 2026-10-10
**Task**: 填写前端规范（Bootstrap Guidelines）
**Branch**: `main`

### Summary

按 Phaser + 原生 JS 实际代码重组并填写 .trellis/spec/frontend 6 篇规范（中文）；记录存档导入 validSave 整数校验 bug 与 package-lock 被忽略导致 npm ci 失败两个已知问题

### Git Commits

| Hash | Message |
|------|---------|
| `01fe940` | docs: 按项目实际填写前端规范（Phaser + 原生 JS，中文） |

### Status

[OK] **Completed**


## Session 2: 装备与宝物（10-10-equipment）
<!-- trellis-session: v=2 fp=99a5162ff918b886 -->

**Date**: 2026-10-10
**Task**: 装备与宝物（10-10-equipment）
**Branch**: `cursor/equipment-treasures-6e34`

### Summary

新增 equipment.js（普通 37 / 宝物 50、特效、熟练度、初始装备、奖励 / 掉落 / 商店），接入战斗、胜利结算与战果面板、存档（inventory / gold），整备新增装备 / 道具 / 商店页，校验脚本检查装备引用；颍川、官渡、赤壁、五丈原（二）、建业 AI 对战与 main 基线结果相当，无运行时错误

### Git Commits

| Hash | Message |
|------|---------|
| `97ef476` | Add equipment and treasure rules: gear stats, effects, rewards, drops and shop data |
| `18a7c9f` | Wire equipment into battles: kits, drops, victory rewards, gold and save data |
| `4738e03` | Add equipment, item and shop tabs to the prep screen |
| `4839ed1` | Validate equipment counts and reward, drop and shop references |
| `b056a1d` | Document equipment state, contracts and stage reward tables |
| `d6c3543` | Wrap gear descriptions in prep slots and note when gear is taken from another general |

### Status

[OK] **Completed**


## Session 3: 音频引擎与音效
<!-- trellis-session: v=2 fp=4d7e2dacd59025a8 -->

**Date**: 2026-10-11
**Task**: 音频引擎与音效
**Branch**: `main`

### Summary

10-10-audio 拆为引擎与音效、配乐与场景接入两个子任务；完成子任务 1：src/audio 合成引擎、8 种乐器音色、全部音效接入，设置面板增加配乐/音效音量与静音（即时生效），战斗右侧面板设置入口，标题点击开始解锁音频。下一步：10-11-audio-music。

### Git Commits

| Hash | Message |
|------|---------|
| `7c47466` | chore(task): 音频任务拆分为引擎与音效、配乐与场景接入两个子任务 |
| `7d4ec99` | feat(audio): Web Audio 合成引擎、乐器音色与全部音效接入，设置面板增加音量与静音 |
| `6699053` | docs(spec): 音频接入约定与 audio 目录说明 |

### Status

[OK] **Completed**


## Session 4: 配乐与场景接入
<!-- trellis-session: v=2 fp=eea091b253146259 -->

**Date**: 2026-10-11
**Task**: 配乐与场景接入
**Branch**: `main`

### Summary

音序器（look-ahead 排程、简谱解析、循环与渐变切曲）、13 首原创五声音阶曲目、场合映射与 57 关战斗曲分配、危急判定（回滞）与单挑恢复；接入标题/剧情/营中/战斗/结局；validate-stages 增加配乐校验；spec 补配乐约定。曲目尚未人工试听。

### Git Commits

| Hash | Message |
|------|---------|
| `d17f17f` | feat(audio): 音序器、13 首原创配乐与各场景接入，每关战斗曲分配与危急切换 |
| `39720c1` | docs(spec): 配乐接入约定、简谱语法与 audio 目录说明 |

### Status

[OK] **Completed**


## Session 5: 二周目继承（ngplus）与音效父任务归档
<!-- trellis-session: v=2 fp=37a3d1bb80637605 -->

**Date**: 2026-10-12
**Task**: 二周目继承（ngplus）与音效父任务归档
**Branch**: `feat/ngplus`

### Summary

归档已完成的 10-10-audio 父任务；实现二周目继承：legacy.js（sanguo-legacy：结局记录 + 宝物图鉴）、中间路线结局（route_middle 标记）、标题画面三鸟结局标记与宝物图鉴覆盖层、颍川开场许劭二周目选项（升级/金钱/全部宝物，按 research 原文）、导出导入合并 legacy；check 修复重复登记与死导出；浏览器验证 2 结局升 2 级正确

### Git Commits

| Hash | Message |
|------|---------|
| `954a227` | feat(ngplus): 二周目继承——结局记录（含中间路线结局）、宝物图鉴、标题结局标记与图鉴、许劭二周目选项、导出导入合并 legacy |
| `2a2d481` | docs(spec): legacy.js 模块与 sanguo-legacy 存储约定 |

### Status

[OK] **Completed**


## Session 6: core-systems 收尾归档；第一关毒烟减伤与友军自动用药
<!-- trellis-session: v=2 fp=dd2ef9c818159314 -->

**Date**: 2026-10-12
**Task**: core-systems 收尾归档；第一关毒烟减伤与友军自动用药
**Branch**: `feat/stage1-poison-ally-items`

### Summary

core-systems 整体收尾：5 个代表关卡 AI 对战与旧格式存档读档回归，更新 GQ.md 差异说明，ai-battle 加 story=0 适配开场场景；第一关张宝/黄巾术士策略伤害 ×0.6、中毒 5%，友军自带补给并由 planAI 自动用药，第一关 AI 对战 6 局胜 5（main 基线 1/6）

### Git Commits

| Hash | Message |
|------|---------|
| `4771b44` | docs(GQ): 更新与原版差异说明；fix(scripts): ai-battle 跳过开场场景直接进战场 |
| `55510fb` | feat(battle): 第一关毒烟减伤；友军 AI 自动使用自带补给 |

### Status

[OK] **Completed**


## Session 7: 移动端横屏触屏适配
<!-- trellis-session: v=2 fp=0dab56e589dc2a81 -->

**Date**: 2026-10-12
**Task**: 移动端横屏触屏适配
**Branch**: `main`

### Summary

横屏触屏可玩：竖屏横置遮罩、首触全屏+横屏锁定、禁止缩放/下拉刷新；触屏点击补刷悬停、点击容差 18、关闭触屏边缘滚动；选目标两次点击确认（目标格标“再点确认”）；触屏取消按钮与结束回合互斥并 400ms 防误触；导入/导出按钮抬起触发；说明文字按设备切换。不引入第三方库（评估 phaser-hidpi 等）。规范新增“触屏输入”章节。

### Git Commits

| Hash | Message |
|------|---------|
| `f3b5108` | feat(mobile): 横屏触屏适配（竖屏提示、触屏取消 / 二次确认、修复触屏边缘滚动） |

### Status

[OK] **Completed**


## Session 8: 游戏加速设置（1x~16x）
<!-- trellis-session: v=2 fp=27ec743661c5ad52 -->

**Date**: 2026-10-12
**Task**: 游戏加速设置（1x~16x）
**Branch**: `feat/game-speed`

### Summary

新增游戏速度设置 1x/1.25x/1.5x/2x/4x/8x/16x，首页与战斗内设置面板均可切换，即时保存生效；仅作用于战斗场景的 tweens/time timeScale，剧情场景不受影响。补充 scene-and-rendering 规范说明。

### Git Commits

| Hash | Message |
|------|---------|
| `0c18588` | feat(settings): 新增游戏速度设置（1x~16x，仅作用于战斗） |

### Status

[OK] **Completed**


## Session 9: 招募系统：金币招募小兵与武将
<!-- trellis-session: v=2 fp=ed1dffee3af6a516 -->

**Date**: 2026-10-12
**Task**: 招募系统：金币招募小兵与武将
**Branch**: `feat/recruit-system`

### Summary

新增招募系统：整备界面招募页与营地募兵官；小兵 5 兵种任意招募、武将从非剧情武将随机候选（每关 4 名、可刷新 3 次）；开局金币 1000；招募单位通过 generals.js 镜像表接入花名册/出阵/存档；检查修复招募 id 与关卡敌军重名（改 rec 前缀）与重开第一关金币；浏览器端到端验证通过

### Git Commits

| Hash | Message |
|------|---------|
| `eafd45f` | feat(recruit): 新增招募系统（金币招募小兵与非剧情武将，开局 1000 金，候选每关可刷新 3 次） |

### Status

[OK] **Completed**


## Session 10: 金手指功能
<!-- trellis-session: v=2 fp=55b6efa939f8acaa -->

**Date**: 2026-10-12
**Task**: 金手指功能
**Branch**: `feat/cheat-mode`

### Summary

新增金手指：设置/战斗/营中/整备面板入口，无敌、秒杀、无限行动，军资金/道具/果子/装备编辑（含属性说明），直接胜利，招募无限刷新；使用过的进度存档永久标记并在存档列表显示［金手指］

### Git Commits

| Hash | Message |
|------|---------|
| `a05c863` | feat(cheat): 新增金手指（无敌/秒杀/无限行动、资源编辑、直接胜利），使用过的进度存档带金手指标识 |
| `50661b5` | feat(cheat): 整备面板在金手指开启时提供金手指入口 |
| `6a47a24` | feat(cheat): 金手指面板显示道具/装备说明，金手指开启时招募武将无限刷新 |

### Status

[OK] **Completed**
