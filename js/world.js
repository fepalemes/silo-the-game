import * as THREE from "three";
import { WORLD } from "./config.js";
import { slopeOuterRadius } from "./collision.js";
import { lerp } from "./mathutils.js";
import { makeConcreteTexture, makeGrateTexture, makePlaqueTexture, makeWastelandTexture } from "./textures.js";

const LIGHT_INTENSITY = 14;
const LIGHT_DISTANCE = 11;

// ---------------------------------------------------------------------------
// Small geometry helpers. Every material uses DoubleSide defensively (this
// project has no way to visually QA backface-culling mistakes), and prop
// helpers work in a group's *local* space so callers never touch raw
// trigonometry.
// ---------------------------------------------------------------------------

function addBox(group, { x, y, z, w, h, d, color = 0x808080, rotY = 0, roughness = 0.85, metalness = 0.05, emissive = 0x000000, emissiveIntensity = 0, map = null, repeat = null }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (map && repeat) {
    map = map.clone();
    map.needsUpdate = true;
    map.repeat.set(repeat[0], repeat[1]);
  }
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, map, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  return mesh;
}

function addCylinder(group, { x, y, z, r, r2 = null, h, color = 0x808080, radialSegments = 16, rotX = 0, rotZ = 0, roughness = 0.7, metalness = 0.15, emissive = 0x000000, emissiveIntensity = 0, openEnded = false }) {
  const geo = new THREE.CylinderGeometry(r, r2 === null ? r : r2, h, radialSegments, 1, openEnded);
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, side: THREE.DoubleSide });
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
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, map, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  mesh.rotation.y = -theta;
  group.add(mesh);
  return mesh;
}

// Flat annular wedge (a slice of a ring), built by hand from the same
// (r*cosθ, r*sinθ) formula collision.js uses, so it can never disagree with
// the walkable floor bounds it visually represents.
function buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments = 24) {
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
    uvs.push(t * 4, 0, t * 4, 1);
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

function buildDiscGeometry(radius, segments = 32) {
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
  const geo = new THREE.CylinderGeometry(0.32, 0.38, top - bottom, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, (top + bottom) / 2, 0);
  scene.add(mesh);
}

// ---------------------------------------------------------------------------
// Stair transit between two stations.
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

function buildTransit(scene, layout, slope) {
  const angleSpan = slope.thetaEnd - slope.thetaStart;
  const anglePerStep = (Math.PI * 2) / WORLD.stepsPerTurn;
  const stepCount = Math.max(1, Math.round(angleSpan / anglePerStep));
  const stepThickness = 0.22;

  const treadGeo = new THREE.BoxGeometry(1, 1, 1);
  const treadMat = new THREE.MeshStandardMaterial({ color: 0x5b5c58, roughness: 0.92, metalness: 0.04, side: THREE.DoubleSide });
  const treads = new THREE.InstancedMesh(treadGeo, treadMat, stepCount);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < stepCount; i++) {
    const t = i / stepCount;
    const theta = lerp(slope.thetaStart, slope.thetaEnd, t);
    const y = lerp(slope.yStart, slope.yEnd, t);
    const outerR = slopeOuterRadius(t);
    const radialLen = outerR - WORLD.shaftR;
    const rMid = (WORLD.shaftR + outerR) / 2;
    const tangentialWidth = rMid * anglePerStep * 1.25;

    dummy.position.set(rMid * Math.cos(theta), y - stepThickness / 2, rMid * Math.sin(theta));
    dummy.rotation.set(0, -theta, 0);
    dummy.scale.set(radialLen, stepThickness, tangentialWidth);
    dummy.updateMatrix();
    treads.setMatrixAt(i, dummy.matrix);
  }
  treads.instanceMatrix.needsUpdate = true;
  scene.add(treads);

  const railMat = new THREE.MeshStandardMaterial({ color: 0x2b2e32, roughness: 0.3, metalness: 0.75, side: THREE.DoubleSide });
  const railSegs = Math.max(4, Math.ceil(angleSpan / 0.1));
  const outerCurve = new HelixCurve(slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, 0.95, (t) => slopeOuterRadius(t));
  const innerCurve = new HelixCurve(slope.thetaStart, slope.thetaEnd, slope.yStart, slope.yEnd, 0.95, () => WORLD.shaftR);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(outerCurve, railSegs, 0.045, 6, false), railMat));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(innerCurve, railSegs, 0.045, 6, false), railMat));

  const postGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6);
  const postCount = Math.ceil(stepCount / 4);
  const posts = new THREE.InstancedMesh(postGeo, railMat, postCount * 2);
  let pi = 0;
  for (let i = 0; i < stepCount; i += 4) {
    const t = i / stepCount;
    const theta = lerp(slope.thetaStart, slope.thetaEnd, t);
    const y = lerp(slope.yStart, slope.yEnd, t);
    const outerR = slopeOuterRadius(t);
    for (const r of [WORLD.shaftR, outerR]) {
      dummy.position.set(r * Math.cos(theta), y + 0.47, r * Math.sin(theta));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(pi++, dummy.matrix);
    }
  }
  posts.count = pi;
  posts.instanceMatrix.needsUpdate = true;
  scene.add(posts);

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
// Station shell: circular landing + corridor + room. Returns data the room
// theme + main.js need (room extents, interactable lore panel).
// ---------------------------------------------------------------------------

function buildStationShell(scene, station, { isFirst, isLast }) {
  const H = WORLD.roomHeight;
  const phi = WORLD.plateauHalfAngle;

  const wallTex = makeConcreteTexture(station.wall, { seed: station.level, streaks: true });
  const floorTex = makeConcreteTexture(station.floor, { seed: station.level + 500, streaks: false });

  // --- Landing (absolute world placement, matches collision.js exactly) ---
  const landingGroup = new THREE.Group();
  landingGroup.position.set(0, station.y, 0);
  scene.add(landingGroup);

  // The very top station has nothing above it (cap the ceiling); the very
  // bottom station has nothing below it (cap the floor). Every other
  // station's floor/ceiling stays a ring so the shaft hole is visible.
  const floorGeo = isLast
    ? buildDiscGeometry(WORLD.landingR)
    : buildAnnularSectorGeometry(WORLD.shaftR, WORLD.landingR, station.theta - phi, station.theta + phi);
  const ceilGeo = isFirst
    ? buildDiscGeometry(WORLD.landingR)
    : buildAnnularSectorGeometry(WORLD.shaftR, WORLD.landingR, station.theta - phi, station.theta + phi);

  const floorTexClone = floorTex.clone();
  floorTexClone.needsUpdate = true;
  floorTexClone.repeat.set(1, 1);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexClone, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  landingGroup.add(floorMesh);

  const ceilMat = new THREE.MeshStandardMaterial({ color: station.wall, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide });
  const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
  ceilMesh.position.y = H;
  landingGroup.add(ceilMesh);

  // Outer wall of the landing, minus the corridor doorway gap.
  const doorHalf = Math.atan2(WORLD.corridorHalfW, WORLD.landingR) + 0.05;
  const segsPerSide = 5;
  for (const side of [-1, 1]) {
    for (let i = 0; i < segsPerSide; i++) {
      const t0 = i / segsPerSide;
      const t1 = (i + 1) / segsPerSide;
      const a0 = side * lerp(doorHalf, phi, t0);
      const a1 = side * lerp(doorHalf, phi, t1);
      const theta = station.theta + (a0 + a1) / 2;
      const width = WORLD.landingR * Math.abs(a1 - a0) * 1.1;
      addAbsBox(landingGroup, { r: WORLD.landingR, theta, y: H / 2, w: 0.3, h: H, d: width, color: station.wall, map: wallTex });
    }
  }

  addFixtureLight(landingGroup, { x: 2.6 * Math.cos(station.theta + phi * 0.55), y: H - 0.35, z: 2.6 * Math.sin(station.theta + phi * 0.55), color: station.light });

  // --- Corridor + room (local, rotated group) ---
  const localGroup = new THREE.Group();
  localGroup.position.set(0, station.y, 0);
  localGroup.rotation.y = -station.theta;
  scene.add(localGroup);

  const corridorStart = WORLD.landingR - 0.4;
  const roomStart = WORLD.landingR + WORLD.corridorLen;
  const roomEnd = roomStart + station.roomDepth;
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
    addFixtureLight(localGroup, { x, y: H - 0.3, z: 0, color: station.light, intensity: 10, distance: 8 });
  }

  const roomMidX = (roomStart + roomEnd) / 2;
  const hw = station.roomHalfW;
  addBox(localGroup, { x: roomMidX, y: -0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, map: floorTex, repeat: [station.roomDepth / 3, hw * 2 / 3], color: 0xffffff });
  addBox(localGroup, { x: roomMidX, y: H + 0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, color: station.wall });
  for (const side of [-1, 1]) {
    addBox(localGroup, { x: roomMidX, y: H / 2, z: side * (hw + 0.12), w: roomEnd - roomStart, h: H, d: 0.24, map: wallTex, repeat: [station.roomDepth / 3, 1], color: 0xffffff });
  }
  addBox(localGroup, { x: roomEnd + 0.12, y: H / 2, z: 0, w: 0.24, h: H, d: hw * 2, map: wallTex, repeat: [1, hw * 2 / 3], color: 0xffffff });

  // Lore panel just inside the corridor, facing the player as they walk in.
  const loreTex = makePlaqueTexture([station.name, `NÍVEL ${station.level}`], { fg: 0xf0e6c8, bg: 0x0d0f10 });
  const loreMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.58), new THREE.MeshBasicMaterial({ map: loreTex, side: THREE.DoubleSide }));
  loreMesh.position.set(corridorStart + 2.1, 1.7, -WORLD.corridorHalfW + 0.13);
  localGroup.add(loreMesh);

  return { localGroup, landingGroup, roomStart, roomEnd, wallTex, floorTex, loreMesh };
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
      addBox(group, { x, y: rackH / 2, z: row * 1.6, w: 0.7, h: rackH, d: 0.6, color: 0x9aa4ac, roughness: 0.5, metalness: 0.3 });
      for (let k = 0; k < 4; k++) {
        addGlow(group, { x: x + 0.36, y: 0.4 + k * (rackH / 5), z: row * 1.6, r: 0.03, color: k % 2 === 0 ? station.accent : 0x3fae5a });
      }
    }
  }
  addBox(group, { x: roomEnd - 0.3, y: H / 2, z: 0, w: 0.2, h: H * 0.9, d: hw, color: 0x3a4249 });
  addFixtureLight(group, { x: roomStart + 2, y: H - 0.3, z: 0, color: station.light, intensity: 10 });
  addFixtureLight(group, { x: roomEnd - 2, y: H - 0.3, z: 0, color: station.light, intensity: 10 });
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
  addFixtureLight(group, { x: tableX, y: H - 0.4, z: 0, color: station.light, intensity: 9 });
}

function themeNinho(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  addBox(group, { x: roomStart + 1.5, y: 0.4, z: -hw * 0.4, w: 1.6, h: 0.8, d: 0.9, color: 0x6b5c3f });
  addBox(group, { x: roomStart + 1.1, y: 0.9, z: -hw * 0.4, w: 0.5, h: 0.2, d: 0.5, color: 0x2c2c2c, emissive: station.accent, emissiveIntensity: 0.3 });
  const cellX0 = roomEnd - 3;
  for (let i = -3; i <= 3; i++) {
    addCylinder(group, { x: cellX0 + (i + 3) * 0.25, y: H * 0.5 - 0.1, z: hw * 0.3, r: 0.025, h: H * 0.75, color: 0x333333, roughness: 0.4, metalness: 0.6 });
  }
  addBox(group, { x: cellX0 + 1.2, y: 0.25, z: hw * 0.3 + 0.9, w: 1.6, h: 0.5, d: 0.8, color: 0x4a4438 });
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
      addFixtureLight(group, { x, y: 1.6, z, color: station.light, intensity: 7, distance: 5 });
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
  addCylinder(group, { x: roomStart + 2.2, y: H * 0.42, z: hw * 0.45, r: 1.1, h: H * 0.8, color: 0x36504f, roughness: 0.5, metalness: 0.2 });
  addCylinder(group, { x: roomStart + 2.2, y: H * 0.42, z: -hw * 0.45, r: 1.1, h: H * 0.8, color: 0x36504f, roughness: 0.5, metalness: 0.2 });
  for (let x = roomStart + 4; x < roomEnd - 0.6; x += 1.4) {
    addCylinder(group, { x, y: H - 0.5, z: hw - 0.3, r: 0.12, h: 1.2, rotZ: Math.PI / 2, color: 0x2f3a3a, metalness: 0.5, roughness: 0.4 });
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
  addCylinder(group, { x: cx, y: H * 0.5, z: 0, r: 1.3, h: H * 0.95, color: 0x33302c, roughness: 0.55, metalness: 0.35 });
  addCylinder(group, { x: cx, y: H * 0.5, z: 0, r: 1.34, h: 0.15, color: station.accent, emissive: station.accent, emissiveIntensity: 1.1 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    addBox(group, { x: cx + Math.cos(a) * 1.7, y: 0.3, z: Math.sin(a) * 1.7, w: 0.6, h: 0.6, d: 0.6, color: 0x2a271f, rotY: a });
  }
  addFixtureLight(group, { x: cx, y: H - 0.4, z: 0, color: station.light, intensity: 12 });
  addFixtureLight(group, { x: roomStart + 1.2, y: H - 0.4, z: 0, color: station.light, intensity: 8 });
}

function themeGerador(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const grate = makeGrateTexture(station.floor, station.accent);
  addBox(group, { x: (roomStart + roomEnd) / 2, y: -0.01, z: 0, w: roomEnd - roomStart, h: 0.04, d: hw * 2, map: grate, repeat: [(roomEnd - roomStart) / 2, hw], color: 0xffffff });
  const cx = roomStart + (roomEnd - roomStart) * 0.58;
  addCylinder(group, { x: cx, y: H * 0.5, z: 0, r: 1.9, h: H * 1.05, color: 0x2a2320, roughness: 0.5, metalness: 0.4 });
  for (let ring = 0; ring < 3; ring++) {
    addCylinder(group, { x: cx, y: H * 0.25 + ring * (H * 0.3), z: 0, r: 1.95, h: 0.12, color: station.accent, emissive: station.accent, emissiveIntensity: 1.4 });
  }
  addFixtureLight(group, { x: cx, y: H * 0.6, z: 0, color: station.light, intensity: 20, distance: 14 });
  addFixtureLight(group, { x: cx - 2, y: 0.6, z: 2.2, color: station.light, intensity: 10, distance: 8 });
  addFixtureLight(group, { x: cx - 2, y: 0.6, z: -2.2, color: station.light, intensity: 10, distance: 8 });
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

function buildStation(scene, station, flags, interactables) {
  const { localGroup, roomStart, roomEnd, loreMesh } = buildStationShell(scene, station, flags);
  const builder = THEME_BUILDERS[station.propType] || (() => {});
  builder(localGroup, station, roomStart, roomEnd, station.roomHalfW);
  interactables.push({ mesh: loreMesh, station });
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
