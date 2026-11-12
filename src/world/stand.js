import * as THREE from 'three';
import { STAND } from '../config.js';

const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

/** Wood board with clear painted label — readable from across the valley. */
function createSignTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const { woodColor, textColor } = STAND.sign;

  g.fillStyle = css(woodColor);
  g.fillRect(0, 0, canvas.width, canvas.height);

  g.strokeStyle = 'rgba(30, 18, 6, 0.35)';
  g.lineWidth = 6;
  for (let y = 28; y < canvas.height; y += 36) {
    g.beginPath();
    g.moveTo(0, y + (y % 72 === 28 ? 4 : -3));
    g.lineTo(canvas.width, y);
    g.stroke();
  }

  g.strokeStyle = 'rgba(20, 12, 4, 0.7)';
  g.lineWidth = 16;
  g.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  g.fillStyle = textColor;
  g.font = 'bold 110px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, canvas.width / 2, canvas.height / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Signboard at the foot of the outward leg, yawed so its face looks along (dirX, dirZ).
 * Local space of the stand group (origin on the ground under the platform center).
 */
function createFootSign(label, dirX, dirZ) {
  const { platformSize } = STAND;
  const { width, height, thickness, boardY, outward, woodColor } = STAND.sign;
  const half = platformSize / 2 - 0.06;
  const len = Math.hypot(dirX, dirZ) || 1;
  const nx = dirX / len;
  const nz = dirZ / len;

  // Prefer the leg that already sits toward the other towers.
  let best = [-1, -1];
  let bestDot = -Infinity;
  for (const leg of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const dot = leg[0] * nx + leg[1] * nz;
    if (dot > bestDot) {
      bestDot = dot;
      best = leg;
    }
  }

  const wood = new THREE.MeshLambertMaterial({ color: woodColor });
  const face = new THREE.MeshLambertMaterial({ map: createSignTexture(label) });
  // Box faces: +x -x +y -y +z -z. Yaw aims local -Z at the other stands.
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, thickness),
    [wood, wood, wood, wood, wood, face],
  );
  board.castShadow = true;
  board.receiveShadow = true;

  // Short post so the board sits on the ground rather than floating.
  const postH = boardY - height / 2;
  const post = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, Math.max(postH, 0.08), 0.08),
    wood,
  );
  post.position.y = -boardY + postH / 2;
  post.castShadow = true;
  post.receiveShadow = true;

  const sign = new THREE.Group();
  sign.name = 'stand-sign';
  sign.add(board, post);
  sign.position.set(best[0] * half + nx * outward, boardY, best[1] * half + nz * outward);
  sign.rotation.y = Math.atan2(-nx, -nz);
  return sign;
}

/** Simple wooden box stand (legs, platform, railing) built at ground (x, y, z). */
export function createStand(x, groundY, z, options = {}) {
  const group = new THREE.Group();
  group.name = 'stand';
  const material = new THREE.MeshLambertMaterial({ color: STAND.color });
  const { height, platformSize: s, railHeight } = STAND;
  const half = s / 2 - 0.06;

  const add = (w, h, d, px, py, pz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Legs reach 0.5 m into the ground so slopes never show a gap.
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    add(0.12, height + railHeight + 0.5, 0.12, lx * half, (height + railHeight - 0.5) / 2, lz * half);
  }
  add(s, 0.08, s, 0, height, 0);
  for (const side of [-1, 1]) {
    add(s, 0.06, 0.06, 0, height + railHeight, side * half);
    add(0.06, 0.06, s, side * half, height + railHeight, 0);
  }

  if (options.label && Number.isFinite(options.faceX) && Number.isFinite(options.faceZ)) {
    group.add(createFootSign(options.label, options.faceX - x, options.faceZ - z));
  }

  group.position.set(x, groundY, z);
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    child.matrixAutoUpdate = false;
  });
  return group;
}
