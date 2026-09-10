import * as THREE from "three";
import { buildLayout } from "./config.js";
import { buildWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { initHud } from "./hud.js";
import { createAudio } from "./audio.js";
import { describeLocation } from "./collision.js";

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6c7680, 2.5, 70);
scene.background = scene.fog.color;

const ambient = new THREE.AmbientLight(0x8f97a0, 0.75);
scene.add(ambient);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 160);

const layout = buildLayout();
const { interactables } = buildWorld(scene, layout);

const hud = initHud();
const audio = createAudio();

const player = createPlayer({
  camera,
  domElement: renderer.domElement,
  layout,
  initialState: { x: 3.0, y: 0, z: 0, theta: 0, yaw: -Math.PI / 2 },
  onLockChange: handleLockChange,
  onFootstep: () => audio.footstep(),
});

let started = false;
function handleLockChange(locked) {
  if (locked) {
    started = true;
    hud.hideStart();
    hud.setPaused(false);
  } else if (started) {
    hud.setPaused(true);
  }
}

hud.showStart(() => {
  audio.ensureContext();
  player.requestLock();
});

const pauseScreen = document.getElementById("pause-screen");
pauseScreen.addEventListener("click", () => player.requestLock());

// --- Interaction (lore panel) raycast, always from the center of the screen ---
const raycaster = new THREE.Raycaster();
raycaster.far = 3.4;
const screenCenter = new THREE.Vector2(0, 0);
const interactableMeshes = interactables.map((entry) => entry.mesh);
let lookedAt = null;

function updateInteraction() {
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  raycaster.setFromCamera(screenCenter, camera);
  const hits = raycaster.intersectObjects(interactableMeshes, false);
  lookedAt = hits.length > 0 ? interactables.find((entry) => entry.mesh === hits[0].object) : null;
  hud.setInteractVisible(Boolean(lookedAt) && !hud.isLoreOpen());
}

window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyE") return;
  if (hud.isLoreOpen()) {
    hud.hideLore();
    return;
  }
  if (lookedAt) {
    hud.showLore(lookedAt.station);
    audio.interact();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const topY = layout.stations[0].y;
const bottomY = layout.stations[layout.stations.length - 1].y;
const tmpColor = new THREE.Color();

let lastTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  player.update(dt);
  const state = player.getState();

  const info = describeLocation(layout, state.theta);
  hud.setLocation(info);
  hud.setDepth((topY - state.y) / (topY - bottomY));

  tmpColor.set(info.fog);
  scene.fog.color.lerp(tmpColor, 0.06);
  tmpColor.set(info.light);
  ambient.color.lerp(tmpColor, 0.06);

  updateInteraction();

  renderer.render(scene, camera);
}

animate();
