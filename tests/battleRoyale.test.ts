import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleRoyaleManager, MAP_SIZE, MAP_BUILDINGS, WEAPON_CONFIGS, rayIntersectsCircle, rayIntersectsRect, checkRaycastWalls, runHeadlessBattleRoyaleTest } from '../src/server/battleRoyaleServer.ts';
import { runBattleRoyaleChaosSimulation } from '../src/server/battleRoyaleChaosTest.ts';
const io = { emit() {}, to: () => ({ emit() {} }) } as any;
function fixture(mode: 'royale' | 'deathmatch' = 'deathmatch') {
  const manager = new BattleRoyaleManager(io);
  const room = manager.createRoom({ id: 1, username: 'host', avatar: null }, { mode, capacity: 20, duration: 600 });
  manager.joinRoom(room.id, { id: 2, username: 'peer', avatar: null });
  return { manager, room, player: room.players[0] };
}
test('outsiders cannot reset matches or add/remove bots', () => {
  const { manager, room } = fixture();
  assert.ok(manager.addBot(room.id, 999).error);
  manager.addBot(room.id, 1);
  assert.ok(manager.removeBot(room.id, 999).error);
  room.status = 'playing';
  assert.ok(manager.returnToLobby(room.id, 999).error);
  assert.equal(room.status, 'playing');
  assert.ok(manager.returnToLobby(room.id, 2).error);
});
test('royale eliminated players cannot respawn and deathmatch must wait', () => {
  for (const mode of ['royale', 'deathmatch'] as const) {
    const { manager, room, player } = fixture(mode); room.status = 'playing';
    player.isAlive = false; player.hp = 0; player.respawnAt = Date.now() + 3000;
    assert.equal(manager.requestRespawn(room.id, 1), false);
    player.respawnAt = Date.now() - 1;
    assert.equal(manager.requestRespawn(room.id, 1), mode === 'deathmatch');
  }
});
test('respawn ack is one-use and cannot extend invulnerability', () => {
  const { manager, room, player } = fixture(); room.status = 'playing';
  player.isAlive = false; player.hp = 0; player.respawnAt = Date.now() - 1;
  assert.equal(manager.requestRespawn(room.id, 1), true);
  assert.equal(manager.confirmRespawnAck(room.id, 1), true);
  const end = player.spawnShieldEndTime;
  assert.equal(manager.confirmRespawnAck(room.id, 1), false);
  assert.equal(player.spawnShieldEndTime, end);
});
test('late join spawns safely with initialized movement and protection', () => {
  const { manager, room } = fixture(); room.status = 'playing';
  assert.equal(manager.joinRoom(room.id, { id: 3, username: 'late', avatar: null }).success, true);
  const p = room.players.find(p => p.userId === 3)!;
  assert.ok(p.spawnShieldEndTime > Date.now());
  assert.equal(manager.checkBuildingWallCollision(p.x,p.y,22), false);
});
test('room options reject nonfinite and fractional capacities and durations', () => {
  for (const value of [NaN, Infinity, -Infinity, -100, 2.9, 1e100]) {
    const m = new BattleRoyaleManager(io);
    const r = m.createRoom({ id: 1, username: 'test', avatar: null }, { capacity: value, duration: value, mode: 'bogus' as any });
    assert.ok(Number.isInteger(r.capacity) && r.capacity >= 2 && r.capacity <= 20);
    assert.ok(Number.isFinite(r.duration) && r.duration >= 30 && r.duration <= 3600);
    assert.equal(r.mode, 'deathmatch');
  }
});
test('weapon cycling and same-slot switch preserve a reload', () => {
  const { manager, room, player } = fixture(); room.status='playing';
  player.weapons=['pistol','rifle','shotgun']; player.activeWeaponSlot=0; player.activeWeapon='pistol';
  manager.processPlayerInput(room.id,1,{switchWeapon:'prev'});
  assert.equal(player.activeWeaponSlot,2);
  player.ammo.shotgun=0; player.reserveAmmo.shotgun=10;
  manager.processPlayerInput(room.id,1,{reload:true}); const end=player.reloadEndTime;
  manager.processPlayerInput(room.id,1,{switchWeapon:2});
  assert.equal(player.isReloading,true); assert.equal(player.reloadEndTime,end);
});
test('server stops stale movement/shooting when input packets stop', () => {
  const { manager, room, player }=fixture(); room.status='playing';
  player.x=200;player.y=200; player.vx=1;player.shooting=true;player.lastInputTime=Date.now()-2000;
  (manager as any).updatePlayersAndBots(room,Date.now());
  assert.equal(player.vx,0); assert.equal(player.shooting,false);
});
test('segment circle raycast finds entry surface, not circle center', () => {
  const result=rayIntersectsCircle(0,0,100,0,50,0,10);
  assert.equal(result.hit,true); assert.ok(Math.abs(result.t-0.4)<1e-9); assert.ok(Math.abs(result.x-40)<1e-9);
});
test('safe spawn avoids rocks, crates and barrels', () => {
  const {manager,room}=fixture();
  (manager as any).generateMapEntities(room);
  for(let i=0;i<300;i++) {
    const p=(manager as any).findSafeSpawn(room);
    assert.equal(manager.checkBuildingWallCollision(p.x,p.y,32),false);
    assert.equal(manager.checkObstacleCollision(room,p.x,p.y,32),false);
    assert.ok(room.crates.every(c=>Math.hypot(c.x-p.x,c.y-p.y)>56));
    assert.ok(room.barrels.every(b=>Math.hypot(b.x-p.x,b.y-p.y)>b.radius+32));
  }
});
let seed=0xabc123;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// 3,000 reproducible generated geometry scenarios with independent analytic expectations.
for(let i=0;i<3000;i++) test(`geometry seed ${i}`,()=>{
  const cx=100+random()*1000,cy=random()*1000,r=1+random()*50;
  const hit=rayIntersectsCircle(cx-2*r,cy,cx+2*r,cy,cx,cy,r);
  assert.equal(hit.hit,true);assert.ok(Math.abs(hit.t-.25)<1e-8);
  const miss=rayIntersectsCircle(cx-2*r,cy+r+1,cx+2*r,cy+r+1,cx,cy,r);
  assert.equal(miss.hit,false);
  const rect=rayIntersectsRect(cx-2*r,cy,cx+2*r,cy,cx-r,cy-r,2*r,2*r);
  assert.equal(rect.hit,true);assert.ok(Math.abs(rect.t-.25)<1e-8);
});
// 2,000 authoritative input scenarios across PC/mobile/tablet.
for(let i=0;i<2000;i++) test(`input invariant ${i}`,()=>{
  const {manager,room,player}=fixture();room.status='playing';player.x=100;player.y=100;
  const vx=(random()-.5)*2000,vy=(random()-.5)*2000;
  manager.processPlayerInput(room.id,1,{vx,vy,angle:i%2?Infinity:random()*1e20,platform:['pc','mobile','tablet'][i%3]});
  const x=player.x,y=player.y;
  (manager as any).updatePlayersAndBots(room,Date.now());
  assert.ok(Number.isFinite(player.x)&&Number.isFinite(player.y)&&Number.isFinite(player.angle));
  assert.ok(Math.hypot(player.x-x,player.y-y)<=4.80001);
  assert.ok(player.x>=30&&player.x<=MAP_SIZE-30);
  player.isAlive=false;player.hp=0;
  manager.processPlayerInput(room.id,1,{shooting:true,pickup:true,vx:1,vy:1});
  assert.equal(player.shooting,false);assert.equal(player.vx,0);
});
test('all weapon reloads conserve ammunition',()=>{
  for(const [weapon,cfg] of Object.entries(WEAPON_CONFIGS)) {
    if(weapon==='fists')continue;
    const {manager,room,player}=fixture();room.status='playing';player.weapons=[weapon];player.activeWeapon=weapon;
    player.ammo[weapon]=0;player.reserveAmmo[weapon]=cfg.magSize*2;
    manager.processPlayerInput(room.id,1,{reload:true});
    const total=player.ammo[weapon]+player.reserveAmmo[weapon];
    (manager as any).updatePlayersAndBots(room,player.reloadEndTime+1);
    assert.equal(player.ammo[weapon]+player.reserveAmmo[weapon],total);
    assert.equal(player.ammo[weapon],cfg.magSize);
  }
});
test('every map wall blocks a crossing ray',()=>{
  for(const b of MAP_BUILDINGS)for(const w of b.walls){
    const x=w.x+w.w/2,y=w.y+w.h/2;
    const hit=checkRaycastWalls(x-w.w-10,y,x+w.w+10,y,[b]);
    assert.equal(hit.hit,true);
  }
});
test('headless and chaos suites finish without leaking rooms',()=>{
  const manager=new BattleRoyaleManager(io);
  const first=runHeadlessBattleRoyaleTest(manager,5000);
  assert.equal(first.success,true,JSON.stringify(first.errors));
  const chaos=runBattleRoyaleChaosSimulation(manager,20);
  assert.equal(chaos.success,true,JSON.stringify(chaos.errors));
  assert.equal(manager.rooms.size,0);
});

test('single plasma impact does not apply damage twice',()=>{
 const {manager,room,player}=fixture();room.status='playing';player.x=200;player.y=100;player.shield=0;
 const shooter=room.players[1];shooter.x=100;shooter.y=100;
 room.bullets=[{id:'plasma',shooterId:shooter.id,weaponType:'plasma',x:175,y:100,vx:14,vy:0,damage:90,color:'#fff',radius:7,isAoE:true,aoeRadius:130,distanceTraveled:0,maxRange:1100}];
 (manager as any).updateBullets(room,Date.now());
 assert.equal(player.hp,10);assert.equal(player.isAlive,true);assert.equal(room.bullets.length,0);
});
test('repeated lethal damage records one death; suicide awards no kill',()=>{
 const {manager,room,player}=fixture();room.status='playing';
 (manager as any).eliminatePlayer(room,player,player.id);
 (manager as any).eliminatePlayer(room,player,player.id);
 assert.equal(player.deaths,1);assert.equal(player.kills,0);
});
test('picking an already-owned gun never duplicates slots or exceeds magazine size',()=>{
 const {manager,room,player}=fixture();room.status='playing';player.weapons=['pistol','rifle'];player.activeWeapon='rifle';player.activeWeaponSlot=1;
 room.loot=[{id:'duplicate',type:'weapon_pistol',x:player.x,y:player.y,currentAmmo:100000}];
 manager.processPlayerInput(room.id,1,{pickup:true,swapWeapon:true});
 assert.equal(new Set(player.weapons).size,player.weapons.length);assert.equal(player.ammo.pistol,WEAPON_CONFIGS.pistol.magSize);
 assert.equal(player.weapons[player.activeWeaponSlot],player.activeWeapon);assert.equal(room.lootLocks!.size,0);
});
test('declined pickups release locks and do not swap a full inventory',()=>{
 const {manager,room,player}=fixture();room.status='playing';player.weapons=['pistol','rifle'];
 room.loot=[{id:'declined',type:'weapon_sniper',x:player.x,y:player.y}];
 manager.processPlayerInput(room.id,1,{pickup:true});assert.equal(room.loot.length,1);assert.equal(room.lootLocks!.size,0);
});
test('royale late arrivals spectate and cannot inject a respawn',()=>{
 const {manager,room}=fixture('royale');room.status='playing';
 manager.joinRoom(room.id,{id:3,username:'late',avatar:null});
 const player=room.players.find(p=>p.userId===3)!;
 assert.equal(player.isAlive,false);assert.equal(player.spectating,true);assert.equal(manager.requestRespawn(room.id,3),false);
});
test('game end cancels timers and records every human once, including losers',async()=>{
 const writes:any[]=[];
 const manager=new BattleRoyaleManager(io,{execute:async(q:any)=>{writes.push(q);return {};}} as any);
 const room=manager.createRoom({id:1,username:'host',avatar:null},{mode:'deathmatch'});
 manager.joinRoom(room.id,{id:2,username:'loser',avatar:null});room.players[0].kills=3;room.players[1].kills=1;room.status='playing';
 const timer=setInterval(()=>{},1000);room.gameLoopInterval=timer;
 try {
 (manager as any).endDeathmatch(room);(manager as any).endDeathmatch(room);await Promise.resolve();
 assert.equal(writes.length,2);assert.deepEqual(writes.map(q=>q.args),[[1,3,1],[0,1,2]]);
 assert.equal((timer as any)._destroyed,true);
 }finally{clearInterval(timer);}
});
test('zone shrinks within map and damages players outside it',()=>{
 const {manager,room,player}=fixture('royale');room.status='playing';player.x=40;player.y=40;
 room.zone.currentRadius=100;room.zone.currentX=2000;room.zone.currentY=2000;
 const hp=player.hp;(manager as any).updateZone(room);assert.ok(player.hp<hp);
 for(let i=0;i<8000;i++)(manager as any).updateZone(room);
 assert.ok(room.zone.currentRadius>0&&room.zone.currentRadius<=100);
 assert.ok(Number.isFinite(room.zone.currentX)&&Number.isFinite(room.zone.currentY));
});
test('damage is absorbed by shields before HP and spawn protection blocks hits',()=>{
 const {manager,room,player}=fixture();room.status='playing';player.shield=25;
 (manager as any).applyDamageToPlayer(room,player,40,room.players[1].id,'pistol');assert.equal(player.shield,0);assert.equal(player.hp,85);
 player.spawnShieldEndTime=Date.now()+1000;(manager as any).applyDamageToPlayer(room,player,90,'x','sniper');assert.equal(player.hp,85);
});
test('real authoritative ticks handle seeded loss, jitter and out-of-order bursts for 10 clients',()=>{
 const originalNow=Date.now,originalRandom=Math.random;let now=2_000_000_000_000,seed=123456;
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 Date.now=()=>now;Math.random=rng;
 const {manager,room}=fixture();
 try{
 for(let id=3;id<=10;id++)manager.joinRoom(room.id,{id,username:'stress'+id,avatar:null,platform:['pc','mobile','tablet'][id%3] as any});
 (manager as any).generateMapEntities(room);room.status='playing';
 room.players.forEach(p=>{const pos=(manager as any).findSafeSpawn(room);p.x=pos.x;p.y=pos.y;});
 let sent=0,dropped=0,delivered=0,reordered=0,lastDelivered=-1;
 const queue:Array<{id:number,userId:number,at:number,payload:any}>=[];
 for(let tick=0;tick<6000;tick++){
 now+=1000/30;
 for(const player of room.players){
 const id=sent++;if(rng()<.15){dropped++;continue;}
 queue.push({id,userId:player.userId,at:now+20+rng()*780,payload:{vx:rng()*2-1,vy:rng()*2-1,angle:rng()*Math.PI*2,shooting:rng()<.3,pickup:rng()<.02,reload:rng()<.01}});
 }
 queue.sort((a,b)=>a.at-b.at);
 while(queue.length&&queue[0].at<=now){const p=queue.shift()!;if(p.id<lastDelivered)reordered++;lastDelivered=p.id;manager.processPlayerInput(room.id,p.userId,p.payload);delivered++;}
 (manager as any).tickGame(room);
 for(const p of room.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.hp>=0&&p.hp<=100);assert.ok(p.shield>=0&&p.shield<=100);assert.equal(new Set(p.weapons).size,p.weapons.length);}
 assert.ok(room.bullets.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y)));
 }
 assert.ok(sent>=60000);assert.ok(dropped>8000&&delivered>45000);assert.ok(reordered>0);assert.ok(room.positionHistory===undefined || room.positionHistory.size<=10);
 }finally{for(const id of manager.rooms.keys())manager.destroyRoom(id);Date.now=originalNow;Math.random=originalRandom;}
});

test('projectiles hit the nearest target, regardless of player array order',()=>{
 const {manager,room,player}=fixture();room.status='playing';
 const farther=room.players[1];farther.x=160;farther.y=100;
 manager.joinRoom(room.id,{id:3,username:'nearer',avatar:null});
 const nearer=room.players[2];nearer.x=130;nearer.y=100;nearer.spawnShieldEndTime=0;player.x=50;player.y=100;
 room.bullets=[{id:'nearest',shooterId:player.id,weaponType:'sniper',x:100,y:100,vx:38,vy:0,damage:70,color:'#fff',radius:4.5,distanceTraveled:0,maxRange:1500}];
 (manager as any).updateBullets(room,Date.now());
 assert.equal(nearer.hp,30);assert.equal(farther.hp,100);
});
test('an earlier player collision takes priority over a later crate collision',()=>{
 const {manager,room,player}=fixture();room.status='playing';player.x=130;player.y=100;
 const shooter=room.players[1];shooter.x=50;shooter.y=100;
 room.crates=[{id:'far',x:160,y:100,hp:100,maxHp:100,lootType:'medkit'} as any];
 room.bullets=[{id:'nearest',shooterId:shooter.id,weaponType:'sniper',x:100,y:100,vx:38,vy:0,damage:70,color:'#fff',radius:4.5,distanceTraveled:0,maxRange:1500}];
 (manager as any).updateBullets(room,Date.now());assert.equal(player.hp,30);assert.equal(room.crates[0].hp,100);
});

test('departing players release lag-compensation history',()=>{
 const {manager,room,player}=fixture();room.status='playing';
 (manager as any).recordPositionHistory(room,Date.now());assert.equal(room.positionHistory?.size,2);
 manager.leaveRoom(room.id,player.userId);assert.equal(room.positionHistory?.size,1);
});
test('new players cannot bypass ready checks by joining during countdown',()=>{
 const {manager,room}=fixture();room.status='countdown';
 assert.equal(manager.joinRoom(room.id,{id:3,username:'late',avatar:null}).success,false);
 assert.equal(manager.joinRoom(room.id,{id:1,username:'host',avatar:null}).success,true);
});
test('a solo royale round ends when nobody is alive',()=>{
 const manager=new BattleRoyaleManager(io),room=manager.createRoom({id:1,username:'solo',avatar:null},{mode:'royale'});
 room.status='playing';room.players[0].isAlive=false;room.players[0].hp=0;(manager as any).tickGame(room);
 assert.equal(room.status,'gameover');assert.equal(room.winner,null);
});
