import * as THREE from "three";
import { appendSweptSolid, meshData } from "../geometry.js";
import { geometryFromData } from "./primitives.js";
import { WORLD } from "../config.js";
import { lerp } from "../mathutils.js";
import { makePlaqueTexture, mulberry32 } from "../textures.js";
import { getStructureSurface } from "./materials.js";
import {
  HelixCurve,
  PARAPET_HEIGHT,
  PARAPET_THICKNESS,
  addGlow,
  addInstancedBatch,
  splitAngleRangeByGaps,
  yAtTheta,
} from "./primitives.js";

const LIGHT_INTENSITY = 16;
const LIGHT_DISTANCE = 13;

// Every one of these sits near a room's ceiling, so it hangs from it by
// default - the visible half used to be a bare emissive ball with nothing
// holding it up. Pass `glow: false` where the light belongs to machinery that
// is already drawn (a furnace mouth) and needs no lamp of its own.
export function addFixtureLight(group, { x, y, z, color = 0xffaa55, intensity = LIGHT_INTENSITY, distance = LIGHT_DISTANCE, ceilingY = WORLD.roomHeight, glow = true }) {
  // Global punch multiplier: ambient fill was lowered to bring back contrast,
  // so the practical lights have to carry more of the room.
  const light = new THREE.PointLight(color, intensity * 1.9, distance * 1.25, 2);
  light.position.set(x, y, z);
  group.add(light);
  if (glow) addGlow(group, { x, y, z, color, mount: "ceiling", ceilingY });
  return light;
}

// How many distinct door-number plates each floor gets before they repeat.
const PLATE_POOL_SIZE = 3;

// How far a hung lantern's shade sits below the ceiling it is bolted to.
export const LANTERN_DROP = 0.5;

// Parapet top finishes. Both shared: buildParapet runs ~63 times per silo, and
// a material per call is the per-instance allocation trap all over again.
const COPING_HEIGHT = 0.09;
// Built on first use, not at import: getStructureSurface() draws a canvas, and
// module-load side effects are not the place for that.
let copingMat = null;
function getCopingMat() {
  if (!copingMat) copingMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xb2ab99, roughness: 0.92, metalness: 0.03, side: THREE.DoubleSide });
  return copingMat;
}
let capRailMat = null;
function getCapRailMat() {
  if (!capRailMat) capRailMat = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide });
  return capRailMat;
}

const WINDOW_PALETTE = [0xffc98a, 0xffb367, 0xf7e2b0, 0x9fd8ff, 0xd8eaff, 0xffa64d];

// A band of apartment windows around a facade. Lit and unlit ones are mixed
// through per-instance colours, which is what stops a stacked level from
// looking like a repeating texture.
export function buildWindowBand(group, { radius, y, count, seed = 1, facingOut = false, litChance = 0.68 }) {
  const rand = mulberry32(Math.floor(seed * 7919) >>> 0);
  const geo = new THREE.PlaneGeometry(1.15, 0.72);
  const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2 + rand() * 0.02;
    dummy.position.set(radius * Math.cos(theta), y, radius * Math.sin(theta));
    // PlaneGeometry faces +Z; this turns it to face along the radius.
    dummy.rotation.set(0, facingOut ? Math.PI / 2 - theta + Math.PI : Math.PI / 2 - theta, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    if (rand() < litChance) {
      const hex = WINDOW_PALETTE[Math.floor(rand() * WINDOW_PALETTE.length)];
      color.setHex(hex).multiplyScalar(1.25 + rand() * 1.5);
    } else {
      color.setRGB(0.04, 0.045, 0.05); // dark, nobody home
    }
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return mesh;
}

// Closed apartment/service doors around the ring wall, facing the hall.
// Purely decorative (they never open), but the reference stills show the
// ring lined with dozens of them, and that is most of what makes a floor
// read as inhabited rather than empty.
export function buildRingDoors(group, doors, { wallColor, accentColor }) {
  if (doors.length === 0) return;
  const at = (r, theta, y) => ({ x: r * Math.cos(theta), y, z: r * Math.sin(theta), rotY: -theta });

  addInstancedBatch(
    group,
    new THREE.BoxGeometry(0.08, 2.25, 1.15),
    new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide }),
    doors.map((d) => at(d.r, d.theta, 1.12))
  );
  addInstancedBatch(
    group,
    new THREE.BoxGeometry(0.06, 2.0, 0.92),
    new THREE.MeshStandardMaterial({ color: 0x3b3a35, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
    doors.map((d) => at(d.r - 0.05, d.theta, 1.0))
  );
  addInstancedBatch(
    group,
    new THREE.BoxGeometry(0.05, 0.5, 0.05),
    new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.75, side: THREE.DoubleSide }),
    doors.map((d) => at(d.r - 0.1, d.theta, 1.05))
  );

  // Number plates: a small pool of textures cycled across the doors rather
  // than one canvas per door. A unique texture per door meant ~100 one-off
  // canvases for the silo, each uploading to the GPU the moment the player
  // first sees it - which shows up as a hitch when walking onto a floor.
  const plateGeo = new THREE.PlaneGeometry(0.46, 0.23);
  const platePool = doors.slice(0, PLATE_POOL_SIZE).map((d) =>
    new THREE.MeshBasicMaterial({
      map: makePlaqueTexture([d.label], { width: 192, height: 96, fg: 0xe6dcbe, bg: 0x14161a }),
      side: THREE.DoubleSide,
    })
  );
  doors.forEach((d, i) => {
    const plate = new THREE.Mesh(plateGeo, platePool[i % platePool.length]);
    const r = d.r - 0.07;
    plate.position.set(r * Math.cos(d.theta), 2.45, r * Math.sin(d.theta));
    plate.rotation.y = Math.PI / 2 - d.theta;
    group.add(plate);
  });
}

// Hanging barrel lanterns (the strung lamps under the ring slabs in the
// reference stills). Emissive only - no real light, so they are nearly free.
// `y` is the CEILING the lantern hangs from, not the lamp itself - the stem is
// then generated to span the whole drop, so the fixture can never end up
// hanging from thin air the way a fixed-length stem does when the room height
// changes underneath it.
export function buildLanterns(group, lanterns, color, drop = LANTERN_DROP) {
  if (lanterns.length === 0) return;
  const at = (l, dy) => ({ x: l.r * Math.cos(l.theta), y: l.y - drop + dy, z: l.r * Math.sin(l.theta) });

  addInstancedBatch(
    group,
    new THREE.CylinderGeometry(0.025, 0.025, drop, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.65 }),
    lanterns.map((l) => at(l, drop / 2))
  );
  addInstancedBatch(
    group,
    new THREE.CylinderGeometry(0.17, 0.23, 0.34, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.0) }),
    lanterns.map((l) => at(l, -0.17))
  );
  addInstancedBatch(
    group,
    new THREE.CylinderGeometry(0.1, 0.18, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.65 }),
    lanterns.map((l) => at(l, 0.02))
  );
}

// Single hanging lantern in a wing room's local frame (rooms have only one
// or two, so instancing would cost more than it saves). `y` is the ceiling,
// same convention as buildLanterns.
export function addLantern(group, { x, z, y, color, drop = LANTERN_DROP }) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, drop, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.65 }));
  stem.position.set(x, y - drop / 2, z);
  group.add(stem);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.34, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.0) }));
  shade.position.set(x, y - drop - 0.17, z);
  group.add(shade);
}
export function addPorthole(group, { r, theta, y }) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0x63625c, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
  frame.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  frame.rotation.y = -theta;
  group.add(frame);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.12, metalness: 0.2, side: THREE.DoubleSide }));
  glass.position.set((r - 0.02) * Math.cos(theta), y, (r - 0.02) * Math.sin(theta));
  glass.rotation.y = -theta;
  group.add(glass);
}

// A solid concrete guard wall (not an open baluster railing - the reference
// stills show a thick poured-concrete parapet with only a thin dark metal
// cap bar on top), following a helix (or, with yStart===yEnd, a flat arc).
// `gaps` (optional) cuts real openings where something - a bridge, say -
// needs to cross through the wall.
// `inset` shifts the wall's centreline radially so its footprint sits fully on
// the slab it guards instead of straddling the edge: a 0.22m wall centred
// exactly on the slab's rim leaves 11cm cantilevered over the void, which
// reads as a floating lip when seen from the far side of the shaft. Positive
// pushes outward (guarding an inner edge), negative inward (an outer edge).
// `cap` is what finishes the top of the wall:
//   "rail"   - a thin dark metal bar, for the hall guard walls.
//   "coping" - a cast concrete coping, slightly proud of the wall on both
//              faces. The stairs use this: in the references the stairwell is
//              one continuous poured-concrete edge, with no pipe running along
//              the top of it.
export function buildParapet(scene, thetaStart, thetaEnd, yStart, yEnd, radiusFn, gaps = [], inset = 0, cap = "rail") {
  const wallR = (t) => radiusFn(t) + inset;
  const spans = splitAngleRangeByGaps(thetaStart, thetaEnd, gaps);
  const wall = meshData(), coping = meshData();
  for (const span of spans) {
    const progress = (t) => (lerp(span.start, span.end, t) - thetaStart) / (thetaEnd - thetaStart);
    const y = (t) => lerp(yStart, yEnd, progress(t));
    const radius = (t) => wallR(progress(t));
    const shape = { start: span.start, end: span.end, segments: Math.max(2, Math.ceil((span.end - span.start) / 0.045)) };
    appendSweptSolid(wall, { ...shape, inner: (t) => radius(t) - PARAPET_THICKNESS / 2, outer: (t) => radius(t) + PARAPET_THICKNESS / 2, bottom: (t) => y(t) - 0.22, top: (t) => y(t) + PARAPET_HEIGHT });
    if (cap === "coping") appendSweptSolid(coping, { ...shape, inner: (t) => radius(t) - PARAPET_THICKNESS / 2 - 0.035, outer: (t) => radius(t) + PARAPET_THICKNESS / 2 + 0.035, bottom: (t) => y(t) + PARAPET_HEIGHT, top: (t) => y(t) + PARAPET_HEIGHT + COPING_HEIGHT });
    if (cap === "rail") {
      const curve = new HelixCurve(span.start, span.end, y(0), y(1), PARAPET_HEIGHT + 0.03, (t) => radius(t));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, shape.segments, 0.035, 6, false), getCapRailMat()));
    }
  }
  const wallMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xb1b2a8, roughness: 0.96, metalness: 0.01, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(geometryFromData(wall), wallMat));
  if (coping.positions.length) scene.add(new THREE.Mesh(geometryFromData(coping), getCopingMat()));
}
