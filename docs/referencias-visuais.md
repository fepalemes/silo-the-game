# Direção visual e verificação — 13/09/2026

Foram inspecionadas as **21 imagens** de `references/`. A pasta mistura cenas, concept art, modelos 3D e diagramas de fãs; não é uma planta oficial única. As medidas e os níveis já existentes no projeto foram preservados. O jogo continua sendo exploração livre, sem combate.

## Imagens locais e aplicação

| Referências | Elementos usados |
| --- | --- |
| `silo-1`, `silo-2`, `silo-3`, `silo-19` | Escadaria contínua de concreto, guarda-corpos maciços, galerias e luminárias curtas nos pilares. |
| `silo-4`, `silo-5`, `silo-6`, `silo-7` | Curvatura dos degraus e paredes, espaço entre escada e anel, encontros entre pontes e patamares. São referências de modelagem, não prova de medidas oficiais. |
| `silo-8` | Profundidade do vão, silhueta industrial e separação entre luzes práticas e névoa. |
| `silo-9`, `silo-12` | Canteiros organizados, verde vegetal sem emissão luminosa, corredores entre cultivos. |
| `silo-10` | Instalações reaproveitadas, materiais gastos e identificação das entradas. |
| `silo-11` | Mesas e bancos comunitários; área social com rotas de circulação. |
| `silo-13`, `silo-14`, `silo-15`, `silo-16` | Interiores residenciais: faixa terracota, assentos, tapete, plantas e iluminação quente. |
| `silo-17`, `silo-18` | Bancadas analógicas, instrumentos, gabinetes metálicos e tecnologia utilitária. |
| `silo-18-dimensions-plans-v0-ttvpst089knh1`, `silo-layout` | Escala geral e distribuição vertical. Diagramas interpretativos; suas divergências não foram convertidas em alegações sobre o cânone. |

## Pesquisa atualizada

- [Apple TV — terceira temporada, trailer e sinopse, 02/06/2026](https://www.apple.com/tv-pr/news/2026/06/apple-tv-unveils-trailer-for-third-season-of-its-globally-acclaimed-drama-silo-starring-and-executive-produced-by-rebecca-ferguson/): temporada com dez episódios, de 3 de julho a 4 de setembro de 2026. A sinopse situa Juliette de volta ao silo após a limpeza, com perda de memória, e intercala a origem do sistema séculos antes. Isso orienta o contexto; o jogo não tenta reencenar o final ou inventar revelações dos episódios.
- [Apple TV — estreia da terceira temporada](https://www.apple.com/tv-pr/news/2026/06/apple-tv-celebrates-the-upcoming-season-three-premiere-of-its-hit-world-building-drama-silo-starring-and-executive-produced-by-rebecca-ferguson/): confirmação do calendário até 4 de setembro.
- [Motion Picture Association — entrevista com Morten Tyldum, 18/06/2024](https://www.motionpictures.org/2024/06/silo-director-executive-producer-morten-tyldum-on-helming-rebecca-fergusons-sci-fi-western-mystery/): arquitetura brutalista, módulos arredondados, objetos usados e reparados, computadores volumosos e lógica funcional para a construção. A tradução visual no jogo usa geometrias curvas, concreto desgastado e instrumentos analógicos.

Os registros de ambientação são textos autorais do protótipo, não diálogos transcritos. A localização exata dos departamentos e os quatro subsolos 145–148 continuam sendo escolhas da adaptação existente. Não são apresentados aqui como confirmações da terceira temporada.

## Alterações concretas

- Degraus em setores curvos sólidos e guarda-corpos contínuos, com coordenadas de textura em metros.
- Pontes com guarda-corpos nas bordas corretas e abertura na ligação ao anel em ambos os lados da volta angular.
- Colunas e mobília com volumes de colisão; andares genéricos fechados conforme a geometria visível.
- Fachadas fechadas entre as galerias, vigas, placas de nível e sinalização das alas.
- Luminárias em faixas com ferragens; retirada das linhas azuis contínuas no vão.
- Mesas e bancos da cafeteria, vegetação sem brilho próprio, assentos e instrumentos analógicos.
- Dez luzes pontuais ativas, selecionadas pela proximidade, e descarte de grupos por altura. Essa é uma limitação de custo de renderização, não uma medição de FPS em GPU real.
- Pausa e leitura de registros suspendem o movimento. Perda de foco limpa teclas pressionadas. Passos dependem de deslocamento real. `M` alterna o áudio.
- Falha de inicialização ou captura do mouse oferece mensagem e nova tentativa.

## Limites

O resultado continua procedural e estilizado, não fotorrealista. Não inclui personagens, animação de multidão, materiais fotogramétricos, sombras dinâmicas ou reconstrução exata de todos os ambientes da série. As colisões da mobília usam volumes conservadores. O carregamento de Three.js depende da CDN; falhas agora têm uma mensagem de recuperação.

## Trecho exemplar: cafeteria → galeria → ponte → escada

O primeiro andar recebeu uma camada adicional de detalhe:

- Piso mineral, madeira e metal pintado com mapas separados de cor, relevo e
  rugosidade. São materiais procedurais; não são digitalizações de superfícies.
- Portas arredondadas com ferragens, pequenas janelas e grelhas; conduítes e
  braçadeiras acompanham a parede. As portas permanecem fechadas.
- Mesas e bancos com bordas arredondadas, louça, quadro de avisos, rodapés e
  instalações aparentes na cafeteria. As formas principais conservam os
  corredores de circulação; novas saliências recebem volumes de colisão.
- Uma luz de projeção com mapa de sombras de 1024 × 1024, calculado para o
  cenário estático da cafeteria. Sombras de contato suaves sob pilares e
  bancos são aproximações desenhadas no piso. A luz de preenchimento próxima
  ao painel aproxima iluminação refletida; não há iluminação global real.
- Fixações nos guarda-corpos da ponte e faixas de desgaste/aderência nos dois
  primeiros lances de escada.
- Paisagem externa gerada por IA, armazenada em `assets/exterior-camera-v1.png`,
  com preservação de proporção e fallback procedural.

Esta intervenção representa o silo em uso cotidiano, sem atribuir os danos a
um evento específico da terceira temporada. Os demais setores conservam o
nível de detalhe anterior. O refinamento ainda não representa uma réplica
fotorrealista dos cenários de filmagem.

A opção `?shadows=0` desativa mapas de sombras para comparar custo e aparência.
A câmera `?view=cafeteria&hud=0` mostra a sala a partir da entrada. A checagem
`npm run test:exemplar`, com Playwright disponível, valida as quatro vistas,
o caminho da escada à cafeteria, a imagem, o fallback e o orçamento de luzes.

## Continuação: galeria e entradas do nível 1

- Luminárias com difusor e grade em torno dos pilares, associadas a fontes
  locais de luz quente. Um segundo mapa de sombra estático, de 512 × 512,
  atende à galeria; o mapa de 1024 × 1024 continua atendendo à cafeteria.
- Molduras, fixações e bandejas de cabos nas entradas das alas. A placa da
  cafeteria foi reposicionada para acompanhar a moldura. Os montantes ficam
  fora da largura útil da passagem.
- Identificação dos compartimentos, caixas de serviço e desgaste localizado
  nas portas e paredes. Os textos são sinalização autoral da adaptação.
- O conjunto de dez luzes pontuais conserva suas posições enquanto cada fonte
  continua selecionada. A seleção considera intensidade e distância, com uma
  margem que evita alternância na fronteira entre duas fontes. Fontes novas
  entram gradualmente, após a redução da anterior, inclusive se o jogador
  parar durante a transição.

`npm test` também cobre as transições de luz em `test/lightpool.test.mjs`.
`npm run test:exemplar` verifica os dois mapas de sombra e o trajeto completo.
A câmera `?view=entrada&hud=0` enquadra o acesso principal à cafeteria.
A iluminação indireta continua aproximada: não foi implementada iluminação
 global ou sombras de todas as fontes pontuais.

### Escadas e passarela — 14/09/2026

As imagens `silo-2.jpg`, `silo-3.jpeg` e `silo-6.jpeg` orientam a continuidade
dos parapeitos de concreto e o acabamento gasto da circulação. O mapeamento
dos degraus agora varia por peça, sem alterar a escala da textura, para reduzir
a repetição das mesmas fissuras. Os dois primeiros trechos têm bordas claras
desgastadas e dois insertos estreitos de acabamento antiderrapante. Esses
insertos são interpretação visual para o jogo, não um detalhe confirmado da série.

A passarela do nível 1 ganhou juntas de concretagem e marcas localizadas de
escorrimento na face interna dos parapeitos. As juntas usam um único lote
instanciado. Os detalhes ficam sobre as superfícies existentes, preservando
a largura da passagem e o perfil de colisão da escada; nenhuma luz foi adicionada.

## Primeira ala residencial e continuidade estrutural

O nível 28 recebeu três apartamentos, lavanderia, depósito e oficina, ligados
por corredor principal de 4,4 m. As referências locais `silo-13` a `silo-16`
orientam a faixa terracota, a madeira, o mobiliário e a luz quente. A planta,
numeração dos apartamentos e distribuição dos serviços são autorais.

Os três apartamentos compartilham a planta de estar/cozinha, quarto e banheiro,
com variação de cama e tecidos; ainda não são três plantas arquitetônicas
independentes. As portas abrem instantaneamente com E, têm colisão nos dois
estados e persistem no save. Animação interpolada, NPCs e sons locais continuam
pendentes. O restante das alas residenciais conserva o acabamento anterior.

Na escada, cada degrau agora calcula o raio externo nas bordas compartilhadas,
em vez de usar o raio fixo do centro. A espessura acompanha a queda real por
degrau e uma base helicoidal contínua fecha a parte inferior. A inspeção deve
continuar distinguindo frestas involuntárias do vazio central da arquitetura.

## Correções com new-references

A análise das 101 novas imagens está em [catálogo e decisões](catalogo-new-references.md).
As fotografias de set corrigem a interpretação anterior de parapeitos sem tubo:
foram adicionados corrimãos elevados com apoios na escada. Os apartamentos têm
variações de cor e painéis nas portas. Os níveis 1 e 28 receberam mapas autorais
esquemáticos com destinos reais do jogo, seguindo a linguagem gráfica observada.
Cafeteria circular, becos residenciais, domo e organização dos departamentos
continuam como revisões arquitetônicas pendentes, agora fundamentadas no conjunto.

## Erros de construção e fidelidade — 22/11/2026

Esta rodada começou medindo o mundo em vez de procurar erro no olho
(`npm run test:world`, ver README). Corrigido:

- **Alas fora do lugar.** Em 13 dos 16 níveis temáticos, corredor e sala
  eram desenhados 60° ou mais longe da porta e da colisão: a porta abria
  para o vazio e o jogador andava no ar ao lado de um corredor lacrado.
- **Portas emparedadas.** Em quase todo nível temático, a ala cujo rumo
  passava de 2π tinha a parede da galeria desenhada inteira sobre a porta;
  a colisão deixava atravessar. A placa de nível chegou a ser pendurada
  nesse trecho, por ele contar como parede lisa.
- **Salas de três paredes.** Nenhuma sala tinha a parede da frente; de
  costas para o fundo, via-se o casco do silo dos dois lados do corredor.
  A colisão deixava ficar de pé dentro dessa parede ausente.
- **Fresta na galeria.** Laje e teto paravam no raio nominal, mas a parede
  é feita de painéis planos; no pé e no topo de cada painel havia um
  crescente aberto para fora.
- **Placas espelhadas e soltas.** Todo letreiro passou a ter uma face só e,
  quando visto pelo verso, corpo de metal. Placas de nível, avisos de
  segurança e sinalização vão agora *no painel* da parede, nunca sobre uma
  porta ou vigia. As placas da escada estavam metade enterradas na mureta.
  O letreiro de cada ala ficou numa verga sobre a porta, não solto no vão.
- **Canos no patamar.** Dois dos quatro canos verticais de serviço do vão
  atravessavam o patamar de chegada de um terço dos níveis, e algumas
  sacadas eram construídas em volta deles. Agora são seis, nas bissetrizes
  entre os patamares (que estão sempre em múltiplos de 60°), e as sacadas
  se afastam deles. Seis colunas no vão também ficam mais perto de
  `silo-1` e `silo-2` do que quatro.
- **Postes de luminária** de pé nas salas não tinham colisão.
- **Acessórios dos canos desenhados de longe.** Os anéis de luz, braçadeiras
  e grades dos canos eram um lote só para os 148 níveis, desenhado inteiro de
  qualquer ponto (~300 mil triângulos). Agora vêm em blocos de 12 níveis que
  somem com os andares distantes: a vista do poço caiu de ~454 mil para ~140
  mil triângulos.
- **Ala residencial.** Abertura acima do teto do beco no pátio e na praça.
- **Pisos sobrepostos.** O corredor começava 40 cm dentro da galeria, com
  piso e teto coplanares aos dela (cintilação na soleira).
- Saves antigos que caiam dentro do que hoje é parede são recolocados num
  ponto seguro do mesmo nível.

Fidelidade, a partir de `silo-2`, `silo-3` e `silo-19`:

- **Anel de luz opalino em todo pilar**, de todos os níveis (antes só o
  nível 1), com aros e nervuras escuros.
- **Janelas nas fachadas** entre uma galeria e a de cima: cantos
  arredondados, caixilho em cruz, luz âmbar, menos acesas quanto mais fundo.
  É a faixa que se vê do poço, e era uma parede lisa.
- **Placa de nível da produção** (número grande numa faixa no topo,
  diagrama do setor embaixo, `new-references` 010) em todos os níveis, no
  lugar da tarja "008 JUDICIAL" que era invenção do projeto.

### Paleta: concreto cinza da série

Decisão de 22/11/2026: o silo inteiro é o mesmo concreto cinza, e o que
distingue um setor do outro é a cor da sua luz e o que há nele. Antes as
paredes eram tingidas por zona (verde na agricultura, marrom no Judicial,
azul na água).

Medido nas imagens, o concreto iluminado só pelo ambiente fica em matiz
~195–230° e saturação ~0,2 em `silo-2` (fotograma da série) e `silo-19`; só
`silo-3` é quente. O jogo, antes, ficava em matiz 34–62° (bege a oliva) e
saturação até 0,49. Depois da mudança, a faixa de fachada vista do poço mede
matiz 191° e saturação 0,17.

- `CONCRETE` e `concreteFor` em `config.js`: paredes, pisos e névoa de todos
  os 148 níveis, do cinza claro do topo ao escuro e úmido do fundo. A névoa
  guarda 12% da luz do setor. As cores por setor em `STATIONS` ficam como
  dado, sem chegar a nenhuma superfície.
- `STRUCTURE_COLORS` em `materials.js`: escada, muretas, pilares e canos,
  num lugar só. A base da textura de concreto passou a ser neutra, e os
  tons "neutros" de névoa e luz ambiente em `main.js` deixaram de ser oliva.
- `npm test` confere que nenhum nível tem parede ou piso com matiz de setor,
  que o concreto nunca clareia ao descer e que os setores ainda diferem pela
  luz.

### Cafeteria redonda

A sala retangular de 11 × 11 m do nível 1 virou o salão da maquete final da
produção (`new-references` 018–028), em `js/world/cafeteria.js`:

- Planta circular de 25 m de diâmetro, **sem colunas**: a nota da produção
  diz que o diretor quis as cafeterias de cima totalmente abertas, com o teto
  do set pendurado por cima (colunas extras só nas de baixo).
- Teto de caixotões em três anéis, com vigas fundas de fundo arredondado,
  painéis de luz nos anéis externo e do meio e uma roseta de aletas radiais
  num tambor iluminado no centro.
- Tela panorâmica em pílula, curva com a parede, na frente da entrada.
- Entrada em pílula com moldura grossa de concreto, aonde o corredor chega
  (a composição da foto do set, do corredor para dentro).
- 31 mesas de quatro lugares em quatro anéis, com um corredor livre da entrada até a
  tela; balcão de serviço curvo com passa-pratos e porta de enrolar; a
  escotilha da saída controlada; quadro de avisos do turno.
- `roomHalfW` é o raio e `roomDepth` o diâmetro, então pontos de vista,
  teste de layout e o gatilho da missão continuam valendo. A missão "Observe
  o mundo exterior" completa a menos de 7 m da tela.

O que é interpretação: a posição do balcão, da escotilha e do quadro na
parede, e a quantidade de mesas (a maquete tem mais; aqui o salão tem 25 m).

### Domo e coluna central

O teto plano sobre o poço, 3,4 m acima do nível 1, deu lugar ao domo da
produção (`new-references` 040–048, "DOME at top of SHAFT for Main
Lighting"), em `js/world/dome.js`:

- Tambor sobre a galeria do nível 1 (raio 16,6 m), com passarela e
  guarda-corpo na borda, e o hemisfério por cima: o alto fica ~22 m acima do
  piso do nível 1.
- Quatro fileiras de calhas de luz em pílula (120 no total), alinhadas aos
  meridianos, entre 16 nervuras e anéis; escadas de manutenção sobem por
  quatro nervuras.
- A grande luminária: uma tigela larga e rasa sobre o capitel da coluna, com
  a face de baixo em grade de painéis luminosos (as "aletas espelhadas" das
  notas de produção). A luz principal do topo do silo sai dela.
- **Coluna central.** O poste de 0,45 m no meio da escada virou o núcleo
  que aparece em todas as referências: uma coluna de 1,45 m de raio do fundo
  do silo até o capitel, com conduítes subindo pela face; a escada se enrola
  nela.
- Os canos de serviço do vão sobem até a passarela do domo, que apoiam.

Interpretação: as aletas e as calhas da produção giram para criar cenários
de luz; aqui são fixas. Quantidade de calhas e fileiras é aproximada a
partir dos renders.

### Galerias, colunas e fachadas — 22/11/2026

A partir do modelo Vectorworks do poço (`new-references` 029), dos
renderings dos becos (033) e de `silo-1`, `silo-2`, `silo-3` e `silo-19`:

- **Galerias de pé-direito duplo.** Cada galeria tinha um forro a 3,4 m e,
  acima dele, uma faixa recuada com quarenta janelas. Agora ela é aberta até
  a laje de baixo do nível de cima (7,7 m), com vigas e luminárias lineares
  sob a laje, como em `silo-19`. Só o nível 1 mantém o forro: o tambor do
  domo apoia nele.
- **Colunas contínuas na borda.** Os pilares curtos no meio de cada galeria
  viraram doze colunas de 1,24 m de diâmetro, inteiras do fundo do silo até o
  nível 1, na borda das galerias, atravessando o guarda-corpo. Ficam a 21,5°
  de cada rumo de patamar, então nenhuma atravessa patamar, sacada ou cano
  (`npm test` confere em todos os níveis). O anel de luz opalino fica sob
  cada laje que a coluna atravessa.
- **Fachada de dois pavimentos** (`js/world/facade.js`), em todos os níveis
  menos o 1:
  - Embaixo: portas arredondadas com luminária, em cores de porta da série
    (azul-acinzentado, verde-água, madeira, vermelho óxido), janelas acesas e
    apagadas, soleiras.
  - Em cima: sacadas com guarda-corpo preto, blocos que avançam e recuam,
    sótãos, janelas em grade (`silo-3`) e aparelhos de ar.
  - Escadinhas de concreto sobem junto à parede da galeria até um patamar com
    porta. Elas têm colisão.
  - Quanto mais fundo, menos sacadas e janelas acesas, e mais blocos de
    serviço.

  Tudo isso é instanciado em blocos de seis níveis, com nove draw calls por
  bloco, desenhado só perto do jogador. Os painéis lisos continuam livres
  para placas e avisos.

### Departamentos nos níveis da produção

Os mapas do poço feitos para a série (`new-references` 079–080: mapas de
nível, mapas do poço inteiro e os códigos de chamada das delegacias)
situam:

- no nível 1, xerife, cela de espera, administração e airlock junto da
  cafeteria;
- delegacias nos níveis 18, 36, 54, 69, 87, 105, 123 e 141;
- TI no 34, judiciário no 39, agricultura no 66, mercado no 68 e medicina
  no 73.

O jogo passou a seguir isso. A TI saiu do 110 para o 34, o judiciário do 8
para o 39, as roças do 88 para o 66, o bazar do 72 para o 68, a enfermaria
do 56 para o 73. O antigo "Ninho" do xerife virou a delegacia do 18.

Escola, água e mecânica continuam onde estavam, porque os mapas não decidem.
Os identificadores não mudaram, então os registros lidos no save continuam
valendo. Quem salvou dentro de uma sala que mudou de nível é recolocado na
galeria do mesmo nível.

### Salas laterais de cada setor

As alas B e C de cada departamento eram o mesmo depósito com três caixas.
Agora cada uma é uma sala própria (`js/world/rooms.js`, `SIDE_ROOMS` em
`config.js`), por exemplo:

- celas e delegado de plantão na delegacia;
- servidores e comunicações na TI;
- arquivo do Pacto e secretaria no judiciário;
- sala de aula e berçário na escola;
- banco de sementes e estufa nas roças;
- alfaiataria e bar no mercado;
- enfermaria e botica na medicina;
- bombas e laboratório na água;
- oficina e almoxarifado na mecânica;
- sala de controle e vestiário no gerador;
- paiol, lampisteria, levantamento e a caixa de cabos abaixo do 144.

Os móveis vêm de um kit comum (`js/world/kit.js`) mesclado por material.
Cada sala custa umas dez draw calls e registra a colisão dos próprios
móveis.

### Nível 1: xerife e saída controlada

A partir da planta do posto policial (`new-references` 049–057) e dos
desenhos do airlock (058–065):

- **Posto do xerife.** Salão redondo de 13 m com quatro mesas em volta de um
  círculo central, colunas junto à parede e teto de nervuras radiais com
  painéis de luz. Em volta ficam o escritório do xerife atrás de vidro, duas
  celas com grade, a porta da cela de espera 103 e a passagem para a saída.
- **Saída controlada.** Sala dos trajes de limpeza (armários, banco, trajes
  no cabide), a porta interna do airlock aberta, com nervuras radiais e cubo,
  e o airlock azulejado com bicos nas paredes. A porta externa está lacrada,
  com a alavanca vermelha no aro redondo.
- A escotilha da parede da cafeteria passou a ser a casa de máquinas da tela.

### Casa do gerador

A sala do nível 144 virou um salão de 9,4 m (`new-references` 089–098),
com:

- a turbina nervurada sobre a plataforma octogonal com guarda-corpo e
  degraus;
- o anel de curvas de tubo no topo e os tubos subindo ao teto;
- conjuntos de bombas nos cantos;
- a passarela no fundo com escada de aço;
- a janela comprida da sala de controle;
- as mesas de operação viradas para a turbina.

### Residencial (nível 28)

- **O beco virou cânion.** Entre o pátio e a praça, o beco tinha um forro a
  3,4 m que escondia tudo acima das portas: os pavimentos de cima, a galeria
  deles, os patamares das escadas e as próprias luminárias do beco. Agora ele
  sobe a 7,2 m, com testeiras fechando as junções com o pátio e a praça.
- Bow-windows de lados chanfrados saem dos pavimentos de cima, os "volumes
  angulados" do catálogo.
- As portas dos apartamentos ganharam moldura com cantos arredondados e um
  degrau de concreto no nicho.

### Salas principais

As salas dos departamentos também saíram do kit (`js/world/main-rooms.js`):

- **Judiciário:** a audiência do Pacto, com a bancada elevada, o selo na
  parede, a tribuna com o livro e os bancos do público.
- **Delegacia:** o balcão com portinhola, as mesas e o rádio com os códigos
  das delegacias.
- **Escola:** mesinhas redondas, escaninhos, tapete e lousa, e um céu pintado
  na parede por quem nunca viu um.
- **Enfermaria:** leitos de atendimento com foco, camas com cortina, posto
  de enfermagem e armário de vidro.
- **Mercado:** bancas com toldos de pano.
- **Roças:** canteiros elevados com luz de cultivo e irrigação.
- **Água:** dois tanques de decantação com escada, o coletor com volantes e
  o painel de manômetros.
- **TI:** fileiras de gabinetes, a mesa de operação e o Cofre.
- **Mecânica:** oficina de máquinas sob a ponte rolante, com o motor no
  cavalete.

Interpretação: a disposição das salas em volta do posto, a quantidade e a
posição das escadinhas e sacadas, as cores de porta, e os interiores que os
mapas e as fotos não detalham.
