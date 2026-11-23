// Runs the headset mode end to end against the fake device in fake-xr.js:
// entering a session, walking with the stick, snap turning, pointing at a
// record and reading it with the trigger, and coming back out to the screen.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
fs.mkdirSync('shots', { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8080';
const QUEST = 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/33.0 Chrome/126.0 VR Safari/537.36';
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
 try {
 const context = await browser.newContext({ viewport: { width: 896, height: 448 }, userAgent: QUEST });
 await context.addInitScript({ path: path.join(__dirname, 'fake-xr.js') });
 // Console errors arrive without a stack; attach one so a failure names its caller.
 await context.addInitScript(() => { const original = console.error; console.error = (...args) => original(...args, new Error().stack); });
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
 await page.goto(`${BASE}/`);
 await page.waitForFunction(() => !document.getElementById('start-button').disabled, null, { timeout: 90000 });
 await page.waitForFunction(() => !document.getElementById('vr-button').hidden);

 const budget = await page.evaluate(async () => {
  const { quality, scene, renderer } = await import('/js/main.js');
  let lights = 0; scene.traverse(o => { if (o.isPointLight) lights++; });
  return { name: quality.name, lights, shadows: renderer.shadowMap.enabled };
 });
 assert.deepEqual(budget, { name: 'quest', lights: 4, shadows: false }, 'a headset browser gets the headset budget');

 // Everything below reads the game through its module exports.
 const read = () => page.evaluate(async () => {
  const { player, rig, camera, renderer, xr } = await import('/js/main.js');
  const THREE = await import('three');
  const eye = camera.getWorldPosition(new THREE.Vector3());
  return {
   state: { ...player.getState() }, presenting: renderer.xr.isPresenting, active: player.isActive(),
   rig: { x: rig.position.x, y: rig.position.y, z: rig.position.z, yaw: rig.rotation.y },
   eye: { x: eye.x, y: eye.y, z: eye.z }, fov: camera.fov, frames: window.__fakeXR.frames,
   vignette: camera.children[0]?.material.opacity ?? null, beam: xr.beam.parent !== null,
  };
 });
 const frames = async (count) => { const from = (await read()).frames; await page.waitForFunction((target) => window.__fakeXR.frames >= target, from + count, { timeout: 120000 }); };

 await page.click('#vr-button');
 await page.waitForFunction(async () => (await import('/js/main.js')).player.isPresenting());
 await frames(5);
 let now = await read();
 assert.equal(await page.locator('#start-screen').isVisible(), false, 'the menu steps aside');
 assert(now.presenting && now.active, 'the session is the game being played');
 assert(Math.hypot(now.eye.x - now.state.x, now.eye.z - now.state.z) < 1e-3, 'the head is over the body');
 assert(Math.abs(now.eye.y - (now.state.y + 1.7)) < 1e-3, 'eye height is the headset\'s own, measured from the floor');
 assert.equal(await page.evaluate(() => window.__fakeXR.session.frameRate), 72, 'the headset is asked for a steady 72 Hz');

 // Left stick forward.
 const before = now;
 // Counted in frames, not seconds: software rendering of two eyes is slow,
 // and the game clamps a long frame to 50 ms of movement.
 await page.evaluate(() => { window.__fakeXR.left.axes[3] = -1; });
 await frames(12);
 now = await read();
 const walked = Math.hypot(now.state.x - before.state.x, now.state.z - before.state.z);
 assert(walked > 0.5, `the left stick walks (${walked.toFixed(2)} m)`);
 assert(Math.hypot(now.eye.x - now.state.x, now.eye.z - now.state.z) < 1e-3, 'and carries the head with it');
 assert(now.vignette > 0.3, 'the view narrows while the stick is moving the player');
 await page.screenshot({ path: 'shots/xr-walk.png' });
 await page.evaluate(() => { window.__fakeXR.left.axes[3] = 0; });
 await frames(18);
 assert((await read()).vignette < 0.05, 'and opens again at rest');

 // Right stick: one flick, one turn.
 const yaw = (await read()).rig.yaw;
 await page.evaluate(() => { window.__fakeXR.right.axes[2] = 1; });
 await frames(8);
 now = await read();
 assert(Math.abs(now.rig.yaw - (yaw - Math.PI / 6)) < 1e-6, 'holding the right stick over turns exactly once, to the right');
 assert(Math.hypot(now.eye.x - now.state.x, now.eye.z - now.state.z) < 1e-3, 'about the head');
 await page.evaluate(() => { window.__fakeXR.right.axes[2] = 0; });

 // Stand in front of the level 1 record and point the right hand at it.
 await page.evaluate(async () => {
  const { player } = await import('/js/main.js'); const { WING_OFFSETS } = await import('/js/config.js');
  const a = WING_OFFSETS[0], x = 24.7, z = -0.8;
  player.teleport({ x: x * Math.cos(a) - z * Math.sin(a), z: x * Math.sin(a) + z * Math.cos(a), y: 0, theta: 0, level: 0 });
 });
 await frames(3);
 await page.evaluate(async () => {
  const { world, rig } = await import('/js/main.js'); const THREE = await import('three');
  const plaque = world.interactables.find((entry) => entry.station?.id === 'topo' && !entry.isDoor).mesh;
  const target = rig.worldToLocal(plaque.getWorldPosition(new THREE.Vector3()));
  const fake = window.__fakeXR;
  for (const [pose, from] of [[fake.right.pose, fake.right.pose], [fake.head, fake.head]]) {
   const dx = target.x - from.x, dy = target.y - from.y, dz = target.z - from.z;
   pose.yaw = Math.atan2(-dx, -dz); pose.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }
  // Left hand raised into view, where the wrist panel would be read.
  const h = fake.head, f = { x: -Math.sin(h.yaw), z: -Math.cos(h.yaw) }, r = { x: Math.cos(h.yaw), z: -Math.sin(h.yaw) };
  Object.assign(fake.left.pose, { x: h.x + f.x * 0.42 - r.x * 0.2, y: h.y - 0.24, z: h.z + f.z * 0.42 - r.z * 0.2 });
 });
 await page.waitForFunction(() => !document.getElementById('interact-prompt').hidden, null, { timeout: 30000 });
 assert((await read()).beam, 'the pointing hand carries the beam');
 await page.screenshot({ path: 'shots/xr-prompt.png' });
 await page.evaluate(() => window.__fakeXR.trigger('right'));
 await page.waitForFunction(() => !document.getElementById('lore-panel').hidden);
 await frames(3);
 await page.screenshot({ path: 'shots/xr-record.png' });
 const reading = await read();
 await page.evaluate(() => { window.__fakeXR.left.axes[3] = -1; });
 await frames(5);
 assert.deepEqual((await read()).state, reading.state, 'reading a record freezes the stick');
 await page.evaluate(() => { window.__fakeXR.left.axes[3] = 0; window.__fakeXR.trigger('right'); });
 await page.waitForFunction(() => document.getElementById('lore-panel').hidden);
 assert(await page.evaluate(async () => (await import('/js/main.js')).progress.snapshot().records.includes('topo')), 'the record counts as read');

 // Taking the headset off.
 await page.evaluate(() => window.__fakeXR.session.end());
 await page.waitForFunction(() => !document.getElementById('pause-screen').hidden);
 now = await read();
 assert(!now.presenting && !now.active, 'leaving the session pauses');
 assert.deepEqual(now.rig, { x: 0, y: 0, z: 0, yaw: 0 }, 'the rig is back at the origin');
 assert.equal(now.fov, 70, 'and the screen camera has its own lens back');
 assert(await page.evaluate(() => Boolean(localStorage.getItem('silo18.progress.v1'))), 'progress was saved on the way out');
 await page.waitForTimeout(500);
 await page.screenshot({ path: 'shots/xr-after.png' });

 if (errors.length) console.error(errors.join('\n'));
 assert.deepEqual(errors, [], 'no runtime errors');
 console.log('XR CHECKS PASSED: headset budget, session start, eye height, stick walking, comfort vignette, snap turn, pointing, trigger reads and closes a record, session end restores the screen');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
