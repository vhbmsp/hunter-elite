import * as THREE from 'three';
import { LIGHTS, RENDERER, WORLD } from '../config.js';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLD.skyColor);
  scene.fog = new THREE.Fog(WORLD.skyColor, WORLD.fogNear, WORLD.fogFar);

  const { ambient, hemisphere, sun } = LIGHTS;
  scene.add(new THREE.AmbientLight(ambient.color, ambient.intensity));
  scene.add(new THREE.HemisphereLight(hemisphere.sky, hemisphere.ground, hemisphere.intensity));

  const sunLight = new THREE.DirectionalLight(sun.color, sun.intensity);
  sunLight.position.set(...sun.position);
  if (RENDERER.shadows) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(sun.shadowMapSize, sun.shadowMapSize);
    const cam = sunLight.shadow.camera;
    cam.near = sun.shadowNear;
    cam.far = sun.shadowFar;
    cam.left = cam.bottom = -sun.shadowExtent;
    cam.right = cam.top = sun.shadowExtent;
    sunLight.shadow.bias = sun.shadowBias;
    sunLight.shadow.normalBias = sun.shadowNormalBias;
  }
  scene.add(sunLight);

  return scene;
}
