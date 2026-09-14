# Imagem de ambientação

`exterior-camera-v1.png` é uma imagem gerada com a ferramenta imagegen para o
painel da cafeteria deste jogo. Representa terreno árido, uma árvore morta e
ruínas distantes, com luz difusa e cores dessaturadas. Não é uma captura da
série nem uma reconstrução documental de um episódio.

A imagem é carregada localmente e recortada proporcionalmente para o painel.
Se o carregamento falhar, o cenário mantém a paisagem procedural anterior.
O original gerado foi preservado fora do projeto; este arquivo é a cópia
consumida pelo jogo e deve acompanhar a distribuição.

## Geração

Ferramenta integrada `imagegen` (sem CLI/API adicional). Prompt utilizado:

> Use case: game environment matte painting. Create one photorealistic panoramic exterior camera feed asset for a fan exploration game inspired by the ruined outdoor view in Apple TV's Silo. Widescreen 3:1 landscape composition. Only the landscape itself, edge to edge, no room, no screen frame, no UI, no text. A barren shallow crater of gray brown dust and scattered stones, a single old dead bare tree with crooked sparse branches in the left third at mid distance, a tiny ruined city skyline very far away on the right in dusty haze. Low overcast polluted pale gray beige sky, diffuse cold daylight, desaturated earth colors, subtle airborne dust. Ground occupies lower half, the tree and skyline should remain within the middle 65 percent of the image height for panoramic cropping. Real photographic material detail and atmospheric perspective, documentary surveillance still quality, physically plausible rough terrain, no illustration, no graphic silhouettes, no dramatic orange sunset, no vegetation, no people, no bodies, no buildings in foreground, no logos or watermark. This asset will be displayed on the cafeteria wall screen; preserve subtle midtone detail without harsh contrast.
