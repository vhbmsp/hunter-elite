import { WEAPON } from '../config.js';
import { Projectile, aimFromCamera } from './ballistics.js';
import { MuzzleFlash } from './muzzle.js';

export class Rifle {
  constructor(camera, animals, world, impacts, sfx, loot, orchard = null, scene = null) {
    this.camera = camera;
    this.animals = animals;
    this.world = world;
    this.impacts = impacts;
    this.sfx = sfx;
    this.loot = loot;
    this.orchard = orchard;
    this.scene = scene;
    this.rounds = WEAPON.magazineSize;
    this.spares = WEAPON.spareMagazines;
    this.boltTimer = 0;
    this.reloadTimer = 0;
    this.muzzle = new MuzzleFlash(camera);
    this.projectiles = [];
    this.onChange = null;
    /** Called when an in-flight round resolves: kill / apple / loot / cover / miss. */
    this.onImpact = null;
    /** When set, late impacts are ignored unless this returns true (e.g. still playing). */
    this.shouldResolve = null;
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

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const round = this.projectiles[i];
      if (!round.update(delta)) {
        round.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  /**
   * Fires one shot when the rifle is ready and the magazine has a round.
   * The round travels with gravity; scoring and cover resolve on impact via
   * `onImpact`. Returns { type: 'fired' }, { type: 'locked' }, or { type: 'empty' }.
   */
  fire() {
    if (!this.ready) return { type: 'locked' };
    if (this.rounds <= 0) {
      this.sfx.empty();
      return { type: 'empty' };
    }
    if (!this.scene) return { type: 'locked' };

    this.rounds -= 1;
    this.boltTimer = WEAPON.boltCycle;
    this.sfx.shot();
    this.sfx.bolt();
    this.muzzle.flash();
    this.onChange?.();

    const { origin, direction } = aimFromCamera(this.camera);
    const round = new Projectile(
      this.scene,
      origin.clone(),
      direction.clone(),
      () => this.shotQuery(),
      (hit) => this.resolveHit(hit),
    );
    this.projectiles.push(round);
    return { type: 'fired' };
  }

  shotQuery() {
    const orchardSolids = this.orchard?.active ? this.orchard.solids : [];
    return {
      targets: this.animals.liveHitboxes(),
      solids: [...(this.world.solids ?? []), ...orchardSolids],
      heightfield: this.world.heightfield,
      loot: this.loot.hitMeshes(),
      apples: this.orchard?.hitMeshes() ?? [],
    };
  }

  /**
   * Turn a ballistics hit (or null miss) into the same result shapes the HUD
   * and scoring already understand.
   */
  resolveHit(hit) {
    if (this.shouldResolve && !this.shouldResolve()) return;

    let result;
    if (!hit) {
      result = { type: 'miss' };
    } else if (hit.kind === 'loot') {
      const grant = hit.object.userData.crate?.collect() ?? null;
      if (!grant) {
        result = { type: 'miss' };
      } else {
        this.grantSpares(grant.magazines);
        this.sfx.pickup();
        result = { type: 'loot', distance: hit.distance, points: grant.points, magazines: grant.magazines };
      }
    } else if (hit.kind === 'apple') {
      const apple = hit.object.userData.apple;
      if (!apple?.collect()) {
        result = { type: 'miss' };
      } else {
        this.sfx.pickup();
        const points = scoreFor(hit.distance, 'body', 1);
        result = { type: 'apple', distance: hit.distance, points };
      }
    } else if (hit.kind === 'cover') {
      this.impacts.spawn(hit.point, hit.normal, hit.surface);
      result = { type: 'cover', surface: hit.surface, distance: hit.distance };
    } else {
      const { animal, zone } = hit.object.userData;
      if (!animal.kill()) {
        result = { type: 'miss' };
      } else {
        this.sfx.death();
        const points = scoreFor(hit.distance, zone, animal.scoreMultiplier ?? 1);
        result = { type: 'kill', animal, zone, distance: hit.distance, points, premium: Boolean(animal.premium) };
      }
    }
    this.onImpact?.(result);
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
    this.sfx.reloadStart();
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
    this.sfx.reloadSeat();
    this.onChange?.();
  }

  /** Seats a full magazine and restores spare magazines. Clears in-flight rounds. */
  reset() {
    this.clearProjectiles();
    this.rounds = WEAPON.magazineSize;
    this.spares = WEAPON.spareMagazines;
    this.boltTimer = 0;
    this.reloadTimer = 0;
    this.onChange?.();
  }

  clearProjectiles() {
    for (const round of this.projectiles) round.dispose();
    this.projectiles.length = 0;
  }
}

/** Farther kills score more: base + capped distance, then zone/species multipliers. */
export function scoreFor(distance, zone = 'body', scoreMultiplier = 1) {
  const cap = WEAPON.distanceBonusCap;
  const multiplier = (WEAPON.zoneMultiplier[zone] ?? 1) * scoreMultiplier;
  return Math.round((WEAPON.baseScore + Math.min(distance, cap)) * multiplier);
}
