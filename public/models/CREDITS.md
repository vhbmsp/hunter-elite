# 3D model credits

All models are by **[Quaternius](https://quaternius.com)** and released under
**[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)** (public domain).
No attribution is required; it is given here anyway.

Animal and scenery files from the Ultimate packs were downloaded as GLB from the
[trebeljahr/quaternius-showcase](https://github.com/trebeljahr/quaternius-showcase)
mirror (`public/glb/`), whose `LICENSES.md` lists each pack as CC0-1.0. The farm
pig (wild boar stand-in) is not in that mirror; it is the Pig model from
Quaternius's Farm Animal Pack. Every file was then renamed and compressed with
`gltf-transform meshopt` (`EXT_meshopt_compression` + `KHR_mesh_quantization`).
Geometry, rigs and animation clips are otherwise unchanged.

## Animals: Ultimate Animated Animal Pack

Source: <https://quaternius.com/packs/ultimateanimatedanimals.html>. License: CC0-1.0.

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/deer.glb` | `Deer` | deer | Direct match |
| `animals/stag.glb` | `Stag` | elk | **Substitute**: the pack has no elk. The stag is the closest large cervid and uses the same rig. Scaled so the back is about 1.3 m and the antler rack about 2.6 m |
| `animals/fox.glb` | `Fox` | fox | Direct match |
| `animals/wolf.glb` | `Wolf` | bear | **Substitute**: no CC0 animated bear was available |
| `animals/shiba-inu.glb` | `ShibaInu` | rabbit | **Substitute**: no CC0 animated rabbit was available; scaled to hare size |

Each Ultimate-pack rig includes the clips Idle, Idle_2, Eating, Walk, Gallop, Death, plus attack, jump and hit-react clips (not used).

## Animals: Farm Animal Pack (wild boar substitute)

Source: <https://quaternius.com/packs/farmanimal.html> (also released as [LowPoly Animated Animals](https://quaternius.itch.io/lowpoly-animated-animals)). License: CC0-1.0.

No elk and no wild boar exist in the Ultimate Animated Animal Pack or the showcase mirror. The boar uses this pack's pig, scaled to a large wild boar (about 1.05 m at the top of the back).

| File | Upstream model | Game type | Notes |
| --- | --- | --- | --- |
| `animals/pig.glb` | `Pig` | boar | **Substitute**: no CC0 animated wild boar was available. Domestic pig, same low-poly style |

Clips used: Idle, Idle_Eating, Walk, Run, Death. The rig is smaller than the Ultimate pack (`Head`, `Neck`, `Body`, plus four legs) and has no Gallop clip. The snout follows the head bone's +Y axis.

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
