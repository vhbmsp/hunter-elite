import { DEFAULT_STAND_INDEX, FACING_YAW, STANDS } from '../config.js';
import { Sfx } from '../audio/Sfx.js';
import { AnimalManager } from '../entities/AnimalManager.js';
import { AppleOrchard } from '../entities/AppleOrchard.js';
import { LootManager } from '../entities/LootManager.js';
import { toggleHitboxes } from '../entities/hitbox.js';
import { MISSION_PENALTY, MISSIONS, gradeKill } from '../missions.js';
import { Player } from '../player/Player.js';
import { Scope } from '../player/Scope.js';
import { Hud } from '../ui/Hud.js';
import { ImpactEffects } from '../weapons/impacts.js';
import { Rifle } from '../weapons/Rifle.js';
import { environmentModelUrls } from '../world/environment.js';
import { World } from '../world/World.js';
import { AssetLibrary } from './assets.js';
import { bindInput } from './input.js';
import { GameLoop } from './loop.js';
import { bindResize, createRenderer } from './renderer.js';
import { createScene } from './scene.js';

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

    this.renderer = createRenderer(container);
    this.scene = createScene();
    this.hud = new Hud({
      onMission: (index) => this.startMission(index),
      onFreePlay: () => this.startFreePlay(),
      onRetry: () => this.startMission(this.missionIndex),
      onNext: () => this.startMission(this.missionIndex + 1),
      onMenu: () => this.showMenu(),
    });
    this.sfx = new Sfx();
    this.assets = new AssetLibrary((loaded, total) => this.hud.setLoading(loaded, total));

    this.world = new World(this.scene);
    this.player = new Player(this.renderer.domElement);
    this.applyStandFacing(DEFAULT_STAND_INDEX);
    // The muzzle flash is parented to the camera, so the camera has to live in the scene.
    this.scene.add(this.player.camera);
    this.scope = new Scope(this.player.camera, this.hud);
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
    );
    this.rifle.onChange = () => this.syncAmmo();
    this.syncAmmo();
    this.syncCompass();

    this.loop = new GameLoop(this.renderer, this.scene, this.player.camera)
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

  update(delta) {
    this.syncCompass();
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
    this.hud.setCompass(this.player.getHeading());
  }

  async load() {
    await this.assets.loadAll([...AnimalManager.modelUrls(), ...environmentModelUrls()]);

    this.world.populate(this.assets);
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

    this.unbindResize = bindResize(this.renderer, this.player.camera);
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
      toggleHitboxes: () => toggleHitboxes(),
      menu: () => {
        if (this.playing) this.showMenu();
      },
      standIndex: (code) => STANDS.findIndex((stand) => stand.key === code),
      switchStand: (index) => this.switchStand(index),
    });
  }

  showMenu() {
    this.mode = 'menu';
    this.player.unlock();
    this.scope.setActive(false);
    this.loot.stop();
    this.orchard.clear();
    this.hud.showMenu();
  }

  startMission(index) {
    if (!this.loaded) return;
    const mission = MISSIONS[index];
    if (!mission) return;
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
    this.beginRound();
    this.hud.showFreePlay();
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
    this.applyStandFacing(DEFAULT_STAND_INDEX);
    if (this.mission?.tutorial) {
      // Quiet range: orchard only — practice fire, reload, and tower switches.
      this.animals.clear();
      this.loot.stop();
      this.orchard.spawn();
    } else {
      this.animals.respawn();
      this.loot.start();
    }
    this.scope.setActive(false);
  }

  switchStand(index) {
    if (!this.world.stands[index]) return;
    this.applyStandFacing(index);
  }

  shoot() {
    if (!this.playing) return;
    const result = this.rifle.fire();
    if (result.type === 'locked' || result.type === 'empty') return;
    if (result.type === 'loot') {
      if (this.mode === 'mission') this.shots += 1;
      this.noteLoot(result);
      return;
    }
    if (result.type === 'apple') {
      if (this.mode === 'mission') this.shots += 1;
      this.noteApple(result);
      return;
    }
    if (this.mode === 'free') {
      this.noteFreeShot(result);
      return;
    }
    this.shots += 1;
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
    this.player.unlock();
    this.scope.setActive(false);
    this.loot.stop();
    this.orchard.clear();
    this.hud.showResults({
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
      hasNext: success && this.missionIndex < MISSIONS.length - 1,
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
    this.renderer.dispose();
  }
}
