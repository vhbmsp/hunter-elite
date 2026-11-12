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
  groundSize: 500,
  groundColor: 0x3a5f0b,
  // Animals are kept inside this radius so they never walk off the ground.
  roamRadius: 200,
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
  position: [0, 1.6, 5],
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

export const ENVIRONMENT = {
  trees: {
    models: ['nature/common-tree-1.glb', 'nature/common-tree-3.glb', 'nature/pine-tree-1.glb', 'nature/pine-tree-3.glb'].map(model),
    count: 25, minDistance: 25, distanceRange: 150,
    // Target height range (m).
    height: [6, 12],
    castShadow: true,
  },
  bushes: {
    models: ['nature/bush-1.glb', 'nature/bush-2.glb', 'nature/bush-berries-1.glb'].map(model),
    count: 30, minDistance: 15, distanceRange: 100,
    height: [0.8, 1.8],
    castShadow: true,
  },
  logs: {
    models: ['nature/wood-log.glb', 'nature/wood-log-moss.glb'].map(model),
    count: 12, minDistance: 10, distanceRange: 80,
    // Logs are sized by length along their long axis instead of height.
    length: [3, 4],
    castShadow: true,
  },
};

export const MAX_FRAME_DELTA = 0.1;
