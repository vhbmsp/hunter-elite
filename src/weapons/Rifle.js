import { WEAPON } from '../config.js';
import { hitscan } from './ballistics.js';

export class Rifle {
  constructor(camera, animals, world, impacts, sfx) {
    this.camera = camera;
    this.animals = animals;
    this.world = world;
    this.impacts = impacts;
    this.sfx = sfx;
  }

  /**
   * Fires one shot.
   * Returns { type: 'kill', animal, zone, distance, points },
   * { type: 'cover', surface, distance } when terrain or solid scenery stops it,
   * or { type: 'miss' }.
   */
  fire() {
    this.sfx.shot();
    const hit = hitscan(this.camera, {
      targets: this.animals.liveHitboxes(),
      solids: this.world.solids,
      heightfield: this.world.heightfield,
    });
    if (!hit) return { type: 'miss' };

    if (hit.kind === 'cover') {
      this.impacts.spawn(hit.point, hit.normal, hit.surface);
      return { type: 'cover', surface: hit.surface, distance: hit.distance };
    }

    const { animal, zone } = hit.object.userData;
    if (!animal.kill()) return { type: 'miss' };
    this.sfx.death();
    return { type: 'kill', animal, zone, distance: hit.distance, points: scoreFor(hit.distance, zone) };
  }
}

export function scoreFor(distance, zone = 'body') {
  const cap = WEAPON.distanceBonusCap;
  const multiplier = WEAPON.zoneMultiplier[zone] ?? 1;
  return Math.round((WEAPON.baseScore + (cap - Math.min(distance, cap))) * multiplier);
}
