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

## Controles

| Tecla       | Ação                    |
| ----------- | ----------------------- |
| `W A S D`   | Mover                   |
| Mouse       | Olhar em volta          |
| `Shift`     | Correr                  |
| `E`         | Examinar registros/lore |
| `Esc`       | Pausar (libera o mouse) |

## O que existe nesta versão

Dez andares do Silo, construídos à mão, ligados por uma escadaria em espiral
contínua (matematicamente uma única hélice, do Nível 1 até o Nível 144):

1. **Topo** — sala de observação com a tela que mostra o mundo lá fora
2. **TI** — servidores e portas trancadas
3. **Judicial** — câmara de julgamento
4. **O Ninho** — posto do xerife
5. **O Bazar** — mercado dos médios
6. **As Roças** — cultivo hidropônico
7. **Creche e Escola**
8. **Tratamento de Água**
9. **Mecânica**
10. **O Gerador** — o fundo do poço, Nível 144

Cada andar tem um pequeno registro/placa (tecla `E`) com um texto de lore
original. Entre um andar e outro, placas na escadaria mostram o número do
nível conforme você desce.

## Arquitetura (para quem for mexer no código)

- `js/config.js` — todas as constantes de layout (raios, alturas, ângulos) e
  os dados de cada estação (cor, textos, tema de sala).
- `js/collision.js` — o "motor" do mundo: dado um ângulo acumulado (`theta`)
  em torno do eixo central, decide se o jogador está num patamar (andar) ou
  numa rampa de escada, e resolve colisão/altura. É puro JS sem depender de
  three.js, então dá para testar isoladamente com Node.
- `js/world.js` — constrói toda a geometria three.js (escadaria, corrimãos,
  andares, salas temáticas) a partir do layout calculado em `config.js`.
- `js/player.js` — pointer lock, WASD, head-bob; delega toda a física de
  colisão para `collision.js`.
- `js/textures.js` — texturas procedurais (concreto, grade metálica, placas
  de texto) via `<canvas>`, sem nenhum arquivo de imagem externo.
- `js/hud.js` / `js/audio.js` — interface na tela e som ambiente (também
  gerado por código, via Web Audio).
- `js/main.js` — junta tudo e roda o loop do jogo.

## Ideias para evoluir

- Mais andares "completos" entre os dez atuais (hoje eles existem só como
  trechos de escada com placas de número).
- NPCs simples parados pelos corredores.
- Um objetivo real (ex.: encontrar algo específico no Gerador).
- Perigo de cair no vão central da escada (hoje o corrimão é sólido).
