import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';
import { PLAYER, RENDERER, TERRAIN } from '../config.js';

// Deterministic PRNG so the same seed always yields the same terrain.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return {
    random() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

const smoothstep = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Height samples on a regular grid plus the exact mesh surface between them.
 * getHeightAt() interpolates on the same two triangles per cell that the
 * rendered mesh uses, so objects placed with it sit exactly on the surface.
 */
export class Heightfield {
  constructor(config = TERRAIN) {
    this.config = config;
    this.size = config.size;
    this.segments = config.segments;
    this.cell = this.size / this.segments;
    this.half = this.size / 2;
    this.noise = new SimplexNoise(mulberry32(config.seed));

    const n = this.segments + 1;
    this.heights = new Float32Array(n * n);
    this.knollHeight = this.rawHeight(PLAYER.position[0], PLAYER.position[2]) + config.knoll.lift;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        this.heights[j * n + i] = this.sampleHeight(i * this.cell - this.half, j * this.cell - this.half);
      }
    }
  }

  /** Layered noise without the player knoll. */
  rawHeight(x, z) {
    const { octaves, ridges, rim } = this.config;
    const { noise } = this;
    let h = 0;
    octaves.forEach(({ scale, amp }, k) => {
      h += noise.noise(x / scale + k * 17.3, z / scale - k * 9.1) * amp;
    });

    const mask = smoothstep(ridges.maskThreshold, ridges.maskThreshold + 0.35, noise.noise(x / ridges.maskScale + 50, z / ridges.maskScale + 50));
    if (mask > 0) {
      const ridged = 1 - Math.abs(noise.noise(x / ridges.scale - 30, z / ridges.scale + 70));
      h += Math.pow(ridged, ridges.sharpness) * ridges.amp * mask;
    }

    const r = Math.hypot(x, z);
    if (r > rim.start) {
      const t = Math.min(1, (r - rim.start) / (this.half - rim.start));
      h += t * t * rim.amp;
    }
    return h;
  }

  sampleHeight(x, z) {
    const { knoll } = this.config;
    const d = Math.hypot(x - PLAYER.position[0], z - PLAYER.position[2]);
    const t = 1 - smoothstep(knoll.radius, knoll.radius + knoll.falloff, d);
    return THREE.MathUtils.lerp(this.rawHeight(x, z), this.knollHeight, t);
  }

  heightAtVertex(i, j) {
    const n = this.segments + 1;
    i = THREE.MathUtils.clamp(i, 0, this.segments);
    j = THREE.MathUtils.clamp(j, 0, this.segments);
    return this.heights[j * n + i];
  }

  /** Surface height at world (x, z), matching the mesh triangulation. */
  getHeightAt(x, z) {
    const gx = THREE.MathUtils.clamp((x + this.half) / this.cell, 0, this.segments - 1e-6);
    const gz = THREE.MathUtils.clamp((z + this.half) / this.cell, 0, this.segments - 1e-6);
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const h00 = this.heightAtVertex(i, j);
    const h10 = this.heightAtVertex(i + 1, j);
    const h01 = this.heightAtVertex(i, j + 1);
    const h11 = this.heightAtVertex(i + 1, j + 1);
    // Cells are split along the (i+1, j) – (i, j+1) diagonal.
    if (fx + fz <= 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  getNormalAt(x, z, target = new THREE.Vector3()) {
    const e = this.cell;
    const dx = this.getHeightAt(x + e, z) - this.getHeightAt(x - e, z);
    const dz = this.getHeightAt(x, z + e) - this.getHeightAt(x, z - e);
    return target.set(-dx, 2 * e, -dz).normalize();
  }

  /** Steepest grade (rise/run) at (x, z), from central differences. */
  getSlopeAt(x, z) {
    const e = this.cell;
    const dx = (this.getHeightAt(x + e, z) - this.getHeightAt(x - e, z)) / (2 * e);
    const dz = (this.getHeightAt(x, z + e) - this.getHeightAt(x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
  }

  /**
   * Distance along a normalized ray to the terrain surface, or null.
   * Fixed-step march, then bisection between the last two samples.
   */
  raycast(origin, direction, maxDistance, step) {
    let prevT = 0;
    let prevAbove = origin.y - this.getHeightAt(origin.x, origin.z);
    if (prevAbove < 0) return 0;
    for (let t = step; t <= maxDistance; t += step) {
      const y = origin.y + direction.y * t;
      const above = y - this.getHeightAt(origin.x + direction.x * t, origin.z + direction.z * t);
      if (above <= 0) {
        let lo = prevT;
        let hi = t;
        for (let k = 0; k < 12; k++) {
          const mid = (lo + hi) / 2;
          const yMid = origin.y + direction.y * mid;
          const aMid = yMid - this.getHeightAt(origin.x + direction.x * mid, origin.z + direction.z * mid);
          if (aMid > 0) lo = mid;
          else hi = mid;
        }
        return hi;
      }
      prevT = t;
      prevAbove = above;
    }
    return null;
  }

  createMesh() {
    const { segments, cell, half, config } = this;
    const n = segments + 1;
    const positions = new Float32Array(n * n * 3);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = (j * n + i) * 3;
        positions[k] = i * cell - half;
        positions[k + 1] = this.heights[j * n + i];
        positions[k + 2] = j * cell - half;
      }
    }

    const indices = new Uint32Array(segments * segments * 6);
    let p = 0;
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        // Counter-clockwise seen from above; diagonal b–c matches getHeightAt.
        indices.set([a, c, b, b, c, d], p);
        p += 6;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(this.vertexColors(geometry), 3));
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.receiveShadow = RENDERER.shadows;
    mesh.name = 'terrain';
    mesh.userData.surface = 'terrain';
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  /** Height/slope based blend: lush valleys, grass, dry tops, dirt then rock on steep faces. */
  vertexColors(geometry) {
    const { colors, dirtSlope, rockSlope, dryHeight } = this.config;
    const c = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, new THREE.Color(v)]));
    const pos = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const out = new Float32Array(pos.count * 3);
    const color = new THREE.Color();

    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      const ny = normal.getY(v);
      const slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / Math.max(ny, 1e-3);

      color.copy(c.grass).lerp(c.lushGrass, smoothstep(2, -6, y));
      color.lerp(c.dryGrass, smoothstep(dryHeight - 4, dryHeight + 6, y) * 0.8);
      // Break up large flat areas.
      color.lerp(c.lushGrass, (this.noise.noise(x / 18, z / 18) * 0.5 + 0.5) * 0.35);
      color.lerp(c.dirt, smoothstep(dirtSlope * 0.7, dirtSlope, slope));
      color.lerp(c.rock, smoothstep(rockSlope * 0.75, rockSlope, slope));
      color.toArray(out, v * 3);
    }
    return out;
  }
}
