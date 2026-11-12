import * as THREE from 'three';

// Alpha-tested cutout: depthWrite stays on so sprites occlude each other
// correctly regardless of draw order.
export function createBillboardMaterial(texture) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
  });
}

export function createBillboard(texture, width, height) {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), createBillboardMaterial(texture));
}

export function randomRingPosition(minDistance, distanceRange, angle = Math.random() * Math.PI * 2) {
  const dist = minDistance + Math.random() * distanceRange;
  return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
}
