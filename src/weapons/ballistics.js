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
 * the terrain, solid scenery, supply crates and animal hitboxes. The nearest
 * hit wins, so cover in front of a target stops the shot, and a crate in
 * front of an animal stops it too. The parachute is not part of `loot`.
 * Foliage is never tested.
 *
 * Returns null on a clean miss, otherwise
 * { kind: 'animal' | 'cover' | 'loot', distance, point, normal?, object?, surface }.
 */
export function hitscan(camera, { targets, solids = [], heightfield = null, loot = [] }) {
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
  // One winner. A crate hit does not continue on to an animal behind it.
  if (lootHit && (!targetHit || lootHit.distance <= targetHit.distance)) {
    best = { kind: 'loot', surface: 'crate', distance: lootHit.distance, point: lootHit.point, object: lootHit.object };
  } else if (targetHit) {
    best = { kind: 'animal', surface: 'animal', distance: targetHit.distance, point: targetHit.point, object: targetHit.object };
  }

  raycaster.far = Infinity;
  return best;
}
