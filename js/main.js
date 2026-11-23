import * as THREE from "three";
import { createProgress, createSaveStore, STEPS } from "./progress.js";
import { buildLayout, setWingCount, WING_OFFSETS, WORLD } from "./config.js";
import { buildWorld } from "./world/index.js";
import { createPlayer } from "./player.js";
import { initHud, levelLabels } from "./hud.js";
import { createAudio } from "./audio.js";
import { canStand, describeLocation } from "./collision.js";
import { getViewpoint } from "./viewpoints.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { pickQuality } from "./quality.js";
import { createXRSession, xrSupported } from "./xr/session.js";
import { createVignette, createXRHud } from "./xr/hud.js";

// Debug/diagnostic switches, all off by default (see README):
//   ?view=<name>  park the camera at a fixed viewpoint
//   ?hud=0        hide the interface
//   ?bloom=0      skip the bloom pass (headless capture is far faster)
//   ?wings=N      rebuild each floor with N corridors
//   ?stats=1      log the scene's cost once
//   ?quality=, ?shadows=, ?lights=, ?normals=, ?hz=   see js/quality.js
const params = new URLSearchParams(window.location.search);
const quality = pickQuality(params, navigator.userAgent);

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Exposure is the cleanest overall brightness dial: ACES rolls the
// highlights off gracefully, so raising it lifts the image without
// flattening the contrast the way more flat ambient light would.
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x55574f, 18, 125);
scene.background = scene.fog.color;

// A flat ambient term this strong washes out every surface - it was the main
// reason the concrete read as painted cardboard. Most of the fill now comes
// from a hemisphere light (brighter overhead than underfoot), which gives
// surfaces a direction to respond to even away from the point lights.
const ambient = new THREE.AmbientLight(0xaeb2b5, 0.3);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xb9c5ca, 0x34383b, 1.15);
scene.add(hemi);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.08, 160);

renderer.shadowMap.enabled = quality.shadows;

// Bloom makes the emissive fixtures (lit windows, tube lights, the
// generator core) read as actual light sources instead of flat bright
// rectangles. Threshold is high so only genuinely hot surfaces bloom -
// concrete must not glow.
const useBloom = quality.bloom;
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.23, 0.45, 1.05);
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
const world = buildWorld(scene, layout, { lightCount: quality.lights, detailRange: quality.detail });
const { interactables } = world;
// Normal maps are generated either way; dropping them here, before anything
// has been drawn, keeps them off the GPU and out of the shaders entirely.
if (!quality.normalMaps) {
  scene.traverse((object) => {
    for (const material of [object.material].flat()) if (material?.normalMap) material.normalMap = null;
  });
}
const buildMs = performance.now() - buildStart;

// The camera hangs from a rig rather than sitting in the scene directly. On a
// screen the rig stays at the origin and changes nothing; in a headset the
// device owns the camera's pose and the rig is what the player moves.
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

const hud = initHud();
const audio = createAudio();

const viewpoint = params.has("view") ? getViewpoint(params.get("view"), layout) : null;
if (params.get("hud") === "0") {
  for (const id of ["hud", "start-screen", "pause-screen"]) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }
}

const diagnostic = params.has("view") || params.has("wings");
const saveStore = createSaveStore(() => window.localStorage, layout, 'layout-148-v1');
const loaded = diagnostic ? {} : saveStore.load();
const progress = createProgress(loaded.save?.progress);
let saveProtected = Boolean(loaded.error);
for(const entry of interactables)if(entry.isDoor)entry.setOpen(loaded.save?.progress.doors?.[entry.id] || false);
// A save from the old residential room may overlap a new partition/furniture.
// Keep discoveries and orientation; relocate only obstructed positions.
let restoredAtSafePoint=false;
if(loaded.save) {
  const p=loaded.save.player,st=layout.stations[p.level];
  if(st?.id==='residencial' && st.obstacles.some(o=>{
    const x=p.x*Math.cos(o.angle)+p.z*Math.sin(o.angle)-o.x;
    const z=-p.x*Math.sin(o.angle)+p.z*Math.cos(o.angle)-o.z;
    return Math.hypot(Math.max(0,Math.abs(x)-o.hw),Math.max(0,Math.abs(z)-o.hd))<.35;
  })) {
    const a=st.wingRotation+WING_OFFSETS[0];
    Object.assign(p,{x:32*Math.cos(a),z:32*Math.sin(a),y:st.y,theta:st.theta});
    restoredAtSafePoint=true;
  }
}

const vignette = params.get("vignette") === "0" ? null : createVignette(camera);
let xrHud = null;
const xr = createXRSession({
  renderer,
  camera,
  rig,
  frameRate: quality.xrFrameRate,
  onStart: () => {
    // Built on first use: a desktop player never pays for the panels.
    xrHud ||= createXRHud({ scene, camera });
    xrHud.setVisible(true);
    // The page is not visible inside the headset, but it is on a monitor
    // mirroring a tethered one - where the flat HUD would sit across both eyes.
    document.body.classList.add("in-headset");
    lastProgressUI = "";
    updateProgressUI();
    xrHud.setLevel(levelLabels(describeLocation(layout, player.getState().theta, player.getState().level)));
    xrHud.setNotice("Progresso salvo automaticamente");
    if (!player.enterXR()) xr.exit();
  },
  onEnd: () => {
    xrHud?.setVisible(false);
    document.body.classList.remove("in-headset");
    vignette?.reset();
    player.exitXR();
    renderDirty = true;
  },
  onSelect: () => interact(),
  // The headset's system menu is open, or it has been taken off.
  onVisibility: (visible) => audio.setPaused(!visible),
});

// A save from an older layout can sit inside what is now a wall, where no step
// leads out. Keep everything else about it and stand the player on that
// level's ring, beside the landing.
if (loaded.save && !canStand(layout, loaded.save.player)) {
  const p = loaded.save.player;
  const st = layout.stations[p.level] || layout.stations.reduce((best, s) => (Math.abs(s.y - p.y) < Math.abs(best.y - p.y) ? s : best));
  Object.assign(p, { x: 19.5 * Math.cos(st.theta + 0.35), z: 19.5 * Math.sin(st.theta + 0.35), y: st.y, theta: st.theta, level: st.index });
  restoredAtSafePoint = true;
}

const player = createPlayer({
  camera,
  rig,
  xr,
  domElement: renderer.domElement,
  layout,
  initialState: viewpoint || loaded.save?.player || { x: 3.0, y: 0, z: 0, theta: 0, level: null, yaw: -Math.PI / 2 },
  frozen: Boolean(viewpoint),
  onLockChange: handleLockChange,
  onLockError: () => hud.setStatus("Não foi possível capturar o mouse. Clique em entrar para tentar novamente."),
  onFootstep: () => audio.footstep(),
});

let started = false;
function handleLockChange(locked) {
  audio.setPaused(!locked);
  if (locked) {
    started = true;
    hud.hideStart();
    hud.setPaused(false);
  } else if (started) {
    hud.hideLore();
    xrHud?.hideRecord();
    player.setSuspended(false);
    hud.setPaused(true);
    saveProgress(false);
  }
}

hud.showStart(() => {
  audio.ensureContext();
  player.requestLock();
});

// The headset entrance, offered only where a session can actually start. A
// fixed viewpoint has no body to put in one.
async function enterHeadset() {
  audio.ensureContext();
  try { await xr.enter(); }
  catch (error) {
    console.warn("[silo] sessão imersiva recusada", error);
    hud.setStatus("Não foi possível iniciar a sessão no óculos. Tente novamente.");
  }
}
if (!viewpoint) xrSupported().then((supported) => {
  if (!supported) return;
  for (const id of ["vr-button", "vr-resume-button"]) {
    const button = document.getElementById(id);
    button.hidden = false;
    button.addEventListener("click", enterHeadset);
  }
  document.getElementById("vr-hint").hidden = false;
  // In the headset's own browser the session is the way in, not the extra.
  if (quality.name === "quest") {
    document.getElementById("vr-button").classList.remove("secondary");
    document.getElementById("start-button").classList.add("secondary");
  }
});

if (loaded.save) {
  document.getElementById('start-button').textContent = 'Continuar exploração →';
  hud.setStatus('Progresso de ' + new Date(loaded.save.savedAt).toLocaleString('pt-BR') + (restoredAtSafePoint ? ' · posição ajustada para um ponto seguro do nível' : ' · salvo neste navegador'));
} else if (loaded.error) hud.setStatus(loaded.error);

let lastProgressUI = '';
function updateProgressUI() {
  const data=progress.snapshot(), key=JSON.stringify(data);
  if(key===lastProgressUI)return;
  lastProgressUI=key;
  const next=STEPS.find(s=>!data.completed.includes(s.id));
  document.getElementById('mission-summary').textContent=next ? `${data.completed.length}/${STEPS.length} · ${next.title}` : 'Missão concluída · continue explorando';
  xrHud?.setMission(next ? `${data.completed.length}/${STEPS.length} · ${next.title}` : 'Missão concluída · continue explorando');
  document.getElementById('mission-hint').textContent=next?.hint || 'Explore os apartamentos e serviços do nível 28. Nas portas, use E para abrir ou fechar.';
  document.getElementById('mission-steps').replaceChildren(...STEPS.map(s=>{
    const li=document.createElement('li'),done=data.completed.includes(s.id);
    li.textContent=`${done?'✓':s===next?'→':'○'} ${s.title}`;
    li.className=done?'done':s===next?'current':'';
    if(s===next)li.setAttribute('aria-current','step');
    return li;
  }));
}
function saveProgress(manual=false) {
  if(diagnostic || !started)return;
  if(saveProtected && !manual)return;
  // A failed/corrupt load is preserved until an explicit manual save.
  if(saveProtected && !window.confirm('Substituir o progresso que não pôde ser carregado pela partida atual?'))return;
  const result=saveStore.save(player.snapshot(),progress.snapshot());
  const message=result.error || `Progresso salvo às ${new Date(result.save.savedAt).toLocaleTimeString('pt-BR')}`;
  document.getElementById('save-notice').textContent=message+' · P para salvar';
  xrHud?.setNotice(message);
  document.getElementById('pause-status').textContent=message;
  if(!result.error)saveProtected=false;
}
updateProgressUI();
document.getElementById('save-button').addEventListener('click',()=>saveProgress(true));
window.setInterval(()=>{if(player.isActive())saveProgress(false);},30000);
window.addEventListener('pagehide',()=>saveProgress(false));

const pauseScreen = document.getElementById("resume-button");
pauseScreen.addEventListener("click", () => player.requestLock());

// --- Interaction (lore panel) raycast, always from the center of the screen ---
const raycaster = new THREE.Raycaster();
raycaster.far = 3.4;
const screenCenter = new THREE.Vector2(0, 0);
const interactableMeshes = interactables.map((entry) => entry.mesh);
let lookedAt = null;

const hitPoint = new THREE.Vector3();
function updateInteraction() {
  // Called right after renderer.render(), so the scene graph and camera
  // matrices are already current for this frame - no need to update them
  // again here (the world is static, and re-walking the whole graph every
  // frame just to raycast 10 planes was wasted CPU work).
  //
  // On a screen the ray leaves the centre of the view; in a headset it leaves
  // the pointing hand.
  const hand = player.isPresenting() ? xr.pointer() : null;
  const aimed = player.isPresenting() ? Boolean(hand) : true;
  if (hand) raycaster.setFromXRController(hand);
  else raycaster.setFromCamera(screenCenter, camera);
  if (!aimed || !player.isActive() || hud.isLoreOpen()) {
    hud.setInteractVisible(false);
    lookedAt = null;
    xr.beam.scale.z = 1.2;
    xrHud?.setPrompt(null);
    return;
  }
  const hits = raycaster.intersectObjects(interactableMeshes, false);
  const hit = hits[0];
  // A plaque behind a corridor wall must not be readable through that wall.
  const front = hit ? raycaster.intersectObjects(hit.object.parent.children, true)[0] : null;
  lookedAt = hit && front?.object === hit.object ? interactables.find((entry) => entry.mesh === hit.object) : null;
  hud.setInteractVisible(Boolean(lookedAt) && !hud.isLoreOpen());
  const label = lookedAt?.prompt?.() || "[E] examinar registro";
  document.getElementById("interact-prompt").textContent = label;
  if (lookedAt) hitPoint.copy(hit.point);
  xr.beam.scale.z = lookedAt ? hit.distance : 1.2;
  xr.beam.material.opacity = lookedAt ? 0.9 : 0.35;
  xrHud?.setPrompt(lookedAt ? label.replace(/^\[E\]\s*/, "Gatilho · ") : null, hitPoint);
}

// The one action in the game: [E] on a keyboard, the trigger on a controller.
function interact() {
  if (!player.isActive()) return;
  if (hud.isLoreOpen()) {
    hud.hideLore();
    xrHud?.hideRecord();
    player.setSuspended(false);
    return;
  }
  if (lookedAt?.action) {
    if(!lookedAt.action(player.getState())) {
      document.getElementById('save-notice').textContent='Afaste-se da passagem para mover a porta.';
      xrHud?.setNotice('Afaste-se da passagem para mover a porta.');
      return;
    }
    progress.door(lookedAt.id,lookedAt.getOpen());saveProgress(false);audio.interact();
    return;
  }
  if (lookedAt) {
    hud.showLore(lookedAt.station);
    xrHud?.showRecord(`${lookedAt.station.name} · Nível ${lookedAt.station.level}`, lookedAt.station.lore, hitPoint);
    if(progress.read(lookedAt.station.id)){updateProgressUI();saveProgress(false);}
    player.setSuspended(true);
    audio.interact();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyP" && !e.repeat && started) { e.preventDefault(); saveProgress(true); }
  if (e.code === "KeyM" && !e.repeat && player.isActive()) audio.toggleMuted();
  if (e.code === "KeyE" && !e.repeat) interact();
});

window.addEventListener("silo:asset-ready", () => { renderDirty = true; });

window.addEventListener("resize", () => {
  // The headset owns the framebuffer while a session is running.
  if (renderer.xr.isPresenting) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  if (useBloom) bloom.setSize(window.innerWidth, window.innerHeight);
  renderDirty = true;
});

const topY = layout.stations[0].y;
const bottomY = layout.stations[layout.stations.length - 1].y;
const tmpColor = new THREE.Color();
// Cool, like the concrete (CONCRETE in config.js). These were olive, and every
// level's haze and fill light drifted that way with them.
const hazeNeutral = new THREE.Color(0x40464c);
const lightNeutral = new THREE.Color(0xbfc5ca);

let lastTime = performance.now();
let frameCount = 0;
let renderDirty = true;
const eye = new THREE.Vector3();
// Driven by renderer.setAnimationLoop rather than requestAnimationFrame: inside
// a headset session the frames come from the device, not from the window.
function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const presenting = renderer.xr.isPresenting;
  if (!player.isActive() && !presenting && !renderDirty && frameCount >= 8) return;
  renderDirty = false;
  const motion = player.update(dt);
  const state = player.getState();
  // World position, not camera.position: in a headset that is only the
  // head's offset inside the rig.
  world.update(camera.getWorldPosition(eye), dt);
  if (presenting) vignette?.update(motion.travel || 0, dt);
  if(started && !diagnostic) {
    let changed=false;
    if(state.level===0 && Math.hypot(state.x,state.z)>=16) changed=progress.complete('gallery') || changed;
    const a=(layout.stations[0].wingRotation||0)+WING_OFFSETS[0];
    const x=state.x*Math.cos(a)+state.z*Math.sin(a),z=-state.x*Math.sin(a)+state.z*Math.cos(a);
    // Within a few metres of the screen on the cafeteria's far wall.
    const far=WORLD.landingR+WORLD.corridorLen+layout.stations[0].roomDepth;
    if(state.level===0 && x>far-7 && Math.abs(z)<6)changed=progress.complete('screen') || changed;
    if(changed){updateProgressUI();saveProgress(false);}
  }

  const info = describeLocation(layout, state.theta, state.level);
  const labels = hud.setLocation(info);
  if (labels) xrHud?.setLevel(labels);
  hud.setDepth((topY - state.y) / (topY - bottomY));

  // The zone fog colours double as the background/haze, so they get lifted
  // a little - at their raw values the depths turn into a black hole.
  const ease = viewpoint || !player.isActive() ? 1 : 1 - Math.exp(-dt * 4); // screenshots shouldn't wait for the colour fade
  tmpColor.set(info.fog).lerp(hazeNeutral, 0.65);
  scene.fog.color.lerp(tmpColor, ease);
  tmpColor.set(info.light).lerp(lightNeutral, 0.75);
  ambient.color.lerp(tmpColor, ease);
  hemi.color.lerp(tmpColor, ease);
  tmpColor.set(info.fog).multiplyScalar(0.5);
  hemi.groundColor.lerp(tmpColor, ease);

  if (wantStats) renderer.info.reset();
  // Post-processing renders to an offscreen target, which a headset session
  // cannot display; there the scene goes straight to the device, and bloom is
  // far beyond a mobile GPU's budget at that resolution anyway.
  if (presenting) {
    xrHud?.update(xr.offHand());
    renderer.render(scene, camera);
  } else composer.render();
  updateInteraction();
  frameCount++;
  if (wantStats && frameCount === 8) {
    let objects = 0;
    scene.traverse(() => objects++);
    console.log(
      `[silo] build=${buildMs.toFixed(0)}ms objects=${objects} calls=${renderer.info.render.calls} ` +
        `tris=${renderer.info.render.triangles} textures=${renderer.info.memory.textures}`
    );
  }
}

renderer.setAnimationLoop(animate);

// Module exports support browser regression checks without a global debug API.
export { player, hud, layout, camera, renderer, scene, progress, world, quality, rig, xr };
