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
- RMB (hold): raise scope (starts at 4×)
- Mouse wheel or +/- while scoped: cycle magnification (4× / 8× / 12×)
- LMB or Space: shoot
- R: reload
- A: Tower A (faces east)
- S: Tower S (faces north)
- D: Tower D (faces west)
- T: toggle hitbox debug (body, neck, and head zones, drawn on top of the models)
- Esc: release the pointer
- Q: quit prompt (Y confirm / N cancel) back to the mission list

You start on Tower S facing north. From that view Tower A is on the left (west) and Tower D on the right (east). Looking left toward A reads west on the compass; looking right toward D reads east. A, S, and D move the camera to that stand immediately and set the look yaw to the stand's facing (A → east, S → north, D → west). They do not fire or reload. Pointer lock, scope zoom, and shooting keep working after a switch. Holding RMB opens the scope at 4×; scroll the mouse wheel (or press +/-) to step through 4× / 8× / 12×. The current magnification is shown inside the scope ring and on the HUD zoom line. Look sensitivity scales down with magnification so higher zoom stays controllable. The HUD shows the active tower name. A compass dial in the top-right tracks camera look yaw live (N/E/S/W).

**World north is −Z** (east = +X, south = +Z, west = −X). See `NORTH_AXIS` / `FACING_YAW` in `src/config.js`.

The rifle is a bolt-action with a 5-round magazine (`WEAPON` in `src/config.js`). You start with one magazine loaded and 5 spare magazines. The HUD shows an ammo rack beside the scoreboard: live/spent bullet icons for the seated magazine, and one magazine icon per spare (`public/ui/`).

After each shot the bolt cycles for about 0.85s and the rifle will not fire again until it closes. R starts a 2s reload when the magazine is empty or partial and a spare remains: the spare replaces the seated magazine, and any rounds left in the old one are discarded. Reload plays a mag-release click at the start and a seating sound when the rounds lock in. Reload does nothing with no spare magazines, or when the current one is already full. The trigger on an empty, ready rifle clicks and does not fire. No shot is fired while the bolt is cycling or a reload is in progress.

Supply crates are collected by shooting them (LMB or Space). The hunter stands still, so there is no close-range pickup. See [Supply drops](#supply-drops).

Kill score is `baseScore + min(distance, distanceBonusCap)` (`WEAPON` in `src/config.js`), so farther shots earn more up to the cap. Head shots score 1.5× (`WEAPON.zoneMultiplier`). The Premium pig multiplies that whole score by 5 (`scoreMultiplier` on the boar entry), so a head shot is 7.5× the distance term. A Premium kill reads "Premium" on the distance line, with the points just earned.

## Missions

The game opens on a mission list. Each level names an objective (species, count, and a minimum distance) and runs a countdown. Clearing the objective ends the level immediately and opens the results. Running the clock out fails the level.

The first level is a **Tutorial**: three apple trees in the valley between the stands. Eight apples face Tower S, six face Tower A, and six face Tower D (`TUTORIAL_ORCHARD` in `src/config.js`). Each canopy is a layered mesh (organic volumes, branch limbs, and dense instanced leaf cards) rather than a flat green blob. Random scenery stays clear of those spots so shots are not blocked. There are no animals and no supply crates. Practice firing, reloading (R), and switching towers (A / S / D) to shoot every apple within 5:00. Any apple hit counts — there is no distance penalty.

On hunting levels, a shot counts only when it hits the objective species strictly farther than the minimum. Shooting any other animal, or the right species that is not over that distance, subtracts 50 from the score and does not count. The animal still drops. The HUD states that rule for the level you are on. Misses and shots stopped by cover are not that penalty; they do count as shots when accuracy is hits / shots. Shooting a supply crate is not that penalty and does not count toward the objective. It does count as a shot fired.

The results screen shows success or failure, accuracy (hits / shots), the longest shot that hit an animal (or apple in the tutorial), time left and time used, the level score, how many penalties landed, and that mission’s top 10 board. Each mission starts with the same default names, but **scores are per-mission**: ladders are derived from the objective count and `scoreFor` math (head/body × distance cap × species multiplier), so #1–#10 stay challenging but reachable before the objective ends — top 3 especially, since unlocks need top-3 placements (`src/scoreboard.js`). Boards, cleared flags, and your best scores are saved in the browser (`localStorage` keys `hunter-elite.boards`, `hunter-elite.boardsVersion`, `hunter-elite.completed`, `hunter-elite.playerBests`) so they survive reload. When `boardsVersion` is below the current schema, legacy filler rows from the old flat 2000→200 ladder are stripped and boards are re-padded with the new defaults (real player names/scores are kept). If a finished run beats 10th place, the game asks for a player name before showing results. Cleared missions are marked Completed on the mission list with **your** best cleared score and name (not the default board #1). Each mission row also has a **Top 10** button to open that board from the menu.

### Unlocks

Tutorial is always open and **does not** count toward unlock thresholds. The main pack starts with the first five hunting missions unlocked. Place **top 3** (ranks 1–3) on at least **3** main hunting missions to unlock the other five. Place top 3 on **6** main hunting missions to unlock the **Winter** pack (all five snow missions). The menu shows unlock progress and a separate Winter section; locked rows are not startable and show the unlock hint. Rules live in `src/unlocks.js`.

Free play skips missions and keeps the sandbox: no timer, no objective, and no wrong-target penalty. Each mission and each free-play start loads a full rifle (5 rounds and 5 spare magazines). The bolt, reload, and muzzle flash are unchanged.

| Level | Pack | Objective | Time | Habitat fauna |
| --- | --- | --- | --- | --- |
| Tutorial | Main | Shoot all 20 apples | 5:00 | none (orchard only) |
| Valley deer | Main | 2 deer over 70 m | 2:30 | deer, fox, rabbit |
| Brush foxes | Main | 3 foxes over 40 m | 2:30 | fox, rabbit, deer |
| Ridge goats | Main | 2 goats over 60 m | 2:30 | goat, rabbit, fox |
| Timber wolves | Main | 1 wolf over 75 m | 2:15 | wolf, fox, deer |
| Timber bear | Main | 1 bear over 85 m | 2:00 | bear, wolf, deer |
| Mountain cougar | Main | 1 cougar over 80 m | 2:10 | cougar, goat, deer |
| Wetland birds | Main | 2 geese over 35 m | 1:40 | ducks, geese, rabbit |
| Upland birds | Main | 2 turkeys over 45 m | 2:15 | turkey, pheasant, rabbit |
| Trophy moose | Main | 1 moose over 100 m | 2:30 | moose, elk, deer |
| Plains bison | Main | 1 Premium bison over 90 m | 2:20 | bison, Premium pig, elk, deer |
| Snowdrift moose | Winter | 1 moose over 95 m | 2:30 | moose, elk, wolf, rabbit |
| Frost wolves | Winter | 1 wolf over 70 m | 2:15 | wolf, fox, deer |
| Ice ridge goats | Winter | 2 goats over 55 m | 2:25 | goat, rabbit, fox |
| Winter elk | Winter | 1 elk over 85 m | 2:20 | elk, moose, deer, wolf |
| Northern foxes | Winter | 3 foxes over 35 m | 2:10 | fox, rabbit, wolf |

Each hunting mission uses its own `fauna` spawn table in `src/missions.js` — not every species appears on every map. Winter missions use the shared ground with a cooler snow theme (`src/theme.js`). Free play uses `FREE_PLAY_FAUNA` in `src/config.js`. Elk uses the stag model; moose is a Gobkit eland stand-in; Premium pig is the boar species; Premium bison is a Quaternius bull stand-in.

## Supply drops

Crates parachute in during a mission and during free play (`LOOT` in `src/config.js`). Each round drops one crate, 45 seconds after the round starts. It starts 42 m above the ground, falls at 6.5 m/s (about 6.5 seconds in the air), and drifts sideways at 1.35 m/s with a small sway. It spawns ahead of the stand, 24 m to 48 m out, on ground that is not too steep. Leaving for the mission list or the results screen clears it, and the next round starts a new set.

On touchdown the parachute collapses and the crate sits for 45 seconds. If it is not shot it disappears. A hit spends the round in the chamber and grants two spare magazines plus 50 points. The ammo line, the score, and the status line (`Loot: +2 spare mags · +50`) all update.

Only the wooden crate stops a bullet. The canopy and the ropes do not, so the cloth does not silently eat shots aimed past it. Crates are tested on the same ray as animals and solid cover, and the nearest hit wins: a shot that hits the crate does not also kill an animal behind it, and a crate behind an animal or behind a tree is not collected. The crate and parachute are built-in meshes, not a downloaded model.

## Assets

Ground animals and scenery are low-poly glTF models by Quaternius, Gobkit, and
Pixor (all CC0) in `public/models/`. Flying geese use a CC0 OpenGameArt pigeon
recolored as Canada geese (see credits). Sources, licenses and species
substitutions are listed in [`public/models/CREDITS.md`](public/models/CREDITS.md).

- Each GLB is loaded once with `GLTFLoader` (meshopt-compressed, decoded with
  three's bundled `MeshoptDecoder`). Animals are cloned per instance with
  `SkeletonUtils.clone` and driven by their own `AnimationMixer`
  (Idle/Idle_2/Eating while idle, or Idle/Idle_Eating for the Premium boar, or
  idle for Gobkit ground animals; Walk; Gallop, or Run for the boar, or walk
  again for Gobkit animals; Death / dead on a kill when that clip exists).
- Real-world sizes, speeds, clip names and bone names are set per species in
  `src/config.js`. Models are scaled at load time from their bounds. Mission
  spawn counts come from each level's `fauna` table.
- Hitboxes follow the skeleton: a body ellipsoid along the spine, cylinders and
  joint spheres along the neck bones, and a head sphere on the head bone.
  A neck hit scores as a body shot; the skull stays a head shot. Sizes come
  from the rig. Ultimate-pack animals use `Back`, `Torso3`, `Neck3` and `Head`.
  Bear, boar, and Gobkit animals override those names.
- Ducks and geese fly V formations on separate circles. Ducks use Gobkit idle plus
  a procedural Hand-bone flap. Geese use an OpenGameArt flap clip on wing bones
  plus a light additive beat. A hit plays `dead` and the bird falls. Hitboxes are
  forgiving spheres; `T` toggles them with the others.

To swap a model, drop a GLB into `public/models/animals/` and point the species
entry in `src/config.js` at it. A different rig can name its own spine and head
bones on that entry.

## World

`src/world/terrain.js` builds the ground from seeded layered simplex noise
(gentle hills, soft ridges, a raised rim) and exposes `getHeightAt(x, z)`, which
matches the mesh triangles. Slope and height tint the vertices from grass to
dirt to rock. Three raised wooden stands share one model (`STAND` / `STANDS`
in `src/config.js`), spaced about 120 m from Tower S so they cover more ground.
Each is seated with `getHeightAt`, and each hangs a labeled sign just under the
deck facing the other towers. World north is −Z. The player starts on Tower S
facing north; A / S / D switch stands and apply that stand's facing yaw.

Animals, trees, rocks, bushes and logs are planted on that surface. Animals
pitch to the slope, slow down uphill, and turn away from grades steeper than
`ANIMALS.maxSlope`.

Shots are tested against the terrain and solid scenery (trees, rocks, logs)
before animal hitboxes and supply crates, so cover blocks the bullet. A hit on cover kicks up
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
  player/              camera + PointerLockControls, multi-level scope zoom
  weapons/             rifle (firing, ammo, bolt, reload, muzzle flash, zone scoring) and hitscan ballistics
  entities/            species prep (scale, clips, hitbox sizes), animated Animal, flying geese, parachute crates, tutorial apple orchard, hitbox zones, manager
  world/               heightmap terrain, hunting stand, instanced scenery, grass, World facade
  audio/               procedural WebAudio sound effects
  scoreboard.js        in-memory per-mission top 10 boards
  ui/                  HUD DOM bindings
```

Systems added to `GameLoop` receive `update(delta)` each frame with delta time in seconds.
