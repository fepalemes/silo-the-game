import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { appendSweptSolid, meshData } from "../geometry.js";
import { geometryFromData } from "./primitives.js";
import { GALLERY_COLUMNS, WORLD } from "../config.js";
import { lerp } from "../mathutils.js";
import { makePlaqueTexture, mulberry32 } from "../textures.js";
import { getStructureSurface, STRUCTURE_COLORS } from "./materials.js";
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
  if (!copingMat) copingMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: STRUCTURE_COLORS.coping, roughness: 0.92, metalness: 0.03, side: THREE.DoubleSide });
  return copingMat;
}
let capRailMat = null;
function getCapRailMat() {
  if (!capRailMat) capRailMat = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide });
  return capRailMat;
}

// Lamplight behind the facades: warm, with the odd cooler room. Lit and dark
// windows mix through per-instance colours, which is what stops a stacked
// level from looking like a repeating texture.
export const WINDOW_PALETTE = [0xffc27e, 0xffb46a, 0xffd29a, 0xffa95c, 0xf0cf9c, 0xc9d3d6];

// Rounded rectangle, centred, facing +Z.
export function roundedRect(w, h, r, segments = 4) {
  const shape = new THREE.Shape(), x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(shape, segments);
}

// Bakes a flat colour into a geometry, so several parts with different
// colours can share one draw call (see facadeWindowGeometry).
//
// `shade(y)`, if given, scales the colour by a vertex's height, for a cheap
// gradient across the part.
export function painted(geometry, hex, scale = 1, shade = null) {
  const color = new THREE.Color(hex).multiplyScalar(scale);
  const position = geometry.attributes.position;
  const count = position.count;
  const colors = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) {
    const f = shade ? shade(position.getY(k)) : 1;
    colors.set([color.r * f, color.g * f, color.b * f], k * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// One window: a dark metal frame, the glass a centimetre in front of it, and a
// cross of glazing bars in front of that, all with the soft corners of every
// opening in the set (silo-19, the residential plates). The glass is white so
// the per-instance colour decides what is behind it, brighter low down where a
// room's lamp would be; frame and bars are near-black, so a lit window's spill
// tints them only faintly and an unlit one reads as one dark opening. Without
// the bars a lit rounded rectangle reads as a screen, not a window.
let windowGeometry = null, windowMaterial = null;
function facadeWindowGeometry() {
  if (!windowGeometry) {
    const frame = painted(roundedRect(1.38, 1.14, 0.26), 0xffffff, 0.09);
    const glass = painted(roundedRect(1.16, 0.92, 0.18), 0xffffff, 1, (y) => 1.15 - (y + 0.46) * 0.6);
    glass.translate(0, 0, 0.012);
    const parts = [frame, glass];
    for (const [w, h, x, y] of [[0.05, 0.92, 0, 0], [1.16, 0.045, 0, 0.16]]) {
      const bar = painted(new THREE.PlaneGeometry(w, h), 0xffffff, 0.09);
      bar.translate(x, y, 0.02);
      parts.push(bar.toNonIndexed());
    }
    windowGeometry = mergeGeometries(parts.map((part) => (part.index ? part.toNonIndexed() : part)));
    windowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  return windowGeometry;
}

// A row of windows round the storey above a gallery, facing the shaft. This is
// the band you look at across the void from the stair and the landings, and it
// was a blank wall all the way down. One draw call per level.
export function buildWindowBand(group, { radius, y, count, seed = 1, litChance = 0.6 }) {
  const rand = mulberry32(Math.floor(seed * 7919) >>> 0);
  const mesh = new THREE.InstancedMesh(facadeWindowGeometry(), windowMaterial, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const theta = phase + (i / count) * Math.PI * 2;
    // Placed by the band's own facets (96 of them), so the window lies flat on
    // the wall instead of cutting through the chord between two facets.
    dummy.position.set((radius - 0.035) * Math.cos(theta), y + (rand() < 0.25 ? 0.12 : 0), (radius - 0.035) * Math.sin(theta));
    dummy.rotation.set(0, -Math.PI / 2 - theta, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (rand() < litChance) color.setHex(WINDOW_PALETTE[Math.floor(rand() * WINDOW_PALETTE.length)]).multiplyScalar(0.55 + rand() * 0.45);
    else color.setRGB(0.012, 0.013, 0.015);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.name = "facade-windows";
  mesh.raycast = () => {};
  group.add(mesh);
  return mesh;
}

// The opal ring lamp round every gallery column, under every slab - the
// single most recognisable fixture in the production (silo-2, silo-3,
// silo-19). Level 1 has a hand-built version with real light behind it
// (exemplar.js); this is the instanced one for the other 147, glow only, one
// draw call per level.
let pillarLampGeometry = null, pillarLampMaterial = null;
export function buildPillarLamps(group, positions, y) {
  if (positions.length === 0) return null;
  if (!pillarLampGeometry) {
    const R = GALLERY_COLUMNS.radius + 0.06;
    // Lean: there are a hundred-odd of these in sight down the shaft.
    const parts = [painted(new THREE.CylinderGeometry(R, R, 0.5, 20, 1, true), 0xffdcab, 1.25)];
    for (const dy of [-0.28, 0.28]) {
      const rim = painted(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.07, 20, 1, true), 0x23262a);
      rim.translate(0, dy, 0);
      parts.push(rim);
    }
    // The cage of vertical ribs over the glass, flat strips facing out.
    for (let k = 0; k < 10; k++) {
      const a = (k * Math.PI) / 5;
      const rib = painted(new THREE.PlaneGeometry(0.035, 0.52), 0x23262a);
      rib.rotateY(Math.PI / 2 - a);
      rib.translate((R + 0.006) * Math.cos(a), 0, (R + 0.006) * Math.sin(a));
      parts.push(rib);
    }
    // Strip the attributes the parts do not all share, or the merge refuses.
    for (const part of parts) part.deleteAttribute("uv");
    pillarLampGeometry = mergeGeometries(parts.map((part) => part.toNonIndexed()));
    pillarLampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  const mesh = addInstancedBatch(group, pillarLampGeometry, pillarLampMaterial, positions.map((p) => ({ x: p.x, y, z: p.z })));
  mesh.name = "pillar-lamps";
  mesh.raycast = () => {};
  return mesh;
}

// Strip lights under the slab over a gallery: a dark housing and a lit
// diffuser, laid tangentially. One draw call per level.
let soffitGeometry = null, soffitMaterial = null;
export function buildSoffitLights(group, fittings) {
  if (fittings.length === 0) return null;
  if (!soffitGeometry) {
    const housing = painted(new THREE.BoxGeometry(0.26, 0.1, 1.5), 0x23262a);
    const diffuser = painted(new THREE.BoxGeometry(0.17, 0.03, 1.38), 0xffe7c4, 1.35);
    diffuser.translate(0, -0.06, 0);
    const parts = [housing, diffuser];
    for (const z of [-0.5, 0.5]) {
      const rod = painted(new THREE.BoxGeometry(0.02, 0.32, 0.02), 0x23262a);
      rod.translate(0, 0.2, z);
      parts.push(rod);
    }
    for (const part of parts) part.deleteAttribute("uv");
    soffitGeometry = mergeGeometries(parts.map((part) => part.toNonIndexed()));
    soffitMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  const mesh = addInstancedBatch(group, soffitGeometry, soffitMaterial, fittings.map((f) => ({ x: f.r * Math.cos(f.theta), y: f.y, z: f.r * Math.sin(f.theta), rotY: -f.theta })));
  mesh.name = "soffit-lights";
  mesh.raycast = () => {};
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
      map: makePlaqueTexture([d.label], { width: 192, height: 96, fg: 0xe6dcbe, bg: 0x14161a })
    })
  );
  doors.forEach((d, i) => {
    const plate = new THREE.Mesh(plateGeo, platePool[i % platePool.length]);
    const r = d.r - 0.07;
    plate.position.set(r * Math.cos(d.theta), 2.45, r * Math.sin(d.theta));
    plate.rotation.y = -Math.PI / 2 - d.theta; // read from inside the ring, not mirrored
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
//              faces. Kept for plain concrete finishes.
//   "handrail" - raised pipe and brackets, confirmed by the supplied set photos.
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
    if (cap === "handrail") {
      const curve=new HelixCurve(span.start,span.end,y(0),y(1),PARAPET_HEIGHT+.16,radius);
      // Half the wall's segments: a rail this thin needs no more to look round,
      // and every flight in sight carries one.
      const rail=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.ceil(shape.segments/2),.043,6,false),getCapRailMat());
      rail.name='stair-handrail';scene.add(rail);
      const count=Math.max(1,Math.ceil((span.end-span.start)*radius(.5)/1.8));
      const brackets=Array.from({length:count+1},(_,i)=>{
        const t=i/count,a=lerp(span.start,span.end,t),r=radius(t);
        return {x:r*Math.cos(a),y:y(t)+PARAPET_HEIGHT+.08,z:r*Math.sin(a)};
      });
      addInstancedBatch(scene,new THREE.CylinderGeometry(.018,.018,.16,6),getCapRailMat(),brackets);
    }
    if (cap === "rail") {
      const curve = new HelixCurve(span.start, span.end, y(0), y(1), PARAPET_HEIGHT + 0.03, (t) => radius(t));
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.ceil(shape.segments / 2), 0.035, 6, false), getCapRailMat()));
    }
  }
  const wallMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: STRUCTURE_COLORS.guard, roughness: 0.96, metalness: 0.01, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(geometryFromData(wall), wallMat));
  if (coping.positions.length) scene.add(new THREE.Mesh(geometryFromData(coping), getCopingMat()));
}
