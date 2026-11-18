import { WEAPON } from '../config.js';
import {
  MISSION_PENALTY,
  MISSIONS,
  formatAccuracy,
  formatClock,
  formatLongest,
  formatPenalties,
  formatScore,
  formatTimeBonus,
  formatTimeReport,
  penaltyRule,
  speciesLabel,
} from '../missions.js';
import { themeLabel } from '../theme.js';
import {
  isMissionUnlocked,
  nextUnlockedIndex,
  unlockHint,
  unlockProgress,
  winterUnlocked,
} from '../unlocks.js';
import { Minimap } from './Minimap.js';

const asset = (file) => `${import.meta.env.BASE_URL}ui/${file}`;

const BULLET_LIVE = asset('bullet-live.svg');
const BULLET_SPENT = asset('bullet-spent.svg');
const MAGAZINE = asset('magazine.svg');

const HOME_LEDE =
  'Choose a tutorial, a pack, or free play. Top 10 boards are saved in this browser.';

const SETTINGS_LEDE =
  'Clear saved progress in this browser. Tutorial and Free Play stay available after a mission reset.';

const LOCK_ICON_SVG =
  '<svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
  'd="M8 11V8a4 4 0 0 1 8 0v3"/>' +
  '<rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<circle cx="12" cy="16" r="1.25" fill="currentColor"/>' +
  '</svg>';

const MENU_PACKS = [
  {
    id: 'summer',
    title: 'Summer pack',
    heading: 'Summer pack',
    lede: 'Main hunting missions. Clear objectives before time runs out.',
    filter: (mission) => mission.pack === 'main' && !mission.tutorial,
  },
  {
    id: 'winter',
    title: 'Winter pack',
    heading: 'Winter pack',
    lede: 'Snow missions unlocked after Top 3 placements on the Summer pack.',
    filter: (mission) => mission.pack === 'winter',
  },
];

function compassCardinal(deg) {
  const wedge = ((deg + 45) % 360) / 90;
  return ['N', 'E', 'S', 'W'][Math.floor(wedge)];
}

function findPack(packId) {
  return MENU_PACKS.find((pack) => pack.id === packId) ?? null;
}

function createLockIcon() {
  const wrap = document.createElement('span');
  wrap.className = 'lock-icon-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = LOCK_ICON_SVG;
  return wrap;
}

export class Hud {
  constructor(handlers = {}, root = document) {
    this.handlers = handlers;
    this.ready = false;
    this.mission = null;
    this.menuView = { kind: 'home' };
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
      scopeZoom: $('scope-zoom'),
      stand: $('stand'),
      compass: $('compass'),
      compassDial: $('compass-dial'),
      compassLabel: $('compass-label'),
      minimap: $('minimap'),
      crosshair: $('crosshair'),
      scope: $('scope'),
      instructions: $('instructions'),
      objective: $('objective'),
      timer: $('timer'),
      rule: $('rule'),
      menu: $('menu'),
      menuHeading: $('menu-heading'),
      menuLede: $('menu-lede'),
      menuStatus: $('menu-status'),
      unlockProgress: $('unlock-progress'),
      menuHome: $('menu-home'),
      menuNav: $('menu-nav'),
      freePlayHint: $('free-play-hint'),
      menuPack: $('menu-pack'),
      missionList: $('mission-list'),
      menuBack: $('menu-back'),
      menuSettings: $('menu-settings'),
      settingsList: $('settings-list'),
      menuSettingsBack: $('menu-settings-back'),
      results: $('results'),
      kicker: $('results-kicker'),
      heading: $('results-heading'),
      resultsObjective: $('results-objective'),
      detail: $('results-detail'),
      accuracy: $('results-accuracy'),
      longest: $('results-longest'),
      time: $('results-time'),
      timeBonus: $('results-time-bonus'),
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
      boardView: $('board-view'),
      boardViewKicker: $('board-view-kicker'),
      boardViewList: $('board-view-list'),
      boardViewClose: $('board-view-close'),
    };
    this._compassDeg = null;
    this._ammoKey = '';
    this._pendingResults = null;
    this.minimap = this.el.minimap ? new Minimap(this.el.minimap) : null;
    this.instructionsText = this.el.instructions.textContent;
    this.renderMenu();
    this.bindOverlay();
    this.setOverlay(true);
    this.setAmmo(WEAPON.magazineSize, WEAPON.spareMagazines, false);
  }

  /** Bake tower markers + static tree dots after scenery is placed. */
  initMinimap(treePositions) {
    this.minimap?.init(treePositions);
  }

  /** Mission objective markers on the minimap; empty clears (Free Play / menu). */
  setMinimapGoals(points = []) {
    this.minimap?.setGoals(points);
  }

  renderUnlockProgress() {
    const el = this.el.unlockProgress;
    if (!el) return;
    const board = this.scoreboard;
    if (!board) {
      el.hidden = true;
      return;
    }
    const progress = unlockProgress(board);
    const lines = [];
    if (!progress.mainMoreUnlocked) {
      lines.push(`Top 3 on ${progress.top3}/${progress.mainMoreNeed} Summer missions to unlock more`);
    } else if (!progress.winterUnlocked) {
      lines.push('Summer pack fully unlocked');
      lines.push(`Top 3 on ${progress.top3}/${progress.winterNeed} for Winter`);
    } else {
      lines.push('Summer pack and Winter unlocked');
      lines.push(`Top 3 on ${progress.top3} Summer missions`);
    }
    el.hidden = false;
    el.textContent = lines.join(' · ');
  }

  packMissions(pack) {
    return MISSIONS.map((mission, index) => ({ mission, index })).filter(({ mission }) =>
      pack.filter(mission),
    );
  }

  packProgressLabel(pack) {
    const board = this.scoreboard;
    const entries = this.packMissions(pack);
    const total = entries.length;
    const unlocked = entries.filter(({ mission }) => isMissionUnlocked(mission, board)).length;
    const completed = entries.filter(({ mission }) => board?.isCompleted(mission.id)).length;
    if (pack.id === 'winter' && board && !winterUnlocked(board)) {
      const { top3, winterNeed } = unlockProgress(board);
      return `Locked · Top 3 on ${top3}/${winterNeed} Summer missions`;
    }
    return `${completed}/${total} completed · ${unlocked}/${total} unlocked`;
  }

  tutorialIndex() {
    return MISSIONS.findIndex((mission) => mission.tutorial);
  }

  renderMissionRow(mission, index) {
    const board = this.scoreboard;
    const unlocked = isMissionUnlocked(mission, board);
    const row = document.createElement('div');
    row.className = 'mission-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mission';
    button.disabled = !this.ready || !unlocked;
    if (!unlocked) button.classList.add('is-locked');

    const title = document.createElement('span');
    title.className = 'mission-title';
    if (!unlocked) {
      title.append(createLockIcon());
      title.append(document.createTextNode(mission.title));
    } else {
      title.textContent = mission.title;
    }

    const objective = document.createElement('span');
    objective.className = 'mission-objective';
    objective.textContent = mission.objective;

    const time = document.createElement('span');
    time.className = 'mission-time';
    time.textContent = formatClock(mission.seconds);

    button.append(title, objective, time);

    if (!unlocked) {
      const lock = document.createElement('span');
      lock.className = 'mission-lock-hint';
      lock.textContent = unlockHint(mission, board);
      button.append(lock);
    } else if (board?.isCompleted(mission.id)) {
      button.classList.add('is-completed');
      // Show the local player's best cleared run, not the default board #1.
      const best = board.playerBest(mission.id);
      const meta = document.createElement('span');
      meta.className = 'mission-meta';
      meta.textContent = best
        ? `Completed · Your best ${formatScore(best.score)} · ${best.name}`
        : 'Completed';
      button.append(meta);
    }

    button.addEventListener('click', () => {
      if (!unlocked) return;
      button.blur();
      this.handlers.onMission?.(index);
    });

    const topTen = document.createElement('button');
    topTen.type = 'button';
    topTen.className = 'mission-board';
    topTen.textContent = 'Top 10';
    topTen.disabled = !this.ready;
    topTen.title = `View top 10 for ${mission.title}`;
    topTen.addEventListener('click', (event) => {
      event.stopPropagation();
      topTen.blur();
      this.showBoardView(mission);
    });

    row.append(button, topTen);
    return row;
  }

  renderHomeNavButton({ title, meta, locked = false, play = false, onClick }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = play ? 'menu-nav-button menu-nav-play' : 'menu-nav-button';
    button.disabled = !this.ready;
    if (locked) button.classList.add('is-locked');

    const titleEl = document.createElement('span');
    titleEl.className = 'menu-nav-title';
    if (locked) {
      titleEl.append(createLockIcon());
      titleEl.append(document.createTextNode(title));
    } else {
      titleEl.textContent = title;
    }

    const metaEl = document.createElement('span');
    metaEl.className = 'menu-nav-meta';
    metaEl.textContent = meta;

    button.append(titleEl, metaEl);

    if (!play) {
      const chevron = document.createElement('span');
      chevron.className = 'menu-nav-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      button.append(chevron);
    }

    button.addEventListener('click', () => {
      button.blur();
      onClick?.();
    });
    return button;
  }

  setMenuPanels({ home = false, pack = false, settings = false } = {}) {
    if (this.el.menuHome) this.el.menuHome.hidden = !home;
    if (this.el.menuPack) this.el.menuPack.hidden = !pack;
    if (this.el.menuSettings) this.el.menuSettings.hidden = !settings;
  }

  renderHome() {
    this.menuView = { kind: 'home' };
    this.setMenuPanels({ home: true });
    this.el.menuHeading.textContent = 'Missions';
    this.el.menuLede.textContent = HOME_LEDE;
    if (this.el.freePlayHint) this.el.freePlayHint.hidden = false;
    this.renderUnlockProgress();

    const nav = this.el.menuNav;
    nav.replaceChildren();

    const tutorialIndex = this.tutorialIndex();
    const tutorial = tutorialIndex >= 0 ? MISSIONS[tutorialIndex] : null;
    if (tutorial) {
      const board = this.scoreboard;
      const completed = board?.isCompleted(tutorial.id);
      const best = completed ? board.playerBest(tutorial.id) : null;
      const tutorialMeta = best
        ? `Completed · Your best ${formatScore(best.score)}`
        : completed
          ? 'Completed · Practice fire, reload, and towers'
          : 'Practice fire, reload, and tower switches';

      const tutorialRow = document.createElement('div');
      tutorialRow.className = 'mission-row';

      const start = this.renderHomeNavButton({
        title: 'Tutorial mission',
        meta: tutorialMeta,
        play: true,
        onClick: () => this.handlers.onMission?.(tutorialIndex),
      });
      start.classList.toggle('is-completed', Boolean(completed));

      const topTen = document.createElement('button');
      topTen.type = 'button';
      topTen.className = 'mission-board';
      topTen.textContent = 'Top 10';
      topTen.disabled = !this.ready;
      topTen.title = `View top 10 for ${tutorial.title}`;
      topTen.addEventListener('click', (event) => {
        event.stopPropagation();
        topTen.blur();
        this.showBoardView(tutorial);
      });

      tutorialRow.append(start, topTen);
      nav.append(tutorialRow);
    }

    for (const pack of MENU_PACKS) {
      const locked = pack.id === 'winter' && this.scoreboard && !winterUnlocked(this.scoreboard);
      nav.append(
        this.renderHomeNavButton({
          title: pack.title,
          meta: this.packProgressLabel(pack),
          locked,
          onClick: () => this.openPack(pack.id),
        }),
      );
    }

    nav.append(
      this.renderHomeNavButton({
        title: 'Free play',
        meta: 'Sandbox · random summer or winter terrain',
        play: true,
        onClick: () => this.handlers.onFreePlay?.(),
      }),
    );

    nav.append(
      this.renderHomeNavButton({
        title: 'Settings',
        meta: 'Reset highscores or mission progress',
        onClick: () => this.openSettings(),
      }),
    );
  }

  openPack(packId) {
    const pack = findPack(packId);
    if (!pack) return;
    this.menuView = { kind: 'pack', packId: pack.id };
    this.renderPack(pack);
  }

  openSettings() {
    this.menuView = { kind: 'settings' };
    this.renderSettings();
  }

  renderPack(pack) {
    this.setMenuPanels({ pack: true });
    this.el.menuHeading.textContent = pack.heading;
    this.el.menuLede.textContent = pack.lede;
    if (this.el.freePlayHint) this.el.freePlayHint.hidden = true;
    this.renderUnlockProgress();

    const list = this.el.missionList;
    list.replaceChildren();

    if (pack.id === 'winter' && this.scoreboard && !winterUnlocked(this.scoreboard)) {
      const hint = document.createElement('p');
      hint.className = 'mission-pack-hint';
      const { top3, winterNeed } = unlockProgress(this.scoreboard);
      hint.textContent = `Locked until Top 3 on ${top3}/${winterNeed} Summer hunting missions (tutorial does not count).`;
      list.append(hint);
    }

    for (const { mission, index } of this.packMissions(pack)) {
      list.append(this.renderMissionRow(mission, index));
    }
  }

  renderSettings() {
    this.setMenuPanels({ settings: true });
    this.el.menuHeading.textContent = 'Settings';
    this.el.menuLede.textContent = SETTINGS_LEDE;
    if (this.el.freePlayHint) this.el.freePlayHint.hidden = true;
    if (this.el.unlockProgress) this.el.unlockProgress.hidden = true;

    const list = this.el.settingsList;
    if (!list) return;
    list.replaceChildren();

    list.append(
      this.renderHomeNavButton({
        title: 'Reset highscores',
        meta: 'Restore every Top 10 board to the default ladder',
        play: true,
        onClick: () => this.confirmResetHighscores(),
      }),
      this.renderHomeNavButton({
        title: 'Reset missions',
        meta: 'Clear completions and unlocks; packs return to the starting locked state',
        play: true,
        onClick: () => this.confirmResetMissions(),
      }),
    );
  }

  confirmResetHighscores() {
    const ok = globalThis.confirm?.(
      'Reset all Top 10 highscores to defaults? This cannot be undone.',
    );
    if (!ok) return;
    this.scoreboard?.resetHighscores();
    this.menuView = { kind: 'home' };
    this.renderMenu();
  }

  confirmResetMissions() {
    const ok = globalThis.confirm?.(
      'Reset mission progress and unlocks? Packs and missions return to their starting locked state. Tutorial and Free Play stay available.',
    );
    if (!ok) return;
    this.scoreboard?.resetMissions();
    this.menuView = { kind: 'home' };
    this.renderMenu();
  }

  renderMenu() {
    if (this.menuView.kind === 'pack') {
      const pack = findPack(this.menuView.packId);
      if (pack) {
        this.renderPack(pack);
        return;
      }
      this.menuView = { kind: 'home' };
    }
    if (this.menuView.kind === 'settings') {
      this.renderSettings();
      return;
    }
    this.renderHome();
  }

  bindOverlay() {
    const stop = (event) => event.stopPropagation();
    for (const overlay of [
      this.el.menu,
      this.el.results,
      this.el.nameEntry,
      this.el.quitConfirm,
      this.el.boardView,
    ]) {
      overlay.addEventListener('click', stop);
      overlay.addEventListener('mousedown', stop);
    }
    this.el.menuBack.addEventListener('click', () => {
      this.el.menuBack.blur();
      this.menuView = { kind: 'home' };
      this.renderMenu();
    });
    this.el.menuSettingsBack?.addEventListener('click', () => {
      this.el.menuSettingsBack.blur();
      this.menuView = { kind: 'home' };
      this.renderMenu();
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
    this.el.boardViewClose.addEventListener('click', () => {
      this.el.boardViewClose.blur();
      this.hideBoardView();
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
    this.el.distance.hidden = false;
    const mags = magazines === 1 ? '+1 spare mag' : `+${magazines} spare mags`;
    this.el.distance.textContent = `Loot: ${mags} · +${points}`;
  }

  setBlocked(surface, distance) {
    this.el.distance.classList.remove('penalty');
    this.el.distance.hidden = false;
    this.el.distance.textContent = `Blocked by ${surface}: ${distance.toFixed(1)}m`;
  }

  setDistance(distance, zone, { premium = false, points = null } = {}) {
    this.el.distance.classList.remove('penalty');
    if (distance == null) {
      this.el.distance.hidden = true;
      this.el.distance.textContent = 'Distance: —';
      return;
    }
    this.el.distance.hidden = false;
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

  /**
   * Live ranging while scoped. Hidden when not scoped so hip-fire / overlays
   * can own the line for shot feedback.
   */
  setAimDistance(distance) {
    this.el.distance.classList.remove('penalty');
    this.el.distance.hidden = false;
    if (distance == null) {
      this.el.distance.textContent = 'Distance: —';
      return;
    }
    this.el.distance.textContent = `Distance: ${distance.toFixed(1)}m`;
  }

  /** Hide the ranging line when leaving the scope (unless shot feedback keeps it). */
  clearAimDistance() {
    this.el.distance.classList.remove('penalty');
    this.el.distance.hidden = true;
    this.el.distance.textContent = 'Distance: —';
  }

  setPenalty(grade, animalType, distance, mission) {
    this.el.distance.classList.add('penalty');
    this.el.distance.hidden = false;
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
    this.el.boardView.hidden = true;
    this._pendingResults = null;
  }

  showBoardView(mission) {
    this.el.boardViewKicker.textContent = mission.title;
    this.fillScoreBoard(this.el.boardViewList, mission.id);
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.nameEntry.hidden = true;
    this.el.quitConfirm.hidden = true;
    this.el.boardView.hidden = false;
    this.setOverlay(true);
  }

  hideBoardView() {
    this.el.boardView.hidden = true;
    this.el.menu.hidden = false;
    this.renderMenu();
    this.setOverlay(true);
  }

  showMenu() {
    this.mission = null;
    this.menuView = { kind: 'home' };
    this.hideTransientOverlays();
    this.el.menu.hidden = false;
    this.el.results.hidden = true;
    this.el.objective.hidden = true;
    this.el.timer.hidden = true;
    this.el.rule.hidden = true;
    this.renderMenu();
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

  showFreePlay(themeId = 'default') {
    this.mission = null;
    this.hideTransientOverlays();
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.objective.hidden = false;
    this.el.objective.textContent = `Season: ${themeLabel(themeId)}`;
    this.el.timer.hidden = true;
    this.el.rule.hidden = true;
    this.setOverlay(false);
  }

  showQuitConfirm() {
    this.el.quitConfirm.hidden = false;
    this.el.menu.hidden = true;
    this.el.results.hidden = true;
    this.el.nameEntry.hidden = true;
    this.el.boardView.hidden = true;
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

  fillScoreBoard(container, missionId, highlightName = null, highlightScore = null) {
    container.replaceChildren();
    const heading = document.createElement('p');
    heading.className = 'score-board-title';
    heading.textContent = 'Top 10';
    container.append(heading);

    const rows = this.scoreboard?.list(missionId) ?? [];
    const table = document.createElement('ol');
    table.className = 'score-board-list';
    const highlightAt = rows.findIndex(
      (row) => row.name === highlightName && row.score === highlightScore,
    );
    rows.forEach((entry, index) => {
      const li = document.createElement('li');
      if (highlightName != null && index === highlightAt) li.classList.add('is-player');
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
    container.append(table);
  }

  /**
   * After a mission ends: if the run qualifies for the top 10, ask for a name
   * first; otherwise open the results panel with the board.
   */
  presentMissionEnd(payload) {
    this._pendingResults = payload;
    const { mission, score, success } = payload;
    if (success) {
      this.scoreboard?.markCompleted(mission.id);
      // Record immediately so a non-qualifying clear still shows Your best on the menu.
      this.scoreboard?.recordPlayerBest(mission.id, score);
    }

    if (this.scoreboard?.qualifies(mission.id, score)) {
      this.el.menu.hidden = true;
      this.el.results.hidden = true;
      this.el.quitConfirm.hidden = true;
      this.el.boardView.hidden = true;
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
    if (pending.success) this.scoreboard?.recordPlayerBest(pending.mission.id, pending.score, name);
    pending.highlightName = String(name ?? '').trim().slice(0, 16) || 'Hunter';
    pending.highlightScore = Math.round(Number(pending.score) || 0);
    this.el.nameEntry.hidden = true;
    this.flushPendingResults();
  }

  flushPendingResults() {
    const pending = this._pendingResults;
    if (!pending) return;
    this._pendingResults = null;
    const index = MISSIONS.findIndex((mission) => mission.id === pending.mission.id);
    if (pending.success && index >= 0) {
      pending.hasNext = nextUnlockedIndex(index, this.scoreboard) >= 0;
    }
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
    timeBonus = 0,
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
    this.el.timeBonus.textContent = formatTimeBonus(timeBonus);
    this.el.resultsScore.textContent = formatScore(score);
    this.el.penalties.textContent = formatPenalties(penalties);
    this.el.next.hidden = !hasNext;
    this.fillScoreBoard(this.el.resultsBoard, mission.id, highlightName, highlightScore);
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
    this.renderMenu();
  }

  setError(message) {
    this.el.instructions.textContent = message;
    this.el.instructions.style.opacity = '1';
    this.el.menuStatus.hidden = false;
    this.el.menuStatus.textContent = message;
  }

  setZoom(zoom) {
    const rounded = Math.round(zoom * 10) / 10;
    const label = Number.isInteger(rounded) ? `${rounded}x` : `${rounded.toFixed(1)}x`;
    this.el.zoom.textContent = `Zoom: ${label}`;
    if (this.el.scopeZoom) this.el.scopeZoom.textContent = label;
  }

  setStand(label) {
    this.el.stand.textContent = label;
    this.minimap?.setActiveStand(label);
  }

  /**
   * headingRad: 0 = north (-Z), increasing toward east (+X).
   * Rotates the dial so the look direction stays under the top notch.
   * When x/z are provided, also updates the minimap player wedge.
   */
  setCompass(headingRad, x = null, z = null) {
    const deg = ((headingRad * 180) / Math.PI + 360) % 360;
    const rounded = Math.round(deg);
    if (rounded !== this._compassDeg) {
      this._compassDeg = rounded;
      this.el.compassDial.style.transform = `rotate(${-deg}deg)`;
      this.el.compassLabel.textContent = compassCardinal(deg);
    }
    if (x != null && z != null) {
      this.minimap?.setPlayer(x, z, headingRad);
    }
  }

  setScoped(scoped, magnification = null) {
    this.el.scope.classList.toggle('active', scoped);
    this.el.crosshair.classList.toggle('hidden', scoped);
    if (this.el.scopeZoom) {
      this.el.scopeZoom.hidden = !scoped;
      if (scoped && magnification != null) {
        this.el.scopeZoom.textContent = `${magnification}x`;
      }
    }
    // Ranging is scoped-only; hip-fire keeps the slot free for shot feedback.
    if (!scoped) this.clearAimDistance();
  }

  setLocked(locked) {
    this.el.instructions.style.opacity = locked ? '0.3' : '0.7';
  }
}
