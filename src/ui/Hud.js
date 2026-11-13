import { WEAPON } from '../config.js';
import {
  MISSION_PENALTY,
  MISSIONS,
  formatAccuracy,
  formatClock,
  formatLongest,
  formatPenalties,
  formatScore,
  formatTimeReport,
  penaltyRule,
  speciesLabel,
} from '../missions.js';

const asset = (file) => `${import.meta.env.BASE_URL}ui/${file}`;

const BULLET_LIVE = asset('bullet-live.svg');
const BULLET_SPENT = asset('bullet-spent.svg');
const MAGAZINE = asset('magazine.svg');

function compassCardinal(deg) {
  const wedge = ((deg + 45) % 360) / 90;
  return ['N', 'E', 'S', 'W'][Math.floor(wedge)];
}

export class Hud {
  constructor(handlers = {}, root = document) {
    this.handlers = handlers;
    this.ready = false;
    this.mission = null;
    this.scoreboard = handlers.scoreboard ?? null;
    const $ = (id) => root.getElementById(id);
    this.el = {
      ui: $('ui'),
      score: $('score'),
      ammoRounds: $('ammo-rounds'),
      ammoMags: $('ammo-mags'),
      ammoStatus: $('ammo-status'),
      distance: $('distance'),
      zoom: $('zoom'),
      stand: $('stand'),
      compass: $('compass'),
      compassDial: $('compass-dial'),
      compassLabel: $('compass-label'),
      crosshair: $('crosshair'),
      scope: $('scope'),
      instructions: $('instructions'),
      objective: $('objective'),
      timer: $('timer'),
      rule: $('rule'),
      menu: $('menu'),
      menuStatus: $('menu-status'),
      missionList: $('mission-list'),
      freePlay: $('free-play'),
      results: $('results'),
      kicker: $('results-kicker'),
      heading: $('results-heading'),
      resultsObjective: $('results-objective'),
      detail: $('results-detail'),
      accuracy: $('results-accuracy'),
      longest: $('results-longest'),
      time: $('results-time'),
      resultsScore: $('results-score'),
      penalties: $('results-penalties'),
      resultsBoard: $('results-board'),
      retry: $('results-retry'),
      next: $('results-next'),
      menuButton: $('results-menu'),
      resultsFree: $('results-free'),
      nameEntry: $('name-entry'),
      nameDetail: $('name-entry-detail'),
      nameInput: $('name-entry-input'),
      nameSubmit: $('name-entry-submit'),
      quitConfirm: $('quit-confirm'),
    };
    this._compassDeg = null;
    this._ammoKey = '';
    this._pendingResults = null;
    this.instructionsText = this.el.instructions.textContent;
    this.renderMissions();
    this.bindOverlay();
    this.setOverlay(true);
    this.setAmmo(WEAPON.magazineSize, WEAPON.spareMagazines, false);
  }

  renderMissions() {
    const list = this.el.missionList;
    list.replaceChildren();
    const board = this.scoreboard;
    MISSIONS.forEach((mission, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mission';
      button.disabled = !this.ready;

      const title = document.createElement('span');
      title.className = 'mission-title';
      title.textContent = mission.title;

      const objective = document.createElement('span');
      objective.className = 'mission-objective';
      objective.textContent = mission.objective;

      const time = document.createElement('span');
      time.className = 'mission-time';
      time.textContent = formatClock(mission.seconds);

      button.append(title, objective, time);

      if (board?.isCompleted(mission.id)) {
        button.classList.add('is-completed');
        const best = board.best(mission.id);
        const meta = document.createElement('span');
        meta.className = 'mission-meta';
        meta.textContent = best
          ? `Completed · Best ${formatScore(best.score)} · ${best.name}`
          : 'Completed';
        button.append(meta);
      }

      button.addEventListener('click', () => {
        button.blur();
        this.handlers.onMission?.(index);
      });
      list.append(button);
    });
  }

  bindOverlay() {
    const stop = (event) => event.stopPropagation();
    for (const overlay of [this.el.menu, this.el.results, this.el.nameEntry, this.el.quitConfirm]) {
      overlay.addEventListener('click', stop);
      overlay.addEventListener('mousedown', stop);
    }
    this.el.freePlay.addEventListener('click', () => {
      this.el.freePlay.blur();
      this.handlers.onFreePlay?.();
    });
    this.el.retry.addEventListener('click', () => {
      this.el.retry.blur();
      this.handlers.onRetry?.();
    });
    this.el.next.addEventListener('click', () => {
      this.el.next.blur();
      this.handlers.onNext?.();
    });
    this.el.menuButton.addEventListener('click', () => {
      this.el.menuButton.blur();
      this.handlers.onMenu?.();
    });
    this.el.resultsFree.addEventListener('click', () => {
      this.el.resultsFree.blur();
      this.handlers.onFreePlay?.();
    });
    this.el.nameSubmit.addEventListener('click', () => this.submitNameEntry());
    this.el.nameInput.addEventListener('keydown', (event) => {
      if (event.code === 'Enter') {
        event.preventDefault();
        this.submitNameEntry();
      }
    });
  }

  setOverlay(open) {
    this.el.ui.classList.toggle('overlay-open', open);
  }

  setScore(score) {
    this.el.score.textContent = `Score: ${formatScore(score)}`;
  }

  /**
   * Visual ammo rack to the right of the scoreboard.
   * Live/spent bullet icons for the seated magazine; one magazine icon per spare.
   * Reload removes a spare from the right; loot grants append spares again.
   */
  setAmmo(rounds, spares, reloading) {
    const capacity = WEAPON.magazineSize;
    const live = Math.max(0, Math.min(capacity, rounds | 0));
    const spareCount = Math.max(0, spares | 0);
    const key = `${live}/${capacity}:${spareCount}:${reloading ? 1 : 0}`;
    if (key === this._ammoKey) return;
    this._ammoKey = key;

    const roundsRow = this.el.ammoRounds;
    roundsRow.replaceChildren();
    for (let i = 0; i < capacity; i++) {
      const img = document.createElement('img');
      const spent = i >= live;
      img.className = spent ? 'ammo-bullet is-spent' : 'ammo-bullet';
      img.src = spent ? BULLET_SPENT : BULLET_LIVE;
      img.alt = spent ? 'Spent round' : 'Round';
      img.width = 14;
      img.height = 36;
      img.draggable = false;
      roundsRow.append(img);
    }

    const magsRow = this.el.ammoMags;
    magsRow.replaceChildren();
    for (let i = 0; i < spareCount; i++) {
      const img = document.createElement('img');
      img.className = 'ammo-mag';
      img.src = MAGAZINE;
      img.alt = 'Spare magazine';
      img.width = 22;
      img.height = 30;
      img.draggable = false;
      magsRow.append(img);
    }

    this.el.ammoStatus.hidden = !reloading;
  }

  setPickup(points, magazines) {
    this.el.distance.classList.remove('penalty');
    const mags = magazines === 1 ? '+1 spare mag' : `+${magazines} spare mags`;
    this.el.distance.textContent = `Loot: ${mags} · +${points}`;
  }

  setBlocked(surface, distance) {
    this.el.distance.classList.remove('penalty');
    this.el.distance.textContent = `Blocked by ${surface}: ${distance.toFixed(1)}m`;
  }

  setDistance(distance, zone, { premium = false, points = null } = {}) {
    this.el.distance.classList.remove('penalty');
    if (distance == null) {
      this.el.distance.textContent = 'Distance: —';
      return;
    }
    if (premium) {
      const bits = ['Premium', `${distance.toFixed(1)}m`];
      if (zone === 'head') bits.push('head shot');
      if (points != null) bits.push(`+${points}`);
      this.el.distance.textContent = bits.join(' · ');
      return;
    }
    const suffix = zone === 'head' ? ' · head shot' : '';
    this.el.distance.textContent = `Distance: ${distance.toFixed(1)}m${suffix}`;
  }

  setPenalty(grade, animalType, distance, mission) {
    this.el.distance.classList.add('penalty');
    if (grade === 'wrong-species') {
      const name = speciesLabel(animalType);
      this.el.distance.textContent = `Penalty −${MISSION_PENALTY} · ${name} is not the objective · does not count`;
      return;
    }
    this.el.distance.textContent = `Penalty −${MISSION_PENALTY} · ${distance.toFixed(1)} m is not over ${mission.minDistance} m · does not count`;
  }

  hideTransientOverlays() {
    this.el.nameEntry.hidden = true;
    this.el.quitConfirm.hidden = true;
    this._pendingResults = null;
  }

  showMenu() {
    this.mission = null;
    this.hideTransientOverlays();
    this.el.menu.hidden = false;
    this.el.results.hidden = true;
    this.el.objective.hidden = true;
    this.el.timer.hidden = true;
    this.el.rule.hidden = true;
    this.renderMissions();
    this.setOverlay(true);
  }

  showMission(mission, progress, timeLeft) {
    this.mission = mission;
    this.hideTransientOverlays();
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.objective.hidden = false;
    this.el.timer.hidden = false;
    this.el.rule.hidden = false;
    this.el.rule.textContent = penaltyRule(mission);
    this.setProgress(progress);
    this.setTimer(timeLeft);
    this.setOverlay(false);
  }

  showFreePlay() {
    this.mission = null;
    this.hideTransientOverlays();
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.objective.hidden = true;
    this.el.timer.hidden = true;
    this.el.rule.hidden = true;
    this.setOverlay(false);
  }

  showQuitConfirm() {
    this.el.quitConfirm.hidden = false;
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.nameEntry.hidden = true;
    this.setOverlay(true);
  }

  hideQuitConfirm() {
    this.el.quitConfirm.hidden = true;
    this.setOverlay(false);
  }

  setProgress(progress) {
    const { objective, count } = this.mission;
    this.el.objective.textContent = `Objective: ${objective} · ${progress}/${count}`;
  }

  setTimer(seconds) {
    this.el.timer.textContent = `Time: ${formatClock(seconds)}`;
  }

  renderScoreBoard(missionId, highlightName = null, highlightScore = null) {
    const board = this.el.resultsBoard;
    board.replaceChildren();
    const heading = document.createElement('p');
    heading.className = 'score-board-title';
    heading.textContent = 'Top 10';
    board.append(heading);

    const rows = this.scoreboard?.list(missionId) ?? [];
    const table = document.createElement('ol');
    table.className = 'score-board-list';
    rows.forEach((entry, index) => {
      const li = document.createElement('li');
      const isHighlight =
        highlightName != null
        && entry.name === highlightName
        && entry.score === highlightScore
        && index === rows.findIndex((row) => row.name === highlightName && row.score === highlightScore);
      if (isHighlight) li.classList.add('is-player');
      const rank = document.createElement('span');
      rank.className = 'score-rank';
      rank.textContent = String(index + 1);
      const name = document.createElement('span');
      name.className = 'score-name';
      name.textContent = entry.name;
      const points = document.createElement('span');
      points.className = 'score-points';
      points.textContent = formatScore(entry.score);
      li.append(rank, name, points);
      table.append(li);
    });
    board.append(table);
  }

  /**
   * After a mission ends: if the run qualifies for the top 10, ask for a name
   * first; otherwise open the results panel with the board.
   */
  presentMissionEnd(payload) {
    this._pendingResults = payload;
    const { mission, score, success } = payload;
    if (success) this.scoreboard?.markCompleted(mission.id);

    if (this.scoreboard?.qualifies(mission.id, score)) {
      this.el.menu.hidden = true;
      this.el.results.hidden = true;
      this.el.quitConfirm.hidden = true;
      this.el.nameEntry.hidden = false;
      this.el.nameDetail.textContent = `Score ${formatScore(score)} made the board. Enter a name to save it.`;
      this.el.nameInput.value = '';
      this.setOverlay(true);
      queueMicrotask(() => this.el.nameInput.focus());
      return;
    }

    this.flushPendingResults();
  }

  submitNameEntry() {
    const pending = this._pendingResults;
    if (!pending || this.el.nameEntry.hidden) return;
    const name = this.el.nameInput.value;
    this.scoreboard?.submit(pending.mission.id, name, pending.score);
    pending.highlightName = String(name ?? '').trim().slice(0, 16) || 'Hunter';
    pending.highlightScore = Math.round(Number(pending.score) || 0);
    this.el.nameEntry.hidden = true;
    this.flushPendingResults();
  }

  flushPendingResults() {
    const pending = this._pendingResults;
    if (!pending) return;
    this._pendingResults = null;
    this.showResults(pending);
  }

  showResults({
    success,
    mission,
    progress,
    hits,
    shots,
    longest,
    timeLeft,
    timeUsed,
    score,
    penalties,
    hasNext,
    highlightName = null,
    highlightScore = null,
  }) {
    this.el.menu.hidden = true;
    this.el.nameEntry.hidden = true;
    this.el.quitConfirm.hidden = true;
    this.el.results.hidden = false;
    this.el.kicker.textContent = mission.title;
    this.el.heading.textContent = success ? 'Success' : 'Failed';
    this.el.heading.classList.toggle('success', success);
    this.el.heading.classList.toggle('fail', !success);
    this.el.resultsObjective.textContent = mission.objective;
    this.el.detail.textContent = success
      ? 'Objective complete.'
      : `Time ran out · ${progress}/${mission.count}`;
    this.el.accuracy.textContent = formatAccuracy(hits, shots);
    this.el.longest.textContent = formatLongest(longest);
    this.el.time.textContent = formatTimeReport(timeLeft, timeUsed);
    this.el.resultsScore.textContent = formatScore(score);
    this.el.penalties.textContent = formatPenalties(penalties);
    this.el.next.hidden = !hasNext;
    this.renderScoreBoard(mission.id, highlightName, highlightScore);
    this.setOverlay(true);
  }

  setLoading(loaded, total) {
    const text = `Loading models… ${loaded}/${total}`;
    this.el.instructions.textContent = text;
    this.el.menuStatus.hidden = false;
    this.el.menuStatus.textContent = text;
  }

  setReady() {
    this.ready = true;
    this.el.instructions.textContent = this.instructionsText;
    this.el.menuStatus.hidden = true;
    this.el.freePlay.disabled = false;
    this.renderMissions();
  }

  setError(message) {
    this.el.instructions.textContent = message;
    this.el.instructions.style.opacity = '1';
    this.el.menuStatus.hidden = false;
    this.el.menuStatus.textContent = message;
  }

  setZoom(zoom) {
    this.el.zoom.textContent = `Zoom: ${zoom.toFixed(1)}x`;
  }

  setStand(label) {
    this.el.stand.textContent = label;
  }

  /**
   * headingRad: 0 = north (-Z), increasing toward east (+X).
   * Rotates the dial so the look direction stays under the top notch.
   */
  setCompass(headingRad) {
    const deg = ((headingRad * 180) / Math.PI + 360) % 360;
    const rounded = Math.round(deg);
    if (rounded === this._compassDeg) return;
    this._compassDeg = rounded;
    this.el.compassDial.style.transform = `rotate(${-deg}deg)`;
    this.el.compassLabel.textContent = compassCardinal(deg);
  }

  setScoped(scoped) {
    this.el.scope.classList.toggle('active', scoped);
    this.el.crosshair.classList.toggle('hidden', scoped);
  }

  setLocked(locked) {
    this.el.instructions.style.opacity = locked ? '0.3' : '0.7';
  }
}
