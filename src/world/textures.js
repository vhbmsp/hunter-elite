import * as THREE from 'three';

const cache = new Map();
const imageLoader = new THREE.ImageLoader();

/**
 * Returns a shared texture for `url`. It starts as a procedurally drawn
 * placeholder and swaps to the real image once (and if) it loads, so the
 * game stays playable when the PNG assets are absent.
 */
export function getBillboardTexture(url, drawPlaceholder, size = [256, 256]) {
  if (cache.has(url)) return cache.get(url);

  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = size;
  drawPlaceholder(canvas.getContext('2d'), canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  imageLoader.load(
    url,
    (image) => {
      texture.image = image;
      texture.needsUpdate = true;
    },
    undefined,
    () => console.warn(`[textures] ${url} not found, using placeholder`),
  );

  cache.set(url, texture);
  return texture;
}

export function disposeTextures() {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}

// Placeholder painters (canvas 2D). Each draws a silhouette on a transparent background.

export function drawAnimal(color) {
  return (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(w * 0.45, h * 0.55, w * 0.3, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 0.38, w * 0.1, h * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    const legW = w * 0.05;
    for (const x of [0.25, 0.35, 0.55, 0.65]) {
      ctx.fillRect(w * x - legW / 2, h * 0.65, legW, h * 0.33);
    }
  };
}

export function drawTree(ctx, w, h) {
  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(w * 0.45, h * 0.6, w * 0.1, h * 0.4);
  ctx.fillStyle = '#2f5d1e';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 0);
  ctx.lineTo(w * 0.95, h * 0.7);
  ctx.lineTo(w * 0.05, h * 0.7);
  ctx.closePath();
  ctx.fill();
}

export function drawBush(ctx, w, h) {
  ctx.fillStyle = '#3d6b22';
  for (const [x, y, r] of [[0.3, 0.6, 0.28], [0.55, 0.45, 0.32], [0.75, 0.65, 0.24]]) {
    ctx.beginPath();
    ctx.ellipse(w * x, h * y, w * r, h * r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawLog(ctx, w, h) {
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, h * 0.2, w, h * 0.6);
  ctx.fillStyle = '#a0764a';
  ctx.beginPath();
  ctx.ellipse(w * 0.03, h * 0.5, w * 0.03, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
