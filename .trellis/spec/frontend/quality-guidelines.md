# 质量规范

> 项目没有配置代码检查、格式化、类型检查或单元测试框架。质量依靠：与现有代码风格一致、关卡校验脚本、
> 生产构建和手动试玩。

---

## 代码风格（与现有文件一致）

- 两空格缩进、语句加分号、字符串用单引号、插值用模板字符串、多行字面量保留尾逗号。
- 相对导入必须写 `.js` 扩展名：`import { TILE } from './config.js';`。
- Phaser 以命名空间导入：`import * as Phaser from 'phaser';`，只在真正用到 `Phaser.*` 的文件中导入
  （各场景、`unitView.js`、`spellFx.js`、`saveMenu.js`）。
- 模块使用具名导出；`export default` 只用于关卡数组和 `extra_<组>.js` 对象。
- 项目习惯紧凑写法：短箭头函数、单行 `if (...) return ...;`、紧凑循环里用短变量名（`u`、`s`、`g`、`t`、`p`）。
  不要重新格式化相邻代码。
- 注释和所有面向玩家的文字都用**简体中文**；界面标签用全角空格做视觉间距（`'攻　击'`、`'胜　利'`）。
  与现有文件一样，在不直观的函数上方写一行简短的 `//` 注释。

## 必须遵守的写法

- `logic.js` 中的规则/公式保持纯函数，不依赖 Phaser（见 `directory-structure.md`）。
- `data.js` / `stages/*.js` / `characters*.js` 中的游戏数据必须能被 Node 导入，供校验脚本使用。
- 依赖动画结果的状态修改，必须先 await 动画完成（见 `scene-and-rendering.md`）。
- 新增的玩家/AI 行动类型要包在现有的 `try/catch` + `console.error` 保护中。
- 写入 registry 或存档快照时复制对象（`{ ...obj }`）。

## 禁止的写法

- 没有明确任务就新增依赖、框架、TypeScript 或构建插件。
- 二进制/图片素材：所有图形都是程序生成的。
- 各组并行编辑时，修改其他组的 `src/stages/<x>.js` 或 `extra_<x>.js`。
- 在已发布的关卡中重排现有 `events`（会破坏战斗中存档里的 `firedEvents` 下标）。
- 提交代码中残留 `console.log`（只保留现有的 `console.error`/`console.warn` 用法）。
- UI 销毁后，键盘/指针监听或补间仍在运行。

## 验证

```bash
node scripts/validate-stages.mjs          # 修改关卡/外形/数据后必须执行：0 错误
node scripts/validate-stages.mjs c        # 并行编辑关卡时只校验本组
npm run build                             # 提交整合后的改动前必须执行
npm run dev                               # 手动检查受影响的流程
```

- 手动试玩覆盖所有改动涉及的流程：移动、攻击/反击、策略/道具、对白与选项、事件/援军/单挑、
  胜利 → 下一关、败北 → 重新挑战、存档/读档（手动存档位 + 自动存档）、导出/导入。
- 各组并行编辑期间不要运行 `vite build`，完整构建留到整合阶段。
- 依赖说明：`package-lock.json` 被 git 忽略，所以 `AGENTS.md` 中的 `npm ci` 在新克隆的仓库上会失败；
  在此问题解决前请使用 `npm install`。

## 评审清单

- [ ] 改动只在任务涉及的文件 / 所属关卡组范围内。
- [ ] 校验脚本 0 错误，警告都有说明（基线 0 警告）。
- [ ] `npm run build` 通过（整合阶段）。
- [ ] 新关卡 id 已在 `PLANNED_IDS` 中；`next` 衔接符合 `docs/STAGE_GUIDE.md` §2。
- [ ] 新出现的具名说话人已在 `extra_<组>.js` 中登记外形（或有意使用通用外形）。
- [ ] 逻辑改动后 AI（`planAI`）与 HUD 预测保持一致（两者共用 `logic.js`）。
- [ ] 新的持久化状态已加入 `snapshot()`、`writeAuto(...)`、`applyLoad` 和新游戏重置。
- [ ] UI 使用 `ui.js` 工厂函数、`COLORS`/`FONT` 和正确的显示层级；弹窗关闭时清理监听。
- [ ] 没有残留 `console.log`，未改动的行没有格式变动。
