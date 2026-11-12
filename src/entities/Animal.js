import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMALS, WORLD } from '../config.js';
import { createAnimalHitboxes } from './hitbox.js';

const _front = new THREE.Vector3();
const _back = new THREE.Vector3();
const _head = new THREE.Vector3();
const _neck = new THREE.Vector3();
const _neckPoint = new THREE.Vector3();
const _neckEnd = new THREE.Vector3();
const _neckQuat = new THREE.Quaternion();
const _yAxis = new THREE.Vector3(0, 1, 0);
const _chainPoints = Array.from({ length: 8 }, () => new THREE.Vector3());
const _neckPolyline = Array.from({ length: 8 }, () => new THREE.Vector3());

// The neck volume meets the head sphere. Stopping a full neck-radius short of
// the sphere leaves the skull base uncovered on a thick neck.
// The chest bone sits on the spine. Starting the neck part-way to the next
// bone keeps the volume off the withers, where a full cylinder would stick
// into the air above the back. The body ellipsoid still covers the base.
const NECK_CHEST_SKIP = 0.22;

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
  constructor(species, position, world) {
    this.species = species;
    this.type = species.name;
    this.premium = Boolean(species.premium);
    this.scoreMultiplier = species.scoreMultiplier ?? 1;
    this.world = world;

    // root: ground position + heading. YXZ so yaw applies before the slope pitch.
    this.root = new THREE.Group();
    this.root.name = species.name;
    this.root.rotation.order = 'YXZ';
    this.root.position.set(position.x, world.getHeightAt(position.x, position.z), position.z);
    this.yaw = Math.random() * Math.PI * 2;
    this.pitch = 0;
    this.root.rotation.y = this.yaw;

    this.model = cloneSkinned(species.template);
    this.model.scale.setScalar(species.scale);
    this.model.position.y = species.groundOffset;
    this.root.add(this.model);

    this.bones = Object.fromEntries(
      Object.entries(species.bones).map(([key, name]) => [key, this.model.getObjectByName(name)]),
    );

    this.root.updateMatrixWorld(true);
    this.neckChain = neckChain(this.bones.chest, this.bones.neck);
    const neckSlots = Math.min(_chainPoints.length - 1, this.neckChain.length + 1);
    const { body, head, neckSegments, neckJoints } = createAnimalHitboxes(this, { ...species.hitbox, neckSlots });
    this.neckSegments = neckSegments;
    this.neckJoints = neckJoints;
    this.hitboxes = [body, ...neckSegments, ...neckJoints, head];
    this.bodyHitbox = body;
    this.headHitbox = head;
    this.root.add(body, head, ...neckSegments, ...neckJoints);

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
    if (this.species.clipNames.death) this.play(this.species.clipNames.death, { once: true });
    return true;
  }

  enterState(state, duration) {
    this.state = state;
    this.stateTimer = duration;
    const { walkSpeed, runSpeed, walkClipSpeed, runClipSpeed, clipNames } = this.species;

    if (state === 'idle') {
      this.speed = 0;
      const idles = clipNames.idle;
      this.play(idles[Math.floor(Math.random() * idles.length)]);
      return;
    }
    if (state === 'sideways' || state === 'run') this.direction = Math.random() * Math.PI * 2;

    if (state === 'run') {
      this.speed = runSpeed * this.speedFactor;
      this.play(clipNames.run, { timeScale: this.speed / runClipSpeed });
    } else {
      this.speed = walkSpeed * this.speedFactor;
      this.play(clipNames.walk, { timeScale: this.speed / walkClipSpeed });
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
    this.stickToGround(delta);
    this.mixer.update(delta);
    this.updateHitboxes();
  }

  /** Plant the feet on the heightfield and pitch the body to the slope. */
  stickToGround(delta) {
    const { x, z } = this.root.position;
    const y = this.world.getHeightAt(x, z);
    this.root.position.y = y;
    const ahead = this.world.getHeightAt(x + Math.sin(this.yaw), z + Math.cos(this.yaw));
    const targetPitch = -Math.atan(ahead - y);
    this.pitch += (targetPitch - this.pitch) * (1 - Math.exp(-ANIMALS.pitchRate * delta));
    this.root.rotation.x = this.pitch;
    this.root.rotation.y = this.yaw;
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

    // Refuse the step if the ground ahead is too steep, and veer off instead.
    const probe = ANIMALS.slopeProbe;
    const aheadX = pos.x + Math.sin(this.yaw) * probe;
    const aheadZ = pos.z + Math.cos(this.yaw) * probe;
    const grade = (this.world.getHeightAt(aheadX, aheadZ) - this.world.getHeightAt(pos.x, pos.z)) / probe;
    if (grade > ANIMALS.maxSlope || this.world.getSlopeAt(aheadX, aheadZ) > ANIMALS.maxSlope) {
      this.yaw += (Math.random() < 0.5 ? 1 : -1) * ANIMALS.turnRate * delta * 3;
      this.root.rotation.y = this.yaw;
      return;
    }

    // Walk along the current facing; uphill costs speed.
    const climb = grade > 0 ? Math.max(0.4, 1 - grade * ANIMALS.uphillPenalty) : 1;
    const step = this.speed * climb * delta;
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
    if (this.species.snoutAxis) {
      const axis = this.species.snoutAxis;
      _neck.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
      _neck.transformDirection(bones.head.matrixWorld).normalize();
    } else {
      bones.neck.getWorldPosition(_neck);
      // Bone origin is at the skull base; push the sphere toward the snout.
      _neck.subVectors(_head, _neck).normalize();
    }
    _head.addScaledVector(_neck, hitbox.headRadius * hitbox.snoutPush);
    this.placeNeck(_head);
    headHitbox.position.copy(root.worldToLocal(_head));
  }

  /**
   * Cylinders along the chest → neck bones, plus a sphere at each bend.
   * The chain stops short of the head centre so a neck hit scores as a body
   * shot and the skull stays a head shot. Joints follow the skeleton when
   * the animal drops its head to graze.
   */
  placeNeck(headCenter) {
    const { neckRadius, headRadius } = this.species.hitbox;
    const pointCount = writeNeckPoints(this.neckChain, this.bones.head, _chainPoints);
    if (pointCount >= 2 && this.bones.chest !== this.bones.neck) {
      _chainPoints[0].lerp(_chainPoints[1], NECK_CHEST_SKIP);
    }
    // The boar's neck mesh is offset from the bone. The offset is in that bone's
    // rest space, so it follows the head when the animal moves.
    if (this.species.hitbox.neckOffset.lengthSq() > 1e-8) {
      this.bones.neck.getWorldQuaternion(_neckQuat);
      _neckPoint.copy(this.species.hitbox.neckOffset).applyQuaternion(_neckQuat);
      for (let i = 0; i < pointCount; i++) _chainPoints[i].add(_neckPoint);
    }
    const total = polylineLength(_chainPoints, pointCount);
    // End inside the head sphere, not on its surface. A thick neck stopped at
    // the surface still leaves the skull base bare; ending halfway to the
    // centre covers that base, and a shot at the skull still hits the head
    // first because the sphere sits in front of the cylinder.
    const keepOff = headRadius * 0.55;
    const limit = distanceBefore(headCenter, keepOff, total, pointCount);
    const joints = clampPolyline(_chainPoints, pointCount, limit, _neckPolyline);
    const { root } = this;

    for (let i = 0; i < this.neckSegments.length; i++) {
      const segment = this.neckSegments[i];
      const joint = this.neckJoints[i];
      if (i >= joints - 1) {
        deactivateNeck(segment);
        deactivateNeck(joint);
        continue;
      }
      const a = root.worldToLocal(_neckPolyline[i].clone());
      const b = root.worldToLocal(_neckPolyline[i + 1].clone());
      _neckEnd.subVectors(b, a);
      const length = _neckEnd.length();
      if (length < 1e-4) {
        deactivateNeck(segment);
      } else {
        activateNeck(segment);
        segment.position.copy(a).lerp(b, 0.5);
        segment.quaternion.setFromUnitVectors(_yAxis, _neckEnd.multiplyScalar(1 / length));
        segment.scale.set(neckRadius, length, neckRadius);
      }
      // A sphere at each bend fills the outside of the corner. The last joint
      // sits on the head sphere, so a sphere there would swallow the skull and
      // turn a head shot into a body shot. The cylinder cap covers that seam.
      const meetsHead = i === joints - 2;
      if (meetsHead) {
        deactivateNeck(joint);
      } else {
        activateNeck(joint);
        joint.position.copy(b);
        joint.scale.setScalar(neckRadius);
      }
    }
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    this.root.removeFromParent();
  }
}

/** Chest to skull base. One bone when the chest and the neck are the same (boar). */
function neckChain(chest, neck) {
  if (chest === neck) return [neck];
  const towardSkull = [];
  const seen = new Set();
  let bone = neck;
  while (bone && bone !== chest && !seen.has(bone)) {
    seen.add(bone);
    towardSkull.push(bone);
    bone = bone.parent;
  }
  towardSkull.reverse();
  return bone === chest ? [chest, ...towardSkull] : [chest, neck];
}

const _skipRaycast = () => {};

function deactivateNeck(mesh) {
  mesh.scale.set(0, 0, 0);
  mesh.raycast = _skipRaycast;
}

function activateNeck(mesh) {
  if (mesh.raycast === _skipRaycast) delete mesh.raycast;
}

function writeNeckPoints(chain, head, points) {
  for (let i = 0; i < chain.length; i++) {
    ensurePoint(points, i);
    chain[i].getWorldPosition(points[i]);
  }
  const end = chain.length;
  ensurePoint(points, end);
  if (chain[chain.length - 1] !== head) head.getWorldPosition(points[end]);
  else points[end].copy(points[end - 1]);
  return chain[chain.length - 1] === head ? chain.length : chain.length + 1;
}

function ensurePoint(points, index) {
  if (!points[index]) points[index] = new THREE.Vector3();
}

function polylineLength(points, count) {
  let total = 0;
  for (let i = 1; i < count; i++) total += points[i - 1].distanceTo(points[i]);
  return total;
}

/** Joints from the chest up to `limit`, so the last point stops at the skull. */
function clampPolyline(points, count, limit, out) {
  ensurePoint(out, 0);
  out[0].copy(points[0]);
  if (limit <= 1e-4) return 1;
  let written = 1;
  let travelled = 0;
  for (let i = 1; i < count; i++) {
    const seg = points[i - 1].distanceTo(points[i]);
    if (travelled + seg <= limit + 1e-4) {
      ensurePoint(out, written);
      out[written].copy(points[i]);
      written += 1;
      travelled += seg;
      if (travelled >= limit - 1e-4) break;
      continue;
    }
    const t = seg < 1e-5 ? 0 : (limit - travelled) / seg;
    ensurePoint(out, written);
    out[written].copy(points[i - 1]).lerp(points[i], THREE.MathUtils.clamp(t, 0, 1));
    written += 1;
    break;
  }
  return written;
}

function pointAlong(points, count, distance, target) {
  let left = distance;
  for (let i = 1; i < count; i++) {
    const len = points[i - 1].distanceTo(points[i]);
    if (left <= len || i === count - 1) {
      const t = len < 1e-5 ? 0 : THREE.MathUtils.clamp(left / len, 0, 1);
      return target.copy(points[i - 1]).lerp(points[i], t);
    }
    left -= len;
  }
  return target.copy(points[0]);
}

/** How far along the polyline a neck centre can sit without swallowing the skull. */
function distanceBefore(headCenter, keepOff, total, pointCount) {
  pointAlong(_chainPoints, pointCount, 0, _neckPoint);
  if (_neckPoint.distanceTo(headCenter) < keepOff) return 0;
  let lo = 0;
  let hi = total;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) * 0.5;
    pointAlong(_chainPoints, pointCount, mid, _neckPoint);
    if (_neckPoint.distanceTo(headCenter) < keepOff) hi = mid;
    else lo = mid;
  }
  return lo;
}
