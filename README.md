# Hunter Elite

Fully web-based 3D hunter game built with Three.js and Vite.

## Quick start

Requires Node.js 18+.

```bash
npm install
npm run dev      # dev server with hot reload at http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle locally
```

Opening `index.html` directly from disk no longer works; use the dev server or a build.

## Controls

- Click: lock the pointer (mouse look)
- RMB (hold): scope zoom
- LMB or Space: shoot
- R: reload
- T: toggle hitbox debug (body and head zones, drawn on top of the models)
- Esc: release the pointer
- M: leave a mission or free play and return to the mission list

The rifle is a bolt-action with a 5-round magazine (`WEAPON` in `src/config.js`). You start with one magazine loaded and 2 spare magazines. The HUD shows rounds left in the magazine and spare magazines.

After each shot the bolt cycles for about 0.85s and the rifle will not fire again until it closes. R starts a 2s reload when the magazine is empty or partial and a spare remains: the spare replaces the seated magazine, and any rounds left in the old one are discarded. Reload does nothing with no spare magazines, or when the current one is already full. The trigger on an empty, ready rifle clicks and does not fire. No shot is fired while the bolt is cycling or a reload is in progress.

Head shots score 1.5× (`WEAPON.zoneMultiplier` in `src/config.js`). The Premium pig multiplies that whole score by 5 (`scoreMultiplier` on the boar entry), so a head shot is 7.5× the distance term. A Premium kill reads "Premium" on the distance line, with the points just earned.

## Missions

The game opens on a mission list. Each level names an objective (species, count, and a minimum distance) and runs a countdown. Clearing the objective ends the level immediately and opens the results. Running the clock out fails the level.

A shot counts only when it hits the objective species strictly farther than the minimum. Shooting any other animal, or the right species that is not over that distance, subtracts 50 from the score and does not count. The animal still drops. The HUD states that rule for the level you are on. Misses and shots stopped by cover are not that penalty; they do count as shots when accuracy is hits / shots.

The results screen shows success or failure, accuracy (hits / shots), the longest shot that hit an animal, time left and time used, the level score, and how many penalties landed.

Free play skips missions and keeps the sandbox: no timer, no objective, and no wrong-target penalty. Each mission and each free-play start loads a full rifle (5 rounds and 2 spare magazines). The bolt, reload, and muzzle flash are unchanged.

| Level | Objective | Time |
| --- | --- | --- |
| Valley deer | 2 deer over 70 m | 2:30 |
| Ridge elk | 1 elk over 110 m | 2:30 |
| Brush foxes | 3 foxes over 40 m | 2:30 |
| Timber bear | 1 bear over 85 m | 2:00 |
| Premium pig | 1 Premium pig over 55 m | 2:00 |
| Passing ducks | 2 ducks over 35 m | 1:30 |

Elk uses the stag model, bear uses the wolf, and the Premium pig is the boar species, same as free play.

## Assets

Ground animals and scenery are low-poly glTF models by Quaternius (CC0) in
`public/models/`. The flying ducks are a CC0 Gobkit duck. Sources, licenses
and the species substitutions (stag for elk, Premium pig for wild boar, wolf
for bear) are listed in [`public/models/CREDITS.md`](public/models/CREDITS.md).

- Each GLB is loaded once with `GLTFLoader` (meshopt-compressed, decoded with
  three's bundled `MeshoptDecoder`). Animals are cloned per instance with
  `SkeletonUtils.clone` and driven by their own `AnimationMixer`
  (Idle/Idle_2/Eating while idle, or Idle/Idle_Eating for the Premium boar; Walk;
  Gallop, or Run for the boar; Death on a kill when that clip exists).
- Real-world sizes, speeds, clip names and bone names are set per species in
  `src/config.js`. Models are scaled at load time from their bounds. Two Premium
  boars spawn; the other species share the ground count.
- Hitboxes follow the skeleton: a body ellipsoid along the spine and a head
  sphere on the head bone, sized from the rig. The Ultimate-pack animals use
  `Back`, `Torso3`, `Neck3` and `Head`. The boar overrides those names.
- Ducks fly a circle in a V, 11 m above the ground, on the Gobkit idle clip
  (the file has no flap). A hit plays `dead` and the bird falls. Their hitbox
  is one small sphere, and `T` toggles it with the others.

To swap a model, drop a GLB into `public/models/animals/` and point the species
entry in `src/config.js` at it. A different rig can name its own spine and head
bones on that entry.

## World

`src/world/terrain.js` builds the ground from seeded layered simplex noise
(hills, ridged noise, a raised rim) and exposes `getHeightAt(x, z)`, which
matches the mesh triangles. Slope and height tint the vertices from grass to
dirt to rock. The player stands on a raised wooden stand (`STAND` in
`src/config.js`).

Animals, trees, rocks, bushes and logs are planted on that surface. Animals
pitch to the slope, slow down uphill, and turn away from grades steeper than
`ANIMALS.maxSlope`.

Shots are tested against the terrain and solid scenery (trees, rocks, logs)
before animal hitboxes, so cover blocks the bullet. A hit on cover kicks up
dust and leaves a mark, and the HUD reads "Blocked by …" with no score. Grass
and bushes are visual cover only: they hide animals and do not stop bullets.
Grass is chunked `InstancedMesh` tufts with a wind sway in the vertex shader
and a distance density falloff. Scenery is one instanced mesh per model part.

## Project layout

```
src/
  main.js              entry point
  config.js            all tuning constants (FOVs, spawn counts, scoring, asset paths)
  missions.js          mission list, distance check, penalty and results formatting
  core/                Game composition root, glTF asset loading, renderer, scene + lights, input, frame loop
  player/              camera + PointerLockControls, scope zoom
  weapons/             rifle (firing, ammo, bolt, reload, muzzle flash, zone scoring) and hitscan ballistics
  entities/            species prep (scale, clips, hitbox sizes), animated Animal, flying ducks, hitbox zones, manager
  world/               heightmap terrain, hunting stand, instanced scenery, grass, World facade
  audio/               procedural WebAudio sound effects
  ui/                  HUD DOM bindings
```

Systems added to `GameLoop` receive `update(delta)` each frame with delta time in seconds.
