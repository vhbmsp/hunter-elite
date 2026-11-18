import * as THREE from 'three';
import { RENDERER } from '../config.js';

export function createRenderer(container = document.body) {
  const renderer = new THREE.WebGLRenderer({ antialias: RENDERER.antialias });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDERER.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = RENDERER.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}

/**
 * @param {() => void} [onResizeExtra] Optional hook after canvas/camera resize
 *   (e.g. EffectComposer.setSize).
 */
export function bindResize(renderer, camera, onResizeExtra = null) {
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    onResizeExtra?.(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}
