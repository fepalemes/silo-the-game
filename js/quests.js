// The journey down the silo, after the first steps on level 1: who sends the
// player where, what they say, and the five relics hidden in the side rooms.
// Plain data and pure functions, so the whole chain is tested in Node
// (test/progress.test.mjs); js/main.js only reports what the player did.
//
// All text is the project's own. Names and events are invented for the
// game; nothing here retells an episode.

// The first three steps, on level 1.
export const FIRST_STEPS = [
  { id: "gallery", title: "Atravesse a passarela", hint: "Siga até a galeria circular do nível 1." },
  { id: "record", title: "Examine o registro do Topo", hint: "Siga as placas CAFETERIA. No corredor, olhe a placa à esquerda e pressione E." },
  { id: "screen", title: "Observe o mundo exterior", hint: "Entre na cafeteria e aproxime-se do grande painel ao fundo." },
];

// Hidden in the side rooms of five departments; `room` is the wing (1 = B,
// 2 = C) and `kind` the room it is in (rooms.js places it).
export const RELICS = [
  { id: "livro", station: "judicial", kind: "archive", name: "Livro de figuras", where: "Arquivo do Pacto · 39",
    text: ["Um livro infantil, sem capa. Numa página, um céu azul inteiro sobre uma árvore.", "Ninguém no Silo pintaria um céu dessa cor. Quem pintou tinha visto um."] },
  { id: "semente", station: "rocas", kind: "seedbank", name: "Envelope de sementes", where: "Banco de Sementes · 66",
    text: ["Um envelope de papel pardo. Do lado de fora, à mão: \"maçã — antes\".", "Não há macieiras em nenhum registro do Silo 18."] },
  { id: "retalho", station: "bazar", kind: "tailor", name: "Retalho estampado", where: "Alfaiataria · 68",
    text: ["Um retalho de tecido fino com uma estampa de ondas e uma gaivota.", "O alfaiate jura que veio de um forro de casaco mais velho que o Pacto."] },
  { id: "frasco", station: "enfermaria", kind: "pharmacy", name: "Frasco rotulado", where: "Botica · 73",
    text: ["Um frasco de vidro azul. O rótulo traz o nome de uma farmácia e um endereço de rua.", "Rua. Ninguém aqui sabe exatamente o que é uma rua."] },
  { id: "isqueiro", station: "mecanica", kind: "parts", name: "Isqueiro gravado", where: "Almoxarifado · 128",
    text: ["Um isqueiro de metal, gasto, com o nome de uma cidade gravado.", "A Mecânica guarda tudo o que funciona. Isto ainda acende."] },
];

// The people who move the story, where they stand (rooms.js and
// main-rooms.js place them) and what they say before, during and after
// their part of it.
export const CHARACTERS = {
  xerife: { name: "Xerife Amaral", role: "Xerife do Silo 18", station: "topo",
    idle: ["Você ainda não olhou a tela da cafeteria? Olhe. Todo mundo olha uma vez."],
    quest: ["Então você é o novo carregador. Ótimo.", "Este malote vai lacrado até a Delegacia do 18. Entregue na mão da delegada Ruiz, ninguém mais.", "E não abra. O que não se sabe não pesa na escada."],
    after: ["Entregou? Bom. No Silo, quem cumpre o que promete sobe de posto.", "Se a descida cansar, o menu de pausa leva você aos setores que já conhece."] },
  delegada: { name: "Delegada Ruiz", role: "Posto de Delegados · 18", station: "ninho",
    idle: ["Posto 18. Se for queixa, sente e espere. Se for urgência, grite."],
    quest: ["Malote do xerife. Lacre intacto. Obrigada.", "Já que você desce bem: a Água, no 102, está sem uma válvula há três turnos.", "A peça está com o chefe Nogueira, na Mecânica, no 128. Busque e leve até lá."],
    after: ["O rádio não para hoje. Boa descida."] },
  chefe: { name: "Nogueira", role: "Chefe de turno · Mecânica", station: "mecanica",
    idle: ["Cuidado com a graxa. Aqui embaixo, tudo escorrega menos o horário."],
    quest: ["A válvula da Água? Está pronta faz uma semana, ninguém desceu para buscar.", "Leve ao 102, para a engenheira Tavares. E diga que da próxima vez ela mesma desce.", "Ah, e no meu almoxarifado tem uma coisa que não é peça. Se for curioso, procure."],
    after: ["Entregou? Então a Água bebe de novo. Aqui ninguém agradece, mas todo mundo nota."] },
  engenheira: { name: "Engenheira Tavares", role: "Tratamento de Água · 102", station: "agua",
    idle: ["Não encoste nos tanques. Eles estão mais velhos que você e mais nervosos."],
    quest: ["Finalmente. Com isso o circuito de baixo volta a filtrar.", "Agora, uma coisa entre nós: há objetos de antes espalhados pelo Silo. Relíquias.", "No arquivo do Pacto, no banco de sementes, na alfaiataria, na botica e no almoxarifado da Mecânica.", "Ache as cinco. Depois leve à TI, no 34. Lá alguém vai querer vê-las - e você vai querer ver a cara dele."],
    after: ["Relíquias são proibidas. Saber que existem, não. Ainda."] },
  tecnico: { name: "Técnico Saldanha", role: "TI · Nível 34", station: "ti",
    idle: ["Este setor não recebe visitas. Você não está aqui."],
    quest: ["Cinco? Você achou as cinco?", "Não deveria existir nenhuma. O Pacto diz que nada de antes atravessou a porta.", "Atrás daquela porta tem uma voz que vai perguntar por você. Desça. Bem fundo.", "No 148, no Limiar, há um registro que ninguém lê. Leia."],
    after: ["Não me pergunte o que o Cofre disse. Pergunte por que ele sabia o seu nome."] },
};

export const JOURNEY = [
  { id: "sheriff", title: "Apresente-se ao xerife", hint: "No nível 1, siga a placa XERIFE. O xerife está no escritório envidraçado do posto.", talk: "xerife" },
  { id: "pouch", title: "Leve o malote à Delegacia do 18", hint: "Desça a escadaria até o nível 18 e fale com a delegada no balcão.", talk: "delegada" },
  { id: "valve", title: "Busque a válvula na Mecânica", hint: "Desça ao nível 128. O chefe de turno está na oficina principal.", talk: "chefe" },
  { id: "water", title: "Entregue a válvula na Água", hint: "Suba ao nível 102. A engenheira está entre os tanques.", talk: "engenheira" },
  { id: "relics", title: "Ache as cinco relíquias", hint: "", relics: true },
  { id: "vault", title: "Leve as relíquias à TI", hint: "No nível 34, fale com o técnico diante do Cofre.", talk: "tecnico" },
  { id: "bottom", title: "Desça ao fundo de tudo", hint: "Nível 148, o Limiar. Leia o registro no corredor.", record: "limiar" },
];

export const STEPS = [...FIRST_STEPS, ...JOURNEY];

export const currentStep = (completed) => STEPS.find((s) => !completed.includes(s.id)) || null;

// What the panel says about a step: the relic hunt lists what is left.
export function hintFor(step, items = []) {
  if (!step) return "Você chegou ao fim desta história. O silo continua aberto: explore.";
  if (!step.relics) return step.hint;
  const left = RELICS.filter((r) => !items.includes(r.id));
  return `Faltam ${left.length}: ${left.map((r) => r.where).join(" · ")}.`;
}

// Steps that complete themselves from what has already happened: relics found
// before the hunt began, a record read before the step that asks for it.
// Returns the ids to mark complete, in order.
export function settle(completed, items = [], records = []) {
  const done = [...completed], added = [];
  for (let step = currentStep(done); step; step = currentStep(done)) {
    const ready = (step.relics && RELICS.every((r) => items.includes(r.id))) || (step.record && records.includes(step.record));
    if (!ready) break;
    done.push(step.id);
    added.push(step.id);
  }
  return added;
}

// Talking to someone: what they say, and the step it completes, if theirs is
// the one under way. Nobody skips ahead - the delegate has no pouch to take
// until the sheriff has handed it over.
export function talkTo(id, completed) {
  const who = CHARACTERS[id];
  if (!who) return null;
  const step = currentStep(completed);
  const mine = JOURNEY.find((s) => s.talk === id);
  const firstDone = FIRST_STEPS.every((s) => completed.includes(s.id));
  if (step && step.talk === id && firstDone) return { title: `${who.name} · ${who.role}`, lines: who.quest, complete: step.id };
  if (mine && completed.includes(mine.id)) return { title: `${who.name} · ${who.role}`, lines: who.after, complete: null };
  return { title: `${who.name} · ${who.role}`, lines: who.idle, complete: null };
}
