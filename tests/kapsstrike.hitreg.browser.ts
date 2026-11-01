import {createServer} from 'vite';import {Server} from 'socket.io';import {chromium} from 'playwright';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';import {MAPS} from '../src/games/kapsstrike/maps';import {newMovement} from '../src/games/kapsstrike/physics';import {WEAPONS} from '../src/games/kapsstrike/config';
const output=process.env.STRIKE_QA_OUTPUT||'/tmp/strike-gunplay';await mkdir(output,{recursive:true});
const vite=await createServer({cacheDir:'node_modules/.vite-hitreg',logLevel:'error',plugins:[{name:'hitreg-range',configureServer(s){s.middlewares.use('/__hitreg',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__hitreg','<html><body><script type="module" src="/tests/kapsstrike.hitreg.fixture.ts"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4197,strictPort:true,hmr:false}});
const io=new Server(vite.httpServer!,{pingTimeout:120000}),manager=new KapsStrikeServerManager(io,undefined,true);const delays=new Map<string,number>(),timers=new Set<ReturnType<typeof setTimeout>>();
const raw=manager.processPlayerInput.bind(manager);let messages=0;const delivery=new Map<string,number>();
manager.processPlayerInput=(id,cmd)=>{messages++;const delay=delays.get(id)||0;const at=Math.max(delivery.get(id)||0,Date.now()+delay+(messages%9===0?7:0));delivery.set(id,at);const time=setTimeout(()=>{timers.delete(time);raw(id,cmd);},Math.max(0,at-Date.now()));timers.add(time);};
io.on('connection',socket=>{const id=Number(socket.handshake.auth.testUser);manager.register(socket,{id,username:'Range '+id,avatar:null});socket.on('disconnect',()=>manager.handleDisconnect(socket,id));});
MAPS.district.solids=[];MAPS.district.targets=[];await vite.listen();const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const scope=process.env.STRIKE_CASES||'all';
const errors:string[]=[],results:any[]=[];
const until=async(check:()=>boolean,label:string)=>{const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw new Error('Server wait timeout: '+label);await new Promise(r=>setTimeout(r,15));}};
try{
 const c1=await browser.newContext({viewport:{width:960,height:600},isMobile:true,hasTouch:true}),c2=await browser.newContext({viewport:{width:640,height:480},isMobile:true,hasTouch:true});const a=await c1.newPage(),b=await c2.newPage();
 for(const [i,p] of [a,b].entries()){p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:4197/__hitreg?user=${i+1}`);await p.waitForFunction(()=>(window as any).socket?.connected);}
 const created=await a.evaluate(()=>new Promise<any>(r=>(window as any).socket.emit('strike:create_room',{mode:'ffa',map:'district',scoreLimit:1000},r)));assert.ok(created.success);const code=created.room.roomCode;assert.ok((await b.evaluate(code=>new Promise<any>(r=>(window as any).socket.emit('strike:join_room',{roomCode:code},r)),code)).success);assert.ok((await a.evaluate(()=>new Promise<any>(r=>(window as any).socket.emit('strike:start_game',r)))).success);
 for(const p of [a,b])await p.evaluate(code=>(window as any).boot(code),code);
 const room=manager.rooms.get(code)!;room.scoreLimit=1000;const actor=[...room.players.values()].find(p=>p.userId===1)!,target=[...room.players.values()].find(p=>p.userId===2)!;
 for(const p of [a,b])await p.waitForFunction(()=>(window as any).strike.receivedInitialState,{},{timeout:60000});
 const place=async(weapon:string,distance:number,hp=10000)=>{
  await a.evaluate(()=>(window as any).strike.setTouchFire(false));
  for(const [i,p] of [actor,target].entries()){p.state.movement=newMovement({x:0,y:0,z:i?distance:0});p.state.hp=i?hp:100;p.state.protectedUntil=0;p.history=[];p.inputQueue=[];p.heldInput=undefined;p.state.weapon.nextFire=0;p.state.weapon.switchUntil=0;p.state.weapon.reloadUntil=0;}
  actor.state.weapon.selected=weapon as any;actor.state.weapon.inventory=['carbine','lmg','railgun'];actor.state.weapon.ammo[weapon as keyof typeof actor.state.weapon.ammo]=WEAPONS[weapon as keyof typeof WEAPONS].capacity;
  await a.waitForFunction(weapon=>(window as any).strike.state.player.weapon.selected===weapon,weapon);await a.evaluate(d=>(window as any).aim(d),distance);await b.waitForFunction(d=>Math.abs((window as any).strike.state.player.movement.position.z-d)<.2,distance);await a.waitForTimeout(180);
 };
 const summarize=(start:number,weapon:string,distance:number,label:string)=>{const receipts=manager.combatDiagnostics.slice(start).filter((e:any)=>e.accepted);const damage=receipts.reduce((sum:number,e:any)=>sum+Number(e.damage||0),0);const item={label,weapon,distance,accepted:receipts.length,hits:receipts.filter(e=>e.outcome==='hit').length,damage,buffered:manager.combatDiagnostics.slice(start).filter(e=>e.outcome==='buffered').length,rejected:manager.combatDiagnostics.slice(start).filter(e=>e.outcome==='rejected').map(e=>e.reason)};results.push(item);console.log('CASE',JSON.stringify(item));return item;};
 // 20 semi-automatic pistol shots per distance, ordinary controller trigger pulses; no injected damage/hits.
 for(const distance of (scope==='all'||scope==='distance'?[2,5,10,20,40]:[])){
  await place('pistol',distance);await a.evaluate(()=>(window as any).strike.setTouchAds(true));manager.combatDiagnostics.length=0;
  for(let n=0;n<20;n++){
   if(actor.state.weapon.ammo.pistol===0){await a.evaluate(()=>(window as any).strike.pendingReload=true);await until(()=>actor.state.weapon.reloadUntil>0,'reload starts');await until(()=>actor.state.weapon.reloadUntil===0&&actor.state.weapon.ammo.pistol===12,'reload completes');}
   await until(()=>actor.state.weapon.reloadUntil===0&&actor.state.weapon.nextFire<=room.tick&&!actor.state.weapon.triggerHeld,'pistol ready '+n);
   await a.waitForFunction(()=>(window as any).strike.state.player.weapon.reloadUntil===0&&!(window as any).strike.state.player.weapon.triggerHeld);
   const ammo=actor.state.weapon.ammo.pistol;await a.evaluate(()=>(window as any).strike.setTouchFire(true));await until(()=>actor.state.weapon.ammo.pistol<ammo,'pistol shot '+n);await a.evaluate(()=>(window as any).strike.setTouchFire(false));await until(()=>!actor.state.weapon.triggerHeld,'pistol release '+n);

  }
  await a.waitForTimeout(250);const result=summarize(0,'pistol',distance,'20 single shots with reload');assert.equal(result.accepted,20);assert.ok(result.hits>=18,JSON.stringify(result));
 }
 // Four automatic weapons, complete magazine, with modeled one-way delay plus deterministic jitter.
 for(const delay of (scope==='all'||scope==='spray'?[0,30,60,100,150,200]:[]))for(const weapon of ['rifle','smg','carbine','lmg']){
  delays.set(actor.id,delay);actor.ping=delay*2;await a.evaluate(delay=>(window as any).fixtureOneWayDelay=delay,delay);await place(weapon,5);manager.combatDiagnostics.length=0;
  const initial=WEAPONS[weapon as keyof typeof WEAPONS].capacity;
  await a.evaluate(()=>{(window as any).strike.setTouchAds(true);(window as any).strike.setTouchFire(true);});
  await a.waitForFunction(weapon=>(window as any).strike.state.player.weapon.ammo[weapon]===0,weapon,{timeout:20000});await a.evaluate(()=>(window as any).strike.setTouchFire(false));await a.waitForTimeout(delay+400);
  const result=summarize(0,weapon,5,`full magazine; one-way ${delay}ms + 0/7ms jitter`);assert.equal(result.accepted,initial);assert.ok(result.hits>=initial*.9,JSON.stringify(result));
 }
 delays.set(actor.id,0);
 // Visible moving/strafe/crouch/jump poses: aim at the remote mesh, not the current server position.
 for(const delay of (scope==='all'||scope==='motion'?[0,100,200]:[]))for(const motion of ['right','left','crouch','jump','diagonal']){
  delays.set(actor.id,delay);actor.ping=delay*2;await a.evaluate(delay=>(window as any).fixtureOneWayDelay=delay,delay);
  await place('rifle',10);manager.combatDiagnostics.length=0;
  await b.evaluate(m=>{const c=(window as any).strike;c.setTouchMovement(m==='left'?-1:m==='right'||m==='diagonal'?1:0,m==='diagonal'?.3:0);c.setTouchCrouch(m==='crouch');c.setTouchJump(m==='jump');},motion);
  await a.evaluate(()=>{clearInterval((window as any).aimTimer);const c=(window as any).strike;(window as any).aimTimer=setInterval(()=>{const meshes=[...c.renderer.remotePlayerMeshes.values()] as any[];const p=meshes[0]?.root.position;if(!p)return;const me=c.state.player.movement.position,dy=p.y+(meshes[0].body.position.y)-(me.y+1.62);c.yaw=Math.atan2(p.x-me.x,p.z-me.z);c.pitch=-Math.atan2(dy,Math.hypot(p.x-me.x,p.z-me.z));},8);c.setTouchFire(true);});
  await a.waitForTimeout(800+delay);await a.evaluate(()=>(window as any).strike.setTouchFire(false));await b.evaluate(()=>{const c=(window as any).strike;c.setTouchMovement(0,0);c.setTouchCrouch(false);c.setTouchJump(false);});await a.waitForTimeout(200);
  const result=summarize(0,'rifle',10,'moving '+motion+'; one-way '+delay+'ms');assert.ok(result.hits>=3,JSON.stringify(result));
 }
 if(scope==='all'||scope==='weapons')for(const weapon of ['rifle','smg','carbine','lmg','pistol','sniper','shotgun','railgun']){
  delays.set(actor.id,0);await a.evaluate(()=>(window as any).fixtureOneWayDelay=0);await place(weapon,5,100);await a.evaluate(()=>(window as any).strike.setTouchAds(true));manager.combatDiagnostics.length=0;
  let attempts=0;while(target.state.hp>0&&attempts++<15){
   await until(()=>actor.state.weapon.nextFire<=room.tick&&!actor.state.weapon.triggerHeld,'weapon ready '+weapon);
   const ammo=actor.state.weapon.ammo[weapon as keyof typeof actor.state.weapon.ammo];await a.evaluate(()=>(window as any).strike.setTouchFire(true));await until(()=>actor.state.weapon.ammo[weapon as keyof typeof actor.state.weapon.ammo]<ammo,'weapon shot '+weapon);await a.evaluate(()=>(window as any).strike.setTouchFire(false));await until(()=>!actor.state.weapon.triggerHeld,'weapon release '+weapon);
  }
  await b.waitForFunction(()=>(window as any).strike.state.player.hp<=0,{},{timeout:10000});const result=summarize(0,weapon,5,'100 HP body TTK');const accepted=manager.combatDiagnostics.filter(e=>e.accepted);(result as any).ttkMs=(Number(accepted.at(-1)?.serverTick)-Number(accepted[0]?.serverTick))/120*1000;assert.ok(Math.abs(result.damage-100)<1e-6);
 }
 if(scope==='all'||scope==='head'){
  delays.set(actor.id,0);await a.evaluate(()=>(window as any).fixtureOneWayDelay=0);await place('pistol',5,100);
  await a.evaluate(()=>{const w=window as any,c=w.strike;clearInterval(w.aimTimer);c.yaw=0;c.pitch=-Math.atan2(.02,5);c.setTouchFire(true);});
  await until(()=>target.state.hp<100,'headshot damage');await a.evaluate(()=>(window as any).strike.setTouchFire(false));
  await a.waitForFunction(()=>(window as any).strike.lastHit?.head===true);assert.ok(target.state.hp<60);console.log('PASS independent-client headshot damage and authoritative head marker');
 }
 // Real 100 HP 1v1: browser must receive death and kill feed; authoritative scoring exactly once.
 if(scope==='all'||scope==='death'){delays.set(actor.id,0);await a.evaluate(()=>(window as any).fixtureOneWayDelay=0);
 await place('rifle',5,100);const kills=actor.kills;await a.evaluate(()=>(window as any).strike.setTouchFire(true));await b.waitForFunction(()=>(window as any).strike.state.player.hp<=0,{},{timeout:10000});await a.evaluate(()=>(window as any).strike.setTouchFire(false));assert.equal(actor.kills,kills+1);assert.ok(room.killFeed.some(k=>k.killerId===actor.id));
 }
 if(scope==='loot'){
  const map=MAPS[room.map];actor.state.hp=40;target.state.hp=100;target.state.armor=0;
  const heal=room.world.pickups.find(p=>p.consumable==='health')!,shield=room.world.pickups.find(p=>p.consumable==='armor')!;assert.ok(heal&&shield);
  actor.state.movement=newMovement(heal.position);actor.inputQueue=[];actor.heldInput=undefined;
  await a.waitForFunction(()=>{const c=(window as any).strike;return c.state.player.hp===40&&Math.hypot(c.state.player.movement.position.x-c.state.world.pickups.find((p:any)=>p.consumable==='health').position.x,c.state.player.movement.position.z-c.state.world.pickups.find((p:any)=>p.consumable==='health').position.z)<.5;});await a.bringToFront();await a.waitForFunction(()=>(window as any).strike.renderer.scene.isReady()&&(window as any).strike.active);await a.evaluate(()=>(window as any).strike.interact());await until(()=>actor.state.hp===90,'authoritative heal');assert.equal(heal.opened,true);
  target.state.movement=newMovement(shield.position);target.inputQueue=[];target.heldInput=undefined;
  await b.waitForFunction(()=>{const c=(window as any).strike,s=c.state.world.pickups.find((p:any)=>p.consumable==='armor');return Math.hypot(c.state.player.movement.position.x-s.position.x,c.state.player.movement.position.z-s.position.z)<.5;});await b.bringToFront();await b.waitForFunction(()=>(window as any).strike.renderer.scene.isReady()&&(window as any).strike.active);await b.evaluate(()=>(window as any).strike.interact());await until(()=>target.state.armor===50,'authoritative shield');await b.waitForFunction(()=>(window as any).strike.state.player.armor===50);
  await place('rifle',5,100);await a.evaluate(()=>(window as any).strike.setTouchFire(true));await until(()=>target.state.armor!<50,'shield takes first hit');await a.evaluate(()=>(window as any).strike.setTouchFire(false));assert.equal(target.state.hp,100);assert.ok(target.state.armor!>0);
  await a.waitForTimeout(200);await a.evaluate(()=>(window as any).strike.setTouchFire(true));await until(()=>target.state.hp<100,'shield depleted before health');await a.evaluate(()=>(window as any).strike.setTouchFire(false));assert.equal(target.state.armor,0);
  actor.state.weapon.inventory=[];const world=await import('../src/games/kapsstrike/world');world.advanceWorld(room.world,map,world.DROP_INTERVAL);const drop=room.world.pickups.find(p=>p.kind==='airdrop')!;actor.state.movement=newMovement(drop.position);actor.inputQueue=[];actor.heldInput=undefined;await a.waitForFunction(()=>{const c=(window as any).strike,s=c.state.world.pickups.find((p:any)=>p.kind==='airdrop');return s&&Math.hypot(c.state.player.movement.position.x-s.position.x,c.state.player.movement.position.z-s.position.z)<.5;});await a.bringToFront();await a.evaluate(()=>(window as any).strike.interact());await until(()=>drop.opened,'airdrop claimed');assert.equal(actor.state.weapon.inventory?.length,1);await a.waitForFunction(w=>(window as any).strike.state.player.weapon.selected===w,drop.weapon);console.log('PASS independent clients: heal crate, shield crate, shield-before-HP damage and single-weapon authoritative airdrop');
 }
 const latency=await a.evaluate(()=>(window as any).strike.shotAckLatency as number[]);const avg=latency.reduce((a,b)=>a+b,0)/latency.length;console.log('PASS independent WebGL clients',{scope,cases:results.length,avgAckMs:avg,samples:latency.length});assert.deepEqual(errors,[]);
 await writeFile(output+'/browser-results.json',JSON.stringify({results,ackLatencyLast128:{meanMs:avg,samples:latency.length},errors,notes:'Empty diagnostic range; fixture-controlled initial poses/health; inbound delivery delay is one-way, not measured WAN RTT. Normal production controller/fire/raycast/damage/socket paths.'},null,2));
 await a.evaluate(()=>{clearInterval((window as any).aimTimer);(window as any).strike.dispose();(window as any).socket.disconnect();});await b.evaluate(()=>{(window as any).strike.dispose();(window as any).socket.disconnect();});
 const preview=await c1.newPage();await preview.goto('http://127.0.0.1:4197/__hitreg?knife=1');await preview.waitForFunction(()=>(window as any).knife);
 for(const style of (scope==='all'||scope==='knives'?['karambit','butterfly']:[]))for(const [index,t] of [0,.28,.5,.72,.98].entries()){await preview.evaluate(({style,t})=>(window as any).knife(style,t),{style,t});await preview.screenshot({path:`${output}/${style}-${index}.png`});}
 if(scope==='all'||scope==='knives')console.log('PASS production knife rigs: five animation samples per style captured');
}catch(error){console.log('FAIL',JSON.stringify([...manager.rooms.values()].map(r=>({tick:r.tick,players:[...r.players.values()].map(p=>({id:p.userId,weapon:p.state.weapon,position:p.state.movement.position,hp:p.state.hp,queue:p.inputQueue.length}))}))));throw error;}finally{for(const t of timers)clearTimeout(t);for(const r of manager.rooms.values())manager.stopRoomSimulationLoop(r);await browser.close();await new Promise<void>(r=>io.close(()=>r()));await vite.close();}
