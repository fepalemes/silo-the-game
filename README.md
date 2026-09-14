# SILO — Descida

Protótipo de exploração em primeira pessoa para navegador, inspirado na estética
da série *Silo* (Apple TV+): concreto bruto, uma escadaria em espiral central
que atravessa todos os andares, e uma paleta que muda conforme você desce —
mais fria e limpa no topo, mais quente e suja perto do fundo.

Isto é um fã-projeto não-oficial. Todo o visual (texturas, modelos, sons) é
gerado por código a partir da estética de referência — nenhuma imagem ou
áudio do programa original é usado.

## Como rodar

Precisa de [Node.js](https://nodejs.org) instalado (qualquer versão recente).
Módulos ES do jogo precisam ser servidos por http:// (não abra o
`index.html` direto no navegador, os `import` vão falhar por causa de CORS).

```bash
npm start
```

Isso sobe um servidor estático simples em `http://localhost:8080`. Abra essa
URL no Chrome, Edge, Firefox ou Safari recentes.

Para rodar os testes de layout/colisão (não precisa de navegador):

```bash
npm test
```

## Conferindo o visual

Abrir o jogo com `?view=<nome>&hud=0` estaciona a câmera num ponto fixo, com
a interface escondida — útil para comparar ângulos depois de mexer na
geometria ou na iluminação:

```
http://localhost:8080/?view=shaft&hud=0
```

Os pontos disponíveis estão em `js/viewpoints.js`: `hub`, `shaft`, `down`,
`up`, `ring`, `bridge`, `room`, `stairs`, `deep`, `void`.

Outros parâmetros de diagnóstico:

| Parâmetro | Efeito |
| --------- | ------ |
| `hud=0`   | esconde a interface |
| `bloom=0` | pula o passe de bloom (captura headless fica bem mais rápida) |
| `wings=N` | reconstrói cada andar com N corredores em vez do padrão |
| `stats=1` | loga o custo da cena uma vez no console |

Para capturar todos de uma vez em `./shots/` (precisa do Chrome instalado e
do servidor rodando):

```bash
./tools/shots.sh            # todos
./tools/shots.sh shaft room # só esses
```

Renderiza por software, então cada captura leva alguns minutos.

## Dimensões x referências

Duas referências quantitativas, que discordam entre si:

- `references/silo-18-dimensions-plans-v0-*.webp` — corte transversal com
  ~120m de diâmetro, 144 níveis, ~716m de altura (~5m por nível).
- O mapa 3D interativo em `3dscenes.qualityf2p.workers.dev/silo`, cujo bundle
  é legível e dá números exatos: **7,6m por nível, 2 voltas de escada por
  nível, 22 degraus por volta, escada de raio 1,5m a 5,5m, corrimão a 1,09m**,
  zonas Up Top 1-49 / Mids 50-119 / Down Deep 120-144 / Below 145-148.

**O mapa 3D é a fonte que vence** onde as duas divergem — ele é o único que dá
a geometria da escada, que é o que mais se vê no jogo.

| | Jogo | Mapa 3D |
| --- | --- | --- |
| Diâmetro | 124m | ~120m |
| Níveis | 144 + 4 abaixo | 144 + 4 abaixo |
| Degraus por volta | 22 | 22 |
| Subida por volta | 3,8m | 3,8m |
| Piso do degrau | 1,00m | 1,00m |
| Metros por nível | 7,66m | 7,6m |
| Altura total | 1127m | 1094m |

### O que isso custou: o hall encolheu

`plateauHalfAngle` caiu de 2,5 para 1,2 rad. Não é gosto, é aritmética:

    folga sobre o patamar = (2*PI - 2*phi) * risePerTurn / (2*PI)

Com os 10m por volta antigos, um hall de 2,5 rad deixava 2,6m de folga. Com os
3,8m por volta da referência, o mesmo hall deixa **0,78m** — o lance de escada
de cima passa na altura do seu peito. Um hall achatado cobrindo 80% do círculo
e uma hélice de 3,8m/volta **não cabem juntos** num modelo onde cada patamar é
um plano horizontal.

A referência não tem esse problema porque **nunca achata a hélice**: a escada
desce contínua passando por patamares pequenos (±15,5°), e os andares em anel
são estruturas separadas. Adotar aquilo é reescrever o `collision.js`, não
mexer numa constante. Enquanto o modelo for patamar-plano, `plateauHalfAngle`
está preso a `<= 1,323` rad — e há teste travando isso.

## Sobre performance

O custo por frame escala com o que está **visível**, não com o tamanho do
mundo — o three.js faz frustum culling. Medido com `?stats=1&bloom=0`:

| | 3 corredores/andar | 8 corredores/andar |
| --- | --- | --- |
| Objetos na cena | 3.217 | 4.721 |
| Draw calls | 160 | 239 |
| Triângulos | 20.393 | **19.137** |
| Tempo de build | 1,9s | 2,5s |

Os triângulos *caem* com mais salas, porque paredes geram oclusão. O que
realmente limita é o **tempo de build** (linear na contagem de objetos) e
**proliferação de textura** — por isso as superfícies de concreto são
compartilhadas e tingidas por material em vez de geradas por andar, e as
placas de numeração das portas vêm de um pool por andar em vez de uma
textura por porta (essa mudança sozinha cortou o build de 2,8s para 1,8s).

Texturas de canvas avulsas são traiçoeiras: elas não pesam no load, mas
sobem para a GPU no instante em que entram no campo de visão, aparecendo
como engasgo ao chegar num andar novo.

## Controles

| Tecla       | Ação                    |
| ----------- | ----------------------- |
| `W A S D`   | Mover                   |
| Mouse       | Olhar em volta          |
| `Shift`     | Correr                  |
| `E`         | Examinar registros/lore |
| `Esc`       | Pausar (libera o mouse) |

## O que existe nesta versão

Doze andares numerados do Silo mais um sub-nível, construídos à mão e ligados
por uma escadaria em espiral contínua — matematicamente uma única hélice, do
Nível 1 até abaixo do 144. Os números seguem o zoneamento vertical do diagrama
estrutural de referência (`references/silo-layout.JPG`):

| Nível | Andar | Faixa |
| ----- | ----- | ----- |
| 1 | **Topo** — cafeteria, tela do exterior e saída controlada | Silo Superior (1-49) |
| 8 | **Judicial** — governança e o Pacto | Silo Superior |
| 17 | **O Ninho** — posto do xerife | Silo Superior |
| 28 | **Residencial** — apartamentos e salões | Silo Superior |
| 40 | **Creche e Escola** | Silo Superior |
| 56 | **Enfermaria** — médico, botica e berçário | Os Médios (50-119) |
| 72 | **O Bazar** — lojas, bar e alfaiataria | Os Médios |
| 88 | **As Roças** — fazendas e jardins | Os Médios |
| 102 | **Tratamento de Água** | Os Médios |
| 110 | **TI** — central de dados e comunicações | Os Médios |
| 128 | **Mecânica** — oficinas e engenharia pesada | Fundo do Silo (120-144) |
| 144 | **O Gerador** — núcleo de energia | Fundo do Silo |
| 145 | **O Vão do Escavador** — a máquina que cavou o poço | Abaixo (145-148) |
| 146 | **As Minas** — frente de escavação | Abaixo |
| 147 | **A Caverna** — cavidade e estruturas antigas | Abaixo |
| 148 | **O Limiar** — os túneis, e o cabo que sai do Silo 18 | Abaixo |

O Vão do Escavador não é um nível numerado: é a caverna sob o silo onde a
máquina que perfurou o poço foi abandonada de frente para a rocha, selada sob
uma laje grossa. O Nível 110 (TI) tem **o Cofre**, a câmara blindada de onde
vem a voz que fala com o chefe do departamento.

O teste `npm test` trava esse zoneamento: se um nível for movido para a
faixa errada, o teste quebra.

### Nada pode flutuar

Um tipo de bug se repetiu várias vezes aqui: uma peça posicionada por um
número fixo que estava certo quando foi escrito e passou a estar errado
quando alguma dimensão vizinha mudou. Os casos reais, todos já corrigidos:

- Muretas centradas exatamente na borda da laje, deixando 11cm de parede
  pendurados sobre o vão.
- Lanternas com haste de comprimento fixo, que paravam 5,5cm antes do teto.
- Degraus mais finos (16cm) que o espelho entre eles (17,9cm), abrindo uma
  fresta em toda a escadaria.
- Pilar central que terminava 40cm abaixo do teto do andar de cima.
- Tubulações de serviço que morriam no ar, 1,2m abaixo de cada piso — e elas
  ficam no vão aberto, onde não há laje nenhuma para esconder a emenda.
- Vigas do vão com as duas pontas no vácuo.
- Molduras (rodapé e sanca) sem a face de baixo/de cima, lidas como fita
  solta na frente da parede.
- Pontes de 6cm ligando lajes de 55cm.

### ...e nada pode ser atravessado com o olhar

O mesmo erro, na horizontal: duas peças dimensionadas em grades diferentes
deixam um buraco na junta. Os casos reais, também já corrigidos:

- A porta no muro do anel era aberta descartando segmentos inteiros de parede
  quando o meio deles caía perto de uma ala: **5,0m de vão para um corredor de
  3,6m**, ou seja 70cm de parede faltando de cada lado da porta. Hoje o muro é
  cortado exatamente na ombreira (`splitAngleRangeByGaps`) e só depois
  subdividido.
- Os degraus eram gerados com `i < n`, parando um degrau antes do patamar e
  deixando **27cm de buraco** em cada encontro de lance com andar.
- Os andares decorativos ficam numa grade de 3,9m que não divide certo o vão
  entre dois andares jogáveis, sobrando ~4m sem fachada em cima e embaixo de
  cada bloco — **96m de parede faltando** ao longo do poço. Agora há um muro
  de fundo contínuo atrás das fachadas, cobrindo o vão inteiro.

A regra que saiu disso: **uma peça que se apoia em outra tem que derivar a
posição da peça que a sustenta**, nunca repetir o número à mão. Vale igual
para aberturas: **uma porta tem a largura de quem passa por ela**, não a
largura de um segmento de construção. Uma lanterna
recebe o teto e gera a própria haste; um degrau tira a espessura do espelho;
uma mureta recebe de que lado da laje ela está. As relações que dá para
expressar só com constantes estão travadas em `npm test` (bloco "Nothing
floats"), justamente para não voltarem na próxima vez que alguém mexer numa
dimensão.

Cada andar tem um pequeno registro/placa (tecla `E`) com um texto de lore
original. Entre um andar e outro, placas na escadaria mostram o número do
nível conforme você desce.

Tudo isso fica dentro de um **casco de concreto** cilíndrico com nervuras
estruturais, que fecha o silo por completo — em cada nível há ainda uma laje
de piso de 360° indo do anel até o casco, então não existe mais nenhum ângulo
onde se enxergue "o vazio" para fora do mundo.

Entre os doze andares jogáveis há dezenas de **andares decorativos** (só
cenário, nunca andáveis), espaçados a cada ~4m, cada um com sua fachada de
**janelas acesas** — é o que faz olhar poço abaixo mostrar uma pilha densa de
níveis recuando na neblina, como nas imagens de referência, em vez de doze
lajes soltas. Completam o quadro fitas de luz descendo
pelas tubulações de serviço.

Na vertical o vão é atravessado por **tubulações de serviço** que correm do
topo ao fundo do silo sem emenda (com flanges em cada andar) e por **vigas
radiais** que ligam essas tubulações às fachadas dos andares decorativos —
ou seja, com as duas pontas apoiadas em algo.

A escada não pousa direto no hall: ela termina num "hub" pequeno ao redor do
vão central, separado por um vazio real (sem piso, dá pra ver através) de um
anel externo bem mais largo — igual ao vão entre o núcleo da escada e o
anel de sacadas nas imagens de referência. Só se cruza esse vazio por pontes
com corrimão, uma para cada ala. O anel externo é quase 360° (só uma pequena
fresta é onde a espiral continua descendo), com corrimão nas duas bordas do
vazio, pilares com luzes em tubo e janelas/venezianas pequenas nas paredes.
Cada andar tem 3 alas: a sala temática principal (a lista acima) mais duas
alas menores genéricas (portas extras, caixotes, tubulação) só para dar mais
volume ao andar. Ao longo de todo o anel há portas de apartamento fechadas
(com plaquinha de número), janelinhas de ventilação e lanternas penduradas,
para o andar parecer habitado mesmo onde não dá para entrar.

## Arquitetura (para quem for mexer no código)

- `js/config.js` — todas as constantes de layout (raios, alturas, ângulos),
  as dimensões de construção (espessura de laje, de parede e de mureta) e os
  dados de cada estação (cor, textos, tema de sala). As dimensões ficam aqui,
  e não junto da geometria, porque o `npm test` roda sem three.js e precisa
  conseguir importá-las para checar as relações entre elas.
- `js/collision.js` — o "motor" do mundo: dado um ângulo acumulado (`theta`)
  em torno do eixo central, decide se o jogador está num patamar (andar) ou
  numa rampa de escada. Num patamar, checa hub → vazio/ponte → anel → alas
  (`WING_OFFSETS` em `config.js`), nessa ordem. É puro JS sem depender de
  three.js, então dá para testar isoladamente com Node (`npm test`).
- `js/world/` — toda a geometria three.js, quebrada por responsabilidade:
  - `primitives.js` — helpers genéricos de malha e geometria (caixas,
    cilindros, setores anelares, lajes com espessura). Não sabe o que é um
    silo.
  - `materials.js` — as superfícies de concreto compartilhadas, o tingimento
    por estação e os níveis de desgaste por profundidade.
  - `fixtures.js` — o "kit de peças" do silo: luminárias, lanternas, portas
    de apartamento, vigias, muretas de guarda, faixas de janela.
  - `stairs.js` — a escadaria helicoidal entre os andares.
  - `scenery.js` — cenário não-andável: casco externo, andares decorativos,
    tubulações de serviço, vigas do vão.
  - `station.js` — a estrutura de um andar jogável: hall, pontes, alas.
  - `themes.js` — o que mobilia a sala principal de cada andar.
  - `index.js` — junta tudo em `buildWorld()`.
- `js/player.js` — pointer lock, WASD, head-bob; delega toda a física de
  colisão para `collision.js`.
- `js/textures.js` — texturas procedurais (concreto, grade metálica, placas
  de texto) via `<canvas>`, sem nenhum arquivo de imagem externo. O concreto
  gera junto um mapa de altura, do qual se deriva um **normal map** (Sobel) —
  é o que faz a luz "pegar" na superfície em vez de tudo parecer papelão
  pintado. As superfícies são compartilhadas entre os andares e tingidas pela
  cor de cada estação, senão a geração custaria segundos de load.

  O concreto tem um parâmetro de **desgaste** (`wear`), usado em três níveis
  conforme a profundidade: trincas ramificadas, manchas de umidade,
  eflorescência e remendos aumentam conforme se desce. Isso vem direto das
  notas de produção da série — as fissuras são descritas como intencionais,
  e os níveis inferiores como bem mais úmidos e deteriorados. Os pisos
  fundos também recebem rugosidade menor, o que no PBR lê como piso molhado.
- `js/hud.js` / `js/audio.js` — interface na tela e som ambiente (também
  gerado por código, via Web Audio).
- `js/viewpoints.js` — pontos de câmera de debug (ver "Conferindo o visual").
- `js/main.js` — junta tudo e roda o loop do jogo, incluindo o pipeline de
  pós-processamento com **bloom**. Como o tone mapping passa a acontecer no
  fim da cadeia (`OutputPass`), as fontes emissivas usam valores acima de 1
  para cruzar o limiar do bloom — é por isso que as cores de janelas e
  luminárias são multiplicadas em `world.js`.

## Ideias para evoluir

- Mais andares "completos" entre os dez atuais (hoje eles existem só como
  trechos de escada com placas de número).
- NPCs simples parados pelos corredores.
- Um objetivo real (ex.: encontrar algo específico no Gerador).
- Perigo de cair no vão central da escada ou no vazio entre o hub e o anel
  (hoje os corrimãos são sólidos, ninguém cai).
- Elementos das referências que ainda não entraram: torres de água de madeira
  nas Roças, salas que atravessam vários andares ao mesmo tempo (tipo
  anfiteatro) e o mercado de rua com fachadas de apartamento em dois andares.
  O anfiteatro exigiria repensar o modelo de colisão de novo (hoje cada
  patamar é uma altura só).
- NPCs: todas as referências mostram gente circulando; hoje o Silo está vazio.

## Revisão visual e estabilidade — setembro de 2026

A implementação atual usa degraus curvos sólidos, guarda-corpos contínuos,
pontes alinhadas e luminárias curtas nos pilares. As antigas fitas azuis no vão
foram substituídas. O renderer mantém dez luzes pontuais e seleciona fontes
próximas ao jogador; os grupos distantes são ocultados por altura.

`E` abre/fecha registros e suspende a movimentação durante a leitura. `Esc`
pausa, e `M` alterna o som. Ao perder foco ou pausar, as teclas são limpas para
evitar movimento involuntário ao retornar. Plantas não emitem luz e móveis
agora têm colisão. Nos níveis genéricos, portas fechadas permanecem bloqueadas.

A pesquisa atualizada, as 21 imagens inspecionadas e os limites de fidelidade
estão em [docs/referencias-visuais.md](docs/referencias-visuais.md). Os mapas de
referência e os registros autorais do protótipo não equivalem a plantas ou
diálogos oficiais. Os quatro subsolos continuam sendo parte desta adaptação.

`npm test` executa regressões de circulação, geometria curva e controle do
jogador, incluindo pausa, foco, leitura, passos e falha de captura do mouse.
As capturas de verificação ficam em `shots/` (ignorada pelo Git).

Para repetir as verificações no Chrome com Playwright instalado:

```bash
npm start
# em outro terminal, com o pacote playwright disponível:
npm run test:browser
```

Os scripts aceitam `BASE` (servidor), `CHROME` (executável) e
`PLAYWRIGHT_MODULE` (caminho de uma instalação existente de Playwright).
O navegador usa um perfil temporário, sem acessar seu perfil pessoal.

Verificado nesta revisão: `npm test`, navegação automatizada no Chrome,
leitura de registros com bloom, pausa/retomada, redimensionamento e capturas
`menu`, `pause`, `void`, `ring`, `room`, `deep` e `registro`. As capturas usam
renderização por software; não constituem um benchmark de GPU.

### Trecho exemplar do nível 1

A cafeteria e sua ligação à escadaria têm materiais de piso, madeira e metal
pintado, portas arredondadas, detalhes de uso cotidiano e sombras locais.
A imagem externa do painel está em `assets/` e acompanha o projeto; permanece
uma paisagem procedural caso ela não carregue.

- `?view=cafeteria&hud=0`: vista geral da cafeteria a partir da entrada.
- `?shadows=0`: desliga os mapas de sombras (o padrão é ligado).
- `npm run test:exemplar`: regressão visual e de circulação desse trecho,
  usando as mesmas variáveis de ambiente dos testes de navegador.

As imagens dessa revisão são gravadas em `shots/exemplar-*.png`. Detalhes e
limites das técnicas estão em `docs/referencias-visuais.md`.

A continuação desse trecho acrescenta luminárias nos pilares e uma sombra
local na galeria, além de molduras e instalações nas entradas. A seleção das
dez luzes pontuais usa transições graduais para evitar mudanças abruptas
durante a caminhada. `npm test` cobre também essa lógica.

Use `?view=entrada&hud=0` para conferir o acesso à cafeteria. Há dois mapas de
sombra estáticos no nível 1 (cafeteria e galeria); `?shadows=0` desliga ambos.
