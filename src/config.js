// Central tuning knobs. Gameplay values match the original single-file build.

const asset = (file) => `${import.meta.env.BASE_URL}imagine_images/${file}`;

export const RENDERER = {
  maxPixelRatio: 2,
  antialias: true,
  // Nothing in the scene casts shadows (billboards are unlit), so the
  // shadow pass would be pure overhead.
  shadows: false,
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
  sun: {
    color: 0xfff5e0,
    intensity: 1.2,
    position: [50, 80, 30],
    shadowMapSize: 2048,
    shadowExtent: 60,
    shadowNear: 0.5,
    shadowFar: 200,
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
  // Score = baseScore + (distanceBonusCap - min(distance, distanceBonusCap)).
  baseScore: 80,
  distanceBonusCap: 100,
};

export const ANIMALS = {
  count: 16,
  minSpawnDistance: 30,
  spawnDistanceRange: 120,
  // Animals stop approaching once this close to the player.
  minPlayerDistance: 6,
  corpseLifetime: 5,
  deadOpacity: 0.4,
  deadColor: 0x555555,
  speedMin: 0.8,
  speedRange: 2.5,
  runMultiplier: 2.2,
  moveScale: { sideways: 8, run: 8, approach: 6, recede: 5 },
  hitboxRadiusFactor: 0.0875,
  hitboxColor: 0xff0000,
  hitboxOpacity: 0.6,
  showHitboxes: false,
  types: [
    { name: 'rabbit', texture: asset('VHjkn.png'), scale: 1.4, height: 0.7, color: '#8d7b68' },
    { name: 'deer', texture: asset('X1JXr.png'), scale: 2.6, height: 1.5, color: '#8b5a2b' },
    { name: 'bear', texture: asset('epMIo.png'), scale: 3.0, height: 1.7, color: '#3e2a1c' },
    { name: 'fox', texture: asset('zun6G.png'), scale: 2.0, height: 1.0, color: '#d2691e' },
  ],
};

export const ENVIRONMENT = {
  trees: { texture: asset('x8soI.png'), count: 25, minDistance: 25, distanceRange: 150 },
  bushes: { texture: asset('IMPtR.png'), count: 30, minDistance: 15, distanceRange: 100 },
  logs: { texture: asset('NlAcS.png'), count: 12, minDistance: 10, distanceRange: 80 },
};

export const MAX_FRAME_DELTA = 0.1;
