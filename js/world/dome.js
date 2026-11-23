// The dome over the top of the shaft - the silo's main light, built to the
// production's model (new-references 040-048):
//
//   - a drum standing on the top level's ring, with a railed catwalk round
//     its rim, and a hemispherical shell above it
//   - tiers of pill-shaped light troughs between meridian ribs, with
//     maintenance ladders climbing four of the ribs
//   - the central column rising out of the stair's core to a flared capital,
//     carrying the great lamp: a bowl whose underside is a grid of glowing
//     panels (the "mirrored fins" of the production notes)
//
// Positions are relative to the top level's floor. One group, shown and
// hidden with the floors around it (index.js).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { DOME, WORLD } from "../config.js";
import { getStructureSurface, resolveSurface } from "./materials.js";
import { addInstancedBatch, buildAnnularSectorGeometry, buildBandGeometry } from "./primitives.js";

const TAU = Math.PI * 2;

function roundedRect(w, h, r, segments = 5) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return new THREE.ShapeGeometry(s, segments);
}

// Strips everything but position/normal/uv and de-indexes, so pieces from
// different generators can be merged into one draw.
const plain = (g) => {
  for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
  return g.index ? g.toNonIndexed() : g;
};

export function buildDome(scene, layout) {
  const top = layout.stations[0];
  const group = new THREE.Group();
  group.name = "dome";
  group.position.y = top.y;
  scene.add(group);

  const H = WORLD.roomHeight;
  const R = DOME.radius;
  const base = H + DOME.drum;
  const concrete = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0x7f878d, roughness: 0.92, side: THREE.DoubleSide });
  const ribConcrete = new THREE.MeshStandardMaterial({ ...getStructureSurface(), color: 0x9aa1a6, roughness: 0.88 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a4045, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide });
  // Warm, and bright enough to bloom: this is the silo's sky.
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2a6).multiplyScalar(1.35), side: THREE.DoubleSide });

  // --- Drum and shell ------------------------------------------------------------
  group.add(new THREE.Mesh(buildBandGeometry(R, 0, TAU, base, H - 0.02, 128, false), concrete));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 32, 0, TAU, 0, Math.PI / 2), concrete);
  shell.position.y = base;
  group.add(shell);

  // Meridian ribs and the rings between the tiers of troughs.
  const ribs = [];
  const RIBS = 16;
  for (let k = 0; k < RIBS; k++) {
    const rib = new THREE.TorusGeometry(R - 0.22, 0.24, 6, 48, Math.PI / 2 - 0.02);
    rib.rotateY(-(k + 0.5) * (TAU / RIBS));
    ribs.push(rib);
  }
  const TIERS = [
    // elevation band (degrees), troughs per ring, trough size
    { from: 4, to: 20, count: 48, w: 2.6, h: 0.9 },
    { from: 23, to: 38, count: 40, w: 2.4, h: 0.85 },
    { from: 41, to: 55, count: 32, w: 2.1, h: 0.8 },
    { from: 58, to: 68, count: 16, w: 1.9, h: 0.75 },
  ];
  for (const deg of [0, 21.5, 39.5, 56.5, 70]) {
    const e = (deg * Math.PI) / 180;
    const ring = new THREE.TorusGeometry((R - 0.2) * Math.cos(e), 0.2, 6, 96);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, (R - 0.2) * Math.sin(e), 0);
    ribs.push(ring);
  }
  const ribMesh = new THREE.Mesh(mergeGeometries(ribs.map(plain)), ribConcrete);
  ribMesh.position.y = base;
  group.add(ribMesh);

  // --- Light troughs ----------------------------------------------------------------
  // A dark bezel with the glowing lens just in front, long side up the meridian.
  const bezelGeo = roundedRect(1, 0.48, 0.23);
  const lensGeo = roundedRect(0.86, 0.34, 0.16);
  lensGeo.translate(0, 0, 0.02);
  const placements = [];
  const x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3(), p = new THREE.Vector3();
  for (const tier of TIERS) {
    const e = (((tier.from + tier.to) / 2) * Math.PI) / 180;
    for (let k = 0; k < tier.count; k++) {
      const a = (k + 0.5) * (TAU / tier.count) + (tier.count % 32 ? 0.04 : 0);
      // Leave the four laddered ribs clear.
      if ([0, 4, 8, 12].some((rib) => Math.abs(Math.atan2(Math.sin(a - (rib + 0.5) * (TAU / RIBS)), Math.cos(a - (rib + 0.5) * (TAU / RIBS)))) < 0.09)) continue;
      const r = R - 0.12;
      p.set(r * Math.cos(e) * Math.cos(a), base + r * Math.sin(e), r * Math.cos(e) * Math.sin(a));
      x.set(-Math.sin(e) * Math.cos(a), Math.cos(e), -Math.sin(e) * Math.sin(a)); // up the meridian
      y.set(Math.sin(a), 0, -Math.cos(a)); // along the parallel
      z.crossVectors(x, y); // towards the centre
      const m = new THREE.Matrix4().makeBasis(x, y, z).scale(new THREE.Vector3(tier.w, tier.w, 1)).setPosition(p);
      placements.push(m);
    }
  }
  for (const [geometry, material] of [[bezelGeo, steel], [lensGeo, lamp]]) {
    const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
    placements.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.raycast = () => {};
    group.add(mesh);
  }

  // --- Ladders up four of the ribs ------------------------------------------------------
  const rungs = [];
  const rails = [];
  for (const k of [0, 4, 8, 12]) {
    const a = (k + 0.5) * (TAU / RIBS), r = R - 0.55;
    for (const side of [-0.28, 0.28]) {
      const rail = new THREE.TorusGeometry(r, 0.03, 4, 40, 1.15);
      rail.translate(0, 0, side);
      rail.rotateY(-a);
      rails.push(rail);
    }
    for (let e = 0.02; e < 1.15; e += 0.32 / r) {
      rungs.push({ x: r * Math.cos(e) * Math.cos(a), y: base + r * Math.sin(e), z: r * Math.cos(e) * Math.sin(a), rotY: -a });
    }
  }
  const railMesh = new THREE.Mesh(mergeGeometries(rails.map(plain)), steel);
  railMesh.position.y = base;
  group.add(railMesh);
  addInstancedBatch(group, new THREE.BoxGeometry(0.04, 0.04, 0.56), steel, rungs);

  // --- Catwalk round the rim of the drum ----------------------------------------------------
  const walkIn = R - 1.4;
  const deck = new THREE.Mesh(buildAnnularSectorGeometry(walkIn, R, 0, TAU, 128), steel);
  deck.position.y = base;
  group.add(deck);
  group.add(new THREE.Mesh(buildBandGeometry(walkIn, 0, TAU, base, base - 0.25, 128, false), steel));
  const posts = [];
  for (let a = 0; a < TAU - 1e-6; a += 0.09) posts.push({ x: (walkIn + 0.05) * Math.cos(a), y: base + 0.55, z: (walkIn + 0.05) * Math.sin(a) });
  addInstancedBatch(group, new THREE.BoxGeometry(0.05, 1.1, 0.05), steel, posts);
  const railings = [0.55, 1.08].map((h) => {
    const rail = new THREE.TorusGeometry(walkIn + 0.05, 0.03, 4, 160);
    rail.rotateX(Math.PI / 2);
    rail.translate(0, base + h, 0);
    return rail;
  });
  group.add(new THREE.Mesh(mergeGeometries(railings.map(plain)), steel));

  // --- The column, its capital and the great lamp ----------------------------------------------
  // Wide and shallow, like an upturned lampshade on the model - a full
  // hemisphere read from below as a globe.
  const bowlR = DOME.bowlRadius, rimY = DOME.bowlRim, depth = DOME.bowlDepth, bottom = rimY - bowlR * depth;
  const capitalH = 1.4;
  const columnH = bottom - capitalH - H + 0.02;
  // Texture repeated every few metres up the shaft, not stretched over it.
  const columnSurface = resolveSurface(getStructureSurface(), [5, columnH / 4]);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(DOME.column, DOME.column, columnH, 32), new THREE.MeshStandardMaterial({ map: columnSurface.map, normalMap: columnSurface.normalMap, color: 0x8d949c, roughness: 0.8, metalness: 0.05 }));
  column.position.y = (H + bottom - capitalH) / 2;
  group.add(column);
  const capital = new THREE.Mesh(new THREE.CylinderGeometry(2.6, DOME.column, capitalH, 32), ribConcrete);
  capital.position.y = bottom - capitalH / 2;
  group.add(capital);
  const abacus = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.3, 32), ribConcrete);
  abacus.position.y = bottom + 0.05;
  group.add(abacus);

  const lampHead = new THREE.Group();
  lampHead.position.y = rimY;
  lampHead.scale.y = depth;
  group.add(lampHead);
  lampHead.add(new THREE.Mesh(new THREE.SphereGeometry(bowlR, 64, 16, 0, TAU, Math.PI / 2, Math.PI / 2), lamp));
  // The grid of fins over its face.
  const fins = [];
  for (let k = 0; k < 24; k++) {
    const meridian = new THREE.TorusGeometry(bowlR + 0.04, 0.06, 4, 24, Math.PI / 2);
    meridian.rotateZ(-Math.PI / 2);
    meridian.rotateY(-k * (TAU / 24));
    fins.push(meridian);
  }
  for (let j = 1; j < 6; j++) {
    const e = (j / 6) * (Math.PI / 2);
    const ring = new THREE.TorusGeometry((bowlR + 0.04) * Math.cos(e), 0.06, 4, 64);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, -(bowlR + 0.04) * Math.sin(e), 0);
    fins.push(ring);
  }
  lampHead.add(new THREE.Mesh(mergeGeometries(fins.map(plain)), steel));
  // The rim and the cap over the bowl, unsquashed.
  const rim = new THREE.TorusGeometry(bowlR, 0.3, 8, 96);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, rimY, 0);
  group.add(new THREE.Mesh(rim, steel));
  const cap = new THREE.Mesh(new THREE.CircleGeometry(bowlR, 64), steel);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = rimY + 0.02;
  group.add(cap);

  // --- Light ----------------------------------------------------------------------------------
  // The lamp lights the top of the silo; the troughs fill in round the rim.
  const main = new THREE.PointLight(0xffe6b8, 220, 48, 2);
  main.position.set(0, bottom - 1.5, 0);
  group.add(main);
  for (let k = 0; k < 4; k++) {
    const a = (k + 0.25) * (TAU / 4), r = R - 2;
    const fill = new THREE.PointLight(0xffe2b0, 40, 24, 2);
    fill.position.set(r * Math.cos(a), base + 3, r * Math.sin(a));
    group.add(fill);
  }

  const height = rimY + 1 - H;
  return { group, y: top.y + H + height / 2, half: height / 2 };
}
