import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const vite=await createServer({cacheDir:'node_modules/.vite-strike-experience',logLevel:'error',plugins:[{name:'experience-fixture',configureServer(s){s.middlewares.use('/__experience',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__experience','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/mobileInput.fixture.tsx"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4203,strictPort:true}});
await vite.listen();const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors:string[]=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript({content:"localStorage.setItem('kapsstrike-settings',JSON.stringify({quality:'low'}));"});await page.goto('http://127.0.0.1:4203/__experience');
 await page.getByRole('button',{name:'Karakterini seç',exact:true}).click();await page.getByRole('dialog',{name:'Karakter seçimi'}).waitFor();await page.getByRole('button',{name:'Paneli kapat'}).click();
 await page.getByRole('button',{name:'Kontrolleri düzenle',exact:true}).click();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.screenshot({path:'/tmp/strike-new-menu.png'});
 await page.getByRole('button',{name:/Tek Oyunculu Antrenman/}).click();await page.getByRole('button',{name:'Antrenmanı Başlat',exact:true}).click();
 if(await page.getByRole('button',{name:/Oyuna Devam Et/}).isVisible())await page.getByRole('button',{name:/Oyuna Devam Et/}).click();
 await page.waitForFunction(()=>(window as any).strike?.active&&document.pointerLockElement!==null);await page.locator('.ks-minimap').waitFor();
 console.log("READY game");
 // Repeated death/respawn including a polluted camera state must level the camera.
 for(let i=0;i<20;i++)await page.evaluate(()=>{
  const c=(window as any).strike;c.yaw=2;c.pitch=.9;c.state.player.hp=0;c.state.player.deadUntil=c.state.tick+1;
  c.renderer.camera.rotation.z=1;c.renderer.camera.upVector.set(1,0,0);
  c.accumulator=1/120;c.last=performance.now();c.loop();if(c.state.player.hp!==100)throw Error("respawn did not simulate");c.feedback({id:++c.state.eventId,tick:c.state.tick,actor:c.state.player.id,kind:'respawn'});c.renderer.render(c.state,c.yaw,c.pitch,false,1,c.state.player.movement.position,1/60);
  if(c.yaw!==0||c.pitch!==0||c.renderer.camera.rotation.z!==0||c.renderer.camera.upVector.y!==1)throw Error('respawn camera not level');
 });
 console.log("PASS respawn20");
 // Knife has swing animation but no tracer, impact or muzzle.
 await page.evaluate(()=>{const c=(window as any).strike,r=c.renderer;for(const x of r.tracerPool)x.mesh.setEnabled(false);for(const x of r.impactPool)x.mesh.setEnabled(false);r.process([{id:999,tick:c.state.tick,actor:c.state.player.id,kind:'shot',weapon:'knife',from:{x:0,y:1,z:0},to:{x:0,y:1,z:2}}]);if(r.tracerPool.some((p:any)=>p.mesh.isEnabled())||r.impactPool.some((p:any)=>p.mesh.isEnabled()))throw Error('melee bullet effects');r.gunKick=0;});
 console.log('PASS knife');
 await page.keyboard.press('KeyF');assert.ok(await page.evaluate(()=>(window as any).strike.renderer.inspectTime>0));
 await page.keyboard.press('Digit3');await page.waitForTimeout(300);await page.mouse.down({button:'right'});await page.locator('.ks-scope').waitFor();await page.screenshot({path:'/tmp/strike-new-scope.png'});await page.mouse.up({button:'right'});
 console.log("PASS scope inspect");
 // Accessible authoritative-style world location, interaction uses actual E input and simulation.
 await page.evaluate(()=>{const c=(window as any).strike;c.state.player.hp=100;c.state.player.movement.position={...c.state.world.pickups[0].position};c.previous={...c.state.player.movement.position};});
 await page.getByRole('button',{name:/E · Aç/}).waitFor();await page.keyboard.press('KeyE');await page.waitForFunction(()=>(window as any).strike.state.player.weapon.selected==='carbine');
 await page.evaluate(async()=>{const c=(window as any).strike;const w=await import(String('/src/games/kapsstrike/world.ts'));const tick=w.DROP_INTERVAL-w.DROP_WARNING;c.state.tick=tick;w.advanceWorld(c.state.world,c.renderer.map,tick);});
 await page.locator('.ks-drop-warning').waitFor();await page.waitForFunction(()=>(window as any).strike.renderer.scene.getTransformNodeByName('supply-aircraft')?.isEnabled());
 await page.evaluate(async()=>{const c=(window as any).strike;const w=await import(String('/src/games/kapsstrike/world.ts'));c.state.tick=w.DROP_INTERVAL;w.advanceWorld(c.state.world,c.renderer.map,c.state.tick);});
 await page.waitForFunction(()=>(window as any).strike.renderer.smoke.some((p:any)=>p.isEnabled()));
 console.log("PASS supply cycle");
 await page.keyboard.press('Escape');await page.screenshot({path:'/tmp/strike-new-pause.png'});
 console.log('OPEN settings');
 await page.getByRole('button',{name:/Görüntü ve ses/}).click();await page.getByLabel('Grafik Kalitesi',{exact:true}).selectOption('high');console.log('HIGH selected');
 await page.waitForFunction(()=>(window as any).strike.renderer.qualityApplied==='high');
 assert.equal(await page.evaluate(()=>(window as any).strike.renderer.scene.materials.find((m:any)=>m.diffuseTexture)?.diffuseTexture.getSize().width),1024);
 await page.getByLabel('Grafik Kalitesi',{exact:true}).selectOption('medium');assert.equal(await page.evaluate(()=>(window as any).strike.renderer.scene.materials.find((m:any)=>m.diffuseTexture)?.diffuseTexture.getSize().width),512);
 await page.getByLabel('Grafik Kalitesi',{exact:true}).selectOption('low');assert.equal(await page.evaluate(()=>(window as any).strike.renderer.scene.materials.find((m:any)=>m.diffuseTexture)?.diffuseTexture.getSize().width),128);
 await page.evaluate(`(()=>{
  const c=window.strike,handlers={};
  const fake={id:c.state.player.id,connected:true,on:(name,fn)=>handlers[name]=fn,off(){},emit(){}};
  c.socket=fake;c.isMultiplayer=true;c.setupMultiplayerSocket(fake);c.unacknowledgedInputs=[];
  const player=structuredClone(c.state.player);player.hp=100;player.movement.position={x:0,y:0,z:-51.3};player.movement.velocity={x:0,y:0,z:0};player.movement.grounded=true;
  const input={sequence:11,tick:99,moveX:0,moveZ:1,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false};c.unacknowledgedInputs=[input];
  handlers['strike:snapshot']({tick:100,serverTime:Date.now(),ackSequence:10,localState:player,players:[{...player,position:player.movement.position,velocity:player.movement.velocity,team:'none',score:0}],events:[],timeLeft:200});
  if(c.state.lastSequence!==11||c.state.tick!==101||c.state.player.movement.position.z<=player.movement.position.z)throw Error('pending prediction did not replay after server tick correction');
  c.isMultiplayer=false;c.socket=null;
 })()`);console.log('PASS actual reconciliation replays pending input across divergent client/server ticks');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Karakter',exact:true}).click();await page.getByRole('button',{name:'Paneli kapat'}).click();await page.getByRole('button',{name:'Menüye / Lobiye Dön',exact:true}).click();
 assert.equal(await page.evaluate(()=>(window as any).engineStore.Instances.length),0);
 assert.equal(errors.length,0,errors.join(";"));console.log('PASS actual WebGL: menu modal back/ESC, 20 camera resets, knife effects, F inspect, sniper scope, E chest, plane/drop/smoke, live 1024/512/128 textures, disposal');await page.close();
 for(const profile of [{name:'tablet',width:1366,height:1024,phone:false,ua:'Mozilla/5.0 (Linux; Android 14; SM-X900) Chrome/134 Safari/537.36'},{name:'phone',width:844,height:390,phone:true,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}]){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:true,isMobile:true,userAgent:profile.ua});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4203/__experience');await p.getByRole('button',{name:/Tek Oyunculu Antrenman/}).click();await p.getByRole('button',{name:'Antrenmanı Başlat',exact:true}).click();await p.locator('.ks-touch-overlay').waitFor();
  assert.equal(await p.locator('.ks-minimap').count(),profile.phone?0:1);
  await p.getByTitle('Ayarlar & Duraklat',{exact:true}).click();await p.getByRole('button',{name:'Karakter',exact:true}).click();await p.getByRole('button',{name:'Paneli kapat'}).click();assert.ok(await p.getByRole('button',{name:/Oyuna Devam Et/}).isVisible());await p.screenshot({path:`/tmp/strike-new-${profile.name}-pause.png`});await context.close();console.log('PASS touch mode, minimap device rule and dismissible pause character screen',profile.name);
 }
 assert.equal(errors.length,0,errors.join(";"));
}finally{await browser.close();await vite.close();}
