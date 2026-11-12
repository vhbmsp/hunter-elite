import * as THREE from 'three';
import { ANIMALS } from '../config.js';

// Shared across all hitboxes so the T toggle flips one flag.
const hitboxMaterial = new THREE.MeshBasicMaterial({
  color: ANIMALS.hitboxColor,
  wireframe: true,
  transparent: true,
  opacity: ANIMALS.hitboxOpacity,
  visible: ANIMALS.showHitboxes,
  // Hitboxes sit inside the animal mesh; draw them on top so the debug view shows them.
  depthTest: false,
});

// Unit sphere; each zone is scaled to its size (an ellipsoid for the body).
const unitSphere = new THREE.SphereGeometry(1, 12, 8);

function createZone(zone, animal) {
  const mesh = new THREE.Mesh(unitSphere, hitboxMaterial);
  mesh.name = `hitbox-${zone}`;
  mesh.renderOrder = 10;
  mesh.userData = { animal, zone };
  return mesh;
}

/** Body ellipsoid (local +Z = torso axis) and head sphere for one animal. */
export function createAnimalHitboxes(animal, { body, headRadius }) {
  const bodyBox = createZone('body', animal);
  bodyBox.scale.set(body.halfWidth, body.halfHeight, body.halfLength);
  const headBox = createZone('head', animal);
  headBox.scale.setScalar(headRadius);
  return { body: bodyBox, head: headBox };
}

export function setHitboxesVisible(visible) {
  hitboxMaterial.visible = visible;
}

export function toggleHitboxes() {
  setHitboxesVisible(!hitboxMaterial.visible);
  return hitboxMaterial.visible;
}
