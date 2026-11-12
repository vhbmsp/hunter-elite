import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 400);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const NORMAL_FOV = 75;
const SCOPE_FOV = 18;
let targetFov = NORMAL_FOV;
let isScoped = false;

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
sun.position.set(50, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -60;
sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60;
sun.shadow.camera.bottom = -60;
scene.add(sun);

// Ground
const groundGeo = new THREE.PlaneGeometry(500, 500);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a5f0b, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Texture loader
const textureLoader = new THREE.TextureLoader();

// Animal definitions (PNG with transparency)
const animalTypes = [
  { name: 'rabbit', path: 'imagine_images/VHjkn.png', scale: 1.4, height: 0.7 },
  { name: 'deer', path: 'imagine_images/X1JXr.png', scale: 2.6, height: 1.5 },
  { name: 'bear', path: 'imagine_images/epMIo.png', scale: 3.0, height: 1.7 },
  { name: 'fox', path: 'imagine_images/zun6G.png', scale: 2.0, height: 1.0 }
];

const targets = [];

function createBillboard(texturePath, width, height) {
  const texture = textureLoader.load(texturePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);

  // Invisible sphere for reliable hit detection
  const hitGeo = new THREE.SphereGeometry(Math.max(width, height) * 0.0875, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    visible: true,
    transparent: true,
    opacity: 0.6
  });
  const hitbox = new THREE.Mesh(hitGeo, hitMat);
  mesh.add(hitbox);
  mesh.userData.hitbox = hitbox;

  return mesh;
}

// Create animals at different distances
for (let i = 0; i < 16; i++) {
  const type = animalTypes[i % animalTypes.length];
  const animal = createBillboard(type.path, type.scale * 1.6, type.scale);
  const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
  const dist = 30 + Math.random() * 120;
  const baseX = Math.cos(angle) * dist;
  const baseZ = Math.sin(angle) * dist;
  const baseY = type.height;

  animal.position.set(baseX, baseY, baseZ);
  animal.userData = {
    ...animal.userData, // keep hitbox
    hit: false,
    id: i,
    type: type.name,
    baseX, baseY, baseZ,
    state: 'idle',
    stateTimer: 1 + Math.random() * 4,
    speed: 0.8 + Math.random() * 2.5,
    direction: Math.random() * Math.PI * 2,
    velocity: new THREE.Vector3(),
    idleDuration: 0
  };

  scene.add(animal);
  targets.push(animal);
}

function updateAnimals(delta) {
  const now = performance.now();
  for (let i = targets.length - 1; i >= 0; i--) {
    const animal = targets[i];
    const d = animal.userData;

    // Remove dead animals after 5 seconds
    if (d.hit && d.deathTime && now - d.deathTime > 5000) {
      scene.remove(animal);
      animal.geometry.dispose();
      animal.material.dispose();
      targets.splice(i, 1);
      continue;
    }

    if (d.hit) continue;

    d.stateTimer -= delta;
    if (d.stateTimer <= 0) {
      // Switch state
      const roll = Math.random();
      if (roll < 0.35) {
        d.state = 'idle';
        d.stateTimer = 2 + Math.random() * 5;
        d.velocity.set(0, 0, 0);
      } else if (roll < 0.6) {
        d.state = 'sideways';
        d.stateTimer = 3 + Math.random() * 4;
        d.direction = Math.random() * Math.PI * 2;
      } else if (roll < 0.8) {
        d.state = 'run';
        d.stateTimer = 2 + Math.random() * 3;
        d.direction = Math.random() * Math.PI * 2;
      } else if (roll < 0.9) {
        d.state = 'approach';
        d.stateTimer = 4 + Math.random() * 3;
      } else {
        d.state = 'recede';
        d.stateTimer = 4 + Math.random() * 3;
      }
    }

    const speedMul = d.state === 'run' ? 2.2 : 1;
    const spd = d.speed * speedMul * delta;

    if (d.state === 'sideways' || d.state === 'run') {
      animal.position.x += Math.cos(d.direction) * spd * 8;
      animal.position.z += Math.sin(d.direction) * spd * 8;
    } else if (d.state === 'approach') {
      const dir = new THREE.Vector3(0, 0, 5).sub(animal.position).normalize();
      animal.position.addScaledVector(dir, spd * 6);
    } else if (d.state === 'recede') {
      const dir = animal.position.clone().sub(new THREE.Vector3(0, 0, 5)).normalize();
      animal.position.addScaledVector(dir, spd * 5);
    }

    // Keep roughly on ground level
    animal.position.y = d.baseY;

    // Billboard: only rotate around Y to face camera
    const dx = camera.position.x - animal.position.x;
    const dz = camera.position.z - animal.position.z;
    animal.rotation.y = Math.atan2(dx, dz);

    // Flip left/right based on movement direction
    if (d.state === 'sideways' || d.state === 'run') {
      const movingRight = Math.cos(d.direction) > 0;
      const absScale = Math.abs(animal.scale.x) || 1;
      animal.scale.x = movingRight ? absScale : -absScale;
    } else {
      animal.scale.x = Math.abs(animal.scale.x) || 1;
    }
  }
}

// Environment decorations
const treeTexture = textureLoader.load('imagine_images/x8soI.png');
treeTexture.colorSpace = THREE.SRGBColorSpace;
const bushTexture = textureLoader.load('imagine_images/IMPtR.png');
bushTexture.colorSpace = THREE.SRGBColorSpace;
const logTexture = textureLoader.load('imagine_images/NlAcS.png');
logTexture.colorSpace = THREE.SRGBColorSpace;

function addBillboard(texture, w, h, x, y, z) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.lookAt(0, y, 5);
  scene.add(mesh);
  return mesh;
}

// Trees
for (let i = 0; i < 25; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 25 + Math.random() * 150;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const scale = 4 + Math.random() * 6;
  addBillboard(treeTexture, scale * 0.7, scale, x, scale * 0.45, z);
}

// Bushes
for (let i = 0; i < 30; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 15 + Math.random() * 100;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const scale = 1.5 + Math.random() * 2.5;
  addBillboard(bushTexture, scale * 1.4, scale, x, scale * 0.4, z);
}

// Logs
for (let i = 0; i < 12; i++) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * 80;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;
  const log = addBillboard(logTexture, 3.5, 0.8, x, 0.4, z);
  log.rotation.y = Math.random() * Math.PI;
}

// Controls
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

const instructions = document.getElementById('instructions');
const crosshair = document.getElementById('crosshair');
const scope = document.getElementById('scope');
document.addEventListener('click', () => {
  unlockAudio();
  if (!controls.isLocked) controls.lock();
});

controls.addEventListener('lock', () => {
  instructions.style.opacity = '0.3';
});
controls.addEventListener('unlock', () => {
  instructions.style.opacity = '0.7';
});

// Audio
let audioCtx = null;

function unlockAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playShootSound() {
  unlockAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.07);
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.1);

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.06);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.45, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
  noise.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now);
}

function playDeathSound() {
  unlockAudio();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.32);

  const bufferSize = Math.floor(audioCtx.sampleRate * 0.18);
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
  noise.connect(noiseGain);
  noiseGain.connect(audioCtx.destination);
  noise.start(now);
}
// Shooting
const raycaster = new THREE.Raycaster();
let score = 0;
const scoreEl = document.getElementById('score');
const distanceEl = document.getElementById('distance');
const zoomEl = document.getElementById('zoom');

function shoot() {
  playShootSound();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  // Only hit the invisible/visible hitbox spheres
  const hitboxes = targets
    .filter(a => a.userData.hitbox && !a.userData.hit)
    .map(a => a.userData.hitbox);

  const intersects = raycaster.intersectObjects(hitboxes, false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const animal = hit.object.parent;
    if (animal && animal.userData && !animal.userData.hit) {
      animal.userData.hit = true;
      animal.userData.deathTime = performance.now();
      animal.material.opacity = 0.4;
      animal.material.color.set(0x555555);
      playDeathSound();
      score += Math.round(80 + (100 - Math.min(hit.distance, 100)));
      scoreEl.textContent = `Score: ${score}`;
      distanceEl.textContent = `Distance: ${hit.distance.toFixed(1)}m`;
      console.log('Hit confirmed on hitbox');
    }
  } else {
    distanceEl.textContent = 'Distance: —';
    console.log('Missed hitbox');
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    shoot();
  }
  if (e.code === 'KeyT') {
    const show = !targets[0]?.userData.hitbox?.material.visible;
    targets.forEach(animal => {
      if (animal.userData.hitbox) {
        animal.userData.hitbox.material.visible = show;
      }
    });
    console.log('Hitbox debug:', show ? 'ON' : 'OFF');
  }
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0 && controls.isLocked) shoot();
  if (e.button === 2 && controls.isLocked) {
    isScoped = true;
    targetFov = SCOPE_FOV;
    scope.classList.add('active');
    crosshair.classList.add('hidden');
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 2) {
    isScoped = false;
    targetFov = NORMAL_FOV;
    scope.classList.remove('active');
    crosshair.classList.remove('hidden');
  }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// Smooth FOV zoom
function updateScope() {
  camera.fov += (targetFov - camera.fov) * 0.15;
  camera.updateProjectionMatrix();

  const zoomFactor = (NORMAL_FOV / camera.fov).toFixed(1);
  zoomEl.textContent = `Zoom: ${zoomFactor}x`;
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animate
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  updateAnimals(delta);
  updateScope();
  renderer.render(scene, camera);
}
animate();

console.log('Hunter Elite — Three.js game ready');
