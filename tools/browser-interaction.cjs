const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
require('node:fs').mkdirSync('shots', { recursive: true });
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:960,height:640}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.BASE || 'http://localhost:8080/');
 await page.waitForFunction(()=>!document.getElementById('start-button').disabled,null,{timeout:90000});
 await page.screenshot({path:'shots/menu.png'});
 await page.click('#start-button');
 await page.waitForFunction(()=>document.pointerLockElement!==null);
 await page.evaluate(async()=>{
  const {player,camera}=await import('/js/main.js'); const {WING_OFFSETS}=await import('/js/config.js'); const a=WING_OFFSETS[0];
  const x=24.7,z=-0.8;
  Object.assign(player.getState(),{x:x*Math.cos(a)-z*Math.sin(a),z:x*Math.sin(a)+z*Math.cos(a),y:0,theta:0,level:0});
  document.dispatchEvent(new MouseEvent('mousemove',{movementX:(camera.rotation.y+a)/0.0022,movementY:camera.rotation.x/0.0022}));
 });
 await page.waitForFunction(()=>!document.getElementById('interact-prompt').hidden,null,{timeout:30000});
 await page.keyboard.press('e');
 await page.waitForFunction(()=>!document.getElementById('lore-panel').hidden);
 const state=()=>page.evaluate(async()=>({...((await import('/js/main.js')).player.getState())}));
 const before=await state(); await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');assert.deepEqual(await state(),before);
 await page.screenshot({path:'shots/registro.png'});
 await page.keyboard.press('e');await page.waitForFunction(()=>document.getElementById('lore-panel').hidden);
 await page.evaluate(()=>document.exitPointerLock());await page.waitForFunction(()=>!document.getElementById('pause-screen').hidden);
 await page.setViewportSize({width:1100,height:700});await page.waitForTimeout(1000);
 assert.deepEqual(errors,[]);
 console.log('INTERACTION + BLOOM PASSED: visible plaque, E open/close, reading blocks movement, pause, resize, no runtime errors');
} finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
