// ---------------------------------------------------------------------------
// Core tunables. Distances are in meters, angles in radians.
// ---------------------------------------------------------------------------

export const WORLD = {
  shaftR: 1.0, // inner void / center hole radius (also stair inner edge)
  stairOuterR: 3.0, // outer edge of stair treads / stair railing
  landingR: 4.6, // outer edge of a station's circular landing floor
  corridorHalfW: 1.6,
  corridorLen: 9,
  plateauHalfAngle: 0.48, // angular half-width of the flat area at each station
  risePerTurn: 8, // meters descended per full 360 degree turn of stairs
  stepsPerTurn: 40,
  playerRadius: 0.35,
  eyeHeight: 1.65,
  roomHeight: 3.4,
};

export const PLAYER_SPEED = {
  walk: 3.0,
  sprint: 5.6,
  mouseSensitivity: 0.0022,
};

// Turns of stairs between each pair of consecutive stations (length = STATIONS.length - 1)
export const TRANSIT_TURNS = [2, 2, 2, 2.5, 2, 2, 2.5, 3, 3.5];

// Palette + content for each of the ten hand-built floors, ordered top -> bottom.
export const STATIONS = [
  {
    level: 1,
    id: "topo",
    name: "TOPO",
    subtitle: "Sala de Observação",
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
    level: 12,
    id: "ti",
    name: "TI",
    subtitle: "Tecnologia da Informação",
    wall: 0xaab4bd,
    floor: 0x707a82,
    accent: 0x8fd0ff,
    light: 0x6fc3ff,
    fog: 0x6c7a86,
    roomHalfW: 5,
    roomDepth: 12,
    propType: "ti",
    lore: [
      "Servidores guardam cada palavra dita nos últimos cento e quarenta anos.",
      "E decidem, em silêncio, quais dessas palavras o Silo pode ouvir de novo.",
      "A porta ao fundo nunca é aberta quando alguém está a olhar.",
    ],
  },
  {
    level: 23,
    id: "judicial",
    name: "JUDICIAL",
    subtitle: "Câmara de Julgamento",
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
      "Limpeza é a palavra que ninguém diz alto perto das crianças.",
    ],
  },
  {
    level: 34,
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
    level: 52,
    id: "bazar",
    name: "O BAZAR",
    subtitle: "Mercado dos Médios",
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
    level: 67,
    id: "rocas",
    name: "AS ROÇAS",
    subtitle: "Nível de Cultivo",
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
    level: 81,
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
    level: 98,
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
      "Em dias ruins, dá pra ouvir a água se mover três andares acima.",
    ],
  },
  {
    level: 121,
    id: "mecanica",
    name: "MECÂNICA",
    subtitle: "Oficinas e Geradores Auxiliares",
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
    subtitle: "Poço Fundo - Nível 144",
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
];

// --- Derived layout: precomputes the angle/height of every station and the
// stair "slope" that connects each consecutive pair. Nothing here depends on
// three.js so it can run (and be unit-checked) in plain Node. ---
export function buildLayout() {
  const TAU = Math.PI * 2;
  const stations = STATIONS.map((s) => ({ ...s }));

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
