import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PLAYER, SCOPE } from '../config.js';

export class Player {
  constructor(domElement) {
    this.camera = new THREE.PerspectiveCamera(
      SCOPE.normalFov,
      window.innerWidth / window.innerHeight,
      PLAYER.near,
      PLAYER.far,
    );
    this.camera.position.set(...PLAYER.position);
    this.controls = new PointerLockControls(this.camera, domElement);
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  /** Move the camera onto a stand. Pointer lock and scope stay intact. */
  place(position, target) {
    this.camera.position.copy(position);
    this.camera.lookAt(target);
  }

  lock() {
    if (!this.controls.isLocked) this.controls.lock();
  }

  unlock() {
    if (this.controls.isLocked) this.controls.unlock();
  }

  on(event, handler) {
    this.controls.addEventListener(event, handler);
  }

  dispose() {
    this.controls.dispose();
  }
}
