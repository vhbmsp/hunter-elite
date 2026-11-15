# 3D model credits

Ground animals and scenery are by **[Quaternius](https://quaternius.com)**,
**[Gobkit](https://gobkit.com/freebies)**, and **[Pixor](https://pixor.art)**.
The flying geese are adapted from an OpenGameArt pigeon (see below). Every file
below is
**[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)** (public domain).
No attribution is required; it is given here anyway.

Animal and scenery files from the Ultimate packs were downloaded as GLB from the
[trebeljahr/quaternius-showcase](https://github.com/trebeljahr/quaternius-showcase)
mirror (`public/glb/`), whose `LICENSES.md` lists each pack as CC0-1.0. The farm
pig (wild boar stand-in) is not in that mirror; it is the Pig model from
Quaternius's Farm Animal Pack. Gobkit animals were downloaded from
[gobkit.com/freebies](https://gobkit.com/freebies). Every file was then renamed
and compressed with `gltf-transform meshopt` (`EXT_meshopt_compression` +
`KHR_mesh_quantization`). Geometry, rigs and animation clips are otherwise
unchanged unless a note below says otherwise.

## Animals: Ultimate Animated Animal Pack

Source: <https://quaternius.com/packs/ultimateanimatedanimals.html>. License: CC0-1.0.

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/deer.glb` | `Deer` | deer | Direct match |
| `animals/stag.glb` | `Stag` | elk | **Substitute**: the pack has no elk. The stag is the closest large cervid and uses the same rig. Scaled so the back is about 1.3 m and the antler rack about 2.6 m |
| `animals/fox.glb` | `Fox` | fox | Direct match |
| `animals/wolf.glb` | `Wolf` | wolf | Direct match |
| `animals/bison.glb` | `Bull` | bison, **Premium** | **Substitute**: no CC0 animated bison. Quaternius bull on the Ultimate pack rig, scaled large |

Each Ultimate-pack rig includes the clips Idle, Idle_2, Eating, Walk, Gallop, Death, plus attack, jump and hit-react clips (not used).

## Animals: Bear (Pixor)

Source: <https://pixor.art/library/creatures/bear/>. License: CC0-1.0.

No CC0 animated brown bear with Idle / Walk / Gallop / Death turned up in Quaternius,
Gobkit free packs, Kenney, or Poly Pizza (checked again for this change). The Pixor
bear ships with a quadruped rig and an Idle clip. Idle_2, Eating, Walk, Gallop and
Death were authored on that same rig for this game, then meshopt-compressed like the
other animals.

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/bear.glb` | Pixor `bear` | bear | Real bear mesh. Scaled to about 1.35 m at the top of the head. Bones `Head` / `Neck` / `Chest` / `Hips` |

Clips used: Idle, Idle_2, Eating, Walk, Gallop, Death.

## Animals: Gobkit Free Animal Packs

Sources (all CC0-1.0):

- <https://gobkit.com/freebies/animal006/Hare.glb>
- <https://gobkit.com/freebies/animalB/Goat.glb>
- <https://gobkit.com/freebies/animal009/Eland.glb>
- <https://gobkit.com/freebies/animal009/BrahmaChicken.glb>
- <https://gobkit.com/freebies/animal007/Quail.glb>
- <https://gobkit.com/freebies/animal006/Lion.glb>
- <https://gobkit.com/freebies/animal/Duck.glb>

Gobkit ground animals share bones `Head` / `Spine` / `Hips` and clips idle / walk / dead
(no Gallop; run reuses walk). Attack is unused. Some Vol.9 meshes ship with hashed
joint names; those were renamed to the shared Gobkit names before meshopt.

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/rabbit.glb` | `Hare` | rabbit | Direct hare/rabbit match. Scaled to about 0.5 m tall |
| `animals/goat.glb` | `Goat` | goat | Direct goat match (mountain goat / chamois stand-in). About 0.95 m tall |
| `animals/moose.glb` | `Eland` | moose | **Substitute**: no CC0 animated moose. Gobkit eland, bones renamed, scaled to about 2.35 m |
| `animals/turkey.glb` | `BrahmaChicken` | turkey | **Substitute**: no CC0 animated wild turkey. Gobkit Brahma chicken, bones renamed, about 0.7 m |
| `animals/pheasant.glb` | `Quail` | pheasant | **Substitute**: no CC0 animated pheasant. Gobkit quail, about 0.45 m |
| `animals/cougar.glb` | `Lion` | cougar | **Substitute**: no CC0 animated mountain lion / lynx. Gobkit lion as mountain lion, about 0.9 m |
| `animals/duck.glb` | `Duck` | duck | Flying flock. About 0.55 m tall; hit sphere 0.28 m. Idle + procedural `LeftHand` / `RightHand` flap |

## Flying geese

Source: [Low poly 3D Pigeon model (rigged + animated)](https://opengameart.org/content/low-poly-3d-pigeon-model-rigged-animated-untextured) by mujtaba-io on OpenGameArt. License: CC0-1.0.

Gobkit / Quaternius ducks and geese lacked a clear fly/flap clip (idle/attack/dead/walk only). This pigeon ships a real flap animation on `left-wing-1` / `right-wing-1`. The mesh was recolored in Blender to a Canada-goose palette, clips renamed to `flap` / `idle` / `dead`, and meshopt-compressed. Geese fly a wider/higher V than the Gobkit ducks, play `flap` airborne with a light additive wing beat, and play `dead` when shot.

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/goose.glb` | OGA pigeon (recolored) | goose | CC0. About 0.55 m body height / ~1.4 m wingspan; hit sphere 0.36 m |

## Animals: Farm Animal Pack (Premium wild boar)

Source: <https://quaternius.com/packs/farmanimal.html> (also released as [LowPoly Animated Animals](https://quaternius.itch.io/lowpoly-animated-animals)). License: CC0-1.0.

No wild boar exists in the Ultimate Animated Animal Pack or the showcase mirror. The
**Premium** boar uses this pack's pig, scaled to a large wild boar (about 1.05 m at
the top of the back). Spawn counts come from each mission's fauna table. A kill
scores five times a normal animal at the same distance, and the head-shot multiplier
still applies on top (7.5× the distance term).

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/pig.glb` | `Pig` | boar, **Premium** | **Substitute**: no CC0 animated wild boar was available. Domestic pig, same low-poly style |

Clips used: Idle, Idle_Eating, Walk, Run, Death. The rig is smaller than the Ultimate pack (`Head`, `Neck`, `Body`, plus four legs) and has no Gallop clip. The snout follows the head bone's +Y axis.

## Omitted (no clean CC0 animated glTF)

Checked Quaternius Ultimate / Farm packs, Gobkit freebies, Pixor, Kenney, and Poly Pizza
while expanding the roster. Skipped for this change:

- **Coyote** — use wolf instead (direct Quaternius match)
- **True moose / bison / turkey / pheasant / mountain goat / mountain lion / lynx** — only substitutes above
- **Heron / crane** — no suitable CC0 animated glTF found; flying geese use the OGA pigeon above
- **Lynx** as its own species — covered by the cougar (lion) stand-in

## Scenery

Trees and bushes are from the [Simple Nature Pack](https://quaternius.com/packs/simplenature.html).
Rocks and logs are from the [Ultimate Nature Pack](https://quaternius.com/packs/ultimatenature.html).
Both are CC0-1.0.

| File | Upstream model | Pack |
| --- | --- | --- |
| `nature/tree-1.glb` | `Tree1` | Simple Nature |
| `nature/tree-2.glb` | `Tree2` | Simple Nature |
| `nature/tree-3.glb` | `Tree3` | Simple Nature |
| `nature/bush-1.glb` | `Bush1` | Simple Nature |
| `nature/bush-2.glb` | `Bush2` | Simple Nature |
| `nature/rock-1.glb` | `Rock_1` | Ultimate Nature |
| `nature/rock-3.glb` | `Rock_3` | Ultimate Nature |
| `nature/rock-5.glb` | `Rock_5` | Ultimate Nature |
| `nature/rock-moss-2.glb` | `Rock_Moss_2` | Ultimate Nature |
| `nature/rock-moss-4.glb` | `Rock_Moss_4` | Ultimate Nature |
| `nature/wood-log.glb` | `WoodLog` | Ultimate Nature |
| `nature/wood-log-moss.glb` | `WoodLog_Moss` | Ultimate Nature |
