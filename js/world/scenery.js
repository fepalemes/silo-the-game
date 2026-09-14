import * as THREE from "three";
import { WORLD } from "../config.js";

import { getStructureSurface, getWallSurface, resolveSurface } from "./materials.js";
import { addInstancedBatch, buildBandGeometry } from "./primitives.js";






// Full-height service risers running up the shaft, broken so they pass
// through (rather than across) each station's bridges. The fat pipes with
// light strips are one of the most recognisable things in the wide shots.
// The service risers are the only full-height structure standing in the open
// void, so they double as the anchor the void braces reach for - both live off
// these constants.
const RISER_R = WORLD.ringInnerR - 0.85;
const RISER_ANGLES = [0.6, 2.1, 3.6, 5.1];

export function buildServiceRisers(scene, layout) {
  const stations = layout.stations;
  const riserR = RISER_R;
  const angles = RISER_ANGLES;
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0x777466, roughness: 0.92, metalness: 0.08, side: THREE.DoubleSide });
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfe4ff).multiplyScalar(1.9) });

  // One unbroken pipe per angle, top of the silo to the bottom. These stand at
  // r = 8.6, which is inside the open void - there is no slab at that radius at
  // ANY height to hide a joint behind, so the previous one-segment-per-station-
  // gap version left every pipe visibly dead-ending in mid-air 1.2m under each
  // floor. A riser that simply runs the whole way has nothing to explain.
  const top = stations[0].y + WORLD.roomHeight;
  const bottom = stations[stations.length - 1].y - 1;
  const h = top - bottom;
  const midY = (top + bottom) / 2;

  for (const angle of angles) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, h, 12), pipeMat);
    pipe.position.set(riserR * Math.cos(angle), midY, riserR * Math.sin(angle));
    scene.add(pipe);

    // Short caged opal fixtures at each floor, as in the shaft stills.
    // Continuous blue neon strips made the silo look like a spaceship.
    const lamps = stations.map((st) => ({ x: riserR * Math.cos(angle), y: st.y + 2.5, z: riserR * Math.sin(angle) }));
    addInstancedBatch(scene, new THREE.CylinderGeometry(0.66, 0.66, 0.7, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffdfad).multiplyScalar(1.7) }), lamps);
    const bands = lamps.flatMap((p) => [-0.36, 0.36].map((dy) => ({ ...p, y: p.y + dy })));
    addInstancedBatch(scene, new THREE.CylinderGeometry(0.72, 0.72, 0.09, 16), pipeMat, bands);
    const bars = lamps.flatMap((p) => Array.from({ length: 8 }, (_, i) => ({ x: p.x + 0.67 * Math.cos(i * Math.PI / 4), y: p.y, z: p.z + 0.67 * Math.sin(i * Math.PI / 4) })));
    addInstancedBatch(scene, new THREE.BoxGeometry(0.035, 0.72, 0.035), pipeMat, bars);
    for (const p of lamps) {
      const light = new THREE.PointLight(0xffdfb2, 35, 19, 2);
      light.position.set(p.x - Math.cos(angle), p.y, p.z - Math.sin(angle));
      scene.add(light);
    }

    // Flange collars at every floor level, so the pipe reads as jointed
    // sections rather than one extruded tube.
    const collars = [];
    for (const st of stations) {
      collars.push({ x: riserR * Math.cos(angle), y: st.y, z: riserR * Math.sin(angle) });
      collars.push({ x: riserR * Math.cos(angle), y: st.y + WORLD.roomHeight, z: riserR * Math.sin(angle) });
    }
    addInstancedBatch(scene, new THREE.CylinderGeometry(0.78, 0.78, 0.36, 12), pipeMat, collars);
  }
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


export function buildCentralPole(scene, layout) {
  // Has to pierce the top station's ceiling and the bottom station's floor,
  // not merely get close: ending it "3m above the top floor" left it 0.4m
  // shy of a 3.4m ceiling, so from the top hall the pole visibly stopped in
  // mid-air just below the roof.
  const top = layout.stations[0].y + WORLD.roomHeight + 1;
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
