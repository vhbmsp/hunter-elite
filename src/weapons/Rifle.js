import { WEAPON } from '../config.js';
import { hitscan } from './ballistics.js';

export class Rifle {
  constructor(camera, animals, sfx) {
    this.camera = camera;
    this.animals = animals;
    this.sfx = sfx;
  }

  /** Fires one shot. Returns { animal, distance, points } on a kill, otherwise null. */
  fire() {
    this.sfx.shot();
    const hit = hitscan(this.camera, this.animals.liveHitboxes());
    const animal = hit?.object.userData.animal;
    if (!animal?.kill()) return null;

    this.sfx.death();
    return { animal, distance: hit.distance, points: scoreFor(hit.distance) };
  }
}

export function scoreFor(distance) {
  const cap = WEAPON.distanceBonusCap;
  return Math.round(WEAPON.baseScore + (cap - Math.min(distance, cap)));
}
