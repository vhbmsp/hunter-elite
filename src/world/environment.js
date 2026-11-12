import * as THREE from 'three';
import { ENVIRONMENT, PLAYER } from '../config.js';
import { createBillboardMaterial, randomRingPosition } from './billboard.js';
import { drawBush, drawLog, drawTree, getBillboardTexture } from './textures.js';

const unitPlane = new THREE.PlaneGeometry(1, 1);
const [, , playerZ] = PLAYER.position;

function scatter(group, { texture, count, minDistance, distanceRange }, draw, place) {
  // One material per decoration kind; every instance shares it and the unit plane.
  const material = createBillboardMaterial(getBillboardTexture(texture, draw));
  for (let i = 0; i < count; i++) {
    const { x, z } = randomRingPosition(minDistance, distanceRange);
    const mesh = new THREE.Mesh(unitPlane, material);
    place(mesh, x, z);
    group.add(mesh);
  }
}

function placeFacingPlayer(mesh, x, y, z, w, h) {
  mesh.scale.set(w, h, 1);
  mesh.position.set(x, y, z);
  mesh.lookAt(0, y, playerZ);
}

export function createEnvironment() {
  const group = new THREE.Group();
  group.name = 'environment';

  scatter(group, ENVIRONMENT.trees, drawTree, (mesh, x, z) => {
    const s = 4 + Math.random() * 6;
    placeFacingPlayer(mesh, x, s * 0.45, z, s * 0.7, s);
  });

  scatter(group, ENVIRONMENT.bushes, drawBush, (mesh, x, z) => {
    const s = 1.5 + Math.random() * 2.5;
    placeFacingPlayer(mesh, x, s * 0.4, z, s * 1.4, s);
  });

  scatter(group, ENVIRONMENT.logs, drawLog, (mesh, x, z) => {
    placeFacingPlayer(mesh, x, 0.4, z, 3.5, 0.8);
    mesh.rotation.y = Math.random() * Math.PI;
  });

  return group;
}
