import { lerpHexColor } from "./mathutils.js";

// ---------------------------------------------------------------------------
// Core tunables. Distances are in meters, angles in radians.
// ---------------------------------------------------------------------------

export const WORLD = {
  shaftR: 1.7, // inner void / center hole radius (also stair inner edge)
  stairOuterR: 6.2, // outer edge of stair treads / stair railing - wide, generous treads like the reference stills
  // The stair lands on a small hub platform, NOT directly on the outer ring:
  // between the hub and the ring there is a real open void (like the huge
  // open light well between the central stair spine and the inhabited ring
  // in the structural cutaway) that you can only cross via a bridge at each
  // wing's angle.
  hubR: 7.0,
  ringInnerR: 16.0,
  landingR: 23.0, // outer edge of the ring (where the wall/rooms are)
  bridgeHalfW: 1.7,
  corridorHalfW: 1.8,
  corridorLen: 11,
  // The silo's outer concrete shell. Everything - rings, wings, rooms - has
  // to fit inside this radius, otherwise a room would poke out through the
  // wall of the silo (test/layout.test.mjs checks this).
  shellR: 62,
  // Decorative floors packed between the twelve playable ones. The silo has
  // 144 levels; without these you look down the shaft and see twelve lonely
  // slabs instead of the dense stack of inhabited levels in the reference
  // stills. They are scenery only - never walkable.
  fillerSpacing: 3.9,
  // Angular half-width of each station's flat hall. This wraps most of the
  // way around the shaft (like a real atrium balcony), but NOT all the way
  // Half-width of the flat landing where the stair meets a level's floor.
  // This used to be `plateauHalfAngle` at 1.2-2.5 rad: a whole floor's hall
  // was one flat plateau, which is why the hall could never be more than a
  // fraction of the circle (see the clearance formula below) and why only a
  // dozen levels could exist. Now the helix runs continuously past every
  // level and only pauses for a real landing, the same +-15.5 degrees the 3D
  // cutaway uses. The ring floors are separate surfaces, walkable all 360.
  //
  //     clearance over a landing = (2*PI - 2*phi) * risePerTurn / (2*PI)
  //
  // At 0.27 rad that leaves ~3.5m, against 0.78m at the old 1.2 rad.
  landingHalfAngle: 0.27,
  // Both taken from the interactive 3D cutaway (3dscenes.qualityf2p.workers.dev
  // /silo), whose stair is the most precise reference we have: it runs exactly
  // 2 turns per 7.6m level on 44 steps, i.e. 22 steps and 3.8m per turn. That
  // gives a 0.173m rise (ours was already 0.179m - the riser was never the
  // problem) but a 1.0m going instead of 0.44m. 56 steps per turn was making a
  // grand spiral stair read as a cramped winder.
  risePerTurn: 3.8, // meters descended per full 360 degree turn of stairs
  stepsPerTurn: 22,
  playerRadius: 0.35,
  eyeHeight: 1.65,
  roomHeight: 3.4,
};

// --- Construction dimensions -------------------------------------------------
// Used by js/world/* (re-exported through primitives.js) and asserted against
// each other in test/layout.test.mjs.
// Floor-to-floor height of a numbered level, from the same 3D cutaway.
// risePerTurn * TURNS_PER_LEVEL must equal this, or the stair stops agreeing
// with the level numbering painted on it.
// A whole number of turns per level puts every landing at the same compass
// bearing, so the stair meets all 148 floors on the same side and the descent
// reads as one repeated picture. The production renders show the opposite: the
// walkway swings round the shaft as it goes down. The extra sixth of a turn
// rotates each landing 60 degrees from the one above - the same 60 degrees the
// 3D cutaway alternates its landings by.
//
// The stair's own geometry is untouched by this (risePerTurn and stepsPerTurn
// both stay put); what moves is the level height, from 7.6m to 8.23m.
export const TURNS_PER_LEVEL = 13 / 6;
export const LEVEL_HEIGHT = 3.8 * TURNS_PER_LEVEL;

export const PARAPET_HEIGHT = 1.05;
// Guard walls are inset by half of this so their footprint sits entirely on
// the slab they guard - centred on the rim, half the wall cantilevers over
// the void and reads as a floating lip from the far side of the shaft.
export const PARAPET_THICKNESS = 0.22;
// Every walkable floor is a real slab this thick, not a zero-thickness
// surface - the fascia is what you actually see from across the void.
export const SLAB_THICKNESS = 0.55;
// Ring walls are structural concrete, not partitions.
export const WALL_THICKNESS = 0.55;


// Wings branch off a level's ring at these angles, measured from the level's
// landing. Now that the ring is a real 360-degree floor rather than a flat
// plateau spanning a fraction of a turn, these can go anywhere around the
// circle - they no longer have to squeeze inside the landing's angular span.
// They are deliberately offset by half a step so none of them sits on top of
// the landing itself.
export let WING_OFFSETS = evenlySpacedWings(3);

function evenlySpacedWings(count) {
  const TAU = Math.PI * 2;
  if (count <= 1) return [Math.PI];
  const step = TAU / count;
  return Array.from({ length: count }, (_, i) => step * (i + 0.5));
}

// Rebuilds WING_OFFSETS with `count` evenly spaced wings. Exported so the
// cost of denser floors can be measured (?wings=N) before committing to it.
export function setWingCount(count) {
  WING_OFFSETS = evenlySpacedWings(Number.isFinite(count) ? Math.max(1, Math.min(8, Math.round(count))) : 3);
}

export const SECONDARY_WING = {
  roomHalfW: 3.2,
  roomDepth: 7,
};

// What the two side rooms (wings B and C) of each department are, furnished
// by js/world/rooms.js. They used to be the same store room with three crates
// on every level. Two are not rectangles: on level 1, the sheriff's station
// is the production's round bull pen (new-references 049-057), and the
// controlled exit runs to the airlock door (058-065).
export const SIDE_ROOMS = {
  topo: [
    { kind: "police", label: "XERIFE", shape: "round", radius: 6.5, clearance: 0.75 },
    { kind: "airlock", label: "SAÍDA CONTROLADA", halfW: 2.7, depth: 9.5 },
  ],
  ninho: [{ kind: "cells", label: "CELAS" }, { kind: "deputy", label: "DELEGADO DE PLANTÃO" }],
  residencial: [{ kind: "mess", label: "SALÃO COMUNITÁRIO" }, { kind: "storage", label: "DEPÓSITO" }],
  ti: [{ kind: "servers", label: "SERVIDORES" }, { kind: "radio", label: "COMUNICAÇÕES" }],
  judicial: [{ kind: "archive", label: "ARQUIVO DO PACTO" }, { kind: "office", label: "SECRETARIA" }],
  creche: [{ kind: "classroom", label: "SALA DE AULA" }, { kind: "nursery", label: "BERÇÁRIO" }],
  rocas: [{ kind: "seedbank", label: "BANCO DE SEMENTES" }, { kind: "hydroponics", label: "ESTUFA" }],
  bazar: [{ kind: "tailor", label: "ALFAIATARIA" }, { kind: "bar", label: "BAR" }],
  enfermaria: [{ kind: "ward", label: "ENFERMARIA B" }, { kind: "pharmacy", label: "BOTICA" }],
  agua: [{ kind: "pumps", label: "BOMBAS" }, { kind: "lab", label: "LABORATÓRIO" }],
  mecanica: [{ kind: "workshop", label: "OFICINA" }, { kind: "parts", label: "ALMOXARIFADO" }],
  gerador: [{ kind: "control", label: "SALA DE CONTROLE" }, { kind: "lockers", label: "VESTIÁRIO" }],
  escavador: [{ kind: "minestores", label: "PAIOL" }, { kind: "workshop", label: "OFICINA DE CAMPO" }],
  minas: [{ kind: "lockers", label: "LAMPISTERIA" }, { kind: "minestores", label: "MINÉRIO" }],
  caverna: [{ kind: "survey", label: "LEVANTAMENTO" }, { kind: "parts", label: "DEPÓSITO" }],
  limiar: [{ kind: "splice", label: "CAIXA DE CABOS" }, { kind: "storage", label: "DEPÓSITO" }],
};

// The room at the end of wing `i` of a level: its shape and size, and what
// it is. Wing 0 is the department's own room; a round one's halfW is its
// radius and its depth the diameter.
export function wingSpec(station, i) {
  if (i === 0) {
    return { shape: station.roomShape === "round" ? "round" : "box", halfW: station.roomHalfW, depth: station.roomDepth, height: station.roomHeight, kind: station.propType, clearance: CAFETERIA.wallClearance };
  }
  const side = SIDE_ROOMS[station.id]?.[i - 1] || {};
  if (side.shape === "round") return { ...side, halfW: side.radius, depth: side.radius * 2 };
  return { shape: "box", halfW: SECONDARY_WING.roomHalfW, depth: SECONDARY_WING.roomDepth, ...side };
}

// The dome over the top of the shaft (js/world/dome.js) and the central column
// that carries its lamp. Heights are from the top level's floor.
export const DOME = {
  // The drum stands just outside the rings' inner edge, on the top gallery.
  radius: WORLD.ringInnerR + 0.6,
  drum: 2.4,
  // The stair's core: a real column, as in every reference, filling the
  // helix's central void (WORLD.shaftR) bar a hand's breadth.
  column: 1.45,
  bowlRadius: 7,
  // Its depth as a fraction of its radius: a shallow bowl, not a hemisphere.
  bowlDepth: 0.6,
  bowlRim: WORLD.roomHeight + 2.4 + 12,
};

// The service risers: columns that run the full height of the shaft, just
// inside the rings' inner edge, each with a caged lamp at every level. Every
// landing deck sits at a multiple of 60 degrees (the helix turns 13/6 per
// level), so the risers stand on the bisectors between them and can never
// come up through a deck. They used to sit at 0.6/2.1/3.6/5.1 rad, and two of
// those pierced the deck of every third level.
export const RISERS = {
  r: WORLD.ringInnerR - 0.85,
  angles: Array.from({ length: 6 }, (_, k) => Math.PI / 6 + (k * Math.PI) / 3),
  // Radius of the widest part (the flange collars).
  radius: 0.78,
};

// The gallery columns: the great round columns standing on the inner edge of
// every gallery and running unbroken from the bottom of the silo to the top
// level, with an opal ring lamp under each slab they pass (silo-1, silo-2,
// silo-3, silo-19, the production's Vectorworks model). They used to be short
// posts in the middle of each gallery, one storey tall under a false ceiling.
//
// Same bearings on every level, or they would not be columns. Landing decks
// sit at multiples of 60 degrees and the risers on the bisectors between, so
// the columns stand 21.5 degrees either side of each deck bearing: clear of
// any level's deck (15.5 degrees wide) and of the risers.
export const GALLERY_COLUMNS = {
  r: WORLD.ringInnerR + 0.1,
  radius: 0.62,
  angles: Array.from({ length: 12 }, (_, k) => Math.floor(k / 2) * (Math.PI / 3) + (k % 2 ? 1 : -1) * 0.375),
};

// The storeys of a level. A level is 8.23m floor to floor; the gallery runs
// the full height of it, open to the underside of the slab above, and the
// facade behind it is two storeys of apartments and services: doors on the
// gallery, then a second storey with balconies reached by small stairs.
export const FACADE = {
  // Floor of the upper storey's balconies, from the level's own floor.
  upperFloor: 3.6,
  // Underside of the slab above.
  top: LEVEL_HEIGHT - SLAB_THICKNESS,
};

// Nearest bearing to `wanted` where a bay of `halfWidth` clears every riser,
// every gallery column, the level's own landing deck and the bays already
// placed.
function clearBayBearing(wanted, halfWidth, landing, placed) {
  const gap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const riserHalf = Math.asin(RISERS.radius / RISERS.r);
  const columnHalf = Math.asin(GALLERY_COLUMNS.radius / GALLERY_COLUMNS.r);
  const clear = (b) =>
    RISERS.angles.every((r) => gap(b, r) >= halfWidth + riserHalf + 0.05) &&
    GALLERY_COLUMNS.angles.every((c) => gap(b, c) >= halfWidth + columnHalf + 0.04) &&
    gap(b, landing) >= halfWidth + WORLD.landingHalfAngle + 0.06 &&
    placed.every((p) => gap(b, p.bearing) >= halfWidth + p.halfWidth + 0.1);
  // Clear windows come every 60 degrees, and the one on the deck is never
  // free, so the search may have to go most of a sextant either way.
  for (let step = 0; step < 640; step++) {
    const d = Math.ceil(step / 2) * 0.01 * (step % 2 ? 1 : -1);
    if (clear(wanted + d)) return wanted + d;
  }
  return wanted; // not reached: five of the six windows round the ring are always free
}

// The upper cafeteria (js/world/cafeteria.js): a round hall, its diameter the
// level's roomDepth. Here rather than beside the geometry because the
// collision runs in plain Node.
export const CAFETERIA = {
  height: 4.6,
  // How far the walkable floor stops short of the wall; the pilasters stand
  // proud of it by this much.
  wallClearance: 0.22,
};

export const PLAYER_SPEED = {
  walk: 3.8,
  sprint: 7.0,
  mouseSensitivity: 0.0022,
};

// Vertical zoning, straight from the structural cutaway reference: which
// band of the silo each level number belongs to. Used for HUD context and
// to sanity-check that each station sits in the right band.
// Four bands, matching the 3D cutaway and the names the show itself uses.
// This replaces a five-band split read off silo-layout.JPG; where the two
// references disagreed, the 3D map won.
export const ZONES = [
  { name: "SILO SUPERIOR", from: 1, to: 49 },
  { name: "OS MÉDIOS", from: 50, to: 119 },
  { name: "FUNDO DO SILO", from: 120, to: 144 },
  { name: "ABAIXO", from: 145, to: 148 },
];

export function zoneForLevel(level) {
  return ZONES.find((z) => level >= z.from && level <= z.to) || ZONES[ZONES.length - 1];
}



// The hand-built floors, ordered top -> bottom. Where the production's own
// shaft maps say where a department is (new-references 079-080: the
// full-length floor maps and the deputy-station call signs), the level is
// theirs: the sheriff, holding, administration and the airlock beside the
// cafeteria on 1, deputy stations every eighteen levels or so (18, 36, 54,
// 69, 87, 105, 123, 141), IT on 34, judicial on 39, agriculture 66, the
// marketplace 68, medical 73. The rest (schools, water, mechanical) keep the
// project's own placing; the maps do not settle them.
export const STATIONS = [
  {
    level: 1,
    id: "topo",
    name: "TOPO",
    subtitle: "Cafeteria e Saída Controlada",
    wall: 0x8a95a0,
    floor: 0x6b747c,
    accent: 0xdfe9f0,
    light: 0xaecbe0,
    fog: 0x7e8b96,
    // A round hall: roomHalfW is its radius, roomDepth its diameter.
    roomShape: "round",
    roomHalfW: 12.5,
    roomDepth: 25,
    propType: "topo",
    lore: [
      "O ecrã mostra o mundo lá fora: colinas mortas sob um céu da cor de ferrugem.",
      "Ninguém sabe ao certo há quanto tempo os sensores não são limpos.",
      "É proibido perguntar por quê. É permitido apenas olhar.",
    ],
  },
  {
    level: 18,
    id: "ninho",
    name: "DELEGACIA",
    subtitle: "Posto de Delegados do Alto",
    wall: 0x8f8368,
    floor: 0x655c48,
    accent: 0xe0b96a,
    light: 0xffb15a,
    fog: 0x6e6250,
    roomHalfW: 4.5,
    roomDepth: 10,
    propType: "ninho",
    lore: [
      "O xerife fica no Topo. Aqui embaixo, quem atende é o delegado de plantão.",
      "Cada posto tem um código de chamada. O deste é o 18, e o rádio nunca fica mudo.",
      "Uma cela vazia é uma boa notícia. Raramente dura o dia todo.",
    ],
  },
  {
    level: 28,
    id: "residencial",
    name: "RESIDENCIAL",
    subtitle: "Apartamentos e Salões",
    wall: 0xa08b72,
    floor: 0x6d5c49,
    accent: 0xffc98a,
    light: 0xffc07a,
    fog: 0x7a6853,
    roomHalfW: 5.5,
    roomDepth: 12,
    propType: "residencial",
    lore: [
      "Cinco metros por família, quando a família tem sorte no sorteio.",
      "As paredes são finas o bastante para todos saberem de todos.",
      "Ninguém aqui pendura nada pesado: o concreto é velho e tem memória.",
    ],
  },
  {
    level: 34,
    id: "ti",
    name: "TI",
    subtitle: "Central de Dados e Comunicações",
    wall: 0x6f7a84,
    floor: 0x4c545b,
    accent: 0x8fd0ff,
    light: 0x6fc3ff,
    fog: 0x49535c,
    roomHalfW: 5,
    roomDepth: 12,
    propType: "ti",
    lore: [
      "Servidores guardam cada palavra dita nos últimos cento e quarenta anos.",
      "E decidem, em silêncio, quais dessas palavras o Silo pode ouvir de novo.",
      "Atrás da porta do Cofre há uma voz. Ela não é daqui, e só o chefe de TI pode ouvi-la.",
    ],
  },
  {
    level: 39,
    id: "judicial",
    name: "JUDICIAL",
    subtitle: "Governança e o Pacto",
    wall: 0x6e6862,
    floor: 0x4a4642,
    accent: 0xc23b3b,
    light: 0xd45a3f,
    fog: 0x5c534c,
    roomHalfW: 5.5,
    roomDepth: 12,
    propType: "judicial",
    lore: [
      "O Pacto foi escrito antes de qualquer pessoa viva ter nascido.",
      "Aqui, ele é lido em voz alta - e depois, aplicado sem exceções.",
      "Quem escreveu o Pacto não mora neste Silo. Isso não está escrito em lugar nenhum.",
    ],
  },
  {
    level: 40,
    id: "creche",
    name: "CRECHE E ESCOLA",
    subtitle: "Ala de Ensino",
    wall: 0x9c8f74,
    floor: 0x6b6050,
    accent: 0xf2e2b8,
    light: 0xffdfa0,
    fog: 0x796d58,
    roomHalfW: 4.8,
    roomDepth: 10,
    propType: "creche",
    lore: [
      "As crianças aprendem os números dos andares antes de aprender a somar.",
      "Ninguém aqui já viu o céu. Todos sabem exatamente como descrevê-lo.",
      "O direito de ter um filho é sorteado. A sala está sempre cheia mesmo assim.",
    ],
  },
  {
    level: 66,
    id: "rocas",
    name: "AS ROÇAS",
    subtitle: "Fazendas e Jardins",
    wall: 0x5c6e52,
    floor: 0x3f4d3a,
    accent: 0xa9ff8a,
    light: 0xbfffb0,
    fog: 0x4c5a44,
    roomHalfW: 6,
    roomDepth: 13,
    propType: "rocas",
    lore: [
      "As luzes nunca desligam. Aqui embaixo, o dia e a noite são um horário de trabalho.",
      "Cada semente colhida é contada, registrada e replantada sem exceção.",
      "Um andar inteiro de verde, cercado de quilômetros de concreto cinzento.",
    ],
  },
  {
    level: 68,
    id: "bazar",
    name: "O BAZAR",
    subtitle: "Lojas, Bar e Alfaiataria",
    wall: 0x8c7550,
    floor: 0x5f4f38,
    accent: 0xe8b25a,
    light: 0xffb84d,
    fog: 0x6b573c,
    roomHalfW: 6.5,
    roomDepth: 13,
    propType: "bazar",
    lore: [
      "Tudo aqui já foi outra coisa antes. Nada sai do Silo, nada se perde de vez.",
      "Reciclagem não é uma política. É a única forma de continuar existindo.",
      "Dizem que dá para trocar qualquer coisa por qualquer coisa, se souber com quem falar.",
    ],
  },
  {
    level: 73,
    id: "enfermaria",
    name: "ENFERMARIA",
    subtitle: "Médico, Botica e Berçário",
    wall: 0x9aa7a4,
    floor: 0x66726f,
    accent: 0xd8f0ea,
    light: 0xcfe8e2,
    fog: 0x66736f,
    roomHalfW: 5.2,
    roomDepth: 12,
    propType: "enfermaria",
    lore: [
      "Remédio aqui se mede em gotas e se anota em três livros diferentes.",
      "Todo nascimento é registrado no mesmo minuto em que uma morte é confirmada.",
      "O médico sabe o nome de todo mundo. É a profissão mais perigosa do Silo.",
    ],
  },
  {
    level: 102,
    id: "agua",
    name: "TRATAMENTO DE ÁGUA",
    subtitle: "Estação Hidráulica",
    wall: 0x445a5c,
    floor: 0x2e3f40,
    accent: 0x6fd8d0,
    light: 0x59c2c9,
    fog: 0x35474a,
    roomHalfW: 5.5,
    roomDepth: 13,
    propType: "agua",
    lore: [
      "Toda gota que alguém bebe no Silo já passou por aqui centenas de vezes.",
      "Os canos são mais velhos que o Pacto e reclamam disso constantemente.",
      "Se as bombas parassem, o Silo inteiro afogaria de baixo para cima. Dizem que já aconteceu em algum lugar.",
    ],
  },
  {
    level: 128,
    id: "mecanica",
    name: "MECÂNICA",
    subtitle: "Oficinas e Engenharia Pesada",
    wall: 0x4a4238,
    floor: 0x2b2620,
    accent: 0xffab4d,
    light: 0xff9a3c,
    fog: 0x3a332b,
    roomHalfW: 6,
    roomDepth: 14,
    propType: "mecanica",
    lore: [
      "Quem nasce aqui embaixo aprende cedo: o Silo inteiro depende deste barulho.",
      "As mãos ficam manchadas de graxa para sempre, mesmo as de quem já subiu de posto.",
      "Ninguém do Alto Escalão desce até aqui. O ar já avisa por quê.",
    ],
  },
  {
    level: 144,
    id: "gerador",
    name: "O GERADOR",
    subtitle: "Núcleo de Energia - Nível 144",
    wall: 0x3a2620,
    floor: 0x241713,
    accent: 0xff6a2e,
    light: 0xff5522,
    fog: 0x3d2018,
    roomHalfW: 7,
    roomDepth: 15,
    // The generator hall is monumental (new-references 089-098): three
    // storeys of turbine, platforms and pipework. Nothing stands over a
    // level-144 wing, and 9.4m keeps a roof within one level of the floor.
    roomHeight: 9.4,
    propType: "gerador",
    lore: [
      "Este é o coração: gira há mais tempo do que qualquer registro consegue provar.",
      "Se ele parar, para tudo - as luzes, a água, os cento e quarenta e quatro andares.",
      "Você chegou ao fundo do poço. Acima de você, todo o resto do mundo que sobrou.",
    ],
  },
  {
    level: 145,
    id: "escavador",
    name: "O VÃO DO ESCAVADOR",
    subtitle: "Abaixo do Nível 144",
    isSublevel: true,
    wall: 0x453a33,
    floor: 0x2a211c,
    accent: 0xff8a3c,
    light: 0xd98a4a,
    fog: 0x2b211b,
    roomHalfW: 8,
    roomDepth: 16,
    propType: "escavador",
    lore: [
      "A laje que selava isto tem nove metros de espessura. Alguém abriu mesmo assim.",
      "A máquina que cavou o Silo foi deixada aqui embaixo, virada para a rocha.",
      "Trezentos anos de túneis se cruzam além desta parede. Nenhum deles consta no Pacto.",
    ],
  },
  {
    level: 146,
    id: "minas",
    name: "AS MINAS",
    subtitle: "Frente de Escavação",
    isSublevel: true,
    wall: 0x3f352d,
    floor: 0x261e19,
    accent: 0xffa04d,
    light: 0xd07a3a,
    fog: 0x261d17,
    roomHalfW: 7,
    roomDepth: 15,
    propType: "minas",
    lore: [
      "O minério que mantém a Mecânica viva sai daqui, e sai cada vez mais fundo.",
      "Os turnos são medidos em lâmpadas: quando a sua apaga, você sobe.",
      "Ninguém registra o que se encontra aqui além de pedra. Nem tudo é pedra.",
    ],
  },
  {
    level: 147,
    id: "caverna",
    name: "A CAVERNA",
    subtitle: "Cavidade e Estruturas Antigas",
    isSublevel: true,
    wall: 0x37302c,
    floor: 0x211b18,
    accent: 0x8fb2a8,
    light: 0x9ab0a8,
    fog: 0x1e1917,
    roomHalfW: 8,
    roomDepth: 17,
    propType: "caverna",
    lore: [
      "O Silo foi construído dentro de algo que já estava aqui.",
      "As paredes daqui não têm marca de escavadeira: são lisas, e mais antigas.",
      "O Pacto não menciona este lugar. Nenhuma edição dele jamais mencionou.",
    ],
  },
  {
    level: 148,
    id: "limiar",
    name: "O LIMIAR",
    subtitle: "Abaixo de Tudo",
    isSublevel: true,
    wall: 0x2e2a2a,
    floor: 0x1b1717,
    accent: 0xc8481c,
    light: 0xb4502a,
    fog: 0x191515,
    roomHalfW: 7,
    roomDepth: 14,
    propType: "limiar",
    lore: [
      "Trezentos anos de túneis passam por aqui, e nenhum deles foi cavado por nós.",
      "Há um cabo nesta parede que não alimenta nada dentro do Silo 18.",
      "Se existe um lado de fora que não seja veneno, ele começa deste lado.",
    ],
  },
];

// Extra fraction of a turn on every flight, so each station lands 60 degrees
// around from the one above. The 3D cutaway alternates its three landings by
// 60 degrees between levels for exactly this reason: at a whole number of
// turns per level every floor stacks at the same angle, and looking down the
// shaft shows one silhouette repeating forever.
const STATION_ROTATION = 1 / 6;

// Turns of stairs between each consecutive pair of stations, DERIVED from the
// level numbers at the reference's 2 turns per level instead of hand-tuned.
// The stair now descends as many levels as its own plaques claim. Every entry
// stays >= 2 (one level apart is already 2 turns), which is what the headroom
// clearance in test/layout.test.mjs needs.
export const TRANSIT_TURNS = STATIONS.slice(1).map((station, i) => {
  const levels = Math.max(1, station.level - STATIONS[i].level);
  return levels * TURNS_PER_LEVEL + STATION_ROTATION;
});


// --- Derived layout: precomputes the angle/height of every station and the
// stair "slope" that connects each consecutive pair. Nothing here depends on
// three.js so it can run (and be unit-checked) in plain Node. ---
// Every numbered level of the silo, authored or generated. The twelve-odd
// hand-written entries in STATIONS are the landmarks; the rest of the 148 are
// filled in from them, so the whole silo is walkable instead of a dozen floors
// separated by scenery. A generated level inherits its palette by interpolating
// between the authored levels above and below it, which keeps the descent
// reading as one continuous gradient rather than twelve abrupt changes.
export const DEEPEST_LEVEL = 148;

// The concrete. Every reference shows the same grey poured concrete from the
// top of the silo to the bottom; what tells one sector from another is its
// light and what is in it, not the colour of its walls. So walls, floors and
// haze come from this one material, darkening with depth (the production notes
// describe the lower levels as damp and grimy), and each level's own `light`
// and `accent` carry its identity. The per-sector wall/floor/fog colours in
// STATIONS are kept as data but no longer reach a surface.
//
// Cool grey, measured off the production stills: concrete under ambient light
// alone sits at hue ~195-230 and saturation ~0.2 in silo-2 and silo-19. The
// warmth in those frames is the lamps', not the concrete's.
export const CONCRETE = {
  top: { wall: 0x939ca3, floor: 0x6b7277, fog: 0x78818a },
  bottom: { wall: 0x5b5f63, floor: 0x3b3e41, fog: 0x2a2e32 },
  // How much of a level's own light colour tints its haze.
  sectorHaze: 0.12,
};

export function concreteFor(level, light) {
  const t = Math.min(1, Math.max(0, (level - 1) / (DEEPEST_LEVEL - 1)));
  // The upper silo stays pale for longer; the darkening gathers below the mids.
  const e = Math.pow(t, 1.35);
  const { top, bottom } = CONCRETE;
  return {
    wall: lerpHexColor(top.wall, bottom.wall, e),
    floor: lerpHexColor(top.floor, bottom.floor, e),
    fog: lerpHexColor(lerpHexColor(top.fog, bottom.fog, e), light, CONCRETE.sectorHaze),
  };
}

function generatedLevel(n, above, below) {
  const span = below.level - above.level;
  const t = span > 0 ? (n - above.level) / span : 0;
  const zone = zoneForLevel(n);
  return {
    level: n,
    id: `nivel-${n}`,
    name: `NÍVEL ${n}`,
    subtitle: zone.name,
    generated: true,
    isSublevel: n > 144,
    wall: lerpHexColor(above.wall, below.wall, t),
    floor: lerpHexColor(above.floor, below.floor, t),
    accent: lerpHexColor(above.accent, below.accent, t),
    light: lerpHexColor(above.light, below.light, t),
    fog: lerpHexColor(above.fog, below.fog, t),
    roomHalfW: SECONDARY_WING.roomHalfW,
    roomDepth: SECONDARY_WING.roomDepth,
    propType: null,
    lore: null,
  };
}

// The full 1..148 list, authored entries in place and the gaps filled.
export function buildLevels() {
  const authored = new Map(STATIONS.map((s) => [s.level, s]));
  const authoredLevels = STATIONS.map((s) => s.level);
  const levels = [];

  for (let n = 1; n <= DEEPEST_LEVEL; n++) {
    const hit = authored.get(n);
    let level;
    if (hit) level = { ...hit, generated: false };
    else {
      // nearest authored level on each side, clamped at the ends
      const aboveLevel = authoredLevels.filter((l) => l <= n).pop() ?? authoredLevels[0];
      const belowLevel = authoredLevels.find((l) => l >= n) ?? authoredLevels[authoredLevels.length - 1];
      level = generatedLevel(n, authored.get(aboveLevel), authored.get(belowLevel));
    }
    levels.push({ ...level, ...concreteFor(n, level.light) });
  }
  return levels;
}

// --- Derived layout: every level's landing angle and height, plus the stair
// flight between each consecutive pair. Nothing here depends on three.js so it
// can run (and be unit-checked) in plain Node. ---
export function buildLayout() {
  const TAU = Math.PI * 2;
  const stations = buildLevels().map((s, i) => ({
    ...s,
    index: i,
    zone: zoneForLevel(s.level).name,
    // The helix turns TURNS_PER_LEVEL times between one level and the next.
    // That is deliberately not a whole number, so each landing sits 60 degrees
    // round from the one above and the stair works its way around the shaft as
    // it descends.
    theta: i * TURNS_PER_LEVEL * TAU,
    y: -i * LEVEL_HEIGHT,
    // Rotates each level's rooms around the ring so 148 floors are not 148
    // copies of the same silhouette. The landing itself cannot move (the
    // helix decides where that is), but what the ring is furnished with can.
    wingRotation: (i % 6) * (Math.PI / 3) + (i % 2) * 0.18,
    // Bays bulging off the ring into the shaft. In the production renders the
    // floors are not clean circles: rounded balconies push out over the void,
    // and they are where you stand to look up and down the silo. Bearings are
    // offset per level so they do not stack into a column.
    // Each is nudged to the nearest bearing clear of the risers and the deck.
    bays: [1.9, 4.15].reduce((placed, a, k) => {
      const wanted = i * TURNS_PER_LEVEL * TAU + a + (i % 3) * 0.37 + k * 0.11;
      placed.push({ bearing: clearBayBearing(wanted, 0.19, i * TURNS_PER_LEVEL * TAU, placed), halfWidth: 0.19, reach: 2.4 });
      return placed;
    }, []),
  }));

  const slopes = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    slopes.push({
      fromIndex: i,
      toIndex: i + 1,
      thetaStart: a.theta + WORLD.landingHalfAngle,
      thetaEnd: b.theta - WORLD.landingHalfAngle,
      yStart: a.y,
      yEnd: b.y,
    });
  }

  return { stations, slopes };
}
