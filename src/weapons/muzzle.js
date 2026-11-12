import * as THREE from 'three';
import { WEAPON } from '../config.js';

/**
 * A point light and an additive flare parented to the camera.
 * flash() lights it for `WEAPON.muzzle.frames` rendered frames, then both go fully off.
 */
export class MuzzleFlash {
  constructor(camera) {
    const { muzzle } = WEAPON;
    this.frames = muzzle.frames;
    this.framesLeft = 0;
    this.peak = muzzle.lightIntensity;

    this.light = new THREE.PointLight(muzzle.color, 0, muzzle.lightDistance, muzzle.lightDecay);
    this.light.position.set(...muzzle.offset);
    this.light.visible = false;
    this.light.castShadow = false;

    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flareTexture(),
      color: muzzle.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      opacity: 0,
    }));
    this.sprite.position.set(...muzzle.offset);
    this.sprite.scale.setScalar(muzzle.size);
    this.sprite.visible = false;
    this.sprite.frustumCulled = false;
    this.sprite.renderOrder = 999;
    this.baseSize = muzzle.size;

    camera.add(this.light, this.sprite);
  }

  flash() {
    // +1 because the loop updates before it renders, and the frame that
    // reaches zero is drawn with the flash already off.
    this.framesLeft = this.frames + 1;
    this.sprite.visible = true;
    this.light.visible = true;
    const kick = 0.9 + Math.random() * 0.25;
    this.sprite.scale.setScalar(this.baseSize * kick);
    this.apply(1);
  }

  update() {
    if (this.framesLeft <= 0) return;
    this.framesLeft -= 1;
    if (this.framesLeft <= 0) {
      this.off();
      return;
    }
    this.apply(this.framesLeft / this.frames);
  }

  apply(amount) {
    this.sprite.material.opacity = amount;
    this.light.intensity = this.peak * amount;
  }

  off() {
    this.framesLeft = 0;
    this.sprite.visible = false;
    this.sprite.material.opacity = 0;
    this.light.visible = false;
    this.light.intensity = 0;
  }
}

function flareTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,236,180,0.95)');
  g.addColorStop(0.45, 'rgba(255,150,40,0.45)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
