import * as THREE from 'three';
import { STANDS, TUTORIAL_ORCHARD, tutorialOrchardSpots } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Leaf greens: shade variation across the canopy instead of one flat color. */
const LEAF_PALETTE = [0x2f6a1f, 0x3f7a28, 0x4a8f32, 0x568f3a, 0x3a6e24, 0x457828];

let canopyLibrary = null;

/** Soft teardrop leaf outline used as double-sided cards on the canopy shell. */
function createLeafShapeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.55);
  shape.quadraticCurveTo(0.38, -0.15, 0.32, 0.28);
  shape.quadraticCurveTo(0.12, 0.52, 0, 0.62);
  shape.quadraticCurveTo(-0.12, 0.52, -0.32, 0.28);
  shape.quadraticCurveTo(-0.38, -0.15, 0, -0.55);
  const geo = new THREE.ShapeGeometry(shape, 10);
  geo.center();
  // Sit the leaf tip along +Y so instance orientation is predictable.
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** Nudge icosa vertices so canopy volumes look grown, not perfectly round. */
function organicize(geometry, amount = 0.12) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length() || 1;
    const bump =
      1
      + amount * Math.sin(v.x * 5.1 + v.y * 3.4)
      * Math.cos(v.z * 4.2 + v.y * 2.1)
      + amount * 0.35 * Math.sin(v.y * 7.5);
    v.multiplyScalar(bump);
    // Keep roughly the same average radius.
    v.setLength(len * (0.92 + 0.08 * bump));
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function fibonacciDirection(index, total) {
  const t = index / Math.max(1, total - 1);
  const y = 1 - 2 * t;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * 2.399963229728653; // golden angle
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
}

function ensureCanopyLibrary() {
  if (canopyLibrary) return canopyLibrary;

  const leafMats = LEAF_PALETTE.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide,
      }),
  );

  const volumeMats = LEAF_PALETTE.slice(0, 3).map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        metalness: 0,
      }),
  );

  const coreGeo = organicize(new THREE.IcosahedronGeometry(1, 2), 0.14);
  const puffGeo = organicize(new THREE.IcosahedronGeometry(1, 1), 0.18);
  const leafGeo = createLeafShapeGeometry();
  const branchGeo = new THREE.CylinderGeometry(0.04, 0.07, 1, 6);
  const branchMat = new THREE.MeshStandardMaterial({
    color: TUTORIAL_ORCHARD.trunkColor,
    roughness: 0.94,
  });

  canopyLibrary = { leafMats, volumeMats, coreGeo, puffGeo, leafGeo, branchGeo, branchMat };
  return canopyLibrary;
}

function createTreeMeshes() {
  const { trunkColor, trunkHeight, trunkRadius, canopyRadius, canopyLift } = TUTORIAL_ORCHARD;
  const lib = ensureCanopyLibrary();
  const root = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.94 });
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkRadius * 0.62, trunkRadius, trunkHeight, 12),
    trunkMat,
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.userData.surface = 'tree';
  root.add(trunk);

  // A few bark-colored limbs so the canopy reads as a tree, not a floating bush.
  const limbSpecs = [
    { y: trunkHeight * 0.62, yaw: 0.4, pitch: 0.85, len: 1.35 },
    { y: trunkHeight * 0.72, yaw: 2.2, pitch: 0.75, len: 1.15 },
    { y: trunkHeight * 0.78, yaw: 4.0, pitch: 0.7, len: 1.25 },
    { y: trunkHeight * 0.68, yaw: 5.1, pitch: 0.95, len: 0.95 },
  ];
  for (const limb of limbSpecs) {
    const branch = new THREE.Mesh(lib.branchGeo, lib.branchMat);
    branch.position.set(0, limb.y, 0);
    branch.rotation.order = 'YXZ';
    branch.rotation.y = limb.yaw;
    branch.rotation.x = limb.pitch;
    branch.scale.set(1, limb.len, 1);
    branch.translateY(limb.len * 0.5);
    branch.castShadow = true;
    branch.raycast = () => {};
    root.add(branch);
  }

  const canopy = new THREE.Group();
  canopy.position.y = canopyLift;
  canopy.raycast = () => {};

  // Soft inner volumes — higher-detail organic shells in mixed greens.
  const core = new THREE.Mesh(lib.coreGeo, lib.volumeMats[1]);
  core.scale.setScalar(canopyRadius * 0.92);
  core.castShadow = true;
  core.receiveShadow = true;
  core.raycast = () => {};
  canopy.add(core);

  const puffOffsets = [
    [0.85, 0.25, 0.35, 0.55],
    [-0.75, 0.4, -0.45, 0.5],
    [0.15, 0.65, -0.9, 0.48],
    [-0.25, -0.2, 0.95, 0.52],
    [0.55, -0.35, -0.55, 0.42],
    [-0.95, 0.1, 0.2, 0.46],
    [0.05, 0.9, 0.15, 0.4],
  ];
  puffOffsets.forEach(([x, y, z, scale], i) => {
    const puff = new THREE.Mesh(lib.puffGeo, lib.volumeMats[i % lib.volumeMats.length]);
    puff.position.set(x * canopyRadius, y * canopyRadius, z * canopyRadius);
    puff.scale.setScalar(canopyRadius * scale);
    puff.castShadow = true;
    puff.raycast = () => {};
    canopy.add(puff);
  });

  // Dense outer leaf cards on a fibonacci shell — the main detail upgrade.
  const leafCount = 220;
  const dummy = new THREE.Object3D();
  const look = new THREE.Vector3();
  const mats = lib.leafMats;
  const perMat = Math.ceil(leafCount / mats.length);
  const instances = mats.map(
    (mat) => new THREE.InstancedMesh(lib.leafGeo, mat, perMat),
  );
  const counters = mats.map(() => 0);
  instances.forEach((mesh) => {
    mesh.castShadow = true;
    mesh.raycast = () => {};
    canopy.add(mesh);
  });

  for (let i = 0; i < leafCount; i++) {
    const dir = fibonacciDirection(i, leafCount);
    // Bias slightly toward the upper hemisphere so the crown feels fuller.
    dir.y = dir.y * 0.78 + 0.22;
    dir.normalize();
    const radius = canopyRadius * (0.88 + (i % 7) * 0.025);
    dummy.position.copy(dir).multiplyScalar(radius);
    look.copy(dummy.position).add(dir);
    dummy.lookAt(look);
    dummy.rotateZ(((i * 47) % 360) * (Math.PI / 180));
    const leafScale = 0.42 + (i % 5) * 0.05;
    dummy.scale.set(leafScale * 0.85, leafScale, leafScale * 0.85);
    dummy.updateMatrix();

    const matIndex = i % mats.length;
    const mesh = instances[matIndex];
    mesh.setMatrixAt(counters[matIndex], dummy.matrix);
    counters[matIndex] += 1;
  }
  instances.forEach((mesh, index) => {
    mesh.count = counters[index];
    mesh.instanceMatrix.needsUpdate = true;
  });

  root.add(canopy);
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
    ensureCanopyLibrary();
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
    // Sit just outside the canopy shell so dense leaf cards never eat the shot.
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
