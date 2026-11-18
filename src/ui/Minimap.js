import { STANDS } from '../config.js';

/** CSS pixels; canvas is painted at devicePixelRatio for crisp dots. */
const MAP_SIZE = 132;
/** Extra world metres around tower / tree extents so markers are not clipped. */
const PAD = 28;

/**
 * Compact north-up hunting-ground map under the compass.
 * Trees are a static canvas layer from instance spots; towers and the player
 * marker are DOM overlays updated only when heading / stand change.
 */
export class Minimap {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#minimap-trees');
    this.standsEl = root.querySelector('#minimap-stands');
    this.goalsEl = root.querySelector('#minimap-goals');
    this.playerEl = root.querySelector('#minimap-player');
    this._bounds = null;
    this._headingDeg = null;
    this._standKey = '';
    this._playerX = null;
    this._playerZ = null;
    this._goalKey = '';
  }

  /**
   * Bake tower labels and tree dots once after scenery placement.
   * treePositions: [{ x, z }, ...] from World.treePositions.
   */
  init(treePositions = []) {
    const points = [
      ...STANDS.map((stand) => ({ x: stand.position[0], z: stand.position[1] })),
      ...treePositions,
    ];
    this._bounds = computeBounds(points);
    this.paintTrees(treePositions);
    this.paintStands();
  }

  paintTrees(treePositions) {
    const canvas = this.canvas;
    if (!canvas || !this._bounds) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(MAP_SIZE * dpr);
    canvas.height = Math.round(MAP_SIZE * dpr);
    canvas.style.width = `${MAP_SIZE}px`;
    canvas.style.height = `${MAP_SIZE}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Soft ground wash so dots read on both summer sky and winter snow HUD.
    // Parent #minimap already clips with border-radius.
    ctx.fillStyle = 'rgba(18, 28, 22, 0.55)';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    ctx.fillStyle = 'rgba(126, 168, 110, 0.9)';
    const r = 1.35;
    for (const spot of treePositions) {
      const { mx, my } = this.project(spot.x, spot.z);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  paintStands() {
    if (!this.standsEl || !this._bounds) return;
    this.standsEl.replaceChildren();
    for (const stand of STANDS) {
      const mark = document.createElement('span');
      mark.className = 'minimap-stand';
      mark.dataset.key = stand.key;
      // Short label: "Tower A" → "A".
      mark.textContent = stand.label.replace(/^Tower\s+/i, '') || stand.label;
      mark.title = stand.label;
      const { mx, my } = this.project(stand.position[0], stand.position[1]);
      mark.style.left = `${mx}px`;
      mark.style.top = `${my}px`;
      this.standsEl.appendChild(mark);
    }
  }

  /**
   * headingRad: 0 = north (-Z), increasing toward east (+X).
   * Only rewrites DOM when the rounded pose actually changes.
   */
  setPlayer(x, z, headingRad) {
    if (!this.playerEl || !this._bounds) return;
    const deg = ((headingRad * 180) / Math.PI + 360) % 360;
    const rounded = Math.round(deg);
    const px = Math.round(x * 10) / 10;
    const pz = Math.round(z * 10) / 10;
    if (
      rounded === this._headingDeg
      && px === this._playerX
      && pz === this._playerZ
    ) {
      return;
    }
    this._headingDeg = rounded;
    this._playerX = px;
    this._playerZ = pz;
    const { mx, my } = this.project(x, z);
    // North is up; heading 0 → rotate 0 so the wedge tip points up.
    this.playerEl.style.transform = `translate(${mx}px, ${my}px) rotate(${deg}deg)`;
  }

  /** Highlight the active tower letter without rebuilding markers. */
  setActiveStand(label) {
    if (!this.standsEl || label === this._standKey) return;
    this._standKey = label;
    const short = label.replace(/^Tower\s+/i, '');
    for (const el of this.standsEl.children) {
      el.classList.toggle('is-active', el.textContent === short || el.title === label);
    }
  }

  /**
   * Alive mission-goal markers (objective animals / tutorial apples).
   * Pass [] or omit in Free Play / menu so the layer stays empty.
   * points: [{ x, z }, ...]
   */
  setGoals(points = []) {
    if (!this.goalsEl || !this._bounds) return;
    const list = Array.isArray(points) ? points : [];
    // Quantize so tiny wander does not thrash the DOM every frame.
    const key = list
      .map((p) => `${Math.round(p.x)}:${Math.round(p.z)}`)
      .sort()
      .join('|');
    if (key === this._goalKey) return;
    this._goalKey = key;
    this.goalsEl.replaceChildren();
    for (const spot of list) {
      const mark = document.createElement('span');
      mark.className = 'minimap-goal';
      mark.title = 'Objective';
      const { mx, my } = this.project(spot.x, spot.z);
      mark.style.left = `${mx}px`;
      mark.style.top = `${my}px`;
      this.goalsEl.appendChild(mark);
    }
  }

  /** World x/z → map pixels (north up, east right). */
  project(x, z) {
    const { minX, minZ, span } = this._bounds;
    return {
      mx: ((x - minX) / span) * MAP_SIZE,
      my: ((z - minZ) / span) * MAP_SIZE,
    };
  }
}

function computeBounds(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  if (!Number.isFinite(minX)) {
    minX = -80;
    maxX = 120;
    minZ = 20;
    maxZ = 140;
  }
  minX -= PAD;
  maxX += PAD;
  minZ -= PAD;
  maxZ += PAD;
  const span = Math.max(maxX - minX, maxZ - minZ, 1);
  // Centre the shorter axis inside a square viewport.
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  return {
    minX: midX - span / 2,
    minZ: midZ - span / 2,
    span,
  };
}
