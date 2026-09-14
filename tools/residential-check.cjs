const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8080/?bloom=0');
  await page.waitForFunction(()=>!document.querySelector('#start-button').disabled,null,{timeout:90000});
  await page.click('#start-button');await page.waitForFunction(()=>document.pointerLockElement!==null);
  await page.evaluate(async()=>{
   const {player,camera,layout}=await import('/js/main.js'),{WING_OFFSETS}=await import('/js/config.js');
   const st=layout.stations.find(s=>s.id==='residencial'),a=st.wingRotation+WING_OFFSETS[0];
   Object.assign(player.getState(),{x:36.2*Math.cos(a),z:36.2*Math.sin(a),y:st.y,theta:st.theta,level:st.index});
   const yaw=Math.atan2(Math.sin(a),-Math.cos(a));
   document.dispatchEvent(new MouseEvent('mousemove',{movementX:(camera.rotation.y-yaw)/.0022,movementY:camera.rotation.x/.0022}));
  });
  await page.waitForFunction(()=>document.querySelector('#interact-prompt').textContent.includes('abrir apartamento')&&!document.querySelector('#interact-prompt').hidden);
  await page.keyboard.press('e');
  await page.waitForFunction(async()=>((await import('/js/main.js')).progress.snapshot().doors['apt-28-a']===true));
  console.log('door interaction verified');
  const routes=await page.evaluate(async()=>{
   const {layout,world}=await import('/js/main.js'),{resolveMove}=await import('/js/collision.js'),{WING_OFFSETS}=await import('/js/config.js'),{RESIDENTIAL}=await import('/js/residential-layout.js');
   const st=layout.stations.find(s=>s.id==='residencial'),a=st.wingRotation+WING_OFFSETS[0];
   const at=(x,z)=>({x:x*Math.cos(a)-z*Math.sin(a),z:x*Math.sin(a)+z*Math.cos(a),y:st.y,theta:st.theta,level:st.index});
   const results=[];
   for(const room of RESIDENTIAL.rooms){
    const door=world.interactables.find(e=>e.id===room.id),x=34+room.index*6+2.2,s=room.side;
    let state=at(x,0), failures=[];
    const move=(tx,tz)=>{const target=at(tx,tz);for(let i=0;i<1600&&Math.hypot(state.x-target.x,state.z-target.z)>.07;i++){
     const dx=target.x-state.x,dz=target.z-state.z,n=Math.hypot(dx,dz);state=resolveMove(layout,state,dx/n*.06,dz/n*.06);
    }const reached=Math.hypot(state.x-target.x,state.z-target.z)<.08;if(!reached)failures.push({target:[tx,tz],at:[state.x*Math.cos(a)+state.z*Math.sin(a),-state.x*Math.sin(a)+state.z*Math.cos(a)]});return reached;};
    door.setOpen(false);const closed=move(x,s*3.4);
    state=at(x,0);door.setOpen(true);const entered=move(x,s*3.5);
    let rooms=true;
    if(room.kind==='home'){
      rooms=move(x,s*4.1)&&move(x-.5,s*4.1)&&move(x-.5,s*8)&&move(x-.5,s*6.5)&&move(x+2.6,s*6.5)&&move(x+2.6,s*8.6)&&move(x+2.6,s*6.5)&&move(x-.5,s*6.5)&&move(x-.5,s*4.1)&&move(x,s*4.1)&&move(x,s*3.5);
    }else rooms=move(x,s*7.8)&&move(x,s*3.5);
    const returned=move(x,0);
    const blocked=door.action(at(x,s*2.2))===false;
    results.push({id:room.id,closed,entered,rooms,returned,blocked,failures});
   }
   return results;
  });
  for(const r of routes){assert.equal(r.closed,false,r.id+' closed door blocks');assert(r.entered&&r.rooms&&r.returned&&r.blocked,JSON.stringify(r));}
  console.log('routes verified',routes);

  // The alley is no longer a straight corridor: projecting blocks alternate
  // sides and the middle pair crosses the centreline, so the route has to
  // change direction twice. Walk it end to end, then back, to prove the becos
  // are passable and that the new plaza is reachable.
  const alley=await page.evaluate(async()=>{
   const {layout}=await import('/js/main.js'),{resolveMove}=await import('/js/collision.js'),{WING_OFFSETS}=await import('/js/config.js');
   const {RESIDENTIAL}=await import('/js/residential-layout.js');
   const st=layout.stations.find(s=>s.id==='residencial'),a=st.wingRotation+WING_OFFSETS[0];
   const at=(x,z)=>({x:x*Math.cos(a)-z*Math.sin(a),z:x*Math.sin(a)+z*Math.cos(a),y:st.y,theta:st.theta,level:st.index});
   const local=s=>[s.x*Math.cos(a)+s.z*Math.sin(a),-s.x*Math.sin(a)+s.z*Math.cos(a)];
   // Waypoints a walker would take. The court's service kiosk sits on the
   // centreline, so the route passes it on one side; then the alley's two deep
   // blocks force the path to the near side and back across. The z values are
   // the middles of the channels each pinch leaves.
   // Each pinch gets a lining-up point before it: a walker moves into the
   // channel and then along it, rather than cutting the corner diagonally and
   // clipping the block on the way in.
   const path=[[24,0],[27.5,1.5],[31.5,1.5],[33.2,0],[34.7,0.47],
               [37.0,-1.06],[39.4,-1.06],[41.5,0],
               [42.9,0.82],[45.2,0.82],[47,0],
               [49.0,-0.44],[51.2,-0.44],[54,0],[56,0]];
   let state=at(...path[0]),stuck=null;
   const legs=[];
   for(let i=1;i<path.length;i++){
    const target=at(...path[i]);
    let moved=0;
    for(let k=0;k<3000&&Math.hypot(state.x-target.x,state.z-target.z)>.12;k++){
     const dx=target.x-state.x,dz=target.z-state.z,n=Math.hypot(dx,dz);
     const before=[state.x,state.z];
     state=resolveMove(layout,state,dx/n*.06,dz/n*.06);
     moved+=Math.hypot(state.x-before[0],state.z-before[1]);
    }
    const reached=Math.hypot(state.x-target.x,state.z-target.z)<.15;
    legs.push({to:path[i],reached,at:local(state).map(v=>+v.toFixed(2))});
    if(!reached&&!stuck)stuck={leg:i,target:path[i],at:local(state)};
   }
   const outbound=local(state);
   // ...and back, which exercises the dog-leg from the other direction.
   for(let i=path.length-2;i>=0;i--){
    const target=at(...path[i]);
    for(let k=0;k<3000&&Math.hypot(state.x-target.x,state.z-target.z)>.12;k++){
     const dx=target.x-state.x,dz=target.z-state.z,n=Math.hypot(dx,dz);
     state=resolveMove(layout,state,dx/n*.06,dz/n*.06);
    }
   }
   const jogsCrossed=RESIDENTIAL.jogs.filter(j=>j.depth>RESIDENTIAL.half).length;
   return {legs,stuck,outbound:outbound.map(v=>+v.toFixed(2)),back:local(state).map(v=>+v.toFixed(2)),jogsCrossed};
  });
  assert.equal(alley.stuck,null,'alley traversal blocked: '+JSON.stringify(alley.stuck));
  assert(alley.outbound[0]>55,'alley does not reach the plaza: '+JSON.stringify(alley.outbound));
  assert(alley.back[0]<25,'cannot walk back out of the alley: '+JSON.stringify(alley.back));
  assert(alley.jogsCrossed>=2,'the alley never changes direction: '+alley.jogsCrossed+' blocks cross the centreline');
  console.log('alley traversal verified',{reachedPlaza:alley.outbound,returned:alley.back,crossingBlocks:alley.jogsCrossed});
  await page.keyboard.press('p');
  await page.reload();await page.waitForFunction(()=>!document.querySelector('#start-button').disabled,null,{timeout:90000});
  assert(await page.evaluate(async()=>{const {world}=await import('/js/main.js');return world.interactables.find(e=>e.id==='apt-28-a').getOpen()}));
  assert.deepEqual(errors,[]);console.log('RESIDENTIAL CHECKS PASSED: E opens door, six closed/open routes, bedrooms/bathrooms, return paths, obstruction guard, restored door state, alley dog-leg out and back, plaza reached');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
