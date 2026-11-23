import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { WORLD, RISERS, DOME, GALLERY_COLUMNS } from "../config.js";

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

  for (const angle of angles) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, h, 12), pipeMat);
    pipe.position.set(riserR * Math.cos(angle), midY, riserR * Math.sin(angle));
    scene.add(pipe);
  }

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

// Radial beams crossing the void between the hub and the ring at decorative
// levels, echoing the bridge lattice seen looking down the shaft.
export function buildOuterShell(scene, layout) {
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


// The gallery columns (config.js GALLERY_COLUMNS), each one piece from the
// bottom of the silo to the top level's ceiling, where the dome's drum stands
// on them. Twelve meshes for the whole silo: a per-level column would be 1,776
// objects, and a stack of short ones never reads as one column anyway.
export function buildGalleryColumns(scene, layout) {
  const top = layout.stations[0].y + WORLD.roomHeight;
  const bottom = layout.stations[layout.stations.length - 1].y - 0.6;
  const surface = resolveSurface(getStructureSurface(), [3, (top - bottom) / 3.5]);
  const mat = new THREE.MeshStandardMaterial({ map: surface.map, normalMap: surface.normalMap, color: STRUCTURE_COLORS.pillar, roughness: 0.86, metalness: 0.04 });
  const geometry = new THREE.CylinderGeometry(GALLERY_COLUMNS.radius, GALLERY_COLUMNS.radius, top - bottom, 28, 1, true);
  for (const a of GALLERY_COLUMNS.angles) {
    const column = new THREE.Mesh(geometry, mat);
    column.position.set(GALLERY_COLUMNS.r * Math.cos(a), (top + bottom) / 2, GALLERY_COLUMNS.r * Math.sin(a));
    column.name = "gallery-column";
    scene.add(column);
  }
}

export function buildCentralPole(scene, layout) {
  // The stair's core, from the bottom of the silo to the top level's ceiling;
  // above that it carries on into the dome (dome.js) to the great lamp. It was
  // a 0.45m pole standing in an empty 1.7m void; in every reference the stair
  // winds round a solid column, with conduits running up its face.
  const top = layout.stations[0].y + WORLD.roomHeight + 0.01;
  const bottom = layout.stations[layout.stations.length - 1].y - 3;
  // Texture repeated every few metres up the shaft, not stretched over it.
  const surface = resolveSurface(getStructureSurface(), [5, (top - bottom) / 4]);
  const mat = new THREE.MeshStandardMaterial({ map: surface.map, normalMap: surface.normalMap, color: 0x8d949c, roughness: 0.8, metalness: 0.05 });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(DOME.column, DOME.column, top - bottom, 32), mat);
  column.position.set(0, (top + bottom) / 2, 0);
  scene.add(column);
  const pipes = [];
  for (const a of [0.2, 0.32, 0.44, 3.3]) {
    const pipe = new THREE.CylinderGeometry(0.06, 0.06, top - bottom, 8);
    pipe.translate((DOME.column + 0.08) * Math.cos(a), (top + bottom) / 2, (DOME.column + 0.08) * Math.sin(a));
    pipes.push(pipe);
  }
  scene.add(new THREE.Mesh(mergeGeometries(pipes), new THREE.MeshStandardMaterial({ color: 0x4a5056, roughness: 0.5, metalness: 0.3 })));
}

// ---------------------------------------------------------------------------
// Helix curve shared by stair railings and each landing's own guard rail
// (which is just a helix with yStart === yEnd, i.e. a flat circular arc).
// ---------------------------------------------------------------------------
