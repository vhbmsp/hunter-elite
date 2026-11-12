import * as THREE from 'three';
import { ANIMALS } from '../config.js';
import { Animal } from './Animal.js';
import { prepareSpecies } from './species.js';

export class AnimalManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.animals = [];
    this.species = new Map();
  }

  static modelUrls() {
    return ANIMALS.types.map((t) => t.model);
  }

  /** Builds per-species templates from already-loaded glTFs. */
  init(assets) {
    for (const type of ANIMALS.types) {
      this.species.set(type.name, prepareSpecies(type, assets.get(type.model)));
    }
  }

  spawnInitial() {
    const { count, types, minSpawnDistance, spawnDistanceRange } = ANIMALS;
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length];
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = minSpawnDistance + Math.random() * spawnDistanceRange;
      this.spawn(type.name, new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist));
    }
  }

  spawn(name, position) {
    const animal = new Animal(this.species.get(name), position);
    this.scene.add(animal.root);
    this.animals.push(animal);
    return animal;
  }

  /** Hitbox zones of animals that can still be shot. */
  liveHitboxes() {
    return this.animals.filter((a) => a.alive).flatMap((a) => a.hitboxes);
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
