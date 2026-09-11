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
  // to PI: since the spiral stair passes through the same compass direction
  // once per full turn, a hall any wider leaves too little of that turn left
  // over for the stair to actually gain height - the tread directly "one
  // turn up" ends up only ~1.2m above the floor and the player's head clips
  // through it. 2.5 rad (~286 degrees of hall) keeps a safe ~2.6m of
  // clearance everywhere; see the headroom check in test/layout.test.mjs.
  plateauHalfAngle: 2.5,
  risePerTurn: 10, // meters descended per full 360 degree turn of stairs
  stepsPerTurn: 56,
  playerRadius: 0.35,
  eyeHeight: 1.65,
  roomHeight: 3.4,
};

// Every station has its main themed room (offset 0, using STATIONS[i].propType)
// plus a couple of smaller generic wings branching off the same hall, so each
// floor has more than one door/corridor to look at. Purely decorative doors
// are scattered along the rest of the ring wall (see world.js).
export let WING_OFFSETS = [0, 2.15, -2.15];

// Rebuilds WING_OFFSETS with `count` evenly spaced wings. Exported so the
// cost of denser floors can be measured (?wings=N) before committing to it.
export function setWingCount(count) {
  const span = WORLD.plateauHalfAngle - 0.35;
  if (count <= 1) {
    WING_OFFSETS = [0];
    return;
  }
  const step = (span * 2) / count;
  WING_OFFSETS = Array.from({ length: count }, (_, i) => -span + step * (i + 0.5));
}
export const SECONDARY_WING = {
  roomHalfW: 3.2,
  roomDepth: 7,
};

export const PLAYER_SPEED = {
  walk: 3.8,
  sprint: 7.0,
  mouseSensitivity: 0.0022,
};

// Vertical zoning, straight from the structural cutaway reference: which
// band of the silo each level number belongs to. Used for HUD context and
// to sanity-check that each station sits in the right band.
export const ZONES = [
  { name: "SILO SUPERIOR", from: 1, to: 20 },
  { name: "SUPERIOR-MÉDIO", from: 21, to: 50 },
  { name: "SILO MÉDIO", from: 51, to: 80 },
  { name: "MÉDIO-INFERIOR", from: 81, to: 120 },
  { name: "FUNDO DO SILO", from: 121, to: 144 },
];

export function zoneForLevel(level) {
  return ZONES.find((z) => level >= z.from && level <= z.to) || ZONES[ZONES.length - 1];
}

// Turns of stairs between each pair of consecutive stations (length = STATIONS.length - 1).
// Keep every entry >= 2: smaller values steepen the helix enough to break the
// headroom clearance checked in test/layout.test.mjs.
export const TRANSIT_TURNS = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2.5, 3, 2];

// The twelve hand-built floors, ordered top -> bottom. Level numbers follow
// the zoning in the structural cutaway reference (silo-layout): governance
// and the sheriff sit up top, schools and apartments in the upper-middle,
// medical and social in the middle, farms/water/IT in the middle-lower, and
// all heavy machinery in the bottom band.
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
    roomHalfW: 5.5,
    roomDepth: 11,
    propType: "topo",
    lore: [
      "O ecrã mostra o mundo lá fora: colinas mortas sob um céu da cor de ferrugem.",
      "Ninguém sabe ao certo há quanto tempo os sensores não são limpos.",
      "É proibido perguntar por quê. É permitido apenas olhar.",
    ],
  },
  {
    level: 8,
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
    level: 17,
    id: "ninho",
    name: "O NINHO",
    subtitle: "Posto do Xerife",
    wall: 0x8f8368,
    floor: 0x655c48,
    accent: 0xe0b96a,
    light: 0xffb15a,
    fog: 0x6e6250,
    roomHalfW: 4.5,
    roomDepth: 10,
    propType: "ninho",
    lore: [
      "O distintivo já passou por mais mãos do que qualquer um consegue contar.",
      "Manter a paz, aqui, significa sobretudo manter as pessoas em silêncio.",
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
    level: 56,
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
    level: 72,
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
    level: 88,
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
    level: 110,
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
    propType: "gerador",
    lore: [
      "Este é o coração: gira há mais tempo do que qualquer registro consegue provar.",
      "Se ele parar, para tudo - as luzes, a água, os cento e quarenta e quatro andares.",
      "Você chegou ao fundo do poço. Acima de você, todo o resto do mundo que sobrou.",
    ],
  },
  {
    level: 144,
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
];

// --- Derived layout: precomputes the angle/height of every station and the
// stair "slope" that connects each consecutive pair. Nothing here depends on
// three.js so it can run (and be unit-checked) in plain Node. ---
export function buildLayout() {
  const TAU = Math.PI * 2;
  const stations = STATIONS.map((s) => ({ ...s, zone: zoneForLevel(s.level).name }));

  stations[0].theta = 0;
  stations[0].y = 0;
  for (let i = 1; i < stations.length; i++) {
    const turns = TRANSIT_TURNS[i - 1];
    stations[i].theta = stations[i - 1].theta + turns * TAU;
    stations[i].y = stations[i - 1].y - turns * WORLD.risePerTurn;
  }

  const slopes = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    slopes.push({
      fromIndex: i,
      toIndex: i + 1,
      thetaStart: a.theta + WORLD.plateauHalfAngle,
      thetaEnd: b.theta - WORLD.plateauHalfAngle,
      yStart: a.y,
      yEnd: b.y,
    });
  }

  return { stations, slopes };
}
