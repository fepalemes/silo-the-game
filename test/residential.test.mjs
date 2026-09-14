// Plain-Node checks on the residential plan. `residential-layout.js` is the one
// description shared by rendering, collision and the browser route check, so the
// properties that make the alley an alley can be asserted here without three.js.
// The browser check (tools/residential-check.cjs) still owns anything that
// depends on the geometry actually being built.
import { RESIDENTIAL as P, inResidential, residentialAreas } from "../js/residential-layout.js";
import { WORLD } from "../js/config.js";

let failures = 0;
function assert(cond, msg) {
  if (cond) console.log("ok:", msg);
  else {
    console.error("FAIL:", msg);
    failures++;
  }
}

const doorSpan = (room) => {
  const cx = P.roomStart + room.index * P.roomWidth + 2.2;
  return [cx - 0.75, cx + 0.75];
};

{
  // No projecting block may stand in front of a door. This is the constraint
  // that makes the alley safe to reshape: doors, their colliders and the saved
  // door states all stay exactly where they were.
  for (const room of P.rooms) {
    const [lo, hi] = doorSpan(room);
    for (const j of P.jogs) {
      if (j.side !== room.side) continue;
      assert(j.x1 <= lo || j.x0 >= hi, `block ${j.x0}-${j.x1} clears the ${room.id} doorway`);
    }
  }
}

{
  // The alley has to stay walkable at its tightest point. The blocking face on
  // each side is whichever comes furthest in: the room front, the wall flanking
  // a door niche (which stands proud of it), or a projecting block. Measuring
  // only the blocks reports a corridor far wider than the one you can walk.
  const pr = WORLD.playerRadius;
  const faces = (x) => {
    let lo = -P.half;
    let hi = P.half;
    for (const room of P.rooms) {
      const a = P.roomStart + room.index * P.roomWidth;
      const b = a + P.roomWidth;
      if (x < a || x > b) continue;
      const cx = a + 2.2;
      const nd = P.niche + (room.recess || 0);
      const flanking = (x >= a && x <= cx - 0.75) || (x >= cx + 0.75 && x <= b);
      if (!flanking) continue;
      const f = P.half - nd + 0.08; // near face of the 0.16 m wall
      if (room.side < 0) lo = Math.max(lo, -f);
      else hi = Math.min(hi, f);
    }
    for (const j of [...P.jogs, ...P.stairs]) {
      if (x < j.x0 || x > j.x1) continue;
      if (j.side < 0) lo = Math.max(lo, -P.half + j.depth);
      else hi = Math.min(hi, P.half - j.depth);
    }
    return [lo, hi];
  };

  let worst = Infinity;
  let worstX = null;
  for (let x = P.start; x <= 52; x += 0.05) {
    const [lo, hi] = faces(x);
    if (hi - lo < worst) {
      worst = hi - lo;
      worstX = x;
    }
  }
  assert(worst - pr * 2 > 0.3, `the alley stays walkable at its narrowest (${worst.toFixed(2)}m at x=${worstX.toFixed(1)}, leaving ${(worst - pr * 2).toFixed(2)}m of slack)`);

  // It also has to actually change direction, or it is still a corridor.
  // A block only bends the route if it reaches past the centreline.
  const crossing = P.jogs.filter((j) => j.depth > P.half);
  assert(crossing.length >= 2, `at least two blocks cross the centreline, so the route doglegs (${crossing.length})`);
  const sides = new Set(crossing.map((j) => j.side));
  // Each crossing block must still leave a usable channel on its far side.
  for (const j of crossing) {
    const [lo, hi] = faces((j.x0 + j.x1) / 2);
    assert(hi - lo > pr * 2 + 0.3, `the block at x=${j.x0}-${j.x1} leaves a walkable channel (${(hi - lo).toFixed(2)}m, centred on z=${((lo + hi) / 2).toFixed(2)})`);
  }
  assert(sides.size === 2, "the crossing blocks come from opposite sides, so the dogleg reverses");
}

{
  // The external stairs are solid, so they get the same clearances as the
  // blocks: never in a doorway, and never opposite a jog that already crosses
  // the centreline - that combination leaves no channel at all.
  for (const st of P.stairs) {
    for (const room of P.rooms) {
      if (room.side !== st.side) continue;
      const [lo, hi] = doorSpan(room);
      assert(st.x1 <= lo || st.x0 >= hi, `stair ${st.x0}-${st.x1} clears the ${room.id} doorway`);
    }
    for (const j of P.jogs) {
      if (j.side === st.side || j.depth <= P.half) continue;
      const overlaps = st.x1 > j.x0 && st.x0 < j.x1;
      assert(!overlaps, `stair ${st.x0}-${st.x1} is not opposite the crossing block at ${j.x0}-${j.x1}`);
    }
  }
}

{
  // Every part of the plan must be inside the footprint collision accepts,
  // otherwise the player walks into geometry that exists but is not floored.
  assert(inResidential(P.start + 0.1, 0), "the alley mouth is inside the walkable footprint");
  assert(inResidential((P.plaza.x0 + P.plaza.x1) / 2, 0), "the plaza is inside the walkable footprint");
  assert(inResidential((P.plaza.x0 + P.plaza.x1) / 2, P.plaza.half - 0.1), "the plaza's full width is walkable");
  assert(!inResidential(P.end + 1, 0), "the footprint stops at the end wall");

  let gaps = 0;
  for (let x = P.start; x <= P.end; x += 0.1) if (!inResidential(x, 0)) gaps++;
  assert(gaps === 0, "the centreline is continuous from the ring to the plaza");

  // Each room's threshold has floor on both sides of its door.
  for (const room of P.rooms) {
    const cx = P.roomStart + room.index * P.roomWidth + 2.2;
    assert(inResidential(cx, room.side * (P.half - 0.2)), `${room.id}: alley side of the threshold is floored`);
    assert(inResidential(cx, room.side * (P.half + 0.4)), `${room.id}: room side of the threshold is floored`);
  }
}

{
  // The wing must still fit inside the silo shell once the plaza extends it.
  const corner = Math.hypot(P.end, P.plaza.half);
  assert(corner < WORLD.shellR, `the plaza's far corner stays inside the shell (r=${corner.toFixed(1)} vs ${WORLD.shellR})`);
  // rooms are indexed per side, so the block's depth is the highest index + 1
  const columns = Math.max(...P.rooms.map((r) => r.index)) + 1;
  const roomCorner = Math.hypot(P.roomStart + columns * P.roomWidth, P.outer);
  assert(roomCorner < WORLD.shellR, `the room block stays inside the shell (r=${roomCorner.toFixed(1)})`);

  // Areas must not be empty or inverted - a silently inverted rectangle would
  // read as "nowhere is walkable" rather than as an error.
  for (const a of residentialAreas()) {
    assert(a.x1 > a.x0 && a.z1 > a.z0, `area ${a.x0},${a.z0} -> ${a.x1},${a.z1} is non-empty`);
  }
}

{
  // Save compatibility: progress.js validates stored door states against these
  // ids, so renaming or dropping one silently invalidates every existing save.
  const ids = P.rooms.map((r) => r.id).sort();
  const expected = ["apt-28-a", "apt-28-b", "apt-28-c", "laundry-28", "store-28", "workshop-28"].sort();
  assert(JSON.stringify(ids) === JSON.stringify(expected), "the six room ids are unchanged, so existing saves still load");
}

console.log(failures === 0 ? "\nRESIDENTIAL PLAN TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
