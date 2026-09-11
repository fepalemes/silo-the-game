import * as THREE from "three";
import { SECONDARY_WING, WING_OFFSETS, WORLD } from "./config.js";
import { slopeOuterRadius } from "./collision.js";
import { lerp, lerpHexColor, scaleHexColor } from "./mathutils.js";
import { makeConcreteSurface, makeGrateTexture, makePlaqueTexture, makeWastelandTexture, mulberry32 } from "./textures.js";

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

// `map` accepts either a raw THREE.Texture or a {map, normalMap} surface
// from textures.js. Surfaces are what make concrete read as concrete: the
// normal map gives the point lights something to catch on.
function resolveSurface(map, repeat) {
  if (!map) return { map: null, normalMap: null };
  const surface = map.isTexture ? { map, normalMap: null } : map;
  if (!repeat) return surface;

  const cloned = { map: null, normalMap: null };
  for (const key of ["map", "normalMap"]) {
    if (!surface[key]) continue;
    const tex = surface[key].clone();
    tex.needsUpdate = true;
    tex.repeat.set(repeat[0], repeat[1]);
    cloned[key] = tex;
  }
  return cloned;
}

function addBox(group, { x, y, z, w, h, d, color = 0x808080, rotY = 0, emissive = 0x000000, emissiveIntensity = 0, map = null, repeat = null, roughness = 0.92, metalness = 0.04 }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const surface = resolveSurface(map, repeat);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    map: surface.map,
    normalMap: surface.normalMap,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  group.add(mesh);
  return mesh;
}

function addCylinder(group, { x, y, z, r, r2 = null, h, color = 0x808080, radialSegments = 16, rotX = 0, rotZ = 0, emissive = 0x000000, emissiveIntensity = 0, openEnded = false, roughness = 0.75, metalness = 0.12 }) {
  const geo = new THREE.CylinderGeometry(r, r2 === null ? r : r2, h, radialSegments, 1, openEnded);
  const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  mesh.rotation.z = rotZ;
  group.add(mesh);
  return mesh;
}

function addGlow(group, { x, y, z, r = 0.09, color = 0xffffff }) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4) }));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addFixtureLight(group, { x, y, z, color = 0xffaa55, intensity = LIGHT_INTENSITY, distance = LIGHT_DISTANCE }) {
  // Global punch multiplier: ambient fill was lowered to bring back contrast,
  // so the practical lights have to carry more of the room.
  const light = new THREE.PointLight(color, intensity * 1.9, distance * 1.25, 2);
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
  const surface = resolveSurface(map, null);
  const mat = new THREE.MeshStandardMaterial({
    color,
    map: surface.map,
    normalMap: surface.normalMap,
    roughness: 0.93,
    metalness: 0.03,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  mesh.rotation.y = -theta;
  group.add(mesh);
  return mesh;
}

// Batches many copies of one shape into a single draw call. Everything
// repeated around a ring (doors, lanterns) goes through this - with twelve
// floors, building these as individual meshes costs hundreds of extra draw
// calls for no visual gain.
function addInstancedBatch(group, geo, mat, placements) {
  if (placements.length === 0) return null;
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.rotX || 0, p.rotY || 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return mesh;
}

// Closed apartment/service doors around the ring wall, facing the hall.
// Purely decorative (they never open), but the reference stills show the
// ring lined with dozens of them, and that is most of what makes a floor
// read as inhabited rather than empty.
function buildRingDoors(group, doors, { wallColor, accentColor }) {
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
function buildLanterns(group, lanterns, color) {
  if (lanterns.length === 0) return;
  const at = (l, dy) => ({ x: l.r * Math.cos(l.theta), y: l.y + dy, z: l.r * Math.sin(l.theta) });

  addInstancedBatch(
    group,
    new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.65 }),
    lanterns.map((l) => at(l, 0.22))
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
// or two, so instancing would not pay off).
function addLantern(group, { x, z, y, color }) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.45, metalness: 0.65 }));
  stem.position.set(x, y + 0.22, z);
  group.add(stem);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.34, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.0) }));
  shade.position.set(x, y - 0.17, z);
  group.add(shade);
}

// A small recessed square vent/porthole on a wall segment, facing the hall -
// the little square windows visible along the balconies in the reference
// stills.
function addPorthole(group, { r, theta, y }) {
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0x63625c, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
  frame.position.set(r * Math.cos(theta), y, r * Math.sin(theta));
  frame.rotation.y = -theta;
  group.add(frame);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0x0c0e10, roughness: 0.12, metalness: 0.2, side: THREE.DoubleSide }));
  glass.position.set((r - 0.02) * Math.cos(theta), y, (r - 0.02) * Math.sin(theta));
  glass.rotation.y = -theta;
  group.add(glass);
}

// Flat annular wedge (a slice of a ring), built by hand from the same
// (r*cosθ, r*sinθ) formula collision.js uses, so it can never disagree with
// the walkable floor bounds it visually represents.
function buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments = 48, tileSize = 3.5) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  // UVs are in world units / tileSize on BOTH axes. A fixed 0..1 across the
  // radius stretches the texture into concentric bands on a wide ring.
  const midR = (innerR + outerR) / 2;
  const arcLen = Math.abs(thetaEnd - thetaStart) * midR;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = lerp(thetaStart, thetaEnd, t);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(innerR * cos, 0, innerR * sin);
    positions.push(outerR * cos, 0, outerR * sin);
    normals.push(0, 1, 0, 0, 1, 0);
    const u = (t * arcLen) / tileSize;
    uvs.push(u, innerR / tileSize, u, outerR / tileSize);
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

// Vertical ruled band (a cylinder segment) built from the same
// (r*cosθ, r*sinθ) formula as everything else, so it can never disagree
// with the annular sectors it caps.
function buildBandGeometry(radius, thetaStart, thetaEnd, yTop, yBottom, segments = 48, faceOutward = true) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const sign = faceOutward ? 1 : -1;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = lerp(thetaStart, thetaEnd, t);
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    positions.push(radius * cos, yTop, radius * sin);
    positions.push(radius * cos, yBottom, radius * sin);
    normals.push(sign * cos, 0, sign * sin, sign * cos, 0, sign * sin);
    const u = (t * Math.abs(thetaEnd - thetaStart) * radius) / 2.5;
    uvs.push(u, (yTop - yBottom) / 2.5, u, 0);
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

// A floor with real thickness: top surface, underside, and the edge fascia
// you actually see from across the void. Without the fascia a floor reads
// as an infinitely thin sheet of paper from any oblique angle.
function addThickSlab(group, { innerR, outerR, thetaStart, thetaEnd, y = 0, thickness = 0.55, topMat, edgeMat, segments = 64, capOuter = false }) {
  const top = new THREE.Mesh(buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments), topMat);
  top.position.y = y;
  group.add(top);

  const under = new THREE.Mesh(buildAnnularSectorGeometry(innerR, outerR, thetaStart, thetaEnd, segments), edgeMat);
  under.position.y = y - thickness;
  group.add(under);

  group.add(new THREE.Mesh(buildBandGeometry(innerR, thetaStart, thetaEnd, y, y - thickness, segments, false), edgeMat));
  if (capOuter) {
    group.add(new THREE.Mesh(buildBandGeometry(outerR, thetaStart, thetaEnd, y, y - thickness, segments, true), edgeMat));
  }
  return top;
}

function buildDiscGeometry(radius, segments = 40) {
  const geo = new THREE.CircleGeometry(radius, segments);
  geo.rotateX(-Math.PI / 2); // CircleGeometry is built in the XY plane; lay it flat.
  return geo;
}

// ---------------------------------------------------------------------------
// Dressing that makes the shaft read as an inhabited 144-level silo rather
// than twelve slabs floating in fog: lit windows, densely stacked decorative
// levels, full-height service risers and radial beams across the void.
// ---------------------------------------------------------------------------

// How many distinct door-number plates each floor gets before they repeat.
const PLATE_POOL_SIZE = 3;

const WINDOW_PALETTE = [0xffc98a, 0xffb367, 0xf7e2b0, 0x9fd8ff, 0xd8eaff, 0xffa64d];

// A band of apartment windows around a facade. Lit and unlit ones are mixed
// through per-instance colours, which is what stops a stacked level from
// looking like a repeating texture.
function buildWindowBand(group, { radius, y, count, seed = 1, facingOut = false, litChance = 0.68 }) {
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

// One decorative level: a slab from the ring out to the shell, a facade wall
// facing the shaft, and a band of windows in it. Materials come from the
// caller and are shared across every filler in the same stretch - building
// them per level clones the concrete textures dozens of times over, which
// costs seconds of load and a pile of VRAM for no visible difference.
function buildFillerLevel(scene, y, mats, seed) {
  const facadeR = WORLD.ringInnerR;

  // Top surface plus the edge fascia that gives it visible thickness. The
  // underside is skipped: these are scenery seen from across the void, and
  // the double-sided top already covers the view from below.
  const top = new THREE.Mesh(buildAnnularSectorGeometry(facadeR, WORLD.shellR, 0, Math.PI * 2, 56), mats.slab);
  top.position.y = y;
  scene.add(top);
  scene.add(new THREE.Mesh(buildBandGeometry(facadeR, 0, Math.PI * 2, y, y - SLAB_THICKNESS, 56, false), mats.edge));

  // Facade parapet facing the shaft, with the window band set into it.
  const facade = new THREE.Mesh(
    new THREE.CylinderGeometry(facadeR, facadeR, WORLD.fillerSpacing * 0.82, 48, 1, true),
    mats.facade
  );
  facade.position.y = y + WORLD.fillerSpacing * 0.41;
  scene.add(facade);

  buildWindowBand(scene, {
    radius: facadeR - 0.12,
    y: y + WORLD.fillerSpacing * 0.5,
    count: 34,
    seed,
    litChance: 0.62,
  });
}

// One material set per stretch between two playable floors, tinted to the
// midpoint of their palettes.
function makeFillerMaterials(from, to) {
  const tier = wearTierFor(from.level);
  const wall = tint(lerpHexColor(from.wall, to.wall, 0.5));
  const floor = tint(lerpHexColor(from.floor, to.floor, 0.5));
  return {
    slab: new THREE.MeshStandardMaterial({ ...resolveSurface(getFloorSurface(tier), null), color: floor, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide }),
    edge: new THREE.MeshStandardMaterial({ ...resolveSurface(getWallSurface(tier), null), color: wall, roughness: 0.96, metalness: 0.02, side: THREE.DoubleSide }),
    facade: new THREE.MeshStandardMaterial({ ...resolveSurface(getWallSurface(tier), [24, 1]), color: wall, roughness: 0.94, metalness: 0.03, side: THREE.DoubleSide }),
  };
}

// Packs decorative levels into the vertical gaps between the playable ones.
function buildFillerLevels(scene, layout) {
  const stations = layout.stations;
  const spacing = WORLD.fillerSpacing;
  const clearance = WORLD.roomHeight + 1.2; // keep clear of a real station's slab
  let seed = 1;

  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const mats = makeFillerMaterials(from, to);
    for (let y = from.y - spacing; y > to.y + clearance; y -= spacing) {
      if (from.y - y < clearance) continue;
      buildFillerLevel(scene, y, mats, seed++);
    }
  }
}

// Full-height service risers running up the shaft, broken so they pass
// through (rather than across) each station's bridges. The fat pipes with
// light strips are one of the most recognisable things in the wide shots.
function buildServiceRisers(scene, layout) {
  const stations = layout.stations;
  const riserR = 8.6;
  const angles = [0.6, 2.1, 3.6, 5.1];
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x3c4147, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide });
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfe4ff).multiplyScalar(1.9) });

  // Vertical gaps between the station bands - the risers live in these.
  const bands = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const top = stations[i].y - 1.2;
    const bottom = stations[i + 1].y + WORLD.roomHeight + 1.2;
    if (top - bottom > 3) bands.push({ top, bottom });
  }

  for (const angle of angles) {
    for (const band of bands) {
      const h = band.top - band.bottom;
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, h, 12), pipeMat);
      pipe.position.set(riserR * Math.cos(angle), (band.top + band.bottom) / 2, riserR * Math.sin(angle));
      scene.add(pipe);

      // Light strip down the shaft-facing side of the pipe.
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.16, h * 0.86), stripMat);
      const sr = riserR - 0.64;
      strip.position.set(sr * Math.cos(angle), (band.top + band.bottom) / 2, sr * Math.sin(angle));
      strip.rotation.y = Math.PI / 2 - angle + Math.PI;
      scene.add(strip);

      // Collars where the pipe passes a floor.
      for (const yc of [band.top, band.bottom]) {
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.36, 12), pipeMat);
        collar.position.set(riserR * Math.cos(angle), yc, riserR * Math.sin(angle));
        scene.add(collar);
      }
    }
  }
}

// Coffered ceiling: radial ribs plus a couple of concentric ring beams under
// the outer slab. Without these the ceiling over the ring is one enormous
// blank plane that fills the top half of the screen.
function buildCeilingBeams(group, { y, innerR, outerR, material }) {
  const radialCount = 28;
  const span = outerR - innerR;
  const midR = (innerR + outerR) / 2;

  const ribGeo = new THREE.BoxGeometry(span, 0.34, 0.5);
  const ribs = [];
  for (let i = 0; i < radialCount; i++) {
    const theta = (i / radialCount) * Math.PI * 2;
    ribs.push({ x: midR * Math.cos(theta), y, z: midR * Math.sin(theta), rotY: -theta });
  }
  addInstancedBatch(group, ribGeo, material, ribs);

  // Concentric beams tying the ribs together.
  for (const f of [0.34, 0.68]) {
    const r = innerR + span * f;
    group.add(new THREE.Mesh(buildBandGeometry(r, 0, Math.PI * 2, y + 0.17, y - 0.17, 56, true), material));
  }
}

// Radial beams crossing the void between the hub and the ring at decorative
// levels, echoing the bridge lattice seen looking down the shaft.
function buildVoidBeams(scene, layout) {
  const stations = layout.stations;
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x5a5f63, roughness: 0.9, metalness: 0.08, side: THREE.DoubleSide });
  const inner = WORLD.hubR + 0.4;
  const outer = WORLD.ringInnerR;
  const len = outer - inner;
  const midR = (inner + outer) / 2;

  const geo = new THREE.BoxGeometry(len, 0.34, 1.1);
  const placements = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    const step = (from.y - to.y) / 4;
    for (let k = 1; k <= 3; k++) {
      const y = from.y - step * k;
      const theta = (i * 1.7 + k * 2.4) % (Math.PI * 2);
      placements.push({ x: midR * Math.cos(theta), y, z: midR * Math.sin(theta), rotY: -theta });
    }
  }
  addInstancedBatch(scene, geo, beamMat, placements);
}

// ---------------------------------------------------------------------------
// The silo's outer concrete shell: a single cylinder wrapping everything,
// with structural ribs on the inner face. Without it you can see straight
// out of the world into empty fog wherever a floor plate ends.
// ---------------------------------------------------------------------------

function buildOuterShell(scene, layout) {
  const top = layout.stations[0].y + 14;
  const bottom = layout.stations[layout.stations.length - 1].y - 14;
  const height = top - bottom;
  const midY = (top + bottom) / 2;
  const R = WORLD.shellR;

  const vRepeat = Math.max(8, Math.round(height / 9));
  const shellSurface = resolveSurface(getWallSurface(1), [46, vRepeat]);

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, height, 72, 1, true),
    new THREE.MeshStandardMaterial({
      map: shellSurface.map,
      normalMap: shellSurface.normalMap,
      color: 0x7e868c,
      roughness: 0.96,
      metalness: 0.02,
      side: THREE.BackSide, // we only ever see it from the inside
    })
  );
  shell.position.set(0, midY, 0);
  scene.add(shell);

  // Vertical ribs / pilasters running the full height, batched into one draw
  // call. These are what give the shell a sense of curvature and scale.
  const ribCount = 36;
  const ribGeo = new THREE.BoxGeometry(0.9, height, 1.8);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide });
  const ribs = new THREE.InstancedMesh(ribGeo, ribMat, ribCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < ribCount; i++) {
    const theta = (i / ribCount) * Math.PI * 2;
    const r = R - 0.45;
    dummy.position.set(r * Math.cos(theta), midY, r * Math.sin(theta));
    dummy.rotation.set(0, -theta, 0);
    dummy.updateMatrix();
    ribs.setMatrixAt(i, dummy.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  scene.add(ribs);
}

// ---------------------------------------------------------------------------
// Central pole spanning the whole shaft.
// ---------------------------------------------------------------------------

function buildCentralPole(scene, layout) {
  const top = layout.stations[0].y + 3;
  const bottom = layout.stations[layout.stations.length - 1].y - 3;
  const geo = new THREE.CylinderGeometry(0.42, 0.48, top - bottom, 16);
  const mat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0x8d949c, roughness: 0.62, metalness: 0.28, side: THREE.DoubleSide });
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
const PARAPET_THICKNESS = 0.22;
// Every walkable floor is a real slab this thick, not a zero-thickness
// surface - the fascia is what you actually see from across the void.
const SLAB_THICKNESS = 0.55;
// Ring walls are structural concrete, not partitions.
const WALL_THICKNESS = 0.55;

// All concrete in the silo comes from a tiny pool of shared surfaces, drawn
// in near-neutral grey and then tinted per station through the material's
// `color`. Generating a unique 512px surface (plus its normal map) for each
// of the twelve floors cost several seconds of blocking work at startup for
// no visible gain - it is the same poured concrete everywhere.
// Light neutral so multiplying by a station's palette colour lands back on
// roughly that colour, with the drawn grain/seams/streaks riding on top -
// but not so light that the noise highlights clip to white.
const SURFACE_BASE = 0xd4d4cf;

// Multiplying a light neutral texture by a station's palette colour lands
// noticeably darker than the palette colour itself, and MeshStandardMaterial
// is dimmer than the MeshLambertMaterial this used to use. TINT_GAIN puts
// that brightness back without flattening anything.
const TINT_GAIN = 1.34;
const tint = (hex) => scaleHexColor(hex, TINT_GAIN);
const surfaceCache = new Map();
function sharedSurface(key, options) {
  if (!surfaceCache.has(key)) surfaceCache.set(key, makeConcreteSurface(SURFACE_BASE, options));
  return surfaceCache.get(key);
}

// Three wear tiers instead of one surface per floor: the production notes
// describe the upper levels as kept clean and the lower ones as damp,
// cracked and distressed, but generating a unique surface per station costs
// seconds of load. Tier is picked from depth (see wearTierFor).
const WEAR_TIERS = [0.1, 0.5, 0.95];

const getWallSurface = (tier = 0) =>
  sharedSurface(`wall${tier}`, { seed: 17 + tier * 31, streaks: true, seams: true, normalStrength: 2.6, wear: WEAR_TIERS[tier] });
const getFloorSurface = (tier = 0) =>
  sharedSurface(`floor${tier}`, { seed: 508 + tier * 31, streaks: false, seams: true, normalStrength: 2.2, wear: WEAR_TIERS[tier] });

// 0 = upper silo (clean), 1 = mids, 2 = the deep levels (wet and broken).
function wearTierFor(level) {
  if (level <= 50) return 0;
  if (level <= 100) return 1;
  return 2;
}

// Lower levels are described as genuinely wet, so their floors get a damp
// sheen - lower roughness is the whole trick, and it costs nothing.
function floorRoughnessFor(level) {
  return level <= 50 ? 0.95 : level <= 100 ? 0.82 : 0.55;
}

// Structural concrete (stair treads, guard walls) gets its own variant with
// a fixed repeat baked in, since it is applied to instanced geometry that
// cannot carry per-instance UV scaling.
let structureSurfaceCache = null;
function getStructureSurface() {
  if (!structureSurfaceCache) {
    const surface = makeConcreteSurface(0x8f9088, { seed: 4242, streaks: false, seams: true, normalStrength: 2.8 });
    surface.map.repeat.set(2, 1);
    surface.normalMap.repeat.set(2, 1);
    structureSurfaceCache = surface;
  }
  return structureSurfaceCache;
}

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
  const segAngle = 0.07; // finer, or the curve reads as a row of flat panels
  const segCount = Math.max(6, Math.ceil(angleSpan / segAngle));

  const wallMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0x9a998f, roughness: 0.93, metalness: 0.03, side: THREE.DoubleSide });
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

  const capMat = new THREE.MeshStandardMaterial({ color: 0x1e2023, roughness: 0.42, metalness: 0.7, side: THREE.DoubleSide });
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
  const treadMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0x8a8b84, roughness: 0.9, metalness: 0.05, side: THREE.DoubleSide });
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

  // Shared neutral concrete, tinted to this station's palette by the
  // materials that use it (see SURFACE_BASE), at the wear tier for its depth.
  const tier = wearTierFor(station.level);
  const wallTex = getWallSurface(tier);
  const floorTex = getFloorSurface(tier);

  const landingGroup = new THREE.Group();
  landingGroup.position.set(0, station.y, 0);
  scene.add(landingGroup);

  const landingSurface = resolveSurface(floorTex, null);
  const floorMat = new THREE.MeshStandardMaterial({
    color: tint(station.floor),
    map: landingSurface.map,
    normalMap: landingSurface.normalMap,
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

  // Concrete edge/soffit material: what you see on the underside and the
  // fascia of every slab, from across the void or from the level below.
  const edgeSurface = resolveSurface(wallTex, null);
  const edgeMat = new THREE.MeshStandardMaterial({
    color: scaleHexColor(tint(station.wall), 0.72),
    map: edgeSurface.map,
    normalMap: edgeSurface.normalMap,
    roughness: 0.96,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // Hub (small platform where the stair actually lands): the shaft hole
  // continues past every station except the very top (cap the ceiling,
  // nothing above) and very bottom (cap the floor, nothing below).
  if (isLast) {
    landingGroup.add(new THREE.Mesh(buildDiscGeometry(WORLD.hubR), floorMat));
  } else {
    addThickSlab(landingGroup, {
      innerR: WORLD.shaftR,
      outerR: WORLD.hubR,
      thetaStart: station.theta - phi,
      thetaEnd: station.theta + phi,
      thickness: SLAB_THICKNESS,
      topMat: floorMat,
      edgeMat,
      capOuter: true,
    });
  }
  // At the very top of the silo the roof has to span the whole light well -
  // hub AND void - or you look up past the hub and straight out into empty
  // background where the sky would be.
  const hubCeilGeo = isFirst
    ? buildDiscGeometry(WORLD.ringInnerR, 56)
    : buildAnnularSectorGeometry(WORLD.shaftR, WORLD.hubR, station.theta - phi, station.theta + phi);
  const hubCeilMesh = new THREE.Mesh(hubCeilGeo, ceilMat);
  hubCeilMesh.position.y = H;
  landingGroup.add(hubCeilMesh);
  if (isFirst) {
    buildCeilingBeams(landingGroup, { y: H - 0.18, innerR: WORLD.hubR * 0.5, outerR: WORLD.ringInnerR, material: edgeMat });
  }

  // Outer ring (the walkable hall proper): this is a fixed part of the
  // silo's architecture at every level, so it always keeps its open shape -
  // only the central shaft caps off at the very top/bottom of the silo.
  // Between the hub and the ring there is a real gap with no floor at all
  // (only the bridges built in buildWing cross it), matching the open void
  // around the central stair core in the reference stills.
  addThickSlab(landingGroup, {
    innerR: WORLD.ringInnerR,
    outerR: WORLD.landingR,
    thetaStart: station.theta - phi,
    thetaEnd: station.theta + phi,
    thickness: SLAB_THICKNESS,
    topMat: floorMat,
    edgeMat,
  });
  const ringCeilMesh = new THREE.Mesh(buildAnnularSectorGeometry(WORLD.ringInnerR, WORLD.landingR, station.theta - phi, station.theta + phi), ceilMat);
  ringCeilMesh.position.y = H;
  landingGroup.add(ringCeilMesh);

  // Outer floor plate: a full 360 degree slab from just past the ring wall
  // all the way out to the silo shell. The player can never walk here (the
  // ring wall blocks it), but it is what the eye sees past the end of the
  // hall and through the stair notch - without it you look straight out of
  // the world. Nothing here can collide with the stair helix, which lives
  // entirely inside r < stairOuterR, so it can safely be a complete circle
  // even though the walkable hall is not.
  // Tucks just under the ring wall so no sliver of daylight shows between
  // the wall's outer face and the plate.
  const plateInner = WORLD.landingR - 0.2;
  const plateGeo = buildAnnularSectorGeometry(plateInner, WORLD.shellR, 0, Math.PI * 2, 72);
  addThickSlab(landingGroup, {
    innerR: plateInner,
    outerR: WORLD.shellR,
    thetaStart: 0,
    thetaEnd: Math.PI * 2,
    y: -0.09, // just below the room floors so they win any overlap
    thickness: SLAB_THICKNESS,
    topMat: floorMat,
    edgeMat,
    segments: 72,
  });
  const plateCeil = new THREE.Mesh(plateGeo, ceilMat);
  plateCeil.position.y = H + 0.09;
  landingGroup.add(plateCeil);
  buildCeilingBeams(landingGroup, { y: H - 0.16, innerR: WORLD.ringInnerR, outerR: WORLD.shellR, material: edgeMat });

  // Outer wall of the hall, wrapping almost the whole circle - skipping a
  // small doorway gap at each wing's angle, and near the two ends where the
  // spiral stair actually passes through.
  const doorHalf = Math.atan2(WORLD.corridorHalfW, WORLD.landingR) + 0.05;
  const wallCenterR = WORLD.landingR + WALL_THICKNESS / 2;
  const wallSegAngle = 0.22;
  const segCount = Math.max(10, Math.round((2 * phi) / wallSegAngle));
  let wallCount = 0;
  const ringDoors = [];
  for (let i = 0; i < segCount; i++) {
    const a0 = -phi + (2 * phi * i) / segCount;
    const a1 = -phi + (2 * phi * (i + 1)) / segCount;
    const mid = (a0 + a1) / 2;
    const inDoorway = WING_OFFSETS.some((offset) => Math.abs(mid - offset) < doorHalf);
    if (inDoorway) continue;
    const theta = station.theta + mid;
    const width = WORLD.landingR * (a1 - a0) * 1.1;
    // Centred so the wall's INNER face lands exactly on landingR, which is
    // where collision stops the player's body - same convention as the
    // corridor walls.
    addAbsBox(landingGroup, { r: wallCenterR, theta, y: H / 2, w: WALL_THICKNESS, h: H, d: width, color: tint(station.wall), map: wallTex });
    wallCount++;
    // Alternate between closed apartment/service doors and small vent
    // windows so the ring reads as inhabited all the way around.
    if (wallCount % 2 === 0) {
      ringDoors.push({ r: WORLD.landingR - 0.03, theta, label: `${station.level}-${String(wallCount).padStart(2, "0")}` });
    } else if (wallCount % 3 === 0) {
      addPorthole(landingGroup, { r: WORLD.landingR - 0.02, theta, y: H * 0.6 });
    }
  }
  buildRingDoors(landingGroup, ringDoors, { wallColor: station.wall, accentColor: station.accent });

  // Plinth and cornice: continuous mouldings that give the wall real depth
  // instead of a flat slab. The cornice runs unbroken over the doorways;
  // the plinth has to break at each one.
  const mouldR = WORLD.landingR - 0.12;
  const doorGaps = WING_OFFSETS.map((offset) => ({ center: station.theta + offset, halfWidth: doorHalf }));
  const cornice = new THREE.Mesh(
    buildBandGeometry(mouldR, station.theta - phi, station.theta + phi, H - 0.02, H - 0.34, 56, false),
    edgeMat
  );
  landingGroup.add(cornice);
  for (const span of splitAngleRangeByGaps(station.theta - phi, station.theta + phi, doorGaps)) {
    landingGroup.add(new THREE.Mesh(buildBandGeometry(mouldR, span.start, span.end, 0.42, 0.0, 24, false), edgeMat));
  }

  // Lanterns hung under the ring slab, between the pillars.
  const lanterns = [];
  for (let a = -phi + 0.2; a <= phi - 0.2 + 1e-6; a += 0.3) {
    if (WING_OFFSETS.some((offset) => Math.abs(a - offset) < doorHalf)) continue;
    lanterns.push({ r: WORLD.ringInnerR + 1.4, theta: station.theta + a, y: H - 0.5 });
  }
  buildLanterns(landingGroup, lanterns, station.light);

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
  const pillarMat = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0xc3c8cf, roughness: 0.88, metalness: 0.04, side: THREE.DoubleSide });
  for (let a = -phi + 0.35; a <= phi - 0.35 + 1e-6; a += 0.44) {
    const nearWing = WING_OFFSETS.some((offset) => Math.abs(a - offset) < doorHalf + 0.12);
    if (nearWing) continue;
    const theta = station.theta + a;
    const x = pillarR * Math.cos(theta);
    const z = pillarR * Math.sin(theta);

    // Base / shaft / capital, like the heavy flared columns in the reference
    // stills, instead of a thin cylinder.
    const capH = 0.26;
    const shaftR = 0.45;
    const flareR = 0.62;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(shaftR, flareR, capH, 14), pillarMat);
    base.position.set(x, station.y + capH / 2, z);
    scene.add(base);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftR - 0.04, shaftR, H - capH * 2, 14), pillarMat);
    shaft.position.set(x, station.y + H / 2, z);
    scene.add(shaft);
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(flareR, shaftR - 0.04, capH, 14), pillarMat);
    capital.position.set(x, station.y + H - capH / 2, z);
    scene.add(capital);

    // Tube fixtures mounted flush on the shaft-facing side of the column.
    // These used to be offset by a *percentage* of the radius, which was
    // fine when the hall was 3.5m across and left them hanging a metre off
    // the column once the silo was widened - hence an absolute offset.
    const mountR = pillarR - shaftR - 0.05;
    const mx = mountR * Math.cos(theta);
    const mz = mountR * Math.sin(theta);
    for (const hFrac of [0.32, 0.66]) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.82, 10),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(station.light).multiplyScalar(2.2) })
      );
      tube.position.set(mx, station.y + H * hFrac, mz);
      scene.add(tube);
      // Small bracket so the fixture visibly attaches to the column.
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), pillarMat);
      bracket.position.set((mountR + 0.06) * Math.cos(theta), station.y + H * hFrac, (mountR + 0.06) * Math.sin(theta));
      bracket.rotation.y = -theta;
      scene.add(bracket);
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
    addBox(localGroup, { x: bridgeMidX, y: -0.03, z: 0, w: bridgeEnd - bridgeStart, h: 0.06, d: bw * 2, map: floorTex, repeat: [2, 1], color: tint(station.floor) });
    // Solid concrete parapets on both sides (not an open railing), with a
    // thin dark metal cap bar on top, matching the stair/hall guard walls.
    for (const side of [-1, 1]) {
      addBox(localGroup, { x: bridgeMidX, y: PARAPET_HEIGHT / 2, z: side * bw, w: bridgeEnd - bridgeStart, h: PARAPET_HEIGHT, d: PARAPET_THICKNESS, map: getStructureSurface(), color: 0x9a998f });
      addBox(localGroup, { x: bridgeMidX, y: PARAPET_HEIGHT + 0.03, z: side * bw, w: bridgeEnd - bridgeStart, h: 0.05, d: 0.07, color: 0x1e2023 });
    }
    addGlow(localGroup, { x: bridgeMidX, y: 1.5, z: 0, color: station.light });
  }

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
    addGlow(localGroup, { x, y: H - 0.3, z: 0, color: station.light });
  }

  const roomMidX = (roomStart + roomEnd) / 2;
  const hw = roomHalfW;
  addBox(localGroup, { x: roomMidX, y: -0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, map: floorTex, repeat: [roomDepth / 3, (hw * 2) / 3], color: tint(station.floor) });
  addBox(localGroup, { x: roomMidX, y: H + 0.03, z: 0, w: roomEnd - roomStart, h: 0.06, d: hw * 2, color: tint(station.wall) });
  for (const side of [-1, 1]) {
    addBox(localGroup, { x: roomMidX, y: H / 2, z: side * (hw + 0.12), w: roomEnd - roomStart, h: H, d: 0.24, map: wallTex, repeat: [roomDepth / 3, 1], color: tint(station.wall) });
  }
  addBox(localGroup, { x: roomEnd + 0.12, y: H / 2, z: 0, w: 0.24, h: H, d: hw * 2, map: wallTex, repeat: [1, (hw * 2) / 3], color: tint(station.wall) });

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

  // Controlled surface exit: the sealed airlock door on the side wall, with
  // hazard striping and a warning plate. It never opens - that's the point.
  const airlockX = roomStart + 5.6;
  addBox(group, { x: airlockX, y: 1.35, z: hw - 0.18, w: 2.3, h: 2.7, d: 0.22, color: 0x4a5258 });
  addCylinder(group, { x: airlockX, y: 1.3, z: hw - 0.34, r: 0.95, h: 0.22, radialSegments: 14, rotX: Math.PI / 2, color: 0x5d666c });
  addCylinder(group, { x: airlockX, y: 1.3, z: hw - 0.46, r: 0.22, h: 0.16, radialSegments: 10, rotX: Math.PI / 2, color: 0x2f3439 });
  for (let i = 0; i < 6; i++) {
    addBox(group, { x: airlockX - 1.0 + i * 0.4, y: 2.85, z: hw - 0.3, w: 0.26, h: 0.16, d: 0.06, color: i % 2 ? 0xd8b23a : 0x24262a });
  }
  const airlockTex = makePlaqueTexture(["SAÍDA CONTROLADA", "ACESSO PROIBIDO"], { fg: 0xffd27a, bg: 0x14100c });
  const airlockSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.8), new THREE.MeshBasicMaterial({ map: airlockTex, side: THREE.DoubleSide }));
  airlockSign.position.set(airlockX, 3.05, hw - 0.5);
  airlockSign.rotation.y = Math.PI;
  group.add(airlockSign);

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
  addFixtureLight(group, { x: roomStart + 2, y: H - 0.3, z: 0, color: station.light, intensity: 10 });
  addGlow(group, { x: roomEnd - 2, y: H - 0.3, z: 0, color: station.light });

  // The Vault: the sealed chamber at the back of IT where the head of the
  // department speaks with the voice from Silo 1. Deliberately walled off -
  // you can see the door and the speaker grille, never get in.
  const vaultX = roomEnd - 0.55;
  addBox(group, { x: vaultX, y: H / 2, z: 0, w: 0.6, h: H, d: hw * 2, color: 0x2f353b, roughness: 0.55, metalness: 0.4 });

  const doorW = 1.9;
  addBox(group, { x: vaultX - 0.34, y: 1.25, z: 0, w: 0.14, h: 2.5, d: doorW, color: 0x454f57, roughness: 0.4, metalness: 0.6 });
  // Heavy hinges and a wheel lock.
  for (const dz of [-doorW / 2 + 0.16, doorW / 2 - 0.16]) {
    addBox(group, { x: vaultX - 0.44, y: 1.25, z: dz, w: 0.1, h: 2.3, d: 0.16, color: 0x2b3137, roughness: 0.4, metalness: 0.7 });
  }
  addCylinder(group, { x: vaultX - 0.5, y: 1.25, z: 0, r: 0.38, h: 0.1, radialSegments: 16, rotZ: Math.PI / 2, color: 0x6d757c, roughness: 0.35, metalness: 0.75 });
  addCylinder(group, { x: vaultX - 0.54, y: 1.25, z: 0, r: 0.07, h: 0.12, radialSegments: 10, rotZ: Math.PI / 2, color: 0x2b3137 });

  // Speaker grille above the door - where the Algorithm's voice comes from.
  for (let i = 0; i < 7; i++) {
    addBox(group, { x: vaultX - 0.36, y: 2.72 + i * 0.055, z: 0, w: 0.04, h: 0.03, d: 0.7, color: 0x1d2226 });
  }
  addGlow(group, { x: vaultX - 0.4, y: 2.6, z: 0.52, r: 0.045, color: 0xff4433 });

  const vaultTex = makePlaqueTexture(["O COFRE", "ACESSO RESTRITO"], { fg: 0x9fd4ff, bg: 0x0a1016 });
  const vaultSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: vaultTex, side: THREE.DoubleSide }));
  vaultSign.position.set(vaultX - 0.36, 3.05, 0);
  vaultSign.rotation.y = -Math.PI / 2;
  group.add(vaultSign);
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

// A lived-in apartment: low mid-century furniture, a pendant lamp over the
// table, plants and a mirror, like the residential interiors in the
// reference stills.
function themeResidencial(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const midX = (roomStart + roomEnd) / 2;

  // Wainscot band around the room, the red/orange stripe from the stills.
  for (const side of [-1, 1]) {
    addBox(group, { x: midX, y: 1.15, z: side * (hw - 0.06), w: roomEnd - roomStart - 0.5, h: 0.42, d: 0.06, color: 0xa8502f });
  }
  addBox(group, { x: roomEnd - 0.18, y: 1.15, z: 0, w: 0.06, h: 0.42, d: hw * 1.6, color: 0xa8502f });

  // Seating around a low round table.
  addCylinder(group, { x: midX, y: 0.34, z: 0, r: 0.62, h: 0.08, color: 0x6d6459 });
  addCylinder(group, { x: midX, y: 0.17, z: 0, r: 0.12, h: 0.34, color: 0x5a5249 });
  addBox(group, { x: midX - 1.3, y: 0.3, z: 0.2, w: 0.85, h: 0.6, d: 1.5, color: 0xb5613a });
  addBox(group, { x: midX + 1.35, y: 0.3, z: -0.3, w: 0.85, h: 0.6, d: 1.4, color: 0x8a4a33, rotY: 0.25 });
  addCylinder(group, { x: midX - 0.2, y: 0.2, z: -1.25, r: 0.42, h: 0.4, color: 0x9a8a63 });

  // Sideboard and mirror on one wall.
  addBox(group, { x: roomStart + 2.2, y: 0.45, z: hw - 0.45, w: 1.8, h: 0.9, d: 0.55, color: 0xc2b294 });
  addBox(group, { x: roomStart + 2.2, y: 1.85, z: hw - 0.16, w: 1.3, h: 1.0, d: 0.06, color: 0xd8e2e6 });

  // Doorway through to a bedroom at the back.
  addBox(group, { x: roomEnd - 0.35, y: H * 0.55, z: -hw * 0.45, w: 0.12, h: H * 0.9, d: 1.5, color: 0x6b5b48 });

  // Plants + pendant lamp.
  for (const z of [-hw + 0.7, hw - 0.8]) {
    addCylinder(group, { x: roomStart + 1.1, y: 0.26, z, r: 0.3, h: 0.52, color: 0x7d6a52 });
    for (let i = 0; i < 4; i++) {
      addGlow(group, { x: roomStart + 1.1 + (i % 2) * 0.24 - 0.12, y: 0.85 + i * 0.16, z, r: 0.22, color: 0x3f7a44 });
    }
  }
  addLantern(group, { x: midX, z: 0, y: H - 0.45, color: station.light });
  addFixtureLight(group, { x: midX, y: H - 0.5, z: 0, color: station.light, intensity: 10 });
}

// Infirmary: beds with curtain rails, an apothecary shelf and clean
// overhead strip lighting.
function themeEnfermaria(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;

  for (let i = 0; i < 3; i++) {
    const x = roomStart + 2.0 + i * 3.1;
    if (x > roomEnd - 1.6) break;
    for (const side of [-1, 1]) {
      const z = side * (hw - 1.15);
      addBox(group, { x, y: 0.32, z, w: 1.0, h: 0.16, d: 2.0, color: 0xbfc7c4 }); // mattress
      addBox(group, { x, y: 0.15, z, w: 0.86, h: 0.3, d: 1.85, color: 0x7e8a88 }); // frame
      addBox(group, { x: x - 0.36, y: 0.47, z, w: 0.3, h: 0.12, d: 0.6, color: 0xe8efec }); // pillow
      // Curtain rail above each bed.
      addBox(group, { x, y: H - 0.35, z, w: 0.05, h: 0.05, d: 2.1, color: 0x8d9694 });
      addBox(group, { x: x + 0.5, y: H * 0.55, z, w: 0.05, h: H * 0.62, d: 1.9, color: 0xa9bdb7 });
      addGlow(group, { x: x - 0.55, y: 0.8, z, r: 0.05, color: station.accent });
    }
  }

  // Apothecary shelving on the far wall, with bottles.
  addBox(group, { x: roomEnd - 0.6, y: 1.05, z: 0, w: 0.5, h: 2.1, d: hw * 1.5, color: 0x8e9a96 });
  for (let i = 0; i < 12; i++) {
    const z = -hw * 0.7 + (i % 6) * (hw * 0.28);
    addCylinder(group, { x: roomEnd - 0.6, y: 0.75 + Math.floor(i / 6) * 0.62, z, r: 0.07, h: 0.22, color: i % 2 ? 0xb9cfc6 : 0xd8c79a });
  }

  // Clean strip lights down the ceiling.
  for (let x = roomStart + 1.4; x < roomEnd - 0.8; x += 2.0) {
    addBox(group, { x, y: H - 0.08, z: 0, w: 1.5, h: 0.07, d: 0.3, color: station.accent, emissive: station.accent, emissiveIntensity: 1.2 });
  }
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.4, z: 0, color: station.light, intensity: 11 });
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


// The Digger Void: the cavern under the silo where the machine that bored
// the shaft was abandoned, facing the rock, and sealed under a thick slab.
// Rougher and dirtier than anything above - this is unfinished rock, not
// poured architecture.
function themeEscavador(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  const cx = roomStart + (roomEnd - roomStart) * 0.55;

  // The machine: a huge boring head facing the far wall, on a body of
  // stacked drums, with hydraulic rams running back from it.
  addCylinder(group, { x: cx + 3.2, y: H * 0.5, z: 0, r: 2.6, r2: 2.2, h: 1.1, radialSegments: 20, rotZ: Math.PI / 2, color: 0x6b6259, roughness: 0.62, metalness: 0.42 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    // Cutter teeth around the boring head.
    addBox(group, {
      x: cx + 3.85,
      y: H * 0.5 + Math.cos(a) * 2.1,
      z: Math.sin(a) * 2.1,
      w: 0.42, h: 0.34, d: 0.34,
      color: 0x8a8378, roughness: 0.4, metalness: 0.65, rotY: a,
    });
  }
  addCylinder(group, { x: cx + 0.6, y: H * 0.5, z: 0, r: 2.0, h: 4.0, radialSegments: 18, rotZ: Math.PI / 2, color: 0x4d453d, roughness: 0.7, metalness: 0.35 });
  addCylinder(group, { x: cx - 2.4, y: H * 0.45, z: 0, r: 1.6, h: 2.4, radialSegments: 16, rotZ: Math.PI / 2, color: 0x413a33, roughness: 0.75, metalness: 0.3 });

  // Hydraulic rams bracing it against the rock.
  for (const dz of [-1.5, 1.5]) {
    addCylinder(group, { x: cx - 1.0, y: 0.75, z: dz, r: 0.25, h: 5.2, radialSegments: 10, rotZ: Math.PI / 2, color: 0x8d9299, roughness: 0.3, metalness: 0.8 });
  }

  // Spoil heaps and abandoned tools.
  for (let i = 0; i < 7; i++) {
    const x = roomStart + 1.2 + i * 1.6;
    const z = (i % 2 ? 1 : -1) * (hw - 1.1 - (i % 3) * 0.5);
    addCylinder(group, { x, y: 0.32, z, r: 0.95 + (i % 3) * 0.22, r2: 0.1, h: 0.68, radialSegments: 9, color: 0x33291f, roughness: 1.0, metalness: 0.0 });
  }

  // The breached slab: broken concrete teeth around a tunnel mouth in the
  // far wall, with darkness beyond.
  addBox(group, { x: roomEnd - 0.22, y: H * 0.5, z: 0, w: 0.3, h: H, d: hw * 2, color: 0x191512, roughness: 1.0 });
  for (let i = 0; i < 9; i++) {
    const z = -2.6 + i * 0.65;
    const h = 0.5 + ((i * 7) % 5) * 0.22;
    addBox(group, { x: roomEnd - 0.5, y: h / 2, z, w: 0.55, h, d: 0.6, color: 0x5d5349, rotY: i * 0.3 });
    addBox(group, { x: roomEnd - 0.5, y: H - h / 2, z, w: 0.55, h, d: 0.6, color: 0x5d5349, rotY: i * 0.4 });
  }

  // Work lamps strung up by whoever was digging here in secret.
  for (let i = 0; i < 3; i++) {
    addLantern(group, { x: roomStart + 3 + i * 4, z: (i - 1) * 2.2, y: H - 0.5, color: station.light });
  }
  addFixtureLight(group, { x: cx - 1, y: H - 0.5, z: 0, color: station.light, intensity: 14 });
  addFixtureLight(group, { x: roomEnd - 3, y: 1.2, z: 0, color: 0xff7a33, intensity: 8, distance: 10 });
}

const THEME_BUILDERS = {
  topo: themeTopo,
  ti: themeTi,
  judicial: themeJudicial,
  ninho: themeNinho,
  residencial: themeResidencial,
  creche: themeCreche,
  enfermaria: themeEnfermaria,
  bazar: themeBazar,
  rocas: themeRocas,
  agua: themeAgua,
  mecanica: themeMecanica,
  gerador: themeGerador,
  escavador: themeEscavador,
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

export function buildWorld(scene, layout) {
  buildOuterShell(scene, layout);
  buildCentralPole(scene, layout);
  buildFillerLevels(scene, layout);
  buildServiceRisers(scene, layout);
  buildVoidBeams(scene, layout);

  for (const slope of layout.slopes) {
    buildTransit(scene, layout, slope);
  }

  const interactables = [];
  layout.stations.forEach((station, i) => {
    buildStation(scene, station, { isFirst: i === 0, isLast: i === layout.stations.length - 1 }, interactables);
  });

  return { interactables };
}
