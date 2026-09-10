import { SECONDARY_WING, WING_OFFSETS, WORLD } from "./config.js";
import { clamp, lerp, lerpHexColor, unwrapAngleNear } from "./mathutils.js";

const TAPER_FRACTION = 0.12;

// How wide the walkable ring is at slope-progress `t` (0 = just left the
// upper landing, 1 = about to reach the lower landing): wide at both ends so
// it flares smoothly into each station's landing, narrow (plain stair width)
// through the middle of the flight.
export function slopeOuterRadius(t) {
  const nearStart = clamp(t / TAPER_FRACTION, 0, 1);
  const nearEnd = clamp((1 - t) / TAPER_FRACTION, 0, 1);
  const narrow = Math.min(nearStart, nearEnd);
  return lerp(WORLD.hubR, WORLD.stairOuterR, narrow);
}

// Classifies a continuously-tracked (unwrapped) angle into either a
// station's flat plateau or the sloped stair flight between two stations.
export function classifyTheta(layout, theta) {
  const { stations, slopes } = layout;
  const phi = WORLD.plateauHalfAngle;
  const first = stations[0];
  const last = stations[stations.length - 1];
  const clamped = clamp(theta, first.theta - phi, last.theta + phi);

  for (const station of stations) {
    if (clamped >= station.theta - phi && clamped <= station.theta + phi) {
      return { type: "plateau", station, theta: clamped };
    }
  }
  for (const slope of slopes) {
    if (clamped >= slope.thetaStart && clamped <= slope.thetaEnd) {
      const t = (clamped - slope.thetaStart) / (slope.thetaEnd - slope.thetaStart);
      return { type: "slope", slope, t, theta: clamped };
    }
  }
  // Contiguity of the ranges above means this is unreachable in practice;
  // fall back defensively to whichever end is closer.
  const fallback = clamped < first.theta ? first : last;
  return { type: "plateau", station: fallback, theta: clamped };
}

// A station's plateau, from the shaft outward: a small hub where the stair
// actually lands, then a real open void (no floor at all, matching the gap
// between the central stair core and the balcony ring in the reference
// stills), then the outer ring hall (walkable at any angle, like a real
// atrium balcony), then the wing corridors/rooms beyond it. The void can
// only be crossed via a bridge at each wing's angle (WING_OFFSETS).
function resolveOnStation(station, px, pz) {
  const playerR = WORLD.playerRadius;
  const r = Math.hypot(px, pz);

  if (r < WORLD.shaftR + playerR) return { ok: false };
  if (r <= WORLD.hubR - playerR) return { ok: true, x: px, y: station.y, z: pz };
  if (r >= WORLD.ringInnerR + playerR && r <= WORLD.landingR - playerR) {
    return { ok: true, x: px, y: station.y, z: pz };
  }

  const roomStart = WORLD.landingR + WORLD.corridorLen;

  for (let i = 0; i < WING_OFFSETS.length; i++) {
    const angle = station.theta + WING_OFFSETS[i];
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const lx = px * cos + pz * sin; // local axis pointing out along this wing's corridor
    const lz = -px * sin + pz * cos; // local sideways axis
    const roomHalfW = i === 0 ? station.roomHalfW : SECONDARY_WING.roomHalfW;
    const roomDepth = i === 0 ? station.roomDepth : SECONDARY_WING.roomDepth;

    const inBridge =
      lx >= WORLD.hubR - playerR &&
      lx <= WORLD.ringInnerR + playerR &&
      Math.abs(lz) <= WORLD.bridgeHalfW - playerR;

    const inCorridor =
      lx >= WORLD.landingR - playerR &&
      lx <= WORLD.landingR + WORLD.corridorLen &&
      Math.abs(lz) <= WORLD.corridorHalfW - playerR;

    const inRoom =
      lx >= roomStart - playerR &&
      lx <= roomStart + roomDepth - playerR &&
      Math.abs(lz) <= roomHalfW - playerR;

    if (inBridge || inCorridor || inRoom) return { ok: true, x: px, y: station.y, z: pz };
  }

  return { ok: false };
}

function resolveOnSlope(slope, t, theta, px, pz) {
  const minR = WORLD.shaftR + WORLD.playerRadius;
  const maxR = slopeOuterRadius(t) - WORLD.playerRadius;
  const r = clamp(Math.hypot(px, pz), minR, maxR);
  const y = lerp(slope.yStart, slope.yEnd, t);
  return { x: r * Math.cos(theta), y, z: r * Math.sin(theta) };
}

// Resolves a proposed ground-plane move against the silo's layout. Tries the
// full move first, then each axis alone (a simple, robust approximation of
// wall-sliding), and finally gives up and keeps the previous position.
export function resolveMove(layout, prevState, moveX, moveZ) {
  const tryDelta = (dx, dz) => {
    const px = prevState.x + dx;
    const pz = prevState.z + dz;
    const theta = unwrapAngleNear(Math.atan2(pz, px), prevState.theta);
    const zone = classifyTheta(layout, theta);

    if (zone.type === "plateau") {
      const res = resolveOnStation(zone.station, px, pz);
      if (!res.ok) return null;
      return { x: res.x, y: res.y, z: res.z, theta: zone.theta };
    }
    const res = resolveOnSlope(zone.slope, zone.t, zone.theta, px, pz);
    return { x: res.x, y: res.y, z: res.z, theta: zone.theta };
  };

  return (
    tryDelta(moveX, moveZ) ||
    tryDelta(moveX, 0) ||
    tryDelta(0, moveZ) || {
      x: prevState.x,
      y: prevState.y,
      z: prevState.z,
      theta: prevState.theta,
    }
  );
}

// For a given (unwrapped) theta, returns the current station (for HUD level
// labels) and a fog/ambient-light color blended smoothly between zones.
export function describeLocation(layout, theta) {
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
