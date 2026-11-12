import { Sfx } from '../audio/Sfx.js';
import { AnimalManager } from '../entities/AnimalManager.js';
import { toggleHitboxes } from '../entities/hitbox.js';
import { Player } from '../player/Player.js';
import { Scope } from '../player/Scope.js';
import { Hud } from '../ui/Hud.js';
import { Rifle } from '../weapons/Rifle.js';
import { createEnvironment } from '../world/environment.js';
import { createTerrain } from '../world/terrain.js';
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

    this.player = new Player(this.renderer.domElement);
    this.scope = new Scope(this.player.camera, this.hud);
    this.animals = new AnimalManager(this.scene, this.player.camera);
    this.rifle = new Rifle(this.player.camera, this.animals, this.sfx);

    this.scene.add(createTerrain(), createEnvironment());
    this.animals.spawnInitial();

    this.loop = new GameLoop(this.renderer, this.scene, this.player.camera)
      .add(this.animals)
      .add(this.scope);

    this.bindEvents();
    this.hud.setZoom(this.scope.zoom);
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
      scope: (active) => this.scope.setActive(active),
      toggleHitboxes: () => toggleHitboxes(),
    });
  }

  shoot() {
    const result = this.rifle.fire();
    if (!result) {
      this.hud.setDistance(null);
      return;
    }
    this.score += result.points;
    this.hud.setScore(this.score);
    this.hud.setDistance(result.distance);
  }

  start() {
    this.loop.start();
  }

  dispose() {
    this.loop.stop();
    this.unbindInput();
    this.unbindResize();
    this.player.dispose();
    this.renderer.dispose();
  }
}
