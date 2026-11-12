import * as THREE from 'three';
import { GRASS, PLAYER, STANDS } from '../config.js';

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

/** Lambert grass whose blade tips sway in the vertex shader (no per-frame CPU work). */
function createGrassMaterial(uniforms) {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Sway grows with height^2 so roots stay planted; phase varies per instance position.
        float sway = position.y * position.y;
        vec2 ip = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
        float w = sin(uTime * 1.7 + ip.x * 0.21 + ip.y * 0.13) + 0.45 * sin(uTime * 3.3 + ip.x * 0.7);
        transformed.x += w * uWind * sway;
        transformed.z += w * 0.6 * uWind * sway;`,
      );
  };
  return material;
}

const randomRange = ([min, max]) => min + Math.random() * (max - min);

function densityAt(distance) {
  if (distance < GRASS.clearRadius) return 0;
  for (const [radius, density] of GRASS.densityBands) {
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
 * Density drops with distance from the stand (distance LOD).
 */
export class Grass {
  constructor(heightfield, noise) {
    this.uniforms = { uTime: { value: 0 }, uWind: { value: GRASS.wind.strength } };
    this.group = new THREE.Group();
    this.group.name = 'grass';
    this.instanceCount = 0;

    const geometry = createTuftGeometry();
    const material = createGrassMaterial(this.uniforms);
    const [px, , pz] = PLAYER.position;
    const outer = GRASS.densityBands.at(-1)[0];
    const { chunkSize } = GRASS;
    const dummy = new THREE.Object3D();

    for (let cz = pz - outer; cz < pz + outer; cz += chunkSize) {
      for (let cx = px - outer; cx < px + outer; cx += chunkSize) {
        const centerDist = Math.hypot(cx + chunkSize / 2 - px, cz + chunkSize / 2 - pz);
        const density = densityAt(centerDist);
        if (density === 0 && centerDist > GRASS.clearRadius + chunkSize) continue;

        const matrices = [];
        const attempts = Math.ceil(chunkSize * chunkSize * GRASS.densityBands[0][1]);
        for (let a = 0; a < attempts; a++) {
          const x = cx + Math.random() * chunkSize;
          const z = cz + Math.random() * chunkSize;
          const d = Math.hypot(x - px, z - pz);
          if (onStandPad(x, z)) continue;
          if (Math.random() * GRASS.densityBands[0][1] > densityAt(d)) continue;
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
        mesh.receiveShadow = false;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
        this.instanceCount += matrices.length;
      }
    }
  }

  update(delta) {
    this.uniforms.uTime.value += delta * GRASS.wind.speed;
  }
}
