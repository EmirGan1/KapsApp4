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
 test(`${map.id}: expanded map, 100 seeded supplies and reachable warning/landing cycles`,()=>{
  assert.ok(map.bounds>=64);assert.ok(supplyLocations(map).length>15);
  for(let seed=0;seed<100;seed++){
   const world=createWorld(map,seed);assert.equal(world.pickups.length,3);assert.equal(new Set(world.pickups.map(s=>s.position.x+','+s.position.z)).size,3);
   for(const p of world.pickups)assert.ok(fits(map,p.position,C.standing));
   advanceWorld(world,map,DROP_INTERVAL-DROP_WARNING-1);assert.equal(world.drop,undefined);
   advanceWorld(world,map,DROP_INTERVAL-DROP_WARNING);assert.ok(world.drop);assert.ok(fits(map,structuredClone(world).drop!.position,C.standing));
   advanceWorld(world,map,DROP_INTERVAL-1);assert.equal(world.pickups.length,3);
   advanceWorld(world,map,DROP_INTERVAL);assert.equal(world.pickups.length,4);assert.equal(world.pickups.at(-1)?.weapon,'railgun');assert.equal(world.nextDrop,DROP_INTERVAL*2);
  }
 });
 test(`${map.id}: claim once, reject distant/dead/obstructed claims; death drops special weapon`,()=>{
  const state=createTraining(map.id),world=state.world!,supply=world.pickups[0],p=state.player;
  p.movement.position={x:0,y:40,z:0};assert.equal(claimSupply(world,map,p,20),false);
  p.movement.position={...supply.position};p.hp=0;assert.equal(claimSupply(world,map,p,20),false);p.hp=100;
  assert.equal(claimSupply(world,map,p,20),true);assert.equal(ownsWeapon(p.weapon,supply.weapon),true);assert.equal(p.weapon.ammo[supply.weapon],WEAPONS[supply.weapon].capacity);assert.equal(claimSupply(world,map,p,21),false);
  dropInventory(world,p,22);assert.equal(ownsWeapon(p.weapon,supply.weapon),false);assert.equal(p.weapon.selected,'rifle');assert.equal(world.pickups.at(-1)?.kind,'dropped');
  assert.equal(claimSupply(world,map,p,23),true);
  // A temporary solid isolates the same supplied item from the player.
  const other=world.pickups[1];p.movement.position={...other.position,x:other.position.x-2};
  map.solids.push({id:'supply-test-wall',kind:'box',x:other.position.x-1,y:0,z:other.position.z,w:.3,h:3,d:4,color:'#fff'});
  try{assert.equal(claimSupply(world,map,p,24),false);}finally{map.solids.pop();}
 });
}
test('training input cannot select locked weapons; supply inventory resets on death and respawn',()=>{
 const s=createTraining('dust');const cmd=(extra:any={})=>({sequence:s.lastSequence+1,tick:s.tick,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false,...extra});
 simulate(s,cmd({weapon:'railgun'}));assert.equal(s.player.weapon.selected,'rifle');
 s.player.movement.position={...s.world!.pickups[0].position};simulate(s,cmd({interact:true}));assert.equal(s.player.weapon.selected,'carbine');
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
 player.state.movement.position={...room.world.pickups[0].position};manager.processPlayerInput(player.id,cmd(3,{interact:true}));manager.tickSimulation(room);assert.equal(player.state.weapon.selected,'carbine');
 assert.deepEqual(room.getSnapshotForPlayer(player.id).world,room.world);
 dropInventory(room.world,player.state,room.tick);player.state.hp=0;player.state.deadUntil=room.tick+1;player.state.yaw=2;player.state.pitch=1;
 manager.tickSimulation(room);assert.equal(player.state.hp,100);assert.equal(player.state.yaw,0);assert.equal(player.state.pitch,0);assert.equal(player.state.weapon.triggerHeld,false);
 player.heldInput=cmd(20,{moveZ:1});player.lastInputTick=9000;
 assert.equal(manager.returnToLobby(player.id),true);manager.startGame(player.id);manager.stopRoomSimulationLoop(room);
 assert.equal(player.heldInput,undefined);assert.equal(player.lastInputTick,0);
 manager.leaveRoom(player.id,1);
});
