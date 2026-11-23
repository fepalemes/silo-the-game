import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FACADE, GALLERY_COLUMNS, LEVEL_HEIGHT, WORLD } from "../config.js";
import { lightPoolTexture } from "./atmosphere.js";
import { mulberry32 } from "../textures.js";
import { getWallSurface, resolveSurface, tint, wearTierFor } from "./materials.js";
import { WINDOW_PALETTE, painted, roundedRect } from "./fixtures.js";

// The facades behind the galleries: two storeys of apartments and services on
// every level, the way the production built them (the Vectorworks model of
// the shaft, the alley renderings, silo-2, silo-3, silo-19). Rounded doors on
// the gallery, each with its lamp; a second storey with balconies behind black
// railings, reached by small concrete stairs that run up along the wall; boxes
// stepping in and out; windows lit and dark; pipes and air units.
//
// It used to be a blank ring wall with a door every ten metres and, above a
// false ceiling, one band of forty windows.
//
// Everything is fixed to the ring wall's own flat panels (station.panels), in
// the panel's frame: x along the panel, y up from the level's floor, z out of
// the wall towards the shaft. The lower storey is only dressed on the door and
// porthole panels; the bare ones are where the level plate and the notices go
// (signs.js claimPanel), so they keep their lower storey clear.
//
// Instanced, in blocks of a few levels like the risers' fittings: nine draw
// calls a block, shown only near the player (index.js). Each block is two
// chunks: the bulk of it (volumes, stairs, doors, windows) drawn out to
// `range`, the small hardware (railings, lamps, air units, pipes) to half of
// that - a gallery looks across at two dozen levels of facade, and the
// hardware was half their triangles.

const BLOCK = 6;
// How far from the player a block is still drawn, beyond its own half-height.
// The plain wall carries the shaft past that.
const RANGE = 62;
const H = WORLD.roomHeight;
const UP = FACADE.upperFloor;
const TOP = FACADE.top;
const WALL_R = WORLD.landingR;
const TAU = Math.PI * 2;

// The service stair: up along the wall to a landing at the upper storey.
const STAIR = { steps: 15, run: 3.6, width: 0.95, landing: 1.0 };

// Profiles by depth: the upper silo is apartments, the bottom is plant.
function profileFor(level) {
  if (level > 144) return { balcony: 0, block: 0.4, stair: 0.2, lit: 0.2, paint: 0.62 };
  if (level >= 120) return { balcony: 0.12, block: 0.45, stair: 0.35, lit: 0.36, paint: 0.72 };
  if (level >= 50) return { balcony: 0.3, block: 0.4, stair: 0.5, lit: 0.55, paint: 0.86 };
  return { balcony: 0.45, block: 0.35, stair: 0.6, lit: 0.7, paint: 1 };
}

// Door leaves of the alley renderings and the set photos: blue-grey, teal,
// worn wood, oxide red, plain grey.
const DOOR_PAINT = [0x6f8796, 0x5e7f7c, 0x8a6a4c, 0x7d5245, 0x8e9496, 0x6b7458, 0x9aa7ad, 0x7a6a58];

// --- Part geometries, built once ---------------------------------------------

function merged(parts, { keepUv = false } = {}) {
  for (const part of parts) if (!keepUv && part.attributes.uv) part.deleteAttribute("uv");
  return mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)));
}

function at(geometry, x, y, z) {
  geometry.translate(x, y, z);
  return geometry;
}

let kit = null;
function parts() {
  if (kit) return kit;
  const box = (w, h, d, x, y, z, hex, scale = 1) => painted(at(new THREE.BoxGeometry(w, h, d), x, y, z), hex, scale);
  const plane = (w, h, x, y, z, hex, scale = 1) => painted(at(new THREE.PlaneGeometry(w, h), x, y, z), hex, scale);
  const rounded = (w, h, r, x, y, z, hex, scale = 1, segments = 2) => painted(at(roundedRect(w, h, r, segments), x, y, z), hex, scale);

  // A window: dark frame, glass, a cross of glazing bars. Lean on purpose:
  // there are a few hundred within sight at any time.
  const window = merged([
    rounded(1.3, 1.08, 0.24, 0, 0, 0, 0xffffff, 0.09),
    painted(at(roundedRect(1.1, 0.88, 0.17, 2), 0, 0, 0.012), 0xffffff, 1),
    plane(0.05, 0.88, 0, 0, 0.02, 0xffffff, 0.09),
    plane(1.1, 0.045, 0, 0.15, 0.02, 0xffffff, 0.09),
  ]);

  // A door, standing on y=0, back against the wall: frame block, rounded
  // leaf (white - the instance colour is its paint), vision panel, kick plate
  // and handle.
  const outline = (path, w, h, r) => {
    const x = -w / 2, y = -h / 2;
    path.moveTo(x + r, y);
    path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
    return path;
  };
  const frameShape = outline(new THREE.Shape(), 1.3, 2.38, 0.3);
  frameShape.holes.push(outline(new THREE.Path(), 1.04, 2.16, 0.22));
  const door = merged([
    box(1.3, 2.38, 0.07, 0, 1.19, 0.035, 0xffffff, 0.2),
    painted(at(new THREE.ShapeGeometry(frameShape, 2), 0, 1.19, 0.072), 0xffffff, 0.3),
    rounded(1.04, 2.16, 0.22, 0, 1.1, 0.045, 0xffffff, 1, 2),
    rounded(0.56, 0.4, 0.1, 0, 1.62, 0.05, 0xffffff, 0.35),
    rounded(0.46, 0.3, 0.08, 0, 1.62, 0.056, 0xffffff, 0.07),
    plane(0.72, 0.5, 0, 0.72, 0.049, 0xffffff, 0.82),
    plane(0.9, 0.22, 0, 0.16, 0.052, 0xffffff, 0.5),
    box(0.035, 0.24, 0.05, 0.36, 1.05, 0.08, 0xffffff, 0.8),
    plane(0.26, 0.11, 0, 2.0, 0.05, 0xffffff, 0.12),
  ]);

  // A bulkhead lamp over a door: housing, lens, two guard bars.
  const lamp = merged([
    box(0.32, 0.17, 0.12, 0, 0, 0.06, 0x23262a),
    box(0.24, 0.1, 0.02, 0, 0, 0.125, 0xffe2b4, 1.45),
    plane(0.26, 0.012, 0, 0.02, 0.138, 0x23262a),
    plane(0.26, 0.012, 0, -0.02, 0.138, 0x23262a),
  ]);

  // An air unit or vent box on a wall: body and louvres.
  const ventParts = [box(0.9, 0.6, 0.32, 0, 0.3, 0.16, 0xffffff, 0.6)];
  for (let k = 0; k < 6; k++) ventParts.push(plane(0.8, 0.03, 0, 0.08 + k * 0.085, 0.322, 0xffffff, 0.22));
  const vent = merged(ventParts);

  // One metre of balcony railing along +x: rails, a post and flat bars.
  // Flat bars and a boxed top rail: a dozen of these per balcony, a few
  // hundred in sight.
  const railParts = [
    box(1.0, 0.045, 0.045, 0.5, 1.02, 0, 0x1d2124),
    plane(1.0, 0.03, 0.5, 0.1, 0, 0x1d2124),
    plane(0.04, 1.05, 0, 0.52, 0, 0x1d2124),
  ];
  for (let k = 0; k < 7; k++) railParts.push(plane(0.018, 0.9, 0.07 + k * 0.14, 0.56, 0, 0x1d2124));
  const rail = merged(railParts);

  // The stair: treads on a sloping slab, and its railing on the open side.
  const rise = UP / STAIR.steps, going = STAIR.run / STAIR.steps;
  const slope = Math.atan2(UP, STAIR.run), length = Math.hypot(UP, STAIR.run);
  const treads = [];
  for (let k = 0; k < STAIR.steps; k++) {
    treads.push(at(new THREE.BoxGeometry(going + 0.03, rise + 0.02, STAIR.width), k * going + going / 2, (k + 0.5) * rise, STAIR.width / 2));
  }
  const slab = new THREE.BoxGeometry(length, 0.16, STAIR.width);
  slab.rotateZ(slope);
  slab.translate(STAIR.run / 2, UP / 2 - 0.12, STAIR.width / 2);
  treads.push(slab);
  const stair = mergeGeometries(treads.map((g) => g.toNonIndexed()));

  const stairRailParts = [];
  const top = new THREE.BoxGeometry(length, 0.045, 0.045);
  top.rotateZ(slope);
  top.translate(STAIR.run / 2, UP / 2 + 0.98, STAIR.width - 0.04);
  stairRailParts.push(painted(top, 0x1d2124));
  for (let k = 1; k < STAIR.steps; k += 3) {
    stairRailParts.push(box(0.035, 1.0, 0.035, k * going + going / 2, (k + 1) * rise + 0.5, STAIR.width - 0.04, 0x1d2124));
  }
  const stairRail = merged(stairRailParts);

  const pipe = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  // A pool of lamplight on the floor, lying flat, long along x.
  const pool = new THREE.PlaneGeometry(1, 1);
  pool.rotateX(-Math.PI / 2);

  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.45, side: THREE.DoubleSide });
  kit = {
    geometry: { window, door, lamp, vent, rail, stair, stairRail, pipe, pool, concrete: new THREE.BoxGeometry(1, 1, 1) },
    material: {
      window: new THREE.MeshBasicMaterial({ vertexColors: true }),
      door: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.18 }),
      lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
      vent: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 }),
      rail: metal,
      stairRail: metal,
      pipe: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 }),
      // Added on top of the floor's own lighting: the pool light the far
      // galleries cannot get from the few real lights near the player.
      pool: new THREE.MeshBasicMaterial({ map: lightPoolTexture(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    },
    concrete: new Map(),
  };
  return kit;
}

// Concrete for a wear tier, shared by the boxes and the stairs.
function concreteMaterial(tier) {
  const k = parts();
  if (!k.concrete.has(tier)) {
    // Two tiles across a unit box: the boxes are scaled to a few metres, and
    // one stretched tile turns the concrete's pitting into polka dots.
    const surface = resolveSurface(getWallSurface(tier), [2, 2]);
    k.concrete.set(tier, new THREE.MeshStandardMaterial({ map: surface.map, normalMap: surface.normalMap, roughness: 0.93, metalness: 0.03 }));
  }
  return k.concrete.get(tier);
}

// --- Placement in a panel's frame --------------------------------------------

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, "YXZ");
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class Batch {
  constructor() { this.matrices = []; this.colors = []; }
  push(matrix, color) { this.matrices.push(matrix.clone()); this.colors.push(color === undefined ? null : color); }
}

function frame(panel, baseY, x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0, rz = 0) {
  const r = WALL_R - z, cos = Math.cos(panel.theta), sin = Math.sin(panel.theta);
  _p.set(r * cos - x * sin, baseY + y, r * sin + x * cos);
  _e.set(0, -Math.PI / 2 - panel.theta + yaw, rz, "YXZ");
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  return _m.compose(_p, _q, _s);
}

// --- One panel ---------------------------------------------------------------

function dressPanel(b, station, panel, rand, profile) {
  const y0 = station.y;
  const w = panel.width;
  const half = w / 2 - 0.22;
  const wall = new THREE.Color(tint(station.wall));
  const depthShade = profile.paint;

  const concrete = (x0, x1, ya, yb, za, zb, shade = 1) => {
    b.concrete.push(frame(panel, y0, (x0 + x1) / 2, (ya + yb) / 2, (za + zb) / 2, x1 - x0, yb - ya, zb - za), wall.clone().multiplyScalar(shade));
  };
  const windowAt = (x, y, z, scale = 1, sy = scale) => {
    const lit = rand() < profile.lit;
    const color = lit
      ? _c.setHex(WINDOW_PALETTE[Math.floor(rand() * WINDOW_PALETTE.length)]).multiplyScalar(0.55 + rand() * 0.45).clone()
      : new THREE.Color(0.012, 0.013, 0.015);
    b.window.push(frame(panel, y0, x, y, z, scale, sy, 1), color);
  };
  const doorAt = (x, y, z) => {
    const paint = new THREE.Color(DOOR_PAINT[Math.floor(rand() * DOOR_PAINT.length)]).multiplyScalar(depthShade * (0.85 + rand() * 0.25));
    b.door.push(frame(panel, y0, x, y, z), paint);
    b.lamp.push(frame(panel, y0, x, y + 2.5, z));
    // The lamp's light on the gallery floor in front of a ground-floor door.
    if (y === 0) b.pool.push(frame(panel, y0 + 0.014, x, 0, z + 0.75, 2.2, 1, 1.6), new THREE.Color(0xffc48a).multiplyScalar(0.22));
  };
  const railRun = (x0, x1, y, z) => {
    const n = Math.max(1, Math.round(x1 - x0));
    const len = (x1 - x0) / n;
    for (let k = 0; k < n; k++) b.rail.push(frame(panel, y0, x0 + k * len, y, z, len, 1, 1));
  };
  const railSide = (x, y, z1) => b.rail.push(frame(panel, y0, x, y, 0.02, z1, 1, 1, -Math.PI / 2));
  const balcony = (x0, x1, depth) => {
    concrete(x0, x1, UP - 0.2, UP, 0, depth, 0.93);
    railRun(x0, x1, UP, depth - 0.02);
  };
  const vent = (x, y, z) => {
    const tone = 0.75 + rand() * 0.4;
    b.vent.push(frame(panel, y0, x, y, z), new THREE.Color(tone, tone * 0.98, tone * 0.93));
  };
  const pipe = (x, ya, yb, z, radius) => {
    const tone = 0.32 + rand() * 0.2;
    b.pipe.push(frame(panel, y0, x, (ya + yb) / 2, z, radius, yb - ya, radius), new THREE.Color(tone, tone * 1.02, tone * 1.05));
  };

  // The line of the upper storey's floor, across the whole panel.
  concrete(-w * 0.52, w * 0.52, H - 0.06, H + 0.16, 0, 0.16, 0.9);

  // --- Lower storey ---
  let stair = false;
  // Panels beside a wing's doorway can be narrow: a door wants 3.4m of wall,
  // the stair and its landing the whole of a full panel.
  if (panel.kind === "door" && w >= 3.4) {
    const dx = (rand() - 0.5) * 1.3;
    concrete(dx - 0.86, dx + 0.86, 0, 2.78, 0, 0.13, 0.88);
    doorAt(dx, 0, 0.13);
    concrete(dx - 0.7, dx + 0.7, 0, 0.1, 0.13, 0.38, 0.8);
    const wx = dx > 0 ? dx - 1.72 : dx + 1.72;
    if (Math.abs(wx) < half - 0.4) windowAt(wx, 1.5, 0.015, 0.8, 0.85);
  } else if (panel.kind === "porthole" && w >= 3.4) {
    if (w >= STAIR.run + STAIR.landing + 0.37 && rand() < profile.stair) {
      stair = true;
      const x0 = -w / 2 + 0.25;
      const x1 = x0 + STAIR.run;
      b.stair.push(frame(panel, y0, x0, 0, 0), wall.clone().multiplyScalar(0.9));
      b.stairRail.push(frame(panel, y0, x0, 0, 0));
      // The landing, and the door it serves.
      concrete(x1, x1 + STAIR.landing, UP - 0.2, UP, 0, STAIR.width + 0.1, 0.93);
      railRun(x1, x1 + STAIR.landing, UP, STAIR.width + 0.08);
      railSide(x1 + STAIR.landing, UP, STAIR.width + 0.08);
      doorAt(x1 + STAIR.landing / 2, UP, 0.02);
      // A window under the lower flight, and the storey over the stair.
      windowAt(x0 + 0.85, 1.55, 0.015, 0.62, 0.72);
      const blockTop = rand() < 0.5 ? TOP : 6.7;
      concrete(x0 - 0.05, x1 - 0.05, UP, blockTop, 0, 0.55, 0.86 + rand() * 0.12);
      windowAt((x0 + x1) / 2 - 0.7, UP + 1.25, 0.56, 0.75);
      windowAt((x0 + x1) / 2 + 0.7, UP + 1.25, 0.56, 0.75);
      if (blockTop === TOP) windowAt((x0 + x1) / 2, 6.95, 0.56, 0.5, 0.55);
      concrete(x1 - 0.1, x1 + STAIR.landing + 0.1, UP + 2.75, TOP, 0, 0.3, 0.9);
      // Its footprint on the gallery floor: in the ring's frame, x is radial
      // and z runs along the wall.
      station.obstacles.push({ x: WALL_R - STAIR.width / 2, z: (x0 + x1) / 2, hw: STAIR.width / 2 + 0.03, hd: STAIR.run / 2, angle: panel.theta });
    } else {
      windowAt(-1.2, 1.5, 0.015, 0.8, 0.85);
      concrete(0.35, 2.05, 0, 2.78, 0, 0.13, 0.88);
      doorAt(1.2, 0, 0.13);
    }
  }

  // --- Upper storey ---
  if (!stair) {
    const pick = rand();
    if (pick < profile.balcony) {
      const bw = Math.min(2 * half, 2.6 + rand() * 1.3);
      const x0 = -half + rand() * (2 * half - bw), x1 = x0 + bw;
      concrete(x0 - 0.1, x1 + 0.1, UP, UP + 2.75, 0, 0.12, 0.82);
      balcony(x0, x1, 1.05);
      railSide(x0, UP, 1.03);
      railSide(x1, UP, 1.03);
      doorAt(x0 + 0.85, UP, 0.12);
      if (x0 + 2.35 < x1 - 0.5) windowAt(x0 + 2.35, UP + 1.35, 0.125, 0.8, 0.85);
      if (rand() < 0.4) vent(x1 - 0.6, UP + 0.05, 0.12);
      // A low attic storey over the balcony.
      concrete(-w * 0.51, w * 0.51, UP + 2.75, TOP, 0, 0.3, 0.88);
      for (const x of rand() < 0.5 ? [-1.1, 1.1] : [0]) windowAt(x, 7.0, 0.305, 0.5, 0.55);
    } else if (pick < profile.balcony + profile.block) {
      const mw = Math.min(2 * half, 2.4 + rand() * 2.0);
      const x0 = -half + rand() * (2 * half - mw), x1 = x0 + mw;
      const depth = 0.45 + rand() * 0.5;
      const top = rand() < 0.6 ? TOP : 6.6;
      concrete(x0, x1, H + 0.16, top, 0, depth, 0.84 + rand() * 0.18);
      if (top < TOP) concrete(x0 - 0.08, x1 + 0.08, top - 0.14, top, 0, depth + 0.08, 0.78);
      const xs = mw > 3.2 ? [x0 + mw * 0.28, x0 + mw * 0.72] : [(x0 + x1) / 2];
      for (const x of xs) windowAt(x, 4.75, depth + 0.005, 0.85);
      if (top === TOP) for (const x of xs) windowAt(x, 6.7, depth + 0.005, 0.6, 0.62);
      if (rand() < 0.55) vent(xs[0], 3.62, depth);
    } else {
      // Small square windows in a grid on a flush storey (silo-3).
      concrete(-half, half, H + 0.16, TOP, 0, 0.1, 0.92 + rand() * 0.1);
      const cols = rand() < 0.5 ? [-1.3, 0, 1.3] : [-0.9, 0.9];
      for (const y of [4.6, 6.5]) for (const x of cols) {
        if (rand() < 0.22) vent(x, y - 0.3, 0.1);
        else windowAt(x, y, 0.105, 0.55, 0.6);
      }
    }
  }

  // Services: a riser pipe at the panel's edge, a conduit along the storey line.
  if (rand() < 0.32) pipe(rand() < 0.5 ? w / 2 - 0.14 : -w / 2 + 0.14, 0, TOP, 0.11, 0.05 + rand() * 0.035);
  if (rand() < 0.22) b.pipe.push(frame(panel, y0, 0, H - 0.28, 0.1, 0.045, w * 1.02, 0.045, 0, Math.PI / 2), new THREE.Color(0.3, 0.31, 0.32));
}

// --- The silo ----------------------------------------------------------------

function newBatches() {
  return { concrete: new Batch(), stair: new Batch(), window: new Batch(), door: new Batch(), lamp: new Batch(), vent: new Batch(), rail: new Batch(), stairRail: new Batch(), pipe: new Batch(), pool: new Batch() };
}

function instanced(group, geometry, material, batch, name) {
  if (batch.matrices.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, material, batch.matrices.length);
  batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  if (batch.colors.some((c) => c)) batch.colors.forEach((c, i) => mesh.setColorAt(i, c || _c.setRGB(1, 1, 1)));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = `facade-${name}`;
  mesh.raycast = () => {};
  group.add(mesh);
}

export function buildFacades(scene, layout, { range = RANGE } = {}) {
  const k = parts();
  const chunks = [];
  // The top level is dressed by hand (exemplar.js) under its own ceiling.
  const levels = layout.stations.filter((s) => s.index > 0 && s.panels);
  for (let start = 0; start < levels.length; start += BLOCK) {
    const block = levels.slice(start, start + BLOCK);
    const b = newBatches();
    for (const station of block) {
      const profile = profileFor(station.level);
      station.panels.forEach((panel, i) => {
        dressPanel(b, station, panel, mulberry32((station.level * 977 + i * 131) >>> 0), profile);
      });
      // Under the strip lights along the slab edge (station.js places them
      // at the same bearings), a long pool of light on the gallery floor.
      for (let a = 0.12; a < TAU - 1e-6; a += 0.26) {
        if (GALLERY_COLUMNS.angles.some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < 0.09)) continue;
        const r = WORLD.ringInnerR + 1.9;
        _e.set(0, -a - Math.PI / 2, 0);
        _q.setFromEuler(_e);
        _m.compose(_p.set(r * Math.cos(a), station.y + 0.012, r * Math.sin(a)), _q, _s.set(3.6, 1, 2.6));
        b.pool.push(_m, new THREE.Color(0xffd9ae).multiplyScalar(profile.lit * 0.3));
      }
    }
    const group = new THREE.Group(), hardware = new THREE.Group();
    group.name = "facade-block";
    hardware.name = "facade-hardware";
    const concrete = concreteMaterial(wearTierFor(block[Math.floor(block.length / 2)].level));
    instanced(group, k.geometry.concrete, concrete, b.concrete, "concrete");
    instanced(group, k.geometry.stair, concrete, b.stair, "stairs");
    instanced(group, k.geometry.window, k.material.window, b.window, "windows");
    instanced(group, k.geometry.door, k.material.door, b.door, "doors");
    instanced(hardware, k.geometry.lamp, k.material.lamp, b.lamp, "lamps");
    instanced(hardware, k.geometry.vent, k.material.vent, b.vent, "vents");
    instanced(hardware, k.geometry.rail, k.material.rail, b.rail, "railings");
    instanced(hardware, k.geometry.stairRail, k.material.stairRail, b.stairRail, "stair-railings");
    instanced(hardware, k.geometry.pipe, k.material.pipe, b.pipe, "pipes");
    instanced(group, k.geometry.pool, k.material.pool, b.pool, "light-pools");
    scene.add(group, hardware);
    const top = block[0].y + TOP, bottom = block[block.length - 1].y;
    const y = (top + bottom) / 2, half = (top - bottom) / 2;
    chunks.push({ group, y, half, range }, { group: hardware, y, half, range: range * 0.4 });
  }
  return chunks;
}

// Exposed for the tests: the stair's footprint and the storey heights.
export const FACADE_STAIR = STAIR;
export const FACADE_LEVELS = { lower: H, upper: UP, top: TOP, levelHeight: LEVEL_HEIGHT, turn: TAU };
