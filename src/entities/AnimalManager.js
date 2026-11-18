import * as THREE from 'three';
import { ANIMALS, BIRDS, FREE_PLAY_FAUNA } from '../config.js';
import { Animal } from './Animal.js';
import { Bird, prepareBird } from './Duck.js';
import { prepareSpecies } from './species.js';

export class AnimalManager {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.animals = [];
    this.ducks = [];
    this.species = new Map();
    this.birdTemplates = new Map();
    this.flockTime = 0;
  }

  static modelUrls() {
    const ground = ANIMALS.types.map((t) => t.model);
    const birds = Object.values(BIRDS).map((b) => b.model);
    return [...ground, ...birds];
  }

  /** Builds per-species templates from already-loaded glTFs. */
  init(assets) {
    for (const type of ANIMALS.types) {
      this.species.set(type.name, prepareSpecies(type, assets.get(type.model)));
    }
    for (const bird of Object.values(BIRDS)) {
      this.birdTemplates.set(bird.name, prepareBird(assets.get(bird.model), bird));
    }
  }

  /** Spawns the free-play mix (used once at load before the menu). */
  spawnInitial() {
    this.spawnFauna(FREE_PLAY_FAUNA);
  }

  /**
   * Clears the field and spawns a fauna table.
   * @param {{ ground?: Record<string, number>, birds?: string[] } | null | undefined} fauna
   */
  respawn(fauna = FREE_PLAY_FAUNA) {
    this.clear();
    this.spawnFauna(fauna ?? FREE_PLAY_FAUNA);
  }

  spawnFauna(fauna) {
    const ground = fauna?.ground ?? {};
    const roster = [];
    for (const [name, count] of Object.entries(ground)) {
      if (!this.species.has(name)) {
        throw new Error(`Unknown ground species in fauna table: ${name}`);
      }
      const n = Math.max(0, Number(count) || 0);
      for (let i = 0; i < n; i++) roster.push(name);
    }
    const total = Math.max(roster.length, 1);
    for (let i = 0; i < roster.length; i++) {
      this.spawnOnTerrain(roster[i], i, total);
    }

    for (const birdName of fauna?.birds ?? []) {
      const config = BIRDS[birdName];
      const prepared = this.birdTemplates.get(birdName);
      if (!config || !prepared) {
        throw new Error(`Unknown bird flock in fauna table: ${birdName}`);
      }
      for (const slot of config.slots) {
        const bird = new Bird(prepared, slot, this.world, config);
        this.scene.add(bird.root);
        this.ducks.push(bird);
      }
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

  /** Removes every animal and bird without spawning replacements. */
  clear() {
    for (const animal of [...this.animals, ...this.ducks]) animal.dispose();
    this.animals = [];
    this.ducks = [];
    this.flockTime = 0;
  }

  spawn(name, position) {
    const animal = new Animal(this.species.get(name), position, this.world);
    this.scene.add(animal.root);
    this.animals.push(animal);
    return animal;
  }

  /** Hitbox zones of animals and birds that can still be shot. */
  liveHitboxes() {
    return [...this.animals, ...this.ducks].filter((a) => a.alive).flatMap((a) => a.hitboxes);
  }

  /** World x/z of alive animals matching a mission objective species. */
  goalPositions(species) {
    if (!species) return [];
    const out = [];
    for (const animal of this.animals) {
      if (!animal.alive || animal.type !== species) continue;
      out.push({ x: animal.root.position.x, z: animal.root.position.z });
    }
    for (const bird of this.ducks) {
      if (!bird.alive || bird.type !== species) continue;
      out.push({ x: bird.root.position.x, z: bird.root.position.z });
    }
    return out;
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
      const bird = this.ducks[i];
      bird.update(delta, this.flockTime);
      if (bird.expired) {
        bird.dispose();
        this.ducks.splice(i, 1);
      }
    }
  }
}
