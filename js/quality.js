// Rendering budgets per device. Pure data plus one pure function, so the
// choice can be tested in Node and overridden from the URL while measuring.
//
// What a headset changes is not the geometry (the silo is ~160 draw calls and
// ~20k triangles, trivial anywhere) but the cost per pixel: two eyes, a lot of
// pixels, 72-90 times a second, on a mobile GPU. Everything below is a
// per-pixel cost.
export const PROFILES = {
  // `detail`: how far above and below the player (metres, beyond a block's
  // own half-height) the facades' doors, balconies and stairs are drawn.
  desktop: { bloom: true, shadows: true, lights: 10, normalMaps: true, pixelRatio: 1.5, xrFrameRate: null, detail: 62 },
  // Deliberately conservative: nothing here has been measured on a headset
  // yet. Start low, read the frame rate on the device, then hand quality back
  // with ?lights=, ?shadows=1 and so on until it stops holding.
  quest: { bloom: false, shadows: false, lights: 4, normalMaps: true, pixelRatio: 1, xrFrameRate: 72, detail: 36 },
};

// Standalone headsets identify their browser; a desktop with a tethered
// headset does not, and has a desktop GPU anyway.
export const isHeadsetBrowser = (userAgent = "") => /OculusBrowser|\bQuest\b|Pico/i.test(userAgent);

const flag = (value, fallback) => (value === "0" ? false : value === "1" ? true : fallback);

// URL overrides, all optional:
//   ?quality=desktop|quest   pick a profile regardless of the device
//   ?bloom=0|1  ?shadows=0|1  ?normals=0|1
//   ?lights=N                size of the point-light pool (1-10)
//   ?hz=N                    frame rate to ask the headset for
//   ?detail=N                facade detail range in metres (10-200)
export function pickQuality(params, userAgent = "") {
  const requested = params.get("quality");
  const name = PROFILES[requested] ? requested : isHeadsetBrowser(userAgent) ? "quest" : "desktop";
  const base = PROFILES[name];
  const lights = Number(params.get("lights"));
  const hz = Number(params.get("hz"));
  const detail = Number(params.get("detail"));
  return {
    name,
    bloom: flag(params.get("bloom"), base.bloom),
    shadows: flag(params.get("shadows"), base.shadows),
    normalMaps: flag(params.get("normals"), base.normalMaps),
    lights: params.has("lights") && Number.isFinite(lights) ? Math.max(1, Math.min(10, Math.round(lights))) : base.lights,
    pixelRatio: base.pixelRatio,
    xrFrameRate: params.has("hz") && Number.isFinite(hz) && hz > 0 ? hz : base.xrFrameRate,
    detail: params.has("detail") && Number.isFinite(detail) ? Math.max(10, Math.min(200, detail)) : base.detail,
  };
}
