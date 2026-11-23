# SILO — Descida

Protótipo de exploração em primeira pessoa para navegador, inspirado na estética
da série *Silo* (Apple TV+): concreto bruto, uma escadaria em espiral central
que atravessa todos os andares, e o mesmo concreto cinza do topo ao fundo,
mais claro e limpo em cima, mais escuro e úmido embaixo. Cada setor se
distingue pela cor da sua luz e pelo que tem dentro, como na série.

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

### Publicando (Docker / Dokploy)

O jogo é estático: em produção, um nginx serve só a página, o CSS, os
módulos e a imagem do exterior (`Dockerfile`, `docker/nginx.conf`), com
gzip, cache revalidado a cada carga (um deploy aparece na hora) e um
`/healthz` para o healthcheck do contêiner. O servidor de desenvolvimento,
testes, docs e referências ficam fora da imagem (~51 MB). O three.js vem da
CDN do import map, então o navegador do jogador precisa de internet.

```bash
docker build -t silo-the-game .
docker run --rm -p 8080:80 silo-the-game    # http://localhost:8080
```

No Dokploy:

1. **Application** → provedor Git/GitHub com este repositório e o branch
   `master`; **Build Type: Dockerfile** (caminho `Dockerfile`, contexto `.`).
2. **Domains** → o domínio, **Container Port 80**, HTTPS ligado com Let's
   Encrypt. O HTTPS não é opcional para o Quest: o óculos só abre a sessão
   WebXR numa origem segura.
3. **Deploy** (e, se quiser, Auto Deploy pelo webhook do repositório).

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

### Medindo o mundo em vez de procurar erro no olho

Duas ferramentas (com o servidor rodando e o Playwright disponível):

```bash
npm run test:world            # todos os níveis temáticos + três genéricos
npm run test:world judicial   # só um nível
npm run audit judicial ring   # fotos em shots/audit/ cujo nome contenha isso
```

`tools/world-check.cjs` percorre todo o piso andável de cada nível pela
própria colisão do jogo e, de cada ponto, lança raios na cena. Acusa:

| Falha | O que é |
| --- | --- |
| `LEAK` | uma linha de visão que escapa do nível e termina no casco do silo (ou em nada): fresta em parede, porta que abre para o vazio |
| `NO-FLOOR` | lugar onde a colisão deixa pisar e não há piso desenhado |
| `NO-ROOF` | sala ou corredor aberto para a neblina |
| `WALKS-THROUGH` | algo sólido desenhado num passo que a colisão permite: parede sobre uma porta, objeto sem volume de colisão |
| `BACKWARDS` | placa com as letras viradas para a parede (lê-se espelhada) |
| `LOOSE` | placa sem nada atrás: dá para contornar e ler pelo verso |
| `BURIED` | placa com algo colado na frente (sobre uma porta, dentro de um pilar) |

`tools/audit.cjs` carrega o jogo uma vez e voa a câmera por ~450 poses
(chegada, galeria, cada corredor e cada sala de cada nível temático), em vez
de recarregar a página a cada foto.

A primeira rodada achou o que meses de capturas pontuais não tinham achado:
em 13 dos 16 níveis temáticos os corredores eram desenhados a 60° ou mais de
onde a porta e a colisão estavam (a porta abria para o vazio e o jogador
andava no ar), nenhuma sala tinha a parede da frente, e a galeria tinha uma
fresta em forma de crescente no pé e no topo de cada painel de parede. Regras
que saíram disso:

- **O rumo de uma ala é `wingRotation + WING_OFFSETS[i]`, e só.** Já é
  absoluto; somar o rumo do patamar foi o erro. E ele passa de 2π: o que
  recorta ou evita uma ala num anel de 0 a 2π tem de considerar o rumo
  ±2π (uma porta em cada nível ficava emparedada por isso).
- **A parede da galeria não é um cilindro.** São painéis planos, tangentes ao
  raio nominal no centro de cada um. Tudo que vai na parede é posto *no
  painel* (`onPanel`/`claimPanel` em `js/world/signs.js`), nunca por raio e
  ângulo; e laje e teto entram um pouco na parede em vez de parar no raio.
- **Nada atravessa o patamar.** Os patamares ficam sempre em múltiplos de
  60°; o que corre o poço inteiro (os canos de serviço, `RISERS` em
  `config.js`) fica nas bissetrizes, e `npm test` confere isso nos 148.
- **Letreiro tem uma face só.** Plano de duas faces lê-se espelhado por trás.
  O que pode ser visto pelo verso ganha corpo (`mountPlate`).

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
mundo — o three.js faz frustum culling. Medido em 22/11/2026 (148 níveis,
galerias de pé-direito duplo, fachadas e salas novas), renderização por
software:

| Vista | Draw calls | Triângulos |
| --- | --- | --- |
| Poço (`?view=shaft`) | ~395 | ~203 mil |
| Da borda da galeria, olhando a fachada do outro lado | ~315 | ~344 mil (Quest: ~322 mil) |

As fachadas são instanciadas em blocos de seis níveis e em dois alcances: o
volume, as portas e as janelas até `?detail` metros, e as ferragens até 40%
disso. A medição antiga, de quando o silo tinha doze andares:

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
| `E`         | Examinar registros, falar com as pessoas, pegar objetos |
| `Esc`       | Pausar (libera o mouse); na pausa, ir para um setor já visitado |
| `P`         | Salvar progresso        |

No óculos (ver "No óculos (Meta Quest)" abaixo):

| Controle                         | Ação                          |
| -------------------------------- | ----------------------------- |
| Analógico esquerdo               | Andar, na direção do olhar    |
| Analógico direito                | Girar em passos de 30°        |
| Gatilho (mão direita)            | Examinar, falar, pegar, abrir / fechar; no menu, escolher |
| Empunhadura (qualquer mão) ou clique no analógico | Correr        |
| Y ou B                           | Menu: continuar, ir para um setor visitado, salvar, velocidade normal/rápida, modo sentado, recalibrar altura, sair do VR |
| Andar de verdade                 | Anda — o corpo segue a cabeça |

O botão de menu do próprio controle é do sistema e não chega à página, por
isso o menu do jogo fica no Y/B. Se o óculos voltar do descanso com a visão
rente ao chão (o Quest às vezes perde a altura do piso), o jogo recoloca os
olhos na altura de pé sozinho; "Recalibrar altura" no menu faz o mesmo na
hora, e o "Modo sentado" fixa a altura de quem joga sentado.

## No óculos (Meta Quest)

O jogo roda no navegador do Quest por WebXR; é o mesmo código, com um modo a
mais. Quando o navegador consegue abrir uma sessão imersiva, o menu ganha o
botão **Entrar com o óculos**.

**Abrindo no óculos.** WebXR só funciona em origem segura, e
`http://192.168.x.x` não é uma. Três caminhos, do mais simples ao mais
trabalhoso:

```bash
npm run dev:https
```

sobe o mesmo servidor em HTTPS com um certificado autoassinado (gerado em
`certs/`, fora do git) e imprime o endereço da máquina na rede. Abra esse
endereço no navegador do Quest e aceite o aviso de certificado. As outras
duas opções são publicar a pasta em qualquer hospedagem estática com HTTPS,
ou, com o modo desenvolvedor ligado e o cabo USB,
`adb reverse tcp:8080 tcp:8080` e abrir `http://localhost:8080` no óculos.

**O que muda dentro da sessão.**

- A câmera pende de um *rig*. O óculos é dono da pose da câmera; o que o
  jogo move é o rig, posto nos pés do jogador. Não há altura dos olhos,
  inclinação nem balanço de cabeça a aplicar — o pescoço do jogador faz os
  três.
- Dois movimentos, resolvidos separadamente (`js/xr/locomotion.js`): o
  analógico leva o espaço inteiro; passos de verdade movem só a cabeça, e o
  corpo a segue até onde a colisão deixa. A cabeça pode ir 55 cm além do
  corpo — é a folga que permite debruçar na mureta para olhar o vão sem que o
  mundo escorregue para trás.
- Conforto: giro em passos, velocidades menores que as do teclado (2,8 e
  4,4 m/s contra 3,8 e 7) e uma vinheta que estreita o campo de visão
  enquanto o analógico move o jogador. `?vignette=0` desliga a vinheta.
- A interface em HTML não aparece dentro do óculos. O equivalente
  (`js/xr/hud.js`) são três painéis na cena: um sobre a mão esquerda com
  nível e objetivo, o texto do registro segurado diante da placa, e o aviso
  de interação na ponta do raio.
- O bloom não roda: pós-processamento desenha num alvo fora da tela, que a
  sessão não exibe. A cena vai direto para o dispositivo.

**Orçamento.** No navegador do Quest o jogo assume o perfil `quest`
(`js/quality.js`): sem sombras, 4 luzes pontuais no pool em vez de 10, 72 Hz,
e o detalhe das fachadas (portas, sacadas, corrimãos) desenhado num raio
menor de níveis.
É um ponto de partida conservador, **ainda não medido no aparelho**. O que
pesa num óculos não é geometria e sim custo por pixel — dois olhos, muita
resolução, GPU de celular. Para devolver qualidade enquanto mede:

| Parâmetro | Efeito |
| --- | --- |
| `?quality=desktop` / `?quality=quest` | força um perfil |
| `?lights=N` | tamanho do pool de luzes (1–10) |
| `?shadows=1` / `?shadows=0` | sombras |
| `?normals=0` | sem normal maps |
| `?hz=90` | taxa de quadros pedida ao óculos |
| `?detail=N` | até quantos metros acima/abaixo as fachadas mostram detalhe (desktop 62, Quest 36) |

**Testando sem o óculos.** `npm run test:xr` (com o servidor rodando) dirige
uma sessão inteira contra um dispositivo WebXR falso (`tools/fake-xr.js`):
entrar, andar com o analógico, girar, apontar para um registro, ler com o
gatilho e sair. Ele prova que o código do modo funciona; taxa de quadros e
conforto só o aparelho responde.

## A jornada e as pessoas

O silo é habitado (`js/world/people.js`): gente andando pelas galerias, se
debruçando no guarda-corpo, conversando nas portas, carregadores subindo e
descendo a escada, e gente trabalhando ou sentada nas salas — a cafeteria
cheia, o bar, o mercado, a oficina. A roupa segue o setor (macacão escuro
na Mecânica, cinza na TI, preto no judiciário, cáqui na polícia). Olhe para
alguém e aperte E (ou o gatilho) para ouvir o que diz. As pessoas não
bloqueiam a passagem: param e esperam quem vem.

Depois dos primeiros passos no nível 1, começa uma jornada que atravessa o
silo (`js/quests.js`):

1. Apresentar-se ao **xerife**, no posto redondo do nível 1.
2. Levar o malote à **delegada** do nível 18.
3. Buscar a válvula com o chefe de turno da **Mecânica**, no 128.
4. Entregá-la à engenheira da **Água**, no 102.
5. Achar as cinco **relíquias** de antes do Pacto, escondidas no arquivo
   (39), no banco de sementes (66), na alfaiataria (68), na botica (73) e no
   almoxarifado da Mecânica (128).
6. Levá-las ao técnico diante do Cofre, na **TI** (34).
7. Descer ao **Limiar**, no 148, e ler o registro.

O painel de missão mostra o passo atual e o que falta. Ninguém pula etapa,
e relíquias achadas antes da hora contam quando a busca começa. Cada
departamento visitado entra na lista "ir para um setor visitado" da pausa e
do menu do óculos.

## O que existe nesta versão

Os 148 níveis do Silo são andáveis, ligados por uma escadaria em espiral
contínua — matematicamente uma única hélice, do Nível 1 até o 148. Dezesseis
deles são construídos à mão: o departamento numa sala principal e duas salas
laterais próprias do setor (`js/world/rooms.js`). Onde os mapas do poço
feitos para a série dizem o nível de um departamento (`new-references`
079–080), o jogo segue o mapa:

| Nível | Andar | Salas laterais | Faixa |
| ----- | ----- | -------------- | ----- |
| 1 | **Topo** — cafeteria e a tela do exterior | posto do xerife (salão redondo, celas, escritório, cela de espera) · saída controlada (trajes, airlock) | Silo Superior (1-49) |
| 18 | **Delegacia** — posto de delegados | celas · delegado de plantão | Silo Superior |
| 28 | **Residencial** — becos, apartamentos e praça | salão comunitário · depósito | Silo Superior |
| 34 | **TI** — central de dados e o Cofre | servidores · comunicações | Silo Superior |
| 39 | **Judicial** — governança e o Pacto | arquivo do Pacto · secretaria | Silo Superior |
| 40 | **Creche e Escola** | sala de aula · berçário | Silo Superior |
| 66 | **As Roças** — fazendas e jardins | banco de sementes · estufa | Os Médios (50-119) |
| 68 | **O Bazar** — o mercado | alfaiataria · bar | Os Médios |
| 73 | **Enfermaria** — medicina | enfermaria B · botica | Os Médios |
| 102 | **Tratamento de Água** | bombas · laboratório | Os Médios |
| 128 | **Mecânica** — oficinas e engenharia pesada | oficina · almoxarifado | Fundo do Silo (120-144) |
| 144 | **O Gerador** — o salão da turbina | sala de controle · vestiário | Fundo do Silo |
| 145 | **O Vão do Escavador** — a máquina que cavou o poço | paiol · oficina de campo | Abaixo (145-148) |
| 146 | **As Minas** — frente de escavação | lampisteria · minério | Abaixo |
| 147 | **A Caverna** — cavidade e estruturas antigas | levantamento · depósito | Abaixo |
| 148 | **O Limiar** — os túneis, e o cabo que sai do Silo 18 | caixa de cabos · depósito | Abaixo |

Os outros 132 níveis têm a galeria completa: colunas contínuas na borda,
pé-direito duplo e a fachada de dois pavimentos (`js/world/facade.js`), com
portas, sacadas e escadinhas, mas sem alas.

O Vão do Escavador não é um nível numerado: é a caverna sob o silo onde a
máquina que perfurou o poço foi abandonada de frente para a rocha, selada sob
uma laje grossa. O Nível 34 (TI) tem **o Cofre**, a câmara blindada de onde
vem a voz que fala com o chefe do departamento.

O teste `npm test` trava esse zoneamento e os níveis tirados dos mapas da
produção: se um departamento for movido, o teste quebra.

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
  colisão para `collision.js`. Em sessão no óculos, move o rig em vez da
  câmera.
- `js/xr/` — o modo óculos: `locomotion.js` (a matemática do movimento, sem
  three.js, testada em `test/xr.test.mjs`), `session.js` (a sessão WebXR e os
  controles) e `hud.js` (os painéis na cena e a vinheta de conforto).
- `js/quality.js` — os orçamentos de render por dispositivo.
- `js/textures.js` — texturas procedurais (concreto, grade metálica, placas
  de texto) via `<canvas>`, sem nenhum arquivo de imagem externo. O concreto
  gera junto um mapa de altura, do qual se deriva um **normal map** (Sobel) —
  é o que faz a luz "pegar" na superfície em vez de tudo parecer papelão
  pintado. As superfícies são compartilhadas entre os andares e tingidas pelo
  tom de concreto do nível (`concreteFor` em `config.js`, que escurece com a
  profundidade), senão a geração custaria segundos de load.

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

### Progresso e objetivos

`P` salva posição, direção do olhar, registros examinados e objetivos. O menu
de pausa também tem **Salvar progresso**. Há salvamento automático ao pausar,
concluir etapas e a cada 30 segundos de jogo ativo. Ao reabrir, **Continuar
exploração** retoma a partida no mesmo navegador e endereço; não há conta ou
sincronização entre dispositivos. Limpar os dados do site remove o progresso.

O painel **Primeiros passos** acompanha três objetivos reais: atravessar a
passarela do nível 1, examinar o registro do Topo com `E` e aproximar-se do painel
da cafeteria. Mostra etapas concluídas e a instrução atual. A ordem de visita
não impede a conclusão; depois a exploração permanece livre. Esta é a missão
introdutória, anterior ao inventário, relíquias e missões com NPCs do plano.

Salvamentos incompatíveis ou corrompidos são preservados até uma substituição
manual confirmada. Falhas de armazenamento aparecem na interface. Capturas
com `?view=` e layouts experimentais com `?wings=` não usam nem alteram saves.

### Ala residencial — nível 28

A ala principal do Residencial tem corredor de 4,4 m, três apartamentos com
estar/cozinha, quarto e banheiro, além de lavanderia, depósito e oficina.
Aproxime-se de uma porta, olhe para ela e use `E` para abrir ou fechar. A folha
aberta também possui colisão; afaste-se da passagem se a porta não puder mover.
O estado das portas é salvo com a partida. Saves antigos que coincidam com uma
parede ou móvel novo são retomados no corredor do mesmo andar.

`?view=residencial&hud=0` mostra o corredor; `?view=apartamento&hud=0` mostra o
interior. São vistas de inspeção, sem movimento nem alteração do save.
`npm run test:residential` verifica as portas, os seis interiores e a retomada.
