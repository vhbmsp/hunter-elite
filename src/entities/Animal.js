import * as THREE from 'three';
import { ANIMALS, WORLD } from '../config.js';
import { createBillboard } from '../world/billboard.js';
import { createHitbox } from './hitbox.js';

const _toward = new THREE.Vector3();

// Weighted state transitions: [cumulative probability, state, base duration, random extra].
const TRANSITIONS = [
  [0.35, 'idle', 2, 5],
  [0.6, 'sideways', 3, 4],
  [0.8, 'run', 2, 3],
  [0.9, 'approach', 4, 3],
  [1.0, 'recede', 4, 3],
];

export class Animal {
  constructor(type, texture, position) {
    const width = type.scale * 1.6;
    const height = type.scale;

    this.type = type.name;
    this.mesh = createBillboard(texture, width, height);
    this.mesh.position.copy(position);
    this.mesh.name = type.name;
    this.hitbox = createHitbox(width, height);
    this.hitbox.userData.animal = this;
    this.mesh.add(this.hitbox);

    this.baseY = position.y;
    this.alive = true;
    this.timeSinceDeath = 0;
    this.state = 'idle';
    this.stateTimer = 1 + Math.random() * 4;
    this.speed = ANIMALS.speedMin + Math.random() * ANIMALS.speedRange;
    this.direction = Math.random() * Math.PI * 2;
  }

  get expired() {
    return !this.alive && this.timeSinceDeath > ANIMALS.corpseLifetime;
  }

  kill() {
    if (!this.alive) return false;
    this.alive = false;
    this.mesh.material.opacity = ANIMALS.deadOpacity;
    this.mesh.material.color.set(ANIMALS.deadColor);
    return true;
  }

  update(delta, playerPosition) {
    if (!this.alive) {
      this.timeSinceDeath += delta;
      return;
    }

    this.stateTimer -= delta;
    if (this.stateTimer <= 0) this.pickState();

    this.move(delta, playerPosition);
    this.faceCamera(playerPosition);
  }

  pickState() {
    const roll = Math.random();
    const [, state, base, extra] = TRANSITIONS.find(([p]) => roll < p);
    this.state = state;
    this.stateTimer = base + Math.random() * extra;
    if (state === 'sideways' || state === 'run') {
      this.direction = Math.random() * Math.PI * 2;
    }
  }

  move(delta, playerPosition) {
    const pos = this.mesh.position;
    const mul = ANIMALS.moveScale[this.state];
    if (!mul) return;

    const step = this.speed * (this.state === 'run' ? ANIMALS.runMultiplier : 1) * delta * mul;

    if (this.state === 'sideways' || this.state === 'run') {
      pos.x += Math.cos(this.direction) * step;
      pos.z += Math.sin(this.direction) * step;
    } else {
      _toward.set(playerPosition.x - pos.x, 0, playerPosition.z - pos.z);
      const dist = _toward.length();
      if (this.state === 'approach') {
        pos.addScaledVector(_toward.normalize(), Math.min(step, Math.max(0, dist - ANIMALS.minPlayerDistance)));
      } else {
        pos.addScaledVector(_toward.normalize(), -step);
      }
    }

    // Keep inside the playable disc.
    const r = Math.hypot(pos.x, pos.z);
    if (r > WORLD.roamRadius) {
      pos.x *= WORLD.roamRadius / r;
      pos.z *= WORLD.roamRadius / r;
    }
    pos.y = this.baseY;
  }

  faceCamera(playerPosition) {
    const { mesh } = this;
    mesh.rotation.y = Math.atan2(playerPosition.x - mesh.position.x, playerPosition.z - mesh.position.z);

    // Mirror the sprite to match lateral movement direction.
    const lateral = this.state === 'sideways' || this.state === 'run';
    mesh.scale.x = lateral && Math.cos(this.direction) <= 0 ? -1 : 1;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.hitbox.geometry.dispose();
  }
}
