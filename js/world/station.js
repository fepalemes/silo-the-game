import * as THREE from "three";
import { buildResidential } from "./residential.js";
import { dressGallery, dressBridge, dressEntrance } from "./exemplar.js";
import { FACADE, GALLERY_COLUMNS, SIDE_ROOMS, WING_OFFSETS, WORLD, wingSpec } from "../config.js";
import { lerp, scaleHexColor, wrapToPi } from "../mathutils.js";
import { makePlaqueTexture, makeSectorMapTexture } from "../textures.js";
import { claimPanel, letteringMaterial, mountPlate, onPanel } from "./signs.js";
import {
  STRUCTURE_COLORS,
  floorRoughnessFor,
  getFloorSurface,
  getStructureSurface,
  getWallSurface,
  resolveSurface,
  tint,
  wearTierFor,
  workshopSurface,
} from "./materials.js";
import {
  PARAPET_HEIGHT,
  PARAPET_THICKNESS,
  SLAB_THICKNESS,
  WALL_THICKNESS,
  addAbsBox,
  addBox,
  addGlow,
  addInstancedBatch,
  addThickSlab,
  buildAnnularSectorGeometry,
  buildBandGeometry,
  buildDiscGeometry,
  splitAngleRangeByGaps,
} from "./primitives.js";
import {
  buildLanterns,
  buildParapet,
  buildPillarLamps,
  buildRingDoors,
  buildSoffitLights,
} from "./fixtures.js";
import { THEME_BUILDERS, themeGeneric } from "./themes.js";
import { SIDE_ROOM_BUILDERS } from "./rooms.js";
import { MAIN_ROOM_BUILDERS } from "./main-rooms.js";
import { buildCeilingBeams } from "./scenery.js";

// One level of the silo, as a full 360-degree ring floor.
//
// This used to be a "station": one flat plateau spanning a couple of radians,
// with the stair flattening out to become the hall. That model capped the silo
// at a dozen floors and forced the hall to shrink whenever the stair got
// steeper. Now the helix never flattens, every level has a real ring floor
// walkable all the way round, and the two meet at one small landing deck.
//
// `detailed` levels are the hand-authored landmarks and get wings and a themed
// room; the ~130 generated ones get the ring, its doors and its lights. Both
// are walkable. Everything that repeats around the ring is instanced: at 148
// levels, one stray per-segment Mesh is thousands of objects.
// The full-height ring wall needs its concrete tiled rather than stretched
// over 5 x 7.7m panels. One clone per wear tier, shared by every level: a
// clone per level is a texture upload per level (see materials.js).
const tallWallSurfaces = new Map();
function tallWallSurface(tier, wallTex) {
  if (!tallWallSurfaces.has(tier)) tallWallSurfaces.set(tier, resolveSurface(wallTex, [2, 3]));
  return tallWallSurfaces.get(tier);
}

function buildStationShell(scene, station, { isFirst, isLast, detailed }) {
  const H = WORLD.roomHeight;
  const TAU = Math.PI * 2;
  const phi = WORLD.landingHalfAngle;

  // Shared neutral concrete, tinted to this level's palette by the materials
  // that use it (see SURFACE_BASE), at the wear tier for its depth.
  const tier = wearTierFor(station.level);
  const wallTex = getWallSurface(tier);
  const floorTex = station.level === 1 ? workshopSurface("stone") : getFloorSurface(tier);

  const landingGroup = new THREE.Group();
  landingGroup.position.set(0, station.y, 0);
  scene.add(landingGroup);

  const landingSurface = resolveSurface(floorTex, null);
  const floorMat = new THREE.MeshStandardMaterial({
    color: tint(station.floor),
    map: landingSurface.map,
    normalMap: landingSurface.normalMap,
    roughnessMap: landingSurface.roughnessMap || null,
    roughness: floorRoughnessFor(station.level),
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const ceilSurface = resolveSurface(wallTex, null);
  const ceilMat = new THREE.MeshStandardMaterial({
    // Deliberately darker than the walls: a ceiling the same tone as
    // everything else just reads as a blank plane overhead.
    color: scaleHexColor(tint(station.wall), 0.62),
    map: ceilSurface.map,
    normalMap: ceilSurface.normalMap,
    roughness: 0.96,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const edgeSurface = resolveSurface(wallTex, null);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: scaleHexColor(tint(station.wall), 0.72),
    map: edgeSurface.map,
    normalMap: edgeSurface.normalMap,
    roughness: 0.96,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // --- The ring: a real floor, all 360 degrees of it ---
  // Floor and ceiling run a little way into the wall rather than stopping at
  // its nominal radius. The wall is flat panels approximating a curve, so
  // between panel centres its face sits up to 14cm further out - and a slab
  // that stops at the nominal radius leaves a crescent of open air at the foot
  // and the head of every panel.
  const intoWall = WALL_THICKNESS / 2;
  addThickSlab(landingGroup, {
    innerR: WORLD.ringInnerR,
    outerR: WORLD.landingR + intoWall,
    thetaStart: 0,
    thetaEnd: TAU,
    thickness: SLAB_THICKNESS,
    topMat: floorMat,
    edgeMat,
    segments: 72,
  });
  // Only the top level has a ceiling of its own over the gallery: the dome's
  // drum stands on it. Every other gallery is open the full height of the
  // level to the underside of the slab above, with the two-storey facade
  // behind it (facade.js) - the double-height galleries of every reference,
  // where a ceiling 3.4m up used to hide the upper storey entirely.
  if (isFirst) {
    const ringCeil = new THREE.Mesh(buildAnnularSectorGeometry(WORLD.ringInnerR, WORLD.landingR + intoWall, 0, TAU, 72), ceilMat);
    ringCeil.position.y = H;
    landingGroup.add(ringCeil);
  }
  // The wall rises to the slab above, except on the top level (see above).
  const wallTop = isFirst ? H : FACADE.top + 0.02;

  // --- The landing deck: the only place the ring and the stair touch ---
  // Spans the void from the stair's flare out to the ring. The helix is flat
  // across exactly this angular window (see classifyTheta), so the deck and
  // the treads meet level. The window follows the level's own landing bearing:
  // with a non-integer number of turns per level, that is 60 degrees further
  // round on every floor rather than always due east.
  addThickSlab(landingGroup, {
    innerR: WORLD.shaftR,
    outerR: WORLD.ringInnerR,
    thetaStart: station.theta - phi,
    thetaEnd: station.theta + phi,
    thickness: SLAB_THICKNESS,
    topMat: floorMat,
    edgeMat,
    segments: 20,
  });

  // The very top opens into the dome (dome.js); the very bottom needs a floor
  // under the light well.
  if (isLast) {
    landingGroup.add(new THREE.Mesh(buildDiscGeometry(WORLD.ringInnerR), floorMat));
  }

  // --- Outer wall, all the way round, with a doorway per wing ---
  // One InstancedMesh, not one Mesh per segment: 29 segments x 148 levels
  // would be 4,300 objects on its own.
  const doorHalf = Math.asin(WORLD.corridorHalfW / WORLD.landingR);
  const wallCenterR = WORLD.landingR + WALL_THICKNESS / 2;
  const wingAngles = detailed ? WING_OFFSETS.map((o) => (station.wingRotation || 0) + o) : [];
  // Wing bearings run past 2*PI (wingRotation + offset), and the wall is laid
  // from 0 to 2*PI: without the copies one turn either side, a doorway past
  // the seam was never cut, and a solid wall stood across a corridor the
  // collision let you walk into (tools/world-check.cjs: WALKS-THROUGH).
  const doorGaps = wingAngles.flatMap((a) => [-TAU, 0, TAU].map((k) => ({ center: a + k, halfWidth: doorHalf })));

  const wallSurface = isFirst ? resolveSurface(wallTex, null) : tallWallSurface(tier, wallTex);
  const wallMat = new THREE.MeshStandardMaterial({
    color: tint(station.wall),
    map: wallSurface.map,
    normalMap: wallSurface.normalMap,
    roughness: 0.93,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const wallMatrices = [];
  const ringDoors = [];
  const portholes = [];
  // What each wall panel carries. Everything fixed to the ring wall afterwards
  // (level plate, notices, level 1's signage) picks a bare one from this list.
  station.panels = [];
  const dummy = new THREE.Object3D();
  let wallCount = 0;
  for (const span of splitAngleRangeByGaps(0, TAU, doorGaps)) {
    const spanAngle = span.end - span.start;
    const n = Math.max(1, Math.round(spanAngle / 0.22));
    for (let i = 0; i < n; i++) {
      const a0 = span.start + (spanAngle * i) / n;
      const a1 = span.start + (spanAngle * (i + 1)) / n;
      const theta = (a0 + a1) / 2;
      // 8% overlap: these are flat boxes approximating a curve, so butt joints
      // would open a hairline you can see straight through.
      const width = WORLD.landingR * (a1 - a0) * 1.08;
      dummy.position.set(wallCenterR * Math.cos(theta), wallTop / 2, wallCenterR * Math.sin(theta));
      dummy.rotation.set(0, -theta, 0);
      dummy.scale.set(WALL_THICKNESS, wallTop, width);
      dummy.updateMatrix();
      wallMatrices.push(dummy.matrix.clone());
      wallCount++;
      const kind = wallCount % 2 === 0 ? "door" : wallCount % 3 === 0 ? "porthole" : "blank";
      station.panels.push({ theta, width: WORLD.landingR * (a1 - a0), kind, taken: false });
      if (kind === "door") {
        ringDoors.push({ r: WORLD.landingR - 0.03, theta, label: `${station.level}-${String(wallCount).padStart(2, "0")}` });
      } else if (kind === "porthole") {
        portholes.push({ r: WORLD.landingR - 0.02, theta, y: H * 0.6 });
      }
    }
  }
  // Over each wing's doorway the wall carries on above the corridor's lintel.
  if (!isFirst) {
    for (const angle of wingAngles) {
      const width = 2 * doorHalf * WORLD.landingR * 1.1;
      dummy.position.set(wallCenterR * Math.cos(angle), (H + wallTop) / 2, wallCenterR * Math.sin(angle));
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(WALL_THICKNESS, wallTop - H, width);
      dummy.updateMatrix();
      wallMatrices.push(dummy.matrix.clone());
    }
  }
  if (wallMatrices.length > 0) {
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, wallMatrices.length);
    wallMatrices.forEach((m, i) => wall.setMatrixAt(i, m));
    wall.instanceMatrix.needsUpdate = true;
    landingGroup.add(wall);
  }
  // The doors, windows, balconies and stairs of every other level are the
  // facade's (facade.js), built once the whole silo is laid out.
  if (isFirst) {
    buildRingDoors(landingGroup, ringDoors, { wallColor: station.wall, accentColor: station.accent });
    buildPortholes(landingGroup, portholes);
  }

  // --- Guard walls ---
  // Around the ring's inner edge, all the way round except where the landing
  // deck crosses; and down both sides of the deck itself.
  const half = PARAPET_THICKNESS / 2;
  // The inner guard wall opens at the landing and again at every bay - a bay
  // you cannot walk into is just a shelf.
  const innerGaps = [
    { center: station.theta, halfWidth: phi + 0.02 },
    { center: station.theta + TAU, halfWidth: phi + 0.02 },
    ...(station.bays || []).flatMap((bay) => [
      { center: bay.bearing, halfWidth: bay.halfWidth + 0.02 },
      { center: bay.bearing + TAU, halfWidth: bay.halfWidth + 0.02 },
      { center: bay.bearing - TAU, halfWidth: bay.halfWidth + 0.02 },
    ]),
  ];
  buildParapet(scene, station.theta, station.theta + TAU, station.y, station.y, () => WORLD.ringInnerR, innerGaps, half);

  // --- Bays: rounded balconies pushed out over the shaft ---------------------
  // These are the only places on a floor where you can stand past the ring's
  // edge and look straight up and down the silo.
  for (const bay of station.bays || []) {
    const tipR = WORLD.ringInnerR - bay.reach;
    addThickSlab(landingGroup, {
      innerR: tipR,
      outerR: WORLD.ringInnerR + 0.05,
      thetaStart: bay.bearing - bay.halfWidth,
      thetaEnd: bay.bearing + bay.halfWidth,
      thickness: SLAB_THICKNESS,
      topMat: floorMat,
      edgeMat,
      segments: 14,
      capOuter: false,
    });
    // Curved parapet around the tip, standing on its own slab.
    buildParapet(scene, bay.bearing - bay.halfWidth, bay.bearing + bay.halfWidth, station.y, station.y, () => tipR, [], half);
    // Radial cheeks closing the two sides back to the ring.
    for (const side of [-1, 1]) {
      const a = bay.bearing + side * bay.halfWidth;
      const midR = (tipR + WORLD.ringInnerR) / 2;
      addBox(landingGroup, {
        x: midR * Math.cos(a),
        y: PARAPET_HEIGHT / 2,
        z: midR * Math.sin(a),
        w: WORLD.ringInnerR - tipR,
        h: PARAPET_HEIGHT,
        d: PARAPET_THICKNESS,
        rotY: -a,
        map: getStructureSurface(),
        color: STRUCTURE_COLORS.deckGuard,
      });
    }
  }
  buildDeckParapets(scene, station, phi);

  // --- The gallery columns ---
  // The columns themselves run the whole height of the silo in one piece
  // (scenery.js); each level adds its ring lamp, hung just under the slab
  // above where the column passes it, and the columns' footprint.
  const columns = GALLERY_COLUMNS.angles.map((a) => ({ x: GALLERY_COLUMNS.r * Math.cos(a), z: GALLERY_COLUMNS.r * Math.sin(a), a }));
  station.obstacles = columns.map((c) => ({ x: GALLERY_COLUMNS.r, z: 0, hw: GALLERY_COLUMNS.radius - 0.04, hd: GALLERY_COLUMNS.radius - 0.04, angle: c.a }));
  const lampY = isFirst ? 2.46 : FACADE.top - 0.5;
  if (!isFirst) buildPillarLamps(landingGroup, columns, lampY);

  if (isFirst) {
    // --- Hung lanterns under the top level's ceiling ---
    const lanterns = [];
    for (let a = 0.22; a < TAU - 1e-6; a += 0.3) {
      if (wingAngles.some((w) => Math.abs(wrapToPi(a - w)) < doorHalf)) continue;
      lanterns.push({ r: WORLD.ringInnerR + 1.4, theta: a, y: H });
    }
    buildLanterns(landingGroup, lanterns, 0xffd5a0);
    for (const lamp of lanterns.filter((_, i) => i % 3 === 0)) {
      const light = new THREE.PointLight(0xffdbaf, 19, 10, 2);
      light.position.set(lamp.r * Math.cos(lamp.theta), H - 0.8, lamp.r * Math.sin(lamp.theta));
      landingGroup.add(light);
    }
    buildCeilingBeams(landingGroup, { y: H - 0.18, innerR: WORLD.ringInnerR, outerR: WORLD.landingR, material: edgeMat });
  } else {
    // --- Under the slab above: beams, and strip lights along its edge ---
    // The gallery soffit of silo-19: plain concrete with linear fittings
    // near the edge. The real light sources (pooled, see index.js) stand in
    // for the fittings, the column lamps and the lit windows together.
    buildCeilingBeams(landingGroup, { y: FACADE.top - 0.17, innerR: WORLD.ringInnerR, outerR: WORLD.landingR, material: edgeMat });
    const strips = [];
    for (let a = 0.12; a < TAU - 1e-6; a += 0.26) {
      if (columns.some((c) => Math.abs(wrapToPi(a - c.a)) < 0.09)) continue;
      strips.push(a);
    }
    buildSoffitLights(landingGroup, strips.map((a) => ({ r: WORLD.ringInnerR + 1.15, theta: a, y: FACADE.top - 0.34 })));
    strips.forEach((a, i) => {
      if (i % 3 !== 1) return;
      const light = new THREE.PointLight(0xffdcb0, 46, 15, 2);
      light.position.set(18.6 * Math.cos(a), 5.4, 18.6 * Math.sin(a));
      landingGroup.add(light);
    });
  }
  // The level plate: on a bare panel, flat against it, with a body. It used to
  // stand 36cm clear of the wall as a bare two-sided plane.
  //
  // Every level gets the production's tall sign - number in a band across the
  // head, sector diagram below - not just the two that had it. The generic
  // "008 JUDICIAL" strip the others carried was this project's own invention.
  station.platePanel = claimPanel(station, 0, Math.PI);
  if (station.platePanel) {
    const authored = station.level === 1 || station.id === "residencial";
    const texture = authored
      ? makeSectorMapTexture(station.level, station.name)
      : makeSectorMapTexture(station.level, station.generated ? "Habitações · Serviços" : station.name, {
        labels: station.generated ? ["HABITAÇÕES", "SERVIÇOS", "OFICINAS"] : [station.name.toUpperCase(), ...(SIDE_ROOMS[station.id] || []).map((room) => room.label)],
        scale: station.generated ? 2 / 3 : 1,
      });
    // On level 1 it sits to one side, leaving the panel's centre for the
    // wayfinding sign (exemplar.js).
    const at = onPanel(station.platePanel, station.level === 1 ? -1.55 : 0, 0.03);
    mountPlate(landingGroup, letteringMaterial(texture), { w: 0.9, h: 1.8, x: at.x, y: 1.9, z: at.z, rotY: at.rotY, depth: 0.04 });
  }

  if (station.level === 1) dressGallery(landingGroup, ringDoors, columns, station);
  return { wallTex, floorTex };
}

// Portholes, batched. One Mesh per porthole was fine for a dozen stations and
// is 1,500 objects across 148 levels.
function buildPortholes(group, portholes) {
  if (portholes.length === 0) return;
  const at = (p, dr) => ({ x: (p.r + dr) * Math.cos(p.theta), y: p.y, z: (p.r + dr) * Math.sin(p.theta), rotY: -p.theta });
  addInstancedBatch(
    group,
    new THREE.BoxGeometry(0.05, 0.42, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x63625c, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }),
    portholes.map((p) => at(p, 0))
  );
  addInstancedBatch(
    group,
    new THREE.BoxGeometry(0.03, 0.3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.12, metalness: 0.2, side: THREE.DoubleSide }),
    portholes.map((p) => at(p, -0.02))
  );
}

// Low walls down both sides of the landing deck, so crossing the void from the
// stair to the ring is a walled bridge rather than an open ledge.
function buildDeckParapets(scene, station, phi) {
  // buildParapet sweeps around a radius; the deck's edges run along one, so
  // these are plain boxes in the deck's own rotated frame instead.
  const half = PARAPET_THICKNESS / 2;
  const group = new THREE.Group();
  group.position.set(0, station.y, 0);
  group.rotation.y = -station.theta;
  scene.add(group);
  // Rails begin outside the stair, leaving the ascent/descent unobstructed.
  if (station.level === 1) dressBridge(group);
  const innerR = WORLD.hubR;
  const outerR = WORLD.ringInnerR + 0.12;
  const midR = (innerR + outerR) / 2;
  const len = outerR - innerR;
  for (const side of [-1, 1]) {
    const angle = side * phi;
    const x = midR * Math.cos(angle) + half * Math.sin(phi);
    const z = midR * Math.sin(angle) - side * half * Math.cos(phi);
    addBox(group, { x, y: PARAPET_HEIGHT / 2, z, w: len, h: PARAPET_HEIGHT, d: PARAPET_THICKNESS, map: getStructureSurface(), color: STRUCTURE_COLORS.deckGuard, rotY: -angle });
    addBox(group, { x, y: PARAPET_HEIGHT + 0.03, z, w: len, h: 0.05, d: 0.07, color: 0x23262a, rotY: -angle });
  }
}

// One wing (corridor + room) branching off a station's hall at `angleOffset`
// radians from the station's own angle. Wing 0 is always the station's main
// themed room; the rest are smaller generic side rooms.
function buildWing(scene, station, angleOffset, spec, wallTex, floorTex, withLore, label) {
  const H = WORLD.roomHeight;
  const roomDepth = spec.depth;
  // A room may stand taller than its corridor (the generator hall).
  const roomH = spec.height || H;
  // Wings hang off the ring wherever the level's rotation puts them - they no
  // longer have to fit inside a plateau, and no longer need a bridge over the
  // void, because the ring is reached from the landing deck instead.
  //
  // `wingRotation` is already an absolute bearing. Adding the landing's own
  // bearing on top drew every wing below level 1 a sixth of a turn or more
  // away from its doorway and its collision: the door opened onto the void and
  // the corridor sat sealed behind solid wall (tools/world-check.cjs catches it).
  const wingAngle = (station.wingRotation || 0) + angleOffset;

  const localGroup = new THREE.Group();
  localGroup.position.set(0, station.y, 0);
  localGroup.rotation.y = -wingAngle;
  scene.add(localGroup);

  // The corridor begins inside the thickness of the ring wall, not 40cm short
  // of it. Starting it out in the gallery laid its floor and ceiling exactly
  // over the ring's own (two coplanar surfaces flickering against each other
  // across the whole threshold) and left its side walls standing out of the
  // ring wall as a pair of fins. What little overlap remains, within the wall,
  // is set 4mm below the ring's floor and above its ceiling so the ring wins.
  const corridorStart = WORLD.landingR + 0.15;
  const roomStart = WORLD.landingR + WORLD.corridorLen;
  const roomEnd = roomStart + roomDepth;
  const corridorMidX = (corridorStart + roomStart) / 2;

  addBox(localGroup, { x: corridorMidX, y: -0.034, z: 0, w: roomStart - corridorStart, h: 0.06, d: WORLD.corridorHalfW * 2, map: floorTex, repeat: [3, 1], color: tint(station.floor) });
  addBox(localGroup, { x: corridorMidX, y: H + 0.034, z: 0, w: roomStart - corridorStart, h: 0.06, d: WORLD.corridorHalfW * 2, color: tint(station.wall) });
  // The side walls run 7cm past the floor and the ceiling, which sit 4mm
  // off the nominal planes (above); stopping them at 0 and H opened a slit
  // the length of the corridor at both junctions.
  for (const side of [-1, 1]) {
    addBox(localGroup, {
      x: corridorMidX,
      y: H / 2,
      z: side * (WORLD.corridorHalfW + 0.12),
      w: roomStart - corridorStart,
      h: H + 0.14,
      d: 0.24,
      map: wallTex,
      repeat: [3, 1],
      color: tint(station.wall),
    });
  }
  for (let i = 0; i < 2; i++) {
    const x = lerp(corridorStart + 1.5, roomStart - 1.5, i);
    addGlow(localGroup, { x, y: H - 0.3, z: 0, color: station.light, mount: "ceiling", ceilingY: H });
  }

  const roomMidX = (roomStart + roomEnd) / 2;
  const hw = spec.halfW;
  // A round hall builds its own shell (cafeteria.js, rooms.js).
  const boxRoom = spec.shape !== "round";
  if (boxRoom) {
    addBox(localGroup, { x: roomMidX, y: -0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, map: floorTex, repeat: [roomDepth / 3, (hw * 2) / 3], color: tint(station.floor) });
    addBox(localGroup, { x: roomMidX, y: roomH + 0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, color: tint(station.wall) });
    for (const side of [-1, 1]) {
      addBox(localGroup, { x: roomMidX, y: roomH / 2, z: side * (hw + 0.12), w: roomEnd - roomStart, h: roomH, d: 0.24, map: wallTex, repeat: [roomDepth / 3, roomH / H], color: tint(station.wall) });
    }
    addBox(localGroup, { x: roomEnd + 0.12, y: roomH / 2, z: 0, w: 0.24, h: roomH, d: hw * 2, map: wallTex, repeat: [1, (hw * 2) / 3], color: tint(station.wall) });
    // The room's front wall, either side of the corridor mouth. Without it the
    // room was a three-sided box: turn round at the far end and the whole gap
    // between corridor and side wall looked straight out at the silo's shell.
    const sideWallOuter = WORLD.corridorHalfW + 0.24;
    for (const side of [-1, 1]) {
      addBox(localGroup, { x: roomStart - 0.12, y: roomH / 2, z: side * (sideWallOuter + (hw + 0.24 - sideWallOuter) / 2), w: 0.24, h: roomH, d: hw + 0.24 - sideWallOuter, map: wallTex, repeat: [1, roomH / H], color: tint(station.wall) });
    }
    // Over the corridor's mouth, up to a taller room's ceiling.
    if (roomH > H) addBox(localGroup, { x: roomStart - 0.12, y: (H + roomH) / 2, z: 0, w: 0.24, h: roomH - H, d: sideWallOuter * 2 + 0.02, map: wallTex, repeat: [1, 1], color: tint(station.wall) });
  }

  // A lintel closes the head of the doorway in the ring wall and carries the
  // sign. The sign used to hang loose in the opening as a two-sided plane, so
  // everyone walking back out of the corridor read it mirrored.
  // Deep enough for the sign to hang clear below the gallery's ceiling ribs,
  // one of which runs straight at every doorway.
  const lintelH = 0.95;
  // Level 1's doorways have a portal frame of their own (exemplar.js), with a
  // cable tray and a lamp running through the opening above it.
  if (station.level !== 1) addBox(localGroup, { x: WORLD.landingR + WALL_THICKNESS / 2, y: H - lintelH / 2, z: 0, w: WALL_THICKNESS, h: lintelH, d: WORLD.corridorHalfW * 2 + 0.5, map: wallTex, repeat: [1, 1], color: tint(station.wall) });
  // Level 1's portal frame (exemplar.js) stands proud of the wall; its sign
  // sits on the frame rather than behind it.
  const onFrame = station.level === 1;
  mountPlate(localGroup, letteringMaterial(makePlaqueTexture([label, `SILO 18 · ${String(station.level).padStart(2, "0")}`], { bg: 0x30362f, fg: 0xd5ccab })), {
    w: 2.3, h: 0.48, x: WORLD.landingR - (onFrame ? 0.26 : 0.03), y: onFrame ? 3.08 : 2.72, z: 0, rotY: -Math.PI / 2, depth: onFrame ? 0.05 : 0.03,
  });
  for (const x of [corridorStart + 3, roomStart - 2]) {
    addBox(localGroup, { x, y: H - 0.07, z: 0, w: 1.2, h: 0.12, d: 0.28, color: 0x363a33 });
    addBox(localGroup, { x, y: H - 0.14, z: 0, w: 1.05, h: 0.04, d: 0.19, color: 0xffe2b8, emissive: 0xffd5a0, emissiveIntensity: 1.2 });
    const light = new THREE.PointLight(0xffdeb3, 16, 9, 2);
    light.position.set(x, H - 0.4, 0);
    localGroup.add(light);
  }
  let loreMesh = null;
  if (withLore) {
    const loreTex = makePlaqueTexture([station.name, `NÍVEL ${station.level}`], { fg: 0xf0e6c8, bg: 0x0d0f10 });
    loreMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.58), letteringMaterial(loreTex));
    loreMesh.position.set(WORLD.landingR + 1.7, 1.7, -WORLD.corridorHalfW + 0.13);
    localGroup.add(loreMesh);
  }

  return { localGroup, roomStart, roomEnd, roomHalfW: hw, loreMesh };
}

// ---------------------------------------------------------------------------
// Per-theme room dressing. Each receives the rotated local group plus the
// room's local X span ([roomStart, roomEnd]) and half-width.
// ---------------------------------------------------------------------------

export function buildStation(scene, station, flags, interactables) {
  const { wallTex, floorTex } = buildStationShell(scene, station, flags);
  // Generated levels are walkable rings with closed doors; only the authored
  // landmarks get corridors and a themed room behind them.
  if (!flags.detailed) return;

  const wingLabels = ["B", "C"];
  WING_OFFSETS.forEach((offset, i) => {
    const isMain = i === 0;
    if (station.id === "residencial" && isMain) {
      buildResidential(scene, station, (station.wingRotation || 0) + offset, interactables);
      return;
    }
    const spec = wingSpec(station, i);
    const label = isMain ? (station.id === "topo" ? "CAFETERIA" : station.name) : spec.label || "SERVIÇOS";
    const wing = buildWing(scene, station, offset, spec, wallTex, floorTex, isMain, label);

    if (station.level === 1) dressEntrance(wing.localGroup, station, offset, isMain);
    wing.localGroup.userData.collision = { station, angle: (station.wingRotation || 0) + offset };
    if (isMain) {
      const builder = MAIN_ROOM_BUILDERS[station.propType] || THEME_BUILDERS[station.propType];
      if (!builder) {
        console.warn(`world.js: nenhum tema registrado para propType "${station.propType}" (nível ${station.level}) - sala ficará vazia`);
      }
      (builder || (() => {}))(wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW, spec);
      interactables.push({ mesh: wing.loreMesh, station });
    } else if (SIDE_ROOM_BUILDERS[spec.kind]) {
      SIDE_ROOM_BUILDERS[spec.kind](wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW, { ...spec, wing: wingLabels[i - 1] || `${i}` });
    } else {
      themeGeneric(wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW, wingLabels[i - 1] || `${i}`);
    }
  });
}
