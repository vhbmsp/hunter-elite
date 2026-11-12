import { Sfx } from '../audio/Sfx.js';
import { AnimalManager } from '../entities/AnimalManager.js';
import { toggleHitboxes } from '../entities/hitbox.js';
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

    this.renderer = createRenderer(container);
    this.scene = createScene();
    this.hud = new Hud();
    this.sfx = new Sfx();
    this.assets = new AssetLibrary((loaded, total) => this.hud.setLoading(loaded, total));

    this.world = new World(this.scene);
    this.player = new Player(this.renderer.domElement);
    this.player.camera.position.copy(this.world.eyePosition);
    // The muzzle flash is parented to the camera, so the camera has to live in the scene.
    this.scene.add(this.player.camera);
    this.scope = new Scope(this.player.camera, this.hud);
    this.impacts = new ImpactEffects(this.scene);
    this.animals = new AnimalManager(this.scene, this.player.camera, this.world);
    this.rifle = new Rifle(this.player.camera, this.animals, this.world, this.impacts, this.sfx);
    this.rifle.onChange = () => this.syncAmmo();
    this.syncAmmo();

    this.loop = new GameLoop(this.renderer, this.scene, this.player.camera)
      .add(this.world)
      .add(this.impacts)
      .add(this.rifle)
      .add(this.animals)
      .add(this.scope);
  }

  async load() {
    await this.assets.loadAll([...AnimalManager.modelUrls(), ...environmentModelUrls()]);

    this.world.populate(this.assets);
    this.animals.init(this.assets);
    this.animals.spawnInitial();

    this.bindEvents();
    this.hud.setZoom(this.scope.zoom);
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
        this.sfx.unlock();
        this.player.lock();
      },
      shoot: () => this.shoot(),
      reload: () => this.reload(),
      scope: (active) => this.scope.setActive(active),
      toggleHitboxes: () => toggleHitboxes(),
    });
  }

  shoot() {
    const result = this.rifle.fire();
    if (result.type === 'locked' || result.type === 'empty') return;
    if (result.type === 'kill') {
      this.score += result.points;
      this.hud.setScore(this.score);
      this.hud.setDistance(result.distance, result.zone);
    } else if (result.type === 'cover') {
      this.hud.setBlocked(result.surface, result.distance);
    } else {
      this.hud.setDistance(null);
    }
  }

  reload() {
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
