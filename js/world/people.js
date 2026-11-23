import * as THREE from "three";
import { GALLERY_COLUMNS, WORLD } from "../config.js";
import { surfaceY } from "../collision.js";
import { mulberry32 } from "../textures.js";
import { CHARACTERS } from "../quests.js";

// The people of the silo. Every reference is full of them - leaning on the
// parapets, on the stairs, at the tables - and without them the silo read as
// a ruin. Low, plain figures, the same body for everyone, told apart by what
// they wear and what they are doing:
//
//   walk   round the gallery, stopping for whoever is in the way
//   lean   on the parapet, looking down the shaft
//   chat   in pairs by the doors
//   sit    at the tables of the cafeteria, the bar, the market
//   work   standing at a desk, a bench, a console
//   climb  up or down the stair (the porters)
//
// Only the levels next to the player are peopled, from a fixed pool of
// bodies. The whole crowd is six instanced meshes (torso, head, hair, and
// arms, thighs and shins two to a body), posed on the CPU every frame - a
// few hundred matrices.
//
// They are not obstacles: the player walks past them and they step out of
// the way. A body the player could be trapped against would be worse.

const SLOTS = 60;
const noHit = () => {};
const TAU = Math.PI * 2;

// Built around each joint, so a limb's rotation is its own.
function parts() {
  const torso = new THREE.CylinderGeometry(0.2, 0.165, 0.6, 9);
  torso.scale(1, 1, 0.62);
  torso.translate(0, 0.3, 0);
  const shoulders = new THREE.SphereGeometry(0.2, 9, 4, 0, TAU, 0, Math.PI / 2);
  shoulders.scale(1.05, 0.35, 0.65);
  shoulders.translate(0, 0.6, 0);
  const neck = new THREE.CylinderGeometry(0.05, 0.055, 0.12, 6);
  neck.translate(0, 0.66, 0);
  const torsoGeo = mergeAll([torso, shoulders, neck]);
  const head = new THREE.SphereGeometry(0.105, 10, 8);
  head.scale(0.92, 1.12, 1);
  head.translate(0, 0.12, 0.005);
  const nose = new THREE.BoxGeometry(0.03, 0.04, 0.04);
  nose.translate(0, 0.11, 0.105);
  const headGeo = mergeAll([head, nose]);
  const hair = new THREE.SphereGeometry(0.112, 10, 6, 0, TAU, 0, Math.PI * 0.55);
  hair.scale(0.95, 1.1, 1.05);
  hair.translate(0, 0.135, -0.012);
  const arm = new THREE.CylinderGeometry(0.052, 0.042, 0.58, 6);
  arm.translate(0, -0.29, 0);
  const hand = new THREE.SphereGeometry(0.045, 6, 4);
  hand.translate(0, -0.6, 0);
  const armGeo = mergeAll([arm, hand]);
  const thigh = new THREE.CylinderGeometry(0.078, 0.062, 0.44, 7);
  thigh.translate(0, -0.22, 0);
  const shin = new THREE.CylinderGeometry(0.06, 0.048, 0.42, 7);
  shin.translate(0, -0.21, 0);
  const foot = new THREE.BoxGeometry(0.095, 0.07, 0.24);
  foot.translate(0, -0.42, 0.05);
  const shinGeo = mergeAll([shin, foot]);
  return { torso: torsoGeo, head: headGeo, hair, arm: armGeo, thigh, shin: shinGeo };
}
function mergeAll(list) {
  // Plain position/normal merge, without the addon (all parts are indexed).
  const geometry = new THREE.BufferGeometry();
  const pos = [], nor = [], idx = [];
  for (const g of list) {
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(base + i);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geometry.setIndex(idx);
  return geometry;
}

// --- What people wear --------------------------------------------------------
const SKIN = [0xf0c8a8, 0xd9a684, 0xb98563, 0x8d5f43, 0x6a4632, 0xe5b998];
const HAIR = [0x2a1f19, 0x4a3426, 0x6b4a2e, 0x9b7b55, 0x1a1a1a, 0x8a8580, 0xb39a6e];
const WEAR = {
  // The silo's own layered, mended clothes: earth, rust, faded blue.
  common: [[0x6b5a48, 0x3e3a35], [0x4e5a63, 0x2f3336], [0x7a4e3a, 0x3d3a34], [0x5f6650, 0x3a3a33], [0x8a7b5c, 0x4a4238], [0x3f4b57, 0x2c2c2c], [0x9a8f7a, 0x4e4a44]],
  mechanical: [[0x2f3a4a, 0x2f3a4a], [0x3a3d42, 0x3a3d42], [0x8a5a2a, 0x4a3a2a]],
  it: [[0x9aa4ad, 0x2f3338], [0x5b6b7a, 0x2a2e33], [0xc7cbc8, 0x3a3e44]],
  judicial: [[0x1e2024, 0x1e2024], [0x2c2a2e, 0x1d1c1e]],
  law: [[0x8a7550, 0x4e4434], [0x7a6a4c, 0x3e3a30]],
  medical: [[0xc9d6d0, 0x8fa39b], [0xa9c2b7, 0x6e837a]],
  farm: [[0x5e6e45, 0x4a4030], [0x7a6a40, 0x4a4434]],
};
function wearFor(stationId, level) {
  if (stationId === "mecanica" || stationId === "gerador" || level >= 120) return "mechanical";
  if (stationId === "ti") return "it";
  if (stationId === "judicial") return "judicial";
  if (stationId === "ninho") return "law";
  if (stationId === "enfermaria") return "medical";
  if (stationId === "rocas") return "farm";
  return "common";
}
const FIRST = ["Ana", "Bento", "Clara", "Davi", "Elisa", "Fábio", "Gina", "Hugo", "Irene", "Jonas", "Lara", "Mauro", "Nina", "Otávio", "Paula", "Rui", "Sara", "Teo", "Vera", "Wagner", "Yara", "Zeca", "Marta", "Caio", "Lívia", "Tomás"];
const LAST = ["Abreu", "Borges", "Campos", "Dantas", "Esteves", "Farias", "Gouveia", "Lacerda", "Macedo", "Nunes", "Pimenta", "Queiroz", "Rocha", "Soares", "Telles", "Vidal"];

// What strangers say, by where they are. Short: overheard, not quests.
const LINES = {
  common: ["Desce ou sobe? Eu nunca sei mais para que lado é melhor.", "Dizem que a tela da cafeteria vai ser limpa de novo. Dizem isso todo ano.", "Meu filho tem bilhete para o sorteio. Se sair, vamos precisar de mais um quarto.", "Não pare na escada. O xerife multa quem fica parado no patamar.", "A luz do meu andar pisca desde o último turno. Ninguém da Mecânica sobe.", "Você não é daqui do nível, é? Dá para ver pelo jeito que olha para baixo."],
  mechanical: ["Lá em cima acham que a luz nasce sozinha.", "Turno dobrado de novo. O gerador não descansa, então a gente também não.", "Se ouvir um apito comprido, saia do caminho. Se ouvir dois, corra."],
  it: ["Não toque em nada. Nem olhe muito.", "Tudo o que você diz neste silo está gravado em algum lugar. Inclusive isto.", "As fitas giram dia e noite. Ninguém sabe dizer o que elas guardam."],
  judicial: ["O Pacto não tem pressa. Quem tem pressa é quem está do lado errado dele.", "Silêncio, por favor. O arquivo escuta."],
  law: ["Circulando. Nada para ver aqui.", "Três brigas no 40 e um furto no 68. Dia tranquilo."],
  medical: ["Fila da direita para curativos. Da esquerda, para quem não sabe o que tem.", "Lave as mãos antes de entrar. Sempre."],
  farm: ["Cuidado com os canteiros. Cada pé de feijão tem dono e registro.", "A luz de cultivo cansa os olhos. A gente se acostuma com tudo."],
};

// --- Poses -------------------------------------------------------------------
const _m = new THREE.Matrix4(), _base = new THREE.Matrix4(), _hip = new THREE.Matrix4(), _chest = new THREE.Matrix4();
const _t = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function joint(parent, x, y, z, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _t.compose(_v.set(x, y, z), _q, _s);
  return _m.multiplyMatrices(parent, _t);
}

// Writes one body's parts; returns nothing. `p` is the person.
function pose(p, t, out) {
  const walk = p.mode === "walk" || p.mode === "climb";
  const swing = walk ? Math.sin(p.phase) : 0;
  const breathe = Math.sin(t * 1.7 + p.seed * 9) * 0.02;
  const sit = p.mode === "sit";
  const hipY = sit ? 0.47 : 0.88 + (walk ? Math.abs(Math.cos(p.phase)) * 0.025 : 0);
  _e.set(0, p.yaw, 0);
  _q.setFromEuler(_e);
  _base.compose(_v.set(p.x, p.y, p.z), _q, _s);
  _hip.multiplyMatrices(_base, _t.makeTranslation(0, hipY, 0));
  // Torso: leaning ones bend over the rail, workers over the bench.
  const bend = p.mode === "lean" ? 0.32 : p.mode === "work" ? 0.18 : sit ? 0.06 : 0.03 + breathe;
  _chest.copy(joint(_hip, 0, 0, 0, bend, 0, 0));
  out.torso.push(_chest.clone());
  const look = p.look || 0;
  const head = joint(_chest, 0, 0.68, 0, p.mode === "lean" ? 0.35 : p.mode === "work" ? 0.3 : -0.02, look, 0).clone();
  out.head.push(head);
  out.hair.push(head);
  // Arms: swinging, on the rail, forward to the work, or talking.
  for (const side of [-1, 1]) {
    let rx = 0, rz = side * 0.06;
    if (walk) rx = -swing * side * 0.5;
    else if (p.mode === "lean") { rx = -1.15; rz = side * 0.12; }
    else if (p.mode === "work") rx = -0.95 + Math.sin(t * 3 + side + p.seed) * 0.08;
    else if (sit) rx = -0.7;
    else if (p.mode === "chat" && side > 0) rx = -0.45 + Math.sin(t * 2.3 + p.seed * 5) * 0.25;
    out.arm.push(joint(_chest, side * 0.235, 0.57, 0, rx, 0, rz).clone());
  }
  // Legs: thigh from the hip, shin from the knee.
  for (const side of [-1, 1]) {
    const thighRx = sit ? -1.5 : walk ? swing * side * 0.55 : 0;
    const thigh = joint(_hip, side * 0.095, 0, 0, thighRx, 0, 0).clone();
    out.thigh.push(thigh);
    const knee = sit ? 1.5 : walk ? Math.max(0, -swing * side) * 0.7 : 0;
    out.shin.push(joint(thigh, 0, -0.44, 0, knee, 0, 0).clone());
  }
}

// --- The population of one level ------------------------------------------
function gapAt(a, b) { return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); }
function populate(layout, index) {
  const st = layout.stations[index];
  const rand = mulberry32((st.level * 2654435761) >>> 0);
  const wear = wearFor(st.id, st.level);
  const people = [];
  const person = (extra) => {
    const style = WEAR[extra.wear || wear][Math.floor(rand() * WEAR[extra.wear || wear].length)];
    const p = {
      seed: rand(), level: index, look: 0, phase: rand() * TAU, wait: 0,
      skin: SKIN[Math.floor(rand() * SKIN.length)], hair: HAIR[Math.floor(rand() * HAIR.length)],
      top: style[0], legs: style[1], bald: rand() < 0.12,
      name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`,
      lines: LINES[extra.wear || wear], ...extra,
    };
    p.line = p.lines ? p.lines[Math.floor(rand() * p.lines.length)] : null;
    people.push(p);
    return p;
  };
  const blocked = (a) => GALLERY_COLUMNS.angles.some((c) => gapAt(a, c) < 0.09) || gapAt(a, st.theta) < WORLD.landingHalfAngle + 0.08 || (st.bays || []).some((b) => gapAt(a, b.bearing) < b.halfWidth + 0.06);
  // Walking the gallery, both ways round.
  const walkers = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < walkers; i++) {
    const r = 18.4 + rand() * 3, a = rand() * TAU;
    person({ mode: "walk", r, a, dir: rand() < 0.5 ? 1 : -1, speed: 0.9 + rand() * 0.5, y: st.y });
  }
  // On the parapet, looking down.
  for (let i = 0, tries = 0; i < 2 + Math.floor(rand() * 2) && tries < 20; tries++) {
    const a = rand() * TAU;
    if (blocked(a)) continue;
    const r = WORLD.ringInnerR + 0.62;
    person({ mode: "lean", r, a, x: r * Math.cos(a), z: r * Math.sin(a), y: st.y, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
    i++;
  }
  // Pairs talking by the doors.
  for (let i = 0; i < 1 + Math.floor(rand() * 2); i++) {
    const a = rand() * TAU, r = 21.2;
    for (const side of [-1, 1]) {
      const b = a + side * 0.03;
      const x = r * Math.cos(b), z = r * Math.sin(b);
      const other = a - side * 0.03;
      person({ mode: "chat", x, z, y: st.y, yaw: Math.atan2(r * Math.cos(other) - x, r * Math.sin(other) - z) });
    }
  }
  // In the rooms: whoever the room builders asked for (rooms.js, main-rooms.js).
  for (const spot of st.npcSpots || []) {
    const character = spot.character ? CHARACTERS[spot.character] : null;
    person({
      mode: spot.pose || "work", x: spot.x, z: spot.z, y: st.y + (spot.dy || 0), yaw: spot.yaw,
      wear: spot.wear, character: spot.character || null,
      ...(character ? { name: character.name } : {}),
    });
  }
  return people;
}

// Porters on the flight below a level: up or down the treads.
function porters(layout, index) {
  const st = layout.stations[index], below = layout.stations[index + 1];
  if (!below) return [];
  const rand = mulberry32((st.level * 40503 + 7) >>> 0);
  return Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
    const wearList = WEAR[wearFor(st.id, st.level)];
    const style = wearList[Math.floor(rand() * wearList.length)];
    return {
      mode: "climb", seed: rand(), phase: rand() * TAU, look: 0, wait: 0, flight: index,
      theta: st.theta + WORLD.landingHalfAngle + rand() * (below.theta - st.theta - 2 * WORLD.landingHalfAngle),
      dir: rand() < 0.5 ? 1 : -1, r: 3.2 + rand() * 1.6, speed: 0.7 + rand() * 0.3,
      skin: SKIN[Math.floor(rand() * SKIN.length)], hair: HAIR[Math.floor(rand() * HAIR.length)], top: style[0], legs: style[1], bald: rand() < 0.15,
      name: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`,
      lines: ["Carga para o 72. Abra caminho, por favor.", "Doze andares com isto nas costas. Os carregadores são o que mantém o silo de pé.", "Não, não pode ajudar. A carga é registrada no meu nome."],
      line: null, carry: true,
    };
  }).map((p) => ({ ...p, line: p.lines[Math.floor(p.seed * p.lines.length)] }));
}

export function createCrowd(scene, layout) {
  const geo = parts();
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0.02 });
  const group = new THREE.Group();
  group.name = "crowd";
  scene.add(group);
  const mesh = {};
  const counts = { torso: 1, head: 1, hair: 1, arm: 2, thigh: 2, shin: 2 };
  for (const [name, n] of Object.entries(counts)) {
    const m = new THREE.InstancedMesh(geo[name], material, SLOTS * n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color());
    m.count = 0;
    m.frustumCulled = false;
    m.name = `crowd-${name}`;
    if (name !== "torso" && name !== "head") m.raycast = noHit;
    group.add(m);
    mesh[name] = m;
  }
  // A crate on a porter's back: one more instanced box.
  const crate = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.38, 0.3), new THREE.MeshStandardMaterial({ color: 0x8a6e4a, roughness: 0.9 }), SLOTS);
  crate.count = 0;
  crate.frustumCulled = false;
  crate.raycast = () => {};
  group.add(crate);

  const levels = new Map(), flights = new Map();
  let active = [];
  let center = -1;
  function gather(index) {
    const out = [];
    for (let i = Math.max(0, index - 1); i <= Math.min(layout.stations.length - 1, index + 1); i++) {
      if (!levels.has(i)) levels.set(i, populate(layout, i));
      out.push(...levels.get(i));
    }
    for (const i of [index - 1, index]) {
      if (i < 0) continue;
      if (!flights.has(i)) flights.set(i, porters(layout, i));
      out.push(...flights.get(i));
    }
    return out;
  }

  const colour = new THREE.Color();
  let time = 0;
  // `player` is the collision state; `eye` its world position.
  function update(player, eye, dt) {
    time += dt;
    // The level the player is on or nearest to.
    let index = player.level;
    if (index === null || index === undefined) {
      index = 0;
      for (let i = 0; i < layout.stations.length; i++) if (Math.abs(layout.stations[i].y - eye.y) < Math.abs(layout.stations[index].y - eye.y)) index = i;
    }
    if (index !== center) { center = index; active = gather(index); }

    const out = { torso: [], head: [], hair: [], arm: [], thigh: [], shin: [] };
    const tints = [];
    const crates = [];
    let used = 0;
    // Nearest first, so a full pool drops the far ones.
    const placed = active.map((p) => {
      if (p.mode === "walk") { p.x = p.r * Math.cos(p.a); p.z = p.r * Math.sin(p.a); }
      if (p.mode === "climb") { p.x = p.r * Math.cos(p.theta); p.z = p.r * Math.sin(p.theta); p.y = surfaceY(layout, p.theta); }
      return { p, d: Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) };
    }).sort((a, b) => a.d - b.d);
    for (const { p, d } of placed) {
      if (used >= SLOTS || d > 60) break;
      // Moving ones go about their business, and wait for the player.
      if (p.mode === "walk" || p.mode === "climb") {
        const ahead = p.mode === "walk"
          ? { x: p.r * Math.cos(p.a + p.dir * 0.08), z: p.r * Math.sin(p.a + p.dir * 0.08) }
          : { x: p.r * Math.cos(p.theta + p.dir * 0.25), z: p.r * Math.sin(p.theta + p.dir * 0.25) };
        const close = Math.hypot(ahead.x - eye.x, ahead.z - eye.z) < 1.1 && Math.abs(p.y + 1.6 - eye.y) < 1.5;
        if (close) p.wait = 1.2;
        if (p.wait > 0) p.wait -= dt;
        else if (p.mode === "walk") {
          p.a += (p.dir * p.speed * dt) / p.r;
          p.phase += dt * p.speed * 5.2;
        } else {
          const flight = layout.slopes[p.flight];
          p.theta += (p.dir * p.speed * dt) / p.r;
          if (p.theta < flight.thetaStart + 0.05 || p.theta > flight.thetaEnd - 0.05) p.dir = -p.dir;
          p.phase += dt * p.speed * 5.6;
        }
        const tangent = p.mode === "walk" ? p.a + (p.dir * Math.PI) / 2 : p.theta + (p.dir * Math.PI) / 2;
        // Facing along the way: yaw turns +z to the direction of travel.
        p.yaw = Math.atan2(Math.cos(tangent), Math.sin(tangent));
        if (p.wait > 0) { p.mode === "walk" && (p.phase = 0); }
      }
      // Anyone near turns their head to the player.
      const toPlayer = Math.atan2(eye.x - p.x, eye.z - p.z) - p.yaw;
      const turn = Math.atan2(Math.sin(toPlayer), Math.cos(toPlayer));
      p.look += ((d < 4 && Math.abs(turn) < 1.4 ? turn * 0.8 : 0) - p.look) * Math.min(1, dt * 3);
      pose(p, time, out);
      tints.push(p);
      if (p.carry) {
        _t.makeTranslation(0, 1.2, -0.25);
        crates.push(out.torso.at(-1).clone().multiply(_t));
      }
      p.slot = used;
      used++;
    }
    const write = (name, list, colourOf) => {
      const m = mesh[name];
      list.forEach((matrix, i) => m.setMatrixAt(i, matrix));
      m.count = list.length;
      const per = counts[name];
      list.forEach((_, i) => m.setColorAt(i, colour.setHex(colourOf(tints[Math.floor(i / per)]))));
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      // The pointer's hit test culls by this; the crowd moves every frame.
      if (m.raycast !== noHit) m.computeBoundingSphere();
    };
    write("torso", out.torso, (p) => p.top);
    write("head", out.head, (p) => p.skin);
    write("hair", out.hair, (p) => (p.bald ? p.skin : p.hair));
    write("arm", out.arm, (p) => p.top);
    write("thigh", out.thigh, (p) => p.legs);
    write("shin", out.shin, (p) => p.legs);
    crates.forEach((matrix, i) => crate.setMatrixAt(i, matrix));
    crate.count = crates.length;
    crate.instanceMatrix.needsUpdate = true;
    // Who is in which slot, for talking to them.
    slots = placed.slice(0, used).map((entry) => entry.p);
  }
  let slots = [];

  // The interaction entry (main.js): the torso and head meshes are what the
  // pointer hits; the instance says who it was.
  const talkable = {
    meshes: [mesh.torso, mesh.head],
    resolve(hit) {
      const per = 1;
      const p = slots.find((person) => person.slot === Math.floor(hit.instanceId / per));
      return p || null;
    },
  };

  return { group, update, talkable, people: () => slots };
}
