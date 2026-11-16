import { MISSIONS } from './missions.js';

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

/** Default scores: 2000 down to 200 in steps of 200. */
export const DEFAULT_BOARD_SCORES = DEFAULT_BOARD_NAMES.map((_, i) => 2000 - i * 200);

/** localStorage keys — boards survive reload; documented in the PR. */
export const STORAGE_KEYS = {
  boards: 'hunter-elite.boards',
  completed: 'hunter-elite.completed',
  playerBests: 'hunter-elite.playerBests',
};

function defaultBoard() {
  return DEFAULT_BOARD_NAMES.map((name, i) => ({
    name,
    score: DEFAULT_BOARD_SCORES[i],
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

function sanitizeBoard(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return defaultBoard();
  const cleaned = rows
    .map((row) => ({
      name: String(row?.name ?? '').trim().slice(0, 16) || 'Hunter',
      score: Math.round(Number(row?.score) || 0),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  while (cleaned.length < 10) {
    const i = cleaned.length;
    cleaned.push({ name: DEFAULT_BOARD_NAMES[i], score: DEFAULT_BOARD_SCORES[i] });
  }
  cleaned.length = 10;
  return cleaned;
}

/**
 * Per-mission top-10 boards persisted in localStorage.
 * Empty boards start with the same default filler names/scores; player scores
 * merge in via submit() as before.
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
    const boards = readJson(this.storage, STORAGE_KEYS.boards, {});
    if (boards && typeof boards === 'object') {
      for (const [missionId, rows] of Object.entries(boards)) {
        this.boards.set(missionId, sanitizeBoard(rows));
      }
    }

    const completed = readJson(this.storage, STORAGE_KEYS.completed, []);
    if (Array.isArray(completed)) {
      for (const id of completed) this.completed.add(String(id));
    }

    const bests = readJson(this.storage, STORAGE_KEYS.playerBests, {});
    if (bests && typeof bests === 'object') {
      for (const [missionId, entry] of Object.entries(bests)) {
        const score = Math.round(Number(entry?.score) || 0);
        const name = String(entry?.name ?? '').trim().slice(0, 16) || 'You';
        this.playerBests.set(missionId, { name, score });
      }
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
  }

  ensure(missionId) {
    if (!this.boards.has(missionId)) this.boards.set(missionId, defaultBoard());
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
}
