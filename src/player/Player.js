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
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(...PLAYER.position);
    this.controls = new PointerLockControls(this.camera, domElement);
  }

  get isLocked() {
    return this.controls.isLocked;
  }

  /**
   * Move the camera onto a stand and aim along a compass yaw.
   * Yaw uses the world convention in config (north = -Z). Pitch stays gentle.
   * Pointer lock and scope stay intact.
   */
  place(position, yaw, pitch = PLAYER.defaultPitch) {
    this.camera.position.copy(position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = yaw;
    this.camera.rotation.x = pitch;
    this.camera.rotation.z = 0;
  }

  /** Horizontal look heading in radians, 0 = north (-Z), increasing toward east (+X). */
  getHeading() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return Math.atan2(dir.x, -dir.z);
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
