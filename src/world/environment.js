import * as THREE from 'three';
import { ENVIRONMENT, PLAYER, STANDS } from '../config.js';

const randomRange = ([min, max]) => min + Math.random() * (max - min);
const UP = new THREE.Vector3(0, 1, 0);
const _normal = new THREE.Vector3();
const _tilt = new THREE.Quaternion();
const _yaw = new THREE.Quaternion();

// Singular names shown in the HUD ("blocked by tree") and used for impact colours.
const SURFACE_NAMES = { trees: 'tree', rocks: 'rock', logs: 'log', bushes: 'bush' };

export function environmentModelUrls() {
  return Object.values(ENVIRONMENT).flatMap((kind) => kind.models);
}

/** Template, its rest bounds, and each mesh part's transform relative to the template root. */
function prepareTemplate(gltf) {
  const template = gltf.scene;
  template.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
  const parts = [];
  template.traverse((child) => {
    if (child.isMesh) parts.push({ geometry: child.geometry, material: child.material, matrix: child.matrixWorld.clone() });
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
  if (!kind.sightClear) return true;
  for (let i = 0; i < STANDS.length; i++) {
    for (let j = i + 1; j < STANDS.length; j++) {
      if (distanceToSegment(x, z, STANDS[i].position, STANDS[j].position) < kind.sightClear) return false;
    }
  }
  return true;
}

function pickSpot(heightfield, kind, placed) {
  const [px, , pz] = PLAYER.position;
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
 * model part, so e.g. 70 trees of 4 models render in ~10 draw calls.
 */
function scatterInstanced(heightfield, assets, kindName, kind) {
  const templates = kind.models.map((url) => prepareTemplate(assets.get(url)));
  const perTemplate = templates.map(() => []);
  const placed = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < kind.count; i++) {
    const spot = pickSpot(heightfield, kind, placed);
    if (!spot) continue;
    placed.push(spot);

    const t = Math.floor(Math.random() * templates.length);
    const { size } = templates[t];
    const scale = kind.length ? randomRange(kind.length) / Math.max(size.x, size.z) : randomRange(kind.height) / size.y;

    dummy.position.set(spot.x, heightfield.getHeightAt(spot.x, spot.z) - kind.sink, spot.z);
    _yaw.setFromAxisAngle(UP, Math.random() * Math.PI * 2);
    if (kind.alignToGround) {
      _tilt.setFromUnitVectors(UP, heightfield.getNormalAt(spot.x, spot.z, _normal));
      dummy.quaternion.multiplyQuaternions(_tilt, _yaw);
    } else {
      dummy.quaternion.copy(_yaw);
    }
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    perTemplate[t].push(dummy.matrix.clone());
  }

  const meshes = [];
  const instanceMatrix = new THREE.Matrix4();
  templates.forEach(({ parts }, t) => {
    const matrices = perTemplate[t];
    if (!matrices.length) return;
    for (const part of parts) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
      matrices.forEach((m, i) => mesh.setMatrixAt(i, instanceMatrix.multiplyMatrices(m, part.matrix)));
      mesh.computeBoundingSphere();
      mesh.castShadow = kind.castShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = kindName;
      mesh.userData.surface = SURFACE_NAMES[kindName] ?? kindName;
      meshes.push(mesh);
    }
  });
  return meshes;
}

/**
 * Builds all scenery. `solids` are the meshes that stop bullets (trees,
 * rocks, logs); bushes are visual cover only.
 */
export function createEnvironment(heightfield, assets) {
  const group = new THREE.Group();
  group.name = 'environment';
  const solids = [];

  for (const [name, kind] of Object.entries(ENVIRONMENT)) {
    const meshes = scatterInstanced(heightfield, assets, name, kind);
    group.add(...meshes);
    if (kind.solid) solids.push(...meshes);
  }
  return { group, solids };
}
