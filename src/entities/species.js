import * as THREE from 'three';
import { enableShadows } from '../core/assets.js';

// GLTFLoader strips reserved characters ('.', ':', '/', ...) from node names.
const bone = (name) => THREE.PropertyBinding.sanitizeNodeName(name);

// Bones shared by every Quaternius animal rig; hitboxes track them.
// rump/chest lie on the top line of the back; the torso hangs below them.
// Torso3 (not Neck1) so the body zone stays level when the head drops to graze.
export const RIG_BONES = {
  head: bone('Head'),
  neck: bone('Neck3'),
  rump: bone('Back'),
  chest: bone('Torso3'),
};

function indexClips(animations) {
  const clips = {};
  for (const clip of animations) clips[clip.name.split('|').pop()] = clip;
  return clips;
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

  const rump = template.getObjectByName(RIG_BONES.rump).getWorldPosition(new THREE.Vector3());
  const chest = template.getObjectByName(RIG_BONES.chest).getWorldPosition(new THREE.Vector3());
  const halfLength = rump.distanceTo(chest) * scale * 0.7;
  const halfHeight = halfLength * 0.45;

  return {
    ...type,
    template,
    clips: indexClips(gltf.animations),
    scale,
    groundOffset: -box.min.y * scale,
    hitbox: {
      body: { halfWidth: halfHeight * 0.8, halfHeight, halfLength, dropBelowSpine: halfHeight * 0.55 },
      headRadius: size.x * scale * 0.3,
    },
  };
}
