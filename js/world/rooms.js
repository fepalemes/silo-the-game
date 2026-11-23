import * as THREE from "three";
import { WORLD } from "../config.js";
import { mulberry32 } from "../textures.js";
import { buildBandGeometry } from "./primitives.js";
import { tint } from "./materials.js";
import {
  Kit, bars, barrel, bench, bottles, bunk, ceilingPanel, chair, conduit, controlDesk, crate, desk, filingCabinet,
  gauge, kitMaterial, locker, noticeBoard, pendant, personAt, plant, relicAt, shelf, shelfLoad, sprout, terminal, wallPanel,
} from "./kit.js";

// The side rooms of every department (config.js SIDE_ROOMS): what each
// sector keeps beside its main room. Built in the wing's frame (station.js
// buildWing): x out along the corridor, the room from x0 to x1, z across it
// within +-hw, y up from the floor. The corridor arrives at x0 on the centre
// line, and every room keeps a way in from there.

const H = WORLD.roomHeight;
// Furniture faces along its local -x (kit.js): rotY 0 faces -x (towards the
// corridor), PI faces +x (the far wall), PI/2 faces +z and -PI/2 faces -z. In
// the round hall, facing the centre from bearing a is rotY = -a.

function setup(group, station, spec) {
  const kit = new Kit(group);
  const rand = mulberry32((station.level * 7919 + spec.kind.length * 131 + (spec.wing === "C" ? 17 : 3)) >>> 0);
  return { kit, rand };
}

// The plate beside the room's door inside the corridor, and the room's light.
function finish(kit, station, spec, x0, x1, { lights = 1, color = 0xfff0d8, intensity = 11, panels = true } = {}) {
  const mid = (x0 + x1) / 2;
  if (panels) {
    ceilingPanel(kit, x0 + (x1 - x0) * 0.3, 0, H);
    ceilingPanel(kit, x0 + (x1 - x0) * 0.72, 0, H);
  }
  for (let i = 0; i < lights; i++) kit.light(lights === 1 ? mid : x0 + ((i + 0.5) * (x1 - x0)) / lights, H - 0.45, 0, color, intensity);
  kit.sign([spec.label, `NÍVEL ${station.level}`], { x: WORLD.landingR + WORLD.corridorLen * 0.35, y: 1.75, z: -WORLD.corridorHalfW + 0.03, w: 0.9, h: 0.36, rotY: 0, fg: 0xd8cba4, bg: 0x15181a });
  kit.finish();
}

// --- Up top -------------------------------------------------------------------

// The sheriff's station (new-references 049-057): a round bull pen with four
// desks round a central circle, columns round the wall, and off it the
// sheriff's office behind glass, two cells behind bars and the door to the
// holding cell. Walkable inside the circle; the rooms off it are seen, not
// entered (collision.js keeps the body inside spec.clearance of the wall).
function police(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  const R = spec.radius, cx = x0 + R, PH = 3.6;
  const pos = (r, a) => [cx + r * Math.cos(a), r * Math.sin(a)];
  const wallMat = new THREE.MeshStandardMaterial({ color: tint(station.wall), roughness: 0.92, metalness: 0.03, side: THREE.DoubleSide });

  // Floor, with the paler central circle of the set, and the ceiling.
  const floor = new THREE.CircleGeometry(R + 0.3, 48);
  floor.rotateX(-Math.PI / 2);
  kit.add(floor, kitMaterial("darkConcrete"), { x: cx, y: 0.002, solid: false });
  const ring = new THREE.RingGeometry(1.6, 2.3, 48);
  ring.rotateX(-Math.PI / 2);
  kit.add(ring, kitMaterial("concrete"), { x: cx, y: 0.006, solid: false });
  const centre = new THREE.CircleGeometry(1.6, 40);
  centre.rotateX(-Math.PI / 2);
  kit.add(centre, kitMaterial("plaster"), { x: cx, y: 0.006, solid: false });
  const ceil = new THREE.CircleGeometry(R + 0.3, 48);
  ceil.rotateX(Math.PI / 2);
  kit.add(ceil, kitMaterial("darkConcrete"), { x: cx, y: PH, solid: false });

  // The rooms round the wall, by bearing from the hall's centre (0 = far side).
  const entrance = Math.PI, entranceHalf = Math.asin((WORLD.corridorHalfW + 0.3) / R);
  const openings = [
    { a: -1.15, half: 0.2, kind: "office" },
    { a: 0.62, half: 0.15, kind: "cell" },
    { a: 1.02, half: 0.15, kind: "cell" },
    { a: 1.95, half: 0.12, kind: "holding" },
    { a: 0, half: 0.11, kind: "service" },
  ];
  const gaps = [{ center: entrance, halfWidth: entranceHalf }, ...openings.map((o) => ({ center: o.a, halfWidth: o.half }))];
  // The wall, between the gaps.
  const edges = gaps.map((g) => [g.center - g.halfWidth, g.center + g.halfWidth]).sort((p, q) => p[0] - q[0]);
  for (let i = 0; i < edges.length; i++) {
    const from = edges[i][1], to = i + 1 < edges.length ? edges[i + 1][0] : edges[0][0] + Math.PI * 2;
    const band = new THREE.Mesh(buildBandGeometry(R, from, to, PH, 0, 24, false), wallMat);
    band.position.x = cx;
    group.add(band);
    const outer = new THREE.Mesh(buildBandGeometry(R + 0.25, from, to, PH, 0, 24, true), wallMat);
    outer.position.x = cx;
    group.add(outer);
  }
  // A lintel over each opening but the entrance, and the room behind it.
  for (const o of openings) {
    const [ox, oz] = pos(R, o.a);
    const width = 2 * R * Math.sin(o.half);
    const doorH = o.kind === "office" ? 2.6 : 2.4;
    kit.box(ox, (doorH + PH) / 2, oz, 0.3, PH - doorH, width + 0.1, "concrete", { rotY: -o.a, solid: false });
    // The room behind: walls, floor, ceiling, in the opening's own frame.
    const depth = o.kind === "office" ? 3.2 : o.kind === "service" ? 0.6 : 2.4;
    const back = R + 0.15 + depth;
    const roomW = width + (o.kind === "office" ? 1.6 : 0.6);
    const [bx, bz] = pos(back, o.a), [mx, mz] = pos(R + 0.15 + depth / 2, o.a);
    kit.box(bx, PH / 2, bz, 0.2, PH, roomW, "plaster", { rotY: -o.a, solid: false });
    for (const s of [-1, 1]) {
      const t = [-Math.sin(o.a), Math.cos(o.a)];
      kit.box(mx + t[0] * s * roomW / 2, PH / 2, mz + t[1] * s * roomW / 2, depth + 0.2, PH, 0.2, "plaster", { rotY: -o.a, solid: false });
    }
    kit.box(mx, 0.01, mz, depth + 0.2, 0.02, roomW, "darkConcrete", { rotY: -o.a, solid: false });
    kit.box(mx, PH, mz, depth + 0.2, 0.04, roomW, "darkConcrete", { rotY: -o.a, solid: false });
    const frontAt = (r, along) => [cx + r * Math.cos(o.a) - along * Math.sin(o.a), r * Math.sin(o.a) + along * Math.cos(o.a)];
    if (o.kind === "cell") {
      // Bars across the opening, a bunk and a bucket inside.
      for (let along = -width / 2; along <= width / 2 + 1e-6; along += 0.13) {
        const [px, pz] = frontAt(R + 0.05, along);
        kit.cyl(px, 1.2, pz, 0.017, 2.4, "darkMetal", { seg: 6, solid: false });
      }
      for (const y of [0.15, 1.2, 2.3]) { const [px, pz] = frontAt(R + 0.05, 0); kit.box(px, y, pz, 0.05, 0.05, width, "darkMetal", { rotY: -o.a, solid: false }); }
      const [kx, kz] = frontAt(back - 0.55, 0);
      bunk(kit, kx, kz, { rotY: -o.a, blanket: "fabricGrey" });
      const [cxp, czp] = frontAt(R + 0.6, width / 2 - 0.1);
      kit.cyl(cxp, 0.2, czp, 0.17, 0.4, "steel", { seg: 10, solid: false });
    } else if (o.kind === "office") {
      // Glazed partition with a door, the sheriff's desk inside.
      const [gx, gz] = frontAt(R + 0.05, -0.35);
      kit.box(gx, 0.5, gz, 0.08, 1.0, width - 0.7, "paintGreen", { rotY: -o.a, solid: false });
      kit.box(gx, 1.75, gz, 0.03, 1.5, width - 0.7, "glassDark", { rotY: -o.a, solid: false });
      const [dx, dz] = frontAt(R + 0.05, width / 2 - 0.35);
      kit.box(dx, 1.15, dz, 0.07, 2.3, 0.7, "paintGreen", { rotY: -o.a, solid: false });
      kit.box(dx - Math.cos(o.a) * 0.05, 1.6, dz - Math.sin(o.a) * 0.05, 0.02, 0.4, 0.4, "glassDark", { rotY: -o.a, solid: false });
      const [ex, ez] = frontAt(back - 1.1, 0);
      desk(kit, ex, ez, { rotY: -o.a, mat: "darkWood", top: "darkWood", w: 1.8 });
      terminal(kit, ex, 0.77, ez, { rotY: -o.a + Math.PI });
      const [hx, hz] = frontAt(back - 0.5, 0);
      chair(kit, hx, hz, { rotY: -o.a, seat: "fabricRed" });
      const [fx, fz] = frontAt(back - 0.4, roomW / 2 - 0.45);
      filingCabinet(kit, fx, fz, { rotY: -o.a });
      const [sx, sz] = frontAt(R - 0.2, 0);
      kit.sign(["XERIFE", "SILO 18"], { x: sx, y: 2.9, z: sz, w: 1.1, h: 0.34, rotY: -Math.PI / 2 - o.a, fg: 0xe6d6a8, bg: 0x2a2018 });
    } else if (o.kind === "holding") {
      const [dx, dz] = frontAt(R + 0.1, 0);
      kit.box(dx, 1.2, dz, 0.12, 2.4, width - 0.05, "darkMetal", { rotY: -o.a, solid: false });
      const [wx, wz] = frontAt(R + 0.03, 0);
      kit.box(wx, 1.65, wz, 0.02, 0.22, 0.4, "glassDark", { rotY: -o.a, solid: false });
      const [sx, sz] = frontAt(R - 0.2, 0);
      kit.sign(["CELA DE ESPERA", "103"], { x: sx, y: 2.9, z: sz, w: 0.9, h: 0.3, rotY: -Math.PI / 2 - o.a, fg: 0xffd27a, bg: 0x14100c });
    } else {
      const [dx, dz] = frontAt(R + 0.1, 0);
      kit.box(dx, 1.2, dz, 0.1, 2.4, width - 0.05, "paintBlue", { rotY: -o.a, solid: false });
      const [sx, sz] = frontAt(R - 0.2, 0);
      kit.sign(["SAÍDA CONTROLADA →", "ACESSO RESTRITO"], { x: sx, y: 2.9, z: sz, w: 1.0, h: 0.3, rotY: -Math.PI / 2 - o.a, fg: 0xffd27a, bg: 0x14100c });
    }
  }

  // Closing the corridor's mouth to the hall's wall, and the step up in the
  // ceiling from the corridor to the hall.
  for (const side of [-1, 1]) kit.span(x0 - 0.1, x0 + 0.5, 0, PH, side * 1.9, side * 2.35, "concrete", { solid: false });
  kit.span(x0 - 0.1, x0 + 0.5, H, PH + 0.02, -2.35, 2.35, "concrete", { solid: false });
  // Columns round the wall, between the openings.
  for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) * (Math.PI / 4);
    if (gaps.some((g) => Math.abs(Math.atan2(Math.sin(a - g.center), Math.cos(a - g.center))) < g.halfWidth + 0.12)) continue;
    const [px, pz] = pos(R - 0.45, a);
    kit.cyl(px, PH / 2, pz, 0.24, PH, "concrete", { seg: 14 });
  }
  // Four desks round the centre, each with its terminal, chair and cabinet.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const [dx, dz] = pos(3.3, a);
    desk(kit, dx, dz, { rotY: -a, w: 1.6 });
    terminal(kit, dx, 0.77, dz, { rotY: -a + Math.PI });
    const [hx, hz] = pos(3.9, a);
    chair(kit, hx, hz, { rotY: -a });
    const [fx, fz] = pos(3.4, a + 0.42);
    filingCabinet(kit, fx, fz, { rotY: -a - Math.PI / 2, h: 1.0 });
  }
  // The sheriff, at the door of the office; two deputies at their desks.
  {
    const a = -1.15, [sx, sz] = pos(4.9, a);
    personAt(group, sx, sz, Math.atan2(-Math.cos(a), -Math.sin(a)), "chat", { character: "xerife", wear: "law" });
    for (const a2 of [Math.PI / 4, (5 * Math.PI) / 4]) {
      const [hx, hz] = pos(3.9, a2);
      personAt(group, hx, hz, Math.atan2(-Math.cos(a2), -Math.sin(a2)), "sit", { wear: "law" });
    }
  }
  // Notices and the wanted board on the wall, the radio by the office.
  for (const a of [-0.45, 2.45]) {
    const [nx, nz] = pos(R - 0.04, a);
    noticeBoard(kit, nx, 1.65, nz, { rotY: -Math.PI / 2 - a, rand });
  }
  // The ceiling of the set: radial ribs and rectangular light panels.
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const [bx, bz] = pos(R / 2 + 0.3, a);
    kit.box(bx, PH - 0.12, bz, R - 0.6, 0.24, 0.22, "concrete", { rotY: -a, solid: false });
    const [lx, lz] = pos(3.6, a + Math.PI / 8);
    ceilingPanel(kit, lx, lz, PH, { w: 1.3, d: 0.5, rotY: -(a + Math.PI / 8) + Math.PI / 2 });
  }
  kit.torus(cx, PH - 0.12, 0, 1.6, 0.1, "concrete", { rotX: Math.PI / 2, seg: 40 });
  kit.light(cx, PH - 0.5, 0, 0xf4f0e4, 13, 13);
  kit.light(cx + 3, PH - 0.5, -2, 0xf4f0e4, 8, 10);
  kit.light(cx - 2.5, PH - 0.5, 2.5, 0xf4f0e4, 8, 10);
  kit.sign([spec.label, `NÍVEL ${station.level}`], { x: WORLD.landingR + WORLD.corridorLen * 0.35, y: 1.75, z: -WORLD.corridorHalfW + 0.03, w: 0.9, h: 0.36, rotY: 0, fg: 0xd8cba4, bg: 0x15181a });
  kit.finish();
}

// The controlled exit: the suit room, the inner airlock door standing open,
// the tiled airlock and its sealed outer door with the release lever
// (new-references 058-065).
function airlock(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  const xa = x1 - 3.6; // the airlock's inner wall
  // Suit room: lockers and a bench, the cleaning suits on their rack.
  locker(kit, x0 + 1.6, -hw + 0.3, { rotY: Math.PI / 2, count: 5, mat: "paintCream" });
  bench(kit, x0 + 2.2, -hw + 1.25, { rotY: Math.PI / 2, len: 1.8 });
  for (let k = 0; k < 3; k++) {
    const x = x0 + 1.2 + k * 0.85;
    kit.box(x, 1.25, hw - 0.35, 0.5, 1.2, 0.36, "linen", { solid: false });
    kit.cyl(x, 2.02, hw - 0.35, 0.2, 0.36, "linen", { seg: 12, solid: false });
    kit.cyl(x, 2.02, hw - 0.17, 0.13, 0.02, "glassDark", { rotX: Math.PI / 2, seg: 12, solid: false });
  }
  kit.box(x0 + 2.05, 2.35, hw - 0.3, 2.8, 0.05, 0.05, "steel", { solid: false });
  kit.span(x0 + 0.7, x0 + 3.4, 0, 1.0, hw - 0.6, hw - 0.1, "steel", { solid: true });
  noticeBoard(kit, x0 + 4.2, 1.65, hw - 0.02, { rotY: Math.PI, w: 1.0, rand });
  kit.sign(["LIMPEZA", "SOMENTE COM ORDEM DO XERIFE"], { x: xa - 0.27, y: 2.75, z: 0, w: 1.6, h: 0.42, fg: 0xffd27a, bg: 0x14100c });

  // The airlock's inner wall, with the doorway, and the heavy door swung back.
  kit.span(xa - 0.25, xa + 0.25, 0, H, -hw, -0.85, "darkConcrete");
  kit.span(xa - 0.25, xa + 0.25, 0, H, 0.85, hw, "darkConcrete");
  kit.span(xa - 0.25, xa + 0.25, 2.5, H, -0.85, 0.85, "darkConcrete", { solid: false });
  kit.span(xa - 0.3, xa + 0.3, 2.4, 2.55, -0.95, 0.95, "steel", { solid: false });
  for (const s of [-1, 1]) kit.span(xa - 0.3, xa + 0.3, 0, 2.5, s * 0.85, s * 0.97, "steel", { solid: false });
  // The inner door, swung open into the suit room on its hinges at the
  // doorway's edge: a thick leaf with the radial ribs and hub of the set.
  const leafX = xa - 1.05, leafY = 1.27;
  kit.span(xa - 1.85, xa - 0.25, 0.05, 2.5, -1.03, -0.87, "paintGreen");
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    kit.box(leafX + Math.cos(a) * 0.42, leafY + Math.sin(a) * 0.42, -0.85, 0.5, 0.05, 0.04, "paintGreen", { rotZ: a, solid: false });
  }
  kit.cyl(leafX, leafY, -0.83, 0.2, 0.06, "steel", { rotX: Math.PI / 2, seg: 16, solid: false });
  for (const y of [0.5, 2.0]) kit.span(xa - 0.4, xa - 0.2, y - 0.12, y + 0.12, -1.06, -0.84, "darkMetal", { solid: false });
  // The airlock: tiled all round, nozzles in the walls, the outer door.
  const ta = xa + 0.25;
  for (const s of [-1, 1]) {
    kit.span(ta, x1, 0, H, s * (hw - 0.04), s * hw, "tile", { solid: false });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      kit.cyl(ta + 0.6 + i * 0.75, 0.9 + j * 0.65, s * (hw - 0.08), 0.045, 0.1, "steel", { rotX: Math.PI / 2, seg: 8, solid: false });
    }
  }
  kit.span(ta, x1, 0, 0.02, -hw, hw, "tile", { solid: false });
  // Outer door, sealed: frame, leaf with ribs, the hub and wheel.
  kit.span(x1 - 0.12, x1, 0, H, -hw, hw, "darkConcrete", { solid: false });
  kit.span(x1 - 0.2, x1 - 0.1, 0.05, 2.75, -1.15, 1.15, "steel", { solid: false });
  kit.span(x1 - 0.26, x1 - 0.18, 0.15, 2.65, -1.0, 1.0, "paintGreen", { solid: false });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    kit.box(x1 - 0.29, 1.4 - Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0.04, 0.05, 0.6, "paintGreen", { rotX: a, solid: false });
  }
  kit.cyl(x1 - 0.31, 1.4, 0, 0.24, 0.06, "steel", { rotZ: Math.PI / 2, seg: 18, solid: false });
  kit.torus(x1 - 0.36, 1.4, 0, 0.2, 0.02, "darkMetal", { rotY: Math.PI / 2, seg: 18 });
  kit.box(x1 - 0.3, 2.35, 0, 0.03, 0.14, 0.44, "glowRed", { solid: false });
  // The release lever in its round frame, on the side wall.
  kit.cyl(x1 - 1.0, 1.45, hw - 0.06, 0.42, 0.05, "steel", { rotX: Math.PI / 2, seg: 24, solid: false });
  kit.box(x1 - 1.0, 1.45, hw - 0.12, 0.3, 0.46, 0.08, "paintCream", { solid: false });
  kit.box(x1 - 0.86, 1.52, hw - 0.2, 0.04, 0.34, 0.04, "paintRed", { rotZ: -0.6, solid: false });
  kit.box(x1 - 1.0, 1.66, hw - 0.17, 0.12, 0.04, 0.01, "glowRed", { solid: false });
  ceilingPanel(kit, ta + 1.6, 0, H, { w: 1.6, d: 0.4 });
  kit.light(ta + 1.6, H - 0.6, 0, 0xe8f0f4, 10, 8);
  kit.light(x1 - 0.6, 2.4, 0, 0xff5533, 4, 5);
  finish(kit, station, spec, x0, xa - 0.3, { lights: 1, intensity: 9 });
}

// --- Law and records ----------------------------------------------------------

function cells(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  const front = x1 - 2.3;
  // Two cells across the back, split by a concrete wall, barred at the front
  // under a concrete header.
  kit.span(front, x1, 0, H, -0.1, 0.1, "concrete");
  kit.span(front - 0.1, front + 0.1, 2.6, H, -hw, hw, "concrete", { solid: false });
  for (const s of [-1, 1]) {
    bars(kit, front, s > 0 ? 0.15 : -hw + 0.05, s > 0 ? hw - 0.05 : -0.15);
    bunk(kit, x1 - 0.55, s * 1.65, { double: s > 0 });
    kit.cyl(x1 - 1.7, 0.2, s * 0.45, 0.17, 0.4, "steel", { seg: 10 });
    kit.sign([`CELA ${s > 0 ? 2 : 1}`], { x: front - 0.13, y: 2.98, z: s * 1.6, w: 0.5, h: 0.18, fg: 0xe6dcbe, bg: 0x14161a });
  }
  // The guard's desk, cabinet, the key board and a bench for visitors.
  desk(kit, x0 + 2.3, -hw + 0.9, { rotY: Math.PI / 2 });
  terminal(kit, x0 + 2.3, 0.77, -hw + 0.7, { rotY: Math.PI / 2 });
  chair(kit, x0 + 2.3, -hw + 1.55, { rotY: -Math.PI / 2 });
  filingCabinet(kit, x0 + 0.5, -hw + 0.35, { rotY: -Math.PI / 2 });
  wallPanel(kit, x0 + 1.3, 1.6, -hw + 0.02, 0.6, 0.5, "darkWood", { rotY: 0 });
  for (let k = 0; k < 6; k++) kit.box(x0 + 1.08 + (k % 3) * 0.2, 1.7 - Math.floor(k / 3) * 0.2, -hw + 0.06, 0.03, 0.08, 0.02, "brass", { solid: false });
  bench(kit, x0 + 2.6, hw - 0.4, { rotY: Math.PI / 2, len: 2.0 });
  personAt(group, x0 + 2.3, -hw + 1.55, Math.PI, "sit", { wear: "law" });
  personAt(group, x1 - 0.55, -1.65, -Math.PI / 2, "sit");
  noticeBoard(kit, x0 + 0.03, 1.65, hw - 0.6, { rotY: Math.PI / 2, w: 0.8, rand });
  conduit(kit, x0, x1, 2.9, hw - 0.05);
  finish(kit, station, spec, x0, x1, { lights: 2, intensity: 8 });
}

function deputy(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  const mid = (x0 + x1) / 2;
  desk(kit, mid + 0.6, 0, { rotY: 0, w: 1.8, mat: "darkWood" });
  terminal(kit, mid + 0.75, 0.77, 0.45, { rotY: Math.PI });
  chair(kit, mid + 1.3, 0, { rotY: 0, seat: "fabricRed" });
  chair(kit, mid - 0.3, -0.4, { rotY: Math.PI });
  chair(kit, mid - 0.3, 0.4, { rotY: Math.PI });
  // The radio on its own table by the wall, with the call-sign chart.
  kit.span(x1 - 2.6, x1 - 0.8, 0, 0.78, hw - 0.7, hw - 0.05, "paintGreen");
  kit.box(x1 - 1.7, 0.98, hw - 0.4, 0.7, 0.4, 0.5, "paintOlive", { solid: false });
  for (let k = 0; k < 3; k++) gauge(kit, x1 - 1.95 + k * 0.25, 1.05, hw - 0.66, { r: 0.06 });
  wallPanel(kit, x1 - 1.7, 1.75, hw - 0.02, 0.9, 0.7, "paper", { rotY: Math.PI });
  kit.sign(["POSTO 18", "CANAL 1 · EMERGÊNCIA 5"], { x: x1 - 1.7, y: 2.35, z: hw - 0.03, w: 0.9, h: 0.26, rotY: Math.PI, fg: 0x2a2d31, bg: 0xd8d0b8 });
  // A locked rack for the long arms and the cabinets.
  kit.span(x1 - 0.4, x1 - 0.05, 0, 2.0, -hw + 0.3, -hw + 1.6, "darkMetal");
  for (let k = 0; k < 4; k++) kit.box(x1 - 0.42, 1.3, -hw + 0.5 + k * 0.3, 0.02, 1.2, 0.06, "rust", { solid: false });
  filingCabinet(kit, x0 + 0.5, -hw + 0.35, { rotY: -Math.PI / 2 });
  filingCabinet(kit, x0 + 1.15, -hw + 0.35, { rotY: -Math.PI / 2 });
  noticeBoard(kit, x0 + 2.6, 1.6, -hw + 0.02, { rotY: 0, rand });
  kit.cyl(x0 + 0.5, 0.9, hw - 0.4, 0.03, 1.8, "darkWood", { seg: 6 });
  kit.box(x0 + 0.5, 1.6, hw - 0.4, 0.28, 0.5, 0.28, "fabricGrey", { solid: false });
  pendant(kit, mid + 0.6, 0, H, { drop: 0.9 });
  personAt(group, mid + 1.3, 0, -Math.PI / 2, "sit", { wear: "law" });
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xffe0b0, intensity: 9, panels: false });
}

function archive(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // Rows of tall shelves either side of the aisle, end-on to it.
  for (let i = 0; i < 4; i++) {
    const x = x0 + 1.5 + i * 1.35;
    for (const s of [-1, 1]) {
      shelf(kit, x, s * (hw - 1.05), { rotY: Math.PI / 2, w: 1.9, d: 0.45, h: 2.4, levels: 6, mat: "darkWood",
        items: (_, y) => shelfLoad(kit, x, s * (hw - 1.05), y, { rotY: Math.PI / 2, w: 1.9, mats: ["paper", "cardboard", "fabricRed", "fabricBlue"], size: [0.3, 0.3, 0.07], gap: 0.008, rand, fill: 0.9 }) });
    }
  }
  // A reading table at the end of the aisle, with its lamp.
  kit.span(x1 - 1.6, x1 - 0.5, 0, 0.76, -0.9, 0.9, "darkWood");
  kit.box(x1 - 1.05, 0.79, 0.3, 0.3, 0.02, 0.4, "paper", { solid: false });
  kit.cyl(x1 - 1.0, 0.95, -0.55, 0.012, 0.35, "brass", { seg: 6, solid: false });
  kit.cyl(x1 - 1.0, 1.12, -0.55, 0.06, 0.12, "paintGreen", { r2: 0.13, seg: 12, solid: false });
  chair(kit, x1 - 1.9, 0.3, { rotY: Math.PI, mat: "darkWood", seat: "darkWood" });
  personAt(group, x1 - 1.9, 0.3, Math.PI / 2, "sit", { wear: "judicial" });
  if (station.id === "judicial") relicAt(group, spec.interactables, "livro", x1 - 1.05, 0.79, -0.45);
  kit.sign(["O PACTO", "CONSULTA SOB REGISTRO"], { x: x1 - 0.03, y: 2.2, z: 0, w: 1.4, h: 0.4, fg: 0xd8cba4, bg: 0x2a1d16 });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffd9a8, intensity: 8 });
}

function office(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // A counter across the front half, open at one end.
  kit.span(x0 + 2.0, x0 + 2.55, 0, 1.05, -hw + 0.05, 0.9, "darkWood");
  kit.span(x0 + 1.95, x0 + 2.6, 1.05, 1.1, -hw + 0.05, 0.95, "paleWood", { solid: false });
  kit.cyl(x0 + 2.2, 1.14, 0.5, 0.05, 0.05, "brass", { seg: 10, solid: false });
  for (const [x, z] of [[x0 + 3.8, -1.7], [x0 + 5.4, -1.7]]) {
    desk(kit, x, z, { rotY: 0, w: 1.4, mat: "paintOlive" });
    kit.box(x - 0.1, 0.86, z, 0.36, 0.18, 0.46, "darkMetal", { solid: false });
    chair(kit, x + 0.55, z, { rotY: 0 });
  }
  for (let k = 0; k < 4; k++) filingCabinet(kit, x1 - 0.35, -hw + 0.5 + k * 0.68 + (k > 1 ? 1.3 : 0), { rotY: 0, h: 1.4, mat: "paintGreen" });
  shelf(kit, x0 + 4.6, hw - 0.3, { rotY: 0, w: 2.2, d: 0.35, h: 2.0, levels: 4, mat: "steel",
    items: (_, y) => shelfLoad(kit, x0 + 4.6, hw - 0.3, y, { rotY: 0, w: 2.2, d: 0.35, mats: ["paper", "fabricBlue", "cardboard"], size: [0.28, 0.32, 0.08], gap: 0.01, rand }) });
  noticeBoard(kit, x0 + 0.03, 1.6, -hw + 0.6, { rotY: Math.PI / 2, w: 0.8, rand });
  kit.cyl(x1 - 0.04, 2.6, 1.6, 0.18, 0.05, "paper", { rotZ: Math.PI / 2, seg: 18, solid: false });
  finish(kit, station, spec, x0, x1, { lights: 2, intensity: 9 });
}

// --- Schools ------------------------------------------------------------------

function classroom(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The board across the far wall and the teacher's desk.
  wallPanel(kit, x1 - 0.03, 1.55, 0, 3.6, 1.2, "chalkboard");
  kit.span(x1 - 0.12, x1 - 0.02, 0.92, 0.96, -1.8, 1.8, "darkWood", { solid: false });
  for (let k = 0; k < 5; k++) kit.box(x1 - 0.04, 1.3 + rand() * 0.6, -1.4 + k * 0.6, 0.005, 0.02, 0.3, "paper", { solid: false });
  desk(kit, x1 - 1.4, -1.6, { rotY: 0, w: 1.4, mat: "paleWood", top: "paleWood" });
  personAt(group, x1 - 1.1, 0.6, -Math.PI / 2, "chat");
  chair(kit, x1 - 0.85, -1.6, { rotY: 0, seat: "paleWood", mat: "paleWood" });
  // Small desks in rows facing the board, the aisle kept on one side.
  for (let row = 0; row < 3; row++) for (const z of [-2.1, -0.9, 1.1, 2.2]) {
    const x = x0 + 1.6 + row * 1.15;
    kit.span(x - 0.25, x + 0.25, 0.58, 0.62, z - 0.35, z + 0.35, "paleWood");
    kit.span(x - 0.22, x + 0.22, 0, 0.58, z - 0.32, z - 0.28, "darkMetal", { solid: false });
    kit.span(x - 0.22, x + 0.22, 0, 0.58, z + 0.28, z + 0.32, "darkMetal", { solid: false });
    kit.span(x - 0.62, x - 0.32, 0.36, 0.4, z - 0.18, z + 0.18, "paleWood", { solid: false });
    kit.span(x - 0.64, x - 0.6, 0.4, 0.72, z - 0.18, z + 0.18, "paleWood", { solid: false });
  }
  // Drawings on the side walls, a shelf of books, the silo poster.
  const colours = ["paintRed", "paintBlue", "paintOrange", "fabricMustard", "paintTeal", "fabricGreen"];
  for (let k = 0; k < 6; k++) wallPanel(kit, x0 + 1.4 + k * 0.7, 1.9 + (k % 2) * 0.25, hw - 0.02, 0.45, 0.35, colours[k], { rotY: Math.PI });
  wallPanel(kit, x0 + 3.5, 1.8, -hw + 0.02, 0.8, 1.6, "paper", { rotY: 0 });
  for (let k = 0; k < 8; k++) kit.box(x0 + 3.5, 1.15 + k * 0.17, -hw + 0.04, 0.6 - Math.abs(k - 3.5) * 0.06, 0.12, 0.01, "darkConcrete", { solid: false });
  shelf(kit, x0 + 0.4, hw - 0.9, { rotY: Math.PI / 2, w: 1.0, d: 0.35, h: 1.4, levels: 4, mat: "paleWood",
    items: (_, y) => shelfLoad(kit, x0 + 0.4, hw - 0.9, y, { rotY: Math.PI / 2, w: 1.0, d: 0.35, mats: ["fabricRed", "fabricBlue", "fabricGreen", "paper"], size: [0.22, 0.25, 0.05], gap: 0.006, rand }) });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xfff0d0, intensity: 10 });
}

function nursery(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // Cribs along both walls.
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const x = x0 + 1.8 + i * 1.6, z = s * (hw - 0.55);
    kit.span(x - 0.6, x + 0.6, 0.35, 0.42, z - 0.35, z + 0.35, "paleWood");
    kit.span(x - 0.58, x + 0.58, 0.42, 0.52, z - 0.33, z + 0.33, "linen", { solid: false });
    for (let b = -0.55; b <= 0.56; b += 0.11) for (const e of [-0.34, 0.34]) kit.cyl(x + b, 0.55, z + e, 0.012, 0.5, "paleWood", { seg: 5, solid: false });
    for (const e of [-0.34, 0.34]) kit.span(x - 0.6, x + 0.6, 0.78, 0.82, z + e - 0.02, z + e + 0.02, "paleWood", { solid: false });
  }
  // A rug with blocks on it, the rocking chair, the linen shelf.
  kit.span(x1 - 2.6, x1 - 0.6, 0, 0.015, -1.0, 1.0, "fabricMustard", { solid: false });
  const blocks = ["paintRed", "paintBlue", "fabricGreen", "paintOrange"];
  for (let k = 0; k < 7; k++) kit.box(x1 - 2.3 + rand() * 1.4, 0.06, -0.7 + rand() * 1.4, 0.1, 0.1, 0.1, blocks[k % 4], { rotY: rand(), solid: false });
  kit.span(x1 - 0.9, x1 - 0.3, 0.38, 0.45, 1.6, 2.2, "darkWood");
  kit.span(x1 - 0.35, x1 - 0.3, 0.45, 1.1, 1.6, 2.2, "darkWood", { solid: false });
  shelf(kit, x1 - 0.3, -1.6, { rotY: 0, w: 1.2, d: 0.4, h: 1.8, levels: 4, mat: "paleWood",
    items: (_, y) => shelfLoad(kit, x1 - 0.3, -1.6, y, { rotY: 0, w: 1.2, d: 0.4, mats: ["linen", "fabricBlue", "linen"], size: [0.34, 0.16, 0.3], gap: 0.04, rand }) });
  pendant(kit, x0 + 3.4, 0, H, { drop: 0.7, shade: "paintCream" });
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xffe2b8, intensity: 9, panels: false });
}

// --- Farms --------------------------------------------------------------------

function seedbank(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The wall of small drawers across the back, labelled.
  kit.span(x1 - 0.55, x1 - 0.02, 0, 2.4, -hw + 0.1, hw - 0.1, "paleWood");
  for (let row = 0; row < 9; row++) for (let col = 0; col < 14; col++) {
    const z = -hw + 0.35 + col * ((2 * hw - 0.5) / 13);
    kit.box(x1 - 0.56, 0.2 + row * 0.25, z, 0.02, 0.2, 0.36, rand() < 0.08 ? "paintCream" : "darkWood", { solid: false });
    kit.box(x1 - 0.575, 0.25 + row * 0.25, z, 0.01, 0.05, 0.12, "paper", { solid: false });
  }
  // The sorting table: trays and jars.
  kit.span(x0 + 2.2, x0 + 4.8, 0, 0.88, -hw + 0.3, -hw + 1.2, "steel");
  for (let k = 0; k < 6; k++) kit.box(x0 + 2.45 + k * 0.4, 0.9, -hw + 0.75, 0.34, 0.04, 0.5, "cardboard", { solid: false });
  bottles(kit, x0 + 3.5, 0.88, -hw + 1.05, { count: 6, along: "x", spacing: 0.2, mats: ["glassDark", "paper", "ceramic"], rand });
  personAt(group, x0 + 3.5, -hw + 1.7, Math.PI, "work", { wear: "farm" });
  if (station.id === "rocas") relicAt(group, spec.interactables, "semente", x0 + 4.4, 0.92, -hw + 0.6);
  // A cold store.
  kit.span(x0 + 2.2, x0 + 3.5, 0, 2.1, hw - 0.8, hw - 0.05, "steel");
  kit.span(x0 + 2.18, x0 + 2.2, 0.2, 1.9, hw - 0.75, hw - 0.1, "darkMetal", { solid: false });
  gauge(kit, x0 + 2.16, 1.6, hw - 0.42, { r: 0.07 });
  for (const z of [-0.8, 0.8]) plant(kit, x0 + 4.2, 0, hw - 0.4 + z * 0, { s: 1.2 });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xf8f0dc, intensity: 9 });
}

function hydroponics(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.7);
    for (let tier = 0; tier < 3; tier++) {
      const y = 0.45 + tier * 0.82;
      kit.span(x0 + 0.8, x1 - 0.4, y, y + 0.12, z - 0.45, z + 0.45, "paintCream", { solid: tier === 0 });
      for (let x = x0 + 1.0; x < x1 - 0.5; x += 0.34) sprout(kit, x, y + 0.12, z + (rand() - 0.5) * 0.4, { h: 0.18 + rand() * 0.14, rand });
      kit.span(x0 + 0.85, x1 - 0.45, y + 0.68, y + 0.71, z - 0.25, z + 0.25, "glowGrow", { solid: false });
    }
    for (const x of [x0 + 0.8, x1 - 0.4]) kit.span(x - 0.03, x + 0.03, 0, 2.6, z - 0.47, z + 0.47, "steel", { solid: false });
    kit.rod([x0 + 0.7, 2.9, z], [x1 - 0.3, 2.9, z], 0.04, "paintBlue");
  }
  kit.cyl(x1 - 0.7, 0.7, 0, 0.5, 1.4, "paintBlue", { seg: 16 });
  personAt(group, x0 + 3.2, -0.9, Math.PI, "work", { wear: "farm" });
  kit.rod([x1 - 0.7, 1.4, 0], [x1 - 0.7, 2.9, 0], 0.04, "paintBlue");
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xf0d8ff, intensity: 9 });
}

// --- Trade --------------------------------------------------------------------

function tailor(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The cutting table, the sewing machine, rolls of cloth.
  kit.span(x0 + 2.4, x0 + 4.6, 0, 0.86, -0.7, 0.7, "paleWood");
  kit.box(x0 + 3.0, 0.88, 0.1, 0.9, 0.01, 0.7, "fabricBlue", { solid: false });
  kit.span(x1 - 1.6, x1 - 0.6, 0, 0.75, -hw + 0.3, -hw + 1.0, "darkWood");
  kit.box(x1 - 1.1, 0.92, -hw + 0.65, 0.5, 0.25, 0.2, "darkMetal", { solid: false });
  kit.box(x1 - 0.95, 1.02, -hw + 0.65, 0.2, 0.1, 0.15, "darkMetal", { solid: false });
  chair(kit, x1 - 1.1, -hw + 1.35, { rotY: -Math.PI / 2 });
  personAt(group, x1 - 1.1, -hw + 1.35, Math.PI, "sit");
  personAt(group, x0 + 3.5, 0.95, Math.PI, "work");
  if (station.id === "bazar") relicAt(group, spec.interactables, "retalho", x0 + 4.2, 0.88, -0.3);
  const cloth = ["fabricRed", "fabricBlue", "fabricGreen", "fabricMustard", "linen", "fabricGrey"];
  shelf(kit, x1 - 0.3, 1.3, { rotY: 0, w: 2.6, d: 0.45, h: 2.2, levels: 4, mat: "darkWood",
    items: (_, y, k) => { for (let i = 0; i < 7; i++) kit.cyl(x1 - 0.3, y + 0.1, 0.1 + i * 0.36, 0.09, 0.42, cloth[(i + k) % cloth.length], { rotX: Math.PI / 2, seg: 10, solid: false }); } });
  // A rail of finished coveralls and a dressmaker's form.
  kit.rod([x0 + 1.0, 1.9, hw - 0.4], [x0 + 3.8, 1.9, hw - 0.4], 0.02, "steel");
  for (let k = 0; k < 6; k++) kit.box(x0 + 1.2 + k * 0.45, 1.35, hw - 0.4, 0.05, 1.0, 0.5, cloth[k % cloth.length], { solid: false });
  kit.block(x0 + 2.3, hw - 0.4, 2.9, 0.56);
  kit.cyl(x0 + 1.4, 1.3, -hw + 0.8, 0.2, 0.6, "linen", { r2: 0.16, seg: 12 });
  kit.cyl(x0 + 1.4, 0.5, -hw + 0.8, 0.02, 1.0, "darkMetal", { seg: 6, solid: false });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffe0b0, intensity: 9 });
}

function bar(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The bar along one wall, stools in front, bottles on the shelves behind.
  kit.span(x0 + 1.5, x1 - 0.4, 0, 1.05, -hw + 0.85, -hw + 1.4, "darkWood");
  kit.span(x0 + 1.45, x1 - 0.35, 1.05, 1.1, -hw + 0.8, -hw + 1.45, "paleWood", { solid: false });
  for (let x = x0 + 1.9; x < x1 - 0.6; x += 0.75) {
    kit.cyl(x, 0.38, -hw + 1.75, 0.02, 0.76, "darkMetal", { seg: 6 });
    kit.cyl(x, 0.78, -hw + 1.75, 0.17, 0.06, "fabricRed", { seg: 12, solid: false });
  }
  for (const y of [1.3, 1.65, 2.0]) {
    kit.span(x0 + 1.5, x1 - 0.4, y, y + 0.03, -hw + 0.05, -hw + 0.35, "darkWood", { solid: false });
    bottles(kit, (x0 + x1) / 2 + 0.5, y + 0.03, -hw + 0.2, { count: 14, along: "x", spacing: 0.3, mats: ["glassDark", "brass", "copper", "ceramic"], rand });
  }
  personAt(group, x0 + 3.2, -hw + 0.6, 0, "work");
  for (const x of [x0 + 2.65, x0 + 4.15]) personAt(group, x, -hw + 1.75, Math.PI, "sit");
  // A copper still in the corner, and small tables.
  kit.cyl(x1 - 0.6, 0.6, hw - 0.6, 0.38, 1.2, "copper", { seg: 16 });
  kit.rod([x1 - 0.6, 1.2, hw - 0.6], [x1 - 0.6, 2.0, hw - 1.3], 0.04, "copper");
  for (const [x, z] of [[x0 + 2.2, 1.6], [x0 + 4.2, 1.8]]) {
    kit.cyl(x, 0.72, z, 0.42, 0.04, "darkWood", { seg: 16 });
    kit.cyl(x, 0.36, z, 0.05, 0.72, "darkMetal", { seg: 8 });
    for (const a of [0, 2.1, 4.2]) chair(kit, x + Math.cos(a) * 0.7, z + Math.sin(a) * 0.7, { rotY: -a, seat: "darkWood", mat: "darkWood" });
  }
  for (const x of [x0 + 2.2, x0 + 4.2]) pendant(kit, x, 1.7, H, { drop: 1.0, shade: "copper" });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffc888, intensity: 8, panels: false });
}

// --- Medical ------------------------------------------------------------------

function ward(group, station, x0, x1, hw, spec) {
  const { kit } = setup(group, station, spec);
  for (let i = 0; i < 2; i++) for (const s of [-1, 1]) {
    const x = x0 + 2.0 + i * 2.6, z = s * (hw - 1.1);
    kit.span(x - 0.48, x + 0.48, 0.3, 0.38, z - 1.0, z + 1.0, "steel");
    kit.span(x - 0.45, x + 0.45, 0.38, 0.52, z - 0.98, z + 0.98, "linen", { solid: false });
    kit.span(x - 0.3, x + 0.3, 0.52, 0.62, s > 0 ? z + 0.55 : z - 0.85, s > 0 ? z + 0.85 : z - 0.55, "ceramic", { solid: false });
    for (const e of [-0.95, 0.95]) kit.cyl(x - 0.45, 0.35, z + e, 0.02, 0.7, "steel", { seg: 6, solid: false });
    // Curtain on its rail, drawn back.
    kit.span(x + 0.65, x + 0.68, H - 0.4, H - 0.37, z - 1.1, z + 1.1, "steel", { solid: false });
    kit.span(x + 0.62, x + 0.7, 0.4, H - 0.42, s > 0 ? z - 1.1 : z + 0.6, s > 0 ? z - 0.6 : z + 1.1, "linen");
    // Drip stand and bedside cabinet.
    kit.cyl(x - 0.75, 0.9, z + s * 0.6, 0.015, 1.8, "steel", { seg: 6 });
    kit.box(x - 0.75, 1.65, z + s * 0.6, 0.1, 0.16, 0.06, "glassDark", { solid: false });
    kit.span(x - 0.95, x - 0.55, 0, 0.6, z - s * 0.2 - 0.2, z - s * 0.2 + 0.2, "paintCream");
  }
  kit.span(x1 - 1.4, x1 - 0.5, 0, 0.75, -0.6, 0.6, "paintCream");
  personAt(group, x1 - 1.9, 0, Math.PI / 2, "work", { wear: "medical" });
  kit.box(x1 - 0.95, 0.85, 0.2, 0.3, 0.1, 0.4, "paper", { solid: false });
  for (let x = x0 + 1.4; x < x1 - 0.8; x += 2.0) ceilingPanel(kit, x, 0, H, { w: 1.5, d: 0.3 });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xeef6f2, intensity: 10, panels: false });
}

function pharmacy(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The counter across the room, open at one end; shelves of jars behind.
  kit.span(x0 + 3.0, x0 + 3.55, 0, 1.0, -hw + 1.1, hw - 0.05, "paleWood");
  kit.span(x0 + 2.95, x0 + 3.6, 1.0, 1.05, -hw + 1.05, hw - 0.02, "darkWood", { solid: false });
  kit.box(x0 + 3.2, 1.1, 1.2, 0.3, 0.08, 0.3, "brass", { solid: false });
  kit.cyl(x0 + 3.3, 1.12, 0.2, 0.07, 0.12, "ceramic", { seg: 10, solid: false });
  personAt(group, x0 + 4.0, 0.6, -Math.PI / 2, "work", { wear: "medical" });
  if (station.id === "enfermaria") relicAt(group, spec.interactables, "frasco", x0 + 5.3, 0.88, -hw + 0.42);
  for (const s of [-1, 1]) shelf(kit, x1 - 0.3, s * 1.5, { rotY: 0, w: 2.6, d: 0.35, h: 2.3, levels: 6, mat: "darkWood",
    items: (_, y) => bottles(kit, x1 - 0.3, y, s * 1.5, { count: 14, along: "z", spacing: 0.17, mats: ["glassDark", "ceramic", "glassDark", "brass"], rand }) });
  // The drawer cabinet and a work table with the scales.
  kit.span(x0 + 4.4, x0 + 5.0, 0, 1.2, hw - 0.6, hw - 0.05, "darkWood");
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) kit.box(x0 + 4.39, 0.2 + r * 0.27, hw - 0.45 + c * 0.25, 0.01, 0.04, 0.1, "brass", { solid: false });
  kit.span(x0 + 4.3, x0 + 5.5, 0, 0.88, -hw + 0.1, -hw + 0.75, "paleWood");
  kit.cyl(x0 + 4.7, 0.95, -hw + 0.4, 0.1, 0.12, "ceramic", { seg: 10, solid: false });
  bottles(kit, x0 + 5.1, 0.88, -hw + 0.45, { count: 4, along: "x", spacing: 0.12, rand });
  kit.sign(["BOTICA", "RECEITA REGISTRADA EM TRÊS LIVROS"], { x: x1 - 0.03, y: 2.8, z: 0, w: 1.5, h: 0.4, fg: 0x2a2d31, bg: 0xd8e4dc });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xf0f4ee, intensity: 9 });
}

// --- Water --------------------------------------------------------------------

function pumps(group, station, x0, x1, hw, spec) {
  const { kit } = setup(group, station, spec);
  for (const s of [-1, 1]) {
    const z = s * (hw - 1.1);
    kit.span(x0 + 1.6, x0 + 5.4, 0, 0.25, z - 0.7, z + 0.7, "darkConcrete");
    kit.cyl(x0 + 3.0, 0.85, z, 0.55, 1.6, "paintBlue", { rotZ: Math.PI / 2, seg: 18 });
    kit.cyl(x0 + 4.6, 0.75, z, 0.42, 1.0, "paintTeal", { rotZ: Math.PI / 2, seg: 16 });
    for (const x of [x0 + 2.3, x0 + 3.0, x0 + 3.7]) kit.torus(x, 0.85, z, 0.57, 0.03, "darkMetal", { rotY: Math.PI / 2, seg: 18 });
    // Discharge pipe up through the ceiling, with its valve wheel and gauge.
    kit.rod([x0 + 2.4, 1.4, z], [x0 + 2.4, H, z], 0.16, "paintBlue", { solid: true });
    kit.torus(x0 + 2.4, 2.1, z - s * 0.25, 0.22, 0.025, "paintRed", { seg: 16 });
    kit.rod([x0 + 2.4, 2.1, z], [x0 + 2.4, 2.1, z - s * 0.25], 0.025, "darkMetal");
    gauge(kit, x0 + 2.2, 1.8, z, { r: 0.1 });
  }
  personAt(group, x0 + 1.6, 0.4, Math.PI / 2, "work", { wear: "mechanical" });
  // The main along the back wall and puddles under it.
  kit.rod([x1 - 0.3, 0.5, -hw + 0.2], [x1 - 0.3, 0.5, hw - 0.2], 0.24, "paintBlue");
  for (const z of [-1.4, 0, 1.4]) kit.torus(x1 - 0.3, 0.5, z, 0.25, 0.035, "darkMetal", { rotY: 0, seg: 16 });
  kit.span(x1 - 0.55, x1 - 0.05, 0, 0.9, -hw + 0.1, hw - 0.1, "darkConcrete", { solid: true });
  kit.span(x1 - 1.6, x1 - 0.6, 0.004, 0.008, -0.5, 0.6, "glassDark", { solid: false });
  conduit(kit, x0, x1, 2.95, -hw + 0.05);
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xd8f0f2, intensity: 9 });
}

function lab(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.4);
    kit.span(x0 + 1.4, x1 - 0.8, 0, 0.9, z - 0.35, z + 0.35, "paintCream");
    kit.span(x0 + 1.38, x1 - 0.78, 0.9, 0.94, z - 0.37, z + 0.37, "darkConcrete", { solid: false });
    bottles(kit, x0 + 2.8, 0.94, z, { count: 9, along: "x", spacing: 0.18, mats: ["glassDark", "ceramic"], rand });
    kit.span(x0 + 4.2, x0 + 4.8, 0.85, 0.95, z - 0.25, z + 0.25, "steel", { solid: false });
    shelf(kit, x0 + 3.2, s * (hw - 0.15), { rotY: Math.PI / 2, w: 2.4, d: 0.22, h: 0.8, levels: 3, mat: "steel" });
  }
  personAt(group, x0 + 2.8, hw - 1.0, 0, "work", { wear: "medical" });
  // The filter column and its sample rack.
  kit.cyl(x1 - 0.8, 1.3, 0, 0.35, 2.6, "glassDark", { seg: 16 });
  for (const y of [0.2, 1.3, 2.5]) kit.torus(x1 - 0.8, y, 0, 0.36, 0.03, "steel", { rotX: Math.PI / 2, seg: 18 });
  kit.rod([x1 - 0.8, 2.6, 0], [x1 - 0.8, H, 0], 0.06, "steel");
  kit.cyl(x0 + 5.3, 1.05, -hw + 0.4, 0.05, 0.25, "darkMetal", { seg: 8, solid: false });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xe8f4f4, intensity: 10 });
}

// --- IT -----------------------------------------------------------------------

function servers(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  kit.span(x0, x1, 0.0, 0.05, -hw, hw, "darkMetal", { solid: false });
  for (const s of [-1, 1]) {
    const z = s * (hw - 0.75);
    for (let i = 0; i < 5; i++) {
      const x = x0 + 1.2 + i * 0.95;
      kit.span(x - 0.42, x + 0.42, 0, 2.2, z - 0.4, z + 0.4, "paintCream");
      // Lamps down the face towards the aisle.
      for (let r = 0; r < 10; r++) kit.box(x + (rand() - 0.5) * 0.6, 0.4 + r * 0.17, z - s * 0.405, 0.04, 0.025, 0.01, rand() < 0.6 ? "glowGreen" : rand() < 0.5 ? "glowAmber" : "glowRed", { solid: false });
      // Tape reels on every other one.
      if (i % 2 === 0) for (const dy of [0, 0.42]) kit.cyl(x, 1.45 + dy, z - s * 0.41, 0.16, 0.02, "darkMetal", { rotX: Math.PI / 2, seg: 16, solid: false });
    }
    kit.span(x0 + 0.7, x1 - 0.9, 2.6, 2.65, z - 0.25, z + 0.25, "steel", { solid: false });
  }
  kit.span(x1 - 1.0, x1 - 0.1, 0, 0.75, -0.8, 0.8, "paintGreen");
  terminal(kit, x1 - 0.5, 0.78, 0, { rotY: 0, glow: "glowGreen" });
  chair(kit, x1 - 1.4, 0, { rotY: Math.PI });
  personAt(group, x1 - 1.4, 0, Math.PI / 2, "sit", { wear: "it" });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xcfe8ff, intensity: 8 });
}

function radio(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The long console on the far wall: sets, dials, microphones.
  kit.span(x1 - 0.9, x1 - 0.05, 0, 0.78, -hw + 0.2, hw - 0.2, "paintGreen");
  for (let k = 0; k < 5; k++) {
    const z = -hw + 0.7 + k * 1.2;
    kit.box(x1 - 0.4, 1.05, z, 0.5, 0.52, 0.9, k % 2 ? "paintOlive" : "darkMetal", { solid: false });
    for (let d = 0; d < 3; d++) gauge(kit, x1 - 0.66, 1.12, z - 0.28 + d * 0.28, { r: 0.07 });
    kit.box(x1 - 0.66, 0.9, z, 0.02, 0.03, 0.6, "glowAmber", { solid: false });
    kit.cyl(x1 - 0.75, 0.86, z + 0.35, 0.03, 0.16, "darkMetal", { seg: 6, solid: false });
    chair(kit, x1 - 1.35, z, { rotY: Math.PI });
  }
  personAt(group, x1 - 1.35, -hw + 1.9, Math.PI / 2, "sit", { wear: "it" });
  // Reel-to-reel recorders and the patch board on the side wall.
  for (const z of [-0.6, 0.6]) {
    kit.span(x0 + 2.2, x0 + 2.8, 0, 1.3, hw - 0.55 + 0, hw - 0.05, "paintCream");
    for (const dy of [0, 0.38]) kit.cyl(x0 + 2.5 + z * 0.15, 1.5 + dy, hw - 0.3, 0.15, 0.02, "darkMetal", { seg: 16, solid: false });
  }
  wallPanel(kit, x0 + 4.2, 1.7, -hw + 0.03, 1.6, 1.2, "darkMetal", { rotY: 0 });
  for (let k = 0; k < 8; k++) kit.rod([x0 + 3.55 + rand() * 1.3, 2.1, -hw + 0.08], [x0 + 3.55 + rand() * 1.3, 1.3, -hw + 0.12], 0.008, k % 2 ? "paintRed" : "fabricMustard");
  conduit(kit, x0, x1, 2.95, hw - 0.05);
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xffe6c4, intensity: 9 });
}

// --- Machinery ----------------------------------------------------------------

function workshop(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // Bench along one wall with a vice; tools on the board above.
  kit.span(x0 + 1.4, x1 - 0.6, 0, 0.9, -hw + 0.05, -hw + 0.8, "darkWood");
  kit.box(x0 + 2.2, 1.0, -hw + 0.55, 0.2, 0.2, 0.3, "paintBlue", { solid: false });
  wallPanel(kit, x0 + 3.6, 1.7, -hw + 0.02, 2.6, 1.0, "paleWood", { rotY: 0 });
  for (let k = 0; k < 14; k++) kit.box(x0 + 2.45 + (k % 7) * 0.33, 1.5 + Math.floor(k / 7) * 0.42, -hw + 0.05, 0.04, 0.22 + rand() * 0.12, 0.02, k % 3 ? "steel" : "paintRed", { rotZ: (rand() - 0.5) * 0.3, solid: false });
  personAt(group, x0 + 2.6, -hw + 1.25, Math.PI, "work", { wear: "mechanical" });
  // A lathe and a drill press.
  kit.span(x0 + 2.0, x0 + 4.0, 0, 0.85, hw - 1.2, hw - 0.4, "paintGreen");
  kit.span(x0 + 2.0, x0 + 2.5, 0.85, 1.35, hw - 1.1, hw - 0.5, "paintGreen", { solid: false });
  kit.cyl(x0 + 3.0, 1.05, hw - 0.8, 0.06, 1.3, "steel", { rotZ: Math.PI / 2, seg: 8, solid: false });
  kit.cyl(x1 - 1.0, 0.1, hw - 0.6, 0.3, 0.2, "darkMetal", { seg: 10 });
  kit.cyl(x1 - 1.0, 0.95, hw - 0.6, 0.05, 1.7, "darkMetal", { seg: 8 });
  kit.span(x1 - 1.25, x1 - 0.7, 1.55, 1.95, hw - 0.85, hw - 0.35, "paintGreen", { solid: false });
  // A chain hoist from the ceiling, parts bins and an oil drum.
  kit.rod([x0 + 4.6, H, 0.6], [x0 + 4.6, 2.2, 0.6], 0.015, "darkMetal");
  kit.box(x0 + 4.6, 2.12, 0.6, 0.12, 0.14, 0.08, "paintOrange", { solid: false });
  for (let k = 0; k < 4; k++) kit.box(x1 - 0.35, 0.3 + k * 0.35, -1.2, 0.45, 0.28, 1.2, k % 2 ? "paintBlue" : "paintRed");
  barrel(kit, x0 + 0.6, hw - 0.5, { mat: "paintRed" });
  kit.span(x0 + 3.4, x0 + 4.6, 0.003, 0.006, -0.6, 0.4, "rubber", { solid: false });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffd9a8, intensity: 10 });
}

function parts(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const x = x0 + 2.1 + i * 2.3;
    shelf(kit, x, s * (hw - 0.3), { rotY: 0, w: 2.0, d: 0.5, h: 2.4, levels: 5, mat: "paintOlive",
      items: (_, y) => shelfLoad(kit, x, s * (hw - 0.3), y, { rotY: 0, w: 2.0, d: 0.5, mats: ["paintBlue", "paintRed", "cardboard", "steel", "rust"], size: [0.4, 0.22, 0.28], gap: 0.04, rand }) });
  }
  // The issue window: a cage across the far end with a counter.
  bars(kit, x1 - 1.8, -hw + 0.05, -0.6, { h: H - 0.1 });
  bars(kit, x1 - 1.8, 0.6, hw - 0.05, { h: H - 0.1 });
  kit.span(x1 - 2.0, x1 - 1.6, 0, 1.0, -0.6, 0.6, "darkWood");
  personAt(group, x1 - 1.2, 0, -Math.PI / 2, "work");
  if (station.id === "mecanica") relicAt(group, spec.interactables, "isqueiro", x1 - 1.8, 1.0, 0.3);
  kit.span(x1 - 1.8, x1 - 1.75, 1.0, H - 0.1, -0.6, -0.55, "darkMetal", { solid: false });
  kit.span(x1 - 1.8, x1 - 1.75, 1.0, H - 0.1, 0.55, 0.6, "darkMetal", { solid: false });
  for (let k = 0; k < 4; k++) crate(kit, x1 - 0.8, (k % 2) * 0.6, -hw + 0.6 + Math.floor(k / 2) * 0.7, { s: 0.6, solid: true });
  barrel(kit, x1 - 0.6, hw - 0.6, { mat: "paintBlue" });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffe6c0, intensity: 9 });
}

function control(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The panel wall across the far end, gauges and lamps in rows.
  kit.span(x1 - 0.45, x1 - 0.02, 0, H - 0.3, -hw + 0.1, hw - 0.1, "paintGreen");
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
    gauge(kit, x1 - 0.47, 1.25 + row * 0.42, -hw + 0.55 + col * 0.75, { r: 0.13 });
    kit.box(x1 - 0.46, 1.04 + row * 0.42, -hw + 0.55 + col * 0.75, 0.02, 0.04, 0.08, rand() < 0.2 ? "glowRed" : rand() < 0.4 ? "glowAmber" : "glowGreen", { solid: false });
  }
  kit.span(x1 - 0.47, x1 - 0.45, 2.95, 3.0, -hw + 0.2, hw - 0.2, "glowAmber", { solid: false });
  // Two sloped desks facing it, chairs, the log on its stand.
  controlDesk(kit, x1 - 2.0, -1.3, { w: 2.2, rand });
  controlDesk(kit, x1 - 2.0, 1.4, { w: 2.0, rand });
  chair(kit, x1 - 2.7, -1.3, { rotY: Math.PI });
  chair(kit, x1 - 2.7, 1.4, { rotY: Math.PI });
  personAt(group, x1 - 2.7, -1.3, Math.PI / 2, "sit", { wear: "mechanical" });
  kit.span(x0 + 1.4, x0 + 2.0, 0, 1.1, -hw + 0.2, -hw + 0.8, "darkWood");
  kit.box(x0 + 1.7, 1.13, -hw + 0.5, 0.42, 0.05, 0.32, "paper", { rotX: -0.2, solid: false });
  noticeBoard(kit, x0 + 0.03, 1.6, hw - 0.6, { rotY: Math.PI / 2, w: 0.8, rand });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffd6a0, intensity: 8 });
}

function lockers(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  const mine = station.isSublevel;
  for (const s of [-1, 1]) locker(kit, x0 + 3.5, s * (hw - 0.27), { rotY: s > 0 ? Math.PI / 2 : -Math.PI / 2, count: 9, mat: mine ? "paintOlive" : "paintBlue" });
  bench(kit, x0 + 3.5, -0.9, { rotY: Math.PI / 2, len: 3.0 });
  bench(kit, x0 + 3.5, 0.9, { rotY: Math.PI / 2, len: 3.0 });
  personAt(group, x0 + 3.0, -0.9, Math.PI, "sit", { wear: "mechanical" });
  if (mine) {
    // The lamp room: cap lamps charging in their rack, their lights amber.
    kit.span(x1 - 0.5, x1 - 0.05, 0, 2.2, -hw + 0.3, hw - 0.3, "darkMetal");
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {
      kit.cyl(x1 - 0.55, 0.6 + r * 0.42, -hw + 0.6 + c * 0.55, 0.07, 0.1, "paintCream", { rotZ: Math.PI / 2, seg: 10, solid: false });
      kit.box(x1 - 0.6, 0.5 + r * 0.42, -hw + 0.6 + c * 0.55, 0.01, 0.03, 0.03, rand() < 0.7 ? "glowGreen" : "glowAmber", { solid: false });
    }
  } else {
    for (let k = 0; k < 5; k++) {
      const z = -hw + 0.6 + k * 1.2;
      kit.box(x1 - 0.12, 1.3, z, 0.1, 1.1, 0.5, k % 2 ? "paintOrange" : "fabricBlue", { solid: false });
      kit.cyl(x1 - 0.2, 2.05, z, 0.14, 0.12, "paintOrange", { seg: 10, solid: false });
    }
  }
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xfff0d0, intensity: 9 });
}

function minestores(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  for (let k = 0; k < 6; k++) crate(kit, x0 + 1.6 + (k % 3) * 0.75, Math.floor(k / 3) * 0.7, -hw + 0.6, { s: 0.7, mat: "paleWood" });
  for (let k = 0; k < 3; k++) barrel(kit, x1 - 0.6, -hw + 0.6 + k * 0.7, { mat: k % 2 ? "rust" : "paintRed" });
  // An ore cart on its rail, a heap of ore, picks and props.
  for (const z of [0.9, 1.6]) kit.span(x0 + 0.4, x1 - 0.3, 0, 0.08, z - 0.04, z + 0.04, "steel", { solid: false });
  kit.span(x0 + 3.4, x0 + 4.8, 0.3, 1.1, 0.7, 1.8, "rust");
  kit.span(x0 + 3.5, x0 + 4.7, 1.1, 1.3, 0.8, 1.7, "rock", { solid: false });
  for (let k = 0; k < 7; k++) kit.box(x1 - 1.1 + rand() * 0.6, 0.15 + rand() * 0.25, 1.9 + rand() * 0.8, 0.35, 0.3, 0.35, "rock", { rotY: rand() * 3, solid: k === 0 });
  for (let k = 0; k < 4; k++) kit.rod([x0 + 0.3, 0.1, hw - 0.4 - k * 0.25], [x0 + 0.15, 1.3, hw - 0.4 - k * 0.25], 0.025, "darkWood");
  for (const x of [x0 + 2.0, x1 - 1.4]) {
    for (const s of [-1, 1]) kit.cyl(x, H / 2, s * (hw - 0.2), 0.14, H, "darkWood", { seg: 8 });
    kit.span(x - 0.15, x + 0.15, H - 0.3, H - 0.05, -hw + 0.05, hw - 0.05, "darkWood", { solid: false });
  }
  for (const x of [x0 + 2.4, x1 - 1.8]) pendant(kit, x, 0, H, { drop: 0.5, glow: "glowAmber" });
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xffb070, intensity: 9, panels: false });
}

function survey(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The map table, tripods with instruments, instrument crates.
  kit.span(x0 + 2.4, x0 + 4.4, 0, 0.85, -0.8, 0.8, "darkWood");
  kit.box(x0 + 3.4, 0.86, 0, 1.8, 0.01, 1.4, "paper", { solid: false });
  for (let k = 0; k < 9; k++) kit.box(x0 + 2.7 + rand() * 1.4, 0.87, -0.5 + rand() * 1.0, 0.3, 0.003, 0.004, "darkMetal", { rotY: rand() * 3, solid: false });
  for (const [x, z] of [[x1 - 1.2, -1.6], [x1 - 1.4, 1.7]]) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      kit.rod([x + Math.cos(a) * 0.4, 0, z + Math.sin(a) * 0.4], [x, 1.35, z], 0.018, "paleWood");
    }
    kit.box(x, 1.45, z, 0.3, 0.18, 0.18, "brass", { solid: false });
    kit.cyl(x - 0.18, 1.48, z, 0.05, 0.2, "brass", { rotZ: Math.PI / 2, seg: 10, solid: false });
    kit.box(x, 0.7, z, 0.5, 1.4, 0.5, "brass", { solid: true });
  }
  for (let k = 0; k < 4; k++) crate(kit, x0 + 0.9 + k * 0.7, 0, hw - 0.5, { s: 0.55, mat: "paintOlive" });
  kit.sign(["LEVANTAMENTO", "NÃO CONSTA NO PACTO"], { x: x1 - 0.03, y: 2.2, z: 0, w: 1.3, h: 0.36, fg: 0x9ab0a8, bg: 0x14181a });
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xcfe0da, intensity: 8 });
}

function splice(group, station, x0, x1, hw, spec) {
  const { kit } = setup(group, station, spec);
  // The silo's cables come in along the walls and end in a bank of boxes.
  kit.span(x1 - 0.6, x1 - 0.05, 0, 2.6, -hw + 0.3, hw - 0.3, "darkMetal");
  for (let k = 0; k < 6; k++) {
    const z = -hw + 0.7 + k * 0.95;
    kit.span(x1 - 0.66, x1 - 0.6, 0.4, 2.3, z - 0.4, z + 0.4, "paintOlive", { solid: false });
    kit.box(x1 - 0.68, 2.0, z, 0.01, 0.1, 0.3, "paper", { solid: false });
    kit.rod([x0 + 0.3, 2.95 - k * 0.07, s(k) * (hw - 0.1)], [x1 - 0.7, 2.95 - k * 0.07, s(k) * (hw - 0.1)], 0.05, "rubber");
    kit.rod([x1 - 0.7, 2.95 - k * 0.07, s(k) * (hw - 0.1)], [x1 - 0.7, 1.6, z], 0.05, "rubber");
  }
  // The one that does not end here: out through the far wall, tagged.
  kit.rod([x0 + 0.3, 0.3, 0.3], [x1 - 0.05, 0.3, 0.3], 0.09, "paintTeal", { solid: true });
  kit.box(x1 - 1.2, 0.45, 0.3, 0.08, 0.14, 0.1, "glowRed", { solid: false });
  kit.sign(["NÃO ALIMENTA NADA", "NESTE SILO"], { x: x1 - 0.03, y: 2.95, z: 0, w: 1.0, h: 0.3, fg: 0xc8481c, bg: 0x140c0a });
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xffb88a, intensity: 8 });
  function s(k) { return k % 2 ? 1 : -1; }
}

// --- Homes --------------------------------------------------------------------

function mess(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  // The long table with its benches, the kettle counter, the rug.
  kit.span(x0 + 1.6, x1 - 1.3, 0.74, 0.79, -0.95, -0.05, "paleWood");
  for (const x of [x0 + 1.8, x1 - 1.5]) kit.span(x - 0.05, x + 0.05, 0, 0.74, -0.9, -0.1, "darkWood");
  for (const z of [-1.55, 0.55]) kit.span(x0 + 1.6, x1 - 1.3, 0.42, 0.47, z - 0.17, z + 0.17, "paleWood");
  for (let k = 0; k < 6; k++) kit.cyl(x0 + 2.0 + k * 0.55, 0.83, -0.5 + (k % 2) * 0.25, 0.04, 0.09, "ceramic", { seg: 8, solid: false });
  for (const [x, z, yaw] of [[x0 + 2.2, -1.55, 0], [x0 + 3.4, -1.55, 0], [x0 + 2.8, 0.55, Math.PI], [x0 + 4.4, 0.55, Math.PI]]) personAt(group, x, z, yaw, "sit");
  kit.span(x1 - 0.65, x1 - 0.05, 0, 0.9, -hw + 0.1, hw - 1.0, "paintCream");
  kit.span(x1 - 0.68, x1 - 0.02, 0.9, 0.95, -hw + 0.08, hw - 0.98, "darkWood", { solid: false });
  kit.cyl(x1 - 0.35, 1.05, -1.2, 0.11, 0.2, "steel", { seg: 10, solid: false });
  shelf(kit, x1 - 0.2, 1.0, { rotY: 0, w: 1.2, d: 0.3, h: 2.0, levels: 4, mat: "darkWood",
    items: (_, y) => bottles(kit, x1 - 0.2, y, 1.0, { count: 6, along: "z", spacing: 0.18, mats: ["ceramic", "terracotta", "glassDark"], rand }) });
  kit.span(x0 + 1.4, x1 - 1.1, 0.002, 0.012, hw - 1.6, hw - 0.4, "terracotta", { solid: false });
  for (const [x, z] of [[x0 + 0.6, hw - 0.5], [x1 - 0.5, hw - 0.5]]) plant(kit, x, 0, z, { s: 1.6 });
  for (let k = 0; k < 3; k++) wallPanel(kit, x0 + 2.0 + k * 1.3, 1.85, hw - 0.02, 0.7, 0.5, ["paintRed", "paintTeal", "fabricMustard"][k], { rotY: Math.PI });
  for (const x of [x0 + 2.5, x1 - 2.3]) pendant(kit, x, -0.5, H, { drop: 0.9, shade: "terracotta" });
  finish(kit, station, spec, x0, x1, { lights: 2, color: 0xffc98a, intensity: 8, panels: false });
}

function storage(group, station, x0, x1, hw, spec) {
  const { kit, rand } = setup(group, station, spec);
  for (const s of [-1, 1]) {
    const x = x0 + 3.2;
    shelf(kit, x, s * (hw - 0.3), { rotY: 0, w: 4.2, d: 0.5, h: 2.4, levels: 5, mat: "steel",
      items: (_, y) => shelfLoad(kit, x, s * (hw - 0.3), y, { rotY: 0, w: 4.2, d: 0.5, mats: ["cardboard", "cardboard", "paleWood", "paintBlue", "fabricGrey"], size: [0.42, 0.32, 0.42], gap: 0.05, rand }) });
  }
  for (let k = 0; k < 3; k++) crate(kit, x1 - 0.9, k === 2 ? 0.7 : 0, -0.5 + (k % 2) * 0.8, { s: 0.7 });
  for (let k = 0; k < 2; k++) barrel(kit, x1 - 0.5, 1.6 + k * 0.7, { mat: k ? "paintBlue" : "rust" });
  // A hand cart in the aisle, against one side.
  kit.span(x0 + 1.4, x0 + 2.2, 0.2, 0.26, 0.8, 1.4, "steel");
  kit.span(x0 + 1.4, x0 + 1.45, 0.26, 1.0, 0.8, 1.4, "steel", { solid: false });
  for (const z of [0.85, 1.35]) kit.cyl(x0 + 2.1, 0.1, z, 0.1, 0.05, "rubber", { rotX: Math.PI / 2, seg: 10, solid: false });
  crate(kit, x0 + 1.85, 0.26, 1.1, { s: 0.5, mat: "cardboard", solid: false });
  finish(kit, station, spec, x0, x1, { lights: 1, color: 0xfff0d8, intensity: 9 });
}

export const SIDE_ROOM_BUILDERS = {
  police, airlock, cells, deputy, archive, office, classroom, nursery, seedbank, hydroponics, tailor, bar, ward, pharmacy,
  pumps, lab, servers, radio, workshop, parts, control, lockers, minestores, survey, splice, mess, storage,
};
