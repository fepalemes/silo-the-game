const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('shots',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:720}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
  const base=process.env.BASE || 'http://localhost:8080';
  for(const view of ['room','ring','bridge','stairs']) {
   await page.goto(`${base}/?view=${view}&hud=0&bloom=0`);
   await page.evaluate(async()=>{await import('/js/main.js')});
   await page.waitForFunction(async()=>{const {scene}=await import('/js/main.js');return scene.getObjectByName('cafeteria-screen').material.map.image?.src?.includes('exterior-camera-v1.png')},null,{timeout:60000});
   await page.waitForTimeout(800);
   const result=await page.evaluate(async()=>{
    const {scene,renderer,layout}=await import('/js/main.js');let point=0,shadow=0,ready=false;
    scene.traverse(o=>{if(o.isPointLight)point++;if(o.isSpotLight&&o.castShadow){shadow++;ready=Boolean(o.shadow.map)}});
    // Traverse the actual built scene's collision data along the clear aisle.
    const {resolveMove}=await import('/js/collision.js');const {WING_OFFSETS,WORLD}=await import('/js/config.js');
    const a=WING_OFFSETS[0],st=layout.stations[0];
    const world=(x,z)=>({x:x*Math.cos(a)-z*Math.sin(a),z:x*Math.sin(a)+z*Math.cos(a)});
    let state={x:3,z:0,y:0,theta:0,level:null};
    const moveTo=(x,z)=>{const p=world(x,z);for(let i=0;i<1200&&Math.hypot(p.x-state.x,p.z-state.z)>.08;i++){const dx=p.x-state.x,dz=p.z-state.z,n=Math.hypot(dx,dz);state=resolveMove(layout,state,dx/n*.06,dz/n*.06)}};
    moveTo(18*Math.cos(a),-18*Math.sin(a));
    for(let turn=0;turn<=a+.03;turn+=.03)moveTo(18*Math.cos(Math.min(turn,a)-a),18*Math.sin(Math.min(turn,a)-a));
    moveTo(23,0);
    moveTo(34.1,0);moveTo(34.1,-1.3);moveTo(37.5,-1.3);moveTo(37.5,0);moveTo(43.2,0);
    const localX=state.x*Math.cos(a)+state.z*Math.sin(a);
    return{point,shadow,ready,enabled:renderer.shadowMap.enabled,localX,y:state.y};
   });
   assert.equal(result.point,10);assert.equal(result.shadow,2);assert.equal(result.enabled,true);assert.equal(result.ready,true);
   assert(result.localX>43,'cafeteria remains accessible past the console and tables');assert(Math.abs(result.y)<1e-6);
   await page.screenshot({path:`shots/exemplar-${view}.png`});console.log('verified',view,result);
  }
  // A missing asset retains the procedural image and does not block play.
  await page.route('**/assets/exterior-camera-v1.png',route=>route.fulfill({status:404,body:''}));
  await page.goto(`${base}/?view=room&hud=0&bloom=0&shadows=0`);
  await page.evaluate(async()=>{await import('/js/main.js')});
  const fallback=await page.evaluate(async()=>{const {scene,renderer}=await import('/js/main.js');return{canvas:scene.getObjectByName('cafeteria-screen').material.map.image.tagName,shadows:renderer.shadowMap.enabled}});
  assert.equal(fallback.canvas,'CANVAS');assert.equal(fallback.shadows,false);
  assert.deepEqual(errors,[]);console.log('EXEMPLAR CHECKS PASSED: four views, image, shadows, ten-light pool, accessible aisle, asset fallback');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
