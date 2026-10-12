# 金手指功能 · 技术设计

## 1. 设置（全局，不进存档）

`src/settings.js`
- `DEFAULT_SETTINGS` 增加：`cheat: false`（总开关）、`cheatGod: true`（我方无敌）、`cheatKill: true`（我方秒杀）、`cheatMove: true`（无限行动）。
- `SETTING_OPTIONS` 为这四项加 `[[false,'关'],[true,'开']]` 形式的选项，`loadSettings` 的校验自动覆盖。
- 运行时读写沿用 `SETTINGS`（config.js 导出的可变对象）+ `saveSettings({...SETTINGS})`。

## 2. 新模块 `src/cheat.js`（规则 + 状态，无 UI）

```js
export const cheatOn = (k) => SETTINGS.cheat && (!k || SETTINGS[k]);
// 进入战役场景 / 打开开关时调用：本周目永久标记
export function markCheat(scene) { if (SETTINGS.cheat) scene.registry.set('cheated', true); }
// 伤害修正：attacker / target 为单位，返回最终伤害
export function cheatDmg(a, d, dmg) {
  if (d?.faction === 'player' && cheatOn('cheatGod')) return 0;
  if (a?.faction === 'player' && d && d.faction !== 'player' && dmg > 0 && cheatOn('cheatKill')) return d.hp;
  return dmg;
}
```
只作用于 `faction === 'player'`，友军（ally）与敌军回合逻辑不变。

## 3. 效果挂钩点

| 效果 | 位置 | 做法 |
|------|------|------|
| 无敌/秒杀·物理与反击 | `src/actions.js` `strike()`（:60 rollAttack 之后，mpShield 分支之前） | 秒杀时 a 为我方则 `r.hit = true`；`r.dmg = cheatDmg(a, d, r.dmg)`；无敌时我方受击也可视为未命中前的 0 伤害 |
| 无敌/秒杀·策略 | `src/actions.js` `doSpell()`，`resolveSpell` 之后、`applySpell` 之前 | 遍历结果效果项，对 `e.dmg` 套 `cheatDmg(a, 目标, e.dmg)`；秒杀时伤害型策略强制命中 |
| 无敌·中毒等持续伤害 | `src/status.js` `tickStatus()` | `u.faction==='player' && cheatOn('cheatGod')` 时 dmg=0 |
| 无限行动 | `BattleScene.finishUnit()` | 我方单位且 `cheatOn('cheatMove')` 时不设 `acted`、不置灰，跳过“全员行动完自动结束回合”；仍执行 tryEscape / checkEnd |

`logic.js` 的纯函数（physDamage、resolveSpell、planAI 预测）不改，保证 AI 与预测公式不受影响。实现时按实际数据结构确认 `resolveSpell` 结果中目标字段名。

## 4. 存档标识

- registry 新增键 `cheated: boolean`。
- 写入：`markCheat(scene)` 在 `BattleScene.create`、`CampScene.create`、以及战役内把总开关切到“开”时调用。
- 存档：`BattleScene.snapshot()`、`victory()` 中 writeAuto 的数据（:822 附近）、`CampScene.snapshot()` 增加 `cheated: !!registry.get('cheated')`。
- 读档：`saves.js restoreRegistry` 设 `registry.set('cheated', !!data.cheated)`（旧存档 → false）。
- 新游戏：`TitleScene` 开新局处 `registry.set('cheated', false)`。
- 展示：`saveMenu.js` 在难度标签后追加 `［金手指］` 标签（醒目颜色如 `#ff7ad9`），title 往后挪。
- 导出 / 导入：存档对象自带字段，无需改动，`validSave` 不校验该字段。

## 5. UI

### 设置面板 `src/settingsMenu.js`
- 新增 `cheatRow(scene, root, x0, y, onOpenPanel)`：「金手指」开/关两个 chip；切到“开”时立即保存并调用 `markCheat`（仅在战役场景内，即传入的 scene 有战役 registry 时；标题画面不标记）。
- 完整设置面板（标题）：在音量行之后加一行，面板高度相应增加。
- 战斗设置（audioOnly）：加一行，开关右侧放「金手指面板」按钮（总开关关时置灰），点击后关闭设置面板并由 BattleScene 打开金手指面板。通过 `openSettingsMenu` 新参数 `onCheat` 传入。

### 金手指面板 `src/cheatMenu.js`（新文件）
`openCheatMenu(scene, { battle, onClose })`，操作 `scene.gold / scene.items / scene.inventory`（Battle 与 Camp 场景都有这些字段）：
- 分项开关：无敌 / 秒杀 / 无限行动（即时保存设置）。
- 军资金：显示当前值，按钮 `+1000` `+10000` `+100000` `设定…`（`window.prompt` 输入，非负整数，上限 9999999）。
- 道具页：列出 `ITEMS` 全部（含果子），每项显示持有数与 `+1` `+10` 按钮。
- 装备页：列出 `EQUIP` 全部，分页显示（每页约 12 项），点击用 `newGear(scene.inventory, id, 曹操等级)` 加入背包。
- 战斗内额外：「直接胜利」按钮（battle=true 时显示）。
- 关闭时调用 `onClose`，由场景负责同步：
  - Battle：`hud.setItems(this.items)`；gold/items/inventory 已在场景字段上，snapshot 与 victory 会写回。
  - Camp：把 `gold/items/inventory` 写回 registry（与 `prep.js save()` 一致）。

### 入口
- Battle：战斗设置面板内的「金手指面板」按钮 → `BattleScene.openCheat()`（与 openSave 同样的守卫：非 modal、非 over、我方阶段、state idle/move）。
- Camp：营中 HUD 存档/读档左侧新增「设　置」按钮，打开 audioOnly 设置面板（含金手指行与面板按钮），营中的金手指面板不显示「直接胜利」。

### 一键胜利
`BattleScene.cheatWin()`：守卫 `!this.over && this.phase==='player'`，关闭面板后 `this.clearSelection(); this.victory('win', 'all')`，走正常结算。

## 6. 兼容与回滚
- 设置项新增键有默认值，旧设置数据兼容；存档新增字段可缺省，旧存档兼容。
- 回滚：移除 cheat.js / cheatMenu.js 及挂钩点即可；残留的 `cheated` 字段对旧代码无害。
