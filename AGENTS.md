# 仓库贡献指南

本仓库使用 Phaser 4、Vite 和 JavaScript ES 模块，实现浏览器版《曹操传》战棋游戏。

## 项目结构与模块组织

- `index.html` 是页面入口，`src/main.js` 负责初始化 Phaser。
- `src/scenes/` 包含标题、战斗和结局场景；公共玩法逻辑位于 `src/logic.js`、`src/actions.js` 和 `src/data.js`。
- `src/stages/a.js` 至 `f.js` 定义各组关卡，由 `src/stages.js` 汇总。新增武将外形应放入对应的 `src/characters/extra_<group>.js`。
- 图形由 `src/heroSprites.js`、`src/portraits.js`、`src/mapRender.js` 等模块生成，目前没有独立素材目录。
- `scripts/validate-stages.mjs` 校验关卡数据；编写关卡前阅读 `docs/STAGE_GUIDE.md`。

## 构建、测试与本地开发

在仓库根目录执行：

- `npm ci`：按 `package-lock.json` 安装依赖。
- `npm run dev`：启动 Vite 开发服务器。
- `npm run build`：生成生产构建，输出至 `dist/`。
- `npm run preview`：在本地预览生产构建。
- `node scripts/validate-stages.mjs`：校验全部关卡。
- `node scripts/validate-stages.mjs c`：仅校验 C 组，也可传入多个组字母。

## 编码风格与命名约定

遵循现有 JavaScript 风格：两空格缩进、语句使用分号、字符串使用单引号，相对导入明确写出 `.js` 扩展名。函数和变量使用 camelCase，场景类及其文件名使用 PascalCase，常量使用 UPPER_SNAKE_CASE。保留既有关卡标识，如 `xuzhou_fuchou`。目前未配置格式化工具或代码检查工具。

## 测试要求

目前未配置单元测试框架、测试文件命名规则或覆盖率门槛。关卡校验必须零错误，并排查警告；校验内容包括地图、单位站位、事件、胜利条件和关卡衔接。

修改玩法或界面后，通过 `npm run dev` 手动验证受影响的流程，包括移动、战斗、对白和存档读写。提交整合后的改动前执行生产构建。多人并行编辑关卡时，遵循 `docs/STAGE_GUIDE.md`：只校验自己负责的组，完整构建留到整合阶段。

## 提交与合并请求

现有提交标题（`init`、`init2`、`trellis`）尚未形成正式规范。新提交应使用简洁、明确的动作描述，并保持单次改动聚焦。合并请求应说明改动目的、关联相关问题、列出验证命令及结果；涉及可见界面变化时附上截图。

## 智能体协作说明

实施前阅读 `.trellis/workflow.md` 和 `.trellis/spec/` 中适用的规范。只修改任务范围内的内容，并遵守关卡分组的文件负责范围。

<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
