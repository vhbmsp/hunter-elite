import { WEAPON } from '../config.js';
import { hitscan } from './ballistics.js';
import { MuzzleFlash } from './muzzle.js';

export class Rifle {
  constructor(camera, animals, world, impacts, sfx, loot) {
    this.camera = camera;
    this.animals = animals;
    this.world = world;
    this.impacts = impacts;
    this.sfx = sfx;
    this.loot = loot;
    this.rounds = WEAPON.magazineSize;
    this.spares = WEAPON.spareMagazines;
    this.boltTimer = 0;
    this.reloadTimer = 0;
    this.muzzle = new MuzzleFlash(camera);
    this.onChange = null;
  }

  get reloading() {
    return this.reloadTimer > 0;
  }

  /** False while the bolt is cycling or a magazine swap is in progress. */
  get ready() {
    return this.boltTimer <= 0 && this.reloadTimer <= 0;
  }

  update(delta) {
    if (this.boltTimer > 0) this.boltTimer = Math.max(0, this.boltTimer - delta);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) this.finishReload();
    }
    this.muzzle.update();
  }

  /**
   * Fires one shot when the rifle is ready and the magazine has a round.
   * Returns { type: 'kill', animal, zone, distance, points },
   * { type: 'loot', distance, points, magazines } when a supply crate is hit,
   * { type: 'cover', surface, distance } when terrain or solid scenery stops it,
   * { type: 'miss' }, { type: 'locked' } during the bolt cycle or a reload,
   * or { type: 'empty' } for a dry click.
   */
  fire() {
    if (!this.ready) return { type: 'locked' };
    if (this.rounds <= 0) {
      this.sfx.empty();
      return { type: 'empty' };
    }

    this.rounds -= 1;
    this.boltTimer = WEAPON.boltCycle;
    this.sfx.shot();
    this.sfx.bolt();
    this.muzzle.flash();
    this.onChange?.();

    const hit = hitscan(this.camera, {
      targets: this.animals.liveHitboxes(),
      solids: this.world.solids,
      heightfield: this.world.heightfield,
      loot: this.loot.hitMeshes(),
    });
    if (!hit) return { type: 'miss' };

    if (hit.kind === 'loot') {
      const grant = hit.object.userData.crate?.collect() ?? null;
      if (!grant) return { type: 'miss' };
      this.grantSpares(grant.magazines);
      this.sfx.pickup();
      return { type: 'loot', distance: hit.distance, points: grant.points, magazines: grant.magazines };
    }

    if (hit.kind === 'cover') {
      this.impacts.spawn(hit.point, hit.normal, hit.surface);
      return { type: 'cover', surface: hit.surface, distance: hit.distance };
    }

    const { animal, zone } = hit.object.userData;
    if (!animal.kill()) return { type: 'miss' };
    this.sfx.death();
    const points = scoreFor(hit.distance, zone, animal.scoreMultiplier ?? 1);
    return { type: 'kill', animal, zone, distance: hit.distance, points, premium: Boolean(animal.premium) };
  }

  /**
   * Starts a magazine swap from a spare. Leftover rounds are dropped when the
   * swap finishes. Does nothing while already reloading, with a full magazine,
   * or with no spare magazines.
   */
  tryReload() {
    if (this.reloadTimer > 0) return false;
    if (this.spares <= 0) return false;
    if (this.rounds >= WEAPON.magazineSize) return false;
    this.reloadTimer = WEAPON.reloadTime;
    this.onChange?.();
    return true;
  }

  /** Adds spare magazines and refreshes the ammo HUD. */
  grantSpares(count) {
    if (count <= 0) return;
    this.spares += count;
    this.onChange?.();
  }

  finishReload() {
    this.reloadTimer = 0;
    this.rounds = WEAPON.magazineSize;
    this.spares -= 1;
    this.onChange?.();
  }

  /** Seats a full magazine and restores spare magazines. Bolt, reload, and muzzle behavior stay the same. */
  reset() {
    this.rounds = WEAPON.magazineSize;
    this.spares = WEAPON.spareMagazines;
    this.boltTimer = 0;
    this.reloadTimer = 0;
    this.onChange?.();
  }
}

/** Farther kills score more: base + capped distance, then zone/species multipliers. */
export function scoreFor(distance, zone = 'body', scoreMultiplier = 1) {
  const cap = WEAPON.distanceBonusCap;
  const multiplier = (WEAPON.zoneMultiplier[zone] ?? 1) * scoreMultiplier;
  return Math.round((WEAPON.baseScore + Math.min(distance, cap)) * multiplier);
}
