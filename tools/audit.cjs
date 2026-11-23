// Visual audit: one page, many cameras. Loads the game once with a frozen
// camera and flies it to every pose in the list, saving a screenshot of each
// into shots/audit/. Far quicker than one page load per viewpoint, which is
// what makes it practical to look at every level instead of a sample.
//
//   node tools/audit.cjs                 every pose
//   node tools/audit.cjs judicial ring   only poses whose name contains either
//   POSES=shots/faults.json node ...     photograph what tools/world-check.cjs
//                                        found, instead of the standard round
//
// Poses are written in each level's own polar frame (radius, absolute bearing,
// height above the floor), so the same set of shots can be asked of any level.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const BASE = process.env.BASE || 'http://localhost:8080';
const OUT = process.env.OUT || 'shots/audit';
const FRAMES = Number(process.env.FRAMES || 12);
const [W, H] = (process.env.SIZE || '900,560').split(',').map(Number);
fs.mkdirSync(OUT, { recursive: true });

(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
 try {
 const page = await browser.newPage({ viewport: { width: W, height: H } });
 page.on('pageerror', (e) => console.error('pageerror', e.message));
 await page.goto(`${BASE}/?view=hub&hud=0&bloom=0${process.env.QUERY ? '&' + process.env.QUERY : ''}`);
 await page.waitForFunction(async () => Boolean((await import('/js/main.js')).scene), null, { timeout: 120000 });

 // The pose list is built in the page, where the layout lives.
 const poses = await page.evaluate(async () => {
  const { layout } = await import('/js/main.js');
  const { WING_OFFSETS, WORLD, wingSpec } = await import('/js/config.js');
  const EYE = WORLD.eyeHeight, out = [];
  const polar = (st, r, a, h = EYE) => ({ x: r * Math.cos(a), y: st.y + h, z: r * Math.sin(a) });
  // A point in a wing's own frame: `along` outward from the silo's axis,
  // `across` to the side.
  const inWing = (st, a, along, across, h = EYE) => ({ x: along * Math.cos(a) - across * Math.sin(a), y: st.y + h, z: along * Math.sin(a) + across * Math.cos(a) });
  const add = (name, st, from, to) => out.push({ name, from, to, level: st.index });
  for (const st of layout.stations.filter((s) => !s.generated)) {
   const id = st.id, R = WORLD.landingR, room0 = R + WORLD.corridorLen;
   // Arriving: from the stair across the deck, and back from the ring.
   add(`${id}-01-deck-out`, st, polar(st, 5, st.theta), polar(st, 30, st.theta));
   add(`${id}-02-deck-back`, st, polar(st, 21.5, st.theta), polar(st, 0, st.theta));
   // Round the ring, both ways, from two places.
   add(`${id}-03-ring-ccw`, st, polar(st, 19.5, st.theta + 0.5), polar(st, 19.5, st.theta + 1.1));
   add(`${id}-04-ring-cw`, st, polar(st, 19.5, st.theta - 0.5), polar(st, 19.5, st.theta - 1.1));
   add(`${id}-05-ring-wall`, st, polar(st, 17.5, st.theta + 2.6), polar(st, 23, st.theta + 2.6));
   const plate = st.platePanel?.theta ?? 0;
   add(`${id}-06-plate`, st, polar(st, 19.8, plate + 0.06), polar(st, 23, plate, 1.9));
   WING_OFFSETS.forEach((offset, i) => {
    const a = (st.wingRotation || 0) + offset, w = `${id}-w${i}`;
    add(`${w}-1-door-from-ring`, st, inWing(st, a, 17.6, 0), inWing(st, a, 40, 0));
    add(`${w}-2-corridor-in`, st, inWing(st, a, R + 0.6, 0), inWing(st, a, 60, 0));
    add(`${w}-3-corridor-back`, st, inWing(st, a, room0 - 0.6, 0), inWing(st, a, 0, 0));
    add(`${w}-4-room-in`, st, inWing(st, a, room0 + 1.2, 0), inWing(st, a, 60, 0, 1.2));
    // Off the centreline: the side rooms keep a column at the far end of it.
    add(`${w}-5-room-back`, st, inWing(st, a, room0 + wingSpec(st, i).depth - 1.4, 1.1), inWing(st, a, 0, 0, 1.2));
    add(`${w}-6-room-left`, st, inWing(st, a, room0 + 3, 1.5), inWing(st, a, room0 + 4.5, -9, 1.3));
    add(`${w}-7-room-right`, st, inWing(st, a, room0 + 3, -1.5), inWing(st, a, room0 + 4.5, 9, 1.3));
   });
  }
  // A generated level, the stair and the shaft.
  for (const index of [1, 60, 120]) {
   const st = layout.stations[index], id = `gen${st.level}`;
   add(`${id}-01-deck-out`, st, polar(st, 5, st.theta), polar(st, 30, st.theta));
   add(`${id}-02-deck-back`, st, polar(st, 21.5, st.theta), polar(st, 0, st.theta));
   add(`${id}-03-ring-ccw`, st, polar(st, 19.5, st.theta + 0.5), polar(st, 19.5, st.theta + 1.1));
   add(`${id}-04-ring-wall`, st, polar(st, 17.5, st.theta + 2.6), polar(st, 23, st.theta + 2.6));
   add(`${id}-05-bay`, st, polar(st, 17, st.bays[0].bearing), polar(st, 0, st.bays[0].bearing, -6));
   add(`${id}-06-stair-down`, st, polar(st, 4.4, st.theta + 0.9, -1.3 + EYE), polar(st, 4.4, st.theta + 1.6, -2.4 + EYE));
   add(`${id}-07-across-shaft`, st, polar(st, 16.6, st.theta + 3.1), polar(st, 16, st.theta, -4));
  }
  const yaw = (f, t) => Math.atan2(-(t.x - f.x), -(t.z - f.z));
  return out.map(({ name, from, to, level }) => ({ name, level, x: from.x, y: from.y, z: from.z, yaw: yaw(from, to), pitch: Math.atan2(to.y - from.y, Math.hypot(to.x - from.x, to.z - from.z)) }));
 });

 if (process.env.POSES) {
  const yaw = (f) => Math.atan2(-(f.tx - f.x), -(f.tz - f.z));
  poses.length = 0;
  for (const f of JSON.parse(fs.readFileSync(process.env.POSES, 'utf8'))) poses.push({ name: f.name, level: f.level ?? 0, x: f.x, y: f.y, z: f.z, yaw: yaw(f), pitch: Math.atan2(f.ty - f.y, Math.hypot(f.tx - f.x, f.tz - f.z)) });
 }
 const filters = process.argv.slice(2);
 const wanted = poses.filter((p) => filters.length === 0 || filters.some((f) => p.name.includes(f)));
 console.log(`${wanted.length} of ${poses.length} poses`);
 for (const pose of wanted) {
  await page.evaluate(async ({ pose, frames }) => {
   const { player, layout } = await import('/js/main.js');
   const { canStand } = await import('/js/collision.js');
   const st = layout.stations[pose.level];
   // A pose written in polar terms can land inside a pillar or a prop on some
   // level. Slide it sideways (across the view) to the nearest spot a body can
   // actually occupy; a photo from inside a column shows nothing. Poses that
   // are off the floor on purpose (the stair, the void) are left alone.
   const across = { x: Math.cos(pose.yaw), z: -Math.sin(pose.yaw) };
   const standable = (dx) => canStand(layout, { x: pose.x + across.x * dx, y: st.y, z: pose.z + across.z * dx, theta: st.theta, level: pose.level });
   if (!standable(0)) {
    const shift = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6].find(standable);
    if (shift !== undefined) { pose.x += across.x * shift; pose.z += across.z * shift; }
   }
   player.teleport({ x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, pitch: pose.pitch, theta: st.theta, level: pose.level });
   // The frozen camera only redraws on request, and the light pool needs a
   // few frames to fade over to the fixtures around the new position.
   for (let i = 0; i < frames; i++) {
    window.dispatchEvent(new Event('silo:asset-ready'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
   }
  }, { pose, frames: FRAMES });
  await page.screenshot({ path: `${OUT}/${pose.name}.png` });
  console.log(pose.name);
 }
 } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
