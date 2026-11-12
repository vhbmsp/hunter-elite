import * as THREE from 'three';
import { MAX_FRAME_DELTA } from '../config.js';

/**
 * Fixed order frame loop driven by renderer.setAnimationLoop.
 * Delta is clamped so a backgrounded tab doesn't teleport animals on return.
 */
export class GameLoop {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.clock = new THREE.Clock(false);
    this.systems = [];
  }

  add(system) {
    this.systems.push(system);
    return this;
  }

  start() {
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  stop() {
    this.renderer.setAnimationLoop(null);
    this.clock.stop();
  }

  tick() {
    const delta = Math.min(this.clock.getDelta(), MAX_FRAME_DELTA);
    for (const system of this.systems) system.update(delta);
    this.renderer.render(this.scene, this.camera);
  }
}
