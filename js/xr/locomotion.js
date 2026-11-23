// VR locomotion math. No three.js and no DOM in here on purpose: it is the part
// of the headset mode that can be wrong in ways you only feel as nausea, so it
// is tested in plain Node (test/xr.test.mjs) rather than by putting the
// headset on.
import { resolveMove } from "../collision.js";

export const XR_COMFORT = {
  // Desktop walks at 3.8 m/s and sprints at 7. Both are far too fast with a
  // headset on: the eyes report motion the inner ear does not feel.
  walk: 2.8,
  brisk: 4.4,
  deadzone: 0.18,
  // Turning in steps instead of smoothly is the single most effective comfort
  // setting there is - a smooth yaw is what makes most people sick.
  snapAngle: Math.PI / 6,
  snapOn: 0.6,
  snapOff: 0.3,
  // How far the head may travel past a spot the body cannot follow it to.
  // Without this slack the world slides away every time you lean on a parapet
  // to look down the shaft, which is the one thing everybody does first.
  leanMax: 0.55,
  // A tracking recentre moves the head by metres in one frame. That is not a
  // step the player took, so it must not be walked through the collision.
  recentreJump: 0.75,
  stride: 0.75,
};

// Radial deadzone, rescaled so the stick still reaches 1 at full deflection.
export function shapeStick(x, y, deadzone = XR_COMFORT.deadzone) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const scaled = Math.min(1, (magnitude - deadzone) / (1 - deadzone)) / magnitude;
  return { x: x * scaled, y: y * scaled };
}

// One turn per flick of the stick: fires when the stick crosses `snapOn` and
// re-arms only once it has come back under `snapOff`.
export function createSnapTurn({ snapOn = XR_COMFORT.snapOn, snapOff = XR_COMFORT.snapOff } = {}) {
  let armed = true;
  return function step(axis) {
    if (!Number.isFinite(axis)) return 0;
    if (armed && Math.abs(axis) >= snapOn) { armed = false; return Math.sign(axis); }
    if (!armed && Math.abs(axis) <= snapOff) armed = true;
    return 0;
  };
}

// Where the head is in the world, given the rig that carries the play space.
export function headWorld(rig, head) {
  const cos = Math.cos(rig.yaw), sin = Math.sin(rig.yaw);
  return { x: rig.x + head.x * cos + head.z * sin, z: rig.z - head.x * sin + head.z * cos };
}

// The rig position that puts the head exactly over (x, z).
export function alignRig(point, head, yaw) {
  const offset = headWorld({ x: 0, z: 0, yaw }, head);
  return { x: point.x - offset.x, z: point.z - offset.z, yaw };
}

// One frame of headset movement.
//
//   state  the collision state (js/collision.js): where the body stands
//   rig    {x, z, yaw} of the play space in the world
//   head   {x, z, yaw} of the headset inside the play space
//   input  {moveX, moveY, turn, brisk}: shaped stick, -1/0/1 snap step
//
// Two things move the player and they are resolved separately. The stick moves
// the whole play space (rig and body together). Real steps move only the head,
// and the body follows it wherever the collision allows.
export function stepLocomotion(layout, state, rig, head, input, dt, tune = XR_COMFORT) {
  let next = state;
  let pose = { ...rig };

  // A snap turn pivots on the head, not on the centre of the play space -
  // otherwise turning while standing off-centre swings you sideways.
  if (input.turn) {
    const pivot = headWorld(pose, head);
    // Stick to the right turns right, which is a negative yaw (see player.js).
    pose = alignRig(pivot, head, pose.yaw - input.turn * tune.snapAngle);
  }

  let walked = 0;
  if (input.moveX || input.moveY) {
    const heading = pose.yaw + head.yaw;
    const forward = -input.moveY, right = input.moveX;
    const speed = (input.brisk ? tune.brisk : tune.walk) * dt;
    const dx = (-Math.sin(heading) * forward + Math.cos(heading) * right) * speed;
    const dz = (-Math.cos(heading) * forward - Math.sin(heading) * right) * speed;
    const moved = resolveMove(layout, next, dx, dz);
    pose.x += moved.x - next.x;
    pose.z += moved.z - next.z;
    walked = Math.hypot(moved.x - next.x, moved.z - next.z);
    next = moved;
  }

  const at = headWorld(pose, head);
  let leanX = at.x - next.x, leanZ = at.z - next.z;
  if (Math.hypot(leanX, leanZ) > 1e-4) {
    next = resolveMove(layout, next, leanX, leanZ);
    leanX = at.x - next.x;
    leanZ = at.z - next.z;
    const lean = Math.hypot(leanX, leanZ);
    // Past the slack the play space is pushed back, so walking into a wall in
    // the real room does not carry the head through the one in the silo.
    if (lean > tune.leanMax) {
      const excess = 1 - tune.leanMax / lean;
      pose.x -= leanX * excess;
      pose.z -= leanZ * excess;
    }
  }

  return { state: next, rig: pose, walked };
}
