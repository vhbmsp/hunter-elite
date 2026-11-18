import * as THREE from 'three';
import { STANDS, TUTORIAL_ORCHARD, tutorialOrchardSpots } from '../config.js';
import { enableShadows } from '../core/assets.js';

const UP = new THREE.Vector3(0, 1, 0);

function isTrunkMaterial(material) {
  return /^(Tree|Wood)$/i.test(material?.name || '');
}

function isFoliageMaterial(material) {
  return /^(Leaves|Green)$/i.test(material?.name || '');
}

function materialsOf(mesh) {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/**
 * Clone a nature-pack deciduous tree (same glTF as the forest). Trunk meshes
 * stay solid cover; Leaves are visual-only so they never eat apple shots.
 */
function createNatureTree(assets) {
  const { model, height } = TUTORIAL_ORCHARD;
  const template = assets.get(model).scene;
  const root = template.clone(true);
  root.updateMatrixWorld(true);

  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const scale = height / Math.max(size.y, 0.01);
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const solids = [];
  root.traverse((child) => {
    if (!child.isMesh) return;
    // Clone materials so forest InstancedMesh templates stay untouched.
    child.material = Array.isArray(child.material)
      ? child.material.map((mat) => {
          const next = mat.clone();
          next.side = THREE.DoubleSide;
          return next;
        })
      : (() => {
          const next = child.material.clone();
          next.side = THREE.DoubleSide;
          return next;
        })();

    const mats = materialsOf(child);
    if (mats.some(isTrunkMaterial)) {
      child.userData.surface = 'tree';
      solids.push(child);
    }
    if (mats.some(isFoliageMaterial)) {
      // Visual canopy only — apples hang on the stand-facing shell and must stay shootable.
      child.raycast = () => {};
    }
  });
  enableShadows(root);

  // Canopy bounds in root-local space (after scale + sink).
  const foliageBox = new THREE.Box3();
  let hasFoliage = false;
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  root.traverse((child) => {
    if (!child.isMesh) return;
    if (!materialsOf(child).some(isFoliageMaterial)) return;
    child.geometry.computeBoundingBox();
    const box = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld);
    foliageBox.union(box);
    hasFoliage = true;
  });
  if (!hasFoliage) {
    foliageBox.setFromObject(root);
  }
  foliageBox.applyMatrix4(rootInv);

  const canopyCenter = foliageBox.getCenter(new THREE.Vector3());
  const canopySize = foliageBox.getSize(new THREE.Vector3());

  return { root, solids, canopyCenter, canopySize, canopyBox: foliageBox.clone() };
}

/** Half-extent of an AABB along a unit axis (local space). */
function aabbHalfAlong(size, axis) {
  return (
    0.5
    * (Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z)
  );
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
 * Tutorial orchard: one nature-pack tree at the valley centre. Apples hang in
 * clusters facing each tower so clearing the objective means switching stands.
 */
export class AppleOrchard {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.assets = null;
    this.group = new THREE.Group();
    this.group.name = 'apple-orchard';
    this.group.visible = false;
    this.scene.add(this.group);
    this.apples = [];
    this.solids = [];
    this.active = false;
    this.shared = null;
  }

  /** Keep a handle on the shared AssetLibrary (nature tree glTF is already loaded). */
  bindAssets(assets) {
    this.assets = assets;
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

  /** Builds the single tree and its apples. Safe to call again after clear(). */
  spawn() {
    this.clear();
    if (!this.assets) {
      throw new Error('AppleOrchard.bindAssets() must run before spawn()');
    }
    this.ensureShared();

    const [spot] = tutorialOrchardSpots();
    if (!spot) return;

    const groundY = this.world.getHeightAt(spot.x, spot.z);
    const tree = createNatureTree(this.assets);
    // Match forest sink so the trunk base sits in the ground.
    tree.root.position.set(spot.x, groundY - TUTORIAL_ORCHARD.sink, spot.z);
    // Mild yaw so the crown silhouette is not axis-aligned with the towers.
    tree.root.rotation.y = 0.55;
    tree.root.updateMatrixWorld(true);

    for (const entry of TUTORIAL_ORCHARD.faces) {
      const stand = STANDS.find((s) => s.label === entry.stand);
      if (!stand) continue;
      const apples = this.placeApplesFacing(tree, stand, entry.apples);
      this.apples.push(...apples);
    }

    this.solids.push(...tree.solids);
    this.group.add(tree.root);
    this.group.visible = true;
    this.active = true;
  }

  /**
   * Nest apples inside the foliage AABB on the stand-facing side. Leaves do not
   * raycast, so fruit stays shootable while reading as part of the crown.
   */
  placeApplesFacing(tree, stand, count) {
    const shared = this.ensureShared();
    const apples = [];
    const { canopyCenter, canopySize, canopyBox, root } = tree;
    const { appleFaceNest, appleSideSpread, appleLiftSpread, appleRadius } = TUTORIAL_ORCHARD;

    const treeWorld = new THREE.Vector3();
    root.getWorldPosition(treeWorld);
    const faceWorld = new THREE.Vector3(
      stand.position[0] - treeWorld.x,
      0,
      stand.position[1] - treeWorld.z,
    ).normalize();

    // Root-local facing (accounts for the mild crown yaw).
    const inv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const faceLocal = faceWorld.clone().applyQuaternion(inv);
    faceLocal.y = 0;
    if (faceLocal.lengthSq() < 1e-6) faceLocal.set(0, 0, 1);
    else faceLocal.normalize();
    const sideLocal = new THREE.Vector3().crossVectors(UP, faceLocal).normalize();

    const faceExtent = aabbHalfAlong(canopySize, faceLocal);
    const sideExtent = aabbHalfAlong(canopySize, sideLocal);
    const upExtent = aabbHalfAlong(canopySize, UP);
    // Inset clamp so fruit stays inside the leaf volume even when face/side axes are skewed.
    const clampMin = canopyBox.min.clone().addScalar(appleRadius * 0.5);
    const clampMax = canopyBox.max.clone().addScalar(-appleRadius * 0.5);

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      // Keep the arc inside the crown silhouette (not a floating ring outside it).
      const lateral = (t - 0.5) * 2 * sideExtent * appleSideSpread;
      const lift = (Math.sin(i * 1.9) * 0.55 + (i % 2 === 0 ? 0.2 : -0.15)) * upExtent * appleLiftSpread;
      const depthJitter = (i % 3) * 0.04 * faceExtent;
      const local = canopyCenter
        .clone()
        .addScaledVector(faceLocal, faceExtent * appleFaceNest - depthJitter)
        .addScaledVector(sideLocal, lateral)
        .addScaledVector(UP, lift);
      local.clamp(clampMin, clampMax);

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

  /** World x/z of remaining tutorial apples for the minimap. */
  goalPositions() {
    if (!this.active) return [];
    const out = [];
    const world = new THREE.Vector3();
    for (const apple of this.apples) {
      if (!apple.alive) continue;
      apple.mesh.getWorldPosition(world);
      out.push({ x: world.x, z: world.z });
    }
    return out;
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
