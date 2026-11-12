import * as THREE from 'three';
import { PLAYER, STAND } from '../config.js';
import { createEnvironment } from './environment.js';
import { Grass } from './grass.js';
import { createStand } from './stand.js';
import { Heightfield } from './terrain.js';

/**
 * Terrain + scenery. Exposes the ground query (getHeightAt / getSlopeAt),
 * the meshes that block bullets (`solids`), and the per-frame grass wind.
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.heightfield = new Heightfield();
    this.terrain = this.heightfield.createMesh();
    scene.add(this.terrain);

    const [px, , pz] = PLAYER.position;
    this.playerGround = this.heightfield.getHeightAt(px, pz);
    this.standHeight = STAND.enabled ? STAND.height : 0;
    if (STAND.enabled) scene.add(createStand(px, this.playerGround, pz));
  }

  /** Builds glTF-based scenery once models are loaded. */
  populate(assets) {
    const { group, solids } = createEnvironment(this.heightfield, assets);
    this.environment = group;
    this.solids = solids;
    this.grass = new Grass(this.heightfield, this.heightfield.noise);
    this.scene.add(group, this.grass.group);
  }

  get eyePosition() {
    const [px, , pz] = PLAYER.position;
    return new THREE.Vector3(px, this.playerGround + this.standHeight + PLAYER.eyeHeight, pz);
  }

  getHeightAt(x, z) {
    return this.heightfield.getHeightAt(x, z);
  }

  getSlopeAt(x, z) {
    return this.heightfield.getSlopeAt(x, z);
  }

  update(delta) {
    this.grass?.update(delta);
  }
}
