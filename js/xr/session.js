// Everything that talks to the WebXR device: starting and ending the session,
// the two controllers, and turning their sticks into the plain {moveX, moveY,
// turn, brisk} that js/xr/locomotion.js consumes. Nothing here knows about the
// silo - js/main.js wires it to the player and the HUD.
import * as THREE from "three";
import { createSnapTurn, shapeStick } from "./locomotion.js";

export const xrSupported = async () => {
  try { return Boolean(await navigator.xr?.isSessionSupported("immersive-vr")); }
  catch { return false; }
};

// A stand-in for the hand: the real controller models would have to be fetched
// from a CDN, and all the player needs is to see where their hands are.
function makeHandle() {
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.02, 0.11, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 }),
  );
  handle.rotation.x = -Math.PI / 3;
  handle.raycast = () => {};
  return handle;
}

export function createXRSession({ renderer, camera, rig, frameRate = null, onStart, onEnd, onSelect, onVisibility }) {
  renderer.xr.enabled = true;
  // Floor-level origin: the rig is placed at the player's feet and the headset
  // reports its real height above it, so there is no eye height to invent.
  renderer.xr.setReferenceSpaceType("local-floor");
  renderer.xr.setFoveation(1);

  const desktop = { fov: camera.fov, near: camera.near, far: camera.far };
  const snapTurn = createSnapTurn();
  const controllers = [0, 1].map((index) => {
    const ray = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    const entry = { ray, grip, source: null };
    ray.addEventListener("connected", (event) => { entry.source = event.data; });
    ray.addEventListener("disconnected", () => { entry.source = null; });
    ray.addEventListener("selectstart", () => onSelect?.(ray));
    grip.add(makeHandle());
    rig.add(ray, grip);
    return entry;
  });

  // The pointing beam. One object, moved to whichever hand is doing the
  // pointing; its length is set each frame by whatever it hits.
  const beam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffb15a, transparent: true, opacity: 0.35, toneMapped: false, fog: false }),
  );
  beam.raycast = () => {};
  beam.frustumCulled = false;

  const byHand = (hand) => controllers.find((c) => c.source?.handedness === hand) || null;
  const connected = () => controllers.filter((c) => c.source);

  // Right hand points, unless it is the only one there is.
  function pointer() {
    const hand = byHand("right") || connected()[0] || null;
    if (hand && beam.parent !== hand.ray) hand.ray.add(beam);
    if (!hand) beam.removeFromParent();
    return hand?.ray || null;
  }

  function stick(gamepad) {
    if (!gamepad) return { x: 0, y: 0 };
    // xr-standard puts the thumbstick on axes 2/3; 0/1 are a touchpad that the
    // Touch controllers do not have.
    const offset = gamepad.axes.length >= 4 ? 2 : 0;
    return { x: gamepad.axes[offset] || 0, y: gamepad.axes[offset + 1] || 0 };
  }

  // Left stick walks and right stick turns. With a single controller, that
  // one walks: being able to move matters more than being able to turn, which
  // the player can still do with their own feet.
  function readInput() {
    const hands = connected();
    const mover = byHand("left") || hands[0] || null;
    const turner = hands.find((hand) => hand !== mover) || null;
    const raw = stick(mover?.source.gamepad);
    const move = shapeStick(raw.x, raw.y);
    const buttons = mover?.source.gamepad?.buttons || [];
    return {
      moveX: move.x,
      moveY: move.y,
      turn: turner ? snapTurn(stick(turner.source.gamepad).x) : 0,
      // Grip squeezed, or the stick clicked in.
      brisk: Boolean(buttons[1]?.pressed || buttons[3]?.pressed),
    };
  }

  // The head, in the rig's own space. Asked for at the start of the frame, so
  // the pose has to be pulled in now rather than left to the render call.
  function readHead() {
    renderer.xr.updateCamera(camera);
    const q = camera.quaternion;
    return {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: Math.atan2(2 * (q.x * q.z + q.w * q.y), 1 - 2 * (q.x * q.x + q.y * q.y)),
    };
  }

  renderer.xr.addEventListener("sessionstart", () => {
    const session = renderer.xr.getSession();
    // A steady lower rate reads far better than a higher one that stutters.
    const rates = Array.from(session.supportedFrameRates || []);
    if (frameRate && rates.includes(frameRate)) session.updateTargetFrameRate(frameRate).catch(() => {});
    session.addEventListener("visibilitychange", () => onVisibility?.(session.visibilityState === "visible"));
    onStart?.();
  });

  renderer.xr.addEventListener("sessionend", () => {
    beam.removeFromParent();
    for (const entry of controllers) entry.source = null;
    // three leaves the headset's last pose and lens projection on the camera.
    camera.rotation.set(0, 0, 0);
    camera.scale.set(1, 1, 1);
    Object.assign(camera, desktop, { zoom: 1, aspect: window.innerWidth / window.innerHeight });
    camera.updateProjectionMatrix();
    onEnd?.();
  });

  let entering = false;
  async function enter() {
    if (entering || renderer.xr.isPresenting) return;
    entering = true;
    try {
      const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor", "bounded-floor"] });
      await renderer.xr.setSession(session);
    } finally { entering = false; }
  }

  return {
    enter,
    exit: () => renderer.xr.getSession()?.end(),
    isPresenting: () => renderer.xr.isPresenting,
    readInput,
    readHead,
    pointer,
    beam,
    // The hand the wrist panel rides on: the one that is not pointing, when
    // there are two.
    offHand: () => (byHand("left") || connected().at(-1))?.grip || null,
  };
}
