import * as THREE from "three";
import { buildCafeteria } from "./cafeteria.js";
import { WORLD } from "../config.js";
import { lerp } from "../mathutils.js";
import { makeGrateTexture, makePlaqueTexture, mulberry32 } from "../textures.js";
import { Kit, controlDesk, gauge, kitMaterial, pendant, personAt } from "./kit.js";
import { addBox, addCylinder, addGlow } from "./primitives.js";
import { addFixtureLight, addLantern } from "./fixtures.js";

// Reused leaves and analog instruments replace glowing placeholder spheres.
const leafGeo = new THREE.SphereGeometry(1, 7, 5);
const leafMat = new THREE.MeshStandardMaterial({ color: 0x526542, roughness: 0.95 });
function plant(group, x, y, z, scale = 1) {
  addCylinder(group, { x, y: y + 0.35 * scale, z, r: 0.018 * scale, h: 0.7 * scale, color: 0x586044 });
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(x + Math.cos(angle) * 0.15 * scale, y + (0.2 + i * 0.065) * scale, z + Math.sin(angle) * 0.15 * scale);
    leaf.scale.set(0.32 * scale, 0.035 * scale, 0.11 * scale);
    leaf.rotation.set(0, -angle, 0.35);
    group.add(leaf);
  }
}
function consoleBank(group, x, z, count = 3) {
  for (let i = 0; i < count; i++) {
    const cx = x + i * 1.25;
    addBox(group, { x: cx, y: 0.5, z, w: 1.12, h: 1, d: 0.85, color: 0x646d5b, metalness: 0.3 });
    addBox(group, { x: cx, y: 1.22, z: z + 0.25, w: 1.12, h: 0.45, d: 0.25, color: 0x747c68 });
    for (let k = 0; k < 3; k++) {
      addBox(group, { x: cx - 0.34 + k * 0.34, y: 1.26, z: z + 0.1, w: 0.24, h: 0.22, d: 0.035, color: 0xc0bea0 });
      addBox(group, { x: cx - 0.34 + k * 0.34, y: 1.25, z: z + 0.075, w: 0.012, h: 0.14, d: 0.02, color: 0x333b31 });
      addCylinder(group, { x: cx - 0.34 + k * 0.34, y: 1.03, z: z - 0.15, r: 0.055, h: 0.08, color: 0x272d27 });
    }
  }
}

// The upper cafeteria and the controlled exit: see cafeteria.js.
function themeTopo(group, station, roomStart) {
  buildCafeteria(group, station, roomStart);
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
  addGlow(group, { x: roomEnd - 2, y: H - 0.3, z: 0, color: station.light, mount: "ceiling", ceilingY: H });

  consoleBank(group, roomStart + 2.2, -hw + 0.9);
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
  const vaultSign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: vaultTex }));
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

  addBox(group, { x: midX, y: 0.012, z: 0, w: 4.8, h: 0.02, d: 4.2, color: 0x793e2e });
  for (const [x, z] of [[midX - 1.3, 0.2], [midX + 1.35, -0.3]]) {
    addBox(group, { x: x - 0.32, y: 0.68, z, w: 0.22, h: 0.68, d: 1.4, color: 0x96553c });
    for (const dz of [-0.62, 0.62]) addBox(group, { x, y: 0.52, z: z + dz, w: 0.85, h: 0.25, d: 0.16, color: 0x96553c });
  }
  // Sideboard and mirror on one wall.
  addBox(group, { x: roomStart + 2.2, y: 0.45, z: hw - 0.45, w: 1.8, h: 0.9, d: 0.55, color: 0xc2b294 });
  addBox(group, { x: roomStart + 2.2, y: 1.85, z: hw - 0.16, w: 1.3, h: 1.0, d: 0.06, color: 0xd8e2e6 });

  // Doorway through to a bedroom at the back.
  addBox(group, { x: roomEnd - 0.35, y: H * 0.55, z: -hw * 0.45, w: 0.12, h: H * 0.9, d: 1.5, color: 0x6b5b48 });

  // Plants + pendant lamp.
  for (const z of [-hw + 0.7, hw - 0.8]) {
    addCylinder(group, { x: roomStart + 1.1, y: 0.26, z, r: 0.3, h: 0.52, color: 0x7d6a52 });
    plant(group, roomStart + 1.1, 0.52, z, 1.5);
  }
  addLantern(group, { x: midX, z: 0, y: H, drop: 0.45, color: station.light });
  addFixtureLight(group, { x: midX, y: H - 0.5, z: 0, color: station.light, intensity: 10 });
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
      addGlow(group, { x, y: H - 0.9, z, color: station.light, mount: "ceiling", ceilingY: H });
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
        plant(group, x + (p - 1) * 0.35, 0.6, z, 0.5);
      }
      addBox(group, { x, y: 1.3, z, w: 1.3, h: 0.05, d: hw * 0.7, color: station.accent, emissive: station.accent, emissiveIntensity: 1.2 });
    }
  }
  for (let x = roomStart + 1; x < roomEnd; x += 2.4) {
    addBox(group, { x, y: H - 0.1, z: 0, w: 1.6, h: 0.08, d: 0.25, color: station.accent, emissive: station.accent, emissiveIntensity: 1.3 });
  }
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.3, z: 0, color: station.light, intensity: 9 });
}

function themeAgua(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  addCylinder(group, { x: roomStart + 2.2, y: H * 0.42, z: hw * 0.45, r: 1.1, h: H * 0.8, color: 0x36504f });
  addCylinder(group, { x: roomStart + 2.2, y: H * 0.42, z: -hw * 0.45, r: 1.1, h: H * 0.8, color: 0x36504f });
  for (let x = roomStart + 4; x < roomEnd - 0.6; x += 1.4) {
    addCylinder(group, { x, y: H - 0.5, z: hw - 0.3, r: 0.12, h: 1.2, rotZ: Math.PI / 2, color: 0x2f3a3a });
  }
  addGlow(group, { x: roomStart + 2.2, y: H - 0.3, z: hw * 0.45, r: 0.1, color: station.accent, mount: "ceiling", ceilingY: H });
  addGlow(group, { x: roomStart + 2.2, y: H - 0.3, z: -hw * 0.45, r: 0.1, color: station.accent, mount: "ceiling", ceilingY: H });
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.3, z: 0, color: station.light, intensity: 9 });
}

function themeMecanica(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  consoleBank(group, roomStart + 2.2, -hw + 1.2);
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
  addGlow(group, { x: roomStart + 1.2, y: H - 0.4, z: 0, color: station.light, mount: "ceiling", ceilingY: H });
}

// The generator hall (new-references 089-098): the turbine standing on its
// octagonal platform in the middle of a three-storey hall, the ring of pipe
// bends at its head, pump sets in the corners, a catwalk along the far wall
// reached by a steel stair, and the control room's long window over it.
function themeGerador(group, station, roomStart, roomEnd, hw, spec = {}) {
  const RH = spec.height || WORLD.roomHeight;
  const kit = new Kit(group);
  const grate = makeGrateTexture(station.floor, station.accent);
  addBox(group, { x: (roomStart + roomEnd) / 2, y: -0.01, z: 0, w: roomEnd - roomStart, h: 0.04, d: hw * 2, map: grate, repeat: [(roomEnd - roomStart) / 2, hw], color: 0xffffff });
  const cx = roomStart + 8.2;

  // The platform, its railing and the steps up to it.
  kit.cyl(cx, 0.5, 0, 3.0, 1.0, "darkConcrete", { seg: 8 });
  const ring = new THREE.RingGeometry(3.05, 3.4, 8, 1);
  ring.rotateX(-Math.PI / 2);
  kit.add(ring, kitMaterial("paintOrange"), { x: cx, y: 0.012, rotY: Math.PI / 8, solid: false });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, b = a + Math.PI / 4;
    const p = [cx + 2.85 * Math.cos(a), 2.85 * Math.sin(a)], q = [cx + 2.85 * Math.cos(b), 2.85 * Math.sin(b)];
    if (Math.abs(Math.cos((a + b) / 2) + 1) < 0.1) continue; // open where the steps arrive
    kit.rod([p[0], 2.05, p[1]], [q[0], 2.05, q[1]], 0.03, "paintOrange");
    kit.rod([p[0], 1.55, p[1]], [q[0], 1.55, q[1]], 0.02, "paintOrange");
    kit.rod([p[0], 1.0, p[1]], [p[0], 2.05, p[1]], 0.03, "paintOrange");
  }
  for (let k = 0; k < 5; k++) kit.span(cx - 3.0 - (k + 1) * 0.28, cx - 3.0 - k * 0.28, 0, 1.0 - k * 0.2, -0.6, 0.6, "darkMetal");

  // The turbine: skirt, ribbed body, flanges, lit bands.
  kit.cyl(cx, 1.3, 0, 2.1, 0.6, "darkMetal", { seg: 24 });
  kit.cyl(cx, 3.8, 0, 1.6, 5.0, "steel", { seg: 24 });
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    kit.box(cx + 1.66 * Math.cos(a), 3.8, 1.66 * Math.sin(a), 0.1, 4.6, 0.12, "darkMetal", { rotY: -a, solid: false });
  }
  for (const y of [1.65, 3.8, 6.2]) kit.cyl(cx, y, 0, 1.85, 0.22, "darkMetal", { seg: 24, solid: false });
  for (const y of [2.7, 5.0]) kit.torus(cx, y, 0, 1.72, 0.06, "glowAmber", { rotX: Math.PI / 2, seg: 32 });
  // Its head: the manifold and the ring of pipe bends, risers to the roof.
  kit.cyl(cx, 6.75, 0, 2.3, 0.9, "darkMetal", { seg: 24, solid: false });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    kit.torus(cx + 2.05 * Math.cos(a), 7.2, 2.05 * Math.sin(a), 0.4, 0.1, "steel", { arc: Math.PI, rotY: -a, seg: 10 });
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.26;
    kit.rod([cx + 1.2 * Math.cos(a), 7.2, 1.2 * Math.sin(a)], [cx + 1.2 * Math.cos(a), RH, 1.2 * Math.sin(a)], 0.2, "steel");
  }

  // Pump sets in the four corners, piped to the platform.
  for (const [x, s] of [[roomStart + 2.6, -1], [roomStart + 2.6, 1], [roomEnd - 2.4, -1], [roomEnd - 2.4, 1]]) {
    const z = s * (hw - 1.3);
    kit.span(x - 1.1, x + 1.1, 0, 1.4, z - 0.7, z + 0.7, "paintGreen");
    kit.cyl(x + 1.4, 0.7, z, 0.5, 0.6, "darkMetal", { rotZ: Math.PI / 2, seg: 16 });
    kit.rod([x - 0.5, 1.4, z], [x - 0.5, 2.8, z], 0.22, "steel");
    kit.rod([x - 0.5, 2.8, z], [cx, 2.8, z * 0.55], 0.22, "steel");
    kit.rod([cx, 2.8, z * 0.55], [cx, 2.8, s * 1.7], 0.22, "steel");
    gauge(kit, x - 1.12, 1.0, z, { r: 0.14 });
  }

  // The catwalk along the far wall and its stair; the control room's window.
  const cw = roomEnd - 1.6, CY = 4.2;
  kit.span(cw, roomEnd, CY - 0.15, CY, -hw, hw, "darkMetal", { solid: false });
  for (let z = -hw + 0.4; z < hw; z += 1.2) kit.rod([cw, CY, z], [cw, CY + 1.05, z], 0.025, "paintOrange");
  kit.rod([cw, CY + 1.05, -hw], [cw, CY + 1.05, hw - 1.2], 0.03, "paintOrange");
  kit.rod([cw, CY + 0.55, -hw], [cw, CY + 0.55, hw - 1.2], 0.02, "paintOrange");
  for (const z of [-hw + 1, 0, hw - 2]) kit.rod([cw + 0.2, CY - 0.15, z], [cw + 0.2, 0, z], 0.08, "darkMetal", { solid: true });
  const steps = 18, run = 5.0, sz = hw - 0.6;
  for (let k = 0; k < steps; k++) {
    const x = cw - run + (k + 0.5) * (run / steps);
    kit.box(x, (k + 1) * (CY / steps) - 0.03, sz, run / steps + 0.02, 0.05, 0.9, "darkMetal", { solid: false });
  }
  const slope = Math.atan2(CY, run), len = Math.hypot(CY, run);
  for (const e of [-0.47, 0.47]) kit.box(cw - run / 2, CY / 2 - 0.05, sz + e, len, 0.22, 0.04, "darkMetal", { rotZ: slope, solid: false });
  kit.box(cw - run / 2, CY / 2 + 1.0, sz - 0.47, len, 0.04, 0.04, "paintOrange", { rotZ: slope, solid: false });
  kit.span(cw - run, cw, 0, 1.0, sz - 0.5, sz + 0.5, "darkMetal", { solid: true });
  kit.span(roomEnd - 0.06, roomEnd - 0.02, 5.0, 7.4, -4.6, 4.6, "darkMetal", { solid: false });
  kit.span(roomEnd - 0.08, roomEnd - 0.06, 5.2, 7.2, -4.4, 4.4, "glowWarm", { solid: false });
  for (let z = -3.3; z <= 3.31; z += 1.1) kit.span(roomEnd - 0.1, roomEnd - 0.08, 5.2, 7.2, z - 0.04, z + 0.04, "darkMetal", { solid: false });

  // Mains along the side walls, and the operators' desks facing the turbine.
  for (const s of [-1, 1]) {
    kit.rod([roomStart + 0.4, 6.2, s * (hw - 0.5)], [roomEnd - 0.4, 6.2, s * (hw - 0.5)], 0.32, "rust");
    for (let x = roomStart + 1.5; x < roomEnd - 1; x += 3) kit.torus(x, 6.2, s * (hw - 0.5), 0.34, 0.05, "darkMetal", { rotY: Math.PI / 2, seg: 14 });
  }
  controlDesk(kit, roomStart + 3.6, -2.6, { w: 2.0, rand: mulberry32(144) });
  for (const z of [-2.6, 2.6]) personAt(group, roomStart + 2.85, z, Math.PI / 2, "work", { wear: "mechanical" });
  personAt(group, cx - 3.8, 1.2, Math.PI / 2, "watch", { wear: "mechanical" });
  controlDesk(kit, roomStart + 3.6, 2.6, { w: 2.0, rand: mulberry32(145) });
  for (const [x, z] of [[cx - 4, -4], [cx - 4, 4], [cx + 4, -4], [cx + 4, 4]]) pendant(kit, x, z, RH, { drop: 1.4, r: 0.5, glow: "glowWarm" });
  kit.sign(["FIM DO POÇO", "NÍVEL 144"], { x: roomEnd - 0.04, y: 2.4, z: -3.5, w: 1.3, h: 0.7, fg: 0xffcf9e, bg: 0x1a0f0a });
  kit.finish();
  addFixtureLight(group, { x: cx, y: 7.8, z: 0, color: station.light, intensity: 22, distance: 16, glow: false, ceilingY: RH });
  addFixtureLight(group, { x: cx - 4.5, y: RH - 2, z: 0, color: 0xffd0a0, intensity: 16, distance: 14, glow: false, ceilingY: RH });
  addFixtureLight(group, { x: roomEnd - 2.5, y: 5.5, z: 0, color: 0xffc080, intensity: 12, distance: 12, glow: false, ceilingY: RH });
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
    addLantern(group, { x: roomStart + 3 + i * 4, z: (i - 1) * 2.2, y: H, color: station.light });
  }
  addFixtureLight(group, { x: cx - 1, y: H - 0.5, z: 0, color: station.light, intensity: 14 });
  addFixtureLight(group, { x: roomEnd - 3, y: 1.2, z: 0, color: 0xff7a33, intensity: 8, distance: 10, glow: false });
}


// --- Below 144: the three levels the digger opened ---------------------------

// Working rock face: ore carts on rail, props holding the roof, a spoil pile.
function themeMinas(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  // The face itself - rough rock closing the far end.
  for (let i = 0; i < 9; i++) {
    const z = -hw + 0.4 + (i * (hw * 2 - 0.8)) / 8;
    addBox(group, { x: roomEnd - 0.9 - (i % 3) * 0.22, y: H * 0.5, z, w: 1.4, h: H, d: (hw * 2) / 8 + 0.2, color: 0x4a4038, roughness: 0.99, metalness: 0.0, rotY: (i % 2) * 0.08 });
  }
  // Rail running back from the face, with carts on it.
  for (const dz of [-0.5, 0.5]) {
    addBox(group, { x: (roomStart + roomEnd) / 2, y: 0.06, z: dz, w: roomEnd - roomStart - 1, h: 0.12, d: 0.14, color: 0x6b6257, roughness: 0.4, metalness: 0.7 });
  }
  for (let i = 0; i < 3; i++) {
    const x = roomStart + 2.4 + i * 3.4;
    addBox(group, { x, y: 0.72, z: 0, w: 1.7, h: 1.1, d: 1.3, color: 0x55493c, roughness: 0.85, metalness: 0.15 });
    addBox(group, { x, y: 1.32, z: 0, w: 1.5, h: 0.18, d: 1.1, color: 0x3b3229, roughness: 0.98 });
  }
  // Timber props against the roof.
  for (let i = 0; i < 5; i++) {
    const x = roomStart + 1.6 + i * 2.6;
    for (const dz of [-(hw - 0.7), hw - 0.7]) {
      addCylinder(group, { x, y: H / 2, z: dz, r: 0.19, h: H, radialSegments: 8, color: 0x6b4a2f, roughness: 0.95 });
    }
    addBox(group, { x, y: H - 0.16, z: 0, w: 0.32, h: 0.28, d: (hw - 0.7) * 2, color: 0x6b4a2f, roughness: 0.95 });
  }
  addFixtureLight(group, { x: roomStart + 3, y: H - 0.4, z: 0, color: station.light, intensity: 9 });
}

// The cavity: smooth, too-old walls the silo was built inside. Deliberately
// almost empty - the point is the surfaces, not the props.
function themeCaverna(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  // Smooth curved shoulders where the room meets a wall that was never cut.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const x = roomStart + 1.2 + i * ((roomEnd - roomStart - 2) / 6);
      addCylinder(group, { x, y: H * 0.5, z: side * (hw - 0.35), r: 0.9, h: H, radialSegments: 14, color: 0x3f3935, roughness: 0.55, metalness: 0.05 });
    }
  }
  // A survey line of lamps on tripods, left by whoever came first.
  for (let i = 0; i < 4; i++) {
    const x = roomStart + 2.5 + i * 3.2;
    addGlow(group, { x, y: 1.35, z: (i % 2 ? 1 : -1) * 1.8, r: 0.07, color: 0x9ab0a8, mount: "post" });
  }
  // Instrument crates, stacked and abandoned.
  for (let i = 0; i < 3; i++) {
    addBox(group, { x: roomStart + 3 + i * 2.2, y: 0.4, z: hw - 1.4, w: 1.1, h: 0.8, d: 0.9, color: 0x4a5350, roughness: 0.8 });
  }
  addFixtureLight(group, { x: (roomStart + roomEnd) / 2, y: H - 0.4, z: 0, color: station.light, intensity: 8 });
}

// The threshold: tunnel mouths running off past the silo, and the one cable
// that leaves Silo 18 and does not come back.
function themeLimiar(group, station, roomStart, roomEnd, hw) {
  const H = WORLD.roomHeight;
  // Three tunnel mouths in the far wall, bricked to different heights.
  for (let i = 0; i < 3; i++) {
    const z = (i - 1) * (hw * 0.62);
    addCylinder(group, { x: roomEnd - 0.5, y: H * 0.42, z, r: 1.15, h: 0.9, radialSegments: 16, rotZ: Math.PI / 2, color: 0x241f1f, roughness: 0.99 });
    addBox(group, { x: roomEnd - 0.95, y: 0.55 - i * 0.12, z, w: 0.3, h: 1.1 - i * 0.24, d: 2.3, color: 0x5a4f47, roughness: 0.95 });
  }
  // The cable: along the wall, into the middle mouth, out of the silo.
  for (let i = 0; i < 8; i++) {
    const x = roomStart + 0.6 + i * ((roomEnd - roomStart - 1) / 7);
    addCylinder(group, { x, y: H - 0.55, z: -hw + 0.3, r: 0.07, h: (roomEnd - roomStart) / 7 + 0.1, radialSegments: 7, rotZ: Math.PI / 2, color: 0x1d2a33, roughness: 0.4, metalness: 0.55 });
    if (i % 3 === 0) addBox(group, { x, y: H - 0.42, z: -hw + 0.3, w: 0.1, h: 0.2, d: 0.16, color: 0x2f3336, roughness: 0.5, metalness: 0.6 });
  }
  addGlow(group, { x: roomEnd - 1.6, y: H * 0.62, z: 0, r: 0.06, color: 0xc8481c });
  addFixtureLight(group, { x: roomStart + 2.5, y: H - 0.45, z: 0, color: station.light, intensity: 9 });
}

export const THEME_BUILDERS = {
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
  minas: themeMinas,
  caverna: themeCaverna,
  limiar: themeLimiar,
};

// Smaller, unthemed side rooms that fill out the secondary wings so a floor
// never feels like it has just one door.
export function themeGeneric(group, station, roomStart, roomEnd, hw, wingLabel) {
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
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(WORLD.landingR + WORLD.corridorLen * 0.35, 1.7, -WORLD.corridorHalfW + 0.1);
  group.add(sign);

  addGlow(group, { x: midX, y: H - 0.35, z: 0, color: station.light, mount: "ceiling", ceilingY: H });
}
