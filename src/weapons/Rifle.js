import { WEAPON } from '../config.js';
import { hitscan } from './ballistics.js';

export class Rifle {
  constructor(camera, animals, sfx) {
    this.camera = camera;
    this.animals = animals;
    this.sfx = sfx;
  }

  /** Fires one shot. Returns { animal, zone, distance, points } on a kill, otherwise null. */
  fire() {
    this.sfx.shot();
    const hit = hitscan(this.camera, this.animals.liveHitboxes());
    const { animal, zone } = hit?.object.userData ?? {};
    if (!animal?.kill()) return null;

    this.sfx.death();
    return { animal, zone, distance: hit.distance, points: scoreFor(hit.distance, zone) };
  }
}

export function scoreFor(distance, zone = 'body') {
  const cap = WEAPON.distanceBonusCap;
  const multiplier = WEAPON.zoneMultiplier[zone] ?? 1;
  return Math.round((WEAPON.baseScore + (cap - Math.min(distance, cap))) * multiplier);
}
