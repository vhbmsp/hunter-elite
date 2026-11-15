import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMALS, BIRDS } from '../config.js';
import { enableShadows } from '../core/assets.js';
import { createHitSphere } from './hitbox.js';

function indexClips(animations) {
  const clips = {};
  for (const clip of animations) clips[clip.name] = clip;
  return clips;
}

/** Scale and clips for a shared flying-bird template (duck, goose, …). */
export function prepareBird(gltf, config) {
  const template = gltf.scene;
  enableShadows(template, true, false);
  template.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template, true);
  const size = box.getSize(new THREE.Vector3());
  const scale = config.height / size.y;
  const center = box.getCenter(new THREE.Vector3());
  center.multiplyScalar(scale);
  center.y += -box.min.y * scale;
  return {
    template,
    clips: indexClips(gltf.animations),
    scale,
    groundOffset: -box.min.y * scale,
    center,
    config,
  };
}

/** @deprecated Prefer prepareBird(gltf, BIRDS.duck). */
export function prepareDucks(gltf) {
  return prepareBird(gltf, BIRDS.duck);
}

/** Leader pose on the circling path. Yaw 0 faces +Z, matching the other animals. */
export function flockPose(time, config) {
  const { radius, speed, altitude } = config;
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

export class Bird {
  constructor(prepared, slot, world, config = prepared.config) {
    this.config = config;
    this.type = config.name;
    this.premium = false;
    this.scoreMultiplier = 1;
    this.world = world;
    this.slot = slot;
    this.prepared = prepared;

    this.root = new THREE.Group();
    this.root.name = config.name;
    this.root.rotation.order = 'YXZ';

    this.model = cloneSkinned(prepared.template);
    this.model.scale.setScalar(prepared.scale);
    this.model.position.y = prepared.groundOffset;
    this.root.add(this.model);

    this.hitbox = createHitSphere(this, config.hitRadius, 'body');
    this.hitbox.position.copy(prepared.center);
    this.hitboxes = [this.hitbox];
    this.root.add(this.hitbox);

    this.mixer = new THREE.AnimationMixer(this.model);
    this.alive = true;
    this.grounded = false;
    this.timeSinceDeath = 0;
    this.fallSpeed = 0;
    this.flapPhase = Math.random() * Math.PI * 2;
    this.velocity = new THREE.Vector3();
    this.leftWing = this.model.getObjectByName(config.leftWing ?? 'LeftHand');
    this.rightWing = this.model.getObjectByName(config.rightWing ?? 'RightHand');
    this.flapAxis = config.flapAxis ?? 'x';
    this.play(config.flyClip);
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
    this.play(this.config.deathClip, { once: true });
    return true;
  }

  update(delta, flockTime) {
    if (this.alive) this.fly(flockTime);
    else this.fall(delta);
    this.mixer.update(delta);
    if (this.alive) this.flapWings(flockTime);
  }

  fly(flockTime) {
    const pose = flockPose(flockTime, this.config);
    const { right, back } = this.slot;
    // Right of the travel direction, then back along it.
    const rightX = pose.forwardZ;
    const rightZ = -pose.forwardX;
    const x = pose.x + rightX * right - pose.forwardX * back;
    const z = pose.z + rightZ * right - pose.forwardZ * back;
    const y = this.world.getHeightAt(x, z) + pose.altitude;
    this.root.position.set(x, y, z);
    this.root.rotation.x = this.config.flyPitch;
    this.root.rotation.y = pose.yaw;
    this.velocity.set(pose.forwardX * this.config.speed, 0, pose.forwardZ * this.config.speed);
  }

  /** Soft additive beat on wing bones after the fly clip writes them. */
  flapWings(flockTime) {
    if (!this.leftWing || !this.rightWing) return;
    const beat = Math.sin(flockTime * this.config.flapHz * Math.PI * 2 + this.flapPhase) * this.config.flapAmp;
    const axis = this.flapAxis;
    this.leftWing.rotation[axis] += beat;
    this.rightWing.rotation[axis] -= beat;
  }

  fall(delta) {
    if (this.grounded) {
      this.timeSinceDeath += delta;
      return;
    }
    this.fallSpeed += this.config.gravity * delta;
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

/** @deprecated Prefer Bird. */
export const Duck = Bird;
