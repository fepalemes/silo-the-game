const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
require('node:fs').mkdirSync('shots', { recursive: true });
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
 try {
 const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if(m.type()==='error' && !m.text().includes('404')) errors.push(m.text()); });
 await page.goto(`${process.env.BASE || 'http://localhost:8080'}/?bloom=0`);
 await page.waitForFunction(() => !document.getElementById('start-button').disabled, null, { timeout: 90000 });
 await page.screenshot({ path: 'shots/menu.png' });
 await page.click('#start-button');
 await page.waitForFunction(() => document.pointerLockElement !== null);
 assert.equal(await page.locator('#start-screen').isVisible(), false);
 const state = () => page.evaluate(async () => ({ ...(await import('/js/main.js')).player.getState() }));
 const initial = await state();
 await page.keyboard.down('w'); await page.waitForTimeout(4000); await page.keyboard.up('w');
 const moved = await state();
 assert(Math.hypot(moved.x-initial.x,moved.z-initial.z) > 0.1, 'W moves the player');
 await page.keyboard.down('KeyW');
 await page.evaluate(() => document.exitPointerLock());
 await page.keyboard.up('KeyW');
 await page.waitForFunction(() => !document.getElementById('pause-screen').hidden);
 const paused = await state();
 await page.waitForTimeout(300);
 assert.deepEqual(await state(), paused, 'pause freezes movement');
 await page.screenshot({ path: 'shots/pause.png' });
 await page.click('#resume-button');
 await page.waitForFunction(() => document.pointerLockElement !== null);
 const resumed = await state(); await page.waitForTimeout(300);
 assert.deepEqual(await state(), resumed, 'held keys cleared on resume');
 await page.evaluate(async () => {
  const { player, layout } = await import('/js/main.js');
  const st = layout.stations[1]; Object.assign(player.getState(), { x: 22.5, z: 0, y: st.y, theta: st.theta, level: 1 });
 });
 await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
 assert((await state()).x <= 22.65 + 0.001, 'generated floor outer wall blocks movement');
 const cost = await page.evaluate(async () => {
  const {scene} = await import('/js/main.js'); let lights=0;scene.traverse(o=>{if(o.isPointLight)lights++});return lights;
 });
 assert.equal(cost, 10, 'fixed ten-light budget');
 await page.evaluate(() => document.exitPointerLock());
 for (const view of ['void', 'ring', 'room', 'deep']) {
  await page.goto(`${process.env.BASE || 'http://localhost:8080'}/?view=${view}&hud=0&bloom=0`);
  await page.waitForFunction(async () => Boolean((await import('/js/main.js')).scene), null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/${view}.png` });
  console.log('captured', view);
 }
 assert.deepEqual(errors, [], 'no runtime errors');
 console.log('BROWSER CHECKS PASSED: start, movement, pause, resume, key reset, closed walls, light budget, four viewpoints');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
