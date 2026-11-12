import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);

/**
 * Instant-hit ray from the camera through the screen centre.
 * Returns the nearest intersection with `targets`, or null.
 */
export function hitscan(camera, targets) {
  // Mouse-look may have rotated the camera since the last render refreshed matrixWorld.
  camera.updateMatrixWorld();
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  const [hit] = raycaster.intersectObjects(targets, false);
  return hit ?? null;
}
