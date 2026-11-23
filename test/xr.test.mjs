// Headset locomotion and the quality profiles, without a headset: both are
// plain functions (js/xr/locomotion.js, js/quality.js).
import assert from 'node:assert/strict';
import { buildLayout, WORLD } from '../js/config.js';
import { pickQuality } from '../js/quality.js';
import { createPlayer } from '../js/player.js';
import { alignRig, createSnapTurn, headWorld, shapeStick, stepLocomotion, XR_COMFORT } from '../js/xr/locomotion.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const layout = buildLayout();
const idle = { moveX: 0, moveY: 0, turn: 0, brisk: false };
const start = { x: 3, y: 0, z: 0, theta: 0, level: null };

// --- stick shaping -----------------------------------------------------------
assert.deepEqual(shapeStick(0.1, 0.1), { x: 0, y: 0 }, 'a resting stick does not drift the player');
assert(near(Math.hypot(...Object.values(shapeStick(0, -1))), 1), 'full deflection is still full speed');
assert.deepEqual(shapeStick(NaN, 0), { x: 0, y: 0 });

const snap = createSnapTurn();
assert.deepEqual([0.2, 0.7, 0.9, 0.9, 0.5, 0.1, -0.8, -0.8, 0].map(snap), [0, 1, 0, 0, 0, 0, -1, 0, 0], 'one turn per flick, re-armed at rest');

// --- stick movement ----------------------------------------------------------
{
  // Facing +X (yaw -PI/2), stick pushed forward (y = -1) for one second.
  let state = start, rig = alignRig(start, { x: 0, z: 0 }, -Math.PI / 2);
  for (let i = 0; i < 20; i++) ({ state, rig } = stepLocomotion(layout, state, rig, { x: 0, z: 0, yaw: 0 }, { ...idle, moveY: -1 }, 0.05));
  assert(near(state.x - start.x, XR_COMFORT.walk, 1e-6), `forward stick walks at ${XR_COMFORT.walk} m/s (moved ${state.x - start.x})`);
  assert(near(rig.x, state.x) && near(rig.z, state.z), 'the play space travels with the body');
  assert(XR_COMFORT.walk < 3.8 && XR_COMFORT.brisk < 7, 'headset speeds stay under the desktop ones');
}
{
  // The stick follows where the head is looking, not where the rig points.
  const head = { x: 0, z: 0, yaw: Math.PI / 2 };
  const { state } = stepLocomotion(layout, start, alignRig(start, head, -Math.PI / 2), head, { ...idle, moveY: -1 }, 0.05);
  assert(near(state.x, start.x, 1e-6) && state.z < start.z, 'forward is the direction of the gaze');
}
{
  // Walls stop the stick: push outward from the ring wall of a closed level.
  const st = layout.stations[1];
  let state = { x: 22.5, y: st.y, z: 0, theta: st.theta, level: 1 }, rig = alignRig(state, { x: 0, z: 0 }, -Math.PI / 2);
  for (let i = 0; i < 60; i++) ({ state, rig } = stepLocomotion(layout, state, rig, { x: 0, z: 0, yaw: 0 }, { ...idle, moveY: -1, brisk: true }, 0.05));
  assert(state.x <= WORLD.landingR - WORLD.playerRadius + 1e-6, 'the outer wall blocks the stick');
  assert(near(rig.x, state.x), 'and the play space stops with the body');
}

// --- snap turn ---------------------------------------------------------------
{
  const head = { x: 0.4, z: -0.3, yaw: 0.2 };
  const rig = alignRig(start, head, 0);
  const before = headWorld(rig, head);
  const turned = stepLocomotion(layout, start, rig, head, { ...idle, turn: 1 }, 0.05);
  const after = headWorld(turned.rig, head);
  assert(near(turned.rig.yaw, -XR_COMFORT.snapAngle), 'stick right turns right');
  assert(near(before.x, after.x) && near(before.z, after.z), 'a snap turn pivots on the head, even off-centre in the room');
  assert(near(turned.state.x, start.x) && near(turned.state.z, start.z), 'turning does not move the body');
}

// --- real steps and leaning --------------------------------------------------
{
  // A real step on open floor: the body follows, the rig stays put.
  const rig = alignRig(start, { x: 0, z: 0 }, 0);
  const stepped = stepLocomotion(layout, start, rig, { x: 0.3, z: 0, yaw: 0 }, idle, 0.05);
  assert(near(stepped.state.x, 3.3) && near(stepped.rig.x, rig.x), 'walking in the room moves the body, not the world');
}
{
  // Leaning out over the shaft: the body cannot follow, the head may - up to
  // the slack - and beyond that the world is held back.
  const body = { x: WORLD.shaftR + WORLD.playerRadius + 0.01, y: 0, z: 0, theta: 0, level: null };
  const rig = alignRig(body, { x: 0, z: 0 }, 0);
  const lean = stepLocomotion(layout, body, rig, { x: -0.4, z: 0, yaw: 0 }, idle, 0.05);
  assert(lean.state.x >= WORLD.shaftR + WORLD.playerRadius - 1e-9, 'the body stays on the stair');
  assert(near(lean.rig.x, rig.x), 'leaning over the edge does not push the world away');
  const far = stepLocomotion(layout, body, rig, { x: -1.5, z: 0, yaw: 0 }, idle, 0.05);
  const head = headWorld(far.rig, { x: -1.5, z: 0 });
  assert(near(Math.hypot(head.x - far.state.x, head.z - far.state.z), XR_COMFORT.leanMax, 1e-6), 'walking out over the void is held at arm\'s length');
}

// --- the player in a session -------------------------------------------------
{
  const window = globalThis.window = new EventTarget();
  window.matchMedia = () => ({ matches: false });
  const document = globalThis.document = new EventTarget();
  document.exitPointerLock = () => {};
  const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } });
  const camera = { rotation: {}, position: vec() };
  const rig = { position: vec(), rotation: { y: 0 } };
  let head = { x: 0.5, y: 1.7, z: 0.2, yaw: 0 }, input = idle, steps = 0;
  const changes = [];
  const player = createPlayer({
    camera, rig, domElement: new EventTarget(), layout, initialState: { ...start, yaw: -Math.PI / 2 },
    xr: { readHead: () => head, readInput: () => input },
    onLockChange: (active) => changes.push(active), onFootstep: () => steps++,
  });
  assert.equal(player.enterXR(), true);
  assert.deepEqual(changes, [true], 'entering a session starts the game like capturing the mouse does');
  player.update(0.05);
  assert(near(player.getState().x, 3) && near(player.getState().z, 0), 'wherever you stand in the room, you start where the save left you');
  const at = headWorld({ x: rig.position.x, z: rig.position.z, yaw: rig.rotation.y }, head);
  assert(near(at.x, 3) && near(at.z, 0), 'the rig is lined up under the head');

  input = { ...idle, moveY: -1 };
  for (let i = 0; i < 20; i++) player.update(0.05);
  assert(player.getState().x > 5, 'the stick walks');
  assert(steps >= 3, 'and walking is heard');
  assert(near(rig.position.y, player.getState().y), 'the rig sits at floor height - the headset supplies eye height');

  const walked = { ...player.getState() };
  player.setSuspended(true);
  player.update(0.05);
  assert.deepEqual(player.getState(), walked, 'reading a record freezes the stick');
  player.setSuspended(false);

  // A recentre throws the head across the room in one frame.
  input = idle;
  head = { x: -2, y: 1.7, z: 3, yaw: 1 };
  player.update(0.05);
  assert(near(player.getState().x, walked.x) && near(player.getState().z, walked.z), 'a tracking recentre is not walked through the walls');

  const saved = player.snapshot();
  assert(near(saved.yaw, -Math.PI / 2 + 1) && saved.pitch === 0, 'a save taken in the headset records the gaze');
  player.exitXR();
  assert.deepEqual(changes, [true, false], 'leaving the session pauses');
  assert(rig.position.x === 0 && rig.position.z === 0 && rig.rotation.y === 0, 'the rig is back at the origin for the screen');
  player.update(0.05);
  assert(near(camera.position.x, walked.x) && near(camera.position.y, walked.y + WORLD.eyeHeight), 'and the screen camera picks up where the headset left off');
}

// --- quality profiles --------------------------------------------------------
const q = (query, ua = 'Mozilla/5.0 (Macintosh)') => pickQuality(new URLSearchParams(query), ua);
const QUEST = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 OculusBrowser/33.0 Chrome/126 VR Safari/537.36';
assert.deepEqual(q(''), { name: 'desktop', bloom: true, shadows: true, normalMaps: true, lights: 10, pixelRatio: 1.5, xrFrameRate: null, detail: 62 }, 'the desktop is untouched');
assert.equal(q('', QUEST).name, 'quest');
assert(q('', QUEST).lights < 10 && !q('', QUEST).shadows && !q('', QUEST).bloom, 'the headset gets the cheap per-pixel budget');
assert.equal(q('bloom=0').bloom, false);
assert.equal(q('shadows=0').shadows, false);
assert.equal(q('shadows=1&lights=6&hz=90', QUEST).shadows, true);
assert.equal(q('lights=6', QUEST).lights, 6);
assert.equal(q('hz=90', QUEST).xrFrameRate, 90);
assert.equal(q('lights=99').lights, 10);
assert.equal(q('quality=quest').name, 'quest');
assert.equal(q('quality=nonsense').name, 'desktop');
assert(q('', QUEST).detail < q('').detail, 'the headset draws the facades\' detail over fewer levels');
assert.equal(q('detail=5').detail, 10);

console.log('XR TESTS PASSED: stick shaping, snap turn, gaze-relative walking, walls, head-pivot turning, real steps, leaning, session handover, recentre, quality profiles');
