import * as THREE from 'three';
import { makeSignTexture } from '../textures.js';
import { wrapToPi } from '../mathutils.js';

// The silo's printed matter, transcribed from the production's own sign sheet
// (new-references 085-087). The wording is theirs; keeping it verbatim is the
// point, since these are the signs a player actually reads.
//
// Every notice carries the issuing office and a notice number in a small
// letterspaced footer - that footer is most of what makes them read as official
// rather than as generic warning labels.
export const SAFETY_NOTICES = [
  { id: 'rail', kind: 'red', headline: 'DANGER', lines: ['DO NOT REACH', 'LEAN OR CLIMB', 'OVER THE RAIL'], footer: 'OFFICE OF PUBLIC SAFETY NOTICE 1', ratio: 0.78 },
  { id: 'stay-right', kind: 'dark', headline: 'STAY RIGHT', footer: 'OFFICE OF PUBLIC SAFETY NOTICE 2', spacing: 0.1, ratio: 0.3 },
  { id: 'loitering', kind: 'light', headline: 'NO STOPPING OR', lines: ['LOITERING ON', 'THE LANDINGS', 'MOVE TO A DESIGNATED REST AREA'], footer: 'OFFICE OF PUBLIC SAFETY NOTICE 3', ratio: 0.74 },
  { id: 'running', kind: 'dark', headline: 'NO RUNNING', footer: 'OFFICE OF PUBLIC SAFETY NOTICE 4', ratio: 0.42 },
];

// Shared material per texture: the same notice repeats down the whole silo, and
// a material per instance would defeat the texture cache behind it.
const materials = new Map();
function signMaterial(spec) {
  if (!materials.has(spec.id)) {
    materials.set(spec.id, new THREE.MeshBasicMaterial({
      map: makeSignTexture(spec),
      side: THREE.DoubleSide,
      toneMapped: false,
    }));
  }
  return materials.get(spec.id);
}

// Which way a plate must face to be read from inside the ring. A plane's front
// is its +Z; rotating by t sends that to (sin t, cos t), and a reader standing
// nearer the shaft needs it pointing back at them, i.e. (-cos a, -sin a). The
// obvious `PI/2 - a` is exactly 180 degrees out and renders every sign mirrored.
export function inwardFacing(a) {
  return -Math.PI / 2 - a;
}

function place(batch, dummy, radius, a, y) {
  dummy.position.set((radius - 0.08) * Math.cos(a), y, (radius - 0.08) * Math.sin(a));
  dummy.rotation.set(0, inwardFacing(a), 0);
  dummy.scale.setScalar(1);
  dummy.updateMatrix();
  batch.matrices.push(dummy.matrix.clone());
}

// Places one sign as a plate on a wall. `width` is in metres; the height comes
// from the plate's own proportions so a notice never ends up stretched.
export function placeSign(group, spec, { x, y, z, rotY = 0, width = 1.1 }) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (spec.ratio || 0.6)), signMaterial(spec));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  mesh.raycast = () => {};
  group.add(mesh);
  return mesh;
}

export function notice(id) {
  return SAFETY_NOTICES.find((n) => n.id === id) || SAFETY_NOTICES[0];
}

// Wayfinding: level identity and where the stair goes next. Distinct plate
// treatment from the safety notices so the two never read as the same object.
export function levelSign(level, name) {
  return { id: `level-${level}`, kind: 'teal', headline: String(level), lines: [name], footer: `SILO 18 · LEVEL ${level}`, ratio: 0.62 };
}

export function wayfindingSign(id, headline, lines, footer = 'SILO 18') {
  return { id, kind: 'teal', headline, lines, footer, ratio: 0.5 };
}

export function shopSign(id, headline, lines = []) {
  return { id: `shop-${id}`, kind: 'light', headline, lines, footer: 'LEVEL 28 · TRADE REGISTER', ratio: 0.42 };
}

// Distributes the safety notices around every level's ring, plus one at each
// landing where the stair arrives - which is what notices 1 and 3 are literally
// about. One InstancedMesh per notice covers all 148 levels, so the whole
// silo's signage costs four draw calls rather than six hundred meshes.
export function buildSafetySigns(scene, layout, { radius, doorways }) {
  const bearings = [0.55, 2.35, 3.9, 5.3];
  const dummy = new THREE.Object3D();
  const batches = SAFETY_NOTICES.map((spec) => ({ spec, matrices: [] }));

  // A sign only exists if there is wall behind it. The ring wall is broken by a
  // doorway at each of a level's wings, and a plate dropped into one of those
  // openings hangs in mid-air.
  const onWall = (station, a) => !doorways(station).some((w) => Math.abs(wrapToPi(a - w)) < 0.22);

  layout.stations.forEach((station, index) => {
    // Notice 1 (the rail warning) belongs at the landing, facing whoever steps
    // off the stair; the rest are spaced around the ring. Bearings are relative
    // to this level's own landing, which no longer sits at a fixed compass
    // point, so the notices follow the stair round as it descends.
    const railBearing = station.theta + 0.42;
    if (onWall(station, railBearing)) {
      place(batches[0], dummy, radius, railBearing, station.y + 1.75);
    }

    for (let i = 0; i < bearings.length; i++) {
      // Rotate which notice appears where, level by level, so a player walking
      // down does not pass the same plate at the same bearing every floor.
      const batch = batches[1 + ((i + index) % (batches.length - 1))];
      const a = station.theta + bearings[i];
      if (!onWall(station, a)) continue;
      place(batch, dummy, radius, a, station.y + (i % 2 ? 1.9 : 1.7));
    }
  });

  for (const { spec, matrices } of batches) {
    if (matrices.length === 0) continue;
    const width = spec.id === 'stay-right' || spec.id === 'running' ? 1.25 : 0.95;
    const geo = new THREE.PlaneGeometry(width, width * spec.ratio);
    const mesh = new THREE.InstancedMesh(geo, signMaterial(spec), matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.name = `signs-${spec.id}`;
    mesh.raycast = () => {};
    scene.add(mesh);
  }
}
