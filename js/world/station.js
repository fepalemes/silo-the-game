import * as THREE from "three";
import { buildResidential } from "./residential.js";
import { dressGallery, dressBridge, dressEntrance } from "./exemplar.js";
import { LEVEL_HEIGHT, SECONDARY_WING, WING_OFFSETS, WORLD } from "../config.js";
import { lerp, scaleHexColor, wrapToPi } from "../mathutils.js";
import { makePlaqueTexture, makeSectorMapTexture } from "../textures.js";
import {
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
  buildRingDoors,
} from "./fixtures.js";
import { THEME_BUILDERS, themeGeneric } from "./themes.js";
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
  addThickSlab(landingGroup, {
    innerR: WORLD.ringInnerR,
    outerR: WORLD.landingR,
    thetaStart: 0,
    thetaEnd: TAU,
    thickness: SLAB_THICKNESS,
    topMat: floorMat,
    edgeMat,
    segments: 72,
  });
  const ringCeil = new THREE.Mesh(buildAnnularSectorGeometry(WORLD.ringInnerR, WORLD.landingR, 0, TAU, 72), ceilMat);
  ringCeil.position.y = H;
  landingGroup.add(ringCeil);

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

  // The very top needs a roof over the whole light well or you look up past
  // the stair into empty background; the very bottom needs a floor under it.
  if (isFirst) {
    const roof = new THREE.Mesh(buildAnnularSectorGeometry(0, WORLD.ringInnerR, 0, TAU, 72), ceilMat);
    roof.position.y = H;
    landingGroup.add(roof);
    buildCeilingBeams(landingGroup, { y: H - 0.18, innerR: WORLD.hubR * 0.5, outerR: WORLD.ringInnerR, material: edgeMat });
  }
  if (isLast) {
    landingGroup.add(new THREE.Mesh(buildDiscGeometry(WORLD.ringInnerR), floorMat));
  }

  // --- Outer wall, all the way round, with a doorway per wing ---
  // One InstancedMesh, not one Mesh per segment: 29 segments x 148 levels
  // would be 4,300 objects on its own.
  const doorHalf = Math.asin(WORLD.corridorHalfW / WORLD.landingR);
  const wallCenterR = WORLD.landingR + WALL_THICKNESS / 2;
  const wingAngles = detailed ? WING_OFFSETS.map((o) => (station.wingRotation || 0) + o) : [];
  const doorGaps = wingAngles.map((a) => ({ center: a, halfWidth: doorHalf }));

  const wallSurface = resolveSurface(wallTex, null);
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
      dummy.position.set(wallCenterR * Math.cos(theta), H / 2, wallCenterR * Math.sin(theta));
      dummy.rotation.set(0, -theta, 0);
      dummy.scale.set(WALL_THICKNESS, H, width);
      dummy.updateMatrix();
      wallMatrices.push(dummy.matrix.clone());
      wallCount++;
      if (wallCount % 2 === 0) {
        ringDoors.push({ r: WORLD.landingR - 0.03, theta, label: `${station.level}-${String(wallCount).padStart(2, "0")}` });
      } else if (wallCount % 3 === 0) {
        portholes.push({ r: WORLD.landingR - 0.02, theta, y: H * 0.6 });
      }
    }
  }
  if (wallMatrices.length > 0) {
    const wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wallMat, wallMatrices.length);
    wallMatrices.forEach((m, i) => wall.setMatrixAt(i, m));
    wall.instanceMatrix.needsUpdate = true;
    landingGroup.add(wall);
  }
  buildRingDoors(landingGroup, ringDoors, { wallColor: station.wall, accentColor: station.accent });
  buildPortholes(landingGroup, portholes);

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
        color: 0x8a8578,
      });
    }
  }
  buildDeckParapets(scene, station, phi);

  // --- Pillars: instanced, three batches for base / shaft / capital ---
  const pillarR = (WORLD.ringInnerR + WORLD.landingR) / 2;
  const capH = 0.26;
  const pillarShaftR = 0.45;
  const flareR = 0.62;
  const bases = [];
  const shafts = [];
  const capitals = [];
  for (let a = 0; a < TAU - 1e-6; a += 0.44) {
    if (wingAngles.some((w) => Math.abs(wrapToPi(a - w)) < doorHalf + 0.12)) continue;
    const x = pillarR * Math.cos(a);
    const z = pillarR * Math.sin(a);
    bases.push({ x, y: capH / 2, z });
    shafts.push({ x, y: H / 2, z });
    capitals.push({ x, y: H - capH / 2, z });
  }
  station.obstacles = shafts.map((p) => ({ x: p.x, z: p.z, hw: 0.45, hd: 0.45, angle: 0 }));
  const pillarMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xa29c8b, roughness: 0.88, metalness: 0.04, side: THREE.DoubleSide });
  addInstancedBatch(landingGroup, new THREE.CylinderGeometry(pillarShaftR, flareR, capH, 12), pillarMat, bases);
  addInstancedBatch(landingGroup, new THREE.CylinderGeometry(pillarShaftR - 0.04, pillarShaftR, H - capH * 2, 12), pillarMat, shafts);
  addInstancedBatch(landingGroup, new THREE.CylinderGeometry(flareR, pillarShaftR - 0.04, capH, 12), pillarMat, capitals);

  // --- Hung lanterns between the pillars, all the way round ---
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
  // The service storey closes the facade between inhabited galleries.
  // Previously this band was empty air all the way to the distant shell.
  landingGroup.add(new THREE.Mesh(buildBandGeometry(WORLD.landingR, 0, TAU, LEVEL_HEIGHT - SLAB_THICKNESS, H, 96, false), wallMat));
  buildCeilingBeams(landingGroup, { y: H - 0.18, innerR: WORLD.ringInnerR, outerR: WORLD.landingR, material: edgeMat });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.9), new THREE.MeshBasicMaterial({ map: makePlaqueTexture([String(station.level).padStart(3, "0"), station.generated ? "HABITAÇÕES · SERVIÇOS" : station.name], { bg: 0x34382f, fg: 0xe1d7b7 }), side: THREE.DoubleSide }));
  if(station.level===1 || station.id==='residencial') {
    plate.geometry.dispose();plate.geometry=new THREE.PlaneGeometry(.9,1.8);
    plate.material.map.dispose();plate.material.map=makeSectorMapTexture(station.level,station.name);
  }
  plate.position.set(WORLD.landingR - 0.36, 1.9, 0);
  plate.rotation.y = -Math.PI / 2;
  landingGroup.add(plate);

  if (station.level === 1) dressGallery(landingGroup, ringDoors, shafts, station);
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
    addBox(group, { x, y: PARAPET_HEIGHT / 2, z, w: len, h: PARAPET_HEIGHT, d: PARAPET_THICKNESS, map: getStructureSurface(), color: 0x8a8578, rotY: -angle });
    addBox(group, { x, y: PARAPET_HEIGHT + 0.03, z, w: len, h: 0.05, d: 0.07, color: 0x23262a, rotY: -angle });
  }
}

// One wing (corridor + room) branching off a station's hall at `angleOffset`
// radians from the station's own angle. Wing 0 is always the station's main
// themed room; the rest are smaller generic side rooms.
function buildWing(scene, station, angleOffset, roomHalfW, roomDepth, wallTex, floorTex, withLore) {
  const H = WORLD.roomHeight;
  // Wings hang off the ring wherever the level's rotation puts them - they no
  // longer have to fit inside a plateau, and no longer need a bridge over the
  // void, because the ring is reached from the landing deck instead.
  const wingAngle = station.theta + (station.wingRotation || 0) + angleOffset;

  const localGroup = new THREE.Group();
  localGroup.position.set(0, station.y, 0);
  localGroup.rotation.y = -wingAngle;
  scene.add(localGroup);

  const corridorStart = WORLD.landingR - 0.4;
  const roomStart = WORLD.landingR + WORLD.corridorLen;
  const roomEnd = roomStart + roomDepth;
  const corridorMidX = (corridorStart + roomStart) / 2;

  addBox(localGroup, { x: corridorMidX, y: -0.03, z: 0, w: roomStart - corridorStart, h: 0.06, d: WORLD.corridorHalfW * 2, map: floorTex, repeat: [3, 1], color: tint(station.floor) });
  addBox(localGroup, { x: corridorMidX, y: H + 0.03, z: 0, w: roomStart - corridorStart, h: 0.06, d: WORLD.corridorHalfW * 2, color: tint(station.wall) });
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
      color: tint(station.wall),
    });
  }
  for (let i = 0; i < 2; i++) {
    const x = lerp(corridorStart + 1.5, roomStart - 1.5, i);
    addGlow(localGroup, { x, y: H - 0.3, z: 0, color: station.light, mount: "ceiling", ceilingY: H });
  }

  const roomMidX = (roomStart + roomEnd) / 2;
  const hw = roomHalfW;
  addBox(localGroup, { x: roomMidX, y: -0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, map: floorTex, repeat: [roomDepth / 3, (hw * 2) / 3], color: tint(station.floor) });
  addBox(localGroup, { x: roomMidX, y: H + 0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, color: tint(station.wall) });
  for (const side of [-1, 1]) {
    addBox(localGroup, { x: roomMidX, y: H / 2, z: side * (hw + 0.12), w: roomEnd - roomStart, h: H, d: 0.24, map: wallTex, repeat: [roomDepth / 3, 1], color: tint(station.wall) });
  }
  addBox(localGroup, { x: roomEnd + 0.12, y: H / 2, z: 0, w: 0.24, h: H, d: hw * 2, map: wallTex, repeat: [1, (hw * 2) / 3], color: tint(station.wall) });

  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.65, 0.55), new THREE.MeshBasicMaterial({ map: makePlaqueTexture([withLore ? (station.id === "topo" ? "CAFETERIA" : station.name) : "SERVIÇOS", "SILO 18"], { bg: 0x30362f, fg: 0xd5ccab }), side: THREE.DoubleSide }));
  sign.position.set(corridorStart + 0.1, station.level === 1 ? 3.08 : 2.85, 0);
  sign.rotation.y = -Math.PI / 2;
  localGroup.add(sign);
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

export function buildStation(scene, station, flags, interactables) {
  const { wallTex, floorTex } = buildStationShell(scene, station, flags);
  // Generated levels are walkable rings with closed doors; only the authored
  // landmarks get corridors and a themed room behind them.
  if (!flags.detailed) return;

  const wingLabels = ["B", "C"];
  WING_OFFSETS.forEach((offset, i) => {
    const isMain = i === 0;
    if(station.id==='residencial' && isMain) {
      buildResidential(scene,station,(station.wingRotation||0)+offset,interactables);
      return;
    }
    const roomHalfW = isMain ? station.roomHalfW : SECONDARY_WING.roomHalfW;
    const roomDepth = isMain ? station.roomDepth : SECONDARY_WING.roomDepth;
    const wing = buildWing(scene, station, offset, roomHalfW, roomDepth, wallTex, floorTex, isMain);

    if (station.level === 1) dressEntrance(wing.localGroup, station, offset, isMain);
    wing.localGroup.userData.collision = { station, angle: (station.wingRotation || 0) + offset };
    if (isMain) {
      const builder = THEME_BUILDERS[station.propType];
      if (!builder) {
        console.warn(`world.js: nenhum tema registrado para propType "${station.propType}" (nível ${station.level}) - sala ficará vazia`);
      }
      (builder || (() => {}))(wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW);
      interactables.push({ mesh: wing.loreMesh, station });
    } else {
      themeGeneric(wing.localGroup, station, wing.roomStart, wing.roomEnd, wing.roomHalfW, wingLabels[i - 1] || `${i}`);
    }
  });
}
