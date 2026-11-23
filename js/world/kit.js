import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makePlaqueTexture } from "../textures.js";
import { letteringMaterial, mountPlate } from "./signs.js";
import { addFixtureLight } from "./fixtures.js";

// A furnishing kit for rooms: boxes, cylinders and panels from one shared
// palette, merged per material when the room is done. A furnished room is
// a few hundred parts; as separate meshes that is a few hundred draw calls
// and a material each (the trap materials.js describes), merged it is one
// draw call per material used, typically ten or so.
//
// Coordinates are the wing's own frame (station.js buildWing): x out from the
// silo's axis along the corridor, z across, y up from the floor. Anything
// marked solid that crosses a body's height becomes an obstacle for the
// collision, in the same frame (group.userData.collision).

const PALETTE = {
  concrete: { color: 0x9aa1a6, roughness: 0.94 },
  darkConcrete: { color: 0x5d6266, roughness: 0.95 },
  tile: { color: 0xc9ccc4, roughness: 0.42 },
  plaster: { color: 0xb8b4a6, roughness: 0.9 },
  paintGreen: { color: 0x5b6b5e, roughness: 0.6, metalness: 0.18 },
  paintBlue: { color: 0x56687a, roughness: 0.6, metalness: 0.18 },
  paintCream: { color: 0xcfc6ad, roughness: 0.62, metalness: 0.1 },
  paintRed: { color: 0x8a3b30, roughness: 0.6, metalness: 0.15 },
  paintOlive: { color: 0x6b6a4a, roughness: 0.65, metalness: 0.15 },
  paintTeal: { color: 0x3f6a68, roughness: 0.6, metalness: 0.2 },
  paintOrange: { color: 0xb8662e, roughness: 0.6, metalness: 0.15 },
  steel: { color: 0x8a9096, roughness: 0.42, metalness: 0.55 },
  darkMetal: { color: 0x2a2d31, roughness: 0.5, metalness: 0.5 },
  brass: { color: 0x9a8455, roughness: 0.42, metalness: 0.7 },
  copper: { color: 0x9a5f3e, roughness: 0.45, metalness: 0.65 },
  rust: { color: 0x6e4a36, roughness: 0.85, metalness: 0.25 },
  wood: { color: 0x7a5a3e, roughness: 0.72 },
  darkWood: { color: 0x4a3626, roughness: 0.7 },
  paleWood: { color: 0xa88a62, roughness: 0.7 },
  fabricRed: { color: 0x8c3f34, roughness: 0.95 },
  fabricBlue: { color: 0x3d5570, roughness: 0.95 },
  fabricGreen: { color: 0x4f6447, roughness: 0.95 },
  fabricMustard: { color: 0xa88a3a, roughness: 0.95 },
  fabricGrey: { color: 0x6c6e6c, roughness: 0.95 },
  linen: { color: 0xd8d4c6, roughness: 0.92 },
  terracotta: { color: 0xa8502f, roughness: 0.85 },
  paper: { color: 0xe3dcc6, roughness: 0.9 },
  cardboard: { color: 0x9a7d55, roughness: 0.95 },
  rubber: { color: 0x1b1c1e, roughness: 0.9 },
  ceramic: { color: 0xdcd8cc, roughness: 0.35 },
  glassDark: { color: 0x1a2428, roughness: 0.15, metalness: 0.3 },
  leaf: { color: 0x4f6a3e, roughness: 0.9 },
  soil: { color: 0x3a2e24, roughness: 1 },
  rock: { color: 0x4a4038, roughness: 0.99 },
  chalkboard: { color: 0x26302a, roughness: 0.9 },
  skyPaint: { color: 0x7fa6c4, roughness: 0.85 },
  leafLight: { color: 0x6f8a4a, roughness: 0.9 },
  // Lit surfaces: unlit materials, so they read as light sources.
  glowWarm: { basic: 0xffd9a0, boost: 1.6 },
  glowWhite: { basic: 0xf2f4ee, boost: 1.5 },
  glowGreen: { basic: 0x7cff9a, boost: 1.2 },
  glowAmber: { basic: 0xffb347, boost: 1.4 },
  glowRed: { basic: 0xff4a33, boost: 1.4 },
  glowCyan: { basic: 0x8fe0ff, boost: 1.3 },
  glowGrow: { basic: 0xe8b6ff, boost: 1.3 },
  screen: { basic: 0x2f6b4a, boost: 1.1 },
};

const materials = new Map();
export function kitMaterial(name) {
  if (!materials.has(name)) {
    const spec = PALETTE[name];
    if (!spec) throw new Error(`kit: no material "${name}"`);
    materials.set(name, spec.basic !== undefined
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.basic).multiplyScalar(spec.boost || 1) })
      : new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.roughness ?? 0.8, metalness: spec.metalness ?? 0.04, side: THREE.DoubleSide }));
  }
  return materials.get(name);
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _box = new THREE.Box3();

export class Kit {
  constructor(group, { solid = true } = {}) {
    this.group = group;
    this.parts = new Map();
    this.solidByDefault = solid;
  }

  add(geometry, material, { x = 0, y = 0, z = 0, rotX = 0, rotY = 0, rotZ = 0, solid = this.solidByDefault } = {}) {
    _e.set(rotX, rotY, rotZ);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(_m);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geometry.index ? geometry.toNonIndexed() : geometry);
    if (solid) this.obstacle(geometry);
    return this;
  }

  // Registers what a geometry occupies at body height as an obstacle.
  obstacle(geometry) {
    const collision = this.group.userData.collision;
    if (!collision) return;
    geometry.computeBoundingBox();
    _box.copy(geometry.boundingBox);
    if (_box.max.y <= 0.18 || _box.min.y >= 1.8) return;
    collision.station.obstacles.push({
      x: (_box.min.x + _box.max.x) / 2, z: (_box.min.z + _box.max.z) / 2,
      hw: (_box.max.x - _box.min.x) / 2, hd: (_box.max.z - _box.min.z) / 2, angle: collision.angle,
    });
  }

  // An obstacle with nothing drawn: the footprint of a piece made of thin
  // parts (a bunk, a shelf unit) that the body should not walk through.
  block(x, z, w, d, rotY = 0) {
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    const g = new THREE.BoxGeometry(w * c + d * s, 1, w * s + d * c);
    g.translate(x, 0.9, z);
    this.obstacle(g);
    g.dispose();
    return this;
  }

  // A box by its centre and size.
  box(x, y, z, w, h, d, mat, opts = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), kitMaterial(mat), { x, y, z, ...opts });
  }

  // A box by its extents: x0..x1, y0..y1, z0..z1.
  span(x0, x1, y0, y1, z0, z1, mat, opts = {}) {
    return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), mat, opts);
  }

  cyl(x, y, z, r, h, mat, { r2 = r, seg = 14, open = false, ...opts } = {}) {
    return this.add(new THREE.CylinderGeometry(r, r2, h, seg, 1, open), kitMaterial(mat), { x, y, z, ...opts });
  }

  // A flat panel; by default it faces +x (back into the room from a far wall).
  panel(x, y, z, w, h, mat, { rotY = -Math.PI / 2, ...opts } = {}) {
    return this.add(new THREE.PlaneGeometry(w, h), kitMaterial(mat), { x, y, z, rotY, solid: false, ...opts });
  }

  torus(x, y, z, r, tube, mat, { arc = Math.PI * 2, seg = 16, ...opts } = {}) {
    return this.add(new THREE.TorusGeometry(r, tube, 6, seg, arc), kitMaterial(mat), { x, y, z, solid: false, ...opts });
  }

  // A tube between two points (pipes, rails, rods).
  rod(a, b, r, mat, { seg = 8, solid = false } = {}) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const length = from.distanceTo(to);
    const geometry = new THREE.CylinderGeometry(r, r, length, seg, 1, false);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    geometry.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    if (!this.parts.has(kitMaterial(mat))) this.parts.set(kitMaterial(mat), []);
    this.parts.get(kitMaterial(mat)).push(geometry.toNonIndexed());
    if (solid) this.obstacle(geometry);
    return this;
  }

  // A plate with lettering, flat on a wall (signs.js: single-sided, with a body).
  sign(lines, { x, y, z, w = 1.2, h = 0.4, rotY = -Math.PI / 2, fg = 0xd7cdb0, bg = 0x23282a } = {}) {
    mountPlate(this.group, letteringMaterial(makePlaqueTexture(lines, { fg, bg })), { w, h, x, y, z, rotY, depth: 0.03 });
    return this;
  }

  light(x, y, z, color, intensity = 10, distance = 13, ceilingY = null) {
    addFixtureLight(this.group, { x, y, z, color, intensity, distance, glow: false, ...(ceilingY ? { ceilingY } : {}) });
    return this;
  }

  // Merges everything added so far, one mesh per material.
  finish() {
    for (const [material, geometries] of this.parts) {
      for (const g of geometries) {
        for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
        if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      }
      const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      if (material.isMeshBasicMaterial) mesh.raycast = () => {};
      this.group.add(mesh);
    }
    this.parts.clear();
  }
}

// --- Furniture ---------------------------------------------------------------
// Each takes the kit and a placement in the room's frame. `rotY` turns the
// piece about its own centre; furniture is laid out facing -x (towards the
// corridor) unless turned.

// Rotates a local offset (dx, dz) by rotY.
function turn(rotY, dx, dz) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return [dx * c + dz * s, -dx * s + dz * c];
}
function partAt(kit, x, z, rotY, dx, y, dz, w, h, d, mat, opts = {}) {
  const [ox, oz] = turn(rotY, dx, dz);
  kit.box(x + ox, y, z + oz, w, h, d, mat, { rotY, ...opts });
}

export function desk(kit, x, z, { rotY = 0, w = 1.5, d = 0.75, mat = "paintGreen", top = "darkWood" } = {}) {
  partAt(kit, x, z, rotY, 0, 0.74, 0, w, 0.05, d, top);
  partAt(kit, x, z, rotY, -w / 2 + 0.22, 0.36, 0, 0.42, 0.72, d - 0.06, mat);
  partAt(kit, x, z, rotY, w / 2 - 0.03, 0.36, 0, 0.04, 0.72, d - 0.06, mat, { solid: false });
}

export function chair(kit, x, z, { rotY = 0, mat = "darkMetal", seat = "fabricGrey" } = {}) {
  partAt(kit, x, z, rotY, 0, 0.45, 0, 0.44, 0.06, 0.44, seat);
  partAt(kit, x, z, rotY, 0.2, 0.75, 0, 0.05, 0.55, 0.42, seat, { solid: false });
  for (const [dx, dz] of [[-0.18, -0.18], [-0.18, 0.18], [0.18, -0.18], [0.18, 0.18]]) partAt(kit, x, z, rotY, dx, 0.22, dz, 0.03, 0.44, 0.03, mat, { solid: false });
}

// A bulky CRT terminal: case, screen, keyboard.
export function terminal(kit, x, y, z, { rotY = 0, glow = "screen" } = {}) {
  partAt(kit, x, z, rotY, 0.05, y + 0.2, 0, 0.42, 0.38, 0.44, "paintCream", { solid: false });
  partAt(kit, x, z, rotY, -0.172, y + 0.22, 0, 0.01, 0.26, 0.32, glow, { solid: false });
  partAt(kit, x, z, rotY, -0.32, y + 0.02, 0, 0.18, 0.03, 0.44, "paintCream", { solid: false });
}

export function filingCabinet(kit, x, z, { rotY = 0, h = 1.3, mat = "paintOlive" } = {}) {
  partAt(kit, x, z, rotY, 0, h / 2, 0, 0.62, h, 0.48, mat);
  const drawers = Math.round(h / 0.33);
  for (let k = 0; k < drawers; k++) partAt(kit, x, z, rotY, -0.315, 0.2 + k * (h / drawers), 0, 0.02, 0.03, 0.16, "steel", { solid: false });
}

export function shelf(kit, x, z, { rotY = 0, w = 1.8, d = 0.45, h = 2.1, levels = 5, mat = "steel", items = null, rand = Math.random } = {}) {
  for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) partAt(kit, x, z, rotY, dz, h / 2, dx, 0.04, h, 0.04, mat, { solid: false });
  for (let k = 0; k < levels; k++) {
    const y = 0.12 + (k * (h - 0.2)) / (levels - 1);
    partAt(kit, x, z, rotY, 0, y, 0, d, 0.03, w, mat, { solid: false });
    if (items && k < levels - 1) items(kit, y + 0.015, k);
  }
  // One obstacle for the whole unit.
  kit.block(x, z, d, w, rotY);
}

// Rows of boxes, binders or jars on a shelf at height y, along the shelf's width.
export function shelfLoad(kit, x, z, y, { rotY = 0, w = 1.8, d = 0.45, mats = ["cardboard"], size = [0.3, 0.26, 0.3], gap = 0.06, rand = Math.random, fill = 0.85 } = {}) {
  let along = -w / 2 + 0.05;
  while (along + size[2] < w / 2 - 0.04) {
    if (rand() < fill) {
      const h = size[1] * (0.75 + rand() * 0.4);
      partAt(kit, x, z, rotY, (rand() - 0.5) * 0.04, y + h / 2, along + size[2] / 2, Math.min(size[0], d - 0.04), h, size[2], mats[Math.floor(rand() * mats.length)], { solid: false });
    }
    along += size[2] + gap;
  }
}

export function bunk(kit, x, z, { rotY = 0, mat = "steel", blanket = "fabricGrey", double = false } = {}) {
  const levels = double ? [0.42, 1.45] : [0.42];
  for (const y of levels) {
    partAt(kit, x, z, rotY, 0, y, 0, 0.9, 0.06, 1.95, mat, { solid: false });
    partAt(kit, x, z, rotY, 0, y + 0.1, 0, 0.84, 0.14, 1.9, blanket, { solid: false });
    partAt(kit, x, z, rotY, 0, y + 0.2, -0.75, 0.6, 0.1, 0.35, "linen", { solid: false });
  }
  const top = double ? 1.65 : 0.6;
  for (const [dx, dz] of [[-0.43, -0.95], [-0.43, 0.95], [0.43, -0.95], [0.43, 0.95]]) partAt(kit, x, z, rotY, dx, top / 2, dz, 0.04, top, 0.04, mat, { solid: false });
  kit.block(x, z, 0.9, 1.95, rotY);
}

// A barred grille across an opening, along z from z0 to z1 at x.
export function bars(kit, x, z0, z1, { h = 2.6, step = 0.14, mat = "darkMetal", door = null } = {}) {
  for (let z = z0; z <= z1 + 1e-6; z += step) kit.cyl(x, h / 2, z, 0.016, h, mat, { seg: 6, solid: false });
  for (const y of [0.12, h - 0.12, h * 0.55]) kit.box(x, y, (z0 + z1) / 2, 0.05, 0.05, z1 - z0, mat, { solid: false });
  // One wall of obstacle for the whole grille.
  kit.block(x, (z0 + z1) / 2, 0.08, z1 - z0 + 0.06);
}

// A pendant work lamp from a ceiling at `ceilingY`.
export function pendant(kit, x, z, ceilingY, { drop = 0.6, r = 0.26, shade = "darkMetal", glow = "glowWarm" } = {}) {
  kit.cyl(x, ceilingY - drop / 2, z, 0.012, drop, "darkMetal", { seg: 5, solid: false });
  kit.cyl(x, ceilingY - drop - 0.09, z, 0.06, r, shade, { r2: r, seg: 14, open: true, solid: false });
  kit.cyl(x, ceilingY - drop - 0.17, z, r * 0.6, 0.02, glow, { seg: 12, solid: false });
}

// A fluorescent fitting flat on a ceiling.
export function ceilingPanel(kit, x, z, ceilingY, { w = 1.25, d = 0.32, rotY = 0, glow = "glowWhite" } = {}) {
  kit.box(x, ceilingY - 0.03, z, w + 0.08, 0.06, d + 0.08, "darkMetal", { rotY, solid: false });
  kit.box(x, ceilingY - 0.065, z, w, 0.012, d, glow, { rotY, solid: false });
}

// Wall-mounted run of conduit along x at height y, on the side wall z.
export function conduit(kit, x0, x1, y, z, { r = 0.035, mat = "darkMetal" } = {}) {
  kit.rod([x0, y, z], [x1, y, z], r, mat);
  for (let x = x0 + 0.4; x < x1; x += 1.2) kit.box(x, y, z, 0.05, r * 3, r * 3, "steel", { solid: false });
}

// A gauge or dial: bezel, face and needle, facing -x.
export function gauge(kit, x, y, z, { r = 0.12, face = "paper" } = {}) {
  kit.cyl(x, y, z, r, 0.05, "brass", { rotZ: Math.PI / 2, seg: 14, solid: false });
  kit.cyl(x - 0.026, y, z, r * 0.84, 0.01, face, { rotZ: Math.PI / 2, seg: 14, solid: false });
  kit.box(x - 0.034, y + r * 0.2, z + r * 0.15, 0.006, r * 0.7, 0.012, "darkMetal", { rotX: 0.7, solid: false });
}

// An analogue control desk: sloped panel with dials and switches, facing -x.
export function controlDesk(kit, x, z, { w = 2.2, rand = Math.random, rotY = 0 } = {}) {
  partAt(kit, x, z, rotY, 0, 0.45, 0, 0.8, 0.9, w, "paintGreen");
  partAt(kit, x, z, rotY, 0.12, 1.05, 0, 0.55, 0.32, w, "paintGreen", { rotZ: 0, solid: false });
  for (let k = 0; k < Math.floor(w / 0.32); k++) {
    const dz = -w / 2 + 0.2 + k * 0.32;
    const [ox, oz] = turn(rotY, -0.17, dz);
    kit.cyl(x + ox, 1.12, z + oz, 0.06, 0.03, "paper", { rotZ: Math.PI / 2, rotY, seg: 10, solid: false });
    const [sx, sz] = turn(rotY, -0.4, dz);
    kit.box(x + sx, 0.91, z + sz, 0.04, 0.03, 0.05, rand() < 0.3 ? "glowRed" : rand() < 0.5 ? "glowAmber" : "glowGreen", { rotY, solid: false });
  }
}

export function crate(kit, x, y, z, { s = 0.6, mat = "paleWood", rotY = 0, solid = true } = {}) {
  kit.box(x, y + s / 2, z, s, s, s, mat, { rotY, solid });
  kit.box(x, y + s / 2, z, s + 0.02, 0.06, s + 0.02, "darkWood", { rotY, solid: false });
}

export function barrel(kit, x, z, { mat = "rust", h = 0.9, r = 0.3 } = {}) {
  kit.cyl(x, h / 2, z, r, h, mat, { seg: 14 });
  for (const y of [0.15, h - 0.15]) kit.torus(x, y, z, r + 0.005, 0.018, "darkMetal", { rotX: Math.PI / 2, seg: 14 });
}

export function locker(kit, x, z, { rotY = 0, count = 4, mat = "paintBlue" } = {}) {
  const w = 0.42;
  for (let k = 0; k < count; k++) {
    const dz = (k - (count - 1) / 2) * w;
    partAt(kit, x, z, rotY, 0, 0.95, dz, 0.5, 1.9, w - 0.015, mat, { solid: false });
    for (let v = 0; v < 3; v++) partAt(kit, x, z, rotY, -0.252, 1.62 + v * 0.06, dz, 0.01, 0.025, 0.24, "darkMetal", { solid: false });
    partAt(kit, x, z, rotY, -0.26, 1.0, dz + 0.13, 0.02, 0.12, 0.03, "steel", { solid: false });
  }
  kit.block(x, z, 0.5, count * w, rotY);
}

export function bench(kit, x, z, { rotY = 0, len = 1.6, mat = "wood" } = {}) {
  partAt(kit, x, z, rotY, 0, 0.44, 0, 0.36, 0.05, len, mat);
  for (const dz of [-len / 2 + 0.15, len / 2 - 0.15]) partAt(kit, x, z, rotY, 0, 0.21, dz, 0.3, 0.42, 0.05, "darkMetal", { solid: false });
}

export function plant(kit, x, y, z, { s = 1, pot = "terracotta" } = {}) {
  kit.cyl(x, y + 0.12 * s, z, 0.13 * s, 0.24 * s, pot, { r2: 0.1 * s, seg: 10, solid: false });
  for (let k = 0; k < 6; k++) {
    const a = k * 2.4;
    kit.box(x + Math.cos(a) * 0.1 * s, y + (0.32 + k * 0.05) * s, z + Math.sin(a) * 0.1 * s, 0.26 * s, 0.02 * s, 0.08 * s, "leaf", { rotY: -a, rotZ: 0.35, solid: false });
  }
}

// A crop or seedling: blades fanning out from the soil, leaning outward.
export function sprout(kit, x, y, z, { h = 0.35, rand = Math.random, mat = "leaf" } = {}) {
  const blades = 4 + Math.floor(rand() * 3), turn0 = rand() * Math.PI;
  for (let k = 0; k < blades; k++) {
    const a = turn0 + (k / blades) * Math.PI * 2, len = h * (0.7 + rand() * 0.5), tilt = 0.35 + rand() * 0.5;
    kit.box(x + Math.cos(a) * len * 0.25, y + len * 0.45, z + Math.sin(a) * len * 0.25, len * 0.12, len, 0.012, k % 2 ? mat : "leafLight", { rotY: -a + Math.PI / 2, rotX: 0, rotZ: 0, solid: false });
    // Lean it: a second, tipped blade reads as foliage from any side.
    kit.box(x + Math.cos(a) * len * 0.4, y + len * 0.3, z + Math.sin(a) * len * 0.4, len * 0.7, 0.012, len * 0.14, mat, { rotY: -a, rotZ: tilt, solid: false });
  }
}

export function bottles(kit, x, y, z, { count = 6, along = "z", spacing = 0.12, mats = ["glassDark", "ceramic", "brass"], rand = Math.random } = {}) {
  for (let k = 0; k < count; k++) {
    const off = (k - (count - 1) / 2) * spacing;
    const h = 0.14 + rand() * 0.12;
    kit.cyl(along === "z" ? x : x + off, y + h / 2, along === "z" ? z + off : z, 0.035, h, mats[Math.floor(rand() * mats.length)], { seg: 8, solid: false });
  }
}

// A cork board with notices pinned to it, on a wall facing `rotY`.
// `rotY` turns a panel whose front is +z: -PI/2 faces -x (a far wall), 0 faces
// +z, PI faces -z.
export function noticeBoard(kit, x, y, z, { w = 1.2, h = 0.8, rotY = -Math.PI / 2, rand = Math.random } = {}) {
  kit.add(new THREE.BoxGeometry(w, h, 0.03), kitMaterial("cardboard"), { x, y, z, rotY, solid: false });
  const ax = Math.cos(rotY), az = -Math.sin(rotY), nx = Math.sin(rotY), nz = Math.cos(rotY);
  for (let k = 0; k < 7; k++) {
    const u = (rand() - 0.5) * (w - 0.25);
    kit.add(new THREE.PlaneGeometry(0.18 + rand() * 0.06, 0.24), kitMaterial("paper"), { x: x + ax * u + nx * 0.02, y: y + (rand() - 0.5) * (h - 0.3), z: z + az * u + nz * 0.02, rotY, rotZ: (rand() - 0.5) * 0.12, solid: false });
  }
}

// A flat thing on a wall, by the same convention: a chalkboard, a map, a poster.
export function wallPanel(kit, x, y, z, w, h, mat, { rotY = -Math.PI / 2, depth = 0.03 } = {}) {
  kit.add(new THREE.BoxGeometry(w, h, depth), kitMaterial(mat), { x, y, z, rotY, solid: false });
}

// --- People and relics ---------------------------------------------------------

// Somebody belongs here (people.js): a spot in the wing's frame, turned to
// the world's. `yaw` faces the body's front along local +z at 0, +x at PI/2,
// -x at -PI/2. `pose`: work, sit, chat, lean. `character`: a named person of
// the journey (quests.js).
export function personAt(group, x, z, yaw, pose = "work", extra = {}) {
  const c = group.userData.collision;
  if (!c) return;
  const a = c.angle, st = c.station;
  (st.npcSpots ||= []).push({ x: x * Math.cos(a) - z * Math.sin(a), z: x * Math.sin(a) + z * Math.cos(a), yaw: yaw - a, pose, ...extra });
}

// One of the five relics (quests.js RELICS), small and faintly catching the
// light, where the player can pick it up. Registered with the interactables.
const relicMaterial = new THREE.MeshStandardMaterial({ color: 0xd9c08a, emissive: 0x3a2a12, emissiveIntensity: 1, roughness: 0.45, metalness: 0.35 });
const relicShapes = {
  livro: () => new THREE.BoxGeometry(0.22, 0.04, 0.3),
  semente: () => new THREE.BoxGeometry(0.12, 0.01, 0.18),
  retalho: () => new THREE.BoxGeometry(0.26, 0.03, 0.2),
  frasco: () => new THREE.CylinderGeometry(0.04, 0.045, 0.16, 10),
  isqueiro: () => new THREE.BoxGeometry(0.04, 0.07, 0.025),
};
export function relicAt(group, interactables, id, x, y, z) {
  const c = group.userData.collision;
  if (!interactables || !c) return null;
  const geometry = relicShapes[id]?.() || new THREE.BoxGeometry(0.15, 0.1, 0.15);
  geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(geometry, relicMaterial);
  mesh.position.set(x, y - geometry.boundingBox.min.y, z);
  mesh.rotation.y = 0.4;
  mesh.name = `relic-${id}`;
  group.add(mesh);
  // A bigger, invisible target: a lighter is hard to point at.
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
  target.position.set(x, y + 0.1, z);
  group.add(target);
  interactables.push({ mesh: target, relic: id, visual: mesh, station: c.station });
  return mesh;
}
