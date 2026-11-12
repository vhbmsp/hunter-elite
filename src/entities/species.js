import * as THREE from 'three';
import { ANIMAL_CLIPS } from '../config.js';
import { enableShadows } from '../core/assets.js';

// GLTFLoader strips reserved characters ('.', ':', '/', ...) from node names.
const bone = (name) => THREE.PropertyBinding.sanitizeNodeName(name);

// Default bones are the Quaternius Ultimate Animated Animals rig. A species
// may override names (the farm pig used for boar has Neck/Body, not Neck3/Back).
// rump/chest lie along the spine; the torso hangs below them.
// Torso3 (not Neck1) so the body zone stays level when the head drops to graze.
const DEFAULT_BONES = {
  head: 'Head',
  neck: 'Neck3',
  rump: 'Back',
  chest: 'Torso3',
};

export const RIG_BONES = Object.fromEntries(
  Object.entries(DEFAULT_BONES).map(([key, name]) => [key, bone(name)]),
);

function rigBones(type) {
  const named = { ...DEFAULT_BONES, ...type.bones };
  return Object.fromEntries(Object.entries(named).map(([key, name]) => [key, bone(name)]));
}

function indexClips(animations) {
  const clips = {};
  for (const clip of animations) clips[clip.name.split('|').pop()] = clip;
  return clips;
}

const NECK_BINS = 12;
// CylinderGeometry and SphereGeometry are faceted, so the triangles sit inside
// the true radius. This scale keeps the neck surface inside those triangles.
const NECK_FACET_PAD = 1.06;

/**
 * Neck thickness and where the mesh sits relative to the neck bone, in template space.
 * The segment just below the skull is the neck; when the chest bone is the neck
 * bone (the boar), the span is from that bone toward the head. Antlers and ears
 * land in a few thick wedges and are dropped. The radius is the thickest wedge
 * that remains, so the crest is inside the cylinder. Offset is the cross-section
 * centre in the neck bone's rotation, and only when that centre is clearly off
 * the bone. A small shift would uncover the far side, and worldToLocal would
 * shrink it on a scaled bone.
 */
function measureNeck(template, chestBone, neckBone, headBone) {
  const from = chestBone === neckBone ? neckBone : neckBone.parent;
  const to = chestBone === neckBone ? headBone : neckBone;
  if (!from || !to) return null;

  template.updateMatrixWorld(true);
  const origin = from.getWorldPosition(new THREE.Vector3());
  const end = to.getWorldPosition(new THREE.Vector3());
  const span = new THREE.Vector3().subVectors(end, origin);
  const length = span.length();
  if (length < 1e-4) return null;
  const dir = span.multiplyScalar(1 / length);

  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
  if (side.lengthSq() < 1e-8) side.crossVectors(dir, new THREE.Vector3(1, 0, 0));
  side.normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();

  const maxR = new Array(NECK_BINS).fill(0);
  const counts = new Array(NECK_BINS).fill(0);
  const rel = new THREE.Vector3();
  const t0 = chestBone === neckBone ? 0.08 : 0.15;
  const t1 = chestBone === neckBone ? 0.42 : 0.85;
  const samples = [];

  template.traverse((obj) => {
    if (!obj.isSkinnedMesh) return;
    const position = obj.geometry.attributes.position;
    obj.skeleton.update();
    for (let i = 0; i < position.count; i++) {
      rel.fromBufferAttribute(position, i);
      obj.applyBoneTransform(i, rel);
      obj.localToWorld(rel);
      rel.sub(origin);
      const along = rel.dot(dir);
      if (along < length * t0 || along > length * t1) continue;
      const radial = rel.addScaledVector(dir, -along);
      const radius = radial.length();
      if (radius < 1e-4 || radius > length * 4) continue;
      const angle = Math.atan2(radial.dot(up), radial.dot(side));
      const bin = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * NECK_BINS) % NECK_BINS;
      counts[bin] += 1;
      if (radius > maxR[bin]) maxR[bin] = radius;
      samples.push(radial.clone());
    }
  });

  const shells = maxR.filter((radius, i) => counts[i] > 0).sort((a, b) => a - b);
  if (shells.length < 3) return null;
  const kept = shells.filter((radius) => radius <= shells[0] * 1.65);
  const use = kept.length >= 3 ? kept : shells;
  // Thickest kept wedge. A circle of this radius contains the crest; antlers were dropped.
  const radius = use[use.length - 1];
  const gate = shells[0] * 1.65;
  const centroid = new THREE.Vector3();
  let used = 0;
  for (const radial of samples) {
    if (radial.length() > gate) continue;
    centroid.add(radial);
    used += 1;
  }
  if (used) centroid.multiplyScalar(1 / used);

  // A short bone can catch vertices on only one side. Shifting toward that
  // cluster would leave the bone, and the rest of the neck, outside the volume.
  let emptyRun = 0;
  let empty = 0;
  for (let i = 0; i < NECK_BINS * 2; i++) {
    if (counts[i % NECK_BINS] === 0) {
      empty += 1;
      emptyRun = Math.max(emptyRun, empty);
    } else {
      empty = 0;
    }
  }
  // A few centimetres of shift uncovers the far side of a neck that already
  // surrounds the bone. Only a clearly off-centre bone (the measured centre
  // well outside the core) is worth following.
  if (emptyRun > NECK_BINS / 3 || centroid.length() < radius * 0.35) centroid.set(0, 0, 0);

  const neckQuat = neckBone.getWorldQuaternion(new THREE.Quaternion());
  const offset = centroid.applyQuaternion(neckQuat.invert());
  return { radius, offset };
}

/** Clip names this species will actually play. Missing names fall back, and death is omitted when the file has no death clip. */
function resolveClipNames(type, clips) {
  const wanted = {
    idle: type.clips?.idle ?? ANIMAL_CLIPS.idle,
    walk: type.clips?.walk ?? ANIMAL_CLIPS.walk,
    run: type.clips?.run ?? ANIMAL_CLIPS.run,
    death: type.clips?.death ?? ANIMAL_CLIPS.death,
  };
  const idle = wanted.idle.filter((name) => clips[name]);
  const walk = clips[wanted.walk] ? wanted.walk : ANIMAL_CLIPS.walk;
  const run = clips[wanted.run] ? wanted.run : walk;
  return {
    idle: idle.length ? idle : [walk],
    walk,
    run: clips[run] ? run : walk,
    death: clips[wanted.death] ? wanted.death : null,
  };
}

/**
 * Derives per-species render data from a loaded glTF: uniform scale for the
 * configured real-world height, ground offset, named clips, and hitbox sizes
 * measured from the rest-pose bounds and bones.
 */
export function prepareSpecies(type, gltf) {
  const template = gltf.scene;
  enableShadows(template, true, false);
  template.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(template, true);
  const size = box.getSize(new THREE.Vector3());
  const scale = type.height / size.y;

  const bones = rigBones(type);
  for (const [key, name] of Object.entries(bones)) {
    if (!template.getObjectByName(name)) {
      throw new Error(`${type.name} model is missing the ${key} bone "${name}"`);
    }
  }

  const rump = template.getObjectByName(bones.rump).getWorldPosition(new THREE.Vector3());
  const chest = template.getObjectByName(bones.chest).getWorldPosition(new THREE.Vector3());
  // Tuned on the deer rig. bodyFit stretches the ellipsoid for rounder species.
  const fit = type.bodyFit ?? {};
  const spine = rump.distanceTo(chest) * scale;
  const halfLength = spine * 0.7 * (fit.length ?? 1);
  const halfHeight = spine * 0.7 * 0.45 * (fit.height ?? 1);
  const halfWidth = halfHeight * 0.8 * (fit.width ?? 1) / (fit.height ?? 1);
  const clips = indexClips(gltf.animations);
  const headRadius = size.x * scale * 0.3 * (type.headRadiusFactor ?? 1);
  const measuredNeck = measureNeck(
    template,
    template.getObjectByName(bones.chest),
    template.getObjectByName(bones.neck),
    template.getObjectByName(bones.head),
  );
  // Safety net if a rig has no usable neck mesh. Otherwise the measured
  // silhouette, padded so the faceted volume still contains it.
  let neckRadius = measuredNeck == null
    ? Math.min(halfWidth, halfHeight) * 0.75
    : measuredNeck.radius * scale * NECK_FACET_PAD;
  const neckCap = Math.max(halfWidth, halfHeight) * 1.35;
  if (neckRadius > neckCap) neckRadius = neckCap;
  const neckOffset = measuredNeck ? measuredNeck.offset.multiplyScalar(scale) : new THREE.Vector3();

  return {
    ...type,
    template,
    bones,
    clips,
    clipNames: resolveClipNames(type, clips),
    scale,
    groundOffset: -box.min.y * scale,
    hitbox: {
      body: {
        halfWidth,
        halfHeight,
        halfLength,
        dropBelowSpine: spine * 0.7 * 0.45 * 0.55 * (fit.drop ?? 1),
      },
      headRadius,
      neckRadius,
      neckOffset,
      snoutPush: type.snoutPush ?? 0.6,
    },
  };
}
