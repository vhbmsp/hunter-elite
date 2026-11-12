import * as THREE from 'three';
import { ANIMALS } from '../config.js';

// Shared across all hitboxes so the T toggle flips one flag.
const hitboxMaterial = new THREE.MeshBasicMaterial({
  color: ANIMALS.hitboxColor,
  wireframe: true,
  transparent: true,
  opacity: ANIMALS.hitboxOpacity,
  visible: ANIMALS.showHitboxes,
});

export function createHitbox(width, height) {
  const radius = Math.max(width, height) * ANIMALS.hitboxRadiusFactor;
  const hitbox = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), hitboxMaterial);
  hitbox.name = 'hitbox';
  return hitbox;
}

export function setHitboxesVisible(visible) {
  hitboxMaterial.visible = visible;
}

export function toggleHitboxes() {
  setHitboxesVisible(!hitboxMaterial.visible);
  return hitboxMaterial.visible;
}
