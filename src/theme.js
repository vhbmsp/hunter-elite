import * as THREE from 'three';
import { LIGHTS, TERRAIN, WORLD } from './config.js';

/**
 * Visual packs for the shared hunting ground.
 * Winter cools the sky/fog/lights and snows the ground/foliage tint.
 */
export const THEMES = {
  default: {
    id: 'default',
    skyColor: WORLD.skyColor,
    fogNear: WORLD.fogNear,
    fogFar: WORLD.fogFar,
    hemisphere: { ...LIGHTS.hemisphere },
    sun: {
      color: LIGHTS.sun.color,
      intensity: LIGHTS.sun.intensity,
    },
    terrainColors: { ...TERRAIN.colors },
    grassTint: 0xffffff,
    foliageTint: 0xffffff,
  },
  winter: {
    id: 'winter',
    skyColor: 0xb7c8d8,
    fogNear: 40,
    fogFar: 320,
    hemisphere: { sky: 0xdde8f2, ground: 0xc9d4de, intensity: 0.62 },
    sun: {
      color: 0xe8f0ff,
      intensity: 1.25,
    },
    terrainColors: {
      grass: 0xe8eef4,
      lushGrass: 0xd5e0ea,
      dryGrass: 0xf2f6fa,
      dirt: 0x8a9098,
      rock: 0x6e737a,
    },
    // Multiply vertex greens toward pale snow / frosted brush.
    grassTint: 0xdde6f0,
    foliageTint: 0xc5d2c0,
  },
};

export function themeForMission(mission) {
  return THEMES[mission?.theme] ?? THEMES.default;
}

/** Free play rolls summer (default) or winter each start — mission packs keep fixed themes. */
export const FREE_PLAY_THEMES = ['default', 'winter'];

export function pickFreePlayTheme(random = Math.random) {
  const index = random() < 0.5 ? 0 : 1;
  return FREE_PLAY_THEMES[index];
}

export function themeLabel(themeId) {
  return themeId === 'winter' ? 'Winter' : 'Summer';
}

/**
 * Applies sky, fog, and light colors. Expects the lights created by createScene().
 */
export function applySceneTheme(scene, lights, theme) {
  const next = THEMES[theme?.id] ?? theme ?? THEMES.default;
  scene.background.setHex(next.skyColor);
  if (scene.fog) {
    scene.fog.color.setHex(next.skyColor);
    scene.fog.near = next.fogNear;
    scene.fog.far = next.fogFar;
  }
  if (lights?.hemisphere) {
    lights.hemisphere.color.setHex(next.hemisphere.sky);
    lights.hemisphere.groundColor.setHex(next.hemisphere.ground);
    lights.hemisphere.intensity = next.hemisphere.intensity;
  }
  if (lights?.sun) {
    lights.sun.color.setHex(next.sun.color);
    lights.sun.intensity = next.sun.intensity;
  }
}

/** Tint every Mesh / InstancedMesh material under a group (stores originals once). */
export function tintGroup(group, hex, cache) {
  if (!group) return;
  const tint = new THREE.Color(hex);
  group.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat, index) => {
      if (!mat?.color) return;
      const key = `${child.uuid}:${index}`;
      if (!cache.has(key)) cache.set(key, mat.color.clone());
      mat.color.copy(cache.get(key)).multiply(tint);
    });
  });
}
