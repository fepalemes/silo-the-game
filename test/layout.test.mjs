// Plain-Node regression tests for the layout/collision math (no three.js, no
// DOM). Run with `npm test`. These exist because the geometry here is easy
// to get subtly wrong when tuning constants - in particular the headroom
// check below caught a real bug where widening the hall (plateauHalfAngle)
// left the player's head clipping through the stair tread "one turn up".
import { buildLayout, STATIONS, TRANSIT_TURNS, WORLD, ZONES, zoneForLevel } from "../js/config.js";
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

  const expectedZone = {
    topo: "SILO SUPERIOR",
    judicial: "SILO SUPERIOR",
    ninho: "SILO SUPERIOR",
    residencial: "SUPERIOR-MÉDIO",
    creche: "SUPERIOR-MÉDIO",
    enfermaria: "SILO MÉDIO",
    bazar: "SILO MÉDIO",
    rocas: "MÉDIO-INFERIOR",
    agua: "MÉDIO-INFERIOR",
    ti: "MÉDIO-INFERIOR",
    mecanica: "FUNDO DO SILO",
    gerador: "FUNDO DO SILO",
    escavador: "FUNDO DO SILO",
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
  assert(STATIONS.some((s) => s.isSublevel), "the silo has something below its last numbered level");
  assert(ZONES[ZONES.length - 1].to === 144, "zoning covers all 144 levels");
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
  const lo = first.theta - WORLD.plateauHalfAngle + TAU;
  const hi = last.theta + WORLD.plateauHalfAngle;
  let worst = Infinity;
  let worstTheta = null;
  for (let theta = lo; theta <= hi; theta += 0.01) {
    const clearance = heightAt(theta - TAU) - heightAt(theta);
    if (clearance < worst) {
      worst = clearance;
      worstTheta = theta;
    }
  }
  assert(worst >= MIN_CLEARANCE, `headroom stays >= ${MIN_CLEARANCE}m everywhere (worst=${worst.toFixed(3)}m at theta=${worstTheta?.toFixed(2)})`);
}

// --- Movement smoke tests (station rooms + full descent) ---------------
{
  // Step count is derived from the actual geometry so this keeps working
  // when the silo's dimensions are retuned.
  let state = { x: 3.0, y: 0, z: 0, theta: 0 };
  const target = WORLD.landingR + WORLD.corridorLen + 2;
  const steps = Math.ceil((target / 0.05) * 1.3);
  for (let i = 0; i < steps; i++) state = resolveMove(layout, state, 0.05, 0);
  assert(state.x > WORLD.landingR + WORLD.corridorLen, `reaches the main room of station 0 (x=${state.x.toFixed(1)})`);
  assert(approx(state.y, 0), "main room floor stays flat");
}

{
  let state = { x: 3.0, y: 0, z: 0, theta: 0 };
  const lastStation = layout.stations[layout.stations.length - 1];
  let steps = 0;
  while (state.theta < lastStation.theta - 0.01 && steps < 4_000_000) {
    const r = Math.max(WORLD.shaftR + 0.4, Math.min(WORLD.stairOuterR - 0.2, Math.hypot(state.x, state.z)));
    const dirX = -state.z / (r || 1);
    const dirZ = state.x / (r || 1);
    state = resolveMove(layout, state, dirX * 0.15, dirZ * 0.15);
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
  let state = { x: 3.0, y: 0, z: 0, theta: 0 };
  // Walk straight out along the main wing: hub -> bridge -> ring -> room.
  const walkSteps = Math.ceil(((WORLD.landingR + WORLD.corridorLen + 4) / 0.05) * 1.3);
  for (let i = 0; i < walkSteps; i++) state = resolveMove(layout, state, 0.05, 0);
  const r = Math.hypot(state.x, state.z);
  assert(r > WORLD.landingR + WORLD.corridorLen - 1, `walking straight out along the main wing crosses hub+void+ring into the room (r=${r.toFixed(2)})`);
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

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
