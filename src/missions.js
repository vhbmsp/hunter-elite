// Mission list and the rules the HUD and Game both use.
// A shot counts only when it is the objective species strictly over the minimum
// distance. Any other animal that drops is a penalty: it costs score and does
// not count toward the objective.
//
// Each hunting mission sets `fauna` so only that habitat's species spawn.
// Tutorial has no fauna (orchard only). Free play uses FREE_PLAY_FAUNA in config.
// Ten hunting missions + tutorial = eleven entries total.

export const MISSION_PENALTY = 50;

const SPECIES_LABEL = {
  apple: 'apple',
  rabbit: 'rabbit',
  deer: 'deer',
  elk: 'elk',
  moose: 'moose',
  fox: 'fox',
  goat: 'goat',
  wolf: 'wolf',
  bear: 'bear',
  cougar: 'cougar',
  turkey: 'turkey',
  pheasant: 'pheasant',
  boar: 'Premium pig',
  bison: 'Premium bison',
  duck: 'duck',
  goose: 'goose',
};

export const MISSIONS = [
  {
    id: 'tutorial-orchard',
    title: 'Tutorial',
    objective: 'Shoot all 20 apples',
    species: 'apple',
    singular: 'apple',
    article: 'an',
    count: 20,
    minDistance: 0,
    seconds: 300,
    // Practice fire, reload, and tower switches. No animals, no loot, no distance penalty.
    tutorial: true,
  },
  {
    id: 'valley-deer',
    title: 'Valley deer',
    objective: '2 deer over 70 m',
    species: 'deer',
    singular: 'deer',
    article: 'a',
    count: 2,
    minDistance: 70,
    seconds: 150,
    fauna: {
      ground: { deer: 6, fox: 3, rabbit: 4 },
    },
  },
  {
    id: 'brush-foxes',
    title: 'Brush foxes',
    objective: '3 foxes over 40 m',
    species: 'fox',
    singular: 'fox',
    article: 'a',
    count: 3,
    minDistance: 40,
    seconds: 150,
    fauna: {
      ground: { fox: 6, rabbit: 4, deer: 2 },
    },
  },
  {
    id: 'ridge-goats',
    title: 'Ridge goats',
    objective: '2 goats over 60 m',
    species: 'goat',
    singular: 'goat',
    article: 'a',
    count: 2,
    minDistance: 60,
    seconds: 150,
    fauna: {
      ground: { goat: 6, rabbit: 3, fox: 2 },
    },
  },
  {
    id: 'timber-wolves',
    title: 'Timber wolves',
    objective: '1 wolf over 75 m',
    species: 'wolf',
    singular: 'wolf',
    article: 'a',
    count: 1,
    minDistance: 75,
    seconds: 135,
    fauna: {
      ground: { wolf: 4, fox: 3, deer: 3 },
    },
  },
  {
    id: 'timber-bear',
    title: 'Timber bear',
    objective: '1 bear over 85 m',
    species: 'bear',
    singular: 'bear',
    article: 'a',
    count: 1,
    minDistance: 85,
    seconds: 120,
    fauna: {
      ground: { bear: 3, wolf: 2, deer: 3 },
    },
  },
  {
    id: 'mountain-cougar',
    title: 'Mountain cougar',
    objective: '1 cougar over 80 m',
    species: 'cougar',
    singular: 'cougar',
    article: 'a',
    count: 1,
    minDistance: 80,
    seconds: 130,
    fauna: {
      ground: { cougar: 2, goat: 3, deer: 3 },
    },
  },
  {
    id: 'wetland-birds',
    title: 'Wetland birds',
    objective: '2 geese over 35 m',
    species: 'goose',
    singular: 'goose',
    article: 'a',
    count: 2,
    minDistance: 35,
    seconds: 100,
    fauna: {
      ground: { rabbit: 2 },
      birds: ['duck', 'goose'],
    },
  },
  {
    id: 'upland-birds',
    title: 'Upland birds',
    objective: '2 turkeys over 45 m',
    species: 'turkey',
    singular: 'turkey',
    article: 'a',
    count: 2,
    minDistance: 45,
    seconds: 135,
    fauna: {
      ground: { turkey: 5, pheasant: 5, rabbit: 3 },
    },
  },
  {
    id: 'trophy-moose',
    title: 'Trophy moose',
    objective: '1 moose over 100 m',
    species: 'moose',
    singular: 'moose',
    article: 'a',
    count: 1,
    minDistance: 100,
    seconds: 150,
    fauna: {
      ground: { moose: 3, elk: 3, deer: 2 },
    },
  },
  {
    id: 'plains-bison',
    title: 'Plains bison',
    objective: '1 Premium bison over 90 m',
    species: 'bison',
    singular: 'Premium bison',
    article: 'a',
    count: 1,
    minDistance: 90,
    seconds: 140,
    fauna: {
      // Rare premium bison with a Premium pig distractor and open-plain ungulates.
      ground: { bison: 2, boar: 2, elk: 2, deer: 3 },
    },
  },
];

export function speciesLabel(type) {
  return SPECIES_LABEL[type] ?? type;
}

/** Standing HUD line for this level. */
export function penaltyRule(mission) {
  if (mission.tutorial) {
    return 'Practice firing, reloading (R), and switching towers (A / S / D). Shoot every apple — 8 face Tower S, 6 face A, 6 face D.';
  }
  return `Shooting an animal that is not the objective, or ${mission.article} ${mission.singular} not over ${mission.minDistance} m, costs ${MISSION_PENALTY} and does not count.`;
}

/**
 * 'count' adds the kill toward the objective.
 * 'wrong-species' and 'too-close' are penalties.
 * "Over" is strict: a shot at exactly the minimum distance does not count.
 * Tutorial apple shots always count (any distance).
 */
export function gradeKill(mission, animalType, distance) {
  if (animalType !== mission.species) return 'wrong-species';
  if (mission.tutorial) return 'count';
  if (!(distance > mission.minDistance)) return 'too-close';
  return 'count';
}

export function formatClock(seconds, round = 'ceil') {
  const safe = Math.max(0, Number(seconds) || 0);
  const whole = round === 'floor' ? Math.floor(safe + 1e-9) : Math.ceil(safe - 1e-9);
  const clamped = Math.max(0, whole);
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatScore(score) {
  const n = Math.round(score);
  if (n < 0) return `−${Math.abs(n)}`;
  return String(n);
}

export function formatAccuracy(hits, shots) {
  if (shots <= 0) return '0/0';
  const pct = Math.round((hits / shots) * 100);
  return `${hits}/${shots} (${pct}%)`;
}

export function formatLongest(distance) {
  if (!(distance > 0)) return '—';
  return `${distance.toFixed(1)} m`;
}

export function formatTimeReport(timeLeft, timeUsed) {
  return `left ${formatClock(timeLeft)} · used ${formatClock(timeUsed, 'floor')}`;
}

export function formatPenalties(count) {
  if (count <= 0) return '0';
  const cost = count * MISSION_PENALTY;
  return `${count} (−${cost}, not counted)`;
}
