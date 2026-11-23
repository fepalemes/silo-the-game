// The journey, in a real page: people are there, the sheriff can be talked to
// and moves the journey on, a relic can be picked up and stays picked up.
//
//   node tools/journey-check.cjs      (server running; BASE to point elsewhere)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE || 'http://localhost:8080';

(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
 try {
 const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
 const errors = [];
 page.on('pageerror', (e) => errors.push(e.message));
 await page.goto(`${BASE}/?bloom=0`);
 await page.waitForFunction(() => !document.getElementById('start-button').disabled, null, { timeout: 180000 });
 await page.click('#start-button');
 await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 30000 });
 // Moved about through the game's own modules, as the other checks do.
 const frames = (n) => page.evaluate((n) => new Promise((resolve) => { let k = 0; const step = () => (++k >= n ? resolve() : requestAnimationFrame(step)); requestAnimationFrame(step); }), n);

 // The first steps done, standing in the sheriff's station facing the sheriff.
 const setup = await page.evaluate(async () => {
  const { progress, player, layout } = await import('/js/main.js');
  progress.complete('gallery'); progress.complete('screen'); progress.read('topo');
  const st = layout.stations[0];
  const spot = st.npcSpots.find((s) => s.character === 'xerife');
  // Two metres in front of him, looking at his chest.
  const x = spot.x + Math.sin(spot.yaw) * 2, z = spot.z + Math.cos(spot.yaw) * 2;
  player.teleport({ x, y: st.y, z, theta: st.theta, level: 0, yaw: Math.atan2(-(spot.x - x), -(spot.z - z)), pitch: -0.05 });
  return { spot, step: (await import('/js/quests.js')).currentStep(progress.completed()).id };
 });
 assert.equal(setup.step, 'sheriff', 'after the first steps the sheriff is next');
 await frames(6);
 const crowd = await page.evaluate(async () => (await import('/js/main.js')).scene.getObjectByName('crowd-torso').count);
 assert(crowd > 5, `people are about (${crowd})`);
 await page.waitForFunction(() => /falar com Xerife/.test(document.getElementById('interact-prompt').textContent) && !document.getElementById('interact-prompt').hidden, null, { timeout: 30000 });
 await page.keyboard.press('KeyE');
 await page.waitForFunction(() => !document.getElementById('lore-panel').hidden);
 const talk = await page.evaluate(async () => ({
  title: document.getElementById('lore-title').textContent,
  step: (await import('/js/quests.js')).currentStep((await import('/js/main.js')).progress.completed()).id,
  mission: document.getElementById('mission-summary').textContent,
 }));
 assert(/Xerife/.test(talk.title), 'the sheriff speaks');
 assert.equal(talk.step, 'pouch', 'and sends the player down to the deputy station');
 assert(/malote/.test(talk.mission), `the mission panel follows (${talk.mission})`);
 await page.screenshot({ path: 'shots/journey-sheriff.png' });
 await page.keyboard.press('KeyE');
 await page.waitForFunction(() => document.getElementById('lore-panel').hidden);

 // A relic: the book in the Pact's archive, on level 39.
 const relic = await page.evaluate(async () => {
  const { world, player, layout } = await import('/js/main.js');
  const THREE = await import('three');
  const entry = world.interactables.find((e) => e.relic === 'livro');
  const at = entry.mesh.getWorldPosition(new THREE.Vector3());
  const st = layout.stations.find((s) => s.id === 'judicial');
  // Back along the room's axis from the book, at the reading table's chair.
  const toward = Math.atan2(at.z, at.x), x = at.x - Math.cos(toward) * 1.4, z = at.z - Math.sin(toward) * 1.4;
  player.teleport({ x, y: st.y, z, theta: st.theta, level: st.index, yaw: Math.atan2(-(at.x - x), -(at.z - z)), pitch: Math.atan2(at.y - (st.y + 1.65), Math.hypot(at.x - x, at.z - z)) });
  return { x, z };
 });
 await frames(6);
 await page.waitForFunction(() => /pegar/.test(document.getElementById('interact-prompt').textContent) && !document.getElementById('interact-prompt').hidden, null, { timeout: 30000 });
 await page.keyboard.press('KeyE');
 await page.waitForFunction(() => !document.getElementById('lore-panel').hidden);
 const taken = await page.evaluate(async () => ({ items: (await import('/js/main.js')).progress.items(), title: document.getElementById('lore-title').textContent }));
 assert.deepEqual(taken.items, ['livro'], 'the book is taken');
 assert(/Relíquia/.test(taken.title), 'and read');
 await page.screenshot({ path: 'shots/journey-relic.png' });

 assert.deepEqual(errors, [], 'no runtime errors');
 console.log('JOURNEY CHECKS PASSED: people about, the sheriff talks and sends the player on, the mission panel follows, a relic is taken');
 } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
