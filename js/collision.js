import { inResidential } from "./residential-layout.js";
import { SECONDARY_WING, WING_OFFSETS, WORLD } from "./config.js";
import { clamp, lerp, lerpHexColor, unwrapAngleNear, wrapToPi } from "./mathutils.js";

const TAPER_FRACTION = 0.12;

// How wide the walkable stair is at flight-progress `t` (0 = just left the
// landing above, 1 = about to reach the one below): it flares out to meet the
// landing at both ends and runs at plain stair width through the middle.
export function slopeOuterRadius(t) {
  const nearStart = clamp(t / TAPER_FRACTION, 0, 1);
  const nearEnd = clamp((1 - t) / TAPER_FRACTION, 0, 1);
  const narrow = Math.min(nearStart, nearEnd);
  return lerp(WORLD.hubR, WORLD.stairOuterR, narrow);
}

// Classifies a continuously-tracked (unwrapped) angle into either a level's
// flat landing or the helical flight between two landings. The landing is only
// +-landingHalfAngle wide now: the helix runs continuously past every one of
// the 148 levels and merely pauses to meet each floor, instead of flattening
// into a plateau that had to be a whole hall wide.
export function classifyTheta(layout, theta) {
  const { stations, slopes } = layout;
  const phi = WORLD.landingHalfAngle;
  const first = stations[0];
  const last = stations[stations.length - 1];
  const clamped = clamp(theta, first.theta - phi, last.theta + phi);

  // Landings sit on a known grid, so find the nearest one by arithmetic rather
  // than by scanning 148 entries on every movement step.
  const spacing = stations.length > 1 ? stations[1].theta - stations[0].theta : Infinity;
  const guess = clamp(Math.round((clamped - first.theta) / spacing), 0, stations.length - 1);
  const station = stations[guess];
  if (clamped >= station.theta - phi && clamped <= station.theta + phi) {
    return { type: "plateau", station, theta: clamped };
  }

  const slopeIndex = clamp(clamped > station.theta ? guess : guess - 1, 0, slopes.length - 1);
  const slope = slopes[slopeIndex];
  const t = clamp((clamped - slope.thetaStart) / (slope.thetaEnd - slope.thetaStart), 0, 1);
  return { type: "slope", slope, t, theta: clamped };
}

// Height of the stair's walking surface at any angle: flat across a landing,
// helical between them. A pure function of theta - that is the whole point of
// the model, and it is what lets 148 levels exist without 148 special cases.
export function surfaceY(layout, theta) {
  const zone = classifyTheta(layout, theta);
  if (zone.type === "plateau") return zone.station.y;
  return lerp(zone.slope.yStart, zone.slope.yEnd, zone.t);
}

// Deepest reach of any bay on this level, so positions far inside the void are
// rejected before the per-bay test runs.
function maxBayReach(station) {
  let max = 0;
  for (const bay of station.bays || []) if (bay.reach > max) max = bay.reach;
  return max;
}

// Is the player within one of this level's wings (corridor or room)? Wings
// hang off the ring at any bearing now, so this is pure 2D geometry in the
// wing's own frame.
function resolveInWing(station, px, pz) {
  if (station.generated) return false;
  const playerR = WORLD.playerRadius;
  const roomStart = WORLD.landingR + WORLD.corridorLen;

  for (let i = 0; i < WING_OFFSETS.length; i++) {
    const angle = (station.wingRotation || 0) + WING_OFFSETS[i];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const lx = px * cos + pz * sin; // outward along this wing's corridor
    const lz = -px * sin + pz * cos; // sideways
    if (station.id === 'residencial' && i === 0) {
      if(inResidential(lx,lz))return true;
      continue;
    }
    const roomHalfW = i === 0 ? station.roomHalfW : SECONDARY_WING.roomHalfW;
    const roomDepth = i === 0 ? station.roomDepth : SECONDARY_WING.roomDepth;

    const inCorridor =
      lx >= WORLD.landingR - playerR &&
      lx <= roomStart &&
      Math.abs(lz) <= WORLD.corridorHalfW - playerR;

    const inRoom =
      lx >= roomStart - playerR &&
      lx <= roomStart + roomDepth - playerR &&
      Math.abs(lz) <= roomHalfW - playerR;

    if (inCorridor || inRoom) return true;
  }
  return false;
}

// Resolves a proposed ground-plane move. Tries the full move first, then each
// axis alone (a simple, robust approximation of wall-sliding), and finally
// gives up and keeps the previous position.
//
// The player's state carries `level`: the index of the ring floor they are
// standing on, or null when they are on the stair. It has to be part of the
// state because the ring floors are genuinely ambiguous from position alone -
// 148 of them sit at the same radius, one above another, and only the route
// taken says which one you are on.
export function resolveMove(layout, prevState, moveX, moveZ) {
  if (!Number.isFinite(moveX) || !Number.isFinite(moveZ)) return { ...prevState };
  // Substeps prevent a long frame or external move from tunnelling through walls.
  const count = Math.ceil(Math.hypot(moveX, moveZ) / 0.12);
  let state = prevState;
  for (let i = 0; i < Math.max(1, count); i++) {
    state = resolveStep(layout, state, moveX / Math.max(1, count), moveZ / Math.max(1, count));
  }
  return state;
}

function resolveStep(layout, prevState, moveX, moveZ) {
  const pr = WORLD.playerRadius;
  const level = prevState.level ?? null;

  const tryDelta = (dx, dz) => {
    const px = prevState.x + dx;
    const pz = prevState.z + dz;
    const r = Math.hypot(px, pz);

    if (level !== null) {
      const station = layout.stations[level];
      // On a level, `theta` is pinned to that level's landing and the player's
      // compass bearing is read directly. Accumulating theta here instead would
      // mean a full lap of the ring silently moved the player a turn down the
      // helix, and stepping back onto the stair would drop them a floor.
      const bearing = wrapToPi(Math.atan2(pz, px) - station.theta);
      if (station.obstacles?.some((o) => {
        const x = px * Math.cos(o.angle) + pz * Math.sin(o.angle) - o.x;
        const z = -px * Math.sin(o.angle) + pz * Math.cos(o.angle) - o.z;
        return Math.hypot(Math.max(0, Math.abs(x) - o.hw), Math.max(0, Math.abs(z) - o.hd)) < pr;
      })) return null;
      const onRing = r >= WORLD.ringInnerR + pr && r <= WORLD.landingR - pr;
      // Bays hang off the ring's inner edge over the void. Inside one, the
      // floor simply reaches further in - the angular clearance has to shrink
      // with radius or the player's shoulders clip the parapet at the tip.
      const inBay =
        !onRing &&
        r < WORLD.ringInnerR + pr &&
        r >= WORLD.ringInnerR - maxBayReach(station) + pr &&
        (station.bays || []).some((bay) => {
          if (r < WORLD.ringInnerR - bay.reach + pr) return false;
          const slack = bay.halfWidth - Math.asin(Math.min(1, pr / Math.max(pr, r)));
          return slack > 0 && Math.abs(wrapToPi(bearing - wrapToPi(bay.bearing - station.theta))) < slack;
        });
      if (onRing || inBay || resolveInWing(station, px, pz)) {
        return { x: px, y: station.y, z: pz, theta: station.theta, level };
      }

      // Back in across the landing deck towards the stair.
      const atLanding = Math.abs(bearing) <= WORLD.landingHalfAngle && r * Math.sin(WORLD.landingHalfAngle - Math.abs(bearing)) >= pr + 0.22;
      if (atLanding && r >= WORLD.shaftR + pr && r < WORLD.ringInnerR + pr) {
        const backOnStair = r <= WORLD.stairOuterR - pr;
        return {
          x: px,
          y: station.y,
          z: pz,
          theta: station.theta + bearing,
          level: backOnStair ? null : level,
        };
      }
      return null;
    }

    // On the stair: an annulus around the shaft, present at every angle all
    // the way down.
    const theta = unwrapAngleNear(Math.atan2(pz, px), prevState.theta);
    const zone = classifyTheta(layout, theta);
    if (Math.abs(zone.theta - theta) > 1e-6) return null;
    if (r >= WORLD.shaftR + pr && r <= WORLD.stairOuterR - pr) {
      const y = zone.type === "plateau" ? zone.station.y : lerp(zone.slope.yStart, zone.slope.yEnd, zone.t);
      return { x: px, y, z: pz, theta, level: null };
    }

    // At a landing the floor reaches out across the void to the ring.
    if (zone.type === "plateau" && r > WORLD.stairOuterR - pr && r <= WORLD.landingR - pr && r * Math.sin(WORLD.landingHalfAngle - Math.abs(theta - zone.station.theta)) >= pr + 0.22) {
      const reachedRing = r >= WORLD.ringInnerR + pr;
      return {
        x: px,
        y: zone.station.y,
        z: pz,
        theta,
        level: reachedRing ? zone.station.index : null,
      };
    }
    return null;
  };

  return (
    tryDelta(moveX, moveZ) ||
    tryDelta(moveX, 0) ||
    tryDelta(0, moveZ) || {
      x: prevState.x,
      y: prevState.y,
      z: prevState.z,
      theta: prevState.theta,
      level,
    }
  );
}

// For the HUD: which level the player is on (or between), and a fog/ambient
// colour blended smoothly along the descent.
export function describeLocation(layout, theta, level = null) {
  if (level !== null) {
    const station = layout.stations[level];
    return { station, progress: 1, fog: station.fog, light: station.light };
  }
  const zone = classifyTheta(layout, theta);
  if (zone.type === "plateau") {
    return { station: zone.station, progress: 1, fog: zone.station.fog, light: zone.station.light };
  }
  const a = layout.stations[zone.slope.fromIndex];
  const b = layout.stations[zone.slope.toIndex];
  const nearer = zone.t < 0.5 ? a : b;
  return {
    station: nearer,
    fromStation: a,
    toStation: b,
    progress: zone.t,
    fog: lerpHexColor(a.fog, b.fog, zone.t),
    light: lerpHexColor(a.light, b.light, zone.t),
  };
}
