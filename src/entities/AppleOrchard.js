import * as THREE from 'three';
import { STANDS, TUTORIAL_ORCHARD, tutorialOrchardSpots } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);

function createTreeMeshes() {
  const { trunkColor, leafColor, trunkHeight, trunkRadius, canopyRadius, canopyLift } = TUTORIAL_ORCHARD;
  const root = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.92 });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.88 });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkRadius * 0.7, trunkRadius, trunkHeight, 10),
    trunkMat,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.userData.surface = 'tree';

  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(canopyRadius, 1), leafMat);
  canopy.position.y = canopyLift;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  // Visual only — apples hang on the stand-facing side and must stay shootable.
  canopy.raycast = () => {};

  const clusterGeo = new THREE.IcosahedronGeometry(canopyRadius * 0.55, 1);
  for (const [ox, oy, oz] of [
    [0.9, 0.2, 0.4],
    [-0.8, 0.35, -0.5],
    [0.2, 0.55, -0.95],
    [-0.35, -0.15, 0.9],
  ]) {
    const cluster = new THREE.Mesh(clusterGeo, leafMat);
    cluster.position.set(ox, canopyLift + oy, oz);
    cluster.castShadow = true;
    cluster.raycast = () => {};
    root.add(cluster);
  }

  root.add(trunk, canopy);
  return {
    root,
    solids: [trunk],
    canopyCenter: new THREE.Vector3(0, canopyLift, 0),
    canopyRadius,
  };
}

function createAppleMesh(shared) {
  const apple = new THREE.Mesh(shared.appleGeo, shared.appleMat);
  apple.castShadow = true;
  const stem = new THREE.Mesh(shared.stemGeo, shared.stemMat);
  stem.position.y = TUTORIAL_ORCHARD.appleRadius * 0.85;
  stem.raycast = () => {};
  const leaf = new THREE.Mesh(shared.leafGeo, shared.leafMat);
  leaf.position.set(0.06, TUTORIAL_ORCHARD.appleRadius * 0.95, 0);
  leaf.rotation.z = -0.6;
  leaf.raycast = () => {};
  apple.add(stem, leaf);
  return apple;
}

class Apple {
  constructor(mesh) {
    this.mesh = mesh;
    this.alive = true;
    mesh.userData.apple = this;
  }

  /** Removes the apple from play. Returns false if it was already collected. */
  collect() {
    if (!this.alive) return false;
    this.alive = false;
    this.mesh.visible = false;
    this.mesh.raycast = () => {};
    return true;
  }

  dispose() {
    this.alive = false;
    this.mesh.removeFromParent();
  }
}

/**
 * Tutorial orchard: three apple trees between the stands. Each tree faces one
 * tower with its apples on that side so the player must switch stands to clear
 * the whole objective.
 */
export class AppleOrchard {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'apple-orchard';
    this.group.visible = false;
    this.scene.add(this.group);
    this.apples = [];
    this.solids = [];
    this.active = false;
    this.shared = null;
  }

  ensureShared() {
    if (this.shared) return this.shared;
    const r = TUTORIAL_ORCHARD.appleRadius;
    this.shared = {
      appleGeo: new THREE.SphereGeometry(r, 12, 10),
      appleMat: new THREE.MeshStandardMaterial({
        color: TUTORIAL_ORCHARD.appleColor,
        roughness: 0.55,
        metalness: 0.05,
      }),
      stemGeo: new THREE.CylinderGeometry(0.015, 0.02, r * 0.45, 5),
      stemMat: new THREE.MeshStandardMaterial({ color: 0x4a3218, roughness: 1 }),
      leafGeo: new THREE.SphereGeometry(r * 0.28, 6, 4),
      leafMat: new THREE.MeshStandardMaterial({ color: 0x3f8a2a, roughness: 0.9 }),
    };
    return this.shared;
  }

  /** Builds the three trees and their apples. Safe to call again after clear(). */
  spawn() {
    this.clear();
    this.ensureShared();
    const spots = tutorialOrchardSpots();

    TUTORIAL_ORCHARD.trees.forEach((entry, index) => {
      const stand = STANDS.find((s) => s.label === entry.stand);
      const spot = spots[index];
      if (!stand || !spot) return;
      const groundY = this.world.getHeightAt(spot.x, spot.z);
      const tree = createTreeMeshes();
      tree.root.position.set(spot.x, groundY, spot.z);
      // Local +Z faces the stand so apples hang on the near side.
      const face = new THREE.Vector3(stand.position[0] - spot.x, 0, stand.position[1] - spot.z).normalize();
      tree.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);

      const apples = this.placeApples(tree, entry.apples);
      this.apples.push(...apples);
      this.solids.push(...tree.solids);
      this.group.add(tree.root);
    });

    this.group.visible = true;
    this.active = true;
  }

  placeApples(tree, count) {
    const shared = this.ensureShared();
    const localFace = new THREE.Vector3(0, 0, 1);
    const localSide = new THREE.Vector3(1, 0, 0);
    const apples = [];
    const { canopyCenter, canopyRadius, root } = tree;
    // Sit just outside the canopy blob so the visual leaves never eat the shot.
    const ring = canopyRadius * 1.05;

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const lateral = (t - 0.5) * canopyRadius * 1.25;
      const lift = Math.sin(i * 1.9) * 0.4 + (i % 2 === 0 ? 0.2 : -0.12);
      const depth = (i % 3) * 0.08;
      const local = canopyCenter
        .clone()
        .addScaledVector(localFace, ring - depth)
        .addScaledVector(localSide, lateral)
        .addScaledVector(UP, lift);

      const mesh = createAppleMesh(shared);
      mesh.position.copy(local);
      root.add(mesh);
      apples.push(new Apple(mesh));
    }

    return apples;
  }

  hitMeshes() {
    if (!this.active) return [];
    return this.apples.filter((apple) => apple.alive).map((apple) => apple.mesh);
  }

  remaining() {
    return this.apples.reduce((n, apple) => n + (apple.alive ? 1 : 0), 0);
  }

  clear() {
    for (const apple of this.apples) apple.dispose();
    this.apples = [];
    this.solids = [];
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
    this.group.visible = false;
    this.active = false;
  }
}
