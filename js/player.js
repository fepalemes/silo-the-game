import { PLAYER_SPEED, WORLD } from "./config.js";
import { resolveMove } from "./collision.js";
import { clamp } from "./mathutils.js";
import { alignRig, createHeightGuard, stepLocomotion, XR_COMFORT } from "./xr/locomotion.js";

const MAX_PITCH = 1.5;

const IDLE = { moveX: 0, moveY: 0, turn: 0, brisk: false };

// First-person controller. Movement/collision math lives in collision.js; this
// module only owns input, camera orientation and head-bob/footsteps.
//
// It drives one of two bodies. On a screen it is a pointer-lock FPS camera. In
// a headset (`rig` + `xr`, see js/xr/session.js) the headset owns the camera,
// so what moves instead is `rig`, the group the camera hangs from - and there
// is no eye height, pitch or head-bob to apply, because the player's own neck
// supplies all three.
export function createPlayer({ camera, domElement, layout, initialState, onLockChange, onFootstep, onLockError, frozen = false, rig = null, xr = null }) {
  const state = { level: null, ...initialState };
  let yaw = initialState.yaw ?? -Math.PI / 2;
  let pitch = initialState.pitch ?? 0;
  let locked = false;
  let bobPhase = 0;
  let lastStepIndex = 0;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const keys = Object.create(null);

  let suspended = false;
  let presenting = false;
  let pose = { x: 0, z: 0, yaw: 0 };
  let lastHead = null;
  let strideLeft = XR_COMFORT.stride;
  const height = createHeightGuard({ standing: WORLD.eyeHeight });
  let fastXR = false;
  // Seated needs a head pose to measure from; held until the first one.
  let pendingSeated = null;
  // "Active" is what the rest of the game means by playing: the mouse is
  // captured, or a headset session is running. Reported on change only, so
  // handing over from one to the other does not flash the pause screen.
  let reported = false;
  const isActive = () => locked || presenting;
  function report() {
    if (isActive() === reported) return;
    reported = isActive();
    if (onLockChange) onLockChange(reported);
  }
  function clearKeys() { for (const key of Object.keys(keys)) delete keys[key]; }
  function onKeyDown(e) {
    if (!locked || suspended || e.repeat) return;
    keys[e.code] = true;
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }
  function onMouseMove(e) {
    if (!locked || suspended) return;
    yaw -= e.movementX * PLAYER_SPEED.mouseSensitivity;
    pitch = clamp(pitch - e.movementY * PLAYER_SPEED.mouseSensitivity, -MAX_PITCH, MAX_PITCH);
  }
  function onPointerLockChange() {
    locked = document.pointerLockElement === domElement;
    clearKeys();
    report();
  }

  function requestLock() {
    if (frozen || locked || presenting) return;
    try {
      const request = domElement.requestPointerLock();
      request?.catch(() => onLockError?.());
    } catch { onLockError?.(); }
  }
  domElement.addEventListener("click", requestLock);
  document.addEventListener("pointerlockerror", () => onLockError?.());
  window.addEventListener("blur", clearKeys);
  document.addEventListener("visibilitychange", () => {
    clearKeys();
    if (document.hidden && locked) document.exitPointerLock();
  });
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  camera.rotation.order = "YXZ";

  function enterXR() {
    if (frozen || presenting || !rig || !xr) return false;
    presenting = true;
    // The head pose is not known until the first frame arrives; the rig is
    // lined up under it then (see updateXR).
    lastHead = null;
    pose = { x: state.x, z: state.z, yaw };
    strideLeft = XR_COMFORT.stride;
    clearKeys();
    if (locked) document.exitPointerLock();
    report();
    return true;
  }

  function exitXR() {
    if (!presenting) return;
    presenting = false;
    // Keep facing wherever the player was last looking.
    yaw = pose.yaw + (lastHead?.yaw || 0);
    pitch = 0;
    rig.position.set(0, 0, 0);
    rig.rotation.y = 0;
    clearKeys();
    report();
  }

  function updateXR(dt) {
    const head = xr.readHead();
    if (pendingSeated !== null) { height.setSeated(pendingSeated, head.y); pendingSeated = null; }
    const recentred = lastHead && Math.hypot(head.x - lastHead.x, head.z - lastHead.z) > XR_COMFORT.recentreJump;
    if (!lastHead || recentred) pose = alignRig(state, head, pose.yaw);
    lastHead = head;

    // A record being read freezes the stick, never the head.
    const input = suspended ? IDLE : xr.readInput();
    const tune = fastXR ? { ...XR_COMFORT, walk: XR_COMFORT.walk * XR_COMFORT.fast, brisk: XR_COMFORT.brisk * XR_COMFORT.fast } : XR_COMFORT;
    const result = stepLocomotion(layout, state, pose, head, input, dt, tune);
    Object.assign(state, result.state);
    pose = result.rig;
    rig.position.set(pose.x, state.y + height.update(head.y, dt), pose.z);
    rig.rotation.y = pose.yaw;

    const moving = result.walked > 1e-4;
    if (moving) {
      strideLeft -= result.walked;
      if (strideLeft <= 0) {
        strideLeft += XR_COMFORT.stride;
        if (onFootstep) onFootstep();
      }
    } else strideLeft = XR_COMFORT.stride;
    return { moving, sprinting: Boolean(input.brisk), travel: moving ? Math.min(1, Math.hypot(input.moveX, input.moveY)) : 0 };
  }

  function update(dt) {
    if (presenting) return updateXR(dt);
    // Debug viewpoints park the camera somewhere (possibly mid-air, over the
    // void) and skip collision entirely - see js/viewpoints.js.
    if (frozen) {
      camera.position.set(state.x, state.y, state.z);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
      return { moving: false, sprinting: false };
    }

    const forwardInput = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const rightInput = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const sprinting = Boolean(keys.ShiftLeft || keys.ShiftRight);
    const speed = sprinting ? PLAYER_SPEED.sprint : PLAYER_SPEED.walk;

    let dx = 0;
    let dz = 0;
    if (locked && !suspended && (forwardInput || rightInput)) {
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      let vx = fx * forwardInput + rx * rightInput;
      let vz = fz * forwardInput + rz * rightInput;
      const len = Math.hypot(vx, vz);
      if (len > 1e-6) {
        dx = (vx / len) * speed * dt;
        dz = (vz / len) * speed * dt;
      }
    }

    const oldX = state.x, oldZ = state.z;
    const next = resolveMove(layout, state, dx, dz);
    state.x = next.x;
    state.y = next.y;
    state.z = next.z;
    state.theta = next.theta;
    // Which ring floor the player is standing on, or null on the stair. Part
    // of the state because 148 rings share the same radius and only the route
    // taken says which one you are on.
    state.level = next.level;

    const moving = Math.hypot(state.x - oldX, state.z - oldZ) > 0.0001;
    if (moving) {
      bobPhase += dt * (sprinting ? 11 : 8);
      const stepIndex = Math.floor(bobPhase / Math.PI);
      if (stepIndex !== lastStepIndex) {
        lastStepIndex = stepIndex;
        if (onFootstep) onFootstep();
      }
    } else {
      bobPhase = 0;
      lastStepIndex = 0;
    }
    const bob = moving && !reducedMotion ? Math.sin(bobPhase) * 0.035 : 0;

    camera.position.set(state.x, state.y + WORLD.eyeHeight + bob, state.z);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    return { moving, sprinting };
  }

  return {
    update,
    isLocked: () => locked,
    isActive,
    isPresenting: () => presenting,
    enterXR,
    exitXR,
    requestLock,
    setSuspended: (value) => { suspended = value; clearKeys(); },
    // Headset comfort, from the in-headset menu (js/main.js).
    trackingReset: () => height.suspect(),
    recalibrateHeight: () => { if (lastHead) height.recalibrate(lastHead.y); },
    setSeated: (on) => { if (lastHead) height.setSeated(on, lastHead.y); else pendingSeated = Boolean(on); },
    isSeated: () => (pendingSeated !== null ? pendingSeated : height.isSeated()),
    setFastXR: (on) => { fastXR = Boolean(on); },
    isFastXR: () => fastXR,
    getState: () => state,
    // Puts the body somewhere else outright. In a headset the rig has to be
    // lined up under the head again, or the next frame would try to walk the
    // body back to where the head still appears to be.
    // `yaw`/`pitch`, when given, turn the screen camera too - which is how
    // tools/audit.cjs flies one page around the whole silo.
    teleport: ({ yaw: nextYaw, pitch: nextPitch, ...next }) => {
      Object.assign(state, next);
      if (Number.isFinite(nextYaw)) yaw = nextYaw;
      if (Number.isFinite(nextPitch)) pitch = clamp(nextPitch, -MAX_PITCH, MAX_PITCH);
      lastHead = null;
    },
    snapshot: () => ({
      x: state.x, y: state.y, z: state.z, theta: state.theta, level: state.level,
      yaw: presenting ? pose.yaw + (lastHead?.yaw || 0) : yaw,
      pitch: presenting ? 0 : pitch,
    }),
  };
}
