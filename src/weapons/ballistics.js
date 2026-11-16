import * as THREE from 'three';
import { WEAPON } from '../config.js';

const raycaster = new THREE.Raycaster();
const SCREEN_CENTER = new THREE.Vector2(0, 0);
const _instanceMatrix = new THREE.Matrix4();
const _aimOrigin = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _stepFrom = new THREE.Vector3();
const _stepDelta = new THREE.Vector3();
const _gravity = new THREE.Vector3(0, -1, 0);

function worldMatrixOf(hit) {
  if (hit.instanceId === undefined) return hit.object.matrixWorld;
  hit.object.getMatrixAt(hit.instanceId, _instanceMatrix);
  return _instanceMatrix.premultiply(hit.object.matrixWorld);
}

/**
 * Straight-line cast from origin along a normalized direction, tested against
 * terrain, solid scenery, supply crates, tutorial apples, and animal hitboxes.
 * The nearest hit wins, so cover in front of a target stops the shot.
 * Foliage is never tested.
 *
 * Returns null on a clean miss, otherwise
 * { kind: 'animal' | 'cover' | 'loot' | 'apple', distance, point, normal?, object?, surface }.
 */
export function castRay(origin, direction, maxDistance, { targets, solids = [], heightfield = null, loot = [], apples = [] }) {
  const farCap = Math.max(0, maxDistance);
  if (farCap <= 0) return null;

  let best = null;

  if (heightfield) {
    const t = heightfield.raycast(origin, direction, farCap, WEAPON.terrainRayStep);
    if (t !== null && t <= farCap) {
      const point = origin.clone().addScaledVector(direction, t);
      best = { kind: 'cover', surface: 'terrain', distance: t, point, normal: heightfield.getNormalAt(point.x, point.z) };
    }
  }

  const far = best ? best.distance : farCap;
  raycaster.set(origin, direction);
  raycaster.far = far;
  const [solidHit] = solids.length ? raycaster.intersectObjects(solids, false) : [];
  if (solidHit && solidHit.distance <= far) {
    const normal = solidHit.face ? solidHit.face.normal.clone().transformDirection(worldMatrixOf(solidHit)) : null;
    best = { kind: 'cover', surface: solidHit.object.userData.surface, distance: solidHit.distance, point: solidHit.point, normal };
    raycaster.far = solidHit.distance;
  }

  const [targetHit] = targets.length ? raycaster.intersectObjects(targets, false) : [];
  const [lootHit] = loot.length ? raycaster.intersectObjects(loot, false) : [];
  const [appleHit] = apples.length ? raycaster.intersectObjects(apples, false) : [];

  const candidates = [];
  if (lootHit) candidates.push({ kind: 'loot', surface: 'crate', hit: lootHit });
  if (appleHit) candidates.push({ kind: 'apple', surface: 'apple', hit: appleHit });
  if (targetHit) candidates.push({ kind: 'animal', surface: 'animal', hit: targetHit });
  candidates.sort((a, b) => a.hit.distance - b.hit.distance);
  if (candidates.length) {
    const win = candidates[0];
    best = {
      kind: win.kind,
      surface: win.surface,
      distance: win.hit.distance,
      point: win.hit.point,
      object: win.hit.object,
    };
  }

  raycaster.far = Infinity;
  return best;
}

/**
 * Instant-hit ray from the camera through the screen centre (legacy helper /
 * debug). Prefer launchProjectile for live fire.
 */
export function hitscan(camera, opts) {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  return castRay(raycaster.ray.origin, raycaster.ray.direction, camera.far, opts);
}

/** Aim origin and unit direction from the camera through the screen centre. */
export function aimFromCamera(camera, origin = _aimOrigin, direction = _aimDir) {
  camera.updateMatrixWorld();
  raycaster.setFromCamera(SCREEN_CENTER, camera);
  origin.copy(raycaster.ray.origin);
  direction.copy(raycaster.ray.direction);
  return { origin, direction };
}

/**
 * Visible tracer: a fading line of recent flight points plus a bright tip.
 * Despawns after fadeTime once the round has stopped.
 */
class BulletTrail {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    this.alive = true;
    this.fading = false;
    this.fadeAge = 0;
    this.count = 0;

    const positions = new Float32Array(cfg.maxPoints * 3);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.LineBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
    this.line.renderOrder = 8;
    scene.add(this.line);

    this.tip = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({
        color: cfg.tipColor,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.tip.scale.setScalar(cfg.tipSize);
    this.tip.frustumCulled = false;
    this.tip.renderOrder = 9;
    scene.add(this.tip);
  }

  push(point) {
    const attr = this.geometry.attributes.position;
    const max = this.cfg.maxPoints;
    if (this.count < max) {
      point.toArray(attr.array, this.count * 3);
      this.count += 1;
    } else {
      attr.array.copyWithin(0, 3);
      point.toArray(attr.array, (max - 1) * 3);
    }
    attr.needsUpdate = true;
    this.geometry.setDrawRange(0, this.count);
    this.geometry.computeBoundingSphere();
    this.tip.position.copy(point);
  }

  beginFade() {
    this.fading = true;
    this.fadeAge = 0;
    this.tip.visible = false;
  }

  update(delta) {
    if (!this.fading) return true;
    this.fadeAge += delta;
    const life = this.fadeAge / this.cfg.fadeTime;
    if (life >= 1) {
      this.dispose();
      return false;
    }
    this.material.opacity = this.cfg.opacity * (1 - life);
    return true;
  }

  dispose() {
    if (!this.alive) return;
    this.alive = false;
    this.line.removeFromParent();
    this.tip.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.tip.geometry.dispose();
    this.tip.material.dispose();
  }
}

/**
 * One in-flight round: gravity drop, segment collision, and a visible trail.
 * No wind. `onResolve(hit|null)` receives the castRay hit, or null on max-range miss.
 */
export class Projectile {
  constructor(scene, origin, direction, query, onResolve) {
    const cfg = WEAPON.ballistics;
    this.query = query;
    this.onResolve = onResolve;
    this.origin = origin.clone();
    this.position = origin.clone();
    this.velocity = direction.clone().normalize().multiplyScalar(cfg.muzzleVelocity);
    this.traveled = 0;
    this.maxRange = cfg.maxRange;
    this.maxStep = cfg.maxStep;
    this.gravity = cfg.gravity;
    this.done = false;
    this.trail = new BulletTrail(scene, cfg.trail);
    this.trail.push(this.position);
  }

  /**
   * Advance physics and collide along the path. Returns false when the round
   * (and its fading trail) should be removed from the active list.
   */
  update(delta) {
    if (this.done) return this.trail.update(delta);

    const steps = Math.max(1, Math.ceil((this.velocity.length() * delta) / this.maxStep));
    const dt = delta / steps;

    for (let i = 0; i < steps; i++) {
      _stepFrom.copy(this.position);
      this.velocity.addScaledVector(_gravity, this.gravity * dt);
      _stepDelta.copy(this.velocity).multiplyScalar(dt);
      const stepLen = _stepDelta.length();
      if (stepLen <= 1e-8) continue;

      this.position.add(_stepDelta);
      this.traveled += stepLen;

      const dir = _stepDelta.normalize();
      const hit = castRay(_stepFrom, dir, stepLen, this.query());
      if (hit) {
        // Score with muzzle→impact range (same spirit as the old hitscan distance).
        hit.distance = this.origin.distanceTo(hit.point);
        this.position.copy(hit.point);
        this.trail.push(this.position);
        this.finish(hit);
        return true;
      }

      this.trail.push(this.position);

      if (this.traveled >= this.maxRange) {
        this.finish(null);
        return true;
      }
    }

    return true;
  }

  finish(hit) {
    if (this.done) return;
    this.done = true;
    this.trail.beginFade();
    this.onResolve?.(hit);
  }

  dispose() {
    this.trail.dispose();
  }
}
