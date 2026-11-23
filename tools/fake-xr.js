// A WebXR device that does not exist, for tools/xr-check.cjs. Injected before
// the page's own scripts, it replaces navigator.xr with just enough of the API
// for three.js to run a real immersive session against it: two eye views
// rendered side by side into the canvas, and two tracked controllers whose
// pose, sticks and triggers the test drives through window.__fakeXR.
//
// It checks that the game's headset code runs and behaves. It says nothing
// about frame rate or comfort - only the device can.
(() => {
  // Small eyes: the check runs on a software rasteriser.
  const EYE = { width: 448, height: 448 }, IPD = 0.064;

  // Column-major pose matrix: yaw about Y, then pitch about the local X.
  function poseMatrix({ x = 0, y = 0, z = 0, yaw = 0, pitch = 0 }, offsetX = 0) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const m = new Float32Array([
      cy, 0, -sy, 0,
      sy * sp, cp, cy * sp, 0,
      sy * cp, -sp, cy * cp, 0,
      x, y, z, 1,
    ]);
    m[12] += m[0] * offsetX; m[13] += m[1] * offsetX; m[14] += m[2] * offsetX;
    return m;
  }
  function perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
  }

  const makeHand = (handedness, pose) => {
    const hand = { handedness, pose, axes: [0, 0, 0, 0], buttons: Array.from({ length: 6 }, () => ({ pressed: false, touched: false, value: 0 })) };
    hand.source = {
      handedness, targetRayMode: "tracked-pointer", profiles: ["meta-quest-touch-plus"], hand: null,
      targetRaySpace: { hand }, gripSpace: { hand },
      gamepad: { mapping: "xr-standard", axes: hand.axes, buttons: hand.buttons },
    };
    return hand;
  };

  const device = window.__fakeXR = {
    head: { x: 0, y: 1.7, z: 0, yaw: 0, pitch: 0 },
    left: makeHand("left", { x: -0.16, y: 1.42, z: -0.42, yaw: 0, pitch: 0 }),
    right: makeHand("right", { x: 0.2, y: 1.2, z: -0.3, yaw: 0, pitch: 0 }),
    session: null,
    frames: 0,
    trigger(hand) {
      const frame = makeFrame();
      for (const type of ["selectstart", "select", "selectend"]) device.session.dispatchEvent(Object.assign(new Event(type), { inputSource: device[hand].source, frame }));
    },
  };

  function makeFrame() {
    return {
      session: device.session,
      getViewerPose: () => ({
        transform: { matrix: poseMatrix(device.head) },
        emulatedPosition: false,
        views: ["left", "right"].map((eye) => ({
          eye,
          transform: { matrix: poseMatrix(device.head, eye === "left" ? -IPD / 2 : IPD / 2) },
          projectionMatrix: perspective(1.68, EYE.width / EYE.height, 0.08, 160),
        })),
      }),
      getPose: (space) => (space?.hand ? { transform: { matrix: poseMatrix(space.hand.pose) } } : null),
    };
  }

  class FakeSession extends EventTarget {
    constructor() {
      super();
      this.renderState = {};
      this.visibilityState = "visible";
      this.environmentBlendMode = "opaque";
      this.supportedFrameRates = new Float32Array([72, 90, 120]);
      this.frameRate = 90;
      this.inputSources = [];
    }
    updateRenderState(state) { Object.assign(this.renderState, state); }
    async updateTargetFrameRate(rate) { this.frameRate = rate; }
    async requestReferenceSpace(type) {
      // Controllers appear once the session is up, as they do on a headset.
      queueMicrotask(() => {
        this.inputSources = [device.left.source, device.right.source];
        this.dispatchEvent(Object.assign(new Event("inputsourceschange"), { added: this.inputSources, removed: [] }));
      });
      return { type };
    }
    requestAnimationFrame(callback) {
      return window.requestAnimationFrame((time) => {
        if (device.session !== this) return;
        device.frames++;
        callback(time, makeFrame());
      });
    }
    cancelAnimationFrame(handle) { window.cancelAnimationFrame(handle); }
    async end() {
      device.session = null;
      this.dispatchEvent(new Event("end"));
    }
  }

  window.XRWebGLLayer = class {
    constructor() {
      // null is the canvas itself: the two eyes land side by side in it.
      this.framebuffer = null;
      this.framebufferWidth = EYE.width * 2;
      this.framebufferHeight = EYE.height;
      this.ignoreDepthValues = false;
      this.fixedFoveation = 0;
    }
    getViewport(view) { return { x: view.eye === "left" ? 0 : EYE.width, y: 0, width: EYE.width, height: EYE.height }; }
    static getNativeFramebufferScaleFactor() { return 1; }
  };
  // Force three.js down the XRWebGLLayer path rather than the layers API.
  window.XRWebGLBinding = undefined;
  WebGL2RenderingContext.prototype.makeXRCompatible = async () => {};

  Object.defineProperty(navigator, "xr", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      isSessionSupported: async (mode) => mode === "immersive-vr",
      requestSession: async () => (device.session = new FakeSession()),
    }),
  });
})();
