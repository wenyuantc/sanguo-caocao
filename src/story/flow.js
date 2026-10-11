// 关卡之间的流程跳转集中在这里：
//   新游戏 / 下一关 → goStage：开场场景（StoryScene pre）→ afterPre：战斗（BattleScene 开局先整备）
//   胜利 → playPost：结尾场景叠加在战场上播放（选项可能改变红色指数 / 标记，影响奖励与路线）→ 战果 → goNext
//   goNext：进入营中（CampScene，两关之间自由走动、对话、整备、存档），营门出征后 goStage 播下一关开场；没有下一关时进入结局
//   新游戏的第一关直接 goStage（不进营中）
// deploy：营中整备选好的出阵武将 id，经开场场景带进战场，作为整备界面的初始阵容
import { getStage, ENDINGS } from '../stages.js';

// ngplus：新游戏第一关开场插入许劭的二周目选项（legacy.js）
export function goStage(scene, id, { deploy, ngplus } = {}) {
  scene.scene.start('Story', { stage: id, part: 'pre', deploy, ngplus });
}

export function afterPre(scene, id, deploy) {
  scene.scene.start('Battle', { stage: id, skipStory: true, deploy });
}

export function goCamp(scene, id, data = {}) {
  scene.scene.start('Camp', { ...data, stage: id });
}

// 结局：奸雄线终关胜利时，马超迎击战分路时为中间路线（标记 route_middle）的显示中间路线结局；调试关卡不记录结局
export function goNext(scene, next) {
  if (next && getStage(next)) { goCamp(scene, next); return; }
  const route = ENDINGS[next] || 'villain';
  const middle = route === 'villain' && scene.registry.get('flags')?.route_middle;
  scene.scene.start('Ending', { route: middle ? 'middle' : route, record: !scene.stage?.debug });
}

// 结尾场景：暂停并隐藏战场，在其上启动 StoryScene；场景结束后恢复战场。返回 Promise
export function playPost(battle, { outcome, annihilated }) {
  return new Promise((resolve) => {
    battle.scene.launch('Story', { stage: battle.stageId, part: 'post', outcome, annihilated, onDone: resolve });
    battle.scene.pause();
    battle.scene.setVisible(false);
  }).then(() => {
    battle.scene.resume();
    battle.scene.setVisible(true);
  });
}
