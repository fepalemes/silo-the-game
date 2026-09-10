export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function smooth01(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

const TAU = Math.PI * 2;

// Unwraps `rawAngle` (which is only known modulo 2*PI) into the value nearest
// to `reference`, so a continuously-tracked angle never jumps by a full turn
// even though atan2() only ever returns a value in (-PI, PI].
export function unwrapAngleNear(rawAngle, reference) {
  const turns = Math.round((reference - rawAngle) / TAU);
  return rawAngle + turns * TAU;
}

export function lerpHexColor(hexA, hexB, t) {
  const c = smooth01(t);
  const ar = (hexA >> 16) & 0xff;
  const ag = (hexA >> 8) & 0xff;
  const ab = hexA & 0xff;
  const br = (hexB >> 16) & 0xff;
  const bg = (hexB >> 8) & 0xff;
  const bb = hexB & 0xff;
  const r = Math.round(lerp(ar, br, c));
  const g = Math.round(lerp(ag, bg, c));
  const b = Math.round(lerp(ab, bb, c));
  return (r << 16) | (g << 8) | b;
}
