import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD, RISERS, DOME, GALLERY_COLUMNS, LEVEL_HEIGHT } from "../config.js";

import { getStructureSurface, getWallSurface, resolveSurface, STRUCTURE_COLORS } from "./materials.js";
import { addInstancedBatch, buildBandGeometry } from "./primitives.js";






// Full-height service risers running up the shaft, broken so they pass
// through (rather than across) each station's bridges. The fat pipes with
// light strips are one of the most recognisable things in the wide shots.
// The service risers are the only full-height structure standing in the open
// void, so they double as the anchor the void braces reach for - both live off
// these constants.
const RISER_R = RISERS.r;
const RISER_ANGLES = RISERS.angles;

export function buildServiceRisers(scene, layout) {
  const stations = layout.stations;
  const riserR = RISER_R;
  const angles = RISER_ANGLES;
  const pipeMat = new THREE.MeshStandardMaterial({ color: STRUCTURE_COLORS.riser, roughness: 0.92, metalness: 0.08, side: THREE.DoubleSide });
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfe4ff).multiplyScalar(1.9) });

  // One unbroken pipe per angle, top of the silo to the bottom. These stand
  // inside the open void (see RISERS in config.js) - there is no slab at that radius at
  // ANY height to hide a joint behind, so the previous one-segment-per-station-
  // gap version left every pipe visibly dead-ending in mid-air 1.2m under each
  // floor. A riser that simply runs the whole way has nothing to explain.
  // Up to the dome's catwalk, which they carry (dome.js).
  const top = stations[0].y + WORLD.roomHeight + DOME.drum;
  const bottom = stations[stations.length - 1].y - 1;
  const h = top - bottom;
  const midY = (top + bottom) / 2;

  // The pipes themselves are sliced with the rest of the silo-height
  // structure (buildVerticalStructure, below).
  void h; void midY;

  // The fixtures on them - a caged opal lamp at every floor (continuous blue
  // neon strips made the silo look like a spaceship) and flange collars at
  // every floor and ceiling, so each pipe reads as jointed sections. They come
  // in blocks of a dozen levels, every riser in one batch per block, and each
  // block is a chunk that hides with the floors around it (index.js). One
  // batch for the whole silo height was drawn in full from anywhere - about
  // 300k triangles for fixtures a kilometre away.
  const BLOCK = 12;
  const lampGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.7, 16);
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffdfad).multiplyScalar(1.7) });
  const bandGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.09, 16);
  const barGeo = new THREE.BoxGeometry(0.035, 0.72, 0.035);
  const collarGeo = new THREE.CylinderGeometry(0.78, 0.78, 0.36, 12);
  const blocks = [];
  for (let first = 0; first < stations.length; first += BLOCK) {
    const slice = stations.slice(first, first + BLOCK);
    const group = new THREE.Group();
    scene.add(group);
    const lamps = [], bands = [], bars = [], collars = [];
    for (const angle of angles) {
      const x = riserR * Math.cos(angle), z = riserR * Math.sin(angle);
      for (const st of slice) {
        const lamp = { x, y: st.y + 2.5, z };
        lamps.push(lamp);
        for (const dy of [-0.36, 0.36]) bands.push({ ...lamp, y: lamp.y + dy });
        for (let i = 0; i < 8; i++) bars.push({ x: x + 0.67 * Math.cos(i * Math.PI / 4), y: lamp.y, z: z + 0.67 * Math.sin(i * Math.PI / 4) });
        collars.push({ x, y: st.y, z }, { x, y: st.y + WORLD.roomHeight, z });
        const light = new THREE.PointLight(0xffdfb2, 35, 19, 2);
        light.position.set(x - Math.cos(angle), lamp.y, z - Math.sin(angle));
        group.add(light);
      }
    }
    addInstancedBatch(group, lampGeo, lampMat, lamps);
    addInstancedBatch(group, bandGeo, pipeMat, bands);
    addInstancedBatch(group, barGeo, pipeMat, bars);
    addInstancedBatch(group, collarGeo, pipeMat, collars);
    const top = slice[0].y + WORLD.roomHeight, bottom = slice[slice.length - 1].y;
    blocks.push({ group, y: (top + bottom) / 2, half: (top - bottom) / 2 });
  }
  return blocks;
}

// Coffered ceiling: radial ribs plus a couple of concentric ring beams under
// the outer slab. Without these the ceiling over the ring is one enormous
// blank plane that fills the top half of the screen.
export function buildCeilingBeams(group, { y, innerR, outerR, material }) {
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

// --- Everything that runs the height of the silo ---------------------------
// The outer shell and its ribs, the stair's core and its conduits, the twelve
// gallery columns and the six service risers. Each used to be one mesh 1.2km
// tall, one triangle from top to bottom: far beyond the camera's 160m reach
// at both ends, and clipped every frame. Triangles that size lose depth
// precision, and their edges showed through stairs and slabs as dotted lines
// of light - the "gaps" seen everywhere in a headset. They also could never
// be culled. Now they are built in slices of six levels, subdivided at every
// level, and each slice is a chunk that hides with the floors around it.
//
// Texture coordinates run in metres of height, so the slices join without a
// seam in the concrete.
const SLICE_LEVELS = 6;
function cylinderSlice(radius, y0, y1, radial, tile, { open = false } = {}) {
  const h = y1 - y0;
  const g = new THREE.CylinderGeometry(radius, radius, h, radial, Math.max(1, Math.ceil(h / LEVEL_HEIGHT)), open);
  g.translate(0, (y0 + y1) / 2, 0);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / tile);
  return g;
}
function boxSlice(w, d, y0, y1, tile) {
  const h = y1 - y0;
  const g = new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.ceil(h / LEVEL_HEIGHT)), 1);
  g.translate(0, (y0 + y1) / 2, 0);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / tile);
  return g;
}
const at = (g, x, z) => { g.translate(x, 0, z); return g; };

export function buildVerticalStructure(layout) {
  const stations = layout.stations;
  const first = stations[0], last = stations[stations.length - 1];
  const span = {
    shell: [first.y + 14, last.y - 14],
    core: [first.y + WORLD.roomHeight + 0.01, last.y - 3],
    columns: [first.y + WORLD.roomHeight, last.y - 0.6],
    risers: [first.y + WORLD.roomHeight + DOME.drum, last.y - 1],
  };
  const R = WORLD.shellR;
  const shellSurface = resolveSurface(getWallSurface(1), [46, 1]);
  const mats = {
    shell: new THREE.MeshStandardMaterial({ map: shellSurface.map, normalMap: shellSurface.normalMap, color: 0x7e868c, roughness: 0.96, metalness: 0.02, side: THREE.BackSide }),
    ribs: new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.95, metalness: 0.03, side: THREE.DoubleSide }),
    core: (() => { const s = resolveSurface(getStructureSurface(), [5, 1]); return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, color: 0x8d949c, roughness: 0.8, metalness: 0.05 }); })(),
    conduits: new THREE.MeshStandardMaterial({ color: 0x4a5056, roughness: 0.5, metalness: 0.3 }),
    columns: (() => { const s = resolveSurface(getStructureSurface(), [3, 1]); return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, color: STRUCTURE_COLORS.pillar, roughness: 0.86, metalness: 0.04 }); })(),
    risers: new THREE.MeshStandardMaterial({ color: STRUCTURE_COLORS.riser, roughness: 0.92, metalness: 0.08, side: THREE.DoubleSide }),
  };
  const chunks = [];
  for (let k = 0; k < stations.length; k += SLICE_LEVELS) {
    // Slice edges sit just under a level's floor slab, where nothing shows.
    const top = k === 0 ? Infinity : stations[k].y - 0.6;
    const bottom = k + SLICE_LEVELS < stations.length ? stations[k + SLICE_LEVELS].y - 0.6 : -Infinity;
    const clip = ([a, b]) => [Math.min(a, top), Math.max(b, bottom)];
    const group = new THREE.Group();
    // world-check.cjs tells the silo's own shell from the level's insides by this name.
    group.name = "structure";
    const add = (geometries, material, name) => {
      const mesh = new THREE.Mesh(geometries.length > 1 ? mergeGeometries(geometries) : geometries[0], material);
      mesh.name = name;
      group.add(mesh);
    };
    const [s0, s1] = clip(span.shell);
    add([cylinderSlice(R, s1, s0, 72, 9, { open: true })], mats.shell, "shell");
    add(Array.from({ length: 36 }, (_, i) => {
      const a = (i / 36) * Math.PI * 2;
      const g = boxSlice(0.9, 1.8, s1, s0, 9);
      g.rotateY(-a);
      return at(g, (R - 0.45) * Math.cos(a), (R - 0.45) * Math.sin(a));
    }), mats.ribs, "shell-ribs");
    const [c0, c1] = clip(span.core);
    add([cylinderSlice(DOME.column, c1, c0, 32, 4)], mats.core, "core");
    add([0.2, 0.32, 0.44, 3.3].map((a) => at(cylinderSlice(0.06, c1, c0, 8, 4), (DOME.column + 0.08) * Math.cos(a), (DOME.column + 0.08) * Math.sin(a))), mats.conduits, "core-conduits");
    const [g0, g1] = clip(span.columns);
    add(GALLERY_COLUMNS.angles.map((a) => at(cylinderSlice(GALLERY_COLUMNS.radius, g1, g0, 28, 3.5, { open: true }), GALLERY_COLUMNS.r * Math.cos(a), GALLERY_COLUMNS.r * Math.sin(a))), mats.columns, "gallery-columns");
    const [r0, r1] = clip(span.risers);
    add(RISERS.angles.map((a) => at(cylinderSlice(0.62, r1, r0, 12, 4), RISERS.r * Math.cos(a), RISERS.r * Math.sin(a))), mats.risers, "riser-pipes");
    const y0 = Math.min(s0, r0), y1 = Math.max(s1, g1);
    chunks.push({ group, y: (y0 + y1) / 2, half: (y0 - y1) / 2, range: 160 });
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Helix curve shared by stair railings and each landing's own guard rail
// (which is just a helix with yStart === yEnd, i.e. a flat circular arc).
// ---------------------------------------------------------------------------
