import * as THREE from 'three';
import { enableShadows } from '../core/assets.js';
import { ENVIRONMENT } from '../config.js';

const randomRange = ([min, max]) => min + Math.random() * (max - min);

export function environmentModelUrls() {
  return Object.values(ENVIRONMENT).flatMap((kind) => kind.models);
}

/** Template plus its rest bounds, measured once per model. */
function prepareTemplates(assets, kind) {
  return kind.models.map((url) => {
    const template = assets.get(url).scene;
    enableShadows(template, kind.castShadow, true);
    const size = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
    return { template, size };
  });
}

function scatter(group, assets, kind) {
  const templates = prepareTemplates(assets, kind);
  for (let i = 0; i < kind.count; i++) {
    const { template, size } = templates[Math.floor(Math.random() * templates.length)];
    const scale = kind.length
      ? randomRange(kind.length) / Math.max(size.x, size.z)
      : randomRange(kind.height) / size.y;

    const angle = Math.random() * Math.PI * 2;
    const dist = kind.minDistance + Math.random() * kind.distanceRange;

    // Plain clone shares geometry and materials with the template.
    const object = template.clone();
    object.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    object.rotation.y = Math.random() * Math.PI * 2;
    object.scale.setScalar(scale);
    group.add(object);
  }
}

export function createEnvironment(assets) {
  const group = new THREE.Group();
  group.name = 'environment';
  for (const kind of Object.values(ENVIRONMENT)) scatter(group, assets, kind);

  // Static scenery: compute matrices once and skip per-frame updates.
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    child.matrixAutoUpdate = false;
  });
  return group;
}
