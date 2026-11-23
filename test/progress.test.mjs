import assert from 'node:assert/strict';
import { createProgress, createSaveStore, SAVE_KEY } from '../js/progress.js';
import { buildLayout } from '../js/config.js';
const layout=buildLayout(),data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const store=createSaveStore(()=>storage,layout,'test');
const p={x:3,y:0,z:0,theta:0,level:null,yaw:1.2,pitch:-.4};
const progress=createProgress();
assert.equal(progress.complete('screen'),true);
assert.equal(progress.complete('screen'),false);
assert.equal(progress.read('topo'),true);
progress.complete('gallery');
assert.equal(progress.snapshot().completed.length,3);
assert(store.save(p,progress.snapshot()).save);
assert.deepEqual(store.load().save.player,p);
assert.deepEqual(createProgress(store.load().save.progress).snapshot(),progress.snapshot());
progress.door('apt-28-a',true);
assert(store.save(p,progress.snapshot()).save);
assert.equal(store.load().save.progress.doors['apt-28-a'],true);
assert(store.save(p,{...progress.snapshot(),doors:{invalid:true}}).error);
assert(store.save({...p,theta:-.2},progress.snapshot()).save,'top landing accepts negative bearing');
const valid=data.get(SAVE_KEY);
assert(store.save({...p,x:Infinity},progress.snapshot()).error);
assert.equal(data.get(SAVE_KEY),valid,'invalid write preserves previous save');
assert(createSaveStore(()=>storage,layout,'different').load().error);
assert.equal(data.get(SAVE_KEY),valid);
data.set(SAVE_KEY,'{bad');assert(store.load().error);assert.equal(data.get(SAVE_KEY),'{bad');
assert(createSaveStore(()=>{throw Error('denied')},layout,'test').load().error);
assert(createSaveStore(()=>({setItem(){throw Error('full')}}),layout,'test').save(p,progress.snapshot()).error);
// The journey: nobody skips ahead, relics found early count, and the chain
// runs from the sheriff to the bottom of the silo.
{
  const { talkTo, currentStep, hintFor, RELICS, STEPS: ALL } = await import('../js/quests.js');
  const run = createProgress();
  assert.equal(talkTo('delegada', run.completed()).complete, null, 'the delegate has nothing to take before the sheriff gives the pouch');
  for (const id of ['gallery', 'screen']) run.complete(id);
  run.read('topo');
  assert.equal(currentStep(run.completed()).id, 'sheriff', 'after the first steps the sheriff is next');
  run.take('livro');
  for (const who of ['xerife', 'delegada', 'chefe', 'engenheira']) {
    const said = talkTo(who, run.completed());
    assert(said.complete && said.lines.length, `${who} hands on the next part of the journey`);
    run.complete(said.complete);
  }
  assert.equal(currentStep(run.completed()).id, 'relics', 'then the relic hunt');
  assert(hintFor(currentStep(run.completed()), run.items()).startsWith('Faltam 4'), 'the hunt counts the relic found before it began');
  for (const r of RELICS) run.take(r.id);
  assert.equal(currentStep(run.completed()).id, 'vault', 'the fifth relic finishes the hunt on its own');
  run.complete(talkTo('tecnico', run.completed()).complete);
  run.read('limiar');
  assert.equal(currentStep(run.completed()), null, 'the record at the bottom ends the journey');
  assert.equal(run.completed().length, ALL.length);
  assert(store.save(p, run.snapshot()).save && createProgress(store.load().save.progress).items().length === RELICS.length, 'relics survive a save');
  assert(store.save(p, { ...run.snapshot(), items: ['bogus'] }).error, 'an unknown relic is refused');
}
console.log('PROGRESS TESTS PASSED: roundtrip, orientation, out-of-order objectives, corrupt/incompatible saves, denied storage, quota failure, the journey from the sheriff to the bottom');
