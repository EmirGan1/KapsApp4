import test from 'node:test';import assert from 'node:assert/strict';
import {createBombMatch,stepBomb,bombInteract,dropBomb,buyBombEquipment,bombView,bombPurchaseError} from '../src/games/kapsstrike/bomb';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
const players=(count=2)=>Array.from({length:count},(_,i)=>({id:String(i),team:(i%2?'CT':'T') as 'T'|'CT',position:{x:34.42208,y:3.2,z:37.9984}}));
function planted(){const m=createBombMatch(players(),0);stepBomb(m,15);bombInteract(m,'0',true,16);m.players['0'].holdUntil=20;stepBomb(m,19.21);assert.equal(m.phase,'planted');return m;}
for(const count of [2,4,10])test(`${count} players: minimum teams, 40s planted timer, explosion and one result`,()=>{const m=createBombMatch(players(count),0);stepBomb(m,15);bombInteract(m,'0',true,16);m.players['0'].holdUntil=20;stepBomb(m,19.21);assert.equal(m.deadline,59.21);stepBomb(m,59.21);assert.equal(m.winner,'T');assert.equal(m.scores.T,1);stepBomb(m,59.22);assert.equal(m.scores.T,1);});
test('invalid teams and overfull teams rejected',()=>{assert.throws(()=>createBombMatch(players(1),0));assert.throws(()=>createBombMatch(players(12),0));assert.throws(()=>createBombMatch(players().map(p=>({...p,team:'T'})),0));});
test('kits, buy time and balances validated; cosmetic inventory absent from economy',()=>{const m=createBombMatch(players(),0);assert.equal(buyBombEquipment(m,'0','kit',1),false);assert.equal(buyBombEquipment(m,'1','kit',1),true);assert.equal(m.players['1'].money,400);assert.equal(buyBombEquipment(m,'1','rifle',2),false);assert.equal(buyBombEquipment(m,'1','pistol',2),false);assert.equal(buyBombEquipment(m,'1','armor',16),false);});
test('defuse after all terrorists die remains possible',()=>{const m=planted();m.players['0'].alive=false;stepBomb(m,20);assert.equal(m.phase,'planted');bombInteract(m,'1',true,20);m.players['1'].holdUntil=31;stepBomb(m,30);assert.equal(m.winner,'CT');assert.equal(m.players['1'].defuses,1);});
test('explosion wins an exact defuse tie',()=>{const m=planted();bombInteract(m,'1',true,m.deadline-10);m.players['1'].holdUntil=m.deadline+1;stepBomb(m,m.deadline);assert.equal(m.winner,'T');assert.equal(m.players['1'].defuses,0);});
test('moving, releasing or dying cancels actions',()=>{for(const kind of ['move','release','death']){const m=createBombMatch(players(),0);stepBomb(m,15);bombInteract(m,'0',true,16);if(kind==='move')m.players['0'].position.x+=2;if(kind==='release')bombInteract(m,'0',false,16.1);if(kind==='death')m.players['0'].alive=false;stepBomb(m,16.2);assert.equal(m.action,undefined);}});
test('bomb drop has only one owner; CT cannot pick up',()=>{const m=createBombMatch(players(4),0);stepBomb(m,15);assert.equal(dropBomb(m,'0'),true);bombInteract(m,'1',true,16);assert.equal(m.carrier,undefined);bombInteract(m,'2',true,16);assert.equal(m.carrier,'2');assert.equal(m.position,undefined);});
test('round time and elimination resolve once',()=>{for(const side of ['T','CT']){const m=createBombMatch(players(),0);stepBomb(m,15);m.players[side==='T'?'0':'1'].alive=false;stepBomb(m,16);assert.equal(m.winner,side==='T'?'CT':'T');}const m=createBombMatch(players(),0);stepBomb(m,15);stepBomb(m,120);assert.equal(m.winner,'CT');});
test('server starts with one T and one CT, freezes buy phase and never auto-respawns deaths',()=>{const io:any={to:()=>({emit(){}}),emit(){}};const server=new KapsStrikeServerManager(io);const room=server.createRoom({id:1,username:'a',avatar:null},'a',{mode:'bomb'});assert.equal(room.map,'district');assert.equal(server.startGame('a').success,false);server.joinRoom(room.roomCode,{id:2,username:'b',avatar:null},'b');assert.equal(server.startGame('a').success,false);server.setReady('b',true);assert.equal(server.startGame('a').success,true);server.stopRoomSimulationLoop(room);assert.ok(room.bomb);server.tickSimulation(room);room.players.get('a')!.state.hp=0;room.bomb!.phase='planted';room.bomb!.deadline=1000;room.players.get('a')!.state.deadUntil=0;server.tickSimulation(room);assert.equal(room.players.get('a')!.state.hp,0);});
test('purchase rejects prototype keys without corrupting money or inventory',()=>{
 const m=createBombMatch(players(),0);
 for(const key of ['toString','constructor','__proto__','valueOf','unknown'])assert.equal(buyBombEquipment(m,'0',key,1),false);
 assert.equal(m.players['0'].money,800);assert.deepEqual(m.players['0'].weapons,['pistol','knife']);
 assert.match(bombPurchaseError(m,'0','rifle',1)!,/paran/);
});
test('enemy receives no economy, carried bomb, dropped bomb or private action information',()=>{
 const m=createBombMatch(players(),0);stepBomb(m,15);bombInteract(m,'0',true,16);
 let v=bombView(m,'1');assert.equal(v.carrier,undefined);assert.equal(v.action,undefined);assert.equal(v.players['0'].money,0);assert.deepEqual(v.players['0'].weapons,[]);
 assert.equal(m.carrier,'0');assert.ok(m.action);assert.equal(bombView(m,'0').action?.player,'0');
 dropBomb(m,'0');v=bombView(m,'1');assert.equal(v.position,undefined);assert.ok(bombView(m,'0').position);
});
test('leaving removes objective owner and action, and cannot respawn a ghost participant',()=>{
 const io:any={to:()=>({emit(){}}),emit(){}};const server=new KapsStrikeServerManager(io);
 const room=server.createRoom({id:1,username:'a',avatar:null},'a',{mode:'bomb'});
 server.joinRoom(room.roomCode,{id:2,username:'b',avatar:null},'b');server.setReady('b',true);server.startGame('a');server.stopRoomSimulationLoop(room);server.tickSimulation(room);
 room.bomb!.phase='active';room.bomb!.carrier='a';server.leaveRoom('a',1);
 assert.equal(room.bomb!.carrier,undefined);assert.equal(room.bomb!.players.a,undefined);server.tickSimulation(room);assert.equal(room.bomb!.winner,'CT');assert.equal(room.hostId,2);
});
test('expanded district has clear shared A/B centers, painted zones and world signs',async()=>{
 const {MAPS}=await import('../src/games/kapsstrike/maps');const {fits}=await import('../src/games/kapsstrike/physics');const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');
 assert.ok(MAPS.district.bounds>=55);
 for(const site of BOMB_SITES){assert.ok(fits(MAPS.district,{x:site.x,y:site.y,z:site.z},1.8));assert.ok(MAPS.district.solids.some(s=>s.label==='BOMBSITE '+site.id));assert.ok(MAPS.district.solids.some(s=>s.id.includes('site-paving')&&s.x===site.x&&s.z===site.z));}
});
test('radar reconstruction accepts planting at both shared site centers',async()=>{
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');
 for(const site of BOMB_SITES){const m=createBombMatch(players().map(p=>({...p,position:{x:site.x,y:site.y,z:site.z}})),0);stepBomb(m,15);assert.ok(bombInteract(m,'0',true,16));m.players['0'].holdUntil=21;stepBomb(m,19.21);assert.equal(m.phase,'planted');assert.equal(m.site,site.id);}
});
test('district: standing players across elevated A/B sites have occluded sightlines',async()=>{
 const {MAPS}=await import('../src/games/kapsstrike/maps');
 const {raySolid,fits}=await import('../src/games/kapsstrike/physics');
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');
 const map=MAPS.district;
 const siteA=BOMB_SITES.find(s=>s.id==='A')!;
 const siteB=BOMB_SITES.find(s=>s.id==='B')!;
 let checked=0;
 for(let ax=-siteA.radius+1;ax<=siteA.radius-1;ax+=1){
  for(let az=-siteA.radius+1;az<=siteA.radius-1;az+=1){
   if(Math.hypot(ax,az)>siteA.radius)continue;
   if(!fits(map,{x:siteA.x+ax,y:siteA.y,z:siteA.z+az},1.8))continue;
   const pA={x:siteA.x+ax,y:siteA.y+1.62,z:siteA.z+az};
   for(let bx=-siteB.radius+1;bx<=siteB.radius-1;bx+=1){
    for(let bz=-siteB.radius+1;bz<=siteB.radius-1;bz+=1){
     if(Math.hypot(bx,bz)>siteB.radius)continue;
     if(!fits(map,{x:siteB.x+bx,y:siteB.y,z:siteB.z+bz},1.8))continue;
     const pB={x:siteB.x+bx,y:siteB.y+1.62,z:siteB.z+bz};
     checked++;
     const dir={x:pB.x-pA.x,y:pB.y-pA.y,z:pB.z-pA.z};
     const dist=Math.hypot(dir.x,dir.y,dir.z);
     dir.x/=dist;dir.y/=dist;dir.z/=dist;
     let hitDist=Infinity;
     for(const s of map.solids){
      if(s.detail||s.hidden)continue;
      const hit=raySolid(pA,dir,s,dist);
      if(hit<hitDist)hitDist=hit;
     }
     assert.ok(hitDist<dist-0.1,`Unblocked sightline detected from A(${pA.x},${pA.z}) to B(${pB.x},${pB.z})`);
    }
   }
  }
 }
 assert.ok(checked>=500,`Must test substantial sample rays across sites: ${checked}`);
});

test('explosion payload reaches both teams including the dead victim during results',()=>{
 const b=createBombMatch([{id:'t',team:'T',position:{x:0,y:0,z:0}},{id:'ct',team:'CT',position:{x:0,y:0,z:1}}],0);
 b.phase='planted';b.position={x:0,y:0,z:0};b.deadline=1;stepBomb(b,1);
 for(const id of ['t','ct']){const v=bombView(b,id);assert.ok(v.explosion);assert.equal(v.phase,'result');assert.equal(v.explosion!.at,1);assert.equal(v.players[id].alive,false);}
});

test('all 15 photos are placed in every map across interior and exterior walls',async()=>{
 const {MAPS}=await import('../src/games/kapsstrike/maps');
 const expectedPhotos=Array.from({length:15},(_,i)=>`/kapsstrike/photos/photo-${String(i+1).padStart(2,'0')}.jpg`);
 for(const map of Object.values(MAPS)){
  assert.ok(map.photoFrames&&map.photoFrames.length>=15,`${map.id} must have at least 15 photoFrames`);
  const present=new Set(map.photoFrames!.map(f=>f.image));
  for(const img of expectedPhotos){
   assert.ok(present.has(img),`${map.id} is missing ${img}`);
  }
 }
});

test('CS-style C4 plant animation, blinking beacon, and multi-stage explosion render in Babylon scene',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine');
 const {StrikeRenderer}=await import('../src/games/kapsstrike/renderer');
 const {MAPS}=await import('../src/games/kapsstrike/maps');
 const {DEFAULT_SETTINGS}=await import('../src/games/kapsstrike/config');
 const {createTraining}=await import('../src/games/kapsstrike/combat');
 const engine=new NullEngine();
 const renderer=new StrikeRenderer({} as HTMLCanvasElement,MAPS.district,{...DEFAULT_SETTINGS,quality:'high'},engine);
 const state=createTraining('district');
 const p=state.player;
 // 1. Planting phase shows held-bomb with keypad/display
 state.bomb=createBombMatch([{id:p.id,team:'T',position:{...p.movement.position}},{id:'ct',team:'CT',position:{x:0,y:0,z:0}}],0);
 state.bomb.phase='active';
 state.bomb.action={kind:'plant',player:p.id,started:0,position:{...p.movement.position}};
 renderer.render(state,0,0,false,1,p.movement.position,1/60);
 assert.equal(renderer.scene.getMeshByName('held-bomb')?.isEnabled(),true);
 // 2. Planted phase shows tactical-bomb, bomb-indicator, and bomb-beacon-ring
 state.bomb.action=undefined;
 state.bomb.phase='planted';
 state.bomb.position={x:p.movement.position.x+3,y:p.movement.position.y,z:p.movement.position.z};
 state.bomb.deadline=25;
 renderer.render(state,0,0,false,1,p.movement.position,1/60);
 assert.equal(renderer.scene.getMeshByName('tactical-bomb')?.isEnabled(),true);
 assert.equal(renderer.scene.getMeshByName('bomb-indicator')?.isEnabled(),true);
 assert.equal(renderer.scene.getMeshByName('bomb-beacon-ring')?.isEnabled(),true);
 // 3. Detonation triggers shockwave, fireball, smoke, debris sparks, scorch crater, blast light, and camera flash
 state.bomb.phase='result';
 state.bomb.explosion={at:25,radius:18,position:{...state.bomb.position}};
 renderer.render(state,0,0,false,1,p.movement.position,0.15);
 assert.equal(renderer.scene.getMeshByName('bomb-shockwave')?.isEnabled(),true);
 assert.equal(renderer.scene.getMeshByName('bomb-fireball')?.isEnabled(),true);
 assert.equal(renderer.scene.getMeshByName('bomb-camera-flash')?.isEnabled(),true);
 assert.equal(renderer.scene.getMeshByName('bomb-scorch')?.isEnabled(),true);
 assert.equal(renderer.scene.getMeshByName('bomb-debris-0')?.isEnabled(),true);
 // 4. After 3.5s, blast meshes cleanly disable
 renderer.render(state,0,0,false,1,p.movement.position,3.5);
 (renderer as any).blast.age=3.5;
 renderer.render(state,0,0,false,1,p.movement.position,0);
 assert.equal(renderer.scene.getMeshByName('bomb-fireball')?.isEnabled(),false);
 assert.equal(renderer.scene.getMeshByName('bomb-camera-flash')?.isEnabled(),false);
 renderer.dispose();
});

test('buy phase accepts owned weapon selection but freezes movement and fire',()=>{
 const io:any={to:()=>({emit(){}}),emit(){}};const server=new KapsStrikeServerManager(io);
 const room=server.createRoom({id:1,username:'a',avatar:null},'a',{mode:'bomb'});
 server.joinRoom(room.roomCode,{id:2,username:'b',avatar:null},'b');server.setReady('b',true);server.startGame('a');server.stopRoomSimulationLoop(room);server.tickSimulation(room);
 const p=room.players.get('a')!,bp=room.bomb!.players.a;bp.money=16000;
 assert.ok(buyBombEquipment(room.bomb!,'a','sniper',room.tick/120));
 const before={...p.state.movement.position};const ammo=p.state.weapon.ammo.pistol;
 p.inputQueue.push({sequence:1,tick:room.tick,yaw:.4,pitch:.1,moveX:1,moveZ:1,jump:true,sprint:true,crouch:false,fire:true,ads:false,reload:true,weapon:'sniper'});
 server.tickSimulation(room);
 assert.equal(p.state.weapon.selected,'sniper');assert.ok(p.state.weapon.inventory?.includes('sniper'));
 assert.deepEqual(p.state.movement.position,before);assert.equal(p.state.weapon.ammo.pistol,ammo);
 p.inputQueue.push({sequence:2,tick:room.tick,yaw:0,pitch:0,moveX:0,moveZ:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false,weapon:'railgun'});
 server.tickSimulation(room);assert.equal(p.state.weapon.selected,'sniper');
});
test('A platform has continuous collision support throughout the site',async()=>{
 const {MAPS}=await import('../src/games/kapsstrike/maps');const {support}=await import('../src/games/kapsstrike/physics');
 for(let x=28;x<=51;x+=.5)for(let z=34;z<=45;z+=.5)assert.ok(support(MAPS.district,{x,y:3.2,z},3.25)>=3.19,`unsupported A floor ${x},${z}`);
});

test('planted T win immediately when final CT dies, with one reward',()=>{const m=planted();m.players['1'].alive=false;stepBomb(m,20);assert.equal(m.phase,'result');assert.equal(m.winner,'T');const money=m.players['0'].money;stepBomb(m,20.1);assert.equal(m.scores.T,1);assert.equal(m.players['0'].money,money);});
test('weapon replacement refunds only this buy phase and never leaves two firearms',()=>{const m=createBombMatch(players(),0),p=m.players['0'];p.money=5000;assert.ok(buyBombEquipment(m,'0','rifle',1));assert.equal(p.money,2300);assert.ok(buyBombEquipment(m,'0','sniper',2));assert.equal(p.money,500);assert.deepEqual(p.weapons,['knife','sniper']);assert.ok(buyBombEquipment(m,'0','smg',3));assert.equal(p.money,3800);m.phase='result';m.scores.T=1;m.deadline=4;stepBomb(m,4);assert.equal(p.purchase,undefined);p.money=200;assert.equal(buyBombEquipment(m,'0','sniper',5),false);assert.deepEqual(p.weapons,['knife','smg']);});
