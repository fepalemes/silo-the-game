// Plain-Node regression tests for the layout/collision math (no three.js, no
// DOM). Run with `npm test`. These exist because the geometry here is easy
// to get subtly wrong when tuning constants - in particular the headroom
// check below caught a real bug where widening the hall (plateauHalfAngle)
// left the player's head clipping through the stair tread "one turn up".
import { buildLayout, WORLD } from "../js/config.js";
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
  let state = { x: 3.0, y: 0, z: 0, theta: 0 };
  for (let i = 0; i < 600; i++) state = resolveMove(layout, state, 0.05, 0);
  assert(state.x > WORLD.landingR + WORLD.corridorLen, "reaches the main room of station 0");
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
  // Walk to the hub edge, then along wing offset [1] to cross the bridge.
  for (let i = 0; i < 700; i++) state = resolveMove(layout, state, 0.05, 0);
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
