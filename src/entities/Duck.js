import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMALS, DUCKS } from '../config.js';
import { enableShadows } from '../core/assets.js';
import { createHitSphere } from './hitbox.js';

function indexClips(animations) {
  const clips = {};
  for (const clip of animations) clips[clip.name] = clip;
  return clips;
}

/** Scale and clips for the shared duck template. */
export function prepareDucks(gltf) {
  const template = gltf.scene;
  enableShadows(template, true, false);
  template.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template, true);
  const size = box.getSize(new THREE.Vector3());
  const scale = DUCKS.height / size.y;
  const center = box.getCenter(new THREE.Vector3());
  center.multiplyScalar(scale);
  center.y += -box.min.y * scale;
  return {
    template,
    clips: indexClips(gltf.animations),
    scale,
    groundOffset: -box.min.y * scale,
    center,
  };
}

/** Leader pose on the circling path. Yaw 0 faces +Z, matching the other animals. */
export function flockPose(time) {
  const { radius, speed, altitude } = DUCKS;
  const angle = (time * speed) / radius;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const forwardX = -Math.sin(angle);
  const forwardZ = Math.cos(angle);
  return {
    x,
    z,
    forwardX,
    forwardZ,
    yaw: Math.atan2(forwardX, forwardZ),
    altitude,
  };
}

export class Duck {
  constructor(prepared, slot, world) {
    this.type = 'duck';
    this.premium = false;
    this.scoreMultiplier = 1;
    this.world = world;
    this.slot = slot;
    this.prepared = prepared;

    this.root = new THREE.Group();
    this.root.name = 'duck';
    this.root.rotation.order = 'YXZ';

    this.model = cloneSkinned(prepared.template);
    this.model.scale.setScalar(prepared.scale);
    this.model.position.y = prepared.groundOffset;
    this.root.add(this.model);

    this.hitbox = createHitSphere(this, DUCKS.hitRadius, 'body');
    this.hitbox.position.copy(prepared.center);
    this.hitboxes = [this.hitbox];
    this.root.add(this.hitbox);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.alive = true;
    this.grounded = false;
    this.timeSinceDeath = 0;
    this.fallSpeed = 0;
    this.velocity = new THREE.Vector3();
    this.play(DUCKS.flyClip);
  }

  get expired() {
    return !this.alive && this.grounded && this.timeSinceDeath > ANIMALS.corpseLifetime;
  }

  play(name, { once = false } = {}) {
    const clip = this.prepared.clips[name];
    if (!clip) return;
    const previous = this.action;
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    if (previous && previous !== action) {
      previous.fadeOut(0.15);
      action.fadeIn(0.15);
    }
    action.play();
    this.action = action;
  }

  kill() {
    if (!this.alive) return false;
    this.alive = false;
    this.play(DUCKS.deathClip, { once: true });
    return true;
  }

  update(delta, flockTime) {
    if (this.alive) this.fly(flockTime);
    else this.fall(delta);
    this.mixer.update(delta);
  }

  fly(flockTime) {
    const pose = flockPose(flockTime);
    const { right, back } = this.slot;
    // Right of the travel direction, then back along it.
    const rightX = pose.forwardZ;
    const rightZ = -pose.forwardX;
    const x = pose.x + rightX * right - pose.forwardX * back;
    const z = pose.z + rightZ * right - pose.forwardZ * back;
    const y = this.world.getHeightAt(x, z) + pose.altitude;
    this.root.position.set(x, y, z);
    this.root.rotation.x = 0;
    this.root.rotation.y = pose.yaw;
    this.velocity.set(pose.forwardX * DUCKS.speed, 0, pose.forwardZ * DUCKS.speed);
  }

  fall(delta) {
    if (this.grounded) {
      this.timeSinceDeath += delta;
      return;
    }
    this.fallSpeed += DUCKS.gravity * delta;
    this.root.position.x += this.velocity.x * delta;
    this.root.position.z += this.velocity.z * delta;
    this.root.position.y -= this.fallSpeed * delta;
    this.root.rotation.x = Math.min(1.1, this.root.rotation.x + delta * 2);
    const ground = this.world.getHeightAt(this.root.position.x, this.root.position.z);
    if (this.root.position.y <= ground) {
      this.root.position.y = ground;
      this.grounded = true;
      this.fallSpeed = 0;
      this.velocity.set(0, 0, 0);
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent();
  }
}
