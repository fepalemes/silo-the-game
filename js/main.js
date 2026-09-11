import * as THREE from "three";
import { buildLayout, setWingCount } from "./config.js";
import { buildWorld } from "./world.js";
import { createPlayer } from "./player.js";
import { initHud } from "./hud.js";
import { createAudio } from "./audio.js";
import { describeLocation } from "./collision.js";
import { getViewpoint } from "./viewpoints.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Exposure is the cleanest overall brightness dial: ACES rolls the
// highlights off gracefully, so raising it lifts the image without
// flattening the contrast the way more flat ambient light would.
renderer.toneMappingExposure = 1.55;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6c7680, 3, 78);
scene.background = scene.fog.color;

// A flat ambient term this strong washes out every surface - it was the main
// reason the concrete read as painted cardboard. Most of the fill now comes
// from a hemisphere light (brighter overhead than underfoot), which gives
// surfaces a direction to respond to even away from the point lights.
const ambient = new THREE.AmbientLight(0x8f97a0, 0.5);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x9fb0bd, 0x3a352e, 1.45);
scene.add(hemi);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 160);

// Debug/diagnostic switches, all off by default (see README):
//   ?view=<name>  park the camera at a fixed viewpoint
//   ?hud=0        hide the interface
//   ?bloom=0      skip the bloom pass (headless capture is far faster)
//   ?wings=N      rebuild each floor with N corridors
//   ?stats=1      log the scene's cost once
const params = new URLSearchParams(window.location.search);

// Bloom makes the emissive fixtures (lit windows, tube lights, the
// generator core) read as actual light sources instead of flat bright
// rectangles. Threshold is high so only genuinely hot surfaces bloom -
// concrete must not glow.
const useBloom = params.get("bloom") !== "0";
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.92);
if (useBloom) composer.addPass(bloom);
composer.addPass(new OutputPass());

// ?wings=N rebuilds each floor with N corridors instead of the default,
// for measuring what denser floors actually cost before committing to them.
const wingParam = Number(params.get("wings"));
if (Number.isFinite(wingParam) && wingParam > 0) setWingCount(wingParam);

// ?stats=1 logs the scene's cost once, a few frames in. Performance here is
// dominated by build time and object count, not by how big the world is -
// see the notes in the README.
const wantStats = params.get("stats") === "1";
if (wantStats) renderer.info.autoReset = false; // the composer resets it per pass

const buildStart = performance.now();
const layout = buildLayout();
const { interactables } = buildWorld(scene, layout);
const buildMs = performance.now() - buildStart;

const hud = initHud();
const audio = createAudio();

const viewpoint = params.has("view") ? getViewpoint(params.get("view"), layout) : null;
if (params.get("hud") === "0") {
  for (const id of ["hud", "start-screen", "pause-screen"]) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }
}

const player = createPlayer({
  camera,
  domElement: renderer.domElement,
  layout,
  initialState: viewpoint || { x: 3.0, y: 0, z: 0, theta: 0, yaw: -Math.PI / 2 },
  frozen: Boolean(viewpoint),
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
  // Called right after renderer.render(), so the scene graph and camera
  // matrices are already current for this frame - no need to update them
  // again here (the world is static, and re-walking the whole graph every
  // frame just to raycast 10 planes was wasted CPU work).
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
  composer.setSize(window.innerWidth, window.innerHeight);
  if (useBloom) bloom.setSize(window.innerWidth, window.innerHeight);
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

  // The zone fog colours double as the background/haze, so they get lifted
  // a little - at their raw values the depths turn into a black hole.
  const ease = viewpoint ? 1 : 0.06; // screenshots shouldn't wait for the colour fade
  tmpColor.set(info.fog).multiplyScalar(1.35);
  scene.fog.color.lerp(tmpColor, ease);
  tmpColor.set(info.light);
  ambient.color.lerp(tmpColor, ease);
  hemi.color.lerp(tmpColor, ease);
  tmpColor.set(info.fog).multiplyScalar(0.5);
  hemi.groundColor.lerp(tmpColor, ease);

  if (wantStats) renderer.info.reset();
  composer.render();
  updateInteraction();
  if (wantStats && renderer.info.render.frame === 8) {
    let objects = 0;
    scene.traverse(() => objects++);
    console.log(
      `[silo] build=${buildMs.toFixed(0)}ms objects=${objects} calls=${renderer.info.render.calls} ` +
        `tris=${renderer.info.render.triangles} textures=${renderer.info.memory.textures}`
    );
  }
}

animate();
