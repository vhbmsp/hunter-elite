import * as THREE from 'three';
import { LOOT, PLAYER } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

function canvasTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function crateTexture() {
  return canvasTexture((g, w, h) => {
    g.fillStyle = css(LOOT.crateColor);
    g.fillRect(0, 0, w, h);
    g.strokeStyle = css(LOOT.bandColor);
    g.globalAlpha = 0.35;
    g.lineWidth = 4;
    g.beginPath();
    for (let x = 32; x < w; x += 32) {
      g.moveTo(x, 0);
      g.lineTo(x, h);
    }
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = css(LOOT.bandColor);
    g.fillRect(0, 36, w, 28);
    g.fillRect(0, h - 64, w, 28);
  });
}

function chuteTexture() {
  return canvasTexture((g, w, h) => {
    g.fillStyle = css(LOOT.chuteColor);
    g.fillRect(0, 0, w, h);
    g.strokeStyle = css(LOOT.chuteTrimColor);
    g.lineWidth = 10;
    g.beginPath();
    const gores = 8;
    for (let i = 0; i < gores; i++) {
      const x = ((i + 0.5) / gores) * w;
      g.moveTo(x, 0);
      g.lineTo(x, h - 36);
    }
    g.stroke();
    g.fillStyle = css(LOOT.chuteTrimColor);
    g.fillRect(0, h - 36, w, 36);
  });
}

function createLibrary() {
  const [w, h, d] = LOOT.crateSize;
  const crateGeo = new THREE.BoxGeometry(w, h, d);
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTexture(), roughness: 0.86 });
  const chuteGeo = new THREE.SphereGeometry(LOOT.chuteRadius, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const chuteMat = new THREE.MeshStandardMaterial({
    map: chuteTexture(),
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const ropeGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
  const ropeMat = new THREE.MeshStandardMaterial({ color: LOOT.ropeColor, roughness: 0.7 });
  return { crateGeo, crateMat, chuteGeo, chuteMat, ropeGeo, ropeMat, half: h / 2 };
}

function addRope(group, shared, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const mesh = new THREE.Mesh(shared.ropeGeo, shared.ropeMat);
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  dir.multiplyScalar(1 / length);
  mesh.quaternion.setFromUnitVectors(UP, dir);
  mesh.scale.y = length;
  // Cloth and lines are visual. Only the crate mesh stops a bullet.
  mesh.raycast = () => {};
  group.add(mesh);
}

/** A spot in the forward arc, on ground gentle enough for a crate to sit. */
function chooseLanding(world) {
  const [px, , pz] = PLAYER.position;
  let pick = null;
  for (let i = 0; i < 8; i++) {
    // π/2 → +Z (world north), matching the Tower S start facing.
    const angle = Math.PI / 2 + (Math.random() - 0.5) * LOOT.spawnArc;
    const dist = LOOT.minDistance + Math.random() * (LOOT.maxDistance - LOOT.minDistance);
    pick = { x: px + Math.cos(angle) * dist, z: pz + Math.sin(angle) * dist };
    if (world.getSlopeAt(pick.x, pick.z) <= LOOT.maxSlope) return pick;
  }
  return pick;
}

class LootCrate {
  constructor(shared, world) {
    this.shared = shared;
    this.alive = true;
    this.state = 'falling';
    this.age = 0;
    this.groundTime = 0;
    this.collapse = 0;

    const landing = chooseLanding(world);
    this.x = landing.x;
    this.z = landing.z;
    this.y = world.getHeightAt(this.x, this.z) + LOOT.dropHeight;

    const driftAngle = Math.random() * Math.PI * 2;
    this.driftX = Math.cos(driftAngle) * LOOT.driftSpeed;
    this.driftZ = Math.sin(driftAngle) * LOOT.driftSpeed;
    this.swayX = -Math.sin(driftAngle);
    this.swayZ = Math.cos(driftAngle);

    this.root = new THREE.Group();
    this.root.name = 'supply-crate';

    this.mesh = new THREE.Mesh(shared.crateGeo, shared.crateMat);
    this.mesh.name = 'loot-crate';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.crate = this;
    this.root.add(this.mesh);

    this.parachute = new THREE.Group();
    const canopy = new THREE.Mesh(shared.chuteGeo, shared.chuteMat);
    canopy.position.y = LOOT.chuteHeight;
    canopy.castShadow = true;
    canopy.raycast = () => {};
    this.parachute.add(canopy);

    const rim = LOOT.chuteRadius * 0.92;
    const [w, , d] = LOOT.crateSize;
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const top = new THREE.Vector3(Math.cos(a) * rim, LOOT.chuteHeight, Math.sin(a) * rim);
      const bottom = new THREE.Vector3(Math.sign(Math.cos(a)) * w * 0.46, shared.half, Math.sign(Math.sin(a)) * d * 0.46);
      addRope(this.parachute, shared, bottom, top);
    }
    this.root.add(this.parachute);
    this.syncRoot();
  }

  swayOffset() {
    return Math.sin(this.age * LOOT.swayFrequency * Math.PI * 2) * LOOT.swayAmplitude;
  }

  syncRoot() {
    const sway = this.state === 'falling' ? this.swayOffset() : 0;
    this.root.position.set(this.x + this.swayX * sway, this.y, this.z + this.swayZ * sway);
    this.root.rotation.z = sway * 0.08;
    this.root.updateMatrixWorld(true);
  }

  update(delta, world) {
    if (!this.alive) return;
    this.age += delta;

    if (this.state === 'falling') {
      this.x += this.driftX * delta;
      this.z += this.driftZ * delta;
      this.y -= LOOT.fallSpeed * delta;
      const sway = this.swayOffset();
      const sx = this.x + this.swayX * sway;
      const sz = this.z + this.swayZ * sway;
      const groundY = world.getHeightAt(sx, sz) + this.shared.half;
      if (this.y <= groundY) {
        this.x = sx;
        this.z = sz;
        this.y = groundY;
        this.state = 'landed';
        this.age = 0;
      }
    } else {
      this.groundTime += delta;
      if (this.parachute.visible) {
        this.collapse = Math.min(1, this.collapse + delta / LOOT.collapseTime);
        this.parachute.scale.y = Math.max(1 - this.collapse, 0.001);
        if (this.collapse >= 1) this.parachute.visible = false;
      }
      if (this.groundTime >= LOOT.groundLifetime) this.alive = false;
    }

    this.syncRoot();
  }

  /** Removes the crate. Returns the grant, or null if it was already taken. */
  collect() {
    if (!this.alive) return null;
    this.alive = false;
    this.root.visible = false;
    return { points: LOOT.points, magazines: LOOT.spareMagazines };
  }

  remove() {
    this.root.removeFromParent();
  }
}

/**
 * Timed supply drops. The hit list is the crate meshes only, so a shot that
 * hits a crate stops there and a shot through the canopy does not.
 */
export class LootManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.shared = createLibrary();
    this.crates = [];
    this.elapsed = 0;
    this.spawned = 0;
    this.running = false;
    this.nextSpawn = LOOT.firstDelay;
  }

  /** Clears any crates and starts a fresh drop session for this round. */
  start() {
    this.clear();
    this.running = true;
    this.elapsed = 0;
    this.spawned = 0;
    this.nextSpawn = LOOT.firstDelay;
  }

  /** Stops the timer and removes crates. Used when leaving play. */
  stop() {
    this.running = false;
    this.clear();
  }

  clear() {
    for (const crate of this.crates) crate.remove();
    this.crates.length = 0;
  }

  /** Crate meshes currently in the air or sitting on the ground. */
  hitMeshes() {
    const meshes = [];
    for (const crate of this.crates) {
      if (!crate.alive) continue;
      crate.root.updateMatrixWorld(true);
      meshes.push(crate.mesh);
    }
    return meshes;
  }

  update(delta) {
    if (this.running) {
      this.elapsed += delta;
      while (this.spawned < LOOT.perSession && this.elapsed >= this.nextSpawn) {
        this.spawn();
        this.spawned += 1;
        this.nextSpawn += LOOT.interval;
      }
    }

    for (const crate of this.crates) crate.update(delta, this.world);
    for (let i = this.crates.length - 1; i >= 0; i--) {
      if (this.crates[i].alive) continue;
      this.crates[i].remove();
      this.crates.splice(i, 1);
    }
  }

  spawn() {
    const crate = new LootCrate(this.shared, this.world);
    this.scene.add(crate.root);
    this.crates.push(crate);
  }
}
