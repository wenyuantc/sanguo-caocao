// 关卡之间的流程跳转集中在这里：
//   新游戏 / 下一关 → goStage：开场场景（StoryScene pre）→ afterPre：战斗（BattleScene 开局先整备）
//   胜利 → playPost：结尾场景叠加在战场上播放（选项可能改变红色指数 / 标记，影响奖励与路线）→ 战果 → goNext
//   goNext：下一关的开场场景，或结局（子任务 8 的军营插在 goNext 进入下一关之前）
import { getStage, ENDINGS } from '../stages.js';

export function goStage(scene, id) {
  scene.scene.start('Story', { stage: id, part: 'pre' });
}

export function afterPre(scene, id) {
  scene.scene.start('Battle', { stage: id, skipStory: true });
}

export function goNext(scene, next) {
  if (next && getStage(next)) goStage(scene, next);
  else scene.scene.start('Ending', { route: ENDINGS[next] || 'villain' });
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
