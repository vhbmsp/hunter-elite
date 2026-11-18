import * as THREE from 'three';
import { CANOPY_SHADE, ENVIRONMENT, STANDS, TUTORIAL_ORCHARD, tutorialOrchardSpots } from '../config.js';
import { prepareSceneryGeometry } from './scenerySeal.js';

const randomRange = ([min, max]) => min + Math.random() * (max - min);
const UP = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();
const _tilt = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();
const _lean = new THREE.Quaternion();
const _leanAxis = new THREE.Vector3();

// Singular names shown in the HUD ("blocked by tree") and used for impact colours.
const SURFACE_NAMES = { trees: 'tree', rocks: 'rock', logs: 'log', bushes: 'bush' };

/** Quaternius foliage materials that get per-instance tint (trunks stay stable). */
function isFoliageMaterial(material) {
  const name = material?.name || '';
  return /^(Leaves|Green)$/i.test(name);
}

/**
 * Near-white RGB multiplier for InstancedMesh.setColorAt.
 * Three multiplies instanceColor with material.color, so theme foliageTint still works.
 */
function jitterLeafMultiplier(tint) {
  const color = new THREE.Color(1, 1, 1);
  color.offsetHSL(
    (Math.random() * 2 - 1) * tint.hue,
    (Math.random() * 2 - 1) * tint.sat,
    (Math.random() * 2 - 1) * tint.light,
  );
  return color;
}

export function environmentModelUrls() {
  return Object.values(ENVIRONMENT).flatMap((kind) => kind.models);
}

/**
 * Leaves and other open shells still need both sides. Tree/Wood trunks are also
 * sealed in prepareSceneryGeometry so cut ends are closed solids.
 */
function prepareSceneryMaterial(material) {
  const fix = (mat) => {
    const next = mat.clone();
    next.side = THREE.DoubleSide;
    if (next.alphaTest > 0) next.depthWrite = true;
    return next;
  };
  return Array.isArray(material) ? material.map(fix) : fix(material);
}

function preparePartGeometry(geometry, material) {
  if (Array.isArray(material)) {
    // Multi-material meshes are rare in nature packs; seal if any part is Tree/Wood.
    for (const mat of material) {
      const sealed = prepareSceneryGeometry(geometry, mat);
      if (sealed !== geometry) return sealed;
    }
    return geometry;
  }
  return prepareSceneryGeometry(geometry, material);
}

/** Template, its rest bounds, and each mesh part's transform relative to the template root. */
function prepareTemplate(gltf) {
  const template = gltf.scene;
  template.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
  const parts = [];
  template.traverse((child) => {
    if (!child.isMesh) return;
    const material = prepareSceneryMaterial(child.material);
    parts.push({
      geometry: preparePartGeometry(child.geometry, child.material),
      material,
      matrix: child.matrixWorld.clone(),
    });
  });
  return { size, parts };
}

function distanceToSegment(x, z, [ax, az], [bx, bz]) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / len2));
  return Math.hypot(x - (ax + abx * t), z - (az + abz * t));
}

/** False when a prop would sit on a stand or, for trees, on a sight line between stands. */
function spotClear(x, z, kind) {
  for (const stand of STANDS) {
    const [sx, sz] = stand.position;
    if (Math.hypot(x - sx, z - sz) < kind.minDistance) return false;
  }
  // Keep random trees/rocks out of the tutorial apple-tree firing lanes.
  const orchardClear = TUTORIAL_ORCHARD.clearRadius;
  for (const spot of tutorialOrchardSpots()) {
    if (Math.hypot(x - spot.x, z - spot.z) < orchardClear) return false;
  }
  if (!kind.sightClear) return true;
  for (let i = 0; i < STANDS.length; i++) {
    for (let j = i + 1; j < STANDS.length; j++) {
      if (distanceToSegment(x, z, STANDS[i].position, STANDS[j].position) < kind.sightClear) return false;
    }
  }
  return true;
}

function pickSpot(heightfield, kind, placed) {
  // Anchor on a random stand so Towers A and D get cover, not only Tower S.
  const stand = STANDS[Math.floor(Math.random() * STANDS.length)];
  const [px, pz] = stand.position;
  for (let attempt = 0; attempt < 30; attempt++) {
    let x;
    let z;
    if (kind.clumping && placed.length && Math.random() < kind.clumping) {
      const anchor = placed[Math.floor(Math.random() * placed.length)];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * kind.clumpRadius;
      x = anchor.x + Math.cos(a) * r;
      z = anchor.z + Math.sin(a) * r;
    } else {
      const a = Math.random() * Math.PI * 2;
      const d = kind.minDistance + Math.random() * kind.distanceRange;
      x = px + Math.cos(a) * d;
      z = pz + Math.sin(a) * d;
    }
    if (!spotClear(x, z, kind)) continue;
    if (heightfield.getSlopeAt(x, z) <= kind.maxSlope) return { x, z };
  }
  return null;
}

/**
 * Scatters one scenery kind on the terrain and returns one InstancedMesh per
 * model part, so e.g. ~72 trees across 5 crown models render in few draw calls.
 * Also returns the ground x/z spots used for placement (for the HUD minimap).
 */
function scatterInstanced(heightfield, assets, kindName, kind) {
  const templates = kind.models.map((url) => prepareTemplate(assets.get(url)));
  const perTemplate = templates.map(() => []);
  const placed = [];
  const dummy = new THREE.Object3D();
  const variety = kindName === 'trees';

  for (let i = 0; i < kind.count; i++) {
    const spot = pickSpot(heightfield, kind, placed);
    if (!spot) continue;
    placed.push(spot);

    const t = Math.floor(Math.random() * templates.length);
    const { size } = templates[t];
    const scale = kind.length ? randomRange(kind.length) / Math.max(size.x, size.z) : randomRange(kind.height) / size.y;
    // Phase 5a: non-uniform XZ scale for wider / narrower silhouettes.
    const xzMul = variety && kind.scaleXZ ? randomRange(kind.scaleXZ) : 1;
    // Trees carry a crown radius for the static canopy shade bake (Phase 2).
    if (kindName === 'trees') {
      spot.radius = scale * xzMul * size.y * CANOPY_SHADE.radiusFromHeight;
    }

    dummy.position.set(spot.x, heightfield.getHeightAt(spot.x, spot.z) - kind.sink, spot.z);
    _yaw.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
    if (kind.alignToGround) {
      _tilt.setFromUnitVectors(UP, heightfield.getNormalAt(spot.x, spot.z, _normal));
      dummy.quaternion.multiplyQuaternions(_tilt, _yaw);
    } else {
      dummy.quaternion.copy(_yaw);
    }
    // Slight lean away from vertical — keeps trunks readable as cover.
    if (variety && kind.leanMax) {
      const leanAngle = (Math.random() * 2 - 1) * kind.leanMax;
      _leanAxis.set(Math.cos(Math.random() * Math.PI * 2), 0, Math.sin(Math.random() * Math.PI * 2)).normalize();
      _lean.setFromAxisAngle(_leanAxis, leanAngle);
      dummy.quaternion.multiply(_lean);
    }
    dummy.scale.set(scale * xzMul, scale, scale * xzMul);
    dummy.updateMatrix();

    const leafColor = variety && kind.leafTint ? jitterLeafMultiplier(kind.leafTint) : null;
    perTemplate[t].push({ matrix: dummy.matrix.clone(), leafColor });
  }

  const meshes = [];
  const instanceMatrix = new THREE.Matrix4();
  templates.forEach(({ parts }, t) => {
    const instances = perTemplate[t];
    if (!instances.length) return;
    for (const part of parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, instances.length);
      const tintFoliage = variety && kind.leafTint && isFoliageMaterial(
        Array.isArray(part.material) ? part.material[0] : part.material,
      );
      instances.forEach((inst, i) => {
        mesh.setMatrixAt(i, instanceMatrix.multiplyMatrices(inst.matrix, part.matrix));
        if (tintFoliage && inst.leafColor) mesh.setColorAt(i, inst.leafColor);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = kind.castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = kindName;
      mesh.userData.surface = SURFACE_NAMES[kindName] ?? kindName;
      meshes.push(mesh);
    }
  });
  return { meshes, placed };
}

/**
 * Builds all scenery. `solids` are the meshes that stop bullets (trees,
 * rocks, logs); bushes are visual cover only. `treePositions` is the static
 * ground x/z list used by the HUD minimap.
 */
export function createEnvironment(heightfield, assets) {
  const group = new THREE.Group();
  group.name = 'environment';
  const solids = [];
  const treePositions = [];

  for (const [name, kind] of Object.entries(ENVIRONMENT)) {
    const { meshes, placed } = scatterInstanced(heightfield, assets, name, kind);
    group.add(...meshes);
    if (kind.solid) solids.push(...meshes);
    if (name === 'trees') treePositions.push(...placed);
  }
  return { group, solids, treePositions };
}
