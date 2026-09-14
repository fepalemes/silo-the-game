// Stable light slots keep selection changes from snapping between fixtures.
// No renderer dependency: the fade behavior is tested in plain Node.
export function createLightPool(size = 10) {
  const slots = Array.from({ length: size }, () => ({ source: null, target: null, weight: 0 }));
  let initialized = false;
  function select(sources, position) {
    const retained = new Set(slots.map(s => s.target));
    const ranked = sources.map(source => {
      const d2 = (source.position.x-position.x)**2 + (source.position.y-position.y)**2 + (source.position.z-position.z)**2;
      return { source, d2, score: source.intensity / (1+d2) * (retained.has(source) ? 1.15 : 1) };
    }).filter(s => s.d2 < (s.source.distance+12)**2).sort((a,b) => b.score-a.score).slice(0,size).map(s=>s.source);
    if (!initialized) {
      slots.forEach((slot,i) => { slot.source=slot.target=ranked[i] || null;slot.weight=slot.source ? 1 : 0; });
      initialized=true;
      return;
    }
    const available = ranked.filter(source => !slots.some(slot => slot.target === source));
    for (const slot of slots) if (!ranked.includes(slot.target)) slot.target = available.shift() || null;
  }
  function advance(dt) {
    const step = Math.max(0,Math.min(dt,0.1)) / .18;
    for (const slot of slots) {
      if (slot.source !== slot.target) {
        slot.weight = Math.max(0,slot.weight-step);
        if (slot.weight === 0) slot.source = slot.target;
      } else slot.weight = Math.min(slot.source ? 1 : 0,slot.weight+step);
    }
    return slots;
  }
  return { select, advance, slots };
}
