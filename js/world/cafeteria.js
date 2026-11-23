// The upper cafeteria, built to the production's final model (new-references
// 018-028): a round hall with no columns at all - the director wanted the
// upper cafeterias fully open, the set's ceiling hung from above - under a
// ceiling of concentric rounded coffers around a finned central rosette, with
// the panoramic screen on the curved far wall, pill-shaped entrances with a
// heavy concrete reveal, and rows of tables wheeling round the centre.
//
// Everything is in the wing's own frame (x outward along the wing, z across
// it, the same frame buildWing hands to the themes). The hall is a circle of
// radius `station.roomHalfW` whose near edge is the corridor's end, so
// `roomDepth` is its diameter and every caller that reasons in roomStart /
// roomDepth (viewpoints, the layout test, the progress trigger) stays right.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CAFETERIA, WORLD } from "../config.js";
import { makePlaqueTexture, makeWastelandTexture } from "../textures.js";
import { getFloorSurface, getStructureSurface, getWallSurface, resolveSurface, STRUCTURE_COLORS, tint } from "./materials.js";
import { buildAnnularSectorGeometry, buildBandGeometry } from "./primitives.js";
import { letteringMaterial, mountPlate } from "./signs.js";
import { scaleHexColor } from "../mathutils.js";

const CAFETERIA_HEIGHT = CAFETERIA.height;
const CAFETERIA_WALL_CLEARANCE = CAFETERIA.wallClearance;

const TAU = Math.PI * 2;
// Bearings round the hall's own centre: PI is the entrance (towards the silo),
// 0 the screen opposite. Looking in from the entrance, negative z is left.
const ENTRANCE = Math.PI;
const SCREEN_HALF = 0.5;
const COUNTER = [3.72, 4.36];
const AIRLOCK = 2.2;
const NOTICES = 2.78;

function painted(geometry, hex) {
  const color = new THREE.Color(hex);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let k = 0; k < count; k++) colors.set([color.r, color.g, color.b], k * 3);
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function box(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return hex === undefined ? g : painted(g, hex);
}

// A strip that follows the wall (radius `r` round the hall centre, angles
// a0..a1) whose outline is a stadium: straight top and bottom, round ends.
// Used for the panoramic screen and its frame, which on the set are one long
// pill set into the curved wall. Faces the hall's centre.
function curvedPill(r, a0, a1, y0, height, columns = 120) {
  const positions = [], uvs = [], indices = [];
  const length = (a1 - a0) * r, cap = height / 2, mid = y0 + cap;
  for (let i = 0; i <= columns; i++) {
    const u = i / columns, a = a0 + (a1 - a0) * u, s = u * length;
    const d = Math.min(s, length - s);
    const half = d < cap ? Math.sqrt(Math.max(0, cap * cap - (cap - d) * (cap - d))) : cap;
    for (const y of [mid - half, mid + half]) {
      positions.push(r * Math.cos(a), y, r * Math.sin(a));
      uvs.push(u, (y - y0) / height);
    }
  }
  for (let i = 0; i < columns; i++) {
    const b0 = 2 * i, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3;
    indices.push(b0, b1, t0, t0, b1, t1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// The entrance reveal: a thick concrete U, flat on the floor and rounded over
// the top, standing in the plane x = 0 with its depth along +x.
function portalGeometry({ innerW, innerH, outerW, outerH, innerR, outerR, depth }) {
  const s = new THREE.Shape();
  const ox = outerW / 2, ix = innerW / 2;
  s.moveTo(-ox, 0);
  s.lineTo(-ox, outerH - outerR); s.quadraticCurveTo(-ox, outerH, -ox + outerR, outerH);
  s.lineTo(ox - outerR, outerH); s.quadraticCurveTo(ox, outerH, ox, outerH - outerR);
  s.lineTo(ox, 0);
  s.lineTo(ix, 0);
  s.lineTo(ix, innerH - innerR); s.quadraticCurveTo(ix, innerH, ix - innerR, innerH);
  s.lineTo(-ix + innerR, innerH); s.quadraticCurveTo(-ix, innerH, -ix, innerH - innerR);
  s.lineTo(-ix, 0);
  s.lineTo(-ox, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });
  g.rotateY(Math.PI / 2);
  return g;
}

// One table with its four chairs, long axis along x, chairs on +-z, vertex
// coloured so the whole hall's furniture is one instanced draw.
function tableSetGeometry() {
  const wood = 0x8b7453, steel = 0x2e3236, seat = 0x3b4045, back = 0x343a3f;
  const parts = [box(1.8, 0.05, 0.8, 0, 0.75, 0, wood), box(1.7, 0.06, 0.04, 0, 0.69, 0.36, steel), box(1.7, 0.06, 0.04, 0, 0.69, -0.36, steel)];
  for (const x of [-0.82, 0.82]) for (const z of [-0.34, 0.34]) parts.push(box(0.05, 0.72, 0.05, x, 0.36, z, steel));
  for (const side of [-1, 1]) for (const x of [-0.45, 0.45]) {
    const z = side * 0.62;
    parts.push(box(0.42, 0.04, 0.42, x, 0.45, z, seat));
    parts.push(box(0.42, 0.4, 0.035, x, 0.69, z + side * 0.2, back));
    for (const dx of [-0.18, 0.18]) for (const dz of [-0.18, 0.18]) parts.push(box(0.03, 0.44, 0.03, x + dx, 0.22, z + dz, steel));
  }
  return mergeGeometries(parts);
}

export function buildCafeteria(group, station, roomStart) {
  const R = station.roomHalfW, cx = roomStart + R, H = CAFETERIA_HEIGHT;
  const doorHalf = WORLD.corridorHalfW;
  const wingAngle = group.userData.collision.angle;
  // A point on the hall's own polar grid, in the wing frame.
  const at = (rho, a) => ({ x: cx + rho * Math.cos(a), z: rho * Math.sin(a) });
  // A collision box centred on (rho, a), long side along the wall.
  const obstacle = (rho, a, hw, hd) => {
    const p = at(rho, a);
    const wx = p.x * Math.cos(wingAngle) - p.z * Math.sin(wingAngle), wz = p.x * Math.sin(wingAngle) + p.z * Math.cos(wingAngle);
    const A = wingAngle + a + Math.PI / 2;
    station.obstacles.push({ x: wx * Math.cos(A) + wz * Math.sin(A), z: -wx * Math.sin(A) + wz * Math.cos(A), hw, hd, angle: A });
  };
  // Turns an object so its +x faces the hall's centre from bearing `a`.
  const facingCentre = (a) => Math.PI - a;

  const wallTex = getWallSurface(0);
  const concrete = resolveSurface(wallTex, null);
  const wallMat = new THREE.MeshStandardMaterial({ color: tint(station.wall), map: concrete.map, normalMap: concrete.normalMap, roughness: 0.93, metalness: 0.03, side: THREE.DoubleSide });
  // The structural surface, not the wall's: the wall's rain streaks run
  // radially across a round ceiling.
  const ceilingMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: scaleHexColor(tint(station.wall), 0.92), roughness: 0.95, side: THREE.DoubleSide });
  const structure = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: STRUCTURE_COLORS.guard, roughness: 0.9, metalness: 0.02 });
  // Two-sided: it also dresses the curved bands (skirting, cornice, the
  // screen's frame), whose winding is not guaranteed to face the hall.
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.55, metalness: 0.55, side: THREE.DoubleSide });

  // --- Floor ------------------------------------------------------------------
  const span = 2 * (R + 0.3);
  const floorSurface = resolveSurface(getFloorSurface(0), [span / 3.5, span / 3.5]);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.3, 96), new THREE.MeshStandardMaterial({
    color: tint(station.floor), map: floorSurface.map, normalMap: floorSurface.normalMap, roughness: 0.88, metalness: 0.03,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // --- Wall, with the entrance cut out of it ----------------------------------
  const gap = Math.asin((doorHalf + 0.05) / R);
  const wall = new THREE.Mesh(buildBandGeometry(R, ENTRANCE + gap, ENTRANCE - gap + TAU, H, -0.05, 160, false), wallMat);
  wall.position.x = cx;
  group.add(wall);
  // Over the entrance, from the reveal's crown to the ceiling.
  const lintel = new THREE.Mesh(buildBandGeometry(R, ENTRANCE - gap, ENTRANCE + gap, H, 3.1, 8, false), wallMat);
  lintel.position.x = cx;
  group.add(lintel);
  // Skirting and a cornice, the two lines that read the wall as built.
  for (const [y0, y1, inset] of [[0, 0.16, 0.03], [H - 0.32, H - 0.2, 0.06]]) {
    const band = new THREE.Mesh(buildBandGeometry(R - inset, ENTRANCE + gap + 0.06, ENTRANCE - gap - 0.06 + TAU, y1, y0, 160, false), dark);
    band.position.x = cx;
    group.add(band);
  }

  // The reveal round the entrance: deep, rounded over the top, flat on the floor.
  const portal = new THREE.Mesh(portalGeometry({ innerW: doorHalf * 2, innerH: 3.15, outerW: doorHalf * 2 + 1.3, outerH: 3.95, innerR: 1.05, outerR: 1.5, depth: 0.55 }), structure);
  portal.position.set(roomStart - 0.18, 0, 0);
  portal.castShadow = portal.receiveShadow = true;
  group.add(portal);

  // Pilasters round the wall, where nothing else is fixed to it.
  const clear = (a, from, to) => {
    const d = Math.atan2(Math.sin(a - (from + to) / 2), Math.cos(a - (from + to) / 2));
    return Math.abs(d) > (to - from) / 2;
  };
  const pilasters = [];
  for (let k = 0; k < 20; k++) {
    const a = (k + 0.5) * (TAU / 20);
    if (!clear(a, ENTRANCE - 0.35, ENTRANCE + 0.35) || !clear(a, -SCREEN_HALF - 0.12, SCREEN_HALF + 0.12) || !clear(a, COUNTER[0] - 0.08, COUNTER[1] + 0.08) || !clear(a, AIRLOCK - 0.17, AIRLOCK + 0.17) || !clear(a, NOTICES - 0.12, NOTICES + 0.12)) continue;
    pilasters.push(a);
  }
  const pilasterGeo = new THREE.BoxGeometry(CAFETERIA_WALL_CLEARANCE, H - 0.2, 0.5);
  pilasterGeo.translate(0, (H - 0.2) / 2, 0);
  const pilasterMesh = new THREE.InstancedMesh(pilasterGeo, structure, pilasters.length);
  const dummy = new THREE.Object3D();
  pilasters.forEach((a, i) => {
    const p = at(R - CAFETERIA_WALL_CLEARANCE / 2, a);
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, facingCentre(a), 0);
    dummy.updateMatrix();
    pilasterMesh.setMatrixAt(i, dummy.matrix);
  });
  pilasterMesh.castShadow = pilasterMesh.receiveShadow = true;
  group.add(pilasterMesh);

  // --- Ceiling: coffers round a finned rosette ---------------------------------
  const RECESS = 3.6, RINGS = [RECESS, 7.2, 10.4];
  const ceiling = new THREE.Mesh(buildAnnularSectorGeometry(RECESS, R + 0.3, 0, TAU, 128), ceilingMat);
  ceiling.position.set(cx, H, 0);
  group.add(ceiling);
  const beams = [];
  for (const r of [...RINGS, R - 0.14]) {
    // Deep, round-bottomed beams: the coffers on the model are boxes you
    // look up into, not lines drawn on the ceiling.
    const torus = new THREE.TorusGeometry(r, 0.18, 10, 128);
    torus.rotateX(Math.PI / 2);
    torus.scale(1, 1.8, 1);
    torus.translate(0, H - 0.3, 0);
    beams.push(torus);
  }
  for (const [r0, r1, count, phase] of [[RINGS[0], RINGS[1], 8, 0], [RINGS[1], RINGS[2], 12, 0.5], [RINGS[2], R - 0.14, 24, 0.5]]) {
    for (let k = 0; k < count; k++) {
      const a = (k + phase) * (TAU / count), len = r1 - r0;
      const beam = new THREE.CylinderGeometry(0.15, 0.15, len, 10);
      beam.rotateZ(Math.PI / 2);
      beam.scale(1, 1.8, 1);
      beam.translate((r0 + r1) / 2, H - 0.27, 0);
      beam.rotateY(-a);
      beams.push(beam);
    }
  }
  // The rosette: a raised drum with a glowing crown and radial fins under it.
  const drum = buildBandGeometry(RECESS, 0, TAU, H + 0.6, H, 64, false);
  beams.push(drum);
  for (let k = 0; k < 24; k++) {
    const fin = new THREE.BoxGeometry(RECESS - 0.75, 0.5, 0.06);
    fin.translate(0.75 + (RECESS - 0.75) / 2, H + 0.32, 0);
    fin.rotateY(-k * (TAU / 24));
    beams.push(fin);
  }
  const hub = new THREE.CylinderGeometry(0.72, 0.72, 0.6, 32);
  hub.translate(0, H + 0.3, 0);
  beams.push(hub);
  const ceilingFrame = new THREE.Mesh(mergeGeometries(beams.map((g) => {
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    return g.index ? g.toNonIndexed() : g;
  })), structure);
  ceilingFrame.position.x = cx;
  ceilingFrame.castShadow = true;
  group.add(ceilingFrame);
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1dc).multiplyScalar(1.15), side: THREE.DoubleSide });
  const crown = new THREE.Mesh(new THREE.CircleGeometry(RECESS, 64), glow);
  crown.rotation.x = Math.PI / 2;
  crown.position.set(cx, H + 0.6, 0);
  group.add(crown);
  // Luminous panels in the outer coffers, the hall's main light on the set.
  const panels = [];
  for (let k = 0; k < 24; k++) {
    const a0 = k * (TAU / 24) + 0.5 * (TAU / 24), a1 = a0 + TAU / 24;
    const inset = 0.2 / RINGS[2];
    const panel = buildAnnularSectorGeometry(RINGS[2] + 0.28, R - 0.42, a0 + inset, a1 - inset, 6);
    panel.translate(0, H - 0.03, 0);
    panels.push(panel);
  }
  const panelMesh = new THREE.Mesh(mergeGeometries(panels), glow);
  panelMesh.position.x = cx;
  group.add(panelMesh);
  // The middle ring's coffers glow too, at about half the strength.
  const middle = [];
  for (let k = 0; k < 12; k++) {
    const a0 = (k + 0.5) * (TAU / 12), a1 = a0 + TAU / 12, inset = 0.22 / RINGS[1];
    const panel = buildAnnularSectorGeometry(RINGS[1] + 0.3, RINGS[2] - 0.3, a0 + inset, a1 - inset, 6);
    panel.translate(0, H - 0.03, 0);
    middle.push(panel);
  }
  const middleMesh = new THREE.Mesh(mergeGeometries(middle), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1dc).multiplyScalar(0.62), side: THREE.DoubleSide }));
  middleMesh.position.x = cx;
  group.add(middleMesh);

  // --- The screen ---------------------------------------------------------------
  const screenH = 2.6, screenY = 0.95, screenR = R - 0.1;
  const frame = new THREE.Mesh(curvedPill(R - 0.05, -SCREEN_HALF - 0.28 / R, SCREEN_HALF + 0.28 / R, screenY - 0.28, screenH + 0.56), dark);
  frame.position.x = cx;
  group.add(frame);
  const fallback = makeWastelandTexture({ seed: station.level });
  const screen = new THREE.Mesh(curvedPill(screenR, -SCREEN_HALF, SCREEN_HALF, screenY, screenH), new THREE.MeshBasicMaterial({ map: fallback }));
  screen.name = "cafeteria-screen";
  screen.position.x = cx;
  screen.raycast = () => {};
  group.add(screen);
  const displayAspect = (2 * SCREEN_HALF * screenR) / screenH;
  const fit = (texture) => {
    const imageAspect = texture.image.width / texture.image.height;
    if (imageAspect < displayAspect) { texture.repeat.y = imageAspect / displayAspect; texture.offset.y = (1 - texture.repeat.y) / 2; }
    else { texture.repeat.x = displayAspect / imageAspect; texture.offset.x = (1 - texture.repeat.x) / 2; }
  };
  fit(fallback);
  // The landscape photograph, with the procedural one standing in until it
  // arrives (or for good, if it never does).
  const exterior = new THREE.TextureLoader().load(new URL("../../assets/exterior-camera-v1.png", import.meta.url).href, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    fit(loaded);
    screen.material.map = loaded;
    screen.material.needsUpdate = true;
    fallback.dispose();
    window.dispatchEvent(new Event("silo:asset-ready"));
  }, undefined, () => { exterior.dispose(); });

  // --- Tables, wheeling round the centre ------------------------------------------
  // Three rings, a clear aisle from the entrance straight through to the
  // screen, and nothing in front of the counter or the airlock.
  const sets = [];
  // Packed as on the model: about 0.85m to pass between one ring's chair
  // backs and the next.
  for (const [rho, count] of [[3.0, 6], [5.6, 12], [8.2, 18], [10.6, 24]]) {
    for (let k = 0; k < count; k++) {
      const a = (k + 0.5) * (TAU / count) + rho * 0.07;
      const p = at(rho, a);
      if (Math.abs(p.z) < 2.35) continue;
      // The outer rings keep clear of the counter, the hatch and the notices.
      const margin = rho > 10 ? 0.12 : 0;
      if (rho > 7.5 && (!clear(a, COUNTER[0] - 0.22 - margin, COUNTER[1] + 0.22 + margin) || !clear(a, AIRLOCK - 0.3 - margin, AIRLOCK + 0.3 + margin) || !clear(a, NOTICES - 0.15 - margin, NOTICES + 0.15 + margin))) continue;
      sets.push({ rho, a });
    }
  }
  const tables = new THREE.InstancedMesh(tableSetGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.15 }), sets.length);
  sets.forEach(({ rho, a }, i) => {
    const p = at(rho, a);
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, -a - Math.PI / 2, 0);
    dummy.updateMatrix();
    tables.setMatrixAt(i, dummy.matrix);
    obstacle(rho, a, 0.95, 0.88);
  });
  tables.castShadow = tables.receiveShadow = true;
  tables.name = "cafeteria-tables";
  group.add(tables);

  // --- Serving counter --------------------------------------------------------------
  const counterParts = [];
  const steps = 6, cr = R - 1.45;
  for (let k = 0; k < steps; k++) {
    const a0 = COUNTER[0] + (k / steps) * (COUNTER[1] - COUNTER[0]), a1 = COUNTER[0] + ((k + 1) / steps) * (COUNTER[1] - COUNTER[0]);
    const a = (a0 + a1) / 2, chord = 2 * cr * Math.sin((a1 - a0) / 2) + 0.02;
    const body = box(0.75, 1.0, chord, 0, 0.5, 0, 0x5d6468);
    const top = box(0.95, 0.06, chord + 0.01, 0.05, 1.03, 0, 0x9aa0a3);
    const kick = box(0.06, 0.12, chord, 0.4, 0.06, 0, 0x2e3236);
    for (const g of [body, top, kick]) {
      g.rotateY(facingCentre(a));
      const p = at(cr, a);
      g.translate(p.x, 0, p.z);
      counterParts.push(g);
    }
    obstacle(cr, a, chord / 2 + 0.02, 0.5);
  }
  const counter = new THREE.Mesh(mergeGeometries(counterParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.35 }));
  counter.castShadow = counter.receiveShadow = true;
  group.add(counter);
  // The kitchen pass behind it: a dark opening in the wall with its sign.
  // A roller shutter half down over the lamplit kitchen behind. A plain dark
  // opening here read as a second screen.
  const kitchen = new THREE.Mesh(buildBandGeometry(R - 0.02, COUNTER[0] + 0.06, COUNTER[1] - 0.06, 1.75, 1.1, 24, false), new THREE.MeshBasicMaterial({ color: 0x5a4632, side: THREE.DoubleSide }));
  kitchen.position.x = cx;
  group.add(kitchen);
  const shutter = new THREE.Mesh(buildBandGeometry(R - 0.03, COUNTER[0] + 0.06, COUNTER[1] - 0.06, 2.45, 1.75, 24, false), new THREE.MeshStandardMaterial({ color: 0x7c8387, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }));
  shutter.position.x = cx;
  group.add(shutter);
  const slats = [];
  for (let y = 1.82; y < 2.42; y += 0.09) {
    const slat = new THREE.TorusGeometry(R - 0.045, 0.008, 4, 48, COUNTER[1] - COUNTER[0] - 0.12);
    slat.rotateX(Math.PI / 2);
    slat.rotateY(-(COUNTER[0] + 0.06));
    slat.translate(0, y, 0);
    slats.push(slat);
  }
  const slatMesh = new THREE.Mesh(mergeGeometries(slats), dark);
  slatMesh.position.x = cx;
  group.add(slatMesh);
  const passSign = at(R - 0.05, (COUNTER[0] + COUNTER[1]) / 2);
  mountPlate(group, letteringMaterial(makePlaqueTexture(["RAÇÕES", "CAFETERIA · NÍVEL 1"], { fg: 0xd3c8a6, bg: 0x303a30 })), {
    w: 2.2, h: 0.55, x: passSign.x, y: 3.05, z: passSign.z, rotY: facingCentre((COUNTER[0] + COUNTER[1]) / 2) + Math.PI / 2, depth: 0.04,
  });

  // --- The controlled exit: the sealed airlock hatch, and its warning ------------
  const hatch = new THREE.Group();
  const hp = at(R - 0.02, AIRLOCK);
  hatch.position.set(hp.x, 0, hp.z);
  hatch.rotation.y = facingCentre(AIRLOCK);
  group.add(hatch);
  const steel = new THREE.MeshStandardMaterial({ color: 0x4a5258, roughness: 0.5, metalness: 0.6 });
  const add = (geometry, material, x, y, z, rx = 0) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.z = rx; m.castShadow = m.receiveShadow = true; hatch.add(m); return m; };
  // Low metalness on purpose: there is no environment map to reflect, and
  // without one a properly metallic surface renders nearly black.
  const frameSteel = new THREE.MeshStandardMaterial({ color: 0x737c82, roughness: 0.55, metalness: 0.3 });
  const doorSteel = new THREE.MeshStandardMaterial({ color: 0xa2abb0, roughness: 0.45, metalness: 0.3 });
  add(new THREE.BoxGeometry(0.22, 2.9, 2.6), frameSteel, -0.05, 1.45, 0);
  add(new THREE.CylinderGeometry(1.08, 1.08, 0.12, 40), dark, 0.08, 1.35, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(1.0, 1.0, 0.24, 40), doorSteel, 0.14, 1.35, 0, Math.PI / 2);
  add(new THREE.TorusGeometry(0.62, 0.05, 8, 40), frameSteel, 0.27, 1.35, 0).rotation.y = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16), frameSteel, 0.32, 1.35, 0, Math.PI / 2);
  for (let k = 0; k < 16; k++) {
    const b = k * (TAU / 16);
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), dark, 0.28, 1.35 + 0.86 * Math.sin(b), 0.86 * Math.cos(b), Math.PI / 2);
  }
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(0.05, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd8b23a : 0x24262a, roughness: 0.6 }), 0.08, 3.0, -0.95 + i * 0.38);
  mountPlate(hatch, letteringMaterial(makePlaqueTexture(["CASA DE MÁQUINAS DA TELA", "ACESSO RESTRITO"], { fg: 0xffd27a, bg: 0x14100c })), { w: 1.5, h: 0.8, x: 0.08, y: 3.6, z: 0, rotY: Math.PI / 2, depth: 0.04 });
  obstacle(R - 0.25, AIRLOCK, 1.35, 0.35);

  // --- Shift notices beside the entrance -------------------------------------------
  const board = new THREE.Group();
  const bp = at(R - 0.02, NOTICES);
  board.position.set(bp.x, 0, bp.z);
  board.rotation.y = facingCentre(NOTICES);
  group.add(board);
  const corkboard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 1.7), new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 0.95 }));
  corkboard.position.set(0.03, 1.75, 0);
  board.add(corkboard);
  mountPlate(board, letteringMaterial(makePlaqueTexture(["AVISOS DO TURNO", "MANTENHA A PASSAGEM LIVRE"], { fg: 0xd3c8a6, bg: 0x303a30 })), { w: 1.45, h: 0.42, x: 0.07, y: 2.0, z: 0, rotY: Math.PI / 2, depth: 0.02 });
  [["ESCALA", "SILO 18"], ["RECICLAGEM", "SILO 18"], ["MANUTENÇÃO", "SILO 18"]].forEach((lines, i) => {
    mountPlate(board, letteringMaterial(makePlaqueTexture(lines, { fg: 0x26231d, bg: 0xd9d2bd })), { w: 0.38, h: 0.4, x: 0.07, y: 1.5, z: -0.48 + i * 0.48, rotY: Math.PI / 2, depth: 0.01 });
  });

  // --- Light ---------------------------------------------------------------------------
  // One static shadow map for the hall (the gallery has the other), the fill
  // from six fixtures in the coffers - the shared pool picks the nearest - and
  // the cool spill off the screen.
  const key = new THREE.SpotLight(0xffe7c4, 150, 19, 1.3, 0.65, 2);
  key.name = "cafeteria-shadow";
  key.position.set(cx, H - 0.3, 0);
  key.target.position.set(cx + 0.01, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.2;
  key.shadow.camera.far = 18;
  key.shadow.bias = -0.00015;
  key.shadow.normalBias = 0.03;
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  group.add(key, key.target);
  for (let k = 0; k < 6; k++) {
    const p = at(8.8, (k + 0.5) * (TAU / 6));
    const light = new THREE.PointLight(0xffe2bc, 20, 11, 2);
    light.position.set(p.x, H - 0.5, p.z);
    group.add(light);
  }
  const spill = new THREE.PointLight(0xd8c6b2, 10, 10, 2);
  spill.position.set(cx + R - 2.2, 1.9, 0);
  group.add(spill);
}
