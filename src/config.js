// Central tuning knobs.

const model = (path) => `${import.meta.env.BASE_URL}models/${path}`;

export const RENDERER = {
  maxPixelRatio: 2,
  antialias: true,
  shadows: true,
};

export const WORLD = {
  skyColor: 0x87ceeb,
  fogNear: 50,
  fogFar: 400,
  // Animals are kept inside this radius so they never walk off the ground.
  roamRadius: 200,
};

export const TERRAIN = {
  size: 500,
  // Grid cells per side (size / segments ≈ 2.5 m per cell).
  segments: 96,
  seed: 1337,
  // Gentler rolling hills so stands stay visible across the valley.
  // scale = wavelength (m), amp = height (m).
  octaves: [
    { scale: 170, amp: 5 },
    { scale: 70, amp: 2.2 },
    { scale: 28, amp: 0.7 },
    { scale: 9, amp: 0.15 },
  ],
  // Softer ridges: ridged noise, only where a low-frequency mask is high.
  ridges: { scale: 120, amp: 3.2, sharpness: 2.2, maskScale: 260, maskThreshold: 0.18 },
  // Raised rim so the map edge is hidden behind hills.
  rim: { start: 180, amp: 16 },
  // Gentle knoll under the player so the view over the valleys stays open.
  knoll: { radius: 10, falloff: 45, lift: 1.5 },
  colors: {
    grass: 0x4f7a28,
    lushGrass: 0x3b6b1f,
    dryGrass: 0x8a8a3c,
    dirt: 0x6b5a3a,
    rock: 0x77736b,
  },
  // Slope (rise/run) where dirt starts and where bare rock takes over.
  dirtSlope: 0.45,
  rockSlope: 0.85,
  // Height (m) above which grass turns dry (scaled with the flatter amp).
  dryHeight: 6,
};

// World north is -Z (east = +X, south = +Z, west = -X). Compass heading and
// stand switch facings all use that axis. Camera yaw (YXZ rotation.y):
//   0 looks -Z (N), -π/2 looks +X (E), π looks +Z (S), π/2 looks -X (W).
// Facing north, screen-left is west and screen-right is east.
export const NORTH_AXIS = '-Z';

export const FACING_YAW = {
  north: 0,
  east: -Math.PI / 2,
  south: Math.PI,
  west: Math.PI / 2,
};

// Elevated wooden hunting stands. Ground x/z only; y comes from getHeightAt.
// Keys select them in order: A, S, D. Each site sees the other two and the valley.
// label is painted on a signboard hung under the deck, facing the other stands.
// facing: compass heading applied to the camera when the player switches here.
//
// From Tower S looking north (-Z): Tower A is west (left of view), Tower D east (right).
// Spread ~120 m from S so the three stands cover more of the hunting ground;
// aiming at A still reads west and D east on the compass.
export const STANDS = [
  { key: 'KeyA', label: 'Tower A', position: [-70, 38], facing: 'east' },
  { key: 'KeyS', label: 'Tower S', position: [22, 118], facing: 'north' },
  { key: 'KeyD', label: 'Tower D', position: [114, 38], facing: 'west' },
];

// Player spawn: Tower S, facing north (-Z).
export const DEFAULT_STAND_INDEX = 1;

export const STAND = {
  enabled: true,
  height: 3.5,
  platformSize: 2.2,
  railHeight: 1.0,
  color: 0x6b4a2b,
  // Switch aim blends from the other stands' eye midpoint down toward the ground
  // so the other towers and the valley share the frame.
  aimDrop: 0.15,
  // Deck signboard: wood board with canvas text, hung just under the platform
  // facing the other stands so hills between towers do not hide a ground sign.
  // Sized to stay readable from the other stands (~70–80 m) under scope.
  sign: {
    width: 1.7,
    height: 0.8,
    thickness: 0.06,
    // Gap from platform underside to the top of the board (m).
    underDeck: 0.08,
    // Extra push past the platform edge along the facing direction (m).
    outward: 0.12,
    woodColor: 0x6e4a24,
    textColor: '#f3e6c8',
  },
};

export const LIGHTS = {
  ambient: { color: 0xffffff, intensity: 0.6 },
  hemisphere: { sky: 0xcfe8ff, ground: 0x3a5f0b, intensity: 0.5 },
  sun: {
    color: 0xfff5e0,
    intensity: 1.6,
    position: [50, 80, 30],
    shadowMapSize: 2048,
    // Half-size of the shadow frustum (m), centred on the player (see Game.syncSunShadow).
    shadowExtent: 110,
    shadowNear: 0.5,
    shadowFar: 300,
    // Phase 3: mild bias for terrain + grass root-shadow sampling (avoids acne without
    // lifting contact shadows off the meadow). Grass samples PCF at the tuft root.
    shadowBias: -0.0004,
    shadowNormalBias: 0.02,
  },
};

export const PLAYER = {
  // Ground x/z of the default stand (Tower S). y is derived from terrain + stand + eye.
  position: [STANDS[DEFAULT_STAND_INDEX].position[0], 0, STANDS[DEFAULT_STAND_INDEX].position[1]],
  eyeHeight: 1.6,
  // Slight downward pitch (rad) when a stand facing is applied.
  defaultPitch: -0.12,
  near: 0.1,
  far: 1000,
};

export const SCOPE = {
  normalFov: 75,
  // Discrete riflescope magnifications while holding RMB. FOV = normalFov / mag.
  // 4× matches the old single scoped FOV (~18°); 8× / 12× are further steps.
  zoomLevels: [4, 8, 12],
  // Index into zoomLevels when first raising the scope each hold.
  defaultZoomIndex: 0,
  // Exponential approach rate (1/s). 9.75/s ≈ the old 0.15-per-frame lerp at 60 fps.
  zoomRate: 9.75,
  // Hip-fire look scale for PointerLockControls.pointerSpeed. While scoped,
  // speed is divided by the live magnification so higher zoom stays controllable.
  lookSensitivity: 1,
};

// Phase 5b (Homing / Kitten-style): scoped DOF + bloom for screenshots / ADS feel.
// Hip-fire stays a direct render (zero post cost). Soft-GL: keep resolutionScale
// modest; DOF stays off by default (extra depth scene pass) — mild when enabled.
export const SCOPE_POST = {
  // Master switch. false → always direct renderer.render.
  enabled: true,
  // Composer / bloom buffer scale vs canvas (1 = full). Lower = cheaper soft GL.
  resolutionScale: 0.75,
  dof: {
    // Off by default: BokehPass re-renders the scene for depth (costly on soft GL).
    // Flip on for screenshots; knobs below stay mild for ADS readability.
    enabled: false,
    // Fallback focus distance (m) when the aim ray misses.
    focus: 80,
    // Three.js bokeh units; keep tiny so the crosshair target stays sharp.
    aperture: 0.00008,
    maxblur: 0.006,
  },
  bloom: {
    // Mild glow while scoped (sun / sky highlights). Strength 0 = visually off.
    enabled: true,
    strength: 0.2,
    radius: 0.35,
    threshold: 0.84,
  },
};

export const WEAPON = {
  // Score = (baseScore + min(distance, distanceBonusCap))
  //          * zone multiplier * species scoreMultiplier (1, or 5 for Premium).
  // Farther shots earn more (capped); a point-blank kill is just baseScore.
  baseScore: 80,
  distanceBonusCap: 100,
  zoneMultiplier: { body: 1, head: 1.5 },
  // Terrain ray-march step (m) before bisection refinement.
  terrainRayStep: 0.75,
  // Bolt-action magazine. Spares are full magazines, not loose rounds.
  magazineSize: 5,
  spareMagazines: 5,
  // Lockout after each shot while the bolt cycles (s).
  boltCycle: 0.85,
  // Magazine swap (s). Rounds left in the seated magazine are discarded.
  reloadTime: 2,
  // First-person muzzle flash parented to the camera. `frames` is how many
  // rendered frames it stays visible; the next frame turns the light off.
  muzzle: {
    frames: 5,
    color: 0xfff1c4,
    // Camera-local offset (m): right, down, forward.
    offset: [0.2, -0.17, -0.62],
    size: 0.26,
    lightIntensity: 36,
    lightDistance: 9,
    lightDecay: 2,
  },
  // Projectile flight (no wind). Short/medium shots stay close to the old
  // hitscan feel; beyond ~100 m gravity drop needs holdover.
  ballistics: {
    // Initial speed along the aim ray (m/s).
    muzzleVelocity: 320,
    // Downward acceleration (m/s²). World +Y is up.
    gravity: 9.81,
    // Despawn after this path length (m) if nothing was hit.
    maxRange: 400,
    // Max segment length per collision substep so fast rounds do not tunnel.
    maxStep: 1.5,
    trail: {
      // Ring buffer of world points along the flight path.
      maxPoints: 56,
      color: 0xffd089,
      tipColor: 0xfff6d0,
      tipSize: 0.11,
      // Opacity while the round is in flight.
      opacity: 0.85,
      // Seconds of fade after impact or max-range miss, then despawn.
      fadeTime: 0.4,
    },
  },
};

export const IMPACTS = {
  // Dust puff on cover hits.
  dustParticles: 14,
  dustLifetime: 0.9,
  dustSize: 0.35,
  dustSpeed: 1.6,
  dustColors: { terrain: 0x8a7650, tree: 0x5a4024, rock: 0x9a958c, log: 0x5a4024 },
  // Dark bullet mark left on the surface.
  markRadius: 0.12,
  markLifetime: 8,
  maxMarks: 24,
};

// Clip names inside the Quaternius animal rigs (prefixed "AnimalArmature|" in the files).
export const ANIMAL_CLIPS = {
  idle: ['Idle', 'Idle_2', 'Eating'],
  walk: 'Walk',
  run: 'Gallop',
  death: 'Death',
};

// Shared Gobkit Free Animal Pack rig (rabbit, goat, moose, turkey, pheasant, cougar, …).
const GOBKIT_GROUND = {
  bones: { neck: 'Spine', rump: 'Hips', chest: 'Spine' },
  clips: { idle: ['idle'], walk: 'walk', run: 'walk', death: 'dead' },
};

export const ANIMALS = {
  minSpawnDistance: 30,
  spawnDistanceRange: 120,
  // Animals stop approaching once this close to the player.
  minPlayerDistance: 6,
  corpseLifetime: 5,
  // Per-animal random speed factor range.
  speedVariance: [0.8, 1.25],
  // Yaw turn rate toward the movement direction (rad/s).
  turnRate: 4,
  crossFade: 0.25,
  // Steepest grade (rise/run) an animal will walk onto (~31°), probed this far ahead (m).
  maxSlope: 0.6,
  slopeProbe: 1.5,
  // Uphill slowdown: speed *= 1 - uphillGrade * uphillPenalty (floored at 0.4).
  uphillPenalty: 0.8,
  // Body pitch follows the ground; exponential rate (1/s).
  pitchRate: 6,
  hitboxColor: 0xff0000,
  hitboxOpacity: 0.6,
  showHitboxes: false,
  // height: standing height to the top of the head/ears (m). Speeds in m/s.
  // walkClipSpeed/runClipSpeed: ground speed at which the clip plays at timeScale 1.
  // Spawn counts come from each mission's `fauna` table (or FREE_PLAY_FAUNA).
  types: [
    // Gobkit Hare. Clips are lowercase idle / walk / dead; no Gallop, so run reuses walk.
    {
      name: 'rabbit', model: model('animals/rabbit.glb'), height: 0.5,
      walkSpeed: 0.8, runSpeed: 7, walkClipSpeed: 0.7, runClipSpeed: 4.5,
      ...GOBKIT_GROUND,
      bodyFit: { width: 1.2, height: 1.6, length: 1.1, drop: 0.35 },
    },
    {
      name: 'deer', model: model('animals/deer.glb'), height: 1.55,
      walkSpeed: 1.4, runSpeed: 11, walkClipSpeed: 1.3, runClipSpeed: 9,
    },
    // Substitute: no CC0 animated elk. The Quaternius stag shares the deer rig.
    // Height is the bounding box, which includes the antler rack, so the back
    // sits near 1.3 m and the rack near 2.6 m.
    {
      name: 'elk', model: model('animals/stag.glb'), height: 2.6,
      walkSpeed: 1.5, runSpeed: 12, walkClipSpeed: 1.75, runClipSpeed: 12,
      // Antlers widen the bounds; keep the head sphere on the skull.
      headRadiusFactor: 0.6,
    },
    // Substitute: no CC0 animated moose. Gobkit Eland (bones renamed to Head/Spine/Hips).
    {
      name: 'moose', model: model('animals/moose.glb'), height: 2.35,
      walkSpeed: 1.35, runSpeed: 10, walkClipSpeed: 0.9, runClipSpeed: 5.5,
      ...GOBKIT_GROUND,
      headRadiusFactor: 0.7,
      bodyFit: { width: 1.35, height: 1.8, length: 1.3, drop: 0.35 },
    },
    // Pixor CC0 bear. Idle ships with the model; Idle_2 / Eating / Walk / Gallop /
    // Death were authored on that rig for the game. Bones: Head / Neck / Chest / Hips.
    {
      name: 'bear', model: model('animals/bear.glb'), height: 1.35,
      walkSpeed: 1.4, runSpeed: 9, walkClipSpeed: 1.2, runClipSpeed: 6.5,
      bones: { neck: 'Neck', rump: 'Hips', chest: 'Chest' },
      // Bulkier than the deer the default ellipsoid was tuned on.
      bodyFit: { width: 1.45, height: 1.9, length: 1.2, drop: 0.4 },
    },
    {
      name: 'wolf', model: model('animals/wolf.glb'), height: 0.95,
      walkSpeed: 1.5, runSpeed: 11, walkClipSpeed: 1.3, runClipSpeed: 7,
    },
    // Substitute: Gobkit Lion as a mountain lion / cougar. Rare predator missions only.
    {
      name: 'cougar', model: model('animals/cougar.glb'), height: 0.9,
      walkSpeed: 1.3, runSpeed: 12, walkClipSpeed: 0.85, runClipSpeed: 5.5,
      ...GOBKIT_GROUND,
      bodyFit: { width: 1.25, height: 1.5, length: 1.35, drop: 0.3 },
    },
    {
      name: 'fox', model: model('animals/fox.glb'), height: 0.6,
      walkSpeed: 1.1, runSpeed: 8, walkClipSpeed: 0.9, runClipSpeed: 5,
    },
    // Gobkit Goat — mountain goat / chamois stand-in with a direct goat mesh.
    {
      name: 'goat', model: model('animals/goat.glb'), height: 0.95,
      walkSpeed: 1.0, runSpeed: 8, walkClipSpeed: 0.75, runClipSpeed: 4.5,
      ...GOBKIT_GROUND,
      bodyFit: { width: 1.15, height: 1.55, length: 1.15, drop: 0.3 },
    },
    // Substitute: Gobkit Brahma chicken as wild turkey (hashed bones renamed).
    {
      name: 'turkey', model: model('animals/turkey.glb'), height: 0.7,
      walkSpeed: 0.7, runSpeed: 5, walkClipSpeed: 0.55, runClipSpeed: 3.2,
      ...GOBKIT_GROUND,
      bodyFit: { width: 1.3, height: 1.5, length: 1.15, drop: 0.25 },
    },
    // Substitute: Gobkit Quail as pheasant.
    {
      name: 'pheasant', model: model('animals/pheasant.glb'), height: 0.45,
      walkSpeed: 0.6, runSpeed: 6, walkClipSpeed: 0.5, runClipSpeed: 3.5,
      ...GOBKIT_GROUND,
      bodyFit: { width: 1.1, height: 1.4, length: 1.2, drop: 0.25 },
    },
    // Premium. Substitute: no CC0 animated wild boar. A Quaternius farm pig, scaled
    // to a large boar. scoreMultiplier stacks with the head-shot multiplier.
    {
      name: 'boar', premium: true, label: 'Premium', scoreMultiplier: 5,
      model: model('animals/pig.glb'), height: 1.05,
      walkSpeed: 1.0, runSpeed: 8, walkClipSpeed: 0.85, runClipSpeed: 4.5,
      bones: { neck: 'Neck', rump: 'Body', chest: 'Neck' },
      clips: { idle: ['Idle', 'Idle_Eating'], run: 'Run' },
      snoutAxis: 'y',
      headRadiusFactor: 1.7,
      snoutPush: 1.15,
      // Rounder than the deer the default ellipsoid was tuned on.
      bodyFit: { width: 1.5, height: 2.4, length: 1.25, drop: 0.2 },
    },
    // Premium rare. Substitute: Quaternius Bull as American bison (Ultimate pack, same rig).
    {
      name: 'bison', premium: true, label: 'Premium', scoreMultiplier: 5,
      model: model('animals/bison.glb'), height: 2.05,
      walkSpeed: 1.2, runSpeed: 9, walkClipSpeed: 1.4, runClipSpeed: 8,
      headRadiusFactor: 0.75,
      bodyFit: { width: 1.55, height: 1.85, length: 1.35, drop: 0.35 },
    },
  ],
};

const BIRD_SLOTS_V = [
  { right: 0, back: 0 },
  { right: -2.4, back: 2.2 },
  { right: 2.4, back: 2.2 },
  { right: -4.6, back: 4.4 },
  { right: 4.6, back: 4.4 },
  { right: 0, back: 4.8 },
];

// Wider V for the larger Canada-goose silhouette.
const BIRD_SLOTS_GOOSE = [
  { right: 0, back: 0 },
  { right: -2.8, back: 2.6 },
  { right: 2.8, back: 2.6 },
  { right: -5.4, back: 5.2 },
  { right: 5.4, back: 5.2 },
  { right: 0, back: 5.6 },
];

// Flying flocks. Ducks stay Gobkit (idle + Hand-bone flap). Geese use an
// OpenGameArt pigeon recolored as Canada geese with a real flap clip.
export const BIRDS = {
  duck: {
    name: 'duck',
    model: model('animals/duck.glb'),
    // Standing height (m). Slightly larger than real so the silhouette reads at range.
    height: 0.55,
    // Circle around the map centre. radius in m, speed in m/s, altitude above the ground.
    radius: 34,
    speed: 5.5,
    altitude: 8.5,
    hitRadius: 0.28,
    gravity: 18,
    flyClip: 'idle',
    deathClip: 'dead',
    flyPitch: 0.22,
    flapHz: 3.2,
    flapAmp: 0.7,
    leftWing: 'LeftHand',
    rightWing: 'RightHand',
    flapAxis: 'x',
    slots: BIRD_SLOTS_V,
  },
  goose: {
    name: 'goose',
    model: model('animals/goose.glb'),
    // Body height (m). Source mesh is ~0.24 m tall with wings out → ~1.4 m wingspan.
    height: 0.55,
    // Wider, higher circle so geese do not sit on top of the duck path.
    radius: 48,
    speed: 6.2,
    altitude: 11,
    hitRadius: 0.36,
    gravity: 18,
    flyClip: 'flap',
    deathClip: 'dead',
    // Source pose is already wings-out; light nose-down for travel.
    flyPitch: 0.12,
    flapHz: 2.8,
    flapAmp: 0.18,
    leftWing: 'left-wing-1',
    rightWing: 'right-wing-1',
    flapAxis: 'z',
    slots: BIRD_SLOTS_GOOSE,
  },
};

/** @deprecated Prefer BIRDS.duck — kept for any leftover imports. */
export const DUCKS = BIRDS.duck;

/**
 * Default sandbox population for free play: a sample of every species, not a
 * full dump of every mission table.
 */
export const FREE_PLAY_FAUNA = {
  ground: {
    rabbit: 2,
    deer: 2,
    elk: 1,
    moose: 1,
    bear: 1,
    wolf: 1,
    cougar: 1,
    fox: 2,
    goat: 2,
    turkey: 2,
    pheasant: 2,
    boar: 1,
    bison: 1,
  },
  birds: ['duck', 'goose'],
};

// Scattered scenery, rendered as one InstancedMesh per model part.
// solid: blocks bullets (cover). Non-solid kinds only hide animals visually.
// maxSlope: skip spots steeper than this grade. sink: push into the ground (m) to hide gaps on slopes.
// alignToGround: tilt to the terrain normal (rocks, logs) instead of standing upright (trees).
export const ENVIRONMENT = {
  // Counts are sized for three stands (~120 m apart); spawns pick a random stand.
  trees: {
    models: ['nature/tree-1.glb', 'nature/tree-2.glb', 'nature/tree-3.glb'].map(model),
    count: 72, minDistance: 16, distanceRange: 130,
    // Target height range (m).
    height: [6, 12],
    solid: true, castShadow: true, maxSlope: 0.5, sink: 0.3,
    // Keep trunks off the stand-to-stand sight lines so each tower stays visible.
    sightClear: 14,
  },
  rocks: {
    models: ['nature/rock-1.glb', 'nature/rock-3.glb', 'nature/rock-5.glb', 'nature/rock-moss-2.glb', 'nature/rock-moss-4.glb'].map(model),
    count: 48, minDistance: 12, distanceRange: 120,
    height: [0.8, 3.2],
    solid: true, castShadow: true, maxSlope: 1.2, sink: 0.25, alignToGround: true,
  },
  logs: {
    models: ['nature/wood-log.glb', 'nature/wood-log-moss.glb'].map(model),
    count: 28, minDistance: 10, distanceRange: 110,
    // Logs are sized by length along their long axis instead of height.
    length: [3, 4.5],
    solid: true, castShadow: true, maxSlope: 0.35, sink: 0.1, alignToGround: true,
  },
  bushes: {
    models: ['nature/bush-1.glb', 'nature/bush-2.glb'].map(model),
    count: 160, minDistance: 9, distanceRange: 120,
    height: [0.8, 1.9],
    // Bushes grow in clumps: this share of bushes spawns next to an earlier one.
    clumping: 0.6, clumpRadius: 4,
    solid: false, castShadow: false, maxSlope: 0.7, sink: 0.15,
  },
};

// Instanced, wind-swayed grass tufts. Shots pass through.
// Phase 1 (Homing transfer): view-weighted density + tip colour + multi-freq wind.
// Flip `enhanced` to false for an A/B against the pre-Phase-1 look.
export const GRASS = {
  // Grass is generated in square chunks so each chunk can be frustum-culled.
  chunkSize: 40,
  // Keep the area right around each stand clear.
  clearRadius: 7,
  // Distance LOD from the nearest stand: tufts per m² inside each radius band (m).
  // Near band is denser when `enhanced` (Homing-style meadow at the eye).
  densityBands: [[40, 0.55], [75, 0.22], [115, 0.08]],
  densityBandsEnhanced: [[40, 0.9], [75, 0.28], [115, 0.08]],
  // Soft scale falloff vs active eye (shader LOD); far tufts shrink, near stay full.
  viewNear: 28,
  viewFar: 95,
  viewMinScale: 0.35,
  // Tip lift (multiply vertex colour by height); noiseTint pulls toward terrain green.
  tipBoost: 1.35,
  tipBaseMul: 0.92,
  noiseTint: 0x3b6b1f,
  noiseTintStrength: 0.22,
  // Low-frequency patch mask: tall meadows where noise > threshold, short turf elsewhere.
  patchScale: 45,
  patchThreshold: 0.1,
  tallHeight: [0.7, 1.15],
  shortHeight: [0.25, 0.45],
  bladesPerTuft: 3,
  tuftRadius: 0.35,
  bladeWidth: 0.07,
  maxSlope: 0.75,
  colorBase: 0x2f4f16,
  colorTip: 0x9aa84a,
  // Primary sway + second octave (tip flutter). Strength is metres of tip travel.
  wind: { strength: 0.12, speed: 1.6, octave2: 0.45 },
  // Phase 1 blade richness. Set false to A/B legacy density + single-band wind.
  enhanced: true,
  // Phase 3: whole-shade multiplier in full PCF shadow (on top of Lambert direct).
  // Lower = clearer trunk contact on blades; keep modest so canopy bake does not mud.
  shadowIndirect: 0.32,
};

// Phase 4 (Homing transfer): shared outdoor lit helper for terrain + grass.
// MeshLambert still owns sun PCF / ambient / hemi; this adds bounce, sky fill,
// distance haze (material.fog off), and optional turf micro-variation.
export const OUTDOOR_LIT = {
  enabled: true,
  // Extra sky wrap on upward faces (on top of HemisphereLight).
  skyFill: 0.12,
  // Homing-style ground bounce on downward / under-facing normals.
  bounceStrength: 0.22,
  // 1 = full replace of fog colour at fogFar (scene.fog still used for other meshes).
  hazeStrength: 1,
  // Terrain-only lush/pale break-up; keep modest so winter snow stays readable.
  turfStrength: 0.14,
};

// Phase 2 (Homing transfer): static soft canopy shade bake from treePositions.
// Sampled in terrain + grass after colour/tint so winter snow still reads white.
export const CANOPY_SHADE = {
  // Occupancy map resolution over TERRAIN.size (metres). 256² stays soft at stand view.
  resolution: 256,
  // Fallback crown footprint (m) when a tree spot has no per-instance radius.
  discRadius: 5.5,
  // Per-tree radius = worldHeight * radiusFromHeight (set in environment scatter).
  radiusFromHeight: 0.42,
  // Occupancy falloff: full shade inside softStart*radius, smooth to rim.
  softStart: 0.28,
  // Max darken under full occupancy (0–1). Lowered for Phase 3 so bake + PCF
  // sun shadows under crowns do not mud the meadow.
  strength: 0.32,
};

// Supply crates. One drop per session on a timer, drifts down under a
// parachute, then sits on the ground until it is shot or expires.
export const LOOT = {
  // How many crates spawn after the level finishes loading.
  perSession: 1,
  // Seconds from load until the drop (only one per session).
  firstDelay: 45,
  interval: 25,
  // Landed crates vanish after this long if they are not shot (s).
  groundLifetime: 45,
  // Start this far above the terrain (m). fallSpeed is m/s, so a drop is in
  // the air for dropHeight / fallSpeed seconds (about 6.5s).
  dropHeight: 42,
  fallSpeed: 6.5,
  // Steady horizontal drift while descending (m/s), plus a sideways sway (m, Hz).
  driftSpeed: 1.35,
  swayAmplitude: 0.85,
  swayFrequency: 0.45,
  // Parachute squash after touchdown (s).
  collapseTime: 0.6,
  // Spawn ring around the stand. The camera starts facing -Z (north), and
  // spawnArc (radians) is centered on that direction so crates fall in view.
  minDistance: 24,
  maxDistance: 48,
  spawnArc: 2.2,
  // Skip steep ground when picking a landing area (rise/run).
  maxSlope: 0.5,
  // Crate width, height, depth (m).
  crateSize: [1.15, 0.78, 1.15],
  chuteRadius: 1.85,
  // Canopy rim height above the crate centre (m).
  chuteHeight: 2.35,
  // Granted on a hit. Spare magazines, not loose rounds.
  spareMagazines: 2,
  points: 50,
  crateColor: 0xa56b3c,
  bandColor: 0x3a2918,
  chuteColor: 0xe26a1b,
  chuteTrimColor: 0xf7f3ea,
  ropeColor: 0x241c16,
};

// Tutorial orchard between the three stands. Each tree sits toward its stand
// from the valley centre; apples hang on that stand's near side so clearing
// every fruit means switching towers (A / S / D).
export const TUTORIAL_ORCHARD = {
  // Distance from stand centroid toward each tower (m).
  towardStand: 18,
  // Keep random scenery out of the firing lanes around each apple tree (m).
  clearRadius: 14,
  trunkHeight: 4.6,
  trunkRadius: 0.38,
  canopyRadius: 2.35,
  canopyLift: 5.1,
  appleRadius: 0.22,
  trunkColor: 0x5c3a1e,
  leafColor: 0x3f7a28,
  appleColor: 0xd12d1f,
  trees: [
    { stand: 'Tower S', apples: 8 },
    { stand: 'Tower A', apples: 6 },
    { stand: 'Tower D', apples: 6 },
  ],
};

/** Ground x/z for each tutorial apple tree (same spots the orchard uses). */
export function tutorialOrchardSpots() {
  let cx = 0;
  let cz = 0;
  for (const stand of STANDS) {
    cx += stand.position[0];
    cz += stand.position[1];
  }
  cx /= STANDS.length;
  cz /= STANDS.length;

  const spots = [];
  for (const entry of TUTORIAL_ORCHARD.trees) {
    const stand = STANDS.find((s) => s.label === entry.stand);
    if (!stand) continue;
    const [sx, sz] = stand.position;
    const dx = sx - cx;
    const dz = sz - cz;
    const len = Math.hypot(dx, dz) || 1;
    spots.push({
      x: cx + (dx / len) * TUTORIAL_ORCHARD.towardStand,
      z: cz + (dz / len) * TUTORIAL_ORCHARD.towardStand,
    });
  }
  return spots;
}

export const MAX_FRAME_DELTA = 0.1;
