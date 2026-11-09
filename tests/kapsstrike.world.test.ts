import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../src/games/kapsstrike/maps';
import {createWorld,advanceWorld,claimSupply,dropInventory,DROP_INTERVAL,DROP_WARNING,supplyLocations} from '../src/games/kapsstrike/world';
import {createTraining,simulate,takeDamage} from '../src/games/kapsstrike/combat';
import {ownsWeapon,PHYSICS as C,WEAPONS} from '../src/games/kapsstrike/config';
import {fits} from '../src/games/kapsstrike/physics';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
// Supply crates are the Kill Race ruleset; the tactical map uses round purchases.
for(const map of Object.values(MAPS).filter(map=>map.id!=='district')){
 test(`${map.id}: compact routes, 100 seeded supplies and reachable warning/landing cycles`,()=>{
  assert.ok(map.bounds<=36);assert.ok(supplyLocations(map).length>15);
  for(let seed=0;seed<100;seed++){
   const world=createWorld(map,seed);assert.equal(world.pickups.length,8);assert.equal(new Set(world.pickups.map(s=>s.position.x+','+s.position.z)).size,8);
   for(const p of world.pickups)assert.ok(fits(map,p.position,C.standing));
   advanceWorld(world,map,DROP_INTERVAL-DROP_WARNING-1);assert.equal(world.drop,undefined);
   advanceWorld(world,map,DROP_INTERVAL-DROP_WARNING);assert.ok(world.drop);assert.ok(world.pickups.every(p=>Math.hypot(p.position.x-world.drop!.position.x,p.position.z-world.drop!.position.z)>3.5));assert.ok(fits(map,structuredClone(world).drop!.position,C.standing));
   advanceWorld(world,map,DROP_INTERVAL-1);assert.equal(world.pickups.length,8);
   advanceWorld(world,map,DROP_INTERVAL);assert.equal(world.pickups.length,9);assert.ok(['railgun','carbine','lmg'].includes(world.pickups.at(-1)!.weapon));assert.equal(world.nextDrop,DROP_INTERVAL*2);
  }
 });
 test(`${map.id}: claim once, reject distant/dead/obstructed claims; death drops special weapon`,()=>{
  const state=createTraining(map.id),world=state.world!,supply=world.pickups.find(p=>!p.consumable)!,p=state.player;
  p.movement.position={x:0,y:40,z:0};assert.equal(claimSupply(world,map,p,20),false);
  p.movement.position={...supply.position};p.hp=0;assert.equal(claimSupply(world,map,p,20),false);p.hp=100;
  assert.equal(claimSupply(world,map,p,20),true);assert.equal(ownsWeapon(p.weapon,supply.weapon),true);assert.equal(p.weapon.ammo[supply.weapon],WEAPONS[supply.weapon].capacity);assert.equal(claimSupply(world,map,p,21),false);
  dropInventory(world,p,22);assert.equal(ownsWeapon(p.weapon,supply.weapon),false);assert.equal(p.weapon.selected,'rifle');assert.equal(world.pickups.at(-1)?.kind,'dropped');
  assert.equal(claimSupply(world,map,p,23),true);
  // A temporary solid isolates the same supplied item from the player.
  const other=world.pickups[1];world.pickups=[other];p.movement.position={...other.position,x:other.position.x-2};
  map.solids.push({id:'supply-test-wall',kind:'box',x:other.position.x-1,y:other.position.y,z:other.position.z,w:.3,h:3,d:4,color:'#fff'});
  try{assert.equal(claimSupply(world,map,p,24),false);}finally{map.solids.pop();}
 });
}
test('training input cannot select locked weapons; supply inventory resets on death and respawn',()=>{
 const s=createTraining('dust');const cmd=(extra:any={})=>({sequence:s.lastSequence+1,tick:s.tick,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false,...extra});
 simulate(s,cmd({weapon:'railgun'}));assert.equal(s.player.weapon.selected,'rifle');
 s.player.movement.position={...s.world!.pickups.find(p=>!p.consumable&&p.weapon==='carbine')!.position};simulate(s,cmd({interact:true}));assert.equal(s.player.weapon.selected,'carbine');
 s.player.protectedUntil=0;takeDamage(s,100,{x:0,y:0,z:0});assert.ok(s.world!.pickups.some(p=>p.kind==='dropped'));assert.deepEqual(s.player.weapon.inventory,[]);
 for(let i=0;i<=C.respawnTicks;i++)simulate(s,cmd());assert.equal(s.player.hp,100);assert.equal(s.player.pitch,0);assert.equal(s.player.yaw,0);assert.equal(s.player.weapon.selected,'rifle');
});
test('authoritative supply ownership, malformed interact, snapshots and respawn reset',()=>{
 const io:any={emit(){},to(){return {emit(){}}}};const manager=new KapsStrikeServerManager(io);
 const room=manager.createRoom({id:1,username:'world',avatar:null},'world-1',{map:'dust'});manager.startGame('world-1');manager.stopRoomSimulationLoop(room);
 const player=room.players.get('world-1')!;
 const cmd=(sequence:number,extra:any={})=>({sequence,tick:room.tick,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false,...extra});
 manager.processPlayerInput(player.id,cmd(1,{weapon:'railgun'}));manager.tickSimulation(room);assert.equal(player.state.weapon.selected,'rifle');
 manager.processPlayerInput(player.id,cmd(2,{interact:'yes'}));assert.equal(player.inputQueue.length,0);
 player.state.movement.position={...room.world.pickups.find(p=>!p.consumable&&p.weapon==='carbine')!.position};manager.processPlayerInput(player.id,cmd(3,{interact:true}));manager.tickSimulation(room);assert.equal(player.state.weapon.selected,'carbine');
 assert.equal(JSON.stringify(room.getSnapshotForPlayer(player.id).world),JSON.stringify(room.world));
 dropInventory(room.world,player.state,room.tick);player.state.hp=0;player.state.deadUntil=room.tick+1;player.state.yaw=2;player.state.pitch=1;
 manager.tickSimulation(room);assert.equal(player.state.hp,100);assert.equal(player.state.yaw,0);assert.equal(player.state.pitch,0);assert.equal(player.state.weapon.triggerHeld,false);
 player.heldInput=cmd(20,{moveZ:1});player.lastInputTick=9000;
 assert.equal(manager.returnToLobby(player.id),true);manager.startGame(player.id);manager.stopRoomSimulationLoop(room);
 assert.equal(player.heldInput,undefined);assert.equal(player.lastInputTick,0);
 manager.leaveRoom(player.id,1);
});

for(const map of Object.values(MAPS).filter(m=>m.id!=='district')){
 test(`${map.id}: weapon, health and armor replenish once after ten seconds at different reachable route points`,()=>{
  const state=createTraining(map.id),world=createWorld(map,145),p=state.player;
  world.nextDrop=Number.MAX_SAFE_INTEGER;
  for(let cycle=0;cycle<20;cycle++){
   const active=world.pickups.filter(s=>!s.opened&&s.kind==='chest');
   const collected=active.map(s=>({id:s.id,position:{...s.position}}));
   const tick=cycle*(Math.round(10/C.dt)+1);
   for(const s of active){p.movement.position={...s.position};p.hp=25;p.armor=0;assert.equal(claimSupply(world,map,p,tick),true);assert.equal(claimSupply(world,map,p,tick),false);}
   const queued=world.respawns!.length;assert.equal(queued,active.length);
   advanceWorld(world,map,tick+Math.round(10/C.dt)-1);
   assert.equal(world.respawns!.length,queued);
   const previous=world.respawns!.map(job=>({...job.pickup.position})),serial=world.serial;
   advanceWorld(world,map,tick+Math.round(10/C.dt));
   assert.equal(world.respawns!.length,0);
   const replacements=world.pickups.filter(s=>s.id.startsWith('supply-')&&Number(s.id.split('-')[1])>serial);
   assert.equal(replacements.length,previous.length);
   replacements.forEach((s,i)=>assert.ok(Math.hypot(s.position.x-previous[i].x,s.position.z-previous[i].z)>4));
   const fresh=world.pickups.filter(s=>!s.opened&&s.id.startsWith('supply-'));
   for(const s of fresh){assert.ok(fits(map,s.position,C.standing));assert.ok(supplyLocations(map).some(q=>Math.hypot(q.x-s.position.x,q.z-s.position.z)<.01));}
   assert.ok(collected.every(old=>!fresh.some(s=>s.id===old.id)));
   advanceWorld(world,map,tick+Math.round(10/C.dt));assert.equal(world.respawns!.length,0);
  }
 });
}
