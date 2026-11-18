import * as THREE from 'three';
import { LIGHTS, OUTDOOR_LIT, TERRAIN, WORLD } from '../config.js';

/**
 * Shared outdoor lighting helper (Phase 4 — Homing `lit()` idea, WebGL).
 *
 * Terrain + grass stay MeshLambert (sun PCF / ambient / hemi still from Three).
 * This module adds the missing Homing terms in one place:
 *   - cheap ground bounce (down-facing fill)
 *   - optional sky fill boost
 *   - distance haze (replaces scene.fog on those materials so they age together)
 *   - optional light turf micro-variation (terrain)
 *
 * Uniform bag is owned by World and synced from live lights / fog / theme.
 */

const _sunDir = new THREE.Vector3();
const _target = new THREE.Vector3();
const _bounce = new THREE.Color();
const _sky = new THREE.Color();
const _haze = new THREE.Color();
const _turf = new THREE.Color();

export function createOutdoorLitUniforms() {
  const cfg = OUTDOOR_LIT;
  return {
    uOutdoorEnabled: { value: cfg.enabled ? 1 : 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uSunHeight: { value: 1 },
    uSkyColor: { value: new THREE.Color(LIGHTS.hemisphere.sky) },
    uSkyFill: { value: cfg.skyFill },
    uBounceColor: { value: new THREE.Color(LIGHTS.hemisphere.ground) },
    uBounceStrength: { value: cfg.bounceStrength },
    uHazeColor: { value: new THREE.Color(WORLD.skyColor) },
    uHazeNear: { value: WORLD.fogNear },
    uHazeFar: { value: WORLD.fogFar },
    uHazeStrength: { value: cfg.hazeStrength },
    uTurfTint: { value: new THREE.Color(TERRAIN.colors.lushGrass) },
    uTurfStrength: { value: cfg.turfStrength },
  };
}

/**
 * Pull sun direction, hemi/sky, bounce, and haze from the live scene.
 * Call after theme apply and whenever the sun frustum recentres.
 */
export function syncOutdoorLitUniforms(uniforms, { scene, lights, turfTint, turfStrength } = {}) {
  if (!uniforms) return;

  const cfg = OUTDOOR_LIT;
  uniforms.uOutdoorEnabled.value = cfg.enabled ? 1 : 0;
  uniforms.uSkyFill.value = cfg.skyFill;
  uniforms.uBounceStrength.value = cfg.bounceStrength;
  uniforms.uHazeStrength.value = cfg.hazeStrength;

  const sun = lights?.sun;
  if (sun) {
    _sunDir.copy(sun.position).sub(_target.copy(sun.target.position)).normalize();
    if (_sunDir.lengthSq() < 1e-6) _sunDir.set(0.4, 0.8, 0.3).normalize();
    uniforms.uSunDir.value.copy(_sunDir);
    // Homing scales sky/bounce by sun elevation — keep a soft clamp for twilight.
    uniforms.uSunHeight.value = THREE.MathUtils.clamp(_sunDir.y / 0.55, 0.35, 1.35);
  }

  const hemi = lights?.hemisphere;
  if (hemi) {
    uniforms.uSkyColor.value.copy(hemi.color);
    _bounce.copy(hemi.groundColor);
    // Slightly lift bounce so meadow floors read warmer than raw hemi ground.
    uniforms.uBounceColor.value.copy(_bounce);
  }

  if (scene?.fog) {
    uniforms.uHazeColor.value.copy(scene.fog.color);
    uniforms.uHazeNear.value = scene.fog.near;
    uniforms.uHazeFar.value = scene.fog.far;
  } else if (scene?.background?.isColor) {
    uniforms.uHazeColor.value.copy(scene.background);
  }

  if (turfTint != null) {
    uniforms.uTurfTint.value.setHex(turfTint);
  }
  if (turfStrength != null) {
    uniforms.uTurfStrength.value = turfStrength;
  } else {
    uniforms.uTurfStrength.value = cfg.turfStrength;
  }
}

/** Vertex: world position + world normal for bounce/haze. */
const OUTDOOR_VERTEX_COMMON = `
varying vec3 vOutdoorWorldPos;
varying vec3 vOutdoorNormal;`;

const OUTDOOR_VERTEX_ASSIGN = `
vOutdoorWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vOutdoorNormal = normalize(mat3(modelMatrix) * objectNormal);`;

/**
 * Instanced grass: instanceMatrix is applied in project_vertex, so bake it here
 * after wind so haze/bounce see the tuft’s real world pose.
 */
export const OUTDOOR_VERTEX_FROM_TRANSFORMED = `
vOutdoorWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vOutdoorNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);`;

const OUTDOOR_FRAGMENT_UNIFORMS = `
uniform float uOutdoorEnabled;
uniform vec3 uSunDir;
uniform float uSunHeight;
uniform vec3 uSkyColor;
uniform float uSkyFill;
uniform vec3 uBounceColor;
uniform float uBounceStrength;
uniform vec3 uHazeColor;
uniform float uHazeNear;
uniform float uHazeFar;
uniform float uHazeStrength;
uniform vec3 uTurfTint;
uniform float uTurfStrength;
varying vec3 vOutdoorWorldPos;
varying vec3 vOutdoorNormal;`;

/**
 * Homing-style bounce uses down-facing fill: (0.5 - n.y*0.5).
 * Sky fill boosts upward faces a little beyond stock hemi.
 * Applied after Lambert so PCF sun/ambient/hemi stay intact.
 */
export const OUTDOOR_LIT_COMPOSE = `
/* outdoor-compose */
#if defined(OUTDOOR_LIT)
if (uOutdoorEnabled > 0.5) {
  vec3 nW = normalize(vOutdoorNormal);
  #ifdef DOUBLE_SIDED
  nW *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  float up = nW.y * 0.5 + 0.5;
  float down = max(0.5 - nW.y * 0.5, 0.0);
  float sunH = uSunHeight;
  // Extra sky wrap + ground bounce — shared language for terrain and grass.
  outgoingLight += diffuseColor.rgb * uSkyColor * uSkyFill * up * sunH;
  outgoingLight += diffuseColor.rgb * uBounceColor * uBounceStrength * down * sunH;
}
#endif`;

export const OUTDOOR_HAZE = `
#if defined(OUTDOOR_LIT)
if (uOutdoorEnabled > 0.5) {
  float dist = length(vOutdoorWorldPos - cameraPosition);
  float hazeT = smoothstep(uHazeNear, uHazeFar, dist) * uHazeStrength;
  outgoingLight = mix(outgoingLight, uHazeColor, clamp(hazeT, 0.0, 1.0));
}
#endif`;

/** Cheap turf micro-variation (terrain). Multiplies after vertex colour / canopy. */
export const OUTDOOR_TURF_FRAGMENT = `
#if defined(OUTDOOR_LIT)
if (uOutdoorEnabled > 0.5 && uTurfStrength > 0.001) {
  vec2 xz = vOutdoorWorldPos.xz;
  float turfN = 0.5 + 0.5 * sin(xz.x * 0.07) * cos(xz.y * 0.09);
  float turfN2 = 0.5 + 0.5 * sin(xz.x * 0.19 + 1.7) * cos(xz.y * 0.15 - 0.4);
  float mixAmt = turfN * 0.65 + turfN2 * 0.35;
  diffuseColor.rgb = mix(diffuseColor.rgb, uTurfTint, mixAmt * uTurfStrength);
}
#endif`;

const OUTGOING_LIGHT_LINE =
  'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';

/** Bind uniforms + vertex/fragment decls + bounce compose. Call haze tail last. */
export function injectOutdoorLit(shader, uniforms, options = {}) {
  const { turf = false, vertexAssign = OUTDOOR_VERTEX_ASSIGN } = options;
  Object.assign(shader.uniforms, uniforms);

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${OUTDOOR_VERTEX_COMMON}`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
${vertexAssign}`,
    );

  let fragment = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
#define OUTDOOR_LIT
${OUTDOOR_FRAGMENT_UNIFORMS}`,
    );

  if (turf) {
    fragment = fragment.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
${OUTDOOR_TURF_FRAGMENT}`,
    );
  }

  if (fragment.includes(OUTGOING_LIGHT_LINE) && !fragment.includes('/* outdoor-compose */')) {
    fragment = fragment.replace(
      OUTGOING_LIGHT_LINE,
      `${OUTGOING_LIGHT_LINE}
${OUTDOOR_LIT_COMPOSE}`,
    );
  }

  shader.fragmentShader = fragment;
  injectOutdoorHazeTail(shader);
}

/**
 * Grass path: wind owns vertex `#include <common>` / begin_vertex.
 * Pass `vertex: false` and append OUTDOOR_VERTEX_COMMON + ASSIGN from the caller.
 */
export function injectOutdoorLitFragment(shader, uniforms, options = {}) {
  const { turf = false, vertex = true } = options;
  Object.assign(shader.uniforms, uniforms);

  if (vertex) {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
${OUTDOOR_VERTEX_COMMON}`,
    );
  }

  let fragment = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
#define OUTDOOR_LIT
${OUTDOOR_FRAGMENT_UNIFORMS}`,
  );

  if (turf) {
    fragment = fragment.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
${OUTDOOR_TURF_FRAGMENT}`,
    );
  }

  if (fragment.includes(OUTGOING_LIGHT_LINE) && !fragment.includes('/* outdoor-compose */')) {
    fragment = fragment.replace(
      OUTGOING_LIGHT_LINE,
      `${OUTGOING_LIGHT_LINE}
${OUTDOOR_LIT_COMPOSE}`,
    );
  }

  shader.fragmentShader = fragment;
}

/** Vertex varying decls for callers that own `#include <common>` (grass). */
export const OUTDOOR_VERTEX_COMMON_DECL = OUTDOOR_VERTEX_COMMON;

/**
 * Append haze after bounce/shadow remaps but BEFORE opaque_fragment writes
 * gl_FragColor — placing it at fog_fragment is too late (fog only tints FragColor).
 */
export function injectOutdoorHazeTail(shader) {
  if (shader.fragmentShader.includes('/* outdoor-haze */')) return;
  if (shader.fragmentShader.includes('#include <opaque_fragment>')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `/* outdoor-haze */
${OUTDOOR_HAZE}
#include <opaque_fragment>`,
    );
    return;
  }
  // Fallback: older/custom materials without opaque_fragment.
  if (shader.fragmentShader.includes('#include <fog_fragment>')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `/* outdoor-haze */
${OUTDOOR_HAZE}
#include <fog_fragment>`,
    );
  } else {
    shader.fragmentShader += `
/* outdoor-haze */
${OUTDOOR_HAZE}
`;
  }
}

/** Disable Three fog on a material that uses outdoor haze. */
export function applyOutdoorLitMaterialFlags(material) {
  if (!OUTDOOR_LIT.enabled) return material;
  material.fog = false;
  return material;
}
