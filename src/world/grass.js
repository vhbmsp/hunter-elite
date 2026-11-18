import * as THREE from 'three';
import { GRASS, RENDERER, STANDS } from '../config.js';
import { CANOPY_VERTEX_FROM_IP, injectCanopyShadeFragment } from './canopyShade.js';
import {
  OUTDOOR_VERTEX_COMMON_DECL,
  OUTDOOR_VERTEX_FROM_TRANSFORMED,
  applyOutdoorLitMaterialFlags,
  injectOutdoorHazeTail,
  injectOutdoorLitFragment,
} from './outdoorLit.js';

/**
 * One tuft of crossed tapered blades (one triangle each), 1 m tall in model
 * space; instances scale it to their height. Vertex colour runs base → tip.
 */
function createTuftGeometry() {
  const { bladesPerTuft, tuftRadius, bladeWidth, colorBase, colorTip } = GRASS;
  const positions = [];
  const colors = [];
  const base = new THREE.Color(colorBase);
  const tip = new THREE.Color(colorTip);

  for (let b = 0; b < bladesPerTuft; b++) {
    const angle = (b / bladesPerTuft) * Math.PI * 2 + Math.random() * 0.6;
    const r = Math.random() * tuftRadius;
    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    const facing = Math.random() * Math.PI;
    const wx = (Math.cos(facing) * bladeWidth) / 2;
    const wz = (Math.sin(facing) * bladeWidth) / 2;
    const lean = 0.15 + Math.random() * 0.25;
    const h = 0.7 + Math.random() * 0.3;

    positions.push(cx - wx, 0, cz - wz, cx + wx, 0, cz + wz, cx + Math.cos(angle) * lean, h, cz + Math.sin(angle) * lean);
    colors.push(...base.toArray(), ...base.toArray(), ...tip.toArray());
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function densityBands() {
  return GRASS.enhanced ? (GRASS.densityBandsEnhanced ?? GRASS.densityBands) : GRASS.densityBands;
}

/**
 * Phase 3: thin double-sided blades miss PCF when shadow coords use tip depth.
 * Sample the sun map at the tuft root (instance origin) so trunks/hills ground
 * the whole blade the same way the terrain is grounded.
 */
const GRASS_ROOT_SHADOW_VERTEX = `#ifdef USE_SHADOWMAP
	// Slightly above the sunk root so depth compares with the ground shadow map.
	vec4 grassShadowWorld = modelMatrix * instanceMatrix * vec4( 0.0, 0.2, 0.0, 1.0 );
	#if NUM_DIR_LIGHT_SHADOWS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * grassShadowWorld;
	}
	#pragma unroll_loop_end
	#endif
#endif`;

/**
 * Lambert already multiplies directDiffuse by PCF; ambient/hemi stay lit and wash
 * out contact shadows on thin blades. Re-scale the whole shade by the root PCF
 * factor so trunks/hills visibly ground the meadow (Phase 3).
 */
const GRASS_SHADOW_INDIRECT_FRAGMENT = `
#if NUM_DIR_LIGHT_SHADOWS > 0
{
	DirectionalLightShadow dls = directionalLightShadows[ 0 ];
	float grassShadow = getShadow( directionalShadowMap[ 0 ], dls.shadowMapSize, dls.shadowIntensity, dls.shadowBias, dls.shadowRadius, vDirectionalShadowCoord[ 0 ] );
	outgoingLight *= mix( uShadowIndirect, 1.0, grassShadow );
}
#endif`;

/** Lambert grass: wind sway, tip/noise tint, canopy shade, outdoor bounce/haze. */
function createGrassMaterial(uniforms, canopyUniforms, outdoorUniforms) {
  const enhanced = GRASS.enhanced;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  applyOutdoorLitMaterialFlags(material);
  material.customProgramCacheKey = () =>
    `grass-p1-${enhanced ? 'on' : 'off'}-canopy-shadow-outdoor-lit`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (canopyUniforms) injectCanopyShadeFragment(shader, canopyUniforms);

    const canopyAssign = canopyUniforms ? `\n        ${CANOPY_VERTEX_FROM_IP}` : '';
    const outdoorAssign = outdoorUniforms ? `\n        ${OUTDOOR_VERTEX_FROM_TRANSFORMED}` : '';

    const outdoorVertexDecls = outdoorUniforms ? `\n${OUTDOOR_VERTEX_COMMON_DECL}` : '';
    const windUniforms = (enhanced
      ? 'uniform float uTime;\nuniform float uWind;\nuniform float uWind2;\nuniform vec3 uEye;\nuniform float uViewNear;\nuniform float uViewFar;\nuniform float uViewMinScale;\nuniform float uTipBoost;\nuniform float uTipBaseMul;\nuniform vec3 uNoiseTint;\nuniform float uNoiseTintStrength;\nuniform float uShadowIndirect;'
      : 'uniform float uTime;\nuniform float uWind;\nuniform float uShadowIndirect;') + outdoorVertexDecls;

    // Tip/noise run in begin_vertex (after color_vertex) so instance XZ (`ip`) is in scope.
    // Canopy shade samples the same ground XZ (`ip`) — multiply happens in the fragment after tint.
    // Outdoor world pos/normal assigned after sway so haze tracks the blade tip softly.
    const windBody = enhanced
      ? `#include <begin_vertex>
        // Sway grows with height^2 so roots stay planted; phase varies per instance.
        float sway = position.y * position.y;
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float w = sin(uTime * 1.7 + ip.x * 0.21 + ip.y * 0.13)
          + 0.45 * sin(uTime * 3.3 + ip.x * 0.7)
          + uWind2 * sin(uTime * 6.1 + ip.x * 1.9 + ip.y * 1.4);
        transformed.x += w * uWind * sway;
        transformed.z += w * 0.6 * uWind * sway;
        // Soft camera falloff: near eye stays full, far tufts shrink (Homing-style LOD).
        float eyeDist = length(ip - uEye.xz);
        float viewScale = mix(uViewMinScale, 1.0, smoothstep(uViewFar, uViewNear, eyeDist));
        transformed.xyz *= viewScale;
        float tipH = clamp(position.y, 0.0, 1.0);
        vColor.rgb *= mix(uTipBaseMul, uTipBoost, tipH);
        float turfN = 0.5 + 0.5 * sin(ip.x * 0.09) * cos(ip.y * 0.11);
        vColor.rgb = mix(vColor.rgb, uNoiseTint, turfN * uNoiseTintStrength * (1.0 - tipH * 0.55));${canopyAssign}${outdoorAssign}`
      : `#include <begin_vertex>
        // Sway grows with height^2 so roots stay planted; phase varies per instance position.
        float sway = position.y * position.y;
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float w = sin(uTime * 1.7 + ip.x * 0.21 + ip.y * 0.13) + 0.45 * sin(uTime * 3.3 + ip.x * 0.7);
        transformed.x += w * uWind * sway;
        transformed.z += w * 0.6 * uWind * sway;${canopyAssign}${outdoorAssign}`;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${windUniforms}`)
      .replace('#include <begin_vertex>', windBody)
      .replace('#include <shadowmap_vertex>', GRASS_ROOT_SHADOW_VERTEX);

    // Outdoor fragment only — vertex decls/assign already in windUniforms / windBody.
    if (outdoorUniforms) injectOutdoorLitFragment(shader, outdoorUniforms, { vertex: false });

    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform float uShadowIndirect;
void main() {`,
    );

    if (outdoorUniforms && shader.fragmentShader.includes(OUTDOOR_COMPOSE_ANCHOR)) {
      shader.fragmentShader = shader.fragmentShader.replace(
        OUTDOOR_COMPOSE_ANCHOR,
        `${OUTDOOR_COMPOSE_ANCHOR}${GRASS_SHADOW_INDIRECT_FRAGMENT}`,
      );
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;${GRASS_SHADOW_INDIRECT_FRAGMENT}`,
      );
    }

    if (outdoorUniforms) injectOutdoorHazeTail(shader);
  };
  return material;
}

/** End of outdoor bounce `#if` block — splice grass root-PCF remap immediately after. */
const OUTDOOR_COMPOSE_ANCHOR = `outgoingLight += diffuseColor.rgb * uBounceColor * uBounceStrength * down * sunH;
}
#endif`;

const randomRange = ([min, max]) => min + Math.random() * (max - min);

/** Distance LOD relative to the nearest hunting stand (not only Tower S). */
function nearestStandDist(x, z) {
  let best = Infinity;
  for (const stand of STANDS) {
    const [sx, sz] = stand.position;
    const d = Math.hypot(x - sx, z - sz);
    if (d < best) best = d;
  }
  return best;
}

function densityAt(distance) {
  if (distance < GRASS.clearRadius) return 0;
  const bands = densityBands();
  for (const [radius, density] of bands) {
    if (distance < radius) return density;
  }
  return 0;
}

function onStandPad(x, z) {
  return STANDS.some((stand) => {
    const [sx, sz] = stand.position;
    return Math.hypot(x - sx, z - sz) < GRASS.clearRadius;
  });
}

/**
 * Chunked instanced grass. Each chunk is its own InstancedMesh with a tight
 * bounding sphere, so chunks outside the (scoped) view are frustum-culled.
 * Density drops with distance from the nearest stand (distance LOD).
 * When `GRASS.enhanced`, near bands are denser and the shader applies
 * view-weighted scale, tip colour, second wind octave, and noise tint.
 */
export class Grass {
  constructor(heightfield, noise, canopyUniforms = null, outdoorUniforms = null) {
    const bands = densityBands();
    const sampleCeil = bands[0][1];
    this.uniforms = {
      uTime: { value: 0 },
      uWind: { value: GRASS.wind.strength },
      uWind2: { value: GRASS.wind.octave2 ?? 0 },
      uEye: { value: new THREE.Vector3() },
      uViewNear: { value: GRASS.viewNear ?? 28 },
      uViewFar: { value: GRASS.viewFar ?? 95 },
      uViewMinScale: { value: GRASS.viewMinScale ?? 0.35 },
      uTipBoost: { value: GRASS.tipBoost ?? 1.35 },
      uTipBaseMul: { value: GRASS.tipBaseMul ?? 0.92 },
      uNoiseTint: { value: new THREE.Color(GRASS.noiseTint ?? 0x3b6b1f) },
      uNoiseTintStrength: { value: GRASS.noiseTintStrength ?? 0.22 },
      // Phase 3: ambient/hemi scale under PCF (1 = wash out, 0 = black in shadow).
      uShadowIndirect: { value: GRASS.shadowIndirect ?? 0.38 },
    };
    this.group = new THREE.Group();
    this.group.name = 'grass';
    this.instanceCount = 0;

    const geometry = createTuftGeometry();
    const material = createGrassMaterial(this.uniforms, canopyUniforms, outdoorUniforms);
    this.material = material;
    const outer = bands.at(-1)[0];
    const { chunkSize } = GRASS;
    const dummy = new THREE.Object3D();

    // Cover a bbox around every stand so A and D get the same meadow as S.
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const stand of STANDS) {
      const [sx, sz] = stand.position;
      minX = Math.min(minX, sx - outer);
      maxX = Math.max(maxX, sx + outer);
      minZ = Math.min(minZ, sz - outer);
      maxZ = Math.max(maxZ, sz + outer);
    }

    for (let cz = minZ; cz < maxZ; cz += chunkSize) {
      for (let cx = minX; cx < maxX; cx += chunkSize) {
        const centerDist = nearestStandDist(cx + chunkSize / 2, cz + chunkSize / 2);
        const density = densityAt(centerDist);
        if (density === 0 && centerDist > GRASS.clearRadius + chunkSize) continue;

        const matrices = [];
        const attempts = Math.ceil(chunkSize * chunkSize * sampleCeil);
        for (let a = 0; a < attempts; a++) {
          const x = cx + Math.random() * chunkSize;
          const z = cz + Math.random() * chunkSize;
          const d = nearestStandDist(x, z);
          if (onStandPad(x, z)) continue;
          if (Math.random() * sampleCeil > densityAt(d)) continue;
          if (heightfield.getSlopeAt(x, z) > GRASS.maxSlope) continue;

          const tall = noise.noise(x / GRASS.patchScale + 11, z / GRASS.patchScale - 7) > GRASS.patchThreshold;
          const h = randomRange(tall ? GRASS.tallHeight : GRASS.shortHeight);
          dummy.position.set(x, heightfield.getHeightAt(x, z) - 0.03, z);
          dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
          dummy.scale.set(h * (0.8 + Math.random() * 0.5), h, h * (0.8 + Math.random() * 0.5));
          dummy.updateMatrix();
          matrices.push(dummy.matrix.clone());
        }
        if (matrices.length === 0) continue;

        const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.computeBoundingSphere();
        // Phase 3: receive sun PCF shadows; do not cast (thousands of tufts).
        mesh.receiveShadow = RENDERER.shadows;
        mesh.castShadow = false;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
        this.instanceCount += matrices.length;
      }
    }
  }

  /** Multiply vertex colours (winter frost tint). */
  setTint(hex) {
    if (!this.material?.color) return;
    this.material.color.setHex(hex);
  }

  /**
   * @param {number} delta
   * @param {THREE.Vector3} [eye] Active stand eye — drives view-weighted scale when enhanced.
   */
  update(delta, eye) {
    this.uniforms.uTime.value += delta * GRASS.wind.speed;
    if (eye && this.uniforms.uEye) {
      this.uniforms.uEye.value.copy(eye);
    }
  }
}
