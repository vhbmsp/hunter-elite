import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMAL_CLIPS, ANIMALS, WORLD } from '../config.js';
import { createAnimalHitboxes } from './hitbox.js';
import { RIG_BONES } from './species.js';

const _front = new THREE.Vector3();
const _back = new THREE.Vector3();
const _head = new THREE.Vector3();
const _neck = new THREE.Vector3();

// Weighted state transitions: [cumulative probability, state, base duration, random extra].
const TRANSITIONS = [
  [0.35, 'idle', 2, 5],
  [0.6, 'sideways', 3, 4],
  [0.8, 'run', 2, 3],
  [0.9, 'approach', 4, 3],
  [1.0, 'recede', 4, 3],
];

const randomRange = ([min, max]) => min + Math.random() * (max - min);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Animal {
  constructor(species, position) {
    this.species = species;
    this.type = species.name;

    // root: ground position + heading (yaw). model: scaled skinned clone, facing +Z.
    this.root = new THREE.Group();
    this.root.name = species.name;
    this.root.position.set(position.x, 0, position.z);
    this.yaw = Math.random() * Math.PI * 2;
    this.root.rotation.y = this.yaw;

    this.model = cloneSkinned(species.template);
    this.model.scale.setScalar(species.scale);
    this.model.position.y = species.groundOffset;
    this.root.add(this.model);

    this.bones = Object.fromEntries(
      Object.entries(RIG_BONES).map(([key, name]) => [key, this.model.getObjectByName(name)]),
    );

    const { body, head } = createAnimalHitboxes(this, species.hitbox);
    this.hitboxes = [body, head];
    this.bodyHitbox = body;
    this.headHitbox = head;
    this.root.add(body, head);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.action = null;

    this.alive = true;
    this.timeSinceDeath = 0;
    this.speedFactor = randomRange(ANIMALS.speedVariance);
    this.direction = Math.random() * Math.PI * 2;
    this.enterState('idle', 1 + Math.random() * 4);
  }

  get expired() {
    return !this.alive && this.timeSinceDeath > ANIMALS.corpseLifetime;
  }

  play(clipName, { timeScale = 1, once = false } = {}) {
    const clip = this.species.clips[clipName];
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.timeScale = timeScale;
    if (next === this.action) return;

    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    if (this.action) next.crossFadeFrom(this.action, ANIMALS.crossFade, false);
    this.action = next;
  }

  kill() {
    if (!this.alive) return false;
    this.alive = false;
    this.play(ANIMAL_CLIPS.death, { once: true });
    return true;
  }

  enterState(state, duration) {
    this.state = state;
    this.stateTimer = duration;
    const { walkSpeed, runSpeed, walkClipSpeed, runClipSpeed } = this.species;

    if (state === 'idle') {
      this.speed = 0;
      const idles = ANIMAL_CLIPS.idle;
      this.play(idles[Math.floor(Math.random() * idles.length)]);
      return;
    }
    if (state === 'sideways' || state === 'run') this.direction = Math.random() * Math.PI * 2;

    if (state === 'run') {
      this.speed = runSpeed * this.speedFactor;
      this.play(ANIMAL_CLIPS.run, { timeScale: this.speed / runClipSpeed });
    } else {
      this.speed = walkSpeed * this.speedFactor;
      this.play(ANIMAL_CLIPS.walk, { timeScale: this.speed / walkClipSpeed });
    }
  }

  pickState() {
    const roll = Math.random();
    const [, state, base, extra] = TRANSITIONS.find(([p]) => roll < p);
    this.enterState(state, base + Math.random() * extra);
  }

  update(delta, playerPosition) {
    if (this.alive) {
      this.stateTimer -= delta;
      if (this.stateTimer <= 0) this.pickState();
      this.move(delta, playerPosition);
    } else {
      this.timeSinceDeath += delta;
    }
    this.mixer.update(delta);
    this.updateHitboxes();
  }

  /** Desired heading for the current state (yaw, 0 = +Z), or null to keep the current one. */
  targetYaw(playerPosition) {
    const pos = this.root.position;
    switch (this.state) {
      case 'sideways':
      case 'run':
        return Math.atan2(Math.cos(this.direction), Math.sin(this.direction));
      case 'approach':
        return Math.atan2(playerPosition.x - pos.x, playerPosition.z - pos.z);
      case 'recede':
        return Math.atan2(pos.x - playerPosition.x, pos.z - playerPosition.z);
      default:
        return null;
    }
  }

  move(delta, playerPosition) {
    if (this.speed === 0) return;
    const pos = this.root.position;

    if (this.state === 'approach') {
      const dist = Math.hypot(playerPosition.x - pos.x, playerPosition.z - pos.z);
      if (dist <= ANIMALS.minPlayerDistance) {
        this.enterState('idle', 2 + Math.random() * 3);
        return;
      }
    }

    const target = this.targetYaw(playerPosition);
    if (target !== null) {
      const diff = wrapAngle(target - this.yaw);
      const maxTurn = ANIMALS.turnRate * delta;
      this.yaw += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);
      this.root.rotation.y = this.yaw;
    }

    // Walk along the current facing so turns arc instead of sliding sideways.
    const step = this.speed * delta;
    pos.x += Math.sin(this.yaw) * step;
    pos.z += Math.cos(this.yaw) * step;

    const r = Math.hypot(pos.x, pos.z);
    if (r > WORLD.roamRadius) {
      pos.x *= WORLD.roamRadius / r;
      pos.z *= WORLD.roamRadius / r;
      // Head back toward the centre of the map.
      this.direction = Math.atan2(-pos.z, -pos.x);
    }
  }

  updateHitboxes() {
    const { root, model, bones, bodyHitbox, headHitbox } = this;
    root.updateMatrixWorld(true);

    const { hitbox } = this.species;
    bones.chest.getWorldPosition(_front);
    bones.rump.getWorldPosition(_back);
    _back.lerp(_front, 0.5);
    _back.y -= hitbox.body.dropBelowSpine;
    _front.y -= hitbox.body.dropBelowSpine;
    bodyHitbox.position.copy(root.worldToLocal(_back));
    bodyHitbox.lookAt(_front);

    bones.head.getWorldPosition(_head);
    bones.neck.getWorldPosition(_neck);
    // Bone origin is at the skull base; push the sphere toward the snout.
    _neck.subVectors(_head, _neck).normalize();
    _head.addScaledVector(_neck, hitbox.headRadius * 0.6);
    headHitbox.position.copy(root.worldToLocal(_head));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent();
  }
}
