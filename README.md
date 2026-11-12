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
- T: toggle hitbox debug (body and head zones, drawn on top of the models)
- Esc: release the pointer

Head shots score 1.5x (`WEAPON.zoneMultiplier` in `src/config.js`).

## Assets

Animals and scenery are animated/static low-poly glTF models by Quaternius
(CC0) in `public/models/`. Sources, licenses and the two species substitutions
(wolf for bear, Shiba Inu for rabbit) are listed in
[`public/models/CREDITS.md`](public/models/CREDITS.md).

- Each GLB is loaded once with `GLTFLoader` (meshopt-compressed, decoded with
  three's bundled `MeshoptDecoder`). Animals are cloned per instance with
  `SkeletonUtils.clone` and driven by their own `AnimationMixer`
  (Idle/Idle_2/Eating while idle, Walk, Gallop, Death on a kill).
- Real-world sizes, speeds and clip names are set per species in `src/config.js`.
  Models are scaled at load time from their bounds.
- Hitboxes follow the skeleton: a body ellipsoid along the spine (`Back` to
  `Torso3` bones) and a head sphere on the `Head` bone, sized from the rig.

To swap a model, drop a GLB with the same Quaternius animal rig into
`public/models/animals/` and point the species entry in `src/config.js` at it.

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
  core/                Game composition root, glTF asset loading, renderer, scene + lights, input, frame loop
  player/              camera + PointerLockControls, scope zoom
  weapons/             rifle (firing, zone scoring) and hitscan ballistics
  entities/            species prep (scale, clips, hitbox sizes), animated Animal, hitbox zones, manager
  world/               heightmap terrain, hunting stand, instanced scenery, grass, World facade
  audio/               procedural WebAudio sound effects
  ui/                  HUD DOM bindings
```

Systems added to `GameLoop` receive `update(delta)` each frame with delta time in seconds.
