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
