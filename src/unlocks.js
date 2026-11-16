import { MISSIONS } from './missions.js';

/** First N main hunting missions (not tutorial) start unlocked. */
export const MAIN_INITIAL_UNLOCKED = 5;

/** Top-3 placements on this many main missions unlocks the rest of the main pack. */
export const MAIN_MORE_TOP3_NEED = 3;

/** Top-3 placements on this many main missions unlocks the Winter pack. */
export const WINTER_TOP3_NEED = 6;

/** Rank 1–3 counts as a top-3 placement. */
export const TOP3_RANK_MAX = 3;

export function isTutorial(mission) {
  return Boolean(mission?.tutorial);
}

export function isMainHunting(mission) {
  return mission?.pack === 'main' && !mission.tutorial;
}

export function isWinter(mission) {
  return mission?.pack === 'winter';
}

export function mainHuntingMissions() {
  return MISSIONS.filter(isMainHunting);
}

export function winterMissions() {
  return MISSIONS.filter(isWinter);
}

/**
 * True when the local player's best cleared run currently sits in ranks 1–3
 * on that mission's board (same name + score entry).
 */
export function playerTop3Rank(scoreboard, missionId) {
  const best = scoreboard?.playerBest?.(missionId);
  if (!best) return 0;
  const board = scoreboard.list(missionId);
  const index = board.findIndex((row) => row.name === best.name && row.score === best.score);
  if (index < 0) return 0;
  const rank = index + 1;
  return rank <= TOP3_RANK_MAX ? rank : 0;
}

export function isPlayerTop3(scoreboard, missionId) {
  return playerTop3Rank(scoreboard, missionId) > 0;
}

/** Top-3 count on main hunting missions only — tutorial never counts. */
export function mainTop3Count(scoreboard) {
  let count = 0;
  for (const mission of mainHuntingMissions()) {
    if (isPlayerTop3(scoreboard, mission.id)) count += 1;
  }
  return count;
}

export function mainMoreUnlocked(scoreboard) {
  return mainTop3Count(scoreboard) >= MAIN_MORE_TOP3_NEED;
}

export function winterUnlocked(scoreboard) {
  return mainTop3Count(scoreboard) >= WINTER_TOP3_NEED;
}

/**
 * Whether a mission can be started from the menu.
 * Tutorial is always open. First five main hunting levels start open.
 * Remaining main levels need top 3 on 3 main missions. Winter needs top 3 on 6.
 */
export function isMissionUnlocked(mission, scoreboard) {
  if (!mission) return false;
  if (isTutorial(mission)) return true;
  if (isWinter(mission)) return winterUnlocked(scoreboard);
  if (isMainHunting(mission)) {
    const hunting = mainHuntingMissions();
    const order = hunting.findIndex((entry) => entry.id === mission.id);
    if (order < 0) return false;
    if (order < MAIN_INITIAL_UNLOCKED) return true;
    return mainMoreUnlocked(scoreboard);
  }
  return false;
}

export function unlockProgress(scoreboard) {
  const top3 = mainTop3Count(scoreboard);
  return {
    top3,
    mainMoreNeed: MAIN_MORE_TOP3_NEED,
    mainMoreUnlocked: top3 >= MAIN_MORE_TOP3_NEED,
    winterNeed: WINTER_TOP3_NEED,
    winterUnlocked: top3 >= WINTER_TOP3_NEED,
  };
}

export function unlockHint(mission, scoreboard) {
  if (!mission || isMissionUnlocked(mission, scoreboard)) return '';
  const { top3, mainMoreNeed, winterNeed } = unlockProgress(scoreboard);
  if (isWinter(mission)) {
    return `Locked · Top 3 on ${top3}/${winterNeed} main missions to unlock Winter`;
  }
  if (isMainHunting(mission)) {
    return `Locked · Top 3 on ${top3}/${mainMoreNeed} missions to unlock more`;
  }
  return 'Locked';
}

/** Next unlocked mission index after `fromIndex`, preferring the same pack. */
export function nextUnlockedIndex(fromIndex, scoreboard) {
  const current = MISSIONS[fromIndex];
  if (!current) return -1;
  for (let i = fromIndex + 1; i < MISSIONS.length; i++) {
    const mission = MISSIONS[i];
    if (mission.pack !== current.pack) continue;
    if (isMissionUnlocked(mission, scoreboard)) return i;
  }
  for (let i = fromIndex + 1; i < MISSIONS.length; i++) {
    if (isMissionUnlocked(MISSIONS[i], scoreboard)) return i;
  }
  return -1;
}
