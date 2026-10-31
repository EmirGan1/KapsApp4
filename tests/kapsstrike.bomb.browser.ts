import {createServer} from 'vite';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
const vite=await createServer({cacheDir:'node_modules/.vite-bomb-qa',logLevel:'error',plugins:[{name:'bomb-qa',configureServer(s){s.middlewares.use('/__bomb',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__bomb','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.network.fixture.tsx"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4197,strictPort:true}});
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
  await p.goto(`http://127.0.0.1:4197/__bomb?user=${i+1}`);
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
 // Test-only placement at a clear A lane; input/plant/defuse use live production transport.
 room.bomb!.deadline=room.tick/120;
 const ps=[...room.players.values()];
 for(const [index,p] of ps.entries()){p.state.movement.position={x:index===0?-40:-38.5,y:0,z:26};p.state.movement.velocity={x:0,y:0,z:0};p.history=[];p.inputQueue=[];p.heldInput=undefined;}
 await a.waitForFunction(()=>(window as any).strike.state.bomb.phase==='active');
 await a.bringToFront();
 const resume=a.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i});if(await resume.isVisible())await resume.click();
 await a.locator('.ks-bomb-objective').waitFor();
 console.log('plant-ready',await a.evaluate(()=>({active:(window as any).strike.active,locked:!!document.pointerLockElement,hud:!!document.querySelector('.ks-bomb-objective')})));
 await a.keyboard.press('Digit7');await a.waitForFunction(()=>(window as any).strike.renderer.scene.getMeshByName('held-bomb')?.isEnabled());
 await a.keyboard.press('KeyG');await a.waitForFunction(()=>(window as any).strike.state.bomb.carrier===undefined);
 await a.keyboard.down('KeyE');await a.waitForFunction(()=>(window as any).strike.state.bomb.phase==='planted',{},{timeout:10000});await a.keyboard.up('KeyE');
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
 await b.waitForFunction(()=>(window as any).strike.state.bomb.phase==='result',{},{timeout:10000});await b.mouse.up();
 assert.equal(room.bomb!.winner,'CT');assert.equal(room.bomb!.players[ps[1].id].defuses,1);
 await a.waitForFunction(()=>(window as any).strike.state.bomb.round===2,{},{timeout:10000});
 assert.equal(room.teamScores.blue,1);assert.equal(room.bomb!.players[ps[1].id].money,3950);
 assert.equal(errors.length,0,errors.join('\n'));
 await a.evaluate(()=>{const c=(window as any).strike;c.updateSettings({...c.settings,quality:'high'});});
 await a.waitForFunction(()=>(window as any).strike.renderer.scene.isReady());
 await a.screenshot({path:'/tmp/strike-district-high.png'});
 console.log('PASS two independent Chromium contexts: create/join/ready/start; desktop pointer-lock buy/ESC; tablet buy; phone overflow; authoritative plant/kit-defuse/score/next round; no page errors. Test placements/timer override documented.');
 await a.close();await b.close();await new Promise(r=>setTimeout(r,100));assert.equal(manager.rooms.size,0);
}catch(error){console.log('failure-state',JSON.stringify([...manager.rooms.values()].map(r=>r.bomb)));throw error;}finally{for(const r of manager.rooms.values())manager.stopRoomSimulationLoop(r);await browser.close();await new Promise<void>(r=>io.close(()=>r()));await vite.close();}
