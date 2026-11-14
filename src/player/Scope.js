import { SCOPE } from '../config.js';

function clampIndex(index, length) {
  return Math.max(0, Math.min(length - 1, index));
}

export class Scope {
  constructor(camera, hud, controls = null) {
    this.camera = camera;
    this.hud = hud;
    this.controls = controls;
    this.active = false;
    this.zoomIndex = SCOPE.defaultZoomIndex;
    this.targetFov = SCOPE.normalFov;
    this._syncLookSensitivity();
  }

  get magnification() {
    return SCOPE.zoomLevels[this.zoomIndex] ?? SCOPE.zoomLevels[0];
  }

  get zoom() {
    return SCOPE.normalFov / this.camera.fov;
  }

  fovForMagnification(mag) {
    return SCOPE.normalFov / mag;
  }

  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      this.zoomIndex = SCOPE.defaultZoomIndex;
      this.targetFov = this.fovForMagnification(this.magnification);
    } else {
      this.targetFov = SCOPE.normalFov;
    }
    this.hud.setScoped(active, this.magnification);
    this._syncLookSensitivity();
  }

  /**
   * Step magnification while scoped. delta > 0 zooms in (higher mag).
   * No-op when hip-fire or already at the end of the ladder.
   */
  adjustZoom(delta) {
    if (!this.active || !delta) return false;
    const next = clampIndex(this.zoomIndex + Math.sign(delta), SCOPE.zoomLevels.length);
    if (next === this.zoomIndex) return false;
    this.zoomIndex = next;
    this.targetFov = this.fovForMagnification(this.magnification);
    this.hud.setScoped(true, this.magnification);
    this.hud.setZoom(this.magnification);
    this._syncLookSensitivity();
    return true;
  }

  _syncLookSensitivity() {
    if (!this.controls) return;
    const mag = this.active ? this.magnification : 1;
    this.controls.pointerSpeed = SCOPE.lookSensitivity / mag;
  }

  update(delta) {
    const { camera } = this;
    const diff = this.targetFov - camera.fov;
    if (Math.abs(diff) < 1e-3) {
      if (camera.fov !== this.targetFov) {
        camera.fov = this.targetFov;
        camera.updateProjectionMatrix();
      }
    } else {
      camera.fov += diff * (1 - Math.exp(-SCOPE.zoomRate * delta));
      camera.updateProjectionMatrix();
    }
    // Prefer the discrete step label while scoped; live FOV ratio when hip-fire.
    this.hud.setZoom(this.active ? this.magnification : this.zoom);
  }
}
