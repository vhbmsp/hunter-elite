import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * Loads each glTF URL once. Models in public/models are meshopt-compressed
 * (EXT_meshopt_compression), so the loader needs the meshopt decoder.
 */
export class AssetLibrary {
  constructor(onProgress) {
    this.manager = new THREE.LoadingManager();
    if (onProgress) this.manager.onProgress = (_url, loaded, total) => onProgress(loaded, total);
    this.loader = new GLTFLoader(this.manager).setMeshoptDecoder(MeshoptDecoder);
    this.gltfs = new Map();
  }

  async loadAll(urls) {
    const unique = [...new Set(urls)].filter((url) => !this.gltfs.has(url));
    const loaded = await Promise.all(unique.map((url) => this.loader.loadAsync(url)));
    unique.forEach((url, i) => this.gltfs.set(url, loaded[i]));
  }

  get(url) {
    const gltf = this.gltfs.get(url);
    if (!gltf) throw new Error(`Model not loaded: ${url}`);
    return gltf;
  }
}

export function enableShadows(object, cast = true, receive = true) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}
