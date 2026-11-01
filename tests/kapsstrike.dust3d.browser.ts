import {createServer} from 'vite';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
const vite=await createServer({cacheDir:'node_modules/.vite-bomb-qa',logLevel:'error',plugins:[{name:'bomb-qa',configureServer(s){s.middlewares.use('/__bomb',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__bomb','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.network.fixture.tsx"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4198,strictPort:true}});
const io=new Server(vite.httpServer!),manager=new KapsStrikeServerManager(io);
io.on('connection',socket=>{const id=Number(socket.handshake.auth.testUser);manager.register(socket,{id,username:`Tester ${id}`,avatar:null});socket.on('disconnect',()=>manager.handleDisconnect(socket,id));});
await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors:string[]=[];
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:900}}),touch=await browser.newContext({viewport:{width:768,height:1024},isMobile:true,hasTouch:true});
 const a=await desktop.newPage(),b=await touch.newPage();
 browser.on('disconnected',()=>console.log('browser closed'));
 for(const [i,p] of [a,b].entries()){
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')console.log('WEBGL',m.text());});
  await p.addInitScript(()=>localStorage.setItem('kapsstrike-settings',JSON.stringify({quality:'low'})));
  await p.goto(`http://127.0.0.1:4198/__bomb?user=${i+1}`);
  await p.getByRole('button',{name:/BOMBA KURMA/}).click();
 }
 console.log('mode selected');
 await a.getByRole('button',{name:'+ Oda Oluştur',exact:true}).click();
 await a.getByRole('button',{name:'Odayı Oluştur',exact:true}).click();
 await a.locator('.ks-lobby-code').waitFor();
 const code=(await a.locator('.ks-lobby-code').textContent())!.trim();
 await b.getByPlaceholder('Oda kodu',{exact:true}).fill(code);await b.getByRole('button',{name:'Koda Katıl',exact:true}).click();
 await b.getByRole('button',{name:'HAZIR OL',exact:true}).click();
 await a.getByRole('button',{name:/MAÇI BAŞLAT/i}).click();
 const room=manager.rooms.get(code)!;
 for(const p of [a,b])await p.waitForFunction(()=>(window as any).strike?.state.bomb,{},{timeout:60000});
 // Extend only the initial purchase window to allow software WebGL startup in CI.
 room.bomb!.deadline=room.tick/120+45;
 await a.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i}).click();
 await a.getByText('B · Satın alma menüsü',{exact:true}).waitFor();await a.waitForFunction(()=>document.pointerLockElement!==null);
 console.log('playing',await a.locator('.ks-bomb-objective').textContent());
 await a.keyboard.press('KeyB');await a.getByRole('dialog',{name:'Satın alma',exact:true}).waitFor();
 assert.equal(await a.evaluate(()=>document.pointerLockElement===null),true);
 assert.equal(await a.locator('.ks-buy-columns section').count(),4);
 assert.equal(await a.locator('.ks-bomb-player').count(),2);
 await a.getByRole('button',{name:/Balistik zırh/}).click();await a.getByRole('status').filter({hasText:'Balistik zırh alındı'}).waitFor();
 assert.equal(room.bomb!.players[(await a.evaluate(()=>(window as any).socket.id))].money,150);
 await a.screenshot({path:'/tmp/strike-bomb-buy-desktop.png'});
 await a.keyboard.press('Escape');await a.getByRole('dialog',{name:'Satın alma',exact:true}).waitFor({state:'hidden'});
 await a.waitForFunction(()=>document.pointerLockElement!==null);
 await b.getByRole('button',{name:/Satın al/}).click();await b.getByRole('dialog',{name:'Satın alma',exact:true}).waitFor();
 await b.getByRole('button',{name:/Çözme kiti/}).click();await b.getByRole('status').filter({hasText:'Çözme kiti alındı'}).waitFor();
 await b.screenshot({path:'/tmp/strike-bomb-buy-tablet.png'});
 await b.setViewportSize({width:390,height:844});
 assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await b.screenshot({path:'/tmp/strike-bomb-buy-phone.png'});
 await b.getByRole('button',{name:'Satın alma menüsünü kapat'}).click();
 await b.screenshot({path:'/tmp/strike-district-spawn.png'});
 // Independent browser sends ordinary movement inputs; only initial poses are fixture-controlled.
 room.bomb!.phase='active';room.bomb!.deadline=room.tick/120+10000;
 const {MAPS}=await import('../src/games/kapsstrike/maps');
 const {newMovement}=await import('../src/games/kapsstrike/physics');
 const actor=[...room.players.values()].find(p=>p.userId===1)!;
 await a.bringToFront();const resumeWalk=a.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i});if(await resumeWalk.isVisible())await resumeWalk.click();
 const routeChecks=[...MAPS.district.routes!,
 {name:'A Short / Catwalk',points:[{x:13,y:0,z:14.3},{x:13,y:3.2,z:24},{x:13,y:3.2,z:27},{x:21,y:3.2,z:27},{x:21,y:3.2,z:36},{x:34,y:3.2,z:36}]},
 {name:'B Tunnels → B Site',points:[{x:-38,y:2.4,z:10},{x:-45,y:2.4,z:10},{x:-45,y:2.4,z:33},{x:-34,y:2.4,z:33},{x:-34,y:2.4,z:42}]},
 {name:'Upper → Lower Tunnels',points:[{x:-38,y:2.4,z:5},{x:-38,y:2.4,z:10},{x:-27.4,y:2.4,z:10},{x:-19.5,y:0,z:10},{x:-16,y:0,z:10},{x:-5.5,y:0,z:10}]},
 ];
 for(const route of (process.env.STRIKE_SCREENSHOTS_ONLY?[]:routeChecks)){
   await a.evaluate(()=>(window as any).strike.setTouchMovement(0,0));
   actor.state.movement=newMovement(route.points[0]);actor.inputQueue=[];actor.heldInput=undefined;actor.history=[];
   await a.waitForFunction(p=>{const v=(window as any).strike.state.player.movement.position;return Math.hypot(v.x-p.x,v.z-p.z)<.4;},route.points[0]);
   const points=route.points.filter((p,i,all)=>i===0||i===all.length-1||Math.abs((p.x-all[i-1].x)*(all[i+1].z-p.z)-(p.z-all[i-1].z)*(all[i+1].x-p.x))>.001);
   await a.evaluate(points=>{const w=window as any,c=w.strike;let index=1,last=performance.now(),best=Infinity;
     w.walkResult={done:false,error:''};w.walkTimer=setInterval(()=>{
       if(index>=points.length){c.setTouchMovement(0,0);clearInterval(w.walkTimer);w.walkResult.done=true;return;}
       const p=c.state.player.movement.position,t=points[index],d=Math.hypot(t.x-p.x,t.z-p.z);
       if(d<.3){index++;best=Infinity;last=performance.now();return;}
       if(d<best-.04){best=d;last=performance.now();}
       if(performance.now()-last>12000){c.setTouchMovement(0,0);clearInterval(w.walkTimer);w.walkResult.error=JSON.stringify({index,p,t,d,active:c.active,connected:c.socket?.connected});return;}
       const prev=points[index-1];let ax=t.x,az=t.z;
       if(Math.abs(t.x-prev.x)<.001)az=Math.max(Math.min(prev.z,t.z),Math.min(Math.max(prev.z,t.z),p.z+Math.sign(t.z-prev.z)*.6));
       else if(Math.abs(t.z-prev.z)<.001)ax=Math.max(Math.min(prev.x,t.x),Math.min(Math.max(prev.x,t.x),p.x+Math.sign(t.x-prev.x)*.6));
       c.yaw=Math.atan2(ax-p.x,az-p.z);c.pitch=0;c.setTouchMovement(0,d<.8?.18:.5);
     },20);
   },points);
   console.log('START LIVE BROWSER WALK',route.name,points.length);
 await a.waitForFunction(()=>(window as any).walkResult.done||(window as any).walkResult.error,{},{timeout:180000});
   const result=await a.evaluate(()=>(window as any).walkResult);assert.equal(result.error,'',route.name+result.error);
   const end=route.points.at(-1)!;assert.ok(Math.hypot(actor.state.movement.position.x-end.x,actor.state.movement.position.z-end.z)<1,route.name);
   console.log('PASS LIVE BROWSER WALK',route.name,actor.state.movement.position);
 }
 room.bomb!.phase='buy';
 // Test-only placement at a clear A lane; input/plant/defuse use live production transport.
 room.bomb!.deadline=room.tick/120;
 const ps=[...room.players.values()];
 for(const [index,p] of ps.entries()){p.state.movement.position={x:index===0?34.42208:35.92208,y:3.2,z:37.9984};p.state.movement.velocity={x:0,y:0,z:0};p.history=[];p.inputQueue=[];p.heldInput=undefined;}
 await a.waitForFunction(()=>(window as any).strike.state.bomb.phase==='active');
 await a.bringToFront();
 const resume=a.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i});if(await resume.isVisible())await resume.click();
 await a.locator('.ks-bomb-objective').waitFor();
 console.log('plant-ready',await a.evaluate(()=>({active:(window as any).strike.active,locked:!!document.pointerLockElement,hud:!!document.querySelector('.ks-bomb-objective')})));
 await a.keyboard.press('Digit7');await a.waitForFunction(()=>(window as any).strike.renderer.scene.getMeshByName('held-bomb')?.isEnabled());
 await a.keyboard.press('KeyG');await a.waitForFunction(()=>(window as any).strike.state.bomb.carrier===undefined);
 await a.keyboard.down('KeyE');await a.waitForFunction(()=>(window as any).strike.state.bomb.phase==='planted',{},{timeout:30000});await a.keyboard.up('KeyE');
 await b.waitForFunction(()=>(window as any).strike.state.bomb.phase==='planted');
 assert.equal(room.bomb!.players[ps[0].id].plants,1);
 assert.equal(await b.locator('.ks-minimap text').filter({hasText:/^[AB]$/}).count(),2);
 assert.ok(await b.evaluate(()=>(window as any).strike.renderer.scene.getMeshByName('tactical-bomb').isEnabled()));
 await b.screenshot({path:'/tmp/strike-bomb-planted.png'});
 for(const size of [{width:390,height:844},{width:844,height:390},{width:768,height:1024}]){
  await b.setViewportSize(size);
  assert.equal(await b.evaluate(()=>{const a=document.querySelector('.ks-bomb-objective')!.getBoundingClientRect(),m=document.querySelector('.ks-minimap')!.getBoundingClientRect();return a.right<=m.left||m.right<=a.left||a.bottom<=m.top||m.bottom<=a.top;}),true,'objective and radar must not overlap');
  await b.screenshot({path:`/tmp/strike-bomb-layout-${size.width}.png`});
 }
 await b.setViewportSize({width:390,height:844});
 const defuse=b.getByRole('button',{name:/Basılı tut: Çöz/}),rect=await defuse.boundingBox();assert.ok(rect);
 await b.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await b.mouse.down();
 await b.waitForFunction(()=>(window as any).strike.state.bomb.phase==='result',{},{timeout:30000});await b.mouse.up();
 assert.equal(room.bomb!.winner,'CT');assert.equal(room.bomb!.players[ps[1].id].defuses,1);
 await a.waitForFunction(()=>(window as any).strike.state.bomb.round===2,{},{timeout:30000});
 assert.equal(room.teamScores.blue,1);assert.equal(room.bomb!.players[ps[1].id].money,3950);
 assert.equal(errors.length,0,errors.join('\n'));
 // A second, independent server-authoritative plant/defuse at B.
 await a.bringToFront();const resumeB=a.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i});if(await resumeB.isVisible())await resumeB.click();
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb'),siteB=BOMB_SITES[1];
 room.bomb!.phase='active';room.bomb!.deadline=room.tick/120+105;
 for(const [index,p] of [...room.players.values()].entries()){p.state.movement=newMovement({x:siteB.x+index*1.5,y:siteB.y,z:siteB.z});p.inputQueue=[];p.heldInput=undefined;p.history=[];}
 await a.waitForFunction(()=>(window as any).strike.state.bomb.phase==='active');
 await a.keyboard.down('KeyE');await a.waitForFunction(()=>(window as any).strike.state.bomb.site==='B'&&(window as any).strike.state.bomb.phase==='planted',{},{timeout:30000});await a.keyboard.up('KeyE');
 const bButton=b.getByRole('button',{name:/Basılı tut: Çöz/}),bRect=await bButton.boundingBox();assert.ok(bRect);await b.mouse.move(bRect.x+bRect.width/2,bRect.y+bRect.height/2);await b.mouse.down();
 await b.waitForFunction(()=>(window as any).strike.state.bomb.phase==='result',{},{timeout:30000});await b.mouse.up();assert.equal(room.bomb!.winner,'CT');
 console.log('PASS B SITE PLANT/DEFUSE');
 // Clear Lower Tunnels firing lane: initial poses are fixture controlled, actual
 // browser fire inputs, authoritative raycasts, damage and kill scoring are real.
 room.bomb!.phase='active';room.bomb!.deadline=room.tick/120+10000;
 const combatants=[...room.players.values()];
 for(const [i,p] of combatants.entries()){
   p.state.movement=newMovement({x:i===0?-18:-12,y:0,z:10});p.state.hp=100;p.state.protectedUntil=0;p.inputQueue=[];p.heldInput=undefined;p.history=[];
   room.bomb!.players[p.id].alive=true;room.bomb!.players[p.id].position={...p.state.movement.position};
 }
 const attacker=combatants.find(p=>p.userId===1)!,victim=combatants.find(p=>p.userId===2)!;
 const killsBefore=attacker.kills;
 await a.bringToFront();const combatResume=a.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i});if(await combatResume.isVisible())await combatResume.click();
 await a.waitForFunction(()=>(window as any).strike.active&&document.pointerLockElement!==null);
 await a.waitForFunction(()=>(window as any).strike.state.bomb.phase==='active');
 assert.equal(await a.evaluate(()=>(window as any).strike.bombEquipped),false,'planting must release the bomb selection and allow firing');
 await a.waitForTimeout(300);
 await a.evaluate(()=>{const c=(window as any).strike;c.yaw=Math.PI/2;c.pitch=.12;(window as any).aimTimer=setInterval(()=>{c.yaw=Math.PI/2;c.pitch=.12;},16);});
 for(let i=0;i<6&&victim.state.hp>0;i++){
   const before=await a.evaluate(()=>(window as any).strike.state.player.weapon.ammo.pistol);
   await a.mouse.down();await a.waitForFunction(n=>(window as any).strike.state.player.weapon.ammo.pistol<n,before,{timeout:10000});await a.mouse.up();await a.waitForTimeout(400);console.log('shot',i,combatants.map(p=>({hp:p.state.hp,ammo:p.state.weapon.ammo.pistol,position:p.state.movement.position,stance:p.state.movement.stance,yaw:p.state.yaw,pitch:p.state.pitch,team:p.team,protected:p.state.protectedUntil,history:p.history.at(-1)})),room.tick,room.events.filter(e=>e.kind==='shot').slice(-1));
 }
 await b.waitForFunction(()=>(window as any).strike.state.player.hp<=0,{},{timeout:30000});
 await a.evaluate(()=>clearInterval((window as any).aimTimer));
 assert.equal(attacker.kills,killsBefore+1);assert.equal(room.bomb!.winner,'T');
 console.log('PASS two-browser Lower Tunnels authoritative fire/damage/death/score');
 manager.stopRoomSimulationLoop(room);
 await a.evaluate(()=>{const c=(window as any).strike;c.updateSettings({...c.settings,quality:'high',dynamicResolution:false,scale:1});});
 await a.waitForFunction(()=>(window as any).strike.renderer.scene.isReady());
 const textureInfo=await a.evaluate(()=>(window as any).strike.renderer.scene.textures.filter((t:any)=>t.url?.includes('/kapsstrike/materials/')).map((t:any)=>({url:t.url,ready:t.isReady(),size:t.getSize().width})));
 assert.ok(textureInfo.length>=6);assert.ok(textureInfo.every((t:any)=>t.ready&&t.size===2048));
 console.log('PASS bundled High PBR maps loaded at 2048px',textureInfo.length);
 await a.screenshot({path:'/tmp/strike-district-high.png'});
 const views=[
  ['a-site',{x:43,y:3.2,z:36},-.8,.05],['catwalk',{x:13,y:3.2,z:25},1.4,.05],
  ['upper-tunnels',{x:-38,y:2.4,z:5},-.6,.1],['lower-tunnels',{x:-16,y:0,z:10},1.57,0],
  ['mid-doors',{x:-5.36,y:0,z:15.42},0,0],['b-site',{x:-33,y:2.4,z:42},-2.4,.05],
  ['a-ramp',{x:47,y:1.143,z:26},-.9,.05],['materials',{x:34,y:3.2,z:37},-.7,.4],
 ] as const;
 room.bomb!.phase='active';room.bomb!.deadline=room.tick/120+105;delete room.bomb!.winner;delete room.bomb!.reason;
 for(const [name,position,yaw,pitch] of views){
   room.tick+=4;actor.state.movement=newMovement(position);actor.inputQueue=[];actor.heldInput=undefined;actor.history=[];for(const p of room.players.values())io.to(p.id).emit('strike:snapshot',room.getSnapshotForPlayer(p.id));
   await a.evaluate(({yaw,pitch})=>{const c=(window as any).strike;c.setTouchMovement(0,0);c.yaw=yaw;c.pitch=pitch;}, {yaw,pitch});
   await a.waitForFunction(p=>{const q=(window as any).strike.state.player.movement.position;return Math.hypot(q.x-p.x,q.z-p.z)<.4;},position);
   await a.screenshot({path:`/tmp/dust3d-${name}.png`});
 }
 await a.evaluate(()=>{const c=(window as any).strike;c.renderer.engine.stopRenderLoop();c.renderer.scene.fogMode=0;c.renderer.scene.getTransformNodeByName('viewmodel')?.setEnabled(false);c.renderer.camera.position.set(0,115,0);c.renderer.camera.rotation.set(Math.PI/2,0,0);c.renderer.scene.render();});
 await a.evaluate(async()=>{const s=(window as any).strike.renderer.scene;await s.whenReadyAsync();s.render();});
 await a.screenshot({path:'/tmp/dust3d-overview.png'});

 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS two independent Chromium contexts: create/join/ready/start; desktop pointer-lock buy/ESC; tablet buy; phone overflow; authoritative plant/kit-defuse/score/next round; no page errors. Test placements/timer override documented.');
 await a.close();await b.close();await new Promise(r=>setTimeout(r,100));assert.equal(manager.rooms.size,0);
}catch(error){console.log('failure-state',JSON.stringify([...manager.rooms.values()].map(r=>r.bomb)));throw error;}finally{for(const r of manager.rooms.values())manager.stopRoomSimulationLoop(r);await browser.close();await new Promise<void>(r=>io.close(()=>r()));await vite.close();}
