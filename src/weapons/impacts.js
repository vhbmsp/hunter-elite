import * as THREE from 'three';
import { IMPACTS } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);
const _color = new THREE.Color();

/**
 * Cover-hit feedback: a short dust puff (Points, additive-free soft sprite)
 * and a dark bullet mark that fades out. All buffers are preallocated.
 */
export class ImpactEffects {
  constructor(scene) {
    this.scene = scene;
    this.puffs = [];
    this.marks = [];

    this.dustTexture = createSoftDotTexture();
    this.markGeometry = new THREE.CircleGeometry(IMPACTS.markRadius, 10);
  }

  spawn(point, normal, surface) {
    const n = normal ? normal.clone().normalize() : UP.clone();
    this.spawnDust(point, n, surface);
    this.spawnMark(point, n);
  }

  spawnDust(point, normal, surface) {
    const count = IMPACTS.dustParticles;
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      point.toArray(positions, i * 3);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(0.5)
        .add(normal)
        .normalize()
        .multiplyScalar(IMPACTS.dustSpeed * (0.4 + Math.random() * 0.8));
      velocities.push(v);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    _color.set(IMPACTS.dustColors[surface] ?? IMPACTS.dustColors.terrain);
    const material = new THREE.PointsMaterial({
      size: IMPACTS.dustSize,
      map: this.dustTexture,
      color: _color,
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.puffs.push({ points, velocities, age: 0 });
  }

  spawnMark(point, normal) {
    const mesh = new THREE.Mesh(
      this.markGeometry,
      new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }),
    );
    mesh.position.copy(point).addScaledVector(normal, 0.01);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    this.scene.add(mesh);
    this.marks.push({ mesh, age: 0 });
    if (this.marks.length > IMPACTS.maxMarks) this.removeMark(0);
  }

  removeMark(index) {
    const [{ mesh }] = this.marks.splice(index, 1);
    mesh.removeFromParent();
    mesh.material.dispose();
  }

  update(delta) {
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const puff = this.puffs[i];
      puff.age += delta;
      const life = puff.age / IMPACTS.dustLifetime;
      if (life >= 1) {
        puff.points.removeFromParent();
        puff.points.geometry.dispose();
        puff.points.material.dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      const pos = puff.points.geometry.attributes.position;
      puff.velocities.forEach((v, k) => {
        v.multiplyScalar(1 - 2.5 * delta);
        v.y -= 0.6 * delta;
        pos.setXYZ(k, pos.getX(k) + v.x * delta, pos.getY(k) + v.y * delta, pos.getZ(k) + v.z * delta);
      });
      pos.needsUpdate = true;
      puff.points.material.opacity = 0.9 * (1 - life);
      puff.points.material.size = IMPACTS.dustSize * (1 + life * 2.5);
    }

    for (let i = this.marks.length - 1; i >= 0; i--) {
      const mark = this.marks[i];
      mark.age += delta;
      const fade = mark.age - (IMPACTS.markLifetime - 1);
      if (fade > 0) mark.mesh.material.opacity = 0.85 * Math.max(0, 1 - fade);
      if (mark.age >= IMPACTS.markLifetime) this.removeMark(i);
    }
  }
}

function createSoftDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
