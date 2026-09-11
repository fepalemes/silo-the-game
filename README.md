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

Doze andares numerados do Silo mais um sub-nível, construídos à mão e
ligados por uma escadaria em espiral contínua (matematicamente uma única hélice, do Nível 1 até o Nível 144). Os
números dos níveis seguem o zoneamento vertical do diagrama estrutural de
referência (`references/silo-layout.JPG`):

| Nível | Andar | Faixa |
| ----- | ----- | ----- |
| 1 | **Topo** — cafeteria, tela do exterior e saída controlada | Silo Superior (1-20) |
| 8 | **Judicial** — governança e o Pacto | Silo Superior |
| 17 | **O Ninho** — posto do xerife | Silo Superior |
| 28 | **Residencial** — apartamentos e salões | Superior-Médio (21-50) |
| 40 | **Creche e Escola** | Superior-Médio |
| 56 | **Enfermaria** — médico, botica e berçário | Silo Médio (51-80) |
| 72 | **O Bazar** — lojas, bar e alfaiataria | Silo Médio |
| 88 | **As Roças** — fazendas e jardins | Médio-Inferior (81-120) |
| 102 | **Tratamento de Água** | Médio-Inferior |
| 110 | **TI** — central de dados e comunicações | Médio-Inferior |
| 128 | **Mecânica** — oficinas e engenharia pesada | Fundo do Silo (121-144) |
| 144 | **O Gerador** — núcleo de energia | Fundo do Silo |
| — | **O Vão do Escavador** — abaixo do 144 | sub-nível |

O Vão do Escavador não é um nível numerado: é a caverna sob o silo onde a
máquina que perfurou o poço foi abandonada de frente para a rocha, selada sob
uma laje grossa. O Nível 110 (TI) tem **o Cofre**, a câmara blindada de onde
vem a voz que fala com o chefe do departamento.

O teste `npm test` trava esse zoneamento: se um nível for movido para a
faixa errada, o teste quebra.

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
lajes soltas. Completam o quadro **tubulações de serviço** de altura inteira
com fitas de luz e **vigas radiais** cruzando o vão.

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

- `js/config.js` — todas as constantes de layout (raios, alturas, ângulos) e
  os dados de cada estação (cor, textos, tema de sala).
- `js/collision.js` — o "motor" do mundo: dado um ângulo acumulado (`theta`)
  em torno do eixo central, decide se o jogador está num patamar (andar) ou
  numa rampa de escada. Num patamar, checa hub → vazio/ponte → anel → alas
  (`WING_OFFSETS` em `config.js`), nessa ordem. É puro JS sem depender de
  three.js, então dá para testar isoladamente com Node (`npm test`).
- `js/world.js` — constrói toda a geometria three.js (escadaria, hub, pontes,
  anel externo quase-360°, pilares, salas temáticas e alas genéricas) a
  partir do layout calculado em `config.js`.
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
