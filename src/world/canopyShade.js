import * as THREE from 'three';
import { CANOPY_SHADE, TERRAIN } from '../config.js';

/** 1×1 black — no shade until bake replaces the map. */
function emptyMap() {
  const data = new Uint8Array([0, 0, 0, 255]);
  const texture = new THREE.DataTexture(data, 1, 1);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Uniform bag shared by terrain + grass. Stable object identity so materials
 * can bind once and World can swap the baked map after populate.
 */
export function createCanopyShadeUniforms() {
  return {
    uCanopyMap: { value: emptyMap() },
    uCanopyWorldSize: { value: TERRAIN.size },
    uCanopyStrength: { value: 0 },
  };
}

/**
 * Stamp soft discs from static tree spots into a low-res occupancy map.
 * UV: world XZ in [-half, +half] → [0, 1] via `xz / worldSize + 0.5`.
 */
export function bakeCanopyShade(treePositions, uniforms, options = {}) {
  const resolution = options.resolution ?? CANOPY_SHADE.resolution;
  const worldSize = options.worldSize ?? TERRAIN.size;
  const defaultRadius = options.discRadius ?? CANOPY_SHADE.discRadius;
  const softStart = options.softStart ?? CANOPY_SHADE.softStart;
  const strength = options.strength ?? CANOPY_SHADE.strength;
  const half = worldSize / 2;
  const texel = worldSize / resolution;

  // RGBA for broad WebGL1/software-GL compatibility; shaders read .r only.
  const data = new Uint8Array(resolution * resolution * 4);
  const occupancy = new Float32Array(resolution * resolution);

  for (const tree of treePositions) {
    const radius = tree.radius ?? defaultRadius;
    if (!(radius > 0)) continue;
    const minI = Math.max(0, Math.floor((tree.x - radius + half) / texel));
    const maxI = Math.min(resolution - 1, Math.ceil((tree.x + radius + half) / texel));
    const minJ = Math.max(0, Math.floor((tree.z - radius + half) / texel));
    const maxJ = Math.min(resolution - 1, Math.ceil((tree.z + radius + half) / texel));
    const inner = radius * softStart;

    for (let j = minJ; j <= maxJ; j++) {
      const wz = j * texel - half + texel * 0.5;
      for (let i = minI; i <= maxI; i++) {
        const wx = i * texel - half + texel * 0.5;
        const d = Math.hypot(wx - tree.x, wz - tree.z);
        if (d >= radius) continue;
        // Soft disc: full under the core, smooth falloff to the rim.
        const t = d <= inner ? 1 : 1 - (d - inner) / Math.max(1e-6, radius - inner);
        const soft = t * t * (3 - 2 * t);
        const idx = j * resolution + i;
        if (soft > occupancy[idx]) occupancy[idx] = soft;
      }
    }
  }

  for (let i = 0; i < occupancy.length; i++) {
    const v = Math.round(Math.min(1, occupancy[i]) * 255);
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }

  const prev = uniforms.uCanopyMap.value;
  const texture = new THREE.DataTexture(data, resolution, resolution);
  texture.needsUpdate = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;

  uniforms.uCanopyMap.value = texture;
  uniforms.uCanopyWorldSize.value = worldSize;
  uniforms.uCanopyStrength.value = strength;
  prev?.dispose?.();

  return { texture, resolution, worldSize, strength };
}

/**
 * Bind canopy uniforms + fragment darken after colour/tint.
 * Caller assigns `vCanopyXZ` in the vertex stage (see `canopyVertexAssign`).
 */
export function injectCanopyShadeFragment(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);

  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
varying vec2 vCanopyXZ;`,
  );

  // After color_fragment so winter material.color / vertexColors stay intact;
  // shade only multiplies the already-tinted diffuse.
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
uniform sampler2D uCanopyMap;
uniform float uCanopyWorldSize;
uniform float uCanopyStrength;
varying vec2 vCanopyXZ;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
{
  vec2 canopyUv = vCanopyXZ / uCanopyWorldSize + 0.5;
  float canopyOcc = texture2D(uCanopyMap, canopyUv).r;
  diffuseColor.rgb *= 1.0 - canopyOcc * uCanopyStrength;
}`,
    );
}

/** Default terrain path: world XZ from the mesh position. */
export function injectCanopyShade(shader, uniforms, { worldXZExpr }) {
  injectCanopyShadeFragment(shader, uniforms);
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
vCanopyXZ = ${worldXZExpr};`,
  );
}

/** GLSL line for grass (instance ground XZ already in `ip`). */
export const CANOPY_VERTEX_FROM_IP = 'vCanopyXZ = ip;';
