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
// Spaced so aiming at A reads west and aiming at D reads east on the compass.
export const STANDS = [
  { key: 'KeyA', label: 'Tower A', position: [-20, 55], facing: 'east' },
  { key: 'KeyS', label: 'Tower S', position: [22, 90], facing: 'north' },
  { key: 'KeyD', label: 'Tower D', position: [64, 55], facing: 'west' },
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
    // Half-size of the shadow frustum (m), centred on the player.
    shadowExtent: 110,
    shadowNear: 0.5,
    shadowFar: 300,
    shadowBias: -0.0005,
    shadowNormalBias: 0.03,
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
  scopedFov: 18,
  // Exponential approach rate (1/s). 9.75/s ≈ the old 0.15-per-frame lerp at 60 fps.
  zoomRate: 9.75,
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
  spareMagazines: 2,
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

export const ANIMALS = {
  // Four ground species, four of each. Premium boar uses its own spawn count.
  count: 16,
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
  types: [
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
    // Substitute: no CC0 animated bear was obtainable; a grey wolf (wild predator) stands in.
    {
      name: 'bear', model: model('animals/wolf.glb'), height: 1.05,
      walkSpeed: 1.5, runSpeed: 10, walkClipSpeed: 1.3, runClipSpeed: 7,
    },
    {
      name: 'fox', model: model('animals/fox.glb'), height: 0.6,
      walkSpeed: 1.1, runSpeed: 8, walkClipSpeed: 0.9, runClipSpeed: 5,
    },
    // Premium. Substitute: no CC0 animated wild boar. A Quaternius farm pig, scaled
    // to a large boar. Only two spawn. scoreMultiplier stacks with the head-shot
    // multiplier (body ×5, head ×7.5 versus the distance term).
    {
      name: 'boar', premium: true, label: 'Premium', scoreMultiplier: 5, spawns: 2,
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
  ],
};

// Flying flock. No CC0 duck with a fly/flap clip turned up (Gobkit, Quaternius,
// Kenney, Poly Pizza, Pixor, Sketchfab CC0, OpenGameArt), so the Gobkit duck
// stays: idle while airborne with a procedural wing flap on LeftHand/RightHand,
// then dead as they fall.
export const DUCKS = {
  model: model('animals/duck.glb'),
  // Standing height (m). The source file is hundreds of units tall.
  // Slightly larger than real so the silhouette reads at scoped range.
  height: 0.55,
  count: 6,
  // Circle around the map centre. radius in m, speed in m/s, altitude above the ground.
  // Tuned so Tower A sees ~29–39 m passes and a scoped shot can lead the flock.
  radius: 34,
  speed: 5.5,
  altitude: 8.5,
  // Forgiving bird sphere without making hits trivial.
  hitRadius: 0.28,
  gravity: 18,
  flyClip: 'idle',
  deathClip: 'dead',
  // Nose-down flight attitude (rad) and wing beat on the Hand bones.
  flyPitch: 0.22,
  flapHz: 3.2,
  flapAmp: 0.7,
  // V formation, metres to the right and behind the leader.
  slots: [
    { right: 0, back: 0 },
    { right: -2.4, back: 2.2 },
    { right: 2.4, back: 2.2 },
    { right: -4.6, back: 4.4 },
    { right: 4.6, back: 4.4 },
    { right: 0, back: 4.8 },
  ],
};

// Scattered scenery, rendered as one InstancedMesh per model part.
// solid: blocks bullets (cover). Non-solid kinds only hide animals visually.
// maxSlope: skip spots steeper than this grade. sink: push into the ground (m) to hide gaps on slopes.
// alignToGround: tilt to the terrain normal (rocks, logs) instead of standing upright (trees).
export const ENVIRONMENT = {
  trees: {
    models: ['nature/tree-1.glb', 'nature/tree-2.glb', 'nature/tree-3.glb'].map(model),
    count: 36, minDistance: 16, distanceRange: 170,
    // Target height range (m).
    height: [6, 12],
    solid: true, castShadow: true, maxSlope: 0.5, sink: 0.3,
    // Keep trunks off the stand-to-stand sight lines so each tower stays visible.
    sightClear: 14,
  },
  rocks: {
    models: ['nature/rock-1.glb', 'nature/rock-3.glb', 'nature/rock-5.glb', 'nature/rock-moss-2.glb', 'nature/rock-moss-4.glb'].map(model),
    count: 24, minDistance: 12, distanceRange: 170,
    height: [0.8, 3.2],
    solid: true, castShadow: true, maxSlope: 1.2, sink: 0.25, alignToGround: true,
  },
  logs: {
    models: ['nature/wood-log.glb', 'nature/wood-log-moss.glb'].map(model),
    count: 14, minDistance: 10, distanceRange: 140,
    // Logs are sized by length along their long axis instead of height.
    length: [3, 4.5],
    solid: true, castShadow: true, maxSlope: 0.35, sink: 0.1, alignToGround: true,
  },
  bushes: {
    models: ['nature/bush-1.glb', 'nature/bush-2.glb'].map(model),
    count: 90, minDistance: 9, distanceRange: 160,
    height: [0.8, 1.9],
    // Bushes grow in clumps: this share of bushes spawns next to an earlier one.
    clumping: 0.6, clumpRadius: 4,
    solid: false, castShadow: false, maxSlope: 0.7, sink: 0.15,
  },
};

// Instanced, wind-swayed grass tufts. Shots pass through.
export const GRASS = {
  // Grass is generated in square chunks so each chunk can be frustum-culled.
  chunkSize: 40,
  // Keep the area right around each stand clear.
  clearRadius: 7,
  // Distance LOD: tufts per m² inside each radius band (m).
  densityBands: [[40, 0.55], [75, 0.22], [115, 0.08]],
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
  wind: { strength: 0.12, speed: 1.6 },
};

// Supply crates. A few drop per session on a timer, drift down under a
// parachute, then sit on the ground until they are shot or they expire.
export const LOOT = {
  // How many crates spawn after the level finishes loading.
  perSession: 3,
  // Seconds from load until the first drop, then between drops.
  firstDelay: 6,
  interval: 25,
  // Landed crates vanish after this long if they are not shot (s).
  groundLifetime: 28,
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
  // Granted on a hit. A spare magazine, not loose rounds.
  spareMagazines: 1,
  points: 50,
  crateColor: 0xa56b3c,
  bandColor: 0x3a2918,
  chuteColor: 0xe26a1b,
  chuteTrimColor: 0xf7f3ea,
  ropeColor: 0x241c16,
};

export const MAX_FRAME_DELTA = 0.1;
