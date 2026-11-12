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
// Unit cylinder along local Y. Neck segments scale XZ to the neck radius and Y to the bone length.
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12, 1);

function createZone(zone, animal) {
  const mesh = new THREE.Mesh(unitSphere, hitboxMaterial);
  mesh.name = `hitbox-${zone}`;
  mesh.renderOrder = 10;
  mesh.userData = { animal, zone };
  return mesh;
}

/** One small sphere. Ducks use this; T toggles the same material as the other zones. */
export function createHitSphere(animal, radius, zone = 'body') {
  const mesh = createZone(zone, animal);
  mesh.scale.setScalar(radius);
  return mesh;
}

function createNeckPiece(animal, geometry) {
  const mesh = new THREE.Mesh(geometry, hitboxMaterial);
  mesh.name = 'hitbox-neck';
  mesh.renderOrder = 10;
  mesh.userData = { animal, zone: 'body' };
  return mesh;
}

/**
 * Body ellipsoid (local +Z = torso axis), neck cylinders and joint spheres, and a head sphere.
 * The neck pieces are body shots, so a skull hit stays on the head sphere.
 * `neckSlots` is the most segments the rig can need (chest to head).
 */
export function createAnimalHitboxes(animal, { body, headRadius, neckRadius, neckSlots }) {
  const bodyBox = createZone('body', animal);
  bodyBox.scale.set(body.halfWidth, body.halfHeight, body.halfLength);
  const headBox = createZone('head', animal);
  headBox.scale.setScalar(headRadius);
  const neckSegments = [];
  const neckJoints = [];
  for (let i = 0; i < neckSlots; i++) {
    const segment = createNeckPiece(animal, unitCylinder);
    segment.scale.set(neckRadius, 1, neckRadius);
    neckSegments.push(segment);
    const joint = createNeckPiece(animal, unitSphere);
    joint.scale.setScalar(neckRadius);
    neckJoints.push(joint);
  }
  return { body: bodyBox, head: headBox, neckSegments, neckJoints };
}

export function setHitboxesVisible(visible) {
  hitboxMaterial.visible = visible;
}

export function toggleHitboxes() {
  setHitboxesVisible(!hitboxMaterial.visible);
  return hitboxMaterial.visible;
}
