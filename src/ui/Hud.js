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
      retry: $('results-retry'),
      next: $('results-next'),
      menuButton: $('results-menu'),
      resultsFree: $('results-free'),
    };
    this._compassDeg = null;
    this._ammoKey = '';
    this.instructionsText = this.el.instructions.textContent;
    this.renderMissions();
    this.bindOverlay();
    this.setOverlay(true);
    this.setAmmo(WEAPON.magazineSize, WEAPON.spareMagazines, false);
  }

  renderMissions() {
    const list = this.el.missionList;
    list.replaceChildren();
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
      button.addEventListener('click', () => {
        button.blur();
        this.handlers.onMission?.(index);
      });
      list.append(button);
    });
  }

  bindOverlay() {
    const stop = (event) => event.stopPropagation();
    for (const overlay of [this.el.menu, this.el.results]) {
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

  showMenu() {
    this.mission = null;
    this.el.menu.hidden = false;
    this.el.results.hidden = true;
    this.el.objective.hidden = true;
    this.el.timer.hidden = true;
    this.el.rule.hidden = true;
    this.setOverlay(true);
  }

  showMission(mission, progress, timeLeft) {
    this.mission = mission;
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
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.objective.hidden = true;
    this.el.timer.hidden = true;
    this.el.rule.hidden = true;
    this.setOverlay(false);
  }

  setProgress(progress) {
    const { objective, count } = this.mission;
    this.el.objective.textContent = `Objective: ${objective} · ${progress}/${count}`;
  }

  setTimer(seconds) {
    this.el.timer.textContent = `Time: ${formatClock(seconds)}`;
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
  }) {
    this.el.menu.hidden = true;
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
    for (const button of this.el.missionList.querySelectorAll('button')) button.disabled = false;
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
