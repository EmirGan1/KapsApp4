import {createServer} from 'vite';
import {Server} from 'socket.io';
import {io as connect, type Socket} from 'socket.io-client';
import {chromium,type Page} from 'playwright';
import assert from 'node:assert/strict';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';

const vite=await createServer({cacheDir:'node_modules/.vite-spectator-qa',logLevel:'error',plugins:[{name:'spectator-qa',configureServer(s){s.middlewares.use('/__spectator',async(_req,res)=>{
 res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__spectator','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.network.fixture.tsx"></script></body></html>'));
});}}],server:{host:'127.0.0.1',port:4208,strictPort:true}});
const io=new Server(vite.httpServer!,{pingTimeout:120000}),manager=new KapsStrikeServerManager(io);
io.on('connection',socket=>{const id=Number(socket.handshake.auth.testUser);manager.register(socket,{id,username:`Tester ${id}`,avatar:null});});
await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const clients:Socket[]=[],errors:string[]=[];
const ack=(s:Socket,event:string,data:any):Promise<any>=>new Promise((resolve,reject)=>{
 const done=(err:any,result:any)=>err?reject(err):resolve(result);
 if(data===undefined)s.timeout(5000).emit(event,done);else s.timeout(5000).emit(event,data,done);
});
const resume=async(p:Page)=>{await p.bringToFront();const button=p.getByRole('button',{name:/Oyuna dön|Oyuna Devam Et/i});if(await button.isVisible())await button.click();};
const target=(p:Page)=>p.evaluate(()=>(window as any).strike.spectator?.id);
const waitTarget=(p:Page,id:string|undefined)=>p.waitForFunction(id=>(window as any).strike.spectator?.id===id,id,{timeout:15000});
try{
 const desktop=await browser.newContext({viewport:{width:960,height:600}}),touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const a=await desktop.newPage(),b=await touch.newPage();
 for(const [index,p] of [a,b].entries()){
  p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('kapsstrike-settings',JSON.stringify({quality:'low'})));
  await p.goto(`http://127.0.0.1:4208/__spectator?user=${index+1}`);

 }
 await a.getByRole('button',{name:'+ Masa aç',exact:true}).click();await a.getByRole('button',{name:/Bomba Kurma/i}).click();await a.getByRole('button',{name:'Masayı oluştur',exact:true}).click();
 const code=(await a.locator('.ks-lobby-code').textContent())!.trim();
 await b.getByPlaceholder('Oda kodu',{exact:true}).fill(code);await b.getByRole('button',{name:'Koda Katıl',exact:true}).click();
 await b.getByRole('button',{name:'HAZIR OL',exact:true}).click();
 for(let id=3;id<=6;id++){
  const s=connect('http://127.0.0.1:4208',{auth:{testUser:id},transports:['websocket'],forceNew:true});clients.push(s);
  await new Promise<void>((resolve,reject)=>{s.once('connect',()=>resolve());s.once('connect_error',reject);});
  assert.ok((await ack(s,'strike:join_room',{roomCode:code})).success);assert.ok((await ack(s,'strike:set_ready',{ready:true})).success);
 }
 await a.getByRole('button',{name:/MAÇI BAŞLAT/i}).click();
 for(const p of [a,b])await p.waitForFunction(()=>(window as any).strike?.state.bomb,{},{timeout:90000});
 const room=manager.rooms.get(code)!;
 const byUser=(id:number)=>[...room.players.values()].find(p=>p.userId===id)!;
 room.bomb!.phase='active';room.bomb!.deadline=room.tick/120+300;
 await resume(a);await a.waitForFunction(()=>document.pointerLockElement!==null);
 byUser(1).state.hp=0;byUser(1).state.deadUntil=0;
 await waitTarget(a,byUser(3).id);await a.getByText('İzleniyor: Tester 3 (1/2)',{exact:true}).waitFor();
 await a.keyboard.press('ArrowRight');await waitTarget(a,byUser(5).id);
 await a.keyboard.press('ArrowLeft');await waitTarget(a,byUser(3).id);
 await a.mouse.click(480,300);await waitTarget(a,byUser(5).id);
 await a.mouse.click(480,300,{button:'right'});await waitTarget(a,byUser(3).id);
 await a.mouse.wheel(0,100);await waitTarget(a,byUser(5).id);
 assert.equal(await a.evaluate(()=>{const c=(window as any).strike,t=c.spectator,p=c.renderer.camera.position;return !!t&&Math.hypot(p.x-t.position.x,p.z-t.position.z)<.05&&!c.renderer.gunRoot.isEnabled();}),true);
 const deadPosition={...byUser(1).state.movement.position};await a.keyboard.press('KeyW');await a.keyboard.press('KeyR');
 assert.deepEqual(byUser(1).state.movement.position,deadPosition);assert.equal(byUser(1).state.hp,0);
 // Kill the selected teammate, then explicitly leave the other: no enemy fallback.
 byUser(5).state.hp=0;await waitTarget(a,byUser(3).id);
 assert.ok((await ack(clients[0],'strike:leave_room',undefined))===undefined);
 await waitTarget(a,undefined);await a.getByText('İzlenebilecek yaşayan takım arkadaşın yok.',{exact:true}).waitFor();
 await a.waitForFunction(()=>(window as any).strike.state.bomb.round===2,{},{timeout:30000});
 await a.waitForFunction(()=>{const c=(window as any).strike;return c.state.player.hp===100&&!c.spectator&&c.state.bomb.phase==='buy';});
 await a.waitForFunction(()=>{const c=(window as any).strike,p=c.state.player.movement.position,v=c.renderer.camera.position;return Math.hypot(v.x-p.x,v.z-p.z)<.05&&c.renderer.gunRoot.isEnabled();});
 assert.equal(await a.locator('.ks-bomb-spectator').count(),0);
 console.log('PASS desktop pointer-lock mouse/arrow/wheel switching; selected death/leave; no enemy fallback; round 2 restores own camera');

 await resume(b);room.bomb!.phase='active';room.bomb!.deadline=room.tick/120+300;
 byUser(2).state.hp=0;await waitTarget(b,byUser(4).id);
 const next=b.getByRole('button',{name:'Sonraki takım arkadaşı',exact:true}),previous=b.getByRole('button',{name:'Önceki takım arkadaşı',exact:true});
 await next.tap();await waitTarget(b,byUser(6).id);await previous.tap();await waitTarget(b,byUser(4).id);
 for(const size of [{width:390,height:844},{width:844,height:390},{width:768,height:1024}]){
  await b.setViewportSize(size);const rect=await next.boundingBox();assert.ok(rect&&rect.x>=0&&rect.y>=0&&rect.x+rect.width<=size.width&&rect.y+rect.height<=size.height);
  assert.equal(await b.locator('.ks-touch-overlay').count(),0);assert.equal(await b.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await b.screenshot({path:`/tmp/strike-spectator-${size.width}.png`});
 }
 // A disconnected live body cannot remain a camera target.
 byUser(4).isDisconnected=true;await waitTarget(b,byUser(6).id);
 assert.equal(room.getSnapshotForPlayer(byUser(2).id).players.find(p=>p.userId===4)?.connected,false);
 byUser(6).state.hp=0;await waitTarget(b,undefined);
 // Test-only remove the disconnected body's remaining health to conclude this round.
 byUser(4).state.hp=0;await b.waitForFunction(()=>(window as any).strike.state.bomb.round===3,{},{timeout:30000});
 await b.waitForFunction(()=>{const c=(window as any).strike;return c.state.player.hp===100&&!c.spectator;});
 await b.waitForFunction(()=>{const c=(window as any).strike,p=c.state.player.movement.position,v=c.renderer.camera.position;return Math.hypot(v.x-p.x,v.z-p.z)<.05&&c.renderer.gunRoot.isEnabled();});
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS mobile/tablet touch controls, portrait/landscape layout, disconnect fallback, own-team-only CT view and round 3 respawn; zero page errors');
 for(const p of [a,b])await p.evaluate(()=>new Promise<void>(resolve=>(window as any).socket.emit('strike:leave_room',()=>resolve())));
}finally{
 for(const s of clients){if(s.connected)await ack(s,'strike:leave_room',undefined).catch(()=>{});s.close();}
 for(const room of manager.rooms.values())manager.stopRoomSimulationLoop(room);
 await browser.close();await new Promise<void>(resolve=>io.close(()=>resolve()));await vite.close();
}
