import * as THREE from 'three';
import { STAND } from '../config.js';

/** Simple wooden box stand (legs, platform, railing) built at ground (x, y, z). */
export function createStand(x, groundY, z) {
  const group = new THREE.Group();
  group.name = 'stand';
  const material = new THREE.MeshLambertMaterial({ color: STAND.color });
  const { height, platformSize: s, railHeight } = STAND;
  const half = s / 2 - 0.06;

  const add = (w, h, d, px, py, pz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Legs reach 0.5 m into the ground so slopes never show a gap.
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    add(0.12, height + railHeight + 0.5, 0.12, lx * half, (height + railHeight - 0.5) / 2, lz * half);
  }
  add(s, 0.08, s, 0, height, 0);
  for (const sign of [-1, 1]) {
    add(s, 0.06, 0.06, 0, height + railHeight, sign * half);
    add(0.06, 0.06, s, sign * half, height + railHeight, 0);
  }

  group.position.set(x, groundY, z);
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    child.matrixAutoUpdate = false;
  });
  return group;
}
