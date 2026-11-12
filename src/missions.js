// Mission list and the rules the HUD and Game both use.
// A shot counts only when it is the objective species strictly over the minimum
// distance. Any other animal that drops is a penalty: it costs score and does
// not count toward the objective.

export const MISSION_PENALTY = 50;

const SPECIES_LABEL = {
  deer: 'deer',
  elk: 'elk',
  fox: 'fox',
  bear: 'bear',
  boar: 'Premium pig',
  duck: 'duck',
};

export const MISSIONS = [
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
  },
  {
    id: 'ridge-elk',
    title: 'Ridge elk',
    objective: '1 elk over 110 m',
    species: 'elk',
    singular: 'elk',
    article: 'an',
    count: 1,
    minDistance: 110,
    seconds: 150,
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
  },
  {
    id: 'premium-pig',
    title: 'Premium pig',
    objective: '1 Premium pig over 55 m',
    species: 'boar',
    singular: 'Premium pig',
    article: 'a',
    count: 1,
    minDistance: 55,
    seconds: 120,
  },
  {
    id: 'passing-ducks',
    title: 'Passing ducks',
    objective: '2 ducks over 35 m',
    species: 'duck',
    singular: 'duck',
    article: 'a',
    count: 2,
    minDistance: 35,
    seconds: 90,
  },
];

export function speciesLabel(type) {
  return SPECIES_LABEL[type] ?? type;
}

/** Standing HUD line for this level. */
export function penaltyRule(mission) {
  return `Shooting an animal that is not the objective, or ${mission.article} ${mission.singular} not over ${mission.minDistance} m, costs ${MISSION_PENALTY} and does not count.`;
}

/**
 * 'count' adds the kill toward the objective.
 * 'wrong-species' and 'too-close' are penalties.
 * "Over" is strict: a shot at exactly the minimum distance does not count.
 */
export function gradeKill(mission, animalType, distance) {
  if (animalType !== mission.species) return 'wrong-species';
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
