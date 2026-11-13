import * as THREE from 'three';
import { ANIMALS, DUCKS } from '../config.js';
import { Animal } from './Animal.js';
import { Duck, prepareDucks } from './Duck.js';
import { prepareSpecies } from './species.js';

export class AnimalManager {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.animals = [];
    this.ducks = [];
    this.species = new Map();
    this.flockTime = 0;
  }

  static modelUrls() {
    return [...ANIMALS.types.map((t) => t.model), DUCKS.model];
  }

  /** Builds per-species templates from already-loaded glTFs. */
  init(assets) {
    for (const type of ANIMALS.types) {
      this.species.set(type.name, prepareSpecies(type, assets.get(type.model)));
    }
    this.duckTemplate = prepareDucks(assets.get(DUCKS.model));
  }

  spawnInitial() {
    const pooled = ANIMALS.types.filter((type) => type.spawns == null);
    const { count } = ANIMALS;
    for (let i = 0; i < count; i++) this.spawnOnTerrain(pooled[i % pooled.length].name, i, count);
    for (const type of ANIMALS.types) {
      if (type.spawns == null) continue;
      for (let i = 0; i < type.spawns; i++) this.spawnOnTerrain(type.name, i + 1, type.spawns + 1);
    }
    for (const slot of DUCKS.slots) {
      const duck = new Duck(this.duckTemplate, slot, this.world);
      this.scene.add(duck.root);
      this.ducks.push(duck);
    }
  }

  spawnOnTerrain(name, index, total) {
    const { minSpawnDistance, spawnDistanceRange } = ANIMALS;
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.4;
    let dist = minSpawnDistance + Math.random() * spawnDistanceRange;
    let x = Math.cos(angle) * dist;
    let z = Math.sin(angle) * dist;
    // Prefer a walkable slope; fall back to the first spot if the ring is all steep.
    for (let attempt = 0; attempt < 8 && this.world.getSlopeAt(x, z) > ANIMALS.maxSlope; attempt++) {
      dist = minSpawnDistance + Math.random() * spawnDistanceRange;
      x = Math.cos(angle + attempt) * dist;
      z = Math.sin(angle + attempt) * dist;
    }
    this.spawn(name, new THREE.Vector3(x, 0, z));
  }

  /** Removes every animal and duck without spawning replacements. */
  clear() {
    for (const animal of [...this.animals, ...this.ducks]) animal.dispose();
    this.animals = [];
    this.ducks = [];
    this.flockTime = 0;
  }

  /** Drops every animal and duck, then spawns the usual population again. */
  respawn() {
    this.clear();
    this.spawnInitial();
  }

  spawn(name, position) {
    const animal = new Animal(this.species.get(name), position, this.world);
    this.scene.add(animal.root);
    this.animals.push(animal);
    return animal;
  }

  /** Hitbox zones of animals and ducks that can still be shot. */
  liveHitboxes() {
    return [...this.animals, ...this.ducks].filter((a) => a.alive).flatMap((a) => a.hitboxes);
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
    this.flockTime += delta;
    for (let i = this.ducks.length - 1; i >= 0; i--) {
      const duck = this.ducks[i];
      duck.update(delta, this.flockTime);
      if (duck.expired) {
        duck.dispose();
        this.ducks.splice(i, 1);
      }
    }
  }
}
