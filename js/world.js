import * as THREE from "three";
import { SECONDARY_WING, WING_OFFSETS, WORLD } from "./config.js";
import { slopeOuterRadius } from "./collision.js";
import { lerp } from "./mathutils.js";
import { makeConcreteTexture, makeGrateTexture, makePlaqueTexture, makeWastelandTexture } from "./textures.js";

const LIGHT_INTENSITY = 16;
const LIGHT_DISTANCE = 13;

// ---------------------------------------------------------------------------
// Small geometry helpers. Every material uses DoubleSide defensively (this
// project has no way to visually QA backface-culling mistakes), and prop
// helpers work in a group's *local* space so callers never touch raw
// trigonometry. Real THREE.PointLights are expensive (three.js evaluates
// every light in the scene for every fragment, regardless of distance), so
// only `addFixtureLight` creates one - everything decorative uses `addGlow`
// (an unlit emissive bulb, effectively free).
// ---------------------------------------------------------------------------

function addBox(group, { x, y, z, w, h, d, color = 0x808080, rotY = 0, emissive = 0x000000, emissiveIntensity = 0, map = null, repeat = null }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (map && repeat) {
    map = map.clone();
    map.needsUpdate = true;
    map.repeat.set(repeat[0], repeat[1]);
  }
  const mat = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity, map, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  return mesh;
}

function addCylinder(group, { x, y, z, r, r2 = null, h, color = 0x808080, radialSegments = 16, rotX = 0, rotZ = 0, emissive = 0x000000, emissiveIntensity = 0, openEnded = false }) {
  const geo = new THREE.CylinderGeometry(r, r2 === null ? r : r2, h, radialSegments, 1, openEnded);
  const mat = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  mesh.rotation.z = rotZ;
  group.add(mesh);
  return mesh;
}

function addGlow(group, { x, y, z, r = 0.09, color = 0xffffff }) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addFixtureLight(group, { x, y, z, color = 0xffaa55, intensity = LIGHT_INTENSITY, distance = LIGHT_DISTANCE }) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  group.add(light);
  addGlow(group, { x, y, z, color });
  return light;
}

// Absolute-placement box: (r, theta) picks the world XZ position directly
// (matching the exact same convention as collision.js), used only for pieces
// that live in the un-rotated "landing" group.
function addAbsBox(group, { r, theta, y, w, h, d, color, map = null }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color, map, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  mesh.rotation.y = -theta;
  group.add(mesh);
  return mesh;
}

// A small recessed square vent/porthole on a wall segment, facing the hall -
// the little square windows visible along the balconies in the reference
// stills.
function addPorthole(group, { r, theta, y }) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0x63625c, side: THREE.DoubleSide }));
  frame.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  frame.rotation.y = -theta;
  group.add(frame);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x0c0e10, side: THREE.DoubleSide }));
  glass.position.set((r - 0.02) * Math.cos(theta), y, (r - 0.02) * Math.sin(theta));
  glass.rotation.y = -theta;
  group.add(glass);
}

// Flat annular wedge (a slice of a ring), built by hand from the same
// (r*cosθ, r*sinθ) formula collision.js uses, so it can never disagree with
// the walkable floor bounds it visually represents.
function buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments = 48) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = lerp(thetaStart, thetaEnd, t);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(innerR * cos, 0, innerR * sin);
    positions.push(outerR * cos, 0, outerR * sin);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(t * 10, 0, t * 10, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = 2 * i;
    const b = 2 * i + 1;
    const c = 2 * (i + 1);
    const d = 2 * (i + 1) + 1;
    indices.push(a, b, c, b, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function buildDiscGeometry(radius, segments = 40) {
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(-Math.PI / 2); // CircleGeometry is built in the XY plane; lay it flat.
  return geo;
}

// ---------------------------------------------------------------------------
// Central pole spanning the whole shaft.
// ---------------------------------------------------------------------------

function buildCentralPole(scene, layout) {
  const top = layout.stations[0].y + 3;
  const bottom = layout.stations[layout.stations.length - 1].y - 3;
  const geo = new THREE.CylinderGeometry(0.42, 0.48, top - bottom, 16);
  const mat = new THREE.MeshLambertMaterial({ color: 0x24262a, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, (top + bottom) / 2, 0);
  scene.add(mesh);
}

// ---------------------------------------------------------------------------
// Helix curve shared by stair railings and each landing's own guard rail
// (which is just a helix with yStart === yEnd, i.e. a flat circular arc).
// ---------------------------------------------------------------------------

class HelixCurve extends THREE.Curve {
  constructor(thetaStart, thetaEnd, yStart, yEnd, yOffset, radiusFn) {
    super();
    this.thetaStart = thetaStart;
    this.thetaEnd = thetaEnd;
    this.yStart = yStart;
    this.yEnd = yEnd;
    this.yOffset = yOffset;
    this.radiusFn = radiusFn;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const theta = lerp(this.thetaStart, this.thetaEnd, t);
    const y = lerp(this.yStart, this.yEnd, t) + this.yOffset;
    const r = this.radiusFn(t);
    return target.set(r * Math.cos(theta), y, r * Math.sin(theta));
  }
}

const PARAPET_HEIGHT = 1.05;
const PARAPET_THICKNESS = 0.16;

// Splits [thetaStart, thetaEnd] into the spans that remain after cutting out
// each gap ({center, halfWidth}, in the same absolute theta), so a doorway
// (a bridge crossing this guard wall, say) leaves a real opening instead of
// solid wall the player can see but walk through.
function splitAngleRangeByGaps(thetaStart, thetaEnd, gaps) {
  const clipped = gaps
    .map((g) => [Math.max(thetaStart, g.center - g.halfWidth), Math.min(thetaEnd, g.center + g.halfWidth)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);

  const spans = [];
  let cursor = thetaStart;
  for (const [gapStart, gapEnd] of clipped) {
    if (gapStart > cursor) spans.push({ start: cursor, end: gapStart });
    cursor = Math.max(cursor, gapEnd);
  }
  if (cursor < thetaEnd) spans.push({ start: cursor, end: thetaEnd });
  return spans;
}

function yAtTheta(theta, thetaStart, thetaEnd, yStart, yEnd) {
  const t = (theta - thetaStart) / (thetaEnd - thetaStart);
  return yStart + (yEnd - yStart) * t;
}

// A solid concrete guard wall (not an open baluster railing - the reference
// stills show a thick poured-concrete parapet with only a thin dark metal
// cap bar on top), following a helix (or, with yStart===yEnd, a flat arc).
// `gaps` (optional) cuts real openings where something - a bridge, say -
// needs to cross through the wall.
function buildParapet(scene, thetaStart, thetaEnd, yStart, yEnd, radiusFn, gaps = []) {
  const angleSpan = thetaEnd - thetaStart;
  const segAngle = 0.15;
  const segCount = Math.max(3, Math.ceil(angleSpan / segAngle));

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x66675f, side: THREE.DoubleSide });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const dummy = new THREE.Object3D();
  const matrices = [];
  for (let i = 0; i < segCount; i++) {
    const t = (i + 0.5) / segCount;
    const theta = lerp(thetaStart, thetaEnd, t);
    if (gaps.some((g) => Math.abs(theta - g.center) < g.halfWidth)) continue;
    const y = lerp(yStart, yEnd, t);
    const r = radiusFn(t);
    const tangentialWidth = r * (angleSpan / segCount) * 1.25;
    dummy.position.set(r * Math.cos(theta), y + PARAPET_HEIGHT / 2, r * Math.sin(theta));
    dummy.rotation.set(0, -theta, 0);
    dummy.scale.set(PARAPET_THICKNESS, PARAPET_HEIGHT, tangentialWidth);
    dummy.updateMatrix();
    matrices.push(dummy.matrix.clone());
  }
  if (matrices.length > 0) {
    const wall = new THREE.InstancedMesh(geo, wallMat, matrices.length);
    matrices.forEach((m, i) => wall.setMatrixAt(i, m));
    wall.instanceMatrix.needsUpdate = true;
    scene.add(wall);
  }

  const capMat = new THREE.MeshLambertMaterial({ color: 0x1e2023, side: THREE.DoubleSide });
  for (const span of splitAngleRangeByGaps(thetaStart, thetaEnd, gaps)) {
    const spanYStart = yAtTheta(span.start, thetaStart, thetaEnd, yStart, yEnd);
    const spanYEnd = yAtTheta(span.end, thetaStart, thetaEnd, yStart, yEnd);
    const capSegs = Math.max(2, Math.ceil((span.end - span.start) / 0.1));
    const capCurve = new HelixCurve(span.start, span.end, spanYStart, spanYEnd, PARAPET_HEIGHT + 0.03, radiusFn);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(capCurve, capSegs, 0.035, 6, false), capMat));
  }
}

// ---------------------------------------------------------------------------
// Stair transit between two stations: dense instanced treads plus a
// continuous inner + outer rail (built with real posts every few steps).
// ---------------------------------------------------------------------------

function buildTransit(scene, layout, slope) {
  const angleSpan = slope.thetaEnd - slope.thetaStart;
  const anglePerStep = (Math.PI * 2) / WORLD.stepsPerTurn;
  const stepCount = Math.max(1, Math.round(angleSpan / anglePerStep));
  const stepThickness = 0.16;

  const treadGeo = new THREE.BoxGeometry(1, 1, 1);
  const treadMat = new THREE.MeshLambertMaterial({ color: 0x5b5c58, side: THREE.DoubleSide });
  const treads = new THREE.InstancedMesh(treadGeo, treadMat, stepCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < stepCount; i++) {
    const t = i / stepCount;
    const theta = lerp(slope.thetaStart, slope.thetaEnd, t);
    const y = lerp(slope.yStart, slope.yEnd, t);
    const outerR = slopeOuterRadius(t);
    const radialLen = outerR - WORLD.shaftR;
    const rMid = (WORLD.shaftR + outerR) / 2;
    const tangentialWidth = rMid * anglePerStep * 1.3;

    dummy.position.set(rMid * Math.cos(theta), y - stepThickness / 2, rMid * Math.sin(theta));
    dummy.rotation.set(0, -theta, 0);
    dummy.scale.set(radialLen, stepThickness, tangentialWidth);
    dummy.updateMatrix();
    treads.setMatrixAt(i, dummy.matrix);
  }
  treads.instanceMatrix.needsUpdate = true;
  scene.add(treads);

  buildParapet(scene, slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, (t) => slopeOuterRadius(t));
  buildParapet(scene, slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, () => WORLD.shaftR);

  // One numbered plaque per full turn, mounted on the pole, facing outward
  // along the descent so it reads naturally as the player passes it.
  const fromLevel = layout.stations[slope.fromIndex].level;
  const toLevel = layout.stations[slope.toIndex].level;
  const turns = Math.floor(angleSpan / (Math.PI * 2));
  let lastLevel = fromLevel;
  for (let k = 1; k <= turns; k++) {
    const theta = slope.thetaStart + k * Math.PI * 2;
    if (theta >= slope.thetaEnd) break;
    const t = (theta - slope.thetaStart) / angleSpan;
    const y = lerp(slope.yStart, slope.yEnd, t);
    let level = Math.round(lerp(fromLevel, toLevel, t));
    level = Math.max(lastLevel + 1, Math.min(toLevel - 1, level));
    lastLevel = level;

    const tex = makePlaqueTexture([`NÍVEL ${level}`], { width: 320, height: 180, fg: 0xd8cba4, bg: 0x0c0d0e });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.28), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const plaqueR = WORLD.shaftR + 0.02;
    mesh.position.set(plaqueR * Math.cos(theta), y + 1.1, plaqueR * Math.sin(theta));
    mesh.rotation.y = Math.PI / 2 - theta;
    scene.add(mesh);
  }
}

// ---------------------------------------------------------------------------
// Station shell: a near-360 degree flat hall around the shaft (walls with a
// few doorway gaps + porthole windows + support pillars with tube lights),
// plus a continuous guard rail around the inner shaft opening so every point
// on the hall can look straight down/up through the stairwell.
// ---------------------------------------------------------------------------

function buildStationShell(scene, station, { isFirst, isLast }) {
  const H = WORLD.roomHeight;
  const phi = WORLD.plateauHalfAngle;

  const wallTex = makeConcreteTexture(station.wall, { seed: station.level, streaks: true });
  const floorTex = makeConcreteTexture(station.floor, { seed: station.level + 500, streaks: false });

  const landingGroup = new THREE.Group();
  landingGroup.position.set(0, station.y, 0);
  scene.add(landingGroup);

  const floorTexClone = floorTex.clone();
  floorTexClone.needsUpdate = true;
  floorTexClone.repeat.set(1, 1);
  const floorMat = new THREE.MeshLambertMaterial({ map: floorTexClone, side: THREE.DoubleSide });
  const ceilMat = new THREE.MeshLambertMaterial({ color: station.wall, side: THREE.DoubleSide });

  // Hub (small platform where the stair actually lands): the shaft hole
  // continues past every station except the very top (cap the ceiling,
  // nothing above) and very bottom (cap the floor, nothing below).
  const hubFloorGeo = isLast
    ? buildDiscGeometry(WORLD.hubR)
    : buildAnnularSectorGeometry(WORLD.shaftR, WORLD.hubR, station.theta - phi, station.theta + phi);
  const hubCeilGeo = isFirst
    ? buildDiscGeometry(WORLD.hubR)
    : buildAnnularSectorGeometry(WORLD.shaftR, WORLD.hubR, station.theta - phi, station.theta + phi);
  landingGroup.add(new THREE.Mesh(hubFloorGeo, floorMat));
  const hubCeilMesh = new THREE.Mesh(hubCeilGeo, ceilMat);
  hubCeilMesh.position.y = H;
  landingGroup.add(hubCeilMesh);

  // Outer ring (the walkable hall proper): this is a fixed part of the
  // silo's architecture at every level, so it always keeps its open shape -
  // only the central shaft caps off at the very top/bottom of the silo.
  // Between the hub and the ring there is a real gap with no floor at all
  // (only the bridges built in buildWing cross it), matching the open void
  // around the central stair core in the reference stills.
  landingGroup.add(new THREE.Mesh(buildAnnularSectorGeometry(WORLD.ringInnerR, WORLD.landingR, station.theta - phi, station.theta + phi), floorMat));
  const ringCeilMesh = new THREE.Mesh(buildAnnularSectorGeometry(WORLD.ringInnerR, WORLD.landingR, station.theta - phi, station.theta + phi), ceilMat);
  ringCeilMesh.position.y = H;
  landingGroup.add(ringCeilMesh);

  // Outer wall of the hall, wrapping almost the whole circle - skipping a
  // small doorway gap at each wing's angle, and near the two ends where the
  // spiral stair actually passes through.
  const doorHalf = Math.atan2(WORLD.corridorHalfW, WORLD.landingR) + 0.05;
  const wallSegAngle = 0.22;
  const segCount = Math.max(10, Math.round((2 * phi) / wallSegAngle));
  let wallCount = 0;
  for (let i = 0; i < segCount; i++) {
    const a0 = -phi + (2 * phi * i) / segCount;
    const a1 = -phi + (2 * phi * (i + 1)) / segCount;
    const mid = (a0 + a1) / 2;
    const inDoorway = WING_OFFSETS.some((offset) => Math.abs(mid - offset) < doorHalf);
    if (inDoorway) continue;
    const theta = station.theta + mid;
    const width = WORLD.landingR * (a1 - a0) * 1.1;
    addAbsBox(landingGroup, { r: WORLD.landingR, theta, y: H / 2, w: 0.3, h: H, d: width, color: station.wall, map: wallTex });
    wallCount++;
    if (wallCount % 3 === 0) addPorthole(landingGroup, { r: WORLD.landingR - 0.16, theta, y: H * 0.6 });
  }

  // Guard walls: around the shaft hole (meets the stair parapets above/below
  // exactly at +-phi), around the hub's outer edge and around the ring's
  // inner edge - the last two face each other across the open void, exactly
  // like the low concrete walls on both sides of the gap in the reference
  // stills. The hub/ring walls need a real opening at every wing's angle -
  // that's where the bridge actually crosses - or the player would see (and
  // walk through) solid wall standing in the doorway.
  const bridgeGapHalf = (radius) => Math.atan2(WORLD.bridgeHalfW, radius) + 0.05;
  const bridgeGaps = (radius) => WING_OFFSETS.map((offset) => ({ center: station.theta + offset, halfWidth: bridgeGapHalf(radius) }));

  buildParapet(scene, station.theta - phi, station.theta + phi, station.y, station.y, () => WORLD.shaftR);
  buildParapet(scene, station.theta - phi, station.theta + phi, station.y, station.y, () => WORLD.hubR, bridgeGaps(WORLD.hubR));
  buildParapet(scene, station.theta - phi, station.theta + phi, station.y, station.y, () => WORLD.ringInnerR, bridgeGaps(WORLD.ringInnerR));

  // Support pillars with twin tube lights, spaced around the ring (skipping
  // the doorway gaps so they don't block a wing's entrance).
  const pillarR = (WORLD.ringInnerR + WORLD.landingR) / 2;
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x54585c, side: THREE.DoubleSide });
  for (let a = -phi + 0.35; a <= phi - 0.35 + 1e-6; a += 0.44) {
    const nearWing = WING_OFFSETS.some((offset) => Math.abs(a - offset) < doorHalf + 0.12);
    if (nearWing) continue;
    const theta = station.theta + a;
    const x = pillarR * Math.cos(theta);
    const z = pillarR * Math.sin(theta);

    // Base / shaft / capital, like the flared column bases and capitals
    // visible throughout the reference stills, instead of a plain cylinder.
    const capH = 0.2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, capH, 12), pillarMat);
    base.position.set(x, station.y + capH / 2, z);
    scene.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, H - capH * 2, 12), pillarMat);
    shaft.position.set(x, station.y + H / 2, z);
    scene.add(shaft);
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.2, capH, 12), pillarMat);
    capital.position.set(x, station.y + H - capH / 2, z);
    scene.add(capital);
    for (const hFrac of [0.3, 0.68]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), new THREE.MeshBasicMaterial({ color: station.light }));
      tube.position.set(x * 1.05, station.y + H * hFrac, z * 1.05);
      scene.add(tube);
    }
  }

  return { wallTex, floorTex };
}

// One wing (corridor + room) branching off a station's hall at `angleOffset`
// radians from the station's own angle. Wing 0 is always the station's main
// themed room; the rest are smaller generic side rooms.
function buildWing(scene, station, angleOffset, roomHalfW, roomDepth, wallTex, floorTex, withLore) {
  const H = WORLD.roomHeight;
  const wingAngle = station.theta + angleOffset;

  const localGroup = new THREE.Group();
  localGroup.position.set(0, station.y, 0);
  localGroup.rotation.y = -wingAngle;
  scene.add(localGroup);

  // Bridge crossing the open void from the hub to the outer ring.
  {
    const bridgeStart = WORLD.hubR;
    const bridgeEnd = WORLD.ringInnerR;
    const bridgeMidX = (bridgeStart + bridgeEnd) / 2;
    const bw = WORLD.bridgeHalfW;
    addBox(localGroup, { x: bridgeMidX, y: -0.03, z: 0, w: bridgeEnd - bridgeStart, h: 0.06, d: bw * 2, map: floorTex, repeat: [2, 1], color: 0xffffff });
    // Solid concrete parapets on both sides (not an open railing), with a
    // thin dark metal cap bar on top, matching the stair/hall guard walls.
    for (const side of [-1, 1]) {
      addBox(localGroup, { x: bridgeMidX, y: PARAPET_HEIGHT / 2, z: side * bw, w: bridgeEnd - bridgeStart, h: PARAPET_HEIGHT, d: PARAPET_THICKNESS, color: 0x66675f });
      addBox(localGroup, { x: bridgeMidX, y: PARAPET_HEIGHT + 0.03, z: side * bw, w: bridgeEnd - bridgeStart, h: 0.05, d: 0.07, color: 0x1e2023 });
    }
    addGlow(localGroup, { x: bridgeMidX, y: 1.5, z: 0, color: station.light });
  }

  const corridorStart = WORLD.landingR - 0.4;
  const roomStart = WORLD.landingR + WORLD.corridorLen;
  const roomEnd = roomStart + roomDepth;
  const corridorMidX = (corridorStart + roomStart) / 2;

  addBox(localGroup, { x: corridorMidX, y: -0.03, z: 0, w: roomStart - corridorStart, h: 0.06, d: WORLD.corridorHalfW * 2, map: floorTex, repeat: [3, 1], color: 0xffffff });
  addBox(localGroup, { x: corridorMidX, y: H + 0.03, z: 0, w: roomStart - corridorStart, h: 0.06, d: WORLD.corridorHalfW * 2, color: station.wall });
  for (const side of [-1, 1]) {
    addBox(localGroup, {
      x: corridorMidX,
      y: H / 2,
      z: side * (WORLD.corridorHalfW + 0.12),
      w: roomStart - corridorStart,
      h: H,
      d: 0.24,
      map: wallTex,
      repeat: [3, 1],
      color: 0xffffff,
    });
  }
  for (let i = 0; i < 2; i++) {
    const x = lerp(corridorStart + 1.5, roomStart - 1.5, i);
    addGlow(localGroup, { x, y: H - 0.3, z: 0, color: station.light });
  }

  const roomMidX = (roomStart + roomEnd) / 2;
  const hw = roomHalfW;
  addBox(localGroup, { x: roomMidX, y: -0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, map: floorTex, repeat: [roomDepth / 3, (hw * 2) / 3], color: 0xffffff });
  addBox(localGroup, { x: roomMidX, y: H + 0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, color: station.wall });
  for (const side of [-1, 1]) {
    addBox(localGroup, { x: roomMidX, y: H / 2, z: side * (hw + 0.12), w: roomEnd - roomStart, h: H, d: 0.24, map: wallTex, repeat: [roomDepth / 3, 1], color: 0xffffff });
  }
  addBox(localGroup, { x: roomEnd + 0.12, y: H / 2, z: 0, w: 0.24, h: H, d: hw * 2, map: wallTex, repeat: [1, (hw * 2) / 3], color: 0xffffff });

  let loreMesh = null;
  if (withLore) {
    const loreTex = makePlaqueTexture([station.name, `NÍVEL ${station.level}`], { fg: 0xf0e6c8, bg: 0x0d0f10 });
    loreMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.58), new THREE.MeshBasicMaterial({ map: loreTex, side: THREE.DoubleSide }));
    loreMesh.position.set(corridorStart + 2.1, 1.7, -WORLD.corridorHalfW + 0.13);
    localGroup.add(loreMesh);
  }

  return { localGroup, roomStart, roomEnd, roomHalfW: hw, loreMesh };
}

// ---------------------------------------------------------------------------
// Per-theme room dressing. Each receives the rotated local group plus the
// room's local X span ([roomStart, roomEnd]) and half-width.
// ---------------------------------------------------------------------------

function themeTopo(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const tex = makeWastelandTexture({ seed: station.level });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.7, H * 0.78), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  screen.position.set(roomEnd - 0.3, H * 0.52, 0);
  screen.rotation.y = -Math.PI / 2;
  group.add(screen);
  addBox(group, { x: roomStart + 1.6, y: 0.5, z: 0, w: 2.4, h: 1, d: 1.4, color: 0x565f66 });
  for (let i = -1; i <= 1; i++) {
    addGlow(group, { x: roomStart + 1.6, y: 1.02, z: i * 0.4, r: 0.05, color: station.accent });
  }
  for (let i = 0; i < 3; i++) {
    addBox(group, { x: roomStart + 2 + i * 2.6, y: H - 0.12, z: 0, w: 1.6, h: 0.08, d: 0.3, color: station.accent, emissive: station.accent, emissiveIntensity: 0.8 });
  }
  addBox(group, { x: roomStart + 3.2, y: 0.55, z: hw - 0.9, w: 1.1, h: 1.1, d: 0.5, color: 0x4d555c });
  addBox(group, { x: roomStart + 3.2, y: 0.55, z: -hw + 0.9, w: 1.1, h: 1.1, d: 0.5, color: 0x4d555c });
  addFixtureLight(group, { x: roomEnd - 2.5, y: H - 0.4, z: 0, color: station.light, intensity: 9 });
}

function themeTi(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const rackH = H * 0.72;
  for (let row = -1; row <= 1; row++) {
    if (Math.abs(row) > hw / 1.6) continue;
    for (let col = 0; col < 4; col++) {
      const x = roomStart + 1.4 + col * 1.5;
      if (x > roomEnd - 1) continue;
      addBox(group, { x, y: rackH / 2, z: row * 1.6, w: 0.7, h: rackH, d: 0.6, color: 0x9aa4ac });
      for (let k = 0; k < 4; k++) {
        addGlow(group, { x: x + 0.36, y: 0.4 + k * (rackH / 5), z: row * 1.6, r: 0.03, color: k % 2 === 0 ? station.accent : 0x3fae5a });
      }
    }
  }
  addBox(group, { x: roomEnd - 0.3, y: H / 2, z: 0, w: 0.2, h: H * 0.9, d: hw, color: 0x3a4249 });
  addFixtureLight(group, { x: roomStart + 2, y: H - 0.3, z: 0, color: station.light, intensity: 10 });
  addGlow(group, { x: roomEnd - 2, y: H - 0.3, z: 0, color: station.light });
}

function themeJudicial(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const tableX = (roomStart + roomEnd) / 2;
  addBox(group, { x: tableX, y: 0.42, z: 0, w: Math.min(6, roomEnd - roomStart - 2), h: 0.08, d: 1.4, color: 0x2c2723 });
  addBox(group, { x: tableX, y: 0.2, z: 0, w: Math.min(6, roomEnd - roomStart - 2) - 0.4, h: 0.4, d: 1.1, color: 0x1f1b18 });
  addCylinder(group, { x: roomEnd - 1.4, y: 0.6, z: 0, r: 0.55, h: 0.1, color: station.accent, emissive: station.accent, emissiveIntensity: 0.5 });
  addBox(group, { x: roomEnd - 1.4, y: 0.35, z: 0, w: 1.2, h: 0.7, d: 1.2, color: 0x3a332e });
  for (let i = 0; i < 3; i++) {
    const x = roomStart + 1 + i * ((roomEnd - roomStart - 2) / 2);
    addBox(group, { x, y: H - 0.1, z: -hw + 0.13, w: 1.4, h: 0.12, d: 0.06, color: station.accent, emissive: station.accent, emissiveIntensity: 1.1 });
    addBox(group, { x, y: H - 0.1, z: hw - 0.13, w: 1.4, h: 0.12, d: 0.06, color: station.accent, emissive: station.accent, emissiveIntensity: 1.1 });
  }
  for (const side of [-1, 1]) {
    addCylinder(group, { x: roomStart + 1, y: H * 0.5, z: side * (hw - 0.6), r: 0.16, h: H, color: 0x2a2622 });
  }
  addFixtureLight(group, { x: tableX, y: H - 0.4, z: 0, color: station.light, intensity: 9 });
}

function themeNinho(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  addBox(group, { x: roomStart + 1.5, y: 0.4, z: -hw * 0.4, w: 1.6, h: 0.8, d: 0.9, color: 0x6b5c3f });
  addBox(group, { x: roomStart + 1.1, y: 0.9, z: -hw * 0.4, w: 0.5, h: 0.2, d: 0.5, color: 0x2c2c2c, emissive: station.accent, emissiveIntensity: 0.3 });
  const cellX0 = roomEnd - 3;
  for (let i = -3; i <= 3; i++) {
    addCylinder(group, { x: cellX0 + (i + 3) * 0.25, y: H * 0.5 - 0.1, z: hw * 0.3, r: 0.025, h: H * 0.75, color: 0x333333 });
  }
  addBox(group, { x: cellX0 + 1.2, y: 0.25, z: hw * 0.3 + 0.9, w: 1.6, h: 0.5, d: 0.8, color: 0x4a4438 });
  addBox(group, { x: roomStart + 0.4, y: H - 0.4, z: hw * 0.4, w: 0.7, h: 1.5, d: 0.1, color: 0x2a2723 });
  addFixtureLight(group, { x: roomStart + 1.5, y: H - 0.35, z: 0, color: station.light, intensity: 9 });
}

function themeBazar(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const cloth = [0xa14b3d, 0x3f7d78, 0xb08a34, 0x6a4f8c];
  let ci = 0;
  for (let x = roomStart + 1.4; x < roomEnd - 1; x += 2.6) {
    for (const side of [-1, 1]) {
      if (Math.abs(side * (hw - 0.9)) > hw) continue;
      const z = side * (hw - 0.9);
      addBox(group, { x, y: 0.45, z, w: 1.3, h: 0.9, d: 0.7, color: 0x5a4630 });
      addBox(group, { x, y: 1.05, z, w: 1.5, h: 0.12, d: 0.9, color: cloth[ci % cloth.length] });
      addGlow(group, { x, y: 1.6, z, color: station.light });
      ci++;
    }
  }
  for (let i = 0; i < 5; i++) {
    addBox(group, { x: lerp(roomStart + 1, roomEnd - 1, i / 4), y: 0.2, z: 0, w: 0.5, h: 0.4, d: 0.5, color: 0x4a3c28, rotY: i * 0.6 });
  }
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.3, z: 0, color: station.light, intensity: 11 });
}

function themeRocas(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  for (let x = roomStart + 1; x < roomEnd - 0.5; x += 1.6) {
    for (const side of [-1, 1]) {
      const z = side * hw * 0.55;
      addBox(group, { x, y: 0.35, z, w: 1.3, h: 0.5, d: hw * 0.7, color: 0x3c3226 });
      for (let p = 0; p < 3; p++) {
        addGlow(group, { x: x + (p - 1) * 0.35, y: 0.65, z, r: 0.16, color: 0x4f8f4a });
      }
      addBox(group, { x, y: 1.3, z, w: 1.3, h: 0.05, d: hw * 0.7, color: station.accent, emissive: station.accent, emissiveIntensity: 1.2 });
    }
  }
  for (let x = roomStart + 1; x < roomEnd; x += 2.4) {
    addBox(group, { x, y: H - 0.1, z: 0, w: 1.6, h: 0.08, d: 0.25, color: station.accent, emissive: station.accent, emissiveIntensity: 1.3 });
  }
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.3, z: 0, color: station.light, intensity: 9 });
}

function themeCreche(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  for (let x = roomStart + 1.2; x < roomEnd - 1; x += 1.1) {
    for (let z = -hw + 0.8; z < hw - 0.5; z += 1.1) {
      addBox(group, { x, y: 0.28, z, w: 0.55, h: 0.5, d: 0.55, color: 0x8a7250 });
      addBox(group, { x, y: 0.58, z, w: 0.4, h: 0.05, d: 0.4, color: 0xc9b98f });
    }
  }
  addBox(group, { x: roomEnd - 0.3, y: 1.2, z: 0, w: 0.06, h: 1.3, d: hw, color: 0x1f2320 });
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.3, z: 0, color: station.light, intensity: 9 });
}

function themeAgua(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  addCylinder(group, { x: roomStart + 2.2, y: H * 0.42, z: hw * 0.45, r: 1.1, h: H * 0.8, color: 0x36504f });
  addCylinder(group, { x: roomStart + 2.2, y: H * 0.42, z: -hw * 0.45, r: 1.1, h: H * 0.8, color: 0x36504f });
  for (let x = roomStart + 4; x < roomEnd - 0.6; x += 1.4) {
    addCylinder(group, { x, y: H - 0.5, z: hw - 0.3, r: 0.12, h: 1.2, rotZ: Math.PI / 2, color: 0x2f3a3a });
  }
  addGlow(group, { x: roomStart + 2.2, y: H - 0.3, z: hw * 0.45, r: 0.1, color: station.accent });
  addGlow(group, { x: roomStart + 2.2, y: H - 0.3, z: -hw * 0.45, r: 0.1, color: station.accent });
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.3, z: 0, color: station.light, intensity: 9 });
}

function themeMecanica(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const grate = makeGrateTexture(station.floor, station.accent);
  addBox(group, { x: (roomStart + roomEnd) / 2, y: -0.01, z: 0, w: roomEnd - roomStart, h: 0.04, d: hw * 2, map: grate, repeat: [(roomEnd - roomStart) / 2, hw], color: 0xffffff });
  const cx = roomStart + (roomEnd - roomStart) * 0.55;
  addCylinder(group, { x: cx, y: H * 0.5, z: 0, r: 1.3, h: H * 0.95, color: 0x33302c });
  addCylinder(group, { x: cx, y: H * 0.5, z: 0, r: 1.34, h: 0.15, color: station.accent, emissive: station.accent, emissiveIntensity: 1.1 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    addBox(group, { x: cx + Math.cos(a) * 1.7, y: 0.3, z: Math.sin(a) * 1.7, w: 0.6, h: 0.6, d: 0.6, color: 0x2a271f, rotY: a });
  }
  addFixtureLight(group, { x: cx, y: H - 0.4, z: 0, color: station.light, intensity: 12 });
  addGlow(group, { x: roomStart + 1.2, y: H - 0.4, z: 0, color: station.light });
}

function themeGerador(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const grate = makeGrateTexture(station.floor, station.accent);
  addBox(group, { x: (roomStart + roomEnd) / 2, y: -0.01, z: 0, w: roomEnd - roomStart, h: 0.04, d: hw * 2, map: grate, repeat: [(roomEnd - roomStart) / 2, hw], color: 0xffffff });
  const cx = roomStart + (roomEnd - roomStart) * 0.58;
  addCylinder(group, { x: cx, y: H * 0.5, z: 0, r: 1.9, h: H * 1.05, color: 0x2a2320 });
  for (let ring = 0; ring < 3; ring++) {
    addCylinder(group, { x: cx, y: H * 0.25 + ring * (H * 0.3), z: 0, r: 1.95, h: 0.12, color: station.accent, emissive: station.accent, emissiveIntensity: 1.4 });
  }
  addFixtureLight(group, { x: cx, y: H * 0.6, z: 0, color: station.light, intensity: 20, distance: 14 });
  addGlow(group, { x: cx - 2, y: 0.6, z: 2.2, color: station.light });
  addGlow(group, { x: cx - 2, y: 0.6, z: -2.2, color: station.light });
  const tex = makePlaqueTexture(["FIM DO POÇO", "NÍVEL 144"], { fg: 0xffcf9e, bg: 0x1a0f0a });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.position.set(roomEnd - 0.28, H * 0.5, 0);
  mesh.rotation.y = -Math.PI / 2;
  group.add(mesh);
}

const THEME_BUILDERS = {
  topo: themeTopo,
  ti: themeTi,
  judicial: themeJudicial,
  ninho: themeNinho,
  bazar: themeBazar,
  rocas: themeRocas,
  creche: themeCreche,
  agua: themeAgua,
  mecanica: themeMecanica,
  gerador: themeGerador,
};

// Smaller, unthemed side rooms that fill out the secondary wings so a floor
// never feels like it has just one door.
function themeGeneric(group, station, roomStart, roomEnd, hw, wingLabel) {
  const H = WORLD.roomHeight;
  const midX = (roomStart + roomEnd) / 2;
  addBox(group, { x: roomStart + 1.2, y: 0.35, z: -hw * 0.45, w: 0.7, h: 0.7, d: 0.6, color: 0x4a4438 });
  addBox(group, { x: roomStart + 2.2, y: 0.3, z: hw * 0.4, w: 0.6, h: 0.6, d: 0.6, color: 0x39352e, rotY: 0.4 });
  addBox(group, { x: roomStart + 2.0, y: 0.3, z: hw * 0.4 - 0.65, w: 0.5, h: 0.5, d: 0.5, color: 0x433c30, rotY: -0.3 });
  addCylinder(group, { x: roomEnd - 1.0, y: H * 0.42, z: 0, r: 0.32, h: H * 0.8, color: 0x363330 });
  addBox(group, { x: midX, y: H - 0.12, z: 0, w: (roomEnd - roomStart) * 0.65, h: 0.08, d: 0.22, color: station.accent, emissive: station.accent, emissiveIntensity: 0.6 });
  for (const side of [-1, 1]) {
    addBox(group, { x: roomEnd - 1.6, y: 1.0, z: side * (hw - 0.5), w: 0.55, h: 1.5, d: 0.08, color: 0x2a2723 });
  }

  const tex = makePlaqueTexture([`ALA ${wingLabel}`, `NÍVEL ${station.level}`], { fg: 0xd8cba4, bg: 0x0c0d0e });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(WORLD.landingR + WORLD.corridorLen * 0.35, 1.7, -WORLD.corridorHalfW + 0.1);
  group.add(sign);

  addGlow(group, { x: midX, y: H - 0.35, z: 0, color: station.light });
}

function buildStation(scene, station, flags, interactables) {
  const { wallTex, floorTex } = buildStationShell(scene, station, flags);

  const wingLabels = ["B", "C"];
  WING_OFFSETS.forEach((offset, i) => {
    const isMain = i === 0;
    const roomHalfW = isMain ? station.roomHalfW : SECONDARY_WING.roomHalfW;
    const roomDepth = isMain ? station.roomDepth : SECONDARY_WING.roomDepth;
    const wing = buildWing(scene, station, offset, roomHalfW, roomDepth, wallTex, floorTex, isMain);

    if (isMain) {
      const builder = THEME_BUILDERS[station.propType] || (() => {});
      builder(wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW);
      interactables.push({ mesh: wing.loreMesh, station });
    } else {
      themeGeneric(wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW, wingLabels[i - 1] || `${i}`);
    }
  });
}

export function buildWorld(scene, layout) {
  buildCentralPole(scene, layout);

  for (const slope of layout.slopes) {
    buildTransit(scene, layout, slope);
  }

  const interactables = [];
  layout.stations.forEach((station, i) => {
    buildStation(scene, station, { isFirst: i === 0, isLast: i === layout.stations.length - 1 }, interactables);
  });

  return { interactables };
}
