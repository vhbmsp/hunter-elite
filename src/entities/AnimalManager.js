import * as THREE from 'three';
import { ANIMALS } from '../config.js';
import { drawAnimal, getBillboardTexture } from '../world/textures.js';
import { Animal } from './Animal.js';

export class AnimalManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.animals = [];
  }

  spawnInitial() {
    const { count, types, minSpawnDistance, spawnDistanceRange } = ANIMALS;
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = minSpawnDistance + Math.random() * spawnDistanceRange;
      const position = new THREE.Vector3(Math.cos(angle) * dist, type.height, Math.sin(angle) * dist);
      this.spawn(type, position);
    }
  }

  spawn(type, position) {
    const texture = getBillboardTexture(type.texture, drawAnimal(type.color), [320, 200]);
    const animal = new Animal(type, texture, position);
    this.scene.add(animal.mesh);
    this.animals.push(animal);
    return animal;
  }

  /** Hitboxes of animals that can still be shot. */
  liveHitboxes() {
    return this.animals.filter((a) => a.alive).map((a) => a.hitbox);
  }

  update(delta) {
    const playerPosition = this.camera.position;
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const animal = this.animals[i];
      animal.update(delta, playerPosition);
      if (animal.expired) {
        animal.dispose();
        this.animals.splice(i, 1);
      }
    }
  }
}
