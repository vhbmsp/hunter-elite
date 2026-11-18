import { DEFAULT_STAND_INDEX, FACING_YAW, LIGHTS, RENDERER, STANDS, WEAPON } from '../config.js';
import { Sfx } from '../audio/Sfx.js';
import { AnimalManager } from '../entities/AnimalManager.js';
import { AppleOrchard } from '../entities/AppleOrchard.js';
import { LootManager } from '../entities/LootManager.js';
import { toggleHitboxes } from '../entities/hitbox.js';
import { MISSION_PENALTY, MISSIONS, gradeKill } from '../missions.js';
import { Player } from '../player/Player.js';
import { Scope } from '../player/Scope.js';
import { Scoreboard } from '../scoreboard.js';
import { applySceneTheme, pickFreePlayTheme, themeForMission } from '../theme.js';
import { Hud } from '../ui/Hud.js';
import { isMissionUnlocked, nextUnlockedIndex } from '../unlocks.js';
import { aimFromCamera, castRay } from '../weapons/ballistics.js';
import { ImpactEffects } from '../weapons/impacts.js';
import { Rifle } from '../weapons/Rifle.js';
import { environmentModelUrls } from '../world/environment.js';
import { World } from '../world/World.js';
import { AssetLibrary } from './assets.js';
import { bindInput } from './input.js';
import { GameLoop } from './loop.js';
import { bindResize, createRenderer } from './renderer.js';
import { createScene } from './scene.js';
import { createScopePost } from './scopePost.js';

export class Game {
  constructor(container = document.body) {
    this.score = 0;
    this.loaded = false;
    this.mode = 'menu';
    this.mission = null;
    this.missionIndex = -1;
    this.progress = 0;
    this.timeLeft = 0;
    this.shots = 0;
    this.hits = 0;
    this.longest = 0;
    this.penalties = 0;
    this.resumeMode = null;
    this.freePlayTheme = 'default';
    this.scoreboard = new Scoreboard();

    this.renderer = createRenderer(container);
    const { scene, lights } = createScene();
    this.scene = scene;
    this.lights = lights;
    this.hud = new Hud({
      scoreboard: this.scoreboard,
      onMission: (index) => this.startMission(index),
      onFreePlay: () => this.startFreePlay(),
      onRetry: () => this.startMission(this.missionIndex),
      onNext: () => {
        const next = nextUnlockedIndex(this.missionIndex, this.scoreboard);
        if (next >= 0) this.startMission(next);
      },
      onMenu: () => this.showMenu(),
    });
    this.sfx = new Sfx();
    this.assets = new AssetLibrary((loaded, total) => this.hud.setLoading(loaded, total));

    this.world = new World(this.scene);
    this.player = new Player(this.renderer.domElement);
    this.applyStandFacing(DEFAULT_STAND_INDEX);
    // The muzzle flash is parented to the camera, so the camera has to live in the scene.
    this.scene.add(this.player.camera);
    this.scope = new Scope(this.player.camera, this.hud, this.player.controls);
    // Phase 5b: mild scoped bloom (DOF opt-in). Hip-fire stays a direct render.
    this.scopePost = createScopePost(this.renderer, this.scene, this.player.camera);
    this.impacts = new ImpactEffects(this.scene);
    this.animals = new AnimalManager(this.scene, this.player.camera, this.world);
    this.loot = new LootManager(this.scene, this.world);
    this.orchard = new AppleOrchard(this.scene, this.world);
    this.rifle = new Rifle(
      this.player.camera,
      this.animals,
      this.world,
      this.impacts,
      this.sfx,
      this.loot,
      this.orchard,
      this.scene,
    );
    this.rifle.onChange = () => this.syncAmmo();
    this.rifle.onImpact = (result) => this.resolveShot(result);
    this.rifle.shouldResolve = () => this.playing;
    this.syncAmmo();
    this.syncCompass();

    this.loop = new GameLoop(this.renderer, this.scene, this.player.camera, {
      render: () => this.scopePost.render(this.scope.active),
    })
      .add(this.world)
      .add(this.impacts)
      .add(this.loot)
      .add(this.rifle)
      .add(this.animals)
      .add(this.scope)
      .add(this);
  }

  get playing() {
    return this.mode === 'mission' || this.mode === 'free';
  }

  /**
   * Keep the sun shadow frustum centred on the player (LIGHTS.sun.shadowExtent).
   * LIGHTS.sun.position is treated as an offset from the look target so the sun
   * angle stays stable while Tower S (~120 m from origin) stays inside the map.
   */
  syncSunShadow() {
    const sun = this.lights?.sun;
    if (RENDERER.shadows && sun) {
      const [ox, oy, oz] = LIGHTS.sun.position;
      const { x, z } = this.player.camera.position;
      sun.target.position.set(x, 0, z);
      sun.position.set(x + ox, oy, z + oz);
      sun.target.updateMatrixWorld();
      sun.updateMatrixWorld();
    }
    // Outdoor lit bounce/sky fill track the live sun direction (Phase 4).
    this.world?.syncOutdoorLit(this.scene, this.lights);
  }

  update(delta) {
    this.syncSunShadow();
    this.syncCompass();
    this.syncScopedAimDistance();
    this.syncMinimapGoals();
    if (this.mode !== 'mission') return;
    this.timeLeft -= delta;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.hud.setTimer(0);
      this.finishMission(false);
      return;
    }
    this.hud.setTimer(this.timeLeft);
  }

  /**
   * While ADS, range the screen-centre aim ray (same query as ballistics) and
   * show metres on the left board. Hip-fire leaves the line for shot feedback.
   */
  syncScopedAimDistance() {
    if (!this.playing || !this.scope.active) return;
    const { origin, direction } = aimFromCamera(this.player.camera);
    const hit = castRay(origin, direction, WEAPON.ballistics.maxRange, this.rifle.shotQuery());
    this.hud.setAimDistance(hit ? hit.distance : null);
    // Keep bokeh focus on the ranged aim point when DOF is enabled.
    this.scopePost.setFocus(hit ? hit.distance : null);
  }

  /**
   * Plot alive objective targets on the minimap. Free Play has no goal list.
   */
  syncMinimapGoals() {
    if (this.mode !== 'mission' || !this.mission) {
      this.hud.setMinimapGoals([]);
      return;
    }
    if (this.mission.tutorial) {
      this.hud.setMinimapGoals(this.orchard.goalPositions());
      return;
    }
    this.hud.setMinimapGoals(this.animals.goalPositions(this.mission.species));
  }

  /** Place the camera on a stand and yaw it to that stand's facing (north = -Z). */
  applyStandFacing(index) {
    const stand = STANDS[index];
    if (!stand) return;
    this.world.activeIndex = index;
    this.player.place(this.world.eyePosition, FACING_YAW[stand.facing]);
    this.hud.setStand(stand.label);
    this.syncCompass();
  }

  syncCompass() {
    const pos = this.player.camera.position;
    this.hud.setCompass(this.player.getHeading(), pos.x, pos.z);
  }

  async load() {
    await this.assets.loadAll([...AnimalManager.modelUrls(), ...environmentModelUrls()]);

    this.world.populate(this.assets);
    this.hud.initMinimap(this.world.treePositions ?? []);
    this.hud.setStand(STANDS[this.world.activeIndex]?.label ?? STANDS[DEFAULT_STAND_INDEX].label);
    this.syncCompass();
    this.animals.init(this.assets);
    this.animals.spawnInitial();

    this.bindEvents();
    this.hud.setZoom(this.scope.zoom);
    this.loaded = true;
    this.hud.setReady();
  }

  bindEvents() {
    this.player.on('lock', () => this.hud.setLocked(true));
    this.player.on('unlock', () => {
      this.hud.setLocked(false);
      this.scope.setActive(false);
    });

    this.unbindResize = bindResize(this.renderer, this.player.camera, (w, h) => {
      this.scopePost.setSize(w, h);
    });
    this.unbindInput = bindInput({
      isLocked: () => this.player.isLocked,
      lock: () => {
        if (!this.playing) return;
        this.sfx.unlock();
        this.player.lock();
      },
      shoot: () => this.shoot(),
      reload: () => this.reload(),
      scope: (active) => {
        if (!this.playing) return;
        this.scope.setActive(active);
      },
      scopeZoom: (delta) => {
        if (!this.playing) return;
        this.scope.adjustZoom(delta);
      },
      toggleHitboxes: () => toggleHitboxes(),
      quit: () => this.requestQuit(),
      quitYes: () => this.answerQuit(true),
      quitNo: () => this.answerQuit(false),
      standIndex: (code) => STANDS.findIndex((stand) => stand.key === code),
      switchStand: (index) => this.switchStand(index),
    });
  }

  /** Q while playing: pause and ask to return to the mission list. */
  requestQuit() {
    if (!this.playing) return;
    this.resumeMode = this.mode;
    this.mode = 'quit-confirm';
    this.player.unlock();
    this.scope.setActive(false);
    this.rifle.clearProjectiles();
    this.hud.showQuitConfirm();
  }

  answerQuit(yes) {
    if (this.mode !== 'quit-confirm') return;
    if (yes) {
      this.resumeMode = null;
      this.showMenu();
      return;
    }
    const resume = this.resumeMode === 'free' ? 'free' : 'mission';
    this.resumeMode = null;
    this.mode = resume;
    this.hud.hideQuitConfirm();
    if (resume === 'mission' && this.mission) {
      this.hud.showMission(this.mission, this.progress, this.timeLeft);
    } else {
      this.hud.showFreePlay(this.freePlayTheme);
    }
  }

  showMenu() {
    this.mode = 'menu';
    this.resumeMode = null;
    this.player.unlock();
    this.scope.setActive(false);
    this.rifle.clearProjectiles();
    this.loot.stop();
    this.orchard.clear();
    this.applyTheme('default');
    this.hud.setMinimapGoals([]);
    this.hud.showMenu();
  }

  applyTheme(themeId) {
    const theme = themeForMission({ theme: themeId });
    applySceneTheme(this.scene, this.lights, theme);
    this.world.applyTheme(theme.id);
    // Haze / bounce / turf tint follow fog + hemi + theme (Phase 4).
    this.world.syncOutdoorLit(this.scene, this.lights);
  }

  startMission(index) {
    if (!this.loaded) return;
    const mission = MISSIONS[index];
    if (!mission) return;
    if (!isMissionUnlocked(mission, this.scoreboard)) {
      this.hud.showMenu();
      return;
    }
    this.mode = 'mission';
    this.mission = mission;
    this.missionIndex = index;
    this.timeLeft = mission.seconds;
    this.beginRound();
    this.hud.showMission(mission, 0, mission.seconds);
  }

  startFreePlay() {
    if (!this.loaded) return;
    this.mode = 'free';
    this.mission = null;
    this.missionIndex = -1;
    this.timeLeft = 0;
    this.freePlayTheme = pickFreePlayTheme();
    this.beginRound();
    this.hud.showFreePlay(this.freePlayTheme);
  }

  /** Fresh score, rifle, and animals. Bolt, reload, and muzzle behavior are untouched. */
  beginRound() {
    this.score = 0;
    this.progress = 0;
    this.shots = 0;
    this.hits = 0;
    this.longest = 0;
    this.penalties = 0;
    this.hud.setScore(0);
    this.hud.setDistance(null);
    this.rifle.reset();
    this.orchard.clear();
    const themeId =
      this.mission?.theme ?? (this.mode === 'free' ? this.freePlayTheme : 'default');
    this.applyTheme(themeId);
    this.applyStandFacing(DEFAULT_STAND_INDEX);
    if (this.mission?.tutorial) {
      // Quiet range: orchard only — practice fire, reload, and tower switches.
      this.animals.clear();
      this.loot.stop();
      this.orchard.spawn();
    } else {
      this.animals.respawn(this.mission?.fauna);
      this.loot.start();
    }
    this.scope.setActive(false);
  }

  switchStand(index) {
    if (!this.playing) return;
    if (!this.world.stands[index]) return;
    this.applyStandFacing(index);
  }

  shoot() {
    if (!this.playing) return;
    const result = this.rifle.fire();
    if (result.type === 'locked' || result.type === 'empty') return;
    // Round is in flight; kill / cover / loot / miss resolve in resolveShot.
    if (this.mode === 'mission') this.shots += 1;
  }

  /** Apply scoring and HUD feedback when a ballistic round hits or expires. */
  resolveShot(result) {
    if (!this.playing) return;
    if (result.type === 'loot') {
      this.noteLoot(result);
      return;
    }
    if (result.type === 'apple') {
      this.noteApple(result);
      return;
    }
    if (this.mode === 'free') {
      this.noteFreeShot(result);
      return;
    }
    if (result.type === 'kill') {
      this.hits += 1;
      if (result.distance > this.longest) this.longest = result.distance;
      this.noteMissionKill(result);
      return;
    }
    if (result.type === 'cover') this.hud.setBlocked(result.surface, result.distance);
    else this.hud.setDistance(null);
  }

  noteLoot(result) {
    this.score += result.points;
    this.hud.setScore(this.score);
    this.hud.setPickup(result.points, result.magazines);
  }

  noteApple(result) {
    this.hits += 1;
    if (result.distance > this.longest) this.longest = result.distance;
    this.score += result.points;
    this.progress += 1;
    this.hud.setScore(this.score);
    this.hud.setDistance(result.distance);
    this.hud.setProgress(this.progress);
    if (this.progress >= this.mission.count) this.finishMission(true);
  }

  noteFreeShot(result) {
    if (result.type === 'kill') {
      this.score += result.points;
      this.hud.setScore(this.score);
      this.hud.setDistance(result.distance, result.zone, {
        premium: result.premium,
        points: result.points,
      });
    } else if (result.type === 'cover') {
      this.hud.setBlocked(result.surface, result.distance);
    } else {
      this.hud.setDistance(null);
    }
  }

  noteMissionKill(result) {
    const grade = gradeKill(this.mission, result.animal.type, result.distance);
    if (grade === 'count') {
      this.score += result.points;
      this.progress += 1;
      this.hud.setScore(this.score);
      this.hud.setDistance(result.distance, result.zone, {
        premium: result.premium,
        points: result.points,
      });
      this.hud.setProgress(this.progress);
      if (this.progress >= this.mission.count) this.finishMission(true);
      return;
    }
    this.score -= MISSION_PENALTY;
    this.penalties += 1;
    this.hud.setScore(this.score);
    this.hud.setPenalty(grade, result.animal.type, result.distance, this.mission);
  }

  finishMission(success) {
    if (this.mode !== 'mission' || !this.mission) return;
    const mission = this.mission;
    const timeLeft = Math.max(0, this.timeLeft);
    const timeUsed = Math.max(0, mission.seconds - timeLeft);
    this.mode = 'results';
    this.resumeMode = null;
    this.player.unlock();
    this.scope.setActive(false);
    this.rifle.clearProjectiles();
    this.loot.stop();
    this.orchard.clear();
    this.hud.presentMissionEnd({
      success,
      mission,
      progress: this.progress,
      hits: this.hits,
      shots: this.shots,
      longest: this.longest,
      timeLeft,
      timeUsed,
      score: this.score,
      penalties: this.penalties,
      hasNext: success && nextUnlockedIndex(this.missionIndex, this.scoreboard) >= 0,
    });
  }

  reload() {
    if (!this.playing) return;
    this.rifle.tryReload();
  }

  syncAmmo() {
    this.hud.setAmmo(this.rifle.rounds, this.rifle.spares, this.rifle.reloading);
  }

  start() {
    this.loop.start();
  }

  dispose() {
    this.loop.stop();
    this.unbindInput?.();
    this.unbindResize?.();
    this.player.dispose();
    this.scopePost?.dispose();
    this.renderer.dispose();
  }
}
