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
      headRadius: size.x * scale * 0.3 * (type.headRadiusFactor ?? 1),
      snoutPush: type.snoutPush ?? 0.6,
    },
  };
}
