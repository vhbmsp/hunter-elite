import * as THREE from 'three';
import { MAX_FRAME_DELTA } from '../config.js';

/**
 * Fixed order frame loop driven by renderer.setAnimationLoop.
 * Delta is clamped so a backgrounded tab doesn't teleport animals on return.
 */
export class GameLoop {
  /**
   * @param {object} [options]
   * @param {() => void} [options.render] Optional frame presenter (e.g. scoped
   *   EffectComposer). Defaults to `renderer.render(scene, camera)`.
   */
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.renderFrame = options.render ?? null;
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
    if (this.renderFrame) this.renderFrame();
    else this.renderer.render(this.scene, this.camera);
  }
}
