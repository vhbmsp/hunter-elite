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

function defaultBoard() {
  return DEFAULT_BOARD_NAMES.map((name, i) => ({
    name,
    score: DEFAULT_BOARD_SCORES[i],
  }));
}

/**
 * In-memory per-mission top-10 boards. Resets when the page reloads.
 * Each mission starts with the same default names and scores.
 */
export class Scoreboard {
  constructor() {
    this.boards = new Map();
    this.completed = new Set();
    for (const mission of MISSIONS) this.ensure(mission.id);
  }

  ensure(missionId) {
    if (!this.boards.has(missionId)) this.boards.set(missionId, defaultBoard());
    return this.boards.get(missionId);
  }

  /** Ranked copy of the top 10 for a mission. */
  list(missionId) {
    return this.ensure(missionId).map((entry) => ({ ...entry }));
  }

  best(missionId) {
    return this.list(missionId)[0] ?? null;
  }

  isCompleted(missionId) {
    return this.completed.has(missionId);
  }

  markCompleted(missionId) {
    this.completed.add(missionId);
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
    return rank;
  }
}
