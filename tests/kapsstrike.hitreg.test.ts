import test from 'node:test';
import assert from 'node:assert/strict';
import {KapsStrikeServerManager,StrikeServerPlayer} from '../src/server/kapsstrikeServer';
import {tracePlayer} from '../src/games/kapsstrike/hitboxes';
import {MAPS} from '../src/games/kapsstrike/maps';
import {PHYSICS as C,WEAPONS,WEAPON_ORDER} from '../src/games/kapsstrike/config';
import {createTraining,simulate,shotDirection,shoot,weaponDamage} from '../src/games/kapsstrike/combat';
import type {InputCommand,WeaponId} from '../src/games/kapsstrike/types';
const input=(sequence:number,tick:number,fire=false):InputCommand=>({sequence,tick,moveX:0,moveZ:0,yaw:0,pitch:Math.atan2(.62,5),jump:false,sprint:false,crouch:false,ads:true,fire,reload:false});
function fixture(debug=true){const events:{id:string;name:string;value:any}[]=[];const io:any={to:(id:string)=>({emit:(name:string,value:any)=>events.push({id,name,value})}),emit(){}};const manager=new KapsStrikeServerManager(io,undefined,debug);const room=manager.createRoom({id:1,username:'a',avatar:null},'a',{mode:'ffa',map:'district',scoreLimit:10000});manager.joinRoom(room.roomCode,{id:2,username:'b',avatar:null},'b');manager.startGame('a');manager.stopRoomSimulationLoop(room);room.tick=1000;room.timeLimit=100000;const [a,b]=[...room.players.values()];for(const p of [a,b]){p.state.protectedUntil=0;p.state.movement.position={x:0,y:0,z:p===a?0:5};p.state.movement.velocity={x:0,y:0,z:0};p.state.movement.grounded=true;p.state.weapon.selected='rifle';p.state.weapon.nextFire=0;p.state.weapon.switchUntil=0;p.history=[];}return {manager,room,a,b,events};}
function clearWorld<T>(fn:()=>T){const solids=MAPS.district.solids;MAPS.district.solids=[];try{return fn();}finally{MAPS.district.solids=solids;}}
test('automatic held fire survives sparse delivery, expires safely, duplicate input is acknowledged once',()=>clearWorld(()=>{
 const {manager,room,a,b,events}=fixture();b.state.hp=10000;a.state.weapon.selected='smg';
 for(let i=0;i<120;i++){if(i%4===0)manager.processPlayerInput('a',input(i+1,room.tick,true));manager.tickSimulation(room);}
 const accepted=events.filter(e=>e.id==='a'&&e.name==='strike:shot_ack'&&e.value.accepted);assert.ok(accepted.length>=14,`850 RPM should produce 14–15 shots/sec, got ${accepted.length}`);
 assert.equal(WEAPONS.smg.capacity-a.state.weapon.ammo.smg,accepted.length);assert.equal(new Set(accepted.map(e=>e.value.shotId)).size,accepted.length);
 const count=accepted.length;for(let i=0;i<60;i++)manager.tickSimulation(room);const final=events.filter(e=>e.name==='strike:shot_ack'&&e.value.accepted).length;assert.ok(final<=count+2,'stale trigger must expire');
 manager.processPlayerInput('a',{...input(999,room.tick,true),shot:99});manager.processPlayerInput('a',{...input(999,room.tick,true),shot:99});assert.ok(events.some(e=>e.value.reason==='invalid-or-duplicate-input'));manager.tickSimulation(room);
}));
test('rendered remote tick compensates a moving target; modern timestamps are bounded',()=>clearWorld(()=>{
 const {manager,room,a,b,events}=fixture();b.state.movement.position.x=.9;
 for(const tick of [980,990,1000]){b.state.movement.position.x=(tick-980)*.045;b.recordHistory(tick,0);}
 a.state.pitch=Math.atan2(.62,5);a.activeCommand={...input(1,1000,true),viewTick:980,shot:1};
 (manager as any).verifyAndExecuteShot(room,a,true,980);
 assert.ok(b.state.hp<100);assert.ok(events.some(e=>e.name==='strike:shot_ack'&&e.value.outcome==='hit'));
 a.state.weapon.nextFire=0;a.activeCommand={...input(2,room.tick,true),viewTick:1,shot:2};(manager as any).verifyAndExecuteShot(room,a,true,1);
 const trace=manager.combatDiagnostics.at(-1)!;assert.equal(trace.reason,'stale-or-future-view');assert.equal(trace.accepted,false);
}));
test('history interpolates fractional pose and wraps yaw, never across teleport/death',()=>{
 const p=new StrikeServerPlayer('x',1,'x',null,'','red',{x:0,y:0,z:0});p.state.yaw=Math.PI-.1;p.recordHistory(10,0);p.state.yaw=-Math.PI+.1;p.state.movement.position.x=1;p.recordHistory(12,0);const h=p.getHistoricalPosition(11);assert.equal(h.position.x,.5);assert.ok(Math.abs(h.yaw-Math.PI)<.001);
 p.state.movement.position.x=20;p.recordHistory(14,0);assert.equal(p.getHistoricalPosition(13).position.x,1);
});
test('visible arm, crouching head and rotated torso use bounded oriented hitboxes',()=>{
 assert.equal(tracePlayer({x:.43,y:1,z:-3},{x:0,y:0,z:1},{position:{x:0,y:0,z:0},height:1.8,yaw:0},10)?.part,'arm-r');
 assert.equal(tracePlayer({x:0,y:.96,z:-3},{x:0,y:0,z:1},{position:{x:0,y:0,z:0},height:1.12},10)?.part,'head');
 assert.equal(tracePlayer({x:1,y:1,z:-3},{x:0,y:0,z:1},{position:{x:0,y:0,z:0},height:1.8},10),undefined);
 assert.ok(tracePlayer({x:.4,y:.7,z:-3},{x:0,y:0,z:1},{position:{x:0,y:0,z:0},height:1.8,yaw:Math.PI/4},10));
});
for(const id of WEAPON_ORDER)test(`${id}: shared deterministic direction, fire rate, ammo and damage at 30/60/120/144 FPS`,()=>{
 const counts:number[]=[];
 for(const fps of [30,60,120,144]){const state=createTraining('district');state.targets=[];state.player.weapon.selected=id;state.player.weapon.inventory=WEAPON_ORDER;state.player.weapon.ammo[id]=10000;let acc=0,seq=0;const dt=1/fps;
  for(let frame=0;frame<fps*2;frame++){acc+=dt;while(acc+1e-9>=C.dt){simulate(state,{...input(++seq,state.tick,WEAPONS[id].automatic||state.tick%Math.ceil(60/WEAPONS[id].rpm/C.dt)===0),weapon:id},false);acc-=C.dt;}}
  counts.push(state.player.weapon.shotIndex);assert.equal(id==='knife'?10000:10000-state.player.weapon.ammo[id],id==='knife'?10000:state.player.weapon.shotIndex);
  assert.deepEqual(shotDirection(state.player,1,0,true),shotDirection(state.player,1,0,true));
  assert.ok(weaponDamage(id,5,true,false)>=weaponDamage(id,5,false,false));
 }assert.ok(counts.every(n=>n===counts[0]),JSON.stringify({id,counts}));
});
test('automatic reload preserves magazine accounting and unique shots under delivery delay and jitter',()=>clearWorld(()=>{
 for(const delay of [0,30,60,100,150,200])for(const id of ['rifle','smg','carbine','lmg'] as WeaponId[]){const {manager,room,a,b,events}=fixture();a.state.weapon.selected=id;a.state.weapon.inventory=WEAPON_ORDER;b.state.hp=100000;a.ping=delay*2;
  let completedReloads=0;const pending:{at:number;cmd:InputCommand}[]=[];for(let i=0;i<1200;i++){
   if(i<1000){const latency=Math.ceil(delay/1000/C.dt)+(i%12===0?2:0);pending.push({at:i+latency,cmd:input(i+1,room.tick,true)});}
   // TCP preserves message order even under jitter; head-of-line blocking, not artificial reordering.
   while(pending.length&&pending[0].at<=i)manager.processPlayerInput('a',pending.shift()!.cmd);
   if(a.state.weapon.reloadUntil&&room.tick+1>=a.state.weapon.reloadUntil)completedReloads++;
   manager.tickSimulation(room);
  }
  const shots=events.filter(e=>e.name==='strike:shot_ack'&&e.value.accepted);
  assert.ok(shots.length>=WEAPONS[id].capacity);assert.equal(shots.length+a.state.weapon.ammo[id],WEAPONS[id].capacity*(1+completedReloads),JSON.stringify({delay,id,shots:shots.length,completedReloads}));if(id==='rifle'||id==='smg')assert.ok(completedReloads>0);assert.equal(new Set(shots.map(s=>s.value.shotId)).size,shots.length);
 }
}));

test('the last predicted round buffers across cooldown and trigger release, without adding ammo or RPM',()=>clearWorld(()=>{
 const {manager,room,a,b,events}=fixture();b.state.hp=10000;a.state.weapon.ammo.rifle=1;a.state.weapon.shotIndex=29;a.state.weapon.nextFire=room.tick+5;
 manager.processPlayerInput('a',{...input(1,room.tick,true),viewTick:room.tick,shot:30});manager.tickSimulation(room);
 assert.equal(a.state.weapon.ammo.rifle,1);assert.ok(events.some(e=>e.value.outcome==='buffered'));
 manager.processPlayerInput('a',{...input(2,room.tick,false),viewTick:room.tick});for(let i=0;i<25;i++)manager.tickSimulation(room);
 assert.equal(a.state.weapon.ammo.rifle,0);assert.equal(a.state.weapon.shotIndex,30);assert.equal(events.filter(e=>e.name==='strike:shot_ack'&&e.value.accepted).length,1);
}));

test('barrel/cone raycasts use visible polygon faces instead of invisible AABB corners',async()=>{
 const {raySolid}=await import('../src/games/kapsstrike/physics');const base:any={id:'barrel',kind:'box',x:0,y:0,z:0,w:1,h:1,d:1,color:''};
 assert.equal(raySolid({x:.49,y:.5,z:-3},{x:0,y:0,z:1},{...base,shape:'cylinder'},2.6),Infinity);
 assert.ok(Math.abs(raySolid({x:0,y:.5,z:-3},{x:0,y:0,z:1},{...base,shape:'cylinder'},10)-2.5)<1e-6);
 assert.equal(raySolid({x:.4,y:.9,z:-3},{x:0,y:0,z:1},{...base,shape:'cone'},3),Infinity);
 assert.equal(raySolid({x:.49,y:.5,z:-3},{x:0,y:0,z:1},base,2.6),2.5,'real box cover stays opaque');
});

test('production-default diagnostics expose no rewound targets and own shot acknowledgement goes only to its shooter',()=>clearWorld(()=>{
 const {manager,room,a,events}=fixture(false);a.state.pitch=Math.atan2(.62,5);(manager as any).verifyAndExecuteShot(room,a,true,room.tick);
 assert.equal(manager.combatDiagnostics.length,0);assert.equal(events.some(e=>e.name==='strike:combat_debug'),false);assert.ok(events.filter(e=>e.name==='strike:shot_ack').every(e=>e.id==='a'));
}));
test('10 simultaneous automatic shooters retain bounded history and fire exactly one magazine each',()=>clearWorld(()=>{
 const counts={shots:0};const io:any={to:()=>({emit:(name:string,r:any)=>{if(name==='strike:shot_ack'&&r.accepted)counts.shots++;}}),emit(){}};const manager=new KapsStrikeServerManager(io),room=manager.createRoom({id:1,username:'a',avatar:null},'a',{mode:'ffa',map:'district',maxPlayers:10,scoreLimit:10000});
 for(let i=2;i<=10;i++)manager.joinRoom(room.roomCode,{id:i,username:String(i),avatar:null},String(i));manager.startGame('a');manager.stopRoomSimulationLoop(room);room.tick=1000;
 const players=[...room.players.values()];for(const [i,p] of players.entries()){p.state.hp=100000;p.state.protectedUntil=0;p.state.movement.position={x:(i%5)*3,y:0,z:Math.floor(i/5)*8};p.state.weapon.selected='lmg';p.state.weapon.inventory=['lmg'];p.state.weapon.switchUntil=0;}
 const durations:number[]=[];for(let step=0;step<900;step++){for(const p of players)manager.processPlayerInput(p.id,{...input(step+1,room.tick,true),yaw:p.userId<=5?0:Math.PI,pitch:.08});const start=performance.now();manager.tickSimulation(room);durations.push(performance.now()-start);}
 assert.equal(counts.shots,600);assert.ok(players.every(p=>p.history.length<=60&&p.inputQueue.length<=24&&p.state.weapon.ammo.lmg===0));durations.sort((a,b)=>a-b);console.log(JSON.stringify({diagnostic:'10-shooter empty-range stress',acceptedShots:counts.shots,p95StepMs:durations[Math.floor(durations.length*.95)],meanStepMs:durations.reduce((a,b)=>a+b,0)/durations.length}));
}));

test('RX-3 Şimşek body shot defeats 100 health and full armor in one confirmed hit',()=>clearWorld(()=>{
 const {manager,room,a,b,events}=fixture();
 a.state.weapon.selected='railgun';
 a.state.weapon.inventory=['railgun'];
 a.state.pitch=Math.atan2(.62,5);
 b.state.hp=100;b.state.armor=100;
 (manager as any).verifyAndExecuteShot(room,a,true,room.tick);
 assert.equal(b.state.hp,0);
 assert.ok(events.some(e=>e.name==='strike:shot_ack'&&e.value.outcome==='hit'));
}));
