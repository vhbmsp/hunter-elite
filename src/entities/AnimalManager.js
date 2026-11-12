import * as THREE from 'three';
import { ANIMALS } from '../config.js';
import { Animal } from './Animal.js';
import { prepareSpecies } from './species.js';

export class AnimalManager {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
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
      let dist = minSpawnDistance + Math.random() * spawnDistanceRange;
      let x = Math.cos(angle) * dist;
      let z = Math.sin(angle) * dist;
      // Prefer a walkable slope; fall back to the first spot if the ring is all steep.
      for (let attempt = 0; attempt < 8 && this.world.getSlopeAt(x, z) > ANIMALS.maxSlope; attempt++) {
        dist = minSpawnDistance + Math.random() * spawnDistanceRange;
        x = Math.cos(angle + attempt) * dist;
        z = Math.sin(angle + attempt) * dist;
      }
      this.spawn(type.name, new THREE.Vector3(x, 0, z));
    }
  }

  spawn(name, position) {
    const animal = new Animal(this.species.get(name), position, this.world);
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
