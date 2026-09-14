# Plano de evolução — 14/09/2026

Status: proposta de trabalho; esta entrega não altera o jogo. Objetivo: transformar o protótipo em exploração habitável, visualmente coerente com a série e com uma sequência de investigação jogável.

## Evidências e decisões

- A [sinopse oficial da Apple para a terceira temporada](https://www.apple.com/au/tv-pr/originals/silo/) descreve uma sociedade de 10 mil pessoas. É uma referência de população, não um censo por andar nem uma exigência de simular todas em tempo real.
- A [Outpost, responsável pelos efeitos](https://outpost-vfx.com/fr/work/silo-s2), confirma o grande vazio com a perfuratriz na base do silo. Sua [entrevista com o modelador](https://outpost-vfx.com/en/news/silo-s1-modelling-the-machines-of-an-underground-city) explica a máquina, suas plataformas, braços, guindastes e componentes de escala humana. Usar essas imagens como referência principal da máquina.
- O [portfólio da diretora de arte Nicole Northridge para Silo 3](https://www.nicolenorthridge.com/portfolio-collections/my-portfolio/silo-3-apple) contém novas imagens da produção. Catalogar as imagens por ambiente, distinguindo o silo dos cenários do passado.
- A [entrevista com Northridge sobre a segunda temporada](https://reactormag.com/silos-production-designer-on-concrete-silo-17-creating-the-look-for-season-2s-final-scene/) diferencia o tratamento visual de Silo 17 e Silo 18. Não misturar vegetação, destruição e decoração dos dois sem identificar a origem.
- O [material de fotografia da segunda temporada](https://britishcinematographer.co.uk/baz-irvine-bsc-isc-ollie-downey-bsc-kate-reid-bsc-ed-moore-bsc-silo/) é referência para iluminação integrada a paredes e tetos.
- A localização precisa das minas e de todas as conexões subterrâneas não foi estabelecida por esta pesquisa. Não converter mapas de fãs ou teorias em planta oficial. A apresentação de design da temporada 2 hospedada pela ADG foi localizada, mas o PDF excedeu o limite de leitura; fica pendente de inspeção.

O código atual cria 148 estações consecutivas, com descida regular também para os quatro subníveis. Propõe-se manter os ambientes já produzidos, mas transformar os setores secretos em espaços conectados por acessos próprios, sem numeração pública 145–148. Minas e câmara da perfuratriz devem ter identidades e regras de acesso separadas. A mineração pode ser conhecida/controlada enquanto o caminho à máquina permanece oculto; validar os detalhes narrativos antes de fechar essa planta.

## 0. Corrigir os vãos antes de ampliar

Reproduzir os vãos relatados no início, meio e fim das escadas, incluindo vistas por baixo e de perfil. Inspecionar união entre degraus, variação do raio, espelhos, parte inferior, parapeitos e encontros com os patamares. Os testes atuais de vértices finitos e raios não comprovam que todas as junções estejam fechadas.

Derivar a espessura necessária da altura real entre degraus e garantir correspondência entre volume visível e colisão. Usar capturas com material simples e iluminação de diagnóstico para separar falta de geometria de sombra. Preservar o grande vazio arquitetônico ao redor da escada.

Aceite: ausência de frestas involuntárias nas juntas verificadas; subida e descida em ambos os sentidos, nas bordas e no centro, sem travar ou atravessar superfícies. Adicionar regressões para as junções efetivamente defeituosas.

## 1. Ampliar a área habitável e distribuir objetos

Projetar uma ala residencial completa antes de replicar. Os corredores atuais têm 3,6 m de largura; comparar a escala da câmera com as referências antes de alargar tudo. Prototipar corredores principais de 4–4,5 m, com acessos menores e áreas de encontro. Essas medidas são hipóteses de projeto, não dimensões oficiais.

Primeira entrega: três apartamentos acessíveis (individual, familiar e de padrão superior), lavanderia, depósito e pequena oficina. Cada apartamento terá entrada, espaço de estar/cozinha, dormitório e banheiro; variações de uso, móveis reaproveitados, tecidos, louça e vegetação coerente com o setor. Portas, iluminação e interiores devem corresponder ao que se vê da galeria. Reservar espaço para passagem de NPCs desde a planta inicial.

A biblioteca de peças deve abranger paredes, portas arredondadas, rodapés, bancadas, louça, armários e instalações. Acesso e geometria precisam compartilhar a mesma descrição de salas; abandonar a regra de um corredor reto e uma sala por ala onde houver ramificações. Validar sobreposição entre interiores, casco externo e andares adjacentes.

Aceite: entrar, abrir/fechar portas, percorrer todos os cômodos e voltar à galeria; mobília sem bloquear passagens; diferenças visuais reconhecíveis entre apartamentos.

## 2. Som espacial

Substituir a dependência do som mecânico global por fontes locais: dutos, tubulações, oficina, passos em superfícies diferentes e conversas ambientais. Portas e paredes atenuam o som; ambientes mudam gradualmente. Sons importantes para desafios também têm indicação textual/visual.

Aceite: localizar uma fonte pela escuta, perceber transições entre sala e corredor, pausar e silenciar corretamente.

## 3. Iluminação e materiais

Revisar exposição, luminárias estouradas, sombras profundas e relevo excessivo do concreto. Ajustar materiais sob uma mesma luz de comparação; criar condições próprias para habitação, serviços e Mecânica. Avaliar iluminação pré-calculada nos interiores estáticos e manter um orçamento para luzes móveis.

Aceite: portas, pessoas e pistas legíveis; aparência consistente em capturas fixas; comparação de tempo de quadro em qualidade baixa e padrão, em hardware real disponível. Definir a meta de FPS a partir dessa medição.

## 4. Movimento ambiental

Acrescentar ventiladores, medidores, goteiras e poeira localizada. Movimento deve ter fonte e função. Oferecer redução de movimentos de câmera e efeitos. Evitar partículas e animações em massa nas áreas distantes.

Aceite: ambiente ativo sem prejudicar visibilidade, leitura ou desempenho.

## 5. Modos de exploração e primeira investigação

| Modo | Comportamento proposto |
| --- | --- |
| Exploração livre | Percurso sem missão obrigatória, registros opcionais e descoberta dos espaços secretos. |
| Encontre a relíquia | Uma investigação delimitada, com pistas encadeadas e conclusão; tempo opcional após completar uma vez. |
| Desafios do silo | Sequência persistente de tarefas e descobertas que conecta setores e libera novos acessos. |

Os três modos compartilham cenário e interações. Criar inventário pequeno, inspeção de objetos, diário de pistas, objetivos, estados de portas e salvamento local versionado. Partidas e reinícios separados por modo. Pistas visuais e escritas devem permitir conclusão sem áudio.

Primeira missão autoral: encontrar uma anotação na cafeteria → localizar o apartamento correspondente → obter uma peça no depósito → restaurar um circuito simples → abrir um armário de manutenção → recuperar uma relíquia e registrar sua origem. Não apresentar essa missão como trama oficial.

Relíquias podem incluir objeto óptico antigo, peça mecânica sem registro ou fragmento de documento; confirmar a classificação de objetos canônicos antes de nomeá-los como tais. A dificuldade vem de observação, interpretação e acesso, inicialmente sem combate.

Aceite: missão concluível do início ao fim, inclusive após salvar/reabrir; pegar itens fora da ordem não bloqueia progresso; reiniciar um modo preserva as demais partidas; pistas nunca surgem atrás de portas impossíveis de abrir.

## 6. NPCs e população percebida

Primeiro protótipo: 6–8 personagens próximos, incluindo morador, carregador, técnica de manutenção, atendente e agente de segurança. Usar personagens autorais com roupas, posturas e funções coerentes com o setor. Começar com animações de caminhar, parar, conversar, sentar e trabalhar, além de diálogos curtos com legendas.

Rotinas ligam casa, trabalho e área social. NPCs precisam navegar pelas portas e escadas e dar passagem ao jogador. Personagens de missão têm identidade e estado persistentes. Reaparecimento de personagens ambientais ocorre fora da vista. Andares distantes recebem simulação resumida e representação simplificada, ampliadas apenas após medição.

Os 10 mil habitantes orientam densidade percebida e funções da cidade. Não distribuir a população igualmente por andar, pois setores industriais e agrícolas ocupam áreas distintas. Quantidade simultânea de NPCs é orçamento técnico, não população canônica.

Aceite: NPCs não atravessam paredes, não bloqueiam passagens e não desaparecem diante da câmera; diálogos e tarefas persistem ao carregar a partida.

## 7. Mecânica, minas e acessos secretos

Produzir uma planta de conexões antes do detalhamento. Mecânica liga-se a serviços e ao acesso controlado às minas. Um caminho de manutenção descoberto por pistas conduz ao vazio da perfuratriz. A posição exata de túneis, portas e água depende de novas capturas identificadas por episódio.

Máquina: começar pela silhueta e proporção da referência Outpost; depois acrescentar plataformas, escadas, braços, cabos, guindastes e deterioração. Representar a máquina como equipamento abandonado, salvo opção narrativa futura fundamentada em uma época específica. Minas: galerias de extração, escoramento, iluminação funcional, transporte e desgaste, separados da câmara monumental da máquina.

Mapa do jogador revela conexões ao descobri-las. Marcos de navegação e rotas de retorno evitam que profundidade vire apenas caminhada longa. Cada expansão precisa acrescentar uma atividade ou descoberta significativa.

Aceite: a área secreta não fica acessível por uma continuação óbvia da escada pública; entrada, retorno e salvamento funcionam; estados de missão não prendem o jogador no subterrâneo.

## Entregas e expansão

A primeira entrega de implementação será a correção dos vãos e a planta navegável de uma ala residencial. A primeira versão completa reunirá a ala mobiliada, som espacial, iluminação revisada, movimento ambiental, três modos, uma missão e 6–8 NPCs. Só então replicar a biblioteca nos demais setores e concluir os subterrâneos.

Antes de expandir cada setor: comparar enquadramentos com fontes identificadas, percorrer rotas, verificar colisões, portas, salvamento e custo de renderização. Carregar interiores por proximidade e separar estados persistentes dos objetos renderizados. Aumentar o mapa deve preservar a estabilidade e dar motivos para explorá-lo.

## Implementação iniciada: salvamento e acompanhamento

A primeira integração de progresso adiciona salvamento local manual (`P` e
botão na pausa), automático e retomada na abertura. O HUD acompanha uma missão
introdutória nos ambientes existentes: passarela, registro do Topo e painel da
cafeteria. Posição, orientação, registros e etapas persistem entre sessões.
Ainda não representa os três modos, inventário ou investigação da relíquia;
esses dependem dos próximos ambientes e sistemas descritos no plano.

## Entrega: primeira ala residencial

Implementada a ala principal do nível 28 com corredor de 4,4 m, três
apartamentos mobiliados e três salas de serviço. Portas operáveis por E,
colisão nos estados aberto/fechado e persistência integradas. Os apartamentos
usam uma planta compartilhada com variações; diferenciação arquitetônica
maior permanece no plano. Geometria da escada passou a compartilhar bordas
e incluir base helicoidal contínua. A bateria de circulação no navegador
validou seis ambientes, quartos, banheiros, retorno e retomada das portas.
Próxima etapa da sequência: som espacial e refinamento de iluminação, antes
dos modos de investigação, relíquias e NPCs.

## Revisão após as novas referências de produção

A direção passa a seguir o [catálogo das 101 novas imagens](catalogo-new-references.md).
As prioridades arquitetônicas são: encontros da escada e corrimãos; transformar
as alas residenciais em becos variados com fachadas; reconstruir a cafeteria
circular e o teto radial; revisar placas/mapas e distribuição dos departamentos;
modelar posto policial/airlock e, depois, domo e gerador. Essas revisões antecedem
a replicação dos ambientes. O protótipo residencial continua útil para validar
portas, interiores e salvamento. Preservar essa funcionalidade durante a mudança.

## Entrega: a ala residencial vira beco

A ala reta do nível 28 foi reconstruída como beco, seguindo o set ALLEYWAY das
novas referências (imagens 029–039): volumes projetados que alternam de lado,
fachadas de dois pavimentos com janelas e varandas, portas em nicho e uma
praça no fim do percurso.

O que mudou de fato:

- **Volumes projetados** (`RESIDENTIAL.jogs`): quatro blocos saindo da parede
  para dentro do beco. Os dois centrais têm profundidade maior que a
  meia-largura do corredor, então **cruzam o eixo em sentidos opostos** — o
  percurso muda de direção duas vezes em vez de só estreitar. Os outros dois
  apenas apertam a passagem. Passagem mínima real de 1,33 m, com 0,63 m de
  folga além do diâmetro do jogador.
- **Portas em nicho**: as paredes que ladeiam cada porta avançam para dentro do
  beco, deixando a folha recuada. O `recess` de cada sala passou a aprofundar o
  **nicho**, não a deslocar o plano da porta.
- **Praça terminal** (`RESIDENTIAL.plaza`, x 52,4–58): bancos, quadro de
  avisos, torneira comunitária e teto com nervuras, no lugar da parede cega que
  fechava o corredor.
- **Fachadas superiores**: pavimento recuado sobre as paredes do beco, com
  janelas acesas e apagadas, varandas, varais e pingadeiras. Tudo acima de
  1,80 m, faixa em que `addBox` não registra colisor, portanto sem custo de
  colisão.

Preservado, como exigido: os seis `id` de sala (é o que o `progress.js` valida
nos saves), as posições das portas, os colisores aberto/fechado e a retomada de
estado. O `main.js` já realocava saves caídos dentro de geometria nova.

Um defeito pré-existente apareceu na verificação: o `recess` de 0,3 m do
`apt-28-b` empurrava o plano da porta para dentro do quarto, e a folha aberta
invadia a própria entrada — os outros dois apartamentos escapavam por
centímetros. Corrigido ao mover o recuo para o nicho.

Verificação: `npm test` ganhou `test/residential.test.mjs` (Node puro, sobre o
plano compartilhado: portas livres de blocos, largura real da passagem
incluindo os nichos, mudança de direção, footprint, casco e `id` dos saves) e
`tools/residential-check.cjs` ganhou a travessia do beco de ponta a ponta e de
volta, além das seis rotas de sala que já existiam. O verificador de navegador
passou a depender de `playwright-core` (sem download de browser; usa o Chrome
instalado), rodando com `PLAYWRIGHT_MODULE=playwright-core`.

Pendente do que o catálogo pede para o residencial: mudanças de direção em
planta com blocos angulados (os atuais são ortogonais), volumes de altura
variada vistos do vazio central e molduras curvas nas portas.
