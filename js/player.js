import { PLAYER_SPEED, WORLD } from "./config.js";
import { resolveMove } from "./collision.js";
import { clamp } from "./mathutils.js";

const MAX_PITCH = 1.5;

// Pointer-lock FPS controller. Movement/collision math lives in collision.js;
// this module only owns input, camera orientation and head-bob/footsteps.
export function createPlayer({ camera, domElement, layout, initialState, onLockChange, onFootstep, frozen = false }) {
  const state = { ...initialState };
  let yaw = initialState.yaw ?? -Math.PI / 2;
  let pitch = initialState.pitch ?? 0;
  let locked = false;
  let bobPhase = 0;
  let lastStepIndex = 0;
  const keys = Object.create(null);

  function onKeyDown(e) {
    keys[e.code] = true;
  }
  function onKeyUp(e) {
    keys[e.code] = false;
  }
  function onMouseMove(e) {
    if (!locked) return;
    yaw -= e.movementX * PLAYER_SPEED.mouseSensitivity;
    pitch = clamp(pitch - e.movementY * PLAYER_SPEED.mouseSensitivity, -MAX_PITCH, MAX_PITCH);
  }
  function onPointerLockChange() {
    locked = document.pointerLockElement === domElement;
    if (onLockChange) onLockChange(locked);
  }

  domElement.addEventListener("click", () => {
    if (!locked) domElement.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  camera.rotation.order = "YXZ";

  function update(dt) {
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
    if (locked && (forwardInput || rightInput)) {
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

    const next = resolveMove(layout, state, dx, dz);
    state.x = next.x;
    state.y = next.y;
    state.z = next.z;
    state.theta = next.theta;

    const moving = dx !== 0 || dz !== 0;
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
    const bob = moving ? Math.sin(bobPhase) * 0.035 : 0;

    camera.position.set(state.x, state.y + WORLD.eyeHeight + bob, state.z);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    return { moving, sprinting };
  }

  return {
    update,
    isLocked: () => locked,
    requestLock: () => domElement.requestPointerLock(),
    getState: () => state,
  };
}
