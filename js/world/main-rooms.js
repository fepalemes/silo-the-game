import * as THREE from "three";
import { WORLD } from "../config.js";
import { makeGrateTexture, mulberry32 } from "../textures.js";
import { addBox } from "./primitives.js";
import {
  Kit, barrel, bench, bottles, ceilingPanel, chair, conduit, controlDesk, crate, desk, filingCabinet, gauge,
  kitMaterial, noticeBoard, pendant, personAt, plant, shelf, shelfLoad, sprout, terminal, wallPanel,
} from "./kit.js";

// The departments' own rooms (wing 0), furnished from the same kit as their
// side rooms (rooms.js): they were a handful of coloured boxes each. Same
// frame: x out along the corridor from x0 to x1, z across within +-hw. Each
// keeps an aisle clear from the corridor's mouth to the far end.

const H = WORLD.roomHeight;

function start(group, station) {
  return { kit: new Kit(group), rand: mulberry32((station.level * 104729) >>> 0) };
}
function lights(kit, x0, x1, color, n = 2, intensity = 11) {
  for (let i = 0; i < n; i++) kit.light(x0 + ((i + 0.5) * (x1 - x0)) / n, H - 0.45, 0, color, intensity, 14);
}

// The hearing room of the Pact: the bench raised at the far end, the lectern
// facing it, the public on benches either side of the aisle, the book itself
// under its lamp, the seal on the wall.
function judicial(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  kit.span(x1 - 2.4, x1, 0, 0.4, -hw + 0.3, hw - 0.3, "darkWood");
  kit.span(x1 - 2.2, x1 - 1.6, 0.4, 1.45, -3.2, 3.2, "darkWood");
  kit.span(x1 - 2.25, x1 - 1.55, 1.45, 1.52, -3.3, 3.3, "paleWood", { solid: false });
  for (const z of [-1.6, 0, 1.6]) {
    kit.span(x1 - 1.1, x1 - 0.6, 0.4, 0.88, z - 0.3, z + 0.3, "fabricRed", { solid: false });
    kit.span(x1 - 0.7, x1 - 0.6, 0.88, 2.3, z - 0.3, z + 0.3, "fabricRed", { solid: false });
  }
  // The seal: a disc with rays, on the back wall over the bench.
  kit.cyl(x1 - 0.05, 2.65, 0, 0.62, 0.06, "brass", { rotZ: Math.PI / 2, seg: 32, solid: false });
  kit.cyl(x1 - 0.09, 2.65, 0, 0.46, 0.02, "darkWood", { rotZ: Math.PI / 2, seg: 32, solid: false });
  for (let k = 0; k < 12; k++) kit.box(x1 - 0.1, 2.65 + Math.sin((k / 12) * Math.PI * 2) * 0.28, Math.cos((k / 12) * Math.PI * 2) * 0.28, 0.01, 0.04, 0.26, "brass", { rotX: (k / 12) * Math.PI * 2, solid: false });
  // Lectern and the book.
  kit.span(x1 - 4.3, x1 - 3.8, 0, 1.15, -0.35, 0.35, "darkWood");
  kit.box(x1 - 4.05, 1.2, 0, 0.42, 0.06, 0.6, "fabricRed", { rotZ: 0.25, solid: false });
  kit.box(x1 - 4.05, 1.25, 0, 0.32, 0.04, 0.46, "paper", { rotZ: 0.25, solid: false });
  pendant(kit, x1 - 4.05, 0, H, { drop: 1.2, shade: "brass" });
  // Benches for the public, either side of the aisle.
  for (let row = 0; row < 4; row++) for (const s of [-1, 1]) {
    const x = x0 + 1.6 + row * 1.3;
    kit.span(x - 0.2, x + 0.2, 0.42, 0.47, s * 1.3, s * (hw - 0.4), "darkWood");
    kit.span(x - 0.24, x - 0.18, 0.47, 0.95, s * 1.3, s * (hw - 0.4), "darkWood", { solid: false });
  }
  // Panelling and the strips of the sector's own light.
  for (const s of [-1, 1]) {
    kit.span(x0 + 0.2, x1 - 0.2, 0, 1.2, s * (hw - 0.04), s * hw, "darkWood", { solid: false });
    kit.span(x0 + 0.2, x1 - 0.2, 1.2, 1.25, s * (hw - 0.07), s * hw, "brass", { solid: false });
  }
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) kit.box(x0 + 2 + i * 3.4, H - 0.12, s * (hw - 0.2), 1.4, 0.08, 0.12, "glowRed", { solid: false });
  personAt(group, x1 - 0.85, 0, -Math.PI / 2, "sit", { dy: 0.4, wear: "judicial" });
  for (const [row, s] of [[0, -1], [1, 1], [2, -1], [3, 1]]) personAt(group, x0 + 1.6 + row * 1.3, s * 2.6, Math.PI / 2, "sit");
  lights(kit, x0, x1, station.light, 2, 9);
  kit.finish();
}

// The deputies' front office: a counter with its gate, desks, the radio and
// the call-sign chart, the wanted board, the level map.
function ninho(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  kit.span(x0 + 2.4, x0 + 2.9, 0, 1.05, -hw + 0.05, -0.8, "darkWood");
  kit.span(x0 + 2.4, x0 + 2.9, 0, 1.05, 0.8, hw - 0.05, "darkWood");
  kit.span(x0 + 2.35, x0 + 2.95, 1.05, 1.1, -hw + 0.02, hw - 0.02, "paleWood", { solid: false });
  kit.box(x0 + 2.65, 0.55, -0.4, 0.05, 0.9, 0.78, "darkWood", { solid: false });
  for (const [x, z] of [[x0 + 4.6, -2.4], [x0 + 4.6, 2.4], [x0 + 7.2, -2.4]]) {
    desk(kit, x, z, { rotY: 0, w: 1.5 });
    terminal(kit, x + 0.1, 0.77, z + (z < 0 ? -0.35 : 0.35), { rotY: Math.PI });
    chair(kit, x + 0.6, z, { rotY: 0 });
  }
  // The radio, with the deputy-station call signs over it.
  kit.span(x1 - 0.8, x1 - 0.05, 0, 0.8, 1.2, hw - 0.2, "paintGreen");
  kit.box(x1 - 0.45, 1.05, 2.4, 0.5, 0.5, 1.0, "paintOlive", { solid: false });
  for (let k = 0; k < 3; k++) gauge(kit, x1 - 0.71, 1.12, 2.1 + k * 0.3, { r: 0.07 });
  kit.sign(["DELEGACIAS · 1 18 36 54 69 87 105 123 141", "CANAL 1 · EMERGÊNCIA 5"], { x: x1 - 0.03, y: 2.1, z: 2.4, w: 1.9, h: 0.5, fg: 0x2a2d31, bg: 0xb9b49a });
  noticeBoard(kit, x1 - 0.03, 1.7, -1.6, { rotY: -Math.PI / 2, w: 1.6, h: 1.0, rand });
  for (let k = 0; k < 3; k++) filingCabinet(kit, x0 + 0.55, -hw + 0.35 + k * 0.66, { rotY: Math.PI, h: 1.3 });
  bench(kit, x0 + 1.3, hw - 0.35, { rotY: Math.PI / 2, len: 1.8 });
  kit.cyl(x1 - 0.5, 0.9, -hw + 0.4, 0.03, 1.8, "darkWood", { seg: 6 });
  kit.box(x1 - 0.5, 1.6, -hw + 0.4, 0.3, 0.55, 0.3, "fabricGrey", { solid: false });
  personAt(group, x0 + 3.3, 1.6, -Math.PI / 2, "work", { character: "delegada", wear: "law" });
  personAt(group, x0 + 5.2, -2.4, -Math.PI / 2, "sit", { wear: "law" });
  personAt(group, x0 + 1.3, hw - 0.35, Math.PI, "sit");
  lights(kit, x0, x1, 0xffe2b8, 2, 10);
  for (const x of [x0 + 3.5, x0 + 7]) ceilingPanel(kit, x, 0, H, { w: 1.4 });
  kit.finish();
}

// The school: small round tables and chairs, cubbies, the rug, the board,
// and the sky painted on a wall by people who have never seen one.
function creche(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  const colours = ["paintRed", "paintBlue", "paintOrange", "fabricMustard", "paintTeal", "fabricGreen"];
  for (const [x, z] of [[x0 + 2.4, -2.4], [x0 + 2.4, 2.4], [x0 + 5.4, -2.4], [x0 + 5.4, 2.4]]) {
    kit.cyl(x, 0.55, z, 0.62, 0.04, "paleWood", { seg: 18 });
    kit.cyl(x, 0.27, z, 0.05, 0.54, "darkMetal", { seg: 8, solid: false });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4, cx = x + Math.cos(a) * 0.85, cz = z + Math.sin(a) * 0.85;
      kit.box(cx, 0.32, cz, 0.32, 0.04, 0.32, colours[(k + Math.round(x)) % colours.length], { solid: false });
      kit.box(cx + Math.cos(a) * 0.15, 0.5, cz + Math.sin(a) * 0.15, 0.04, 0.36, 0.3, colours[(k + Math.round(x)) % colours.length], { rotY: -a, solid: false });
    }
  }
  // Cubbies along the side wall, a bin in each.
  kit.span(x0 + 0.6, x0 + 4.4, 0, 1.2, -hw + 0.05, -hw + 0.45, "paleWood");
  for (let c = 0; c < 9; c++) for (let r = 0; r < 3; r++) kit.box(x0 + 0.8 + c * 0.42, 0.22 + r * 0.38, -hw + 0.47, 0.34, 0.28, 0.02, colours[(c + r) % colours.length], { solid: false });
  // The board at the far end, drawings, and the painted sky.
  wallPanel(kit, x1 - 0.03, 1.5, 0, 3.0, 1.1, "chalkboard");
  for (let k = 0; k < 8; k++) wallPanel(kit, x0 + 1.2 + k * 0.7, 1.75 + (k % 2) * 0.3, hw - 0.02, 0.42, 0.32, colours[k % colours.length], { rotY: Math.PI, depth: 0.01 });
  wallPanel(kit, x1 - 2.6, 2.55, -hw + 0.02, 4.2, 1.2, "skyPaint", { rotY: 0, depth: 0.01 });
  for (let k = 0; k < 5; k++) kit.cyl(x1 - 4.4 + k * 0.85, 2.5 + (k % 2) * 0.3, -hw + 0.035, 0.2 + rand() * 0.15, 0.01, "ceramic", { rotX: Math.PI / 2, seg: 14, solid: false });
  kit.span(x1 - 3.2, x1 - 1.0, 0.002, 0.014, -1.2, 1.2, "fabricMustard", { solid: false });
  for (let k = 0; k < 9; k++) kit.box(x1 - 3 + rand() * 1.8, 0.07, -1 + rand() * 2, 0.12, 0.12, 0.12, colours[k % colours.length], { rotY: rand() * 3, solid: false });
  plant(kit, x0 + 0.5, 0, hw - 0.5, { s: 1.5 });
  personAt(group, x1 - 1.0, 1.0, -Math.PI / 2, "chat");
  lights(kit, x0, x1, station.light, 2, 10);
  for (const x of [x0 + 2.5, x0 + 6]) ceilingPanel(kit, x, 0, H, { w: 1.4 });
  kit.finish();
}

// Medical: two treatment bays with their lamps, beds behind curtains, the
// nurses' station, the glass medicine cabinet, the sink.
function enfermaria(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  for (const z of [-2.6, 2.6]) {
    kit.span(x0 + 2.0, x0 + 3.9, 0.75, 0.88, z - 0.4, z + 0.4, "linen");
    kit.span(x0 + 2.2, x0 + 3.7, 0, 0.75, z - 0.3, z + 0.3, "steel");
    kit.span(x0 + 2.0, x0 + 2.5, 0.88, 0.98, z - 0.3, z + 0.3, "ceramic", { solid: false });
    kit.rod([x0 + 4.3, 0, z], [x0 + 4.3, 2.4, z], 0.02, "steel", { solid: true });
    kit.rod([x0 + 4.3, 2.4, z], [x0 + 3.3, 2.1, z], 0.02, "steel");
    kit.cyl(x0 + 3.2, 2.0, z, 0.2, 0.12, "paintCream", { r2: 0.28, seg: 14, solid: false });
    kit.cyl(x0 + 3.2, 1.93, z, 0.18, 0.01, "glowWhite", { seg: 14, solid: false });
  }
  for (let i = 0; i < 2; i++) for (const s of [-1, 1]) {
    const x = x0 + 6.4 + i * 2.6, z = s * (hw - 1.1);
    kit.span(x - 0.48, x + 0.48, 0.3, 0.52, z - 1.0, z + 1.0, "linen");
    kit.span(x + 0.62, x + 0.7, 0.4, H - 0.42, z - 1.1, z + 1.1, "linen");
    kit.span(x + 0.62, x + 0.7, H - 0.42, H - 0.38, z - 1.1, z + 1.1, "steel", { solid: false });
  }
  // The station across the far end, and the cabinet.
  kit.span(x1 - 1.4, x1 - 0.8, 0, 1.05, -1.6, 1.6, "paintCream");
  kit.span(x1 - 1.45, x1 - 0.75, 1.05, 1.1, -1.65, 1.65, "steel", { solid: false });
  terminal(kit, x1 - 1.0, 1.1, 0.8, { rotY: 0 });
  for (let k = 0; k < 3; k++) kit.box(x1 - 1.15, 1.13, -1.2 + k * 0.4, 0.3, 0.04, 0.22, "paper", { solid: false });
  kit.span(x1 - 0.45, x1 - 0.05, 0, 2.0, -hw + 0.3, -hw + 1.6, "paintCream");
  kit.span(x1 - 0.47, x1 - 0.45, 0.9, 1.9, -hw + 0.35, -hw + 1.55, "glassDark", { solid: false });
  bottles(kit, x1 - 0.25, 1.3, -hw + 0.95, { count: 7, spacing: 0.16, mats: ["glassDark", "ceramic", "brass"], rand });
  kit.span(x0 + 0.6, x0 + 1.2, 0, 0.88, hw - 0.6, hw - 0.05, "ceramic");
  kit.rod([x0 + 0.9, 0.88, hw - 0.15], [x0 + 0.9, 1.15, hw - 0.3], 0.02, "steel");
  for (let x = x0 + 1.5; x < x1 - 1; x += 2.2) ceilingPanel(kit, x, 0, H, { w: 1.5, d: 0.3 });
  personAt(group, x0 + 3.0, -1.7, Math.PI, "work", { wear: "medical" });
  personAt(group, x1 - 1.9, 0.5, Math.PI / 2, "work", { wear: "medical" });
  lights(kit, x0, x1, 0xeef6f2, 2, 11);
  kit.finish();
}

// The market: stalls down both sides under cloth awnings, goods on the
// boards, a string of lamps over the aisle.
function bazar(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  const cloth = ["fabricRed", "fabricBlue", "fabricMustard", "fabricGreen", "terracotta"];
  let k = 0;
  for (let x = x0 + 1.6; x < x1 - 1.2; x += 2.7) for (const s of [-1, 1]) {
    const z = s * (hw - 1.0);
    kit.span(x - 1.1, x + 1.1, 0, 0.9, z - 0.45, z + 0.45, "darkWood");
    for (const dx of [-1.15, 1.15]) for (const dz of [-0.5, 0.9]) kit.rod([x + dx, 0, z + s * dz], [x + dx, 2.3 + (dz > 0 ? 0 : 0.3), z + s * dz], 0.035, "darkWood");
    kit.box(x, 2.45, z + s * 0.2, 2.5, 0.03, 1.6, cloth[k % cloth.length], { rotX: s * 0.2, solid: false });
    // Goods: crates, jars, rolls of cloth, tools.
    if (k % 3 === 0) bottles(kit, x, 0.9, z, { count: 8, along: "x", spacing: 0.24, mats: ["glassDark", "ceramic", "copper", "terracotta"], rand });
    else if (k % 3 === 1) for (let i = 0; i < 5; i++) kit.cyl(x - 0.8 + i * 0.4, 0.98, z, 0.08, 0.7, cloth[(i + k) % cloth.length], { rotX: Math.PI / 2, seg: 10, solid: false });
    else for (let i = 0; i < 3; i++) crate(kit, x - 0.6 + i * 0.6, 0.9, z, { s: 0.36, mat: i % 2 ? "cardboard" : "paleWood", solid: false });
    crate(kit, x + 0.7, 0, z - s * 0.85, { s: 0.45 });
    k++;
  }
  kit.rod([x0 + 0.5, 2.7, 0], [x1 - 0.5, 2.7, 0], 0.01, "darkMetal");
  for (let x = x0 + 1.2; x < x1 - 0.5; x += 1.5) {
    kit.rod([x, 2.7, 0], [x, 2.45, 0], 0.01, "darkMetal");
    kit.cyl(x, 2.4, 0, 0.07, 0.1, "glowWarm", { seg: 8, solid: false });
  }
  for (const [x, s] of [[x0 + 1.6, -1], [x0 + 4.3, 1], [x0 + 7.0, -1], [x0 + 9.7, 1]]) {
    personAt(group, x, s * (hw - 0.35), s > 0 ? Math.PI : 0, "work");
    personAt(group, x + 0.6, s * 3.7, s > 0 ? 0 : Math.PI, "chat");
  }
  kit.sign(["O BAZAR", "TUDO JÁ FOI OUTRA COISA"], { x: x1 - 0.03, y: 2.6, z: 0, w: 1.8, h: 0.45, fg: 0xe8b25a, bg: 0x2a1d10 });
  lights(kit, x0, x1, station.light, 3, 9);
  kit.finish();
}

// The farm: raised beds in rows with their grow lights, irrigation over
// them, the tool rack and a barrow.
function rocas(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  for (const s of [-1, 1]) for (const zc of [1.6, 4.0]) {
    const z = s * zc;
    if (Math.abs(z) + 0.6 > hw) continue;
    kit.span(x0 + 1.0, x1 - 1.0, 0, 0.5, z - 0.6, z + 0.6, "darkWood");
    kit.span(x0 + 1.05, x1 - 1.05, 0.5, 0.52, z - 0.55, z + 0.55, "soil", { solid: false });
    for (let x = x0 + 1.3; x < x1 - 1.2; x += 0.42) for (const dz of [-0.25, 0.25]) {
      sprout(kit, x + (rand() - 0.5) * 0.12, 0.52, z + dz, { h: 0.25 + rand() * 0.35, rand });
    }
    kit.span(x0 + 1.0, x1 - 1.0, 1.9, 1.95, z - 0.2, z + 0.2, "glowWarm", { solid: false });
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) kit.rod([x, 1.95, z], [x, H, z], 0.012, "darkMetal");
    kit.rod([x0 + 1.0, 0.62, z + 0.62], [x1 - 1.0, 0.62, z + 0.62], 0.02, "paintBlue");
  }
  for (let k = 0; k < 5; k++) kit.rod([x1 - 0.12, 0.2, -1.2 + k * 0.3], [x1 - 0.12, 1.6, -1.1 + k * 0.3], 0.02, k % 2 ? "darkWood" : "steel");
  kit.span(x1 - 1.6, x1 - 0.8, 0.25, 0.6, -0.4, 0.3, "rust");
  kit.cyl(x1 - 1.7, 0.18, -0.05, 0.18, 0.06, "rubber", { rotX: Math.PI / 2, seg: 12, solid: false });
  barrel(kit, x0 + 0.6, hw - 0.5, { mat: "paintBlue" });
  personAt(group, x0 + 4.0, 2.8, 0, "work", { wear: "farm" });
  personAt(group, x0 + 8.0, -2.8, Math.PI, "work", { wear: "farm" });
  kit.sign(["CADA SEMENTE É CONTADA", "AS ROÇAS · 66"], { x: x0 + 0.03, y: 2.4, z: -hw + 0.9, w: 1.3, h: 0.36, rotY: Math.PI / 2, fg: 0xd8e8c0, bg: 0x1e2a1a });
  lights(kit, x0, x1, station.light, 2, 9);
  kit.finish();
}

// Water treatment: two settling tanks with ladders and a walkway rail, the
// manifold and its valve wheels, the gauge board.
function agua(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  for (const s of [-1, 1]) {
    const x = x0 + 4.4, z = s * (hw - 1.6);
    kit.cyl(x, 1.45, z, 1.3, 2.9, "paintTeal", { seg: 24 });
    for (const y of [0.4, 1.45, 2.5]) kit.torus(x, y, z, 1.32, 0.04, "darkMetal", { rotX: Math.PI / 2, seg: 24 });
    kit.torus(x, 2.95, z, 1.3, 0.025, "steel", { rotX: Math.PI / 2, seg: 24 });
    for (let k = 0; k < 7; k++) kit.box(x - 1.36, 0.3 + k * 0.38, z - s * 0.3, 0.04, 0.03, 0.4, "steel", { solid: false });
    for (const e of [-0.2, 0.2]) kit.rod([x - 1.36, 0, z - s * 0.3 + e], [x - 1.36, 2.95, z - s * 0.3 + e], 0.02, "steel");
    kit.rod([x, 2.9, z], [x, H, z], 0.14, "paintBlue");
    kit.rod([x + 1.3, 0.6, z], [x1 - 0.6, 0.6, z], 0.16, "paintBlue", { solid: true });
  }
  // Manifold across the far end, with its wheels and gauges.
  kit.rod([x1 - 0.6, 0.6, -hw + 0.4], [x1 - 0.6, 0.6, hw - 0.4], 0.22, "paintBlue");
  for (const z of [-2.4, -0.8, 0.8, 2.4]) {
    kit.rod([x1 - 0.6, 0.6, z], [x1 - 0.6, 1.5, z], 0.08, "paintBlue");
    kit.torus(x1 - 0.6, 1.55, z, 0.22, 0.025, "paintRed", { rotX: Math.PI / 2, seg: 16 });
  }
  kit.block(x1 - 0.6, 0, 0.5, 2 * hw - 0.8);
  kit.span(x1 - 0.12, x1 - 0.02, 1.5, 2.6, -1.4, 1.4, "paintGreen", { solid: false });
  for (let k = 0; k < 5; k++) gauge(kit, x1 - 0.13, 2.05, -1.0 + k * 0.5, { r: 0.13 });
  kit.span(x0 + 1.2, x0 + 2.2, 0, 1.0, -2.1, -1.5, "paintCream");
  gauge(kit, x0 + 1.18, 0.75, -1.8, { r: 0.1 });
  kit.span(x0 + 3.2, x0 + 5.8, 0.002, 0.006, -0.4, 0.6, "glassDark", { solid: false });
  conduit(kit, x0, x1, 3.0, hw - 0.05);
  personAt(group, x0 + 2.6, 0.2, -Math.PI / 2, "chat", { character: "engenheira", wear: "mechanical" });
  lights(kit, x0, x1, station.light, 2, 9);
  for (const x of [x0 + 2, x0 + 8.5]) ceilingPanel(kit, x, 0, H, { w: 1.5, glow: "glowCyan" });
  kit.finish();
}

// IT: rows of cabinets either side, the operators' console, cable trays,
// and the Vault at the far end - its door and the speaker grille only.
function ti(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  for (const s of [-1, 1]) {
    const z = s * (hw - 1.0);
    for (let i = 0; i < 6; i++) {
      const x = x0 + 1.3 + i * 1.0;
      kit.span(x - 0.45, x + 0.45, 0, 2.3, z - 0.45, z + 0.45, "paintCream");
      for (let r = 0; r < 12; r++) kit.box(x + (rand() - 0.5) * 0.7, 0.35 + r * 0.16, z - s * 0.455, 0.05, 0.025, 0.01, rand() < 0.6 ? "glowGreen" : rand() < 0.5 ? "glowAmber" : "glowCyan", { solid: false });
      if (i % 2) for (const dy of [0, 0.45]) kit.cyl(x, 1.5 + dy, z - s * 0.46, 0.17, 0.02, "darkMetal", { rotX: Math.PI / 2, seg: 16, solid: false });
    }
    kit.span(x0 + 0.8, x0 + 6.9, 2.75, 2.8, z - 0.3, z + 0.3, "steel", { solid: false });
  }
  controlDesk(kit, x0 + 7.6, 0, { w: 2.6, rand });
  chair(kit, x0 + 6.8, -0.6, { rotY: Math.PI });
  chair(kit, x0 + 6.8, 0.6, { rotY: Math.PI });
  // The Vault.
  const vx = x1 - 0.55;
  kit.span(vx - 0.3, x1, 0, H, -hw, hw, "darkMetal");
  kit.span(vx - 0.42, vx - 0.3, 0.05, 2.55, -0.95, 0.95, "steel", { solid: false });
  for (const dz of [-0.78, 0.78]) kit.span(vx - 0.5, vx - 0.4, 0.15, 2.4, dz - 0.08, dz + 0.08, "darkMetal", { solid: false });
  kit.cyl(vx - 0.48, 1.25, 0, 0.38, 0.1, "steel", { rotZ: Math.PI / 2, seg: 18, solid: false });
  kit.torus(vx - 0.55, 1.25, 0, 0.3, 0.03, "darkMetal", { rotY: Math.PI / 2, seg: 18 });
  for (let i = 0; i < 7; i++) kit.span(vx - 0.34, vx - 0.31, 2.7 + i * 0.055, 2.73 + i * 0.055, -0.35, 0.35, "rubber", { solid: false });
  kit.box(vx - 0.35, 2.6, 0.55, 0.02, 0.06, 0.06, "glowRed", { solid: false });
  personAt(group, x0 + 6.8, -0.6, Math.PI / 2, "sit", { wear: "it" });
  personAt(group, vx - 1.2, 0.9, -Math.PI / 2, "chat", { character: "tecnico", wear: "it" });
  kit.sign(["O COFRE", "ACESSO RESTRITO"], { x: vx - 0.33, y: 3.08, z: 0, w: 1.2, h: 0.36, fg: 0x9fd4ff, bg: 0x0a1016 });
  lights(kit, x0, vx, station.light, 2, 8);
  for (const x of [x0 + 2, x0 + 5.5]) ceilingPanel(kit, x, 0, H, { w: 1.4, glow: "glowCyan" });
  kit.finish();
}

// Mechanical: a machine shop under a crane rail - lathe, press, an engine on
// its stand, benches and racks of parts, oil on the grating.
function mecanica(group, station, x0, x1, hw) {
  const { kit, rand } = start(group, station);
  const grate = makeGrateTexture(station.floor, station.accent);
  addBox(group, { x: (x0 + x1) / 2, y: -0.01, z: 0, w: x1 - x0, h: 0.04, d: hw * 2, map: grate, repeat: [(x1 - x0) / 2, hw], color: 0xffffff });
  // Crane rails along the walls, the beam across, the hook.
  for (const s of [-1, 1]) kit.span(x0 + 0.3, x1 - 0.3, H - 0.4, H - 0.2, s * (hw - 0.3), s * (hw - 0.1), "paintOrange", { solid: false });
  const cx = x0 + 7.5;
  kit.span(cx - 0.15, cx + 0.15, H - 0.55, H - 0.35, -hw + 0.1, hw - 0.1, "paintOrange", { solid: false });
  kit.box(cx, H - 0.7, 1.2, 0.4, 0.3, 0.4, "darkMetal", { solid: false });
  kit.rod([cx, H - 0.85, 1.2], [cx, 2.1, 1.2], 0.015, "darkMetal");
  kit.torus(cx, 2.0, 1.2, 0.1, 0.025, "steel", { arc: Math.PI * 1.5, seg: 10 });
  // The engine on its stand, under the hook.
  kit.span(cx - 0.8, cx + 0.8, 0, 0.5, 0.7, 1.7, "darkMetal");
  kit.span(cx - 0.65, cx + 0.65, 0.5, 1.25, 0.8, 1.6, "paintGreen");
  for (let k = 0; k < 4; k++) kit.cyl(cx - 0.45 + k * 0.3, 1.38, 1.2, 0.09, 0.26, "steel", { seg: 10, solid: false });
  // The lathe and the press.
  kit.span(x0 + 2.0, x0 + 4.8, 0, 0.9, -hw + 0.6, -hw + 1.4, "paintGreen");
  kit.span(x0 + 2.0, x0 + 2.7, 0.9, 1.5, -hw + 0.7, -hw + 1.3, "paintGreen", { solid: false });
  kit.cyl(x0 + 3.4, 1.15, -hw + 1.0, 0.07, 1.6, "steel", { rotZ: Math.PI / 2, seg: 10, solid: false });
  kit.span(x1 - 2.4, x1 - 1.4, 0, 2.6, -hw + 0.4, -hw + 1.4, "paintBlue");
  kit.span(x1 - 2.3, x1 - 1.5, 2.6, 2.9, -hw + 0.5, -hw + 1.3, "darkMetal", { solid: false });
  // Benches and the parts racks along the far wall.
  for (const x of [x0 + 2.4, x0 + 5]) {
    kit.span(x - 1.0, x + 1.0, 0, 0.9, hw - 0.85, hw - 0.1, "darkWood");
    kit.box(x - 0.5, 1.0, hw - 0.5, 0.2, 0.2, 0.3, "paintBlue", { solid: false });
  }
  wallPanel(kit, x0 + 3.7, 1.75, hw - 0.02, 3.2, 1.0, "paleWood", { rotY: Math.PI });
  for (let k = 0; k < 16; k++) kit.box(x0 + 2.3 + (k % 8) * 0.38, 1.5 + Math.floor(k / 8) * 0.45, hw - 0.05, 0.04, 0.22 + rand() * 0.14, 0.02, k % 3 ? "steel" : "paintRed", { rotZ: (rand() - 0.5) * 0.3, solid: false });
  shelf(kit, x1 - 0.35, 1.8, { rotY: 0, w: 2.4, d: 0.5, h: 2.4, levels: 5, mat: "paintOlive",
    items: (_, y) => shelfLoad(kit, x1 - 0.35, 1.8, y, { rotY: 0, w: 2.4, d: 0.5, mats: ["paintRed", "paintBlue", "rust", "steel", "cardboard"], size: [0.4, 0.24, 0.3], gap: 0.05, rand }) });
  for (let k = 0; k < 3; k++) barrel(kit, x1 - 0.5, -0.6 + k * 0.7, { mat: k % 2 ? "paintRed" : "rust" });
  kit.span(cx - 1.6, cx - 0.4, 0.012, 0.016, -1.6, -0.4, "rubber", { solid: false });
  personAt(group, x0 + 5.6, -0.4, -Math.PI / 2, "chat", { character: "chefe", wear: "mechanical" });
  personAt(group, x0 + 3.4, -hw + 1.8, Math.PI, "work", { wear: "mechanical" });
  personAt(group, x0 + 2.4, hw - 1.25, 0, "work", { wear: "mechanical" });
  lights(kit, x0, x1, station.light, 3, 10);
  for (const x of [x0 + 3, x0 + 10]) pendant(kit, x, -1.5, H, { drop: 0.7, r: 0.4 });
  kit.finish();
}

export const MAIN_ROOM_BUILDERS = { judicial, ninho, creche, enfermaria, bazar, rocas, agua, ti, mecanica };
