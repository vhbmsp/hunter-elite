import * as THREE from 'three';
import { RENDERER, WORLD } from '../config.js';

export function createTerrain() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
    new THREE.MeshStandardMaterial({ color: WORLD.groundColor, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = RENDERER.shadows;
  ground.name = 'ground';
  return ground;
}
