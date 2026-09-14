// Pure mesh data shared by the renderer and geometry regression tests.
// Each section is a closed, curved rectangular solid, with metre-scaled UVs.
export function appendSweptSolid(data, { start, end, segments, inner, outer, bottom, top }) {
  const value = (v, t) => typeof v === "function" ? v(t) : v;
  const corners = (t) => {
    const a = start + (end - start) * t;
    const ri = value(inner, t), ro = value(outer, t);
    const lo = value(bottom, t), hi = value(top, t);
    return [[ri * Math.cos(a), lo, ri * Math.sin(a)], [ro * Math.cos(a), lo, ro * Math.sin(a)],
      [ro * Math.cos(a), hi, ro * Math.sin(a)], [ri * Math.cos(a), hi, ri * Math.sin(a)]];
  };
  const quad = (a, b, c, d) => {
    const base = data.positions.length / 3;
    data.positions.push(...a, ...b, ...c, ...d);
    const w = Math.hypot(...b.map((n, i) => n - a[i])) / 3;
    const h = Math.hypot(...d.map((n, i) => n - a[i])) / 3;
    data.uvs.push(0, 0, w, 0, w, h, 0, h);
    data.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (let side = 0; side < 4; side++) {
    const base = data.positions.length / 3;
    let u = 0, previous;
    for (let i = 0; i <= segments; i++) {
      const p = corners(i / segments), a = p[side], b = p[(side + 1) % 4];
      if (previous) u += Math.hypot(...a.map((n, k) => n - previous[k])) / 3;
      data.positions.push(...a, ...b);
      data.uvs.push(u, 0, u, Math.hypot(...a.map((n, k) => n - b[k])) / 3);
      if (i < segments) { const v = base + i * 2; data.indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      previous = a;
    }
  }
  const a = corners(0), b = corners(1);
  quad(a[3], a[2], a[1], a[0]);
  quad(b[0], b[1], b[2], b[3]);
  return data;
}
export const meshData = () => ({ positions: [], uvs: [], indices: [] });

// Shared angular endpoints make the tapered rim meet exactly at every tread.
export function stairSections(slope, stepsPerTurn) {
  const span=slope.thetaEnd-slope.thetaStart;
  const count=Math.max(1,Math.round(span/(Math.PI*2/stepsPerTurn)));
  const rise=Math.abs(slope.yEnd-slope.yStart)/count;
  return Array.from({length:count+1},(_,i)=>({
    t:i/count, start:Math.max(slope.thetaStart,slope.thetaStart+span*(i-.5)/count),
    end:Math.min(slope.thetaEnd,slope.thetaStart+span*(i+.5)/count),
    y:slope.yStart+(slope.yEnd-slope.yStart)*i/count, thickness:rise+.03, rise,
  }));
}
