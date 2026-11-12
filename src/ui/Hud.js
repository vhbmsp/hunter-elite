export class Hud {
  constructor(root = document) {
    const $ = (id) => root.getElementById(id);
    this.el = {
      score: $('score'),
      ammo: $('ammo'),
      distance: $('distance'),
      zoom: $('zoom'),
      crosshair: $('crosshair'),
      scope: $('scope'),
      instructions: $('instructions'),
    };
    this.instructionsText = this.el.instructions.textContent;
  }

  setScore(score) {
    this.el.score.textContent = `Score: ${score}`;
  }

  setAmmo(rounds, spares, reloading) {
    const prefix = reloading ? 'Reloading… · ' : '';
    this.el.ammo.textContent = `${prefix}Rounds: ${rounds} · Spare mags: ${spares}`;
  }

  setBlocked(surface, distance) {
    this.el.distance.textContent = `Blocked by ${surface}: ${distance.toFixed(1)}m`;
  }

  setDistance(distance, zone) {
    const suffix = zone === 'head' ? ' · head shot' : '';
    this.el.distance.textContent = distance == null ? 'Distance: —' : `Distance: ${distance.toFixed(1)}m${suffix}`;
  }

  setLoading(loaded, total) {
    this.el.instructions.textContent = `Loading models… ${loaded}/${total}`;
  }

  setReady() {
    this.el.instructions.textContent = this.instructionsText;
  }

  setError(message) {
    this.el.instructions.textContent = message;
    this.el.instructions.style.opacity = '1';
  }

  setZoom(zoom) {
    this.el.zoom.textContent = `Zoom: ${zoom.toFixed(1)}x`;
  }

  setScoped(scoped) {
    this.el.scope.classList.toggle('active', scoped);
    this.el.crosshair.classList.toggle('hidden', scoped);
  }

  setLocked(locked) {
    this.el.instructions.style.opacity = locked ? '0.3' : '0.7';
  }
}
