// Versioned local progress. Storage failures never interrupt exploration.
import { WORLD } from './config.js';
import { RESIDENTIAL } from './residential-layout.js';
import { RELICS, STEPS, settle } from './quests.js';
export { STEPS };
export const SAVE_KEY = 'silo18.progress.v1';
export function createProgress(saved = {}) {
  const completed = new Set(saved.completed || []), records = new Set(saved.records || []);
  const doors = {...saved.doors};
  // The departments the player has stood in: the menu's "go to" list.
  const visited = new Set(saved.visited || []);
  // Relics picked up (quests.js).
  const items = new Set(saved.items || []);
  // Steps of the journey that what has happened already settles.
  const catchUp = () => { const added = settle([...completed], [...items], [...records]); for (const id of added) completed.add(id); return added.length > 0; };
  return {
    complete(id) { if (!STEPS.some(s => s.id === id) || completed.has(id)) return false; completed.add(id); catchUp(); return true; },
    read(id) { const fresh = !records.has(id); records.add(id); if (id === 'topo') completed.add('record'); catchUp(); return fresh; },
    take(id) { if (!RELICS.some(r => r.id === id) || items.has(id)) return false; items.add(id); catchUp(); return true; },
    has: (id) => items.has(id),
    items: () => [...items],
    completed: () => [...completed],
    door: (id,open) => { doors[id]=Boolean(open); },
    visit(id) { if (visited.has(id)) return false; visited.add(id); return true; },
    hasVisited: (id) => visited.has(id),
    snapshot: () => ({ completed: [...completed], records: [...records], doors: {...doors}, visited: [...visited], items: [...items] }),
  };
}
export function createSaveStore(getStorage, layout, signature) {
  function validate(value) {
    if (value?.version !== 1 || value.signature !== signature || !Number.isFinite(value.savedAt)) throw Error('save');
    const p = value.player, q = value.progress;
    if (!p || !['x','y','z','theta','yaw','pitch'].every(k => Number.isFinite(p[k]))) throw Error('position');
    if (Math.hypot(p.x,p.z)>62 || p.y>1 || p.y<layout.stations.at(-1).y-1 || Math.abs(p.pitch)>1.5 || p.theta < -WORLD.landingHalfAngle || p.theta>layout.stations.at(-1).theta+1) throw Error('bounds');
    if (p.level!==null && (!Number.isInteger(p.level) || !layout.stations[p.level])) throw Error('level');
    if (!q || !Array.isArray(q.completed) || !q.completed.every(id => STEPS.some(s=>s.id===id)) || !Array.isArray(q.records) || !q.records.every(id => layout.stations.some(s=>s.id===id))) throw Error('progress');
    if(q.items !== undefined && (!Array.isArray(q.items) || !q.items.every(id => RELICS.some(r=>r.id===id)))) throw Error('items');
    if(q.visited !== undefined && (!Array.isArray(q.visited) || !q.visited.every(id => layout.stations.some(s=>s.id===id)))) throw Error('visited');
    if(q.doors !== undefined && (!q.doors || typeof q.doors!=="object" || Array.isArray(q.doors) || !Object.entries(q.doors).every(([id,v])=>RESIDENTIAL.rooms.some(r=>r.id===id)&&typeof v==="boolean")))throw Error("doors");
    return value;
  }
  return {
    load() { try { const raw=getStorage().getItem(SAVE_KEY); return raw ? {save:validate(JSON.parse(raw))} : {}; } catch { return {error:'Não foi possível carregar o progresso. O arquivo existente foi preservado.'}; } },
    save(player, progress) { try { const data=validate({version:1,signature,savedAt:Date.now(),player,progress}); getStorage().setItem(SAVE_KEY,JSON.stringify(data)); return {save:data}; } catch { return {error:'Não foi possível salvar. Verifique o espaço e as permissões do navegador.'}; } },
  };
}
