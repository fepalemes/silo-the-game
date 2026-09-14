// Plain-Node regression tests for the layout/collision math (no three.js, no
// DOM). Run with `npm test`. These exist because the geometry here is easy
// to get subtly wrong when tuning constants - in particular the headroom
// check below caught a real bug where widening the hall (plateauHalfAngle)
// left the player's head clipping through the stair tread "one turn up".
import { appendSweptSolid, meshData } from "../js/geometry.js";
import { readFileSync } from "node:fs";
import {
  buildLayout,
  PARAPET_HEIGHT,
  PARAPET_THICKNESS,
  SLAB_THICKNESS,
  STATIONS,
  TRANSIT_TURNS,
  WALL_THICKNESS,
  DEEPEST_LEVEL,
  LEVEL_HEIGHT,
  TURNS_PER_LEVEL,
  WING_OFFSETS,
  WORLD,
  ZONES,
  zoneForLevel,
} from "../js/config.js";
import { classifyTheta, resolveMove, slopeOuterRadius } from "../js/collision.js";

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("ok:", msg);
  } else {
    failures++;
    console.error("FAIL:", msg);
  }
}
function approx(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

const layout = buildLayout();
const TAU = Math.PI * 2;

function heightAt(theta) {
  const zone = classifyTheta(layout, theta);
  if (zone.type === "plateau") return zone.station.y;
  return zone.slope.yStart + (zone.slope.yEnd - zone.slope.yStart) * zone.t;
}

// --- Station data vs. the structural-cutaway zoning --------------------
// The reference diagram fixes which band of the silo each function lives in
// (governance/sheriff up top, schools upper-middle, medical middle, farms
// and IT middle-lower, machinery at the bottom). These checks stop a level
// number from silently drifting into the wrong band again.
{
  assert(TRANSIT_TURNS.length === STATIONS.length - 1, `TRANSIT_TURNS has one entry per gap (${TRANSIT_TURNS.length} vs ${STATIONS.length - 1})`);
  assert(TRANSIT_TURNS.every((t) => t >= 2), "every transit is at least 2 turns (keeps the headroom margin)");

  // The show's own four bands, per the 3D cutaway: Up Top 1-49, the Mids
  // 50-119, Down Deep 120-144, Below 145-148.
  const expectedZone = {
    topo: "SILO SUPERIOR",
    judicial: "SILO SUPERIOR",
    ninho: "SILO SUPERIOR",
    residencial: "SILO SUPERIOR",
    creche: "SILO SUPERIOR",
    enfermaria: "OS MÉDIOS",
    bazar: "OS MÉDIOS",
    rocas: "OS MÉDIOS",
    agua: "OS MÉDIOS",
    ti: "OS MÉDIOS",
    mecanica: "FUNDO DO SILO",
    gerador: "FUNDO DO SILO",
    escavador: "ABAIXO",
    minas: "ABAIXO",
    caverna: "ABAIXO",
    limiar: "ABAIXO",
  };
  for (const station of STATIONS) {
    const actual = zoneForLevel(station.level).name;
    assert(actual === expectedZone[station.id], `${station.id} (nível ${station.level}) fica em ${expectedZone[station.id]} - got ${actual}`);
  }

  // Levels increase going down. Sub-levels (the Digger Void under the silo)
  // are not numbered levels of their own, so they repeat the level above.
  for (let i = 1; i < STATIONS.length; i++) {
    const ok = STATIONS[i].isSublevel ? STATIONS[i].level >= STATIONS[i - 1].level : STATIONS[i].level > STATIONS[i - 1].level;
    assert(ok, `station ${i} (${STATIONS[i].id}) level increases going down`);
  }
  const numbered = STATIONS.filter((s) => !s.isSublevel);
  assert(numbered[numbered.length - 1].level === 144, "the deepest numbered level is 144");
  const below = STATIONS.filter((s) => s.isSublevel);
  assert(below.length === 4, `the silo has four levels below 144, as the 3D cutaway does (got ${below.length})`);
  assert(ZONES[ZONES.length - 1].to === 148, "zoning covers every level down to 148");

  // The stair's own arithmetic: two turns per level, matching the reference.
  // This is what makes the level plaques on the stairs tell the truth.
  const modelled = WORLD.risePerTurn * TURNS_PER_LEVEL;
  assert(Math.abs(modelled - LEVEL_HEIGHT) < 1e-9, `risePerTurn x turns-per-level equals a level (${modelled}m vs ${LEVEL_HEIGHT}m)`);
  for (let i = 1; i < STATIONS.length; i++) {
    const levels = Math.max(1, STATIONS[i].level - STATIONS[i - 1].level);
    const drop = TRANSIT_TURNS[i - 1] * WORLD.risePerTurn;
    const expected = levels * LEVEL_HEIGHT;
    assert(Math.abs(drop - expected) < 1.0, `${STATIONS[i].id}: the flight drops the ${levels} level(s) it claims (${drop.toFixed(1)}m vs ${expected.toFixed(1)}m)`);
  }
}

// --- Nothing may poke out through the silo's outer shell ----------------
{
  const deepest = Math.max(...STATIONS.map((s) => s.roomDepth));
  const reach = WORLD.landingR + WORLD.corridorLen + deepest;
  assert(reach < WORLD.shellR, `the deepest room ends at r=${reach} which is inside the shell at r=${WORLD.shellR}`);
  assert(WORLD.hubR < WORLD.ringInnerR, "hub is inside the ring (there is a void between them)");
  assert(WORLD.stairOuterR <= WORLD.hubR, "the stair fits on the hub platform");
}

// --- Layout sanity -----------------------------------------------------
{
  const { stations, slopes } = layout;
  for (let i = 1; i < stations.length; i++) {
    assert(stations[i].theta > stations[i - 1].theta, `station ${i} theta increases`);
    assert(stations[i].y < stations[i - 1].y, `station ${i} y decreases`);
  }
  for (const slope of slopes) {
    assert(slope.thetaEnd > slope.thetaStart, "slope has positive angular length");
  }
}

// --- Headroom: the player must never find the tread "one full turn up"
// closer than a safe walking clearance above their current floor, anywhere
// in the game. This is what actually gets hit while walking, unlike a
// single hand-picked sample point. ---
{
  const MIN_CLEARANCE = 2.2; // meters; eye height is 1.65m, so this still
  // leaves ~0.55m above the player's eyes at the single worst point.
  const first = layout.stations[0];
  const last = layout.stations[layout.stations.length - 1];
  const lo = first.theta - WORLD.landingHalfAngle + TAU;
  const hi = last.theta + WORLD.landingHalfAngle;
  let worst = Infinity;
  let worstTheta = null;
  for (let theta = lo; theta <= hi; theta += 0.01) {
    const clearance = heightAt(theta - TAU) - heightAt(theta);
    if (clearance < worst) {
      worst = clearance;
      worstTheta = theta;
    }
  }
  assert(Number.isFinite(worst) && worst >= MIN_CLEARANCE, `headroom stays >= ${MIN_CLEARANCE}m everywhere (worst=${worst.toFixed(3)}m at theta=${worstTheta?.toFixed(2)})`);
}


// Walks the player with a steering nudge towards `targetR`, the way a person
// would, rather than shoving them along a pure tangent (which creeps outward).
function circle(layout, state, laps, targetR, stepLen = 0.1) {
  let swept = 0;
  let prev = Math.atan2(state.z, state.x);
  for (let i = 0; i < 200000 && Math.abs(swept) < laps * Math.PI * 2; i++) {
    const r = Math.hypot(state.x, state.z) || 1;
    const pull = Math.max(-0.3, Math.min(0.3, (targetR - r) * 0.5));
    const dx = -state.z / r + (state.x / r) * pull;
    const dz = state.x / r + (state.z / r) * pull;
    const len = Math.hypot(dx, dz) || 1;
    state = resolveMove(layout, state, (dx / len) * stepLen, (dz / len) * stepLen);
    const b = Math.atan2(state.z, state.x);
    let d = b - prev;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    swept += d;
    prev = b;
  }
  return { state, swept };
}

function pushRadially(layout, state, sign, stops, stepLen = 0.05) {
  for (let i = 0; i < 20000; i++) {
    const r = Math.hypot(state.x, state.z) || 1;
    if (stops(r, state)) break;
    state = resolveMove(layout, state, (state.x / r) * sign * stepLen, (state.z / r) * sign * stepLen);
  }
  return state;
}

// --- Movement smoke tests -----------------------------------------------
{
  // Stepping off the stair at level 1's landing puts the player on that
  // level's ring, at that level's floor height.
  let state = { x: 3.0, y: 0, z: 0, theta: 0, level: null };
  state = pushRadially(layout, state, +1, (r) => r > WORLD.ringInnerR + 1.5);
  assert(state.level === 0, `stepping out at a landing lands the player on that level (level=${state.level})`);
  assert(approx(state.y, layout.stations[0].y), "the ring floor is at its own level's height");
  assert(Math.hypot(state.x, state.z) > WORLD.ringInnerR, "the player actually crossed the void onto the ring");
}

{
  let state = { x: 3.0, y: 0, z: 0, theta: 0 };
  const lastStation = layout.stations[layout.stations.length - 1];
  let steps = 0;
  // Steer, don't just push tangentially: a purely tangential step moves along
  // a chord, so the radius grows by sqrt(r^2 + step^2) - r every time. Over the
  // silo's ~300 turns that creep is enough to pin the walker against the outer
  // wall, where it stalls. A real player corrects inward; so does this.
  const targetR = (WORLD.shaftR + WORLD.stairOuterR) / 2;
  while (state.theta < lastStation.theta - 0.01 && steps < 20_000_000) {
    const r = Math.hypot(state.x, state.z) || 1;
    const tangentX = -state.z / r;
    const tangentZ = state.x / r;
    const pull = Math.max(-0.4, Math.min(0.4, (targetR - r) * 0.5));
    const dirX = tangentX + (state.x / r) * pull;
    const dirZ = tangentZ + (state.z / r) * pull;
    const len = Math.hypot(dirX, dirZ) || 1;
    state = resolveMove(layout, state, (dirX / len) * 0.15, (dirZ / len) * 0.15);
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) break;
    steps++;
  }
  assert(Number.isFinite(state.y), "full descent never produces NaN");
  assert(state.theta >= lastStation.theta - 0.5, `full descent reaches the final station (steps=${steps})`);
}

// --- slopeOuterRadius sanity: the stair flares out to the small hub at
// each end (NOT the outer ring - the stair never touches the ring directly,
// only bridges do), and narrows to the plain stair width mid-flight. -------
assert(approx(slopeOuterRadius(0), WORLD.hubR), "slope radius at t=0 is hubR");
assert(approx(slopeOuterRadius(1), WORLD.hubR), "slope radius at t=1 is hubR");
assert(approx(slopeOuterRadius(0.5), WORLD.stairOuterR), "slope radius at t=0.5 is stairOuterR");

// --- Reaching the ring and crossing a bridge into a secondary wing --------
{
  // The whole point of the rewrite: a ring floor is walkable all 360 degrees,
  // and a full lap must not change the player's height or which level they
  // are on. Under the old plateau model the hall was a fraction of a turn and
  // a lap was impossible; under a naive port of it, a lap silently walked the
  // player a turn down the helix and dropped them a floor.
  let state = { x: 3.0, y: 0, z: 0, theta: 0, level: null };
  state = pushRadially(layout, state, +1, (r) => r > WORLD.ringInnerR + 1.5);
  const startY = state.y;
  const startLevel = state.level;
  const lap = circle(layout, state, 1, (WORLD.ringInnerR + WORLD.landingR) / 2);
  assert(Math.abs(lap.swept) >= Math.PI * 2 - 0.2, `a full lap of the ring is walkable (swept ${((lap.swept * 180) / Math.PI).toFixed(0)} deg)`);
  assert(approx(lap.state.y, startY), "a full lap does not change height");
  assert(lap.state.level === startLevel, "a full lap does not change level");

  // ...and stepping back in at the landing returns to the stair at the same height.
  let back = pushRadially(layout, lap.state, -1, (r) => r < WORLD.stairOuterR - 0.6);
  assert(back.level === null, `stepping back in across the landing returns to the stair (level=${back.level})`);
  assert(approx(back.y, startY), "returning to the stair does not change height");
}

{
  // Every level is real and reachable, not just the authored landmarks.
  assert(layout.stations.length === DEEPEST_LEVEL, `the silo has all ${DEEPEST_LEVEL} levels built (got ${layout.stations.length})`);
  const authored = layout.stations.filter((s) => !s.generated);
  assert(authored.length === STATIONS.length, "every authored level appears exactly once");
  for (let i = 0; i < layout.stations.length; i++) {
    assert(layout.stations[i].level === i + 1, `level ${i + 1} is numbered correctly`);
  }
  // All landings share one compass bearing - that is what makes the stair and
  // the floors agree about where you can step off.
  let worst = 0;
  for (const st of layout.stations) {
    worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(st.theta), Math.cos(st.theta))));
  }
  assert(worst < 1e-6, `every landing sits at the same bearing (worst drift ${worst.toExponential(1)} rad)`);
}
{
  // Walking outward at an angle NOT aligned with any wing should be stopped
  // at the hub's edge by the void (no floor to walk on).
  const offAngle = 1.2; // not close to 0, +2.15 or -2.15
  let state = { x: 3.0 * Math.cos(offAngle), y: 0, z: 3.0 * Math.sin(offAngle), theta: offAngle };
  for (let i = 0; i < 300; i++) {
    state = resolveMove(layout, state, Math.cos(offAngle) * 0.05, Math.sin(offAngle) * 0.05);
  }
  const r = Math.hypot(state.x, state.z);
  assert(r <= WORLD.hubR + 0.05, `walking outward off-angle is stopped at the hub edge by the void (r=${r.toFixed(2)}, hubR=${WORLD.hubR})`);
}

{
  // --- Nothing floats -------------------------------------------------------
  // Every one of these caught a real defect: guard walls centred on a slab's
  // rim left 11cm hanging over the void, hung lanterns stopped 5.5cm short of
  // the ceiling, and treads thinner than the rise between steps opened a slot
  // you could see straight through the flight. They are all relationships
  // between constants, so they can be locked here rather than eyeballed in a
  // screenshot every time someone retunes a dimension.
  const half = PARAPET_THICKNESS / 2;

  // A guard wall inset by half its thickness must land fully on its slab.
  const standsOn = (edge, inset, slabInner, slabOuter) =>
    edge + inset - half >= slabInner - 1e-9 && edge + inset + half <= slabOuter + 1e-9;

  assert(standsOn(WORLD.shaftR, half, WORLD.shaftR, WORLD.hubR), "shaft guard wall stands entirely on the hub slab");
  assert(standsOn(WORLD.hubR, -half, WORLD.shaftR, WORLD.hubR), "hub guard wall stands entirely on the hub slab");
  assert(standsOn(WORLD.ringInnerR, half, WORLD.ringInnerR, WORLD.landingR), "ring guard wall stands entirely on the ring slab");
  assert(standsOn(WORLD.stairOuterR, -half, WORLD.shaftR, WORLD.stairOuterR), "stair outer wall stands entirely on the treads");
  assert(PARAPET_THICKNESS <= WORLD.bridgeHalfW, "a bridge parapet fits on the bridge deck");

  // ...and inset walls must not close in past where collision stops the
  // player, or the player gets wedged against a wall they cannot reach.
  const pr = WORLD.playerRadius;
  assert(pr > half, `player radius (${pr}) clears an inset wall face (${half})`);
  assert(WORLD.hubR - pr < WORLD.hubR - PARAPET_THICKNESS, "player stops before the inset hub wall");
  assert(WORLD.ringInnerR + pr > WORLD.ringInnerR + PARAPET_THICKNESS, "player stops before the inset ring wall");
  assert(WORLD.bridgeHalfW - pr < WORLD.bridgeHalfW - PARAPET_THICKNESS, "player stops before the inset bridge parapet");

  // Treads must overlap vertically, or there is a gap between every step.
  const rise = WORLD.risePerTurn / WORLD.stepsPerTurn;
  const stepThickness = rise + 0.03;
  assert(stepThickness > rise, `stair treads overlap instead of leaving a slot (rise=${rise.toFixed(3)}m, tread=${stepThickness.toFixed(3)}m)`);

  // A slab deep enough to read as structure, and a hung fixture that cannot
  // be longer than the room it hangs in.
  assert(SLAB_THICKNESS > 0.3, `floor slabs have real depth (${SLAB_THICKNESS}m), not a thin plate`);
  assert(WALL_THICKNESS > 0.3, `ring walls are structural (${WALL_THICKNESS}m), not partitions`);
  assert(PARAPET_HEIGHT + 0.03 < WORLD.roomHeight, "a guard wall plus its cap rail fits under the ceiling");
  assert(PARAPET_HEIGHT > WORLD.eyeHeight * 0.5, `guard walls are tall enough to read as walls (${PARAPET_HEIGHT}m)`);
}

{
  // --- Nothing you can see through --------------------------------------------
  // The counterpart to "nothing floats": holes left where two pieces were
  // sized on different grids. All three of these were visible in play.
  const layout = buildLayout();

  // A doorway in the ring wall must be exactly as wide as the corridor behind
  // it. It used to be built by dropping whole fixed-width wall segments, which
  // opened a 5.0m hole for a 3.6m corridor.
  const doorHalf = Math.asin(WORLD.corridorHalfW / WORLD.landingR);
  const openingWidth = 2 * doorHalf * WORLD.landingR;
  const corridorWidth = 2 * WORLD.corridorHalfW;
  assert(
    Math.abs(openingWidth - corridorWidth) < 0.05,
    `ring doorway matches the corridor it opens onto (${openingWidth.toFixed(2)}m vs ${corridorWidth.toFixed(2)}m)`
  );
  // ...and the corridor's own side walls have to reach the jamb, not stop short.
  const corridorWallZ = WORLD.corridorHalfW + 0.12;
  assert(corridorWallZ - 0.12 <= doorHalf * WORLD.landingR + 1e-6, "corridor side walls meet the ring doorway jamb");

  // Doorways must not overlap each other or run off the end of the hall.
  const sorted = [...WING_OFFSETS].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assert(sorted[i] - sorted[i - 1] > 2 * doorHalf, `wings ${sorted[i - 1]} and ${sorted[i]} do not share a doorway`);
  }
  // The hall is a full circle now, so a doorway cannot fall off the end of it.
  // What still matters is that every wing clears the landing deck: a corridor
  // mouth opening onto the deck would put a door where the stair arrives.
  for (const offset of WING_OFFSETS) {
    const fromLanding = Math.abs(Math.atan2(Math.sin(offset), Math.cos(offset)));
    assert(fromLanding > WORLD.landingHalfAngle + doorHalf, `wing at ${offset.toFixed(2)} rad clears the landing deck`);
  }

  // The stair has to reach its landing. The tread loop used to run i < n,
  // stopping one step short and leaving a 0.275m hole where every flight met
  // the floor. This is an off-by-one in geometry code the Node tests cannot
  // import (it needs three.js), so guard the boundary in the source itself.
  const stairsSrc = readFileSync(new URL("../js/world/stairs.js", import.meta.url), "utf8");
  assert(/for \(let i = 0; i <= stepCount; i\+\+\)/.test(stairsSrc), "the tread loop includes the last step, so the flight reaches its landing");
  assert(stairsSrc.includes("appendSweptSolid(data"), "treads are curved solid wedges");
  assert(/"coping"/.test(stairsSrc), "the stair parapet is finished in concrete, not a metal rail");

  // The facade stack has no gaps left to cover: the decorative "filler" levels
  // are gone, because all 148 levels are real floors now. What replaced that
  // invariant is simply that consecutive levels are a level-height apart.
  for (let i = 1; i < layout.stations.length; i++) {
    const drop = layout.stations[i - 1].y - layout.stations[i].y;
    assert(Math.abs(drop - LEVEL_HEIGHT) < 1e-9, `level ${i + 1} sits one level-height below the one above (${drop.toFixed(3)}m)`);
  }
}

// Real regression cases: no invisible rooms, terminal stair escape, or
// walking through furniture. Test the geometry data, not only source strings.
{
  const station = layout.stations[1];
  const angle = (station.wingRotation || 0) + WING_OFFSETS[0];
  let state = { x: (WORLD.landingR - 0.5) * Math.cos(angle), z: (WORLD.landingR - 0.5) * Math.sin(angle), y: station.y, theta: station.theta, level: 1 };
  for (let i = 0; i < 40; i++) state = resolveMove(layout, state, Math.cos(angle) * 0.1, Math.sin(angle) * 0.1);
  assert(Math.hypot(state.x, state.z) <= WORLD.landingR - WORLD.playerRadius + 1e-6, "generated floors cannot enter invisible corridors through closed doors");
  const first = { x: 3, z: 0, y: 0, theta: 0, level: null };
  let top = first;
  for (let i = 0; i < 200; i++) top = resolveMove(layout, top, top.z * 0.03, -top.x * 0.03);
  assert(top.theta >= -WORLD.landingHalfAngle - 1e-6, "walking upstairs cannot leave the top of the staircase");
  assert(resolveMove(layout, first, NaN, 0).x === first.x, "invalid movement cannot corrupt the player position");
  const st = layout.stations[0];
  st.obstacles = [{ x: 19, z: 0, hw: 0.5, hd: 0.5, angle: 0 }];
  const approach = { x: 17.5, z: 0, y: st.y, theta: st.theta, level: 0 };
  const stopped = resolveMove(layout, approach, 4, 0);
  assert(stopped.x <= 18.15 + 1e-6, "large movement cannot tunnel through a column");
  delete st.obstacles;
}
{
  const data = appendSweptSolid(meshData(), { start: 0, end: Math.PI / 2, segments: 8, inner: 2, outer: 6, bottom: -0.2, top: 0 });
  assert(data.positions.every(Number.isFinite), "curved solids contain only finite vertices");
  assert(data.indices.every((i) => i >= 0 && i < data.positions.length / 3), "curved solid indices all reference actual vertices");
  let valid = true;
  for (let i = 0; i < data.positions.length; i += 3) {
    const radius = Math.hypot(data.positions[i], data.positions[i + 2]);
    valid &&= Math.abs(radius - 2) < 1e-6 || Math.abs(radius - 6) < 1e-6;
  }
  assert(valid, "curved treads follow their inner and outer radii without rectangular overhangs");
  assert(data.uvs.length === data.positions.length / 3 * 2, "every curved vertex has texture coordinates");
}

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
