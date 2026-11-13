import * as THREE from 'three';
import { WEAPON } from '../config.js';

const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);
const _instanceMatrix = new THREE.Matrix4();

function worldMatrixOf(hit) {
  if (hit.instanceId === undefined) return hit.object.matrixWorld;
  hit.object.getMatrixAt(hit.instanceId, _instanceMatrix);
  return _instanceMatrix.premultiply(hit.object.matrixWorld);
}

/**
 * Instant-hit ray from the camera through the screen centre, tested against
 * the terrain, solid scenery, supply crates, tutorial apples, and animal
 * hitboxes. The nearest hit wins, so cover in front of a target stops the
 * shot, and a crate in front of an animal stops it too. The parachute is not
 * part of `loot`. Foliage is never tested.
 *
 * Returns null on a clean miss, otherwise
 * { kind: 'animal' | 'cover' | 'loot' | 'apple', distance, point, normal?, object?, surface }.
 */
export function hitscan(camera, { targets, solids = [], heightfield = null, loot = [], apples = [] }) {
  // Mouse-look may have rotated the camera since the last render refreshed matrixWorld.
  camera.updateMatrixWorld();
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const { origin, direction } = raycaster.ray;
  let best = null;

  if (heightfield) {
    const t = heightfield.raycast(origin, direction, camera.far, WEAPON.terrainRayStep);
    if (t !== null) {
      const point = raycaster.ray.at(t, new THREE.Vector3());
      best = { kind: 'cover', surface: 'terrain', distance: t, point, normal: heightfield.getNormalAt(point.x, point.z) };
    }
  }

  const far = best ? best.distance : camera.far;
  raycaster.far = far;
  const [solidHit] = solids.length ? raycaster.intersectObjects(solids, false) : [];
  if (solidHit) {
    const normal = solidHit.face ? solidHit.face.normal.clone().transformDirection(worldMatrixOf(solidHit)) : null;
    best = { kind: 'cover', surface: solidHit.object.userData.surface, distance: solidHit.distance, point: solidHit.point, normal };
    raycaster.far = solidHit.distance;
  }

  const [targetHit] = targets.length ? raycaster.intersectObjects(targets, false) : [];
  const [lootHit] = loot.length ? raycaster.intersectObjects(loot, false) : [];
  const [appleHit] = apples.length ? raycaster.intersectObjects(apples, false) : [];

  // One winner among loot / apples / animals. Nearest interactive hit keeps the shot.
  const candidates = [];
  if (lootHit) candidates.push({ kind: 'loot', surface: 'crate', hit: lootHit });
  if (appleHit) candidates.push({ kind: 'apple', surface: 'apple', hit: appleHit });
  if (targetHit) candidates.push({ kind: 'animal', surface: 'animal', hit: targetHit });
  candidates.sort((a, b) => a.hit.distance - b.hit.distance);
  if (candidates.length) {
    const win = candidates[0];
    best = {
      kind: win.kind,
      surface: win.surface,
      distance: win.hit.distance,
      point: win.hit.point,
      object: win.hit.object,
    };
  }

  raycaster.far = Infinity;
  return best;
}
