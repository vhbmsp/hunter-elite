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
  // Rolling hills: fractal simplex octaves. scale = wavelength (m), amp = height (m).
  octaves: [
    { scale: 170, amp: 11 },
    { scale: 70, amp: 4.5 },
    { scale: 28, amp: 1.4 },
    { scale: 9, amp: 0.3 },
  ],
  // A few sharp ridges: ridged noise, only where a low-frequency mask is high.
  ridges: { scale: 120, amp: 9, sharpness: 2.5, maskScale: 260, maskThreshold: 0.1 },
  // Raised rim so the map edge is hidden behind hills.
  rim: { start: 175, amp: 28 },
  // Gentle knoll under the player so the view over the valleys stays open.
  knoll: { radius: 10, falloff: 45, lift: 3 },
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
  // Height (m) above which grass turns dry.
  dryHeight: 12,
};

// Elevated hunting stand at the player's position.
export const STAND = {
  enabled: true,
  height: 3.5,
  platformSize: 2.2,
  railHeight: 1.0,
  color: 0x6b4a2b,
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
  // Ground x/z of the player; y is derived from the terrain + stand + eye height.
  position: [0, 0, 5],
  eyeHeight: 1.6,
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
  // Score = (baseScore + (distanceBonusCap - min(distance, distanceBonusCap))) * zone multiplier.
  baseScore: 80,
  distanceBonusCap: 100,
  zoneMultiplier: { body: 1, head: 1.5 },
  // Terrain ray-march step (m) before bisection refinement.
  terrainRayStep: 0.75,
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
    // Substitute: no CC0 animated rabbit was obtainable; a Shiba Inu scaled to hare size stands in.
    {
      name: 'rabbit', model: model('animals/shiba-inu.glb'), height: 0.45,
      walkSpeed: 0.8, runSpeed: 7, walkClipSpeed: 0.7, runClipSpeed: 4.5,
    },
    {
      name: 'deer', model: model('animals/deer.glb'), height: 1.55,
      walkSpeed: 1.4, runSpeed: 11, walkClipSpeed: 1.3, runClipSpeed: 9,
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
  // Keep the area right around the stand clear.
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

export const MAX_FRAME_DELTA = 0.1;
