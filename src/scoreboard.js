import { MISSIONS } from './missions.js';

/**
 * Mirrors WEAPON scoring in config.js / scoreFor() in Rifle.js.
 * Duplicated here so boards stay reachable without importing Vite/Three.
 */
const SCORE = {
  base: 80,
  distanceCap: 100,
  zone: { body: 1, head: 1.5 },
};

function pointsFor(distance, zone = 'body', scoreMultiplier = 1) {
  const multiplier = (SCORE.zone[zone] ?? 1) * scoreMultiplier;
  return Math.round((SCORE.base + Math.min(distance, SCORE.distanceCap)) * multiplier);
}

/** Shared default names for every mission's top-10 board. */
export const DEFAULT_BOARD_NAMES = [
  'Reed',
  'Ash',
  'Morgan',
  'Quinn',
  'Blake',
  'Casey',
  'Drew',
  'Harper',
  'Jordan',
  'Skye',
];

/**
 * Legacy v1 filler scores (same ladder on every mission: 2000 → 200).
 * Kept so migration can detect untouched default rows in localStorage.
 */
export const LEGACY_BOARD_SCORES = DEFAULT_BOARD_NAMES.map((_, i) => 2000 - i * 200);

/**
 * Boards schema version. Bump when default filler ladders change so old
 * unreachable 2000-era boards can be regenerated on load.
 */
export const BOARD_STORAGE_VERSION = 2;

/** localStorage keys — boards survive reload; documented in the PR. */
export const STORAGE_KEYS = {
  boards: 'hunter-elite.boards',
  boardsVersion: 'hunter-elite.boardsVersion',
  completed: 'hunter-elite.completed',
  playerBests: 'hunter-elite.playerBests',
};

const LEGACY_SCORE_SET = new Set(LEGACY_BOARD_SCORES);
const DEFAULT_NAME_SET = new Set(DEFAULT_BOARD_NAMES);

const MISSION_BY_ID = new Map(MISSIONS.map((mission) => [mission.id, mission]));

function roundScore(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

/** Round to nearest 5 so boards read cleanly. */
function roundLadder(value) {
  return Math.max(0, Math.round(roundScore(value) / 5) * 5);
}

/**
 * Premium objective species use the same multiplier as live animals
 * (`scoreMultiplier: 5` on bison / boar in config).
 */
export function missionScoreMultiplier(mission) {
  if (mission?.species === 'bison' || mission?.species === 'boar') return 5;
  return 1;
}

/**
 * Score band for a mission from objective count + scoreFor math.
 * Mission ends when the objective is met, so totals are count × kill points
 * (loot +50 is ignored here — a bonus path, not required for the ladder).
 *
 * - excellent: headshots at the distance cap (apples: body at orchard ranges)
 * - strong: mix of head-at-min and body-at-cap — top-3 territory
 * - clear: body shots just over the minimum — soft board floor
 */
export function missionScoreBand(mission) {
  if (!mission) {
    return { excellent: LEGACY_BOARD_SCORES[0], strong: 1200, clear: LEGACY_BOARD_SCORES[9] };
  }

  if (mission.tutorial) {
    // Orchard geometry: ~35 m from Tower S, ~78 m from A/D (horizontal).
    // Apples always score as body shots.
    const near = pointsFor(35, 'body', 1);
    const far = pointsFor(78, 'body', 1);
    const excellent = near * 8 + far * 12;
    return {
      excellent,
      strong: roundScore(excellent * 0.86),
      clear: roundScore(excellent * 0.72),
    };
  }

  const count = Math.max(1, Number(mission.count) || 1);
  const mult = missionScoreMultiplier(mission);
  const minDistance = Math.max(0, Number(mission.minDistance) || 0);
  const near = Math.max(minDistance + 1, 1);
  const far = SCORE.distanceCap;

  const headFar = pointsFor(far, 'head', mult);
  const headNear = pointsFor(near, 'head', mult);
  const bodyFar = pointsFor(far, 'body', mult);
  const bodyNear = pointsFor(near, 'body', mult);

  const excellent = headFar * count;
  const strong = roundScore(((headNear + bodyFar) / 2) * count);
  const clear = bodyNear * count;
  return { excellent, strong, clear };
}

/**
 * Per-mission top-10 filler scores: challenging but reachable.
 * #1 near excellent, #3 at strong (unlock-gate territory), #10 just under clear.
 */
export function defaultBoardScores(mission) {
  const { excellent, strong, clear } = missionScoreBand(mission);
  const top = roundLadder(excellent * 0.96);
  const third = roundLadder(strong);
  const tenth = roundLadder(Math.max(clear - 20, clear * 0.88));

  const scores = new Array(10);
  scores[0] = top;
  scores[2] = third;
  scores[9] = tenth;
  scores[1] = roundLadder((top + third) / 2);
  for (let i = 3; i <= 8; i += 1) {
    const t = (i - 2) / 7;
    scores[i] = roundLadder(third + (tenth - third) * t);
  }

  // Keep strictly descending so ranks stay distinct after rounding.
  for (let i = 1; i < scores.length; i += 1) {
    if (scores[i] >= scores[i - 1]) scores[i] = Math.max(0, scores[i - 1] - 5);
  }
  return scores;
}

/** @deprecated Use defaultBoardScores(mission). Legacy flat ladder for docs/migration. */
export const DEFAULT_BOARD_SCORES = LEGACY_BOARD_SCORES;

function defaultBoard(mission) {
  const scores = defaultBoardScores(mission);
  return DEFAULT_BOARD_NAMES.map((name, i) => ({
    name,
    score: scores[i],
  }));
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem?.(key);
    if (raw == null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
  } catch {
    // Quota / private mode — keep in-memory boards for this session.
  }
}

function readVersion(storage) {
  const raw = storage?.getItem?.(STORAGE_KEYS.boardsVersion);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function writeVersion(storage, version) {
  try {
    storage?.setItem?.(STORAGE_KEYS.boardsVersion, String(version));
  } catch {
    // ignore
  }
}

/** True when a row still looks like an untouched v1 filler entry. */
export function isLegacyFillerRow(row) {
  const name = String(row?.name ?? '').trim();
  const score = roundScore(row?.score);
  return DEFAULT_NAME_SET.has(name) && LEGACY_SCORE_SET.has(score);
}

function sanitizeBoard(rows, mission) {
  const fallback = defaultBoard(mission);
  if (!Array.isArray(rows) || rows.length === 0) return fallback;

  const cleaned = rows
    .map((row) => ({
      name: String(row?.name ?? '').trim().slice(0, 16) || 'Hunter',
      score: roundScore(row?.score),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  while (cleaned.length < 10) {
    const i = cleaned.length;
    cleaned.push({ name: DEFAULT_BOARD_NAMES[i], score: fallback[i].score });
  }
  cleaned.length = 10;
  return cleaned;
}

/**
 * Drop legacy 2000-era filler rows, keep real player rows, then re-pad with
 * the current per-mission defaults so unlock top-3 targets stay reachable.
 */
export function migrateBoardRows(rows, mission) {
  const kept = Array.isArray(rows) ? rows.filter((row) => !isLegacyFillerRow(row)) : [];
  if (kept.length === 0) return defaultBoard(mission);

  const playerRows = kept.map((row) => ({
    name: String(row?.name ?? '').trim().slice(0, 16) || 'Hunter',
    score: roundScore(row?.score),
  }));
  const fillers = defaultBoard(mission);
  const merged = [...playerRows, ...fillers]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  merged.length = 10;
  return merged;
}

/**
 * Per-mission top-10 boards persisted in localStorage.
 * Empty boards start with per-mission default filler names/scores; player
 * scores merge in via submit() as before.
 * `playerBests` tracks the local player's best cleared run (not board #1).
 */
export class Scoreboard {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.boards = new Map();
    this.completed = new Set();
    this.playerBests = new Map();
    this.load();
    for (const mission of MISSIONS) this.ensure(mission.id);
  }

  load() {
    const version = readVersion(this.storage);
    const boards = readJson(this.storage, STORAGE_KEYS.boards, {});
    if (boards && typeof boards === 'object') {
      for (const [missionId, rows] of Object.entries(boards)) {
        const mission = MISSION_BY_ID.get(missionId) ?? { id: missionId, count: 1, minDistance: 0 };
        if (version < BOARD_STORAGE_VERSION) {
          this.boards.set(missionId, migrateBoardRows(rows, mission));
        } else {
          this.boards.set(missionId, sanitizeBoard(rows, mission));
        }
      }
    }

    const completed = readJson(this.storage, STORAGE_KEYS.completed, []);
    if (Array.isArray(completed)) {
      for (const id of completed) this.completed.add(String(id));
    }

    const bests = readJson(this.storage, STORAGE_KEYS.playerBests, {});
    if (bests && typeof bests === 'object') {
      for (const [missionId, entry] of Object.entries(bests)) {
        const score = roundScore(entry?.score);
        const name = String(entry?.name ?? '').trim().slice(0, 16) || 'You';
        this.playerBests.set(missionId, { name, score });
      }
    }

    if (version < BOARD_STORAGE_VERSION) {
      this.save();
      writeVersion(this.storage, BOARD_STORAGE_VERSION);
    } else if (this.storage?.getItem?.(STORAGE_KEYS.boardsVersion) == null) {
      writeVersion(this.storage, BOARD_STORAGE_VERSION);
    }
  }

  save() {
    const boards = {};
    for (const [missionId, rows] of this.boards) {
      boards[missionId] = rows.map((row) => ({ name: row.name, score: row.score }));
    }
    writeJson(this.storage, STORAGE_KEYS.boards, boards);
    writeJson(this.storage, STORAGE_KEYS.completed, [...this.completed]);
    const bests = {};
    for (const [missionId, entry] of this.playerBests) {
      bests[missionId] = { name: entry.name, score: entry.score };
    }
    writeJson(this.storage, STORAGE_KEYS.playerBests, bests);
    writeVersion(this.storage, BOARD_STORAGE_VERSION);
  }

  ensure(missionId) {
    if (!this.boards.has(missionId)) {
      const mission = MISSION_BY_ID.get(missionId) ?? { id: missionId, count: 1, minDistance: 0 };
      this.boards.set(missionId, defaultBoard(mission));
    }
    return this.boards.get(missionId);
  }

  /** Ranked copy of the top 10 for a mission. */
  list(missionId) {
    return this.ensure(missionId).map((entry) => ({ ...entry }));
  }

  /** Board #1 (may be a default placeholder entry). */
  best(missionId) {
    return this.list(missionId)[0] ?? null;
  }

  /** Local player's best cleared score for the mission list. */
  playerBest(missionId) {
    const entry = this.playerBests.get(missionId);
    return entry ? { ...entry } : null;
  }

  isCompleted(missionId) {
    return this.completed.has(missionId);
  }

  markCompleted(missionId) {
    this.completed.add(missionId);
    this.save();
  }

  /**
   * Keeps the highest score the local player's earned on a cleared run.
   * Optional name updates when this run is best (or ties the best).
   */
  recordPlayerBest(missionId, score, name = null) {
    const nextScore = Math.round(Number(score) || 0);
    const safeName = String(name ?? '').trim().slice(0, 16);
    const prev = this.playerBests.get(missionId);
    if (!prev || nextScore > prev.score) {
      this.playerBests.set(missionId, {
        name: safeName || prev?.name || 'You',
        score: nextScore,
      });
      this.save();
      return;
    }
    if (nextScore === prev.score && safeName) {
      this.playerBests.set(missionId, { name: safeName, score: nextScore });
      this.save();
    }
  }

  /** True when score beats the current 10th place (strictly greater). */
  qualifies(missionId, score) {
    const board = this.ensure(missionId);
    return Number(score) > board[board.length - 1].score;
  }

  /**
   * Inserts a scored run and keeps the best 10.
   * Returns the 1-based rank of the new entry, or 0 if it did not place.
   */
  submit(missionId, name, score) {
    const board = this.ensure(missionId);
    const safeName = String(name ?? '').trim().slice(0, 16) || 'Hunter';
    const entry = { name: safeName, score: Math.round(Number(score) || 0) };
    board.push(entry);
    board.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    if (board.length > 10) board.length = 10;
    const rank = board.findIndex((row) => row === entry) + 1;
    this.save();
    return rank;
  }

  /** Restore every Top 10 board to per-mission defaults. */
  resetHighscores() {
    this.boards.clear();
    for (const mission of MISSIONS) this.ensure(mission.id);
    this.save();
  }

  /**
   * Clear completion markers and player bests so unlock progress returns to
   * the starting locked state. Tutorial / Free Play stay available.
   */
  resetMissions() {
    this.completed.clear();
    this.playerBests.clear();
    this.save();
  }
}
