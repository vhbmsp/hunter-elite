import * as THREE from 'three';
import { DEFAULT_STAND_INDEX, PLAYER, STAND, STANDS } from '../config.js';
import { THEMES, tintGroup } from '../theme.js';
import { bakeCanopyShade, createCanopyShadeUniforms } from './canopyShade.js';
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
    // Shared empty canopy map; bake fills it after trees populate (Phase 2).
    this.canopyUniforms = createCanopyShadeUniforms();
    this.heightfield.setCanopyShade(this.canopyUniforms);
    scene.add(this.terrain);
    this.themeId = 'default';
    this._foliageTintCache = new Map();
    this.treePositions = [];

    this.standHeight = STAND.enabled ? STAND.height : 0;
    this.stands = STANDS.map((stand, index) => {
      const [x, z] = stand.position;
      const groundY = this.heightfield.getHeightAt(x, z);
      // Aim the under-deck sign at the midpoint of the other stands for cross-tower reads.
      let faceX = 0;
      let faceZ = 0;
      let faceCount = 0;
      STANDS.forEach((other, otherIndex) => {
        if (otherIndex === index) return;
        faceX += other.position[0];
        faceZ += other.position[1];
        faceCount += 1;
      });
      if (faceCount > 0) {
        faceX /= faceCount;
        faceZ /= faceCount;
      }
      if (STAND.enabled) {
        const mesh = createStand(x, groundY, z, {
          label: stand.label,
          faceX,
          faceZ,
        });
        mesh.name = `stand-${index + 1}`;
        scene.add(mesh);
      }
      return {
        index,
        key: stand.key,
        label: stand.label,
        groundY,
        eye: new THREE.Vector3(x, groundY + this.standHeight + PLAYER.eyeHeight, z),
      };
    });
    this.activeIndex = DEFAULT_STAND_INDEX;
  }

  /** Builds glTF-based scenery once models are loaded. */
  populate(assets) {
    const { group, solids, treePositions } = createEnvironment(this.heightfield, assets);
    this.environment = group;
    this.solids = solids;
    // Static instance spots for the HUD minimap (drawn once, not per frame).
    this.treePositions = treePositions;
    // Soft crown pools for terrain + grass (static — trees do not move).
    bakeCanopyShade(treePositions, this.canopyUniforms);
    this.grass = new Grass(this.heightfield, this.heightfield.noise, this.canopyUniforms);
    this.scene.add(group, this.grass.group);
    this.applyTheme(this.themeId);
  }

  /**
   * Snow / default ground look. Recolours terrain, tints grass + foliage.
   * Sky and lights are applied separately via applySceneTheme in Game.
   */
  applyTheme(themeId = 'default') {
    const theme = THEMES[themeId] ?? THEMES.default;
    this.themeId = theme.id;
    this.heightfield.recolor(theme.terrainColors);
    this.grass?.setTint(theme.grassTint);
    tintGroup(this.environment, theme.foliageTint, this._foliageTintCache);
  }

  get eyePosition() {
    return this.stands[this.activeIndex].eye.clone();
  }

  /** Point between the other stands, dropped toward the valley floor. */
  lookTarget(index = this.activeIndex) {
    const target = new THREE.Vector3();
    let count = 0;
    this.stands.forEach((stand, i) => {
      if (i === index) return;
      target.add(stand.eye);
      count += 1;
    });
    target.multiplyScalar(1 / count);
    const ground = this.heightfield.getHeightAt(target.x, target.z);
    target.y = THREE.MathUtils.lerp(target.y, ground, STAND.aimDrop);
    return target;
  }

  getHeightAt(x, z) {
    return this.heightfield.getHeightAt(x, z);
  }

  getSlopeAt(x, z) {
    return this.heightfield.getSlopeAt(x, z);
  }

  update(delta) {
    this.grass?.update(delta, this.stands[this.activeIndex]?.eye);
  }
}
