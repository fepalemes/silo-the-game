import * as THREE from "three";
import { scaleHexColor } from "../mathutils.js";
import { makeConcreteSurface, makeWorkshopSurface } from "../textures.js";

// All concrete in the silo comes from a tiny pool of shared surfaces, drawn
// in near-neutral grey and then tinted per station through the material's
// `color`. Generating a unique 512px surface (plus its normal map) for each
// of the twelve floors cost several seconds of blocking work at startup for
// no visible gain - it is the same poured concrete everywhere.
// Light neutral so multiplying by a station's palette colour lands back on
// roughly that colour, with the drawn grain/seams/streaks riding on top -
// but not so light that the noise highlights clip to white.
// Neutral, so the hue comes from the tint (CONCRETE in config.js) alone. It
// was the 3D cutaway's warm #8a8578 at this luminance for a while; measured
// against the production stills that was the wrong call - in silo-2 and
// silo-19 the concrete lit by ambient alone sits at hue ~195-230 with
// saturation ~0.2, and only the lamps are warm. Darkness is a lighting
// decision, not a texture one - turn the exposure in main.js if it needs to
// come down.
const SURFACE_BASE = 0xd4d5d3;

// Every structural surface that is not a level's own walls and floors: the
// stair, the guard walls, the pillars, the risers. One place, cool grey, so
// the next adjustment of the silo's concrete is one edit.
export const STRUCTURE_COLORS = {
  tread: 0xa9afb3,
  nosing: 0xb4b8ba,
  coping: 0xaeb2b4,
  guard: 0xa9afb3,
  // The landing deck's and the bays' guard walls, a shade darker.
  deckGuard: 0x868c90,
  pillar: 0x9ca2a6,
  riser: 0x737a7f,
};

// Multiplying a light neutral texture by a station's palette colour lands
// noticeably darker than the palette colour itself, and MeshStandardMaterial
// is dimmer than the MeshLambertMaterial this used to use. TINT_GAIN puts
// that brightness back without flattening anything.
const TINT_GAIN = 1.34;

export const tint = (hex) => scaleHexColor(hex, TINT_GAIN);

const surfaceCache = new Map();

export function sharedSurface(key, options) {
  if (!surfaceCache.has(key)) surfaceCache.set(key, makeConcreteSurface(SURFACE_BASE, options));
  return surfaceCache.get(key);
}

// Three wear tiers instead of one surface per floor: the production notes
// describe the upper levels as kept clean and the lower ones as damp,
// cracked and distressed, but generating a unique surface per station costs
// seconds of load. Tier is picked from depth (see wearTierFor).
const WEAR_TIERS = [0.1, 0.5, 0.95];

export const getWallSurface = (tier = 0) =>
  sharedSurface(`wall${tier}`, { seed: 17 + tier * 31, streaks: true, seams: true, normalStrength: 2.6, wear: WEAR_TIERS[tier] });

export const getFloorSurface = (tier = 0) =>
  sharedSurface(`floor${tier}`, { seed: 508 + tier * 31, streaks: false, seams: true, normalStrength: 2.2, wear: WEAR_TIERS[tier] });

// 0 = upper silo (clean), 1 = mids, 2 = the deep levels (wet and broken).
export function wearTierFor(level) {
  if (level <= 50) return 0;
  if (level <= 100) return 1;
  return 2;
}

// Lower levels are described as genuinely wet, so their floors get a damp
// sheen - lower roughness is the whole trick, and it costs nothing.
export function floorRoughnessFor(level) {
  return level <= 50 ? 0.95 : level <= 100 ? 0.82 : 0.55;
}

// Structural concrete (stair treads, guard walls) gets its own variant with
// a fixed repeat baked in, since it is applied to instanced geometry that
// cannot carry per-instance UV scaling.
let structureSurfaceCache = null;

export function getStructureSurface() {
  if (!structureSurfaceCache) {
    const surface = makeConcreteSurface(0xb8babb, { seed: 4242, streaks: false, seams: false, normalStrength: 0.9, wear: 0.45 });
    surface.map.repeat.set(1, 1);
    surface.normalMap.repeat.set(1, 1);
    structureSurfaceCache = surface;
  }
  return structureSurfaceCache;
}

// `map` accepts either a raw THREE.Texture or a {map, normalMap} surface
// from textures.js. Surfaces are what make concrete read as concrete: the
// normal map gives the point lights something to catch on.
export function resolveSurface(map, repeat) {
  if (!map) return { map: null, normalMap: null };
  const surface = map.isTexture ? { map, normalMap: null } : map;
  if (!repeat) return surface;

  const cloned = { map: null, normalMap: null, roughnessMap: null };
  for (const key of ["map", "normalMap", "roughnessMap"]) {
    if (!surface[key]) continue;
    const tex = surface[key].clone();
    tex.needsUpdate = true;
    tex.repeat.set(repeat[0], repeat[1]);
    cloned[key] = tex;
  }
  return cloned;
}

const workshop = new Map();
export function workshopSurface(kind) {
  if (!workshop.has(kind)) workshop.set(kind, makeWorkshopSurface(kind));
  return workshop.get(kind);
}
export function workshopMaterial(kind, options = {}) {
  return new THREE.MeshStandardMaterial({ ...workshopSurface(kind), roughness: 1, metalness: kind === 'paint' ? 0.22 : 0, ...options });
}
