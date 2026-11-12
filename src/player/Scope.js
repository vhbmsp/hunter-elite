import { SCOPE } from '../config.js';

export class Scope {
  constructor(camera, hud) {
    this.camera = camera;
    this.hud = hud;
    this.active = false;
    this.targetFov = SCOPE.normalFov;
  }

  setActive(active) {
    if (active === this.active) return;
    this.active = active;
    this.targetFov = active ? SCOPE.scopedFov : SCOPE.normalFov;
    this.hud.setScoped(active);
  }

  get zoom() {
    return SCOPE.normalFov / this.camera.fov;
  }

  update(delta) {
    const { camera } = this;
    const diff = this.targetFov - camera.fov;
    if (Math.abs(diff) < 1e-3) {
      if (camera.fov === this.targetFov) return;
      camera.fov = this.targetFov;
    } else {
      camera.fov += diff * (1 - Math.exp(-SCOPE.zoomRate * delta));
    }
    camera.updateProjectionMatrix();
    this.hud.setZoom(this.zoom);
  }
}
