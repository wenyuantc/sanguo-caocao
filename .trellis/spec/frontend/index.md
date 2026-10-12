# 前端开发规范

> 本项目是浏览器版《三国志曹操传》复刻：Phaser 4 + Vite + 原生 JavaScript ES 模块。

---

## 概述

项目中没有组件框架、TypeScript、Hooks 或状态管理库。游戏由三个 Phaser 场景（`Title`、
`Battle`、`Ending`）和若干负责规则、渲染、数据的普通模块组成。所有图形都在运行时程序化生成
（Canvas 2D 贴图 + Phaser Graphics），没有素材目录。

原模板是按 React 写的，已按本项目实际情况改名：
`component-guidelines` → `scene-and-rendering`，`hook-guidelines` → `stage-data`，
`type-safety` → `data-contracts`。

---

## 规范索引

| 规范 | 说明 | 状态 |
|------|------|------|
| [目录结构](./directory-structure.md) | 模块地图、依赖方向、新代码放哪里 | 已填写 |
| [场景与渲染](./scene-and-rendering.md) | Phaser 场景、触屏输入、UI 工厂函数、视图类、程序化贴图、异步动画流程 | 已填写 |
| [关卡数据](./stage-data.md) | 关卡对象、单位、事件、对白、武将外形、校验 | 已填写 |
| [状态管理](./state-management.md) | registry、场景字段、单位对象、localStorage 存档 | 已填写 |
| [数据契约](./data-contracts.md) | 单位/属性/存档/规则表的结构；没有类型系统时如何保证正确 | 已填写 |
| [质量规范](./quality-guidelines.md) | 代码风格、必须/禁止的写法、验证命令、Git 工作流（只用 main）、评审清单 | 已填写 |

---

## 开发前检查

- 修改关卡或武将外形 → 先读 `stage-data.md` 和 `docs/STAGE_GUIDE.md`。
- 修改战斗流程、AI、战斗公式 → 读 `state-management.md` 和 `data-contracts.md`。
- 修改任何画面显示或输入处理 → 读 `scene-and-rendering.md`（新增交互要同时考虑触屏，见“触屏输入”）。
- 任何改动 → 读 `quality-guidelines.md`（验证命令）。

---

**语言**：规范文档、`src/` 中的代码注释和面向玩家的文字统一使用简体中文。
