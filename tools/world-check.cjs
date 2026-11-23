// Finds construction faults in the built world by measuring it, instead of by
// walking around hoping to notice them. For every authored level (and a few
// generated ones) it floods the walkable floor through the game's own
// collision, then from each standing position casts rays into the scene:
//
//   LEAK      a sightline that escapes the level - through a gap in a wall, or
//             a doorway with nothing behind it - and lands on the silo's outer
//             shell or on nothing at all
//   NO FLOOR  somewhere the collision lets you stand that has no floor drawn
//   NO ROOF   a room or corridor open to the fog above
//   WALKS-THROUGH  something solid drawn across a step the collision allows:
//             a wall over a doorway, a prop with no collision volume
//
// and for every plate with lettering on it:
//
//   BACKWARDS the lettering faces into the wall, so it reads mirrored
//   LOOSE     nothing behind it: it can be walked round and read from the back
//
//   node tools/world-check.cjs            report, exit 1 if anything is wrong
//   POSES=shots/faults.json node ...      also write camera poses for
//                                         tools/audit.cjs to photograph them
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const BASE = process.env.BASE || 'http://localhost:8080';

(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
 try {
 // The rays are cast by plain single-threaded JavaScript, so the levels are
 // dealt out across several pages and measured side by side.
 const PARTS = Number(process.env.PARTS || 5);
 // Pages are loaded one after another and only measured side by side: five
 // pages starting at once all compile their shaders on the software
 // rasteriser together, and the first ones time out.
 const pages = [];
 for (let part = 0; part < PARTS; part++) {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(`${BASE}/?view=hub&hud=0&bloom=0`);
  await page.waitForFunction(async () => Boolean((await import('/js/main.js')).scene), null, { timeout: 300000, polling: 500 });
  pages.push(page);
 }
 const measure = async (part) => {
 const page = pages[part];

 return page.evaluate(async ({ only, part, parts }) => {
  const { scene, layout } = await import('/js/main.js');
  const THREE = await import('three');
  const { WORLD, LEVEL_HEIGHT } = await import('/js/config.js');
  const { resolveMove, surfaceY } = await import('/js/collision.js');
  scene.updateMatrixWorld(true);

  const STEP = 0.9, EYE = WORLD.eyeHeight, R = WORLD.landingR;
  const roots = scene.children.filter((child) => !child.isLight && !child.isCamera).map((object) => ({ object, box: new THREE.Box3().setFromObject(object) })).filter((root) => !root.box.isEmpty());
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3(), direction = new THREE.Vector3();
  function cast(targets, ox, oy, oz, dx, dy, dz, far = 200, skip = null) {
   raycaster.set(origin.set(ox, oy, oz), direction.set(dx, dy, dz).normalize());
   raycaster.far = far;
   const hits = raycaster.intersectObjects(targets, true);
   return hits.find((hit) => hit.object !== skip && hit.object.visible !== false) || null;
  }
  const describe = (object) => {
   const material = [object.material].flat()[0];
   return `${object.name || object.geometry?.type || object.type}${material?.color ? ' #' + material.color.getHexString() : ''}`;
  };

  const levels = layout.stations.filter((st) => !st.generated || [1, 60, 120].includes(st.index)).filter((st) => !only.length || only.includes(st.id) || only.includes(String(st.level))).filter((st, i) => i % parts === part);
  const faults = [], summary = [];
  for (const st of levels) {
   const targets = roots.filter((root) => root.box.max.y > st.y - 3 && root.box.min.y < st.y + LEVEL_HEIGHT).map((root) => root.object);

   // Flood the walkable floor from a spot on the ring, through the collision.
   const seedBearing = st.theta + 0.6;
   const seed = { x: 19.5 * Math.cos(seedBearing), z: 19.5 * Math.sin(seedBearing), y: st.y, theta: st.theta, level: st.index };
   const key = (x, z) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
   const cells = new Map([[key(seed.x, seed.z), seed]]);
   const queue = [seed];
   while (queue.length) {
    const at = queue.pop();
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
     const next = resolveMove(layout, at, dx, dz);
     if (Math.hypot(next.x - at.x - dx, next.z - at.z - dz) > 1e-6 || next.level !== st.index) continue;
     // Stay off the deck's inner end, where the stair takes over.
     if (Math.hypot(next.x, next.z) < WORLD.hubR + 1) continue;
     const k = key(next.x, next.z);
     if (!cells.has(k)) { cells.set(k, next); queue.push(next); }
    }
   }
   // A sightline has escaped when it ends on the silo's own shell (or on
   // nothing) outside the ring wall. Anything else it can end on - a wall, a
   // prop, the far side of the shaft - is the level doing its job.
   const isShell = (object) => { for (let o = object; o; o = o.parent) if (o.name === 'structure') return true; return false; };
   const outside = (x, z) => Math.hypot(x, z) > R + 0.7;
   const escaped = (hit, ox, oz, dx, dz, far) => (hit ? isShell(hit.object) && outside(hit.point.x, hit.point.z) : outside(ox + dx * far, oz + dz * far));

   let leaks = 0, noFloor = 0, noRoof = 0, walksThrough = 0;
   const seen = new Set();
   const record = (kind, cell, detail, look) => {
    const bucket = `${kind}:${Math.round(cell.x / 3)},${Math.round(cell.z / 3)}:${detail.what}`;
    if (seen.has(bucket)) return;
    seen.add(bucket);
    faults.push({ kind, level: st.level, id: st.id, r: +Math.hypot(cell.x, cell.z).toFixed(1), bearing: +Math.atan2(cell.z, cell.x).toFixed(2), ...detail, pose: { name: `${st.id}-${kind}-${faults.length}`, level: st.index, x: cell.x, y: st.y + EYE, z: cell.z, ...look } });
   };
   for (const cell of cells.values()) {
    const floor = cast(targets, cell.x, st.y + 1, cell.z, 0, -1, 0, 30);
    if (!floor || floor.distance > 1.3) { noFloor++; record('NO-FLOOR', cell, { what: floor ? `floor ${floor.distance.toFixed(1)}m down` : 'nothing below' }, { tx: cell.x + 0.01, ty: st.y, tz: cell.z }); }
    // The deck and the bays stand in the open shaft; everywhere else is indoors.
    const indoors = Math.hypot(cell.x, cell.z) > WORLD.ringInnerR + 0.4;
    const roof = indoors ? cast(targets, cell.x, st.y + EYE, cell.z, 0, 1, 0, 60) : true;
    if (!roof || roof.distance > LEVEL_HEIGHT) { noRoof++; record('NO-ROOF', cell, { what: roof ? `roof ${roof.distance.toFixed(1)}m up` : 'nothing above' }, { tx: cell.x + 0.01, ty: st.y + 20, tz: cell.z }); }
    // Every step out of this cell that the flood took, at waist and head
    // height, must be clear of geometry: the body walks along it.
    for (const [dx, dz] of [[STEP, 0], [0, STEP]]) {
     const next = cells.get(key(cell.x + dx, cell.z + dz));
     if (!next) continue;
     for (const h of [1.0, 1.55]) {
      const hit = cast(targets, cell.x, st.y + h, cell.z, next.x - cell.x, 0, next.z - cell.z, Math.hypot(next.x - cell.x, next.z - cell.z));
      if (!hit) continue;
      walksThrough++;
      record('WALKS-THROUGH', cell, { what: describe(hit.object) }, { tx: next.x, ty: st.y + h, tz: next.z });
      break;
     }
    }
    const zone = Math.hypot(cell.x, cell.z) <= R ? 'ring' : 'wing';
    for (let i = 0; i < 8; i++) {
     const a = (i / 8) * Math.PI * 2 + 0.13;
     // Steep ones too (about 60 degrees): in a headset people lean on the
     // parapet and look straight up and down the facades.
     for (const rise of [0, 0.45, -0.45, 1.7, -1.7]) {
      // Level rays cross the whole silo. Tilted ones only probe the junctions
      // of wall with floor and ceiling, and stop before leaving this storey -
      // far enough to reach the ceiling of the tallest room (the generator
      // hall, 9.4m), or a ray ending in mid-air under it counts as a leak.
      const far = rise ? (Math.abs(rise) > 1 ? 12 : 22) : 200, scale = 1 / Math.hypot(1, rise);
      const hit = cast(targets, cell.x, st.y + EYE, cell.z, Math.cos(a), rise, Math.sin(a), far);
      if (!escaped(hit, cell.x, cell.z, Math.cos(a) * scale, Math.sin(a) * scale, far)) continue;
      leaks++;
      record('LEAK', cell, { what: `from the ${zone}, ${rise > 0 ? 'looking up' : rise < 0 ? 'looking down' : 'level'}: ${hit ? describe(hit.object) : 'open fog'}`, toward: +a.toFixed(2) }, { tx: cell.x + Math.cos(a) * 10, ty: st.y + EYE + rise * 10, tz: cell.z + Math.sin(a) * 10 });
     }
    }
   }
   // --- The stair down from this level --------------------------------------
   // Never measured before: the flood stays on the floor. Standing on the
   // treads at three radii, every few steps, looking all round and up and
   // down, nothing may be seen through to the silo's shell.
   let stairLeaks = 0;
   const below = layout.stations[st.index + 1];
   if (below) {
    // Wide enough in height for the steep rays to land on something.
    const stairTargets = roots.filter((root) => root.box.max.y > below.y - 45 && root.box.min.y < st.y + 45).map((root) => root.object);
    for (let a = st.theta + WORLD.landingHalfAngle; a < below.theta; a += 0.42) {
     const y = surfaceY(layout, a) + EYE;
     for (const r of [WORLD.shaftR + 0.5, (WORLD.shaftR + WORLD.stairOuterR) / 2, WORLD.stairOuterR - 0.45]) {
      const ox = r * Math.cos(a), oz = r * Math.sin(a);
      for (let i = 0; i < 12; i++) {
       const d = (i / 12) * Math.PI * 2 + 0.07;
       for (const rise of [0, 0.45, -0.45, 1.7, -1.7]) {
        const far = rise ? 40 : 200, scale = 1 / Math.hypot(1, rise);
        const hit = cast(stairTargets, ox, y, oz, Math.cos(d), rise, Math.sin(d), far);
        if (!escaped(hit, ox, oz, Math.cos(d) * scale, Math.sin(d) * scale, far)) continue;
        stairLeaks++;
        const cell = { x: ox, z: oz };
        record('LEAK', cell, { what: `from the stair, ${rise > 1 ? 'looking up steeply' : rise > 0 ? 'looking up' : rise < -1 ? 'looking down steeply' : rise < 0 ? 'looking down' : 'level'}: ${hit ? describe(hit.object) : 'open fog'}`, toward: +d.toFixed(2) }, { tx: ox + Math.cos(d) * 10, ty: y + rise * 10, tz: oz + Math.sin(d) * 10 });
        faults.at(-1).pose.y = y;
       }
      }
     }
    }
   }
   leaks += stairLeaks;
   summary.push({ level: st.level, id: st.id, cells: cells.size, leaks, noFloor, noRoof, walksThrough });
  }

  // --- Lettering -------------------------------------------------------------
  // Anything flat with a canvas drawn on it. Each is probed along its own
  // normal: free space in front and something solid close behind is a plate on
  // a wall; the reverse is a plate facing the wall.
  const plates = [];
  let twoSided = 0;
  const normal = new THREE.Vector3(), centre = new THREE.Vector3(), matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
  if (part === 0) scene.traverse((object) => {
   const material = [object.material].flat()[0];
   if (!object.isMesh || object.geometry?.type !== 'PlaneGeometry' || !material?.map?.isCanvasTexture || material.transparent) return;
   const count = object.isInstancedMesh ? object.count : 1;
   // Instanced notices repeat on all 148 levels; a sample of them is enough.
   for (let i = 0; i < count; i += object.isInstancedMesh ? 7 : 1) {
    matrix.copy(object.matrixWorld);
    if (object.isInstancedMesh) { const local = new THREE.Matrix4(); object.getMatrixAt(i, local); matrix.multiply(local); }
    matrix.decompose(centre, quaternion, scale);
    normal.set(0, 0, 1).applyQuaternion(quaternion);
    const near = roots.filter((root) => root.box.max.y > centre.y - 2 && root.box.min.y < centre.y + 2).map((root) => root.object);
    const front = cast(near, centre.x + normal.x * 0.03, centre.y, centre.z + normal.z * 0.03, normal.x, normal.y, normal.z, 6, object);
    // The backward probe starts on the plate itself: a plate lying on a wall
    // is closer to it than any fixed standoff, and a probe that starts behind
    // the plate starts inside the wall.
    const back = cast(near, centre.x + normal.x * 0.001, centre.y, centre.z + normal.z * 0.001, -normal.x, -normal.y, -normal.z, 6, object);
    const f = front ? front.distance : 6, b = back ? back.distance : 6;
    // A sign hung from the ceiling on rods says so in its name.
    const hung = object.name === 'hung-sign';
    const kind = f < 0.45 && b >= 0.45 ? 'BACKWARDS' : b >= 0.45 && !hung ? 'LOOSE' : f < 0.25 ? 'BURIED' : null;
    const doubleSided = material.side === THREE.DoubleSide;
    if (!kind) { if (doubleSided) twoSided++; continue; }
    const size = object.geometry.parameters;
    plates.push({
     kind, name: object.name || '', w: +(size.width * scale.x).toFixed(2), h: +(size.height * scale.y).toFixed(2),
     y: +centre.y.toFixed(1), r: +Math.hypot(centre.x, centre.z).toFixed(1), bearing: +Math.atan2(centre.z, centre.x).toFixed(2), front: +f.toFixed(2), back: +b.toFixed(2),
     pose: { name: `plate-${kind}-${plates.length}`, x: centre.x + normal.x * 2.2, y: centre.y - 0.2, z: centre.z + normal.z * 2.2, tx: centre.x, ty: centre.y, tz: centre.z },
    });
   }
  });
  return { summary, faults, plates, twoSided };
 }, { only: process.argv.slice(2), part, parts: PARTS });
 };
 const partial = await Promise.all(Array.from({ length: PARTS }, (_, part) => measure(part)));
 const report = {
  summary: partial.flatMap((r) => r.summary).sort((a, b) => a.level - b.level),
  faults: partial.flatMap((r) => r.faults),
  plates: partial.flatMap((r) => r.plates),
  twoSided: partial[0].twoSided,
 };

 console.table(report.summary);
 const by = (list, field) => list.reduce((groups, item) => ((groups[item[field]] ||= []).push(item), groups), {});
 // Grouped by what went wrong rather than listed one by one: a missing wall
 // shows up as dozens of sightlines, and it is still one missing wall.
 for (const [kind, list] of Object.entries(by(report.faults, 'kind'))) {
  console.log(`\n${kind}: ${list.length} places`);
  for (const [what, same] of Object.entries(by(list, 'what')).sort((a, b) => b[1].length - a[1].length)) {
   const levels = [...new Set(same.map((f) => f.level))];
   const f = same[0];
   console.log(`  ${String(same.length).padStart(4)}x  ${what}   levels ${levels.slice(0, 12).join(',')}${levels.length > 12 ? '…' : ''}   e.g. L${f.level} r=${f.r} bearing=${f.bearing}${f.toward !== undefined ? ' toward=' + f.toward : ''}`);
  }
 }
 const wrong = report.plates;
 console.log(`\nLettering: ${wrong.length} misplaced (${report.twoSided} more are two-sided but backed by a wall)`);
 for (const [kind, list] of Object.entries(by(report.plates, 'kind'))) {
  console.log(`  ${kind}: ${list.length}`);
  for (const p of list.slice(0, Number(process.env.SHOW || 12))) console.log(`    ${p.name} ${p.w}x${p.h}m  y=${p.y} r=${p.r} bearing=${p.bearing}  front=${p.front} back=${p.back}`);
 }
 if (process.env.POSES) fs.writeFileSync(process.env.POSES, JSON.stringify([...report.faults.map((f) => f.pose), ...wrong.map((p) => p.pose)], null, 1));
 const bad = report.faults.length + wrong.length;
 console.log(bad ? `\nWORLD CHECK FAILED: ${report.faults.length} structural faults, ${wrong.length} misplaced plates` : '\nWORLD CHECK PASSED: no leaks, no missing floors or roofs, nothing solid across a walkable step, all lettering faces its reader');
 process.exitCode = bad ? 1 : 0;
 } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
