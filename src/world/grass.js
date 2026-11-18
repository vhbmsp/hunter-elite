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

/**
 * Homing-style unit blade: one triangle + corner id. Vertex shader expands
 * width / height / lean / facing from per-instance `aParams`.
 * Corners: 0 = left base, 1 = right base, 2 = tip.
 */
function createBladeGeometry() {
  const base = new THREE.Color(GRASS.colorBase);
  // Tip stays near turf green (avoid lime shards from elevated stands).
  const tip = new THREE.Color(GRASS.colorTip).lerp(new THREE.Color(0x6a8a32), 0.2);
  const geometry = new THREE.BufferGeometry();
  // Placeholder positions — replaced in begin_vertex from aCorner + aParams.
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute('aCorner', new THREE.Float32BufferAttribute([0, 1, 2], 1));
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute([...base.toArray(), ...base.toArray(), ...tip.toArray()], 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function densityBands() {
  return GRASS.enhanced ? (GRASS.densityBandsEnhanced ?? GRASS.densityBands) : GRASS.densityBands;
}

function nearBladeCfg() {
  return GRASS.nearBlades?.enabled ? GRASS.nearBlades : null;
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

/** End of outdoor bounce `#if` block — splice grass root-PCF remap immediately after. */
const OUTDOOR_COMPOSE_ANCHOR = `outgoingLight += diffuseColor.rgb * uBounceColor * uBounceStrength * down * sunH;
}
#endif`;

function spliceGrassShadow(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    'void main() {',
    `uniform float uShadowIndirect;
void main() {`,
  );

  if (shader.fragmentShader.includes(OUTDOOR_COMPOSE_ANCHOR)) {
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
}

/** Lambert tuft grass: wind sway, tip/noise tint, canopy shade, outdoor bounce/haze. */
function createGrassMaterial(uniforms, canopyUniforms, outdoorUniforms) {
  const enhanced = GRASS.enhanced;
  const blades = nearBladeCfg();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  applyOutdoorLitMaterialFlags(material);
  material.customProgramCacheKey = () =>
    `grass-tuft-${enhanced ? 'on' : 'off'}-canopy-shadow-outdoor-lit-nb${blades ? 1 : 0}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (canopyUniforms) injectCanopyShadeFragment(shader, canopyUniforms);

    const canopyAssign = canopyUniforms ? `\n        ${CANOPY_VERTEX_FROM_IP}` : '';
    const outdoorAssign = outdoorUniforms ? `\n        ${OUTDOOR_VERTEX_FROM_TRANSFORMED}` : '';

    const outdoorVertexDecls = outdoorUniforms ? `\n${OUTDOOR_VERTEX_COMMON_DECL}` : '';
    const thinUniforms = blades
      ? '\nuniform float uTuftThinRadius;\nuniform float uTuftThinFactor;'
      : '';
    const windUniforms = (enhanced
      ? 'uniform float uTime;\nuniform float uWind;\nuniform float uWind2;\nuniform vec3 uEye;\nuniform float uViewNear;\nuniform float uViewFar;\nuniform float uViewMinScale;\nuniform float uTipBoost;\nuniform float uTipBaseMul;\nuniform vec3 uNoiseTint;\nuniform float uNoiseTintStrength;\nuniform float uShadowIndirect;'
      : 'uniform float uTime;\nuniform float uWind;\nuniform float uShadowIndirect;') +
      thinUniforms +
      outdoorVertexDecls;

    // Tip/noise run in begin_vertex (after color_vertex) so instance XZ (`ip`) is in scope.
    // Hybrid: when near blades own the close field, shrink tufts inside uTuftThinRadius.
    const thinBody = blades
      ? `
        float thinDist = length(ip - uEye.xz);
        float thin = mix(uTuftThinFactor, 1.0, smoothstep(uTuftThinRadius * 0.55, uTuftThinRadius, thinDist));
        transformed.xyz *= thin;`
      : '';

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
        transformed.xyz *= viewScale;${thinBody}
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

    if (outdoorUniforms) injectOutdoorLitFragment(shader, outdoorUniforms, { vertex: false });
    spliceGrassShadow(shader);
    if (outdoorUniforms) injectOutdoorHazeTail(shader);
  };
  return material;
}

/**
 * Real single-blade material: expands one triangle from corner + aParams
 * (width, height, lean, facing), tip colour, multi-freq wind, distance fade.
 */
function createBladeMaterial(uniforms, canopyUniforms, outdoorUniforms) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  applyOutdoorLitMaterialFlags(material);
  material.customProgramCacheKey = () => 'grass-near-blade-v1-canopy-shadow-outdoor-lit';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (canopyUniforms) injectCanopyShadeFragment(shader, canopyUniforms);

    const canopyAssign = canopyUniforms ? `\n        ${CANOPY_VERTEX_FROM_IP}` : '';
    const outdoorAssign = outdoorUniforms ? `\n        ${OUTDOOR_VERTEX_FROM_TRANSFORMED}` : '';
    const outdoorVertexDecls = outdoorUniforms ? `\n${OUTDOOR_VERTEX_COMMON_DECL}` : '';

    const decls = `attribute float aCorner;
attribute vec4 aParams;
uniform float uTime;
uniform float uWind;
uniform float uWind2;
uniform vec3 uEye;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uTipBoost;
uniform float uTipBaseMul;
uniform vec3 uNoiseTint;
uniform float uNoiseTintStrength;
uniform float uShadowIndirect;${outdoorVertexDecls}`;

    const body = `#include <begin_vertex>
        // aParams: width, height, lean, facing. aCorner: 0 left / 1 right / 2 tip.
        float width = aParams.x;
        float height = aParams.y;
        float leanAmt = aParams.z;
        float facing = aParams.w;
        float tipT = step(1.5, aCorner);
        float side = aCorner < 0.5 ? -1.0 : (aCorner < 1.5 ? 1.0 : 0.0);
        // Soft lawn taper (not a needle tip) — reads less like jagged shards from stands.
        float taper = mix(1.0, 0.22, tipT);
        vec3 local = vec3(side * width * 0.5 * mix(1.0, taper, tipT), tipT * height, tipT * leanAmt);
        float cs = cos(facing);
        float sn = sin(facing);
        transformed = vec3(local.x * cs + local.z * sn, local.y, -local.x * sn + local.z * cs);
        // Face normal from blade plane (double-sided Lambert); defaultnormal_vertex applies instanceMatrix.
        objectNormal = normalize(vec3(sn, 0.15, cs));
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float sway = tipT * tipT;
        float w = sin(uTime * 1.7 + ip.x * 0.21 + ip.y * 0.13)
          + 0.45 * sin(uTime * 3.3 + ip.x * 0.7)
          + uWind2 * sin(uTime * 6.1 + ip.x * 1.9 + ip.y * 1.4);
        transformed.x += w * uWind * sway;
        transformed.z += w * 0.55 * uWind * sway;
        // Gradual camera presence — soft power so mid hills don't drop as a hard carpet rim.
        float eyeDist = length(ip - uEye.xz);
        float presence = 1.0 - smoothstep(uFadeStart, uFadeEnd, eyeDist);
        presence = pow(max(presence, 0.0), 0.55);
        // Elevated stands: lawn blades vanish as pixels past ~15 m unless height grows a little.
        // Keep near field short; lift mid-band silhouette without returning to jagged shards.
        float midLift = mix(1.0, 2.15, smoothstep(8.0, 28.0, eyeDist));
        transformed.y *= midLift;
        transformed.xyz *= presence;
        vColor.rgb *= mix(uTipBaseMul, uTipBoost, tipT);
        float turfN = 0.5 + 0.5 * sin(ip.x * 0.09) * cos(ip.y * 0.11);
        vColor.rgb = mix(vColor.rgb, uNoiseTint, turfN * uNoiseTintStrength * (1.0 - tipT * 0.5));${canopyAssign}${outdoorAssign}`;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${decls}`)
      .replace('#include <begin_vertex>', body)
      .replace('#include <shadowmap_vertex>', GRASS_ROOT_SHADOW_VERTEX);

    if (outdoorUniforms) injectOutdoorLitFragment(shader, outdoorUniforms, { vertex: false });
    spliceGrassShadow(shader);
    if (outdoorUniforms) injectOutdoorHazeTail(shader);
  };
  return material;
}

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

function onStandPad(x, z, radius = GRASS.clearRadius) {
  return STANDS.some((stand) => {
    const [sx, sz] = stand.position;
    return Math.hypot(x - sx, z - sz) < radius;
  });
}

/** Nearest stand distance — used for soft blade pad clearance. */
function nearestStandXZ(x, z) {
  let best = Infinity;
  for (const stand of STANDS) {
    const [sx, sz] = stand.position;
    const d = Math.hypot(x - sx, z - sz);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Chunked instanced grass + optional camera-centred single-blade patch.
 * Tufts: distance LOD from stands, frustum-culled chunks.
 * Near blades: Homing-style one-triangle instances refilled around the eye.
 */
export class Grass {
  constructor(heightfield, noise, canopyUniforms = null, outdoorUniforms = null) {
    const bands = densityBands();
    const sampleCeil = bands[0][1];
    const blades = nearBladeCfg();

    this.heightfield = heightfield;
    this.noise = noise;
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
      uTuftThinRadius: { value: blades?.tuftThinRadius ?? 0 },
      uTuftThinFactor: { value: blades?.tuftThinFactor ?? 1 },
    };
    this.bladeUniforms = {
      uTime: this.uniforms.uTime,
      uWind: { value: blades?.windStrength ?? GRASS.wind.strength },
      uWind2: { value: blades?.windOctave2 ?? GRASS.wind.octave2 ?? 0 },
      uEye: this.uniforms.uEye,
      uFadeStart: { value: blades?.fadeStart ?? 16 },
      uFadeEnd: { value: blades?.fadeEnd ?? 30 },
      uTipBoost: { value: blades?.tipBoost ?? 1.55 },
      uTipBaseMul: { value: blades?.tipBaseMul ?? 0.78 },
      uNoiseTint: this.uniforms.uNoiseTint,
      uNoiseTintStrength: this.uniforms.uNoiseTintStrength,
      uShadowIndirect: this.uniforms.uShadowIndirect,
    };

    this.group = new THREE.Group();
    this.group.name = 'grass';
    this.instanceCount = 0;
    this.tuftInstanceCount = 0;
    this.bladeInstanceCount = 0;
    this._bladeMesh = null;
    this._bladeParams = null;
    this._bladeDummy = new THREE.Object3D();
    this._lastPatch = new THREE.Vector2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    this._lookScratch = new THREE.Vector3();
    this._patchCentre = new THREE.Vector2();

    const geometry = createTuftGeometry();
    const material = createGrassMaterial(this.uniforms, canopyUniforms, outdoorUniforms);
    this.material = material;
    this.bladeMaterial = null;
    const outer = bands.at(-1)[0];
    const { chunkSize } = GRASS;
    const dummy = new THREE.Object3D();
    const thinRadius = blades?.tuftThinRadius ?? 0;
    const thinFactor = blades?.tuftThinFactor ?? 1;

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
          let accept = densityAt(d);
          // Hybrid: thin tuft spawn near stands so the blade patch can own close ground.
          if (blades && d < thinRadius) {
            accept *= THREE.MathUtils.lerp(thinFactor, 1, d / thinRadius);
          }
          if (Math.random() * sampleCeil > accept) continue;
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
        this.tuftInstanceCount += matrices.length;
      }
    }

    if (blades) {
      this._initNearBlades(canopyUniforms, outdoorUniforms, blades);
    }

    this.instanceCount = this.tuftInstanceCount + this.bladeInstanceCount;
  }

  _initNearBlades(canopyUniforms, outdoorUniforms, blades) {
    const count = blades.count;
    const geometry = createBladeGeometry();
    const params = new Float32Array(count * 4);
    geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
    this._bladeParams = params;

    const material = createBladeMaterial(this.bladeUniforms, canopyUniforms, outdoorUniforms);
    this.bladeMaterial = material;

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.count = 0;
    mesh.receiveShadow = RENDERER.shadows;
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    mesh.matrixAutoUpdate = false;
    mesh.name = 'grass-near-blades';
    this.group.add(mesh);
    this._bladeMesh = mesh;
    this.bladeInstanceCount = 0;
  }

  /**
   * Refill the camera-centred blade disc. Mid-band weighted spawn + gradual fade;
   * soft stand clearance (tiny footing only — no sharp bald circle).
   */
  _refillNearBlades(eye, lookDir) {
    const blades = nearBladeCfg();
    const mesh = this._bladeMesh;
    if (!blades || !mesh) return;

    const radius = blades.radius;
    const lookAhead = blades.lookAhead ?? 0;
    const eyeFrac = blades.eyeSampleFraction ?? 0.55;
    const midFrac = blades.midBandFraction ?? 0.62;
    const midInner = blades.midBandInner ?? 14;
    const midOuter = Math.min(radius, blades.midBandOuter ?? 42);
    const padHard = blades.padClearHard ?? 1.15;
    const padSoft = blades.padClearSoft ?? Math.max(padHard + 1, 2.8);
    // Eye-centred disc covers the tower base; ahead disc leads the view.
    const eyeCx = eye.x;
    const eyeCz = eye.z;
    let aheadCx = eyeCx;
    let aheadCz = eyeCz;
    if (lookDir && lookAhead > 0) {
      this._lookScratch.copy(lookDir);
      this._lookScratch.y = 0;
      if (this._lookScratch.lengthSq() > 1e-6) {
        this._lookScratch.normalize();
        aheadCx += this._lookScratch.x * lookAhead;
        aheadCz += this._lookScratch.z * lookAhead;
      }
    }
    // Track blended centre for refill-distance checks.
    this._patchCentre.set(
      eyeCx * eyeFrac + aheadCx * (1 - eyeFrac),
      eyeCz * eyeFrac + aheadCz * (1 - eyeFrac),
    );

    const params = this._bladeParams;
    const dummy = this._bladeDummy;
    const [w0, w1] = blades.width;
    const [h0, h1] = blades.height;
    const [l0, l1] = blades.lean;
    let written = 0;
    const budget = blades.count;
    // Oversample so pad/slope rejects still fill the budget.
    const attempts = budget * 4;
    const midInnerSq = midInner * midInner;
    const midOuterSq = midOuter * midOuter;

    for (let a = 0; a < attempts && written < budget; a++) {
      // Prefer eye-centred samples so stands don't go bald; rest lead the view.
      const useEye = Math.random() < eyeFrac;
      const cx = useEye ? eyeCx : aheadCx;
      const cz = useEye ? eyeCz : aheadCz;
      // Mid annulus gets most of the budget (area-uniform in ring); else full disc.
      let r;
      if (Math.random() < midFrac) {
        const t = Math.random();
        r = Math.sqrt(midInnerSq + t * (midOuterSq - midInnerSq));
      } else {
        // Area-uniform disc (sqrt) — avoids centre carpet + empty mid hills.
        r = radius * Math.sqrt(Math.random());
      }
      const theta = Math.random() * Math.PI * 2;
      const x = cx + Math.cos(theta) * r;
      const z = cz + Math.sin(theta) * r;

      const standDist = nearestStandXZ(x, z);
      if (standDist < padHard) continue;
      // Soft ramp: thin density only in a tight rim (no multi-metre bald disc).
      let padScale = 1;
      if (standDist < padSoft) {
        padScale = (standDist - padHard) / Math.max(1e-6, padSoft - padHard);
        padScale = padScale * padScale * (3 - 2 * padScale);
        if (Math.random() > 0.55 + 0.45 * padScale) continue;
      }

      if (this.heightfield.getSlopeAt(x, z) > GRASS.maxSlope) continue;

      const tall =
        this.noise.noise(x / GRASS.patchScale + 11, z / GRASS.patchScale - 7) > GRASS.patchThreshold;
      // Keep lawn height into the soft rim so nadir views from the stand still read blades.
      const hMul = tall ? 1 : 0.75;
      const widthMul = 1.2 - 0.2 * padScale;
      const width = (w0 + Math.random() * (w1 - w0)) * widthMul;
      const height = (h0 + Math.random() * (h1 - h0)) * hMul;
      const lean = l0 + Math.random() * (l1 - l0);
      // Face the eye: blade lies in local XY (normal +Z); yaw so +Z points at the eye.
      // (Do NOT add π/2 — that presents the thin edge and reads as hairlines from stands.)
      const jitter = blades.faceCameraJitter ?? 0.55;
      const facing = Math.atan2(eye.x - x, eye.z - z) + (Math.random() - 0.5) * 2 * jitter;

      dummy.position.set(x, this.heightfield.getHeightAt(x, z) - 0.02, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(written, dummy.matrix);

      const o = written * 4;
      params[o] = width;
      params[o + 1] = height;
      params[o + 2] = lean;
      params[o + 3] = facing;
      written += 1;
    }

    mesh.count = written;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.getAttribute('aParams').needsUpdate = true;
    mesh.computeBoundingSphere();
    // Inflate slightly so fade rim stays inside the cull sphere while swaying.
    if (mesh.boundingSphere) mesh.boundingSphere.radius += 2;

    this.bladeInstanceCount = written;
    this.instanceCount = this.tuftInstanceCount + this.bladeInstanceCount;
    this._lastPatch.copy(this._patchCentre);
  }

  /** Multiply vertex colours (winter frost tint). */
  setTint(hex) {
    if (this.material?.color) this.material.color.setHex(hex);
    if (this.bladeMaterial?.color) this.bladeMaterial.color.setHex(hex);
  }

  /**
   * @param {number} delta
   * @param {THREE.Vector3} [eye] Active stand eye — drives view LOD + blade patch.
   * @param {THREE.Vector3} [lookDir] Camera forward for Homing-style look-ahead.
   */
  update(delta, eye, lookDir) {
    this.uniforms.uTime.value += delta * GRASS.wind.speed;
    if (eye && this.uniforms.uEye) {
      this.uniforms.uEye.value.copy(eye);
    }
    const blades = nearBladeCfg();
    if (!blades || !this._bladeMesh || !eye) return;

    // Desired patch centre (eye + optional look-ahead on XZ).
    let cx = eye.x;
    let cz = eye.z;
    if (lookDir && blades.lookAhead) {
      this._lookScratch.copy(lookDir);
      this._lookScratch.y = 0;
      if (this._lookScratch.lengthSq() > 1e-6) {
        this._lookScratch.normalize();
        cx += this._lookScratch.x * blades.lookAhead;
        cz += this._lookScratch.z * blades.lookAhead;
      }
    }
    const shift = Math.hypot(cx - this._lastPatch.x, cz - this._lastPatch.y);
    const need =
      this.bladeInstanceCount === 0 ||
      !Number.isFinite(this._lastPatch.x) ||
      shift > (blades.refillMove ?? 2.2);
    if (need) this._refillNearBlades(eye, lookDir);
  }
}
