import test from 'node:test';import assert from 'node:assert/strict';
import {createBombMatch,buyBombEquipment,refundBombEquipment} from '../src/games/kapsstrike/bomb';
import {dropBombWeapon,pickupBombWeapon} from '../src/games/kapsstrike/bombWeapons';
import {createTraining} from '../src/games/kapsstrike/combat';import {MAPS} from '../src/games/kapsstrike/maps';import {newMovement} from '../src/games/kapsstrike/physics';
function setup(){const state=createTraining('district');const p=state.player;p.id='p';const map=MAPS.district;p.movement=newMovement(map.spawns[0]);const m=createBombMatch([{id:'p',team:'T',position:p.movement.position},{id:'q',team:'CT',position:map.spawns[5]}],0);p.weapon.inventory=['pistol','knife'];p.weapon.selected='pistol';state.world!.pickups=[];return {p,m,w:state.world!,map};}
test('drop and pick up preserve ammo, single ownership and cannot refund a dropped purchase',()=>{const {p,m,w,map}=setup();m.players.p.money=5000;assert.ok(buyBombEquipment(m,'p','rifle',1));p.weapon.selected='rifle';p.weapon.ammo.rifle=7;assert.ok(dropBombWeapon(m,w,p,1));assert.equal(p.weapon.selected,'pistol');assert.deepEqual(m.players.p.weapons,['pistol','knife']);assert.equal(m.players.p.purchase,undefined);assert.equal(dropBombWeapon(m,w,p,2),false);assert.equal(w.pickups.length,1);assert.ok(pickupBombWeapon(m,w,map,p,2));assert.equal(p.weapon.ammo.rifle,7);assert.deepEqual(m.players.p.weapons,['pistol','knife','rifle']);assert.equal(pickupBombWeapon(m,w,map,p,3),false);assert.equal(m.players.p.money,2300);});
test('pickup swaps existing firearm and rejects distant, dead and frozen players',()=>{const {p,m,w,map}=setup();w.pickups.push({id:'test',position:{...p.movement.position},weapon:'sniper',ammo:2,kind:'dropped',opened:false,expires:999});assert.ok(pickupBombWeapon(m,w,map,p,1));assert.deepEqual(m.players.p.weapons,['pistol','knife','sniper']);assert.equal(w.pickups.filter(x=>!x.opened).length,0);p.hp=0;assert.equal(dropBombWeapon(m,w,p,2),false);p.hp=100;m.phase='result';assert.equal(pickupBombWeapon(m,w,map,p,3),false);assert.equal(dropBombWeapon(m,w,p,3),false);m.phase='active';p.movement.position.x+=10;assert.equal(pickupBombWeapon(m,w,map,p,4),false);});
test('authoritative server consumes interact to take a drop, and resets drops at round transition',async()=>{const {KapsStrikeServerManager}=await import('../src/server/kapsstrikeServer');const io:any={to:()=>({emit(){}}),emit(){}};const server=new KapsStrikeServerManager(io);const room=server.createRoom({id:1,username:'a',avatar:null},'a',{mode:'bomb'});server.joinRoom(room.roomCode,{id:2,username:'b',avatar:null},'b');server.setReady('b',true);server.startGame('a');server.stopRoomSimulationLoop(room);server.tickSimulation(room);const p=room.players.get('a')!;const bomb=room.bomb!;bomb.phase='active';bomb.deadline=1000;room.world.pickups.push({id:'test',position:{...p.state.movement.position},weapon:'sniper',ammo:2,kind:'dropped',opened:false,expires:999});server.processPlayerInput('a',{sequence:1,tick:room.tick,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false,interact:true});server.tickSimulation(room);assert.equal(p.state.weapon.selected,'sniper');assert.equal(p.state.weapon.ammo.sniper,2);assert.deepEqual(bomb.players.a.weapons,['pistol','knife','sniper']);bomb.phase='result';bomb.scores.T=1;bomb.deadline=0;server.tickSimulation(room);assert.equal(room.world.pickups.length,0);assert.equal(p.state.weapon.selected,'sniper');assert.equal(bomb.players.a.purchase,undefined);});

test('only the current buy-phase firearm can be refunded once for its purchase price',()=>{
 const {p,m}=setup();
 const owner=m.players[p.id];
 owner.money=5000;
 assert.ok(buyBombEquipment(m,p.id,'rifle',1));
 assert.equal(refundBombEquipment(m,p.id,'pistol',2),false);
 assert.ok(refundBombEquipment(m,p.id,'rifle',2));
 assert.equal(owner.money,5000);
 assert.deepEqual(owner.weapons,['pistol','knife']);
 assert.equal(refundBombEquipment(m,p.id,'rifle',2),false);
 assert.ok(buyBombEquipment(m,p.id,'smg',3));
 assert.equal(refundBombEquipment(m,p.id,'smg',m.deadline),false);
});

test('armor and defuse kit refunds restore the previous loadout and cannot be repeated',()=>{
 const {m}=setup();
 const ct=m.players.q;
 ct.money=3000;ct.armor=17;
 assert.ok(buyBombEquipment(m,'q','halfArmor',1));
 assert.ok(buyBombEquipment(m,'q','armor',1));
 assert.ok(buyBombEquipment(m,'q','kit',1));
 assert.equal(refundBombEquipment(m,'q','halfArmor',2),false);
 assert.ok(refundBombEquipment(m,'q','armor',2));
 assert.equal(ct.armor,17);
 assert.ok(refundBombEquipment(m,'q','kit',2));
 assert.equal(ct.kit,false);
 assert.equal(ct.money,3000);
 assert.equal(refundBombEquipment(m,'q','kit',3),false);
 assert.equal(refundBombEquipment(m,'q','armor',3),false);
});

test('grenades can be bought alongside a rifle and refunded independently; armor prices match the shop',async()=>{
 const {BOMB_SHOP}=await import('../src/games/kapsstrike/bomb');
 assert.equal(BOMB_SHOP.halfArmor,650);
 assert.equal(BOMB_SHOP.armor,1200);
 const {m}=setup(),p=m.players.p;
 p.money=5000;
 assert.ok(buyBombEquipment(m,'p','rifle',1));
 for(const kind of ['flash','frag','smoke']){
  assert.ok(buyBombEquipment(m,'p',kind,1));
  assert.equal(buyBombEquipment(m,'p',kind,1),false);
  assert.ok(refundBombEquipment(m,'p',kind,2));
  assert.equal(refundBombEquipment(m,'p',kind,2),false);
 }
 assert.equal(p.money,2300);
 assert.deepEqual(p.weapons,['pistol','knife','rifle']);
});

test('grenade simulation separates short throws, cover, flash facing and smoke lifetime',async()=>{
 const {grenadeLaunch,grenadeEffect,stepGrenade}=await import('../src/games/kapsstrike/grenades');
 const open={...MAPS.district,solids:[]};
 const wall={...open,solids:[{id:'wall',kind:'box' as const,x:0,y:0,z:2,w:8,h:5,d:.3,color:'#888'}]};
 const origin={x:0,y:1.62,z:0},forward={x:0,y:0,z:1},target={x:0,y:1.62,z:4};
 const far=grenadeLaunch('a','smoke','p','T',origin,forward,0,false);
 const near=grenadeLaunch('b','smoke','p','T',origin,forward,0,true);
 for(let i=1;i<=150;i++)for(const g of [far,near])stepGrenade(g,open,1/120,i/120);
 assert.ok(far.position.z>near.position.z+5);
 assert.equal(far.expires,12.25);
 assert.equal(grenadeEffect('frag',wall,origin,target,forward),0);
 assert.ok(grenadeEffect('frag',open,origin,target,forward)>0);
 assert.ok(grenadeEffect('flash',open,origin,target,{...forward,z:-1})>grenadeEffect('flash',open,origin,target,forward));
});

test('late join balances TDM and queues a new bomb player until the next round',async()=>{
 const {KapsStrikeServerManager}=await import('../src/server/kapsstrikeServer');
 const user=(id:number)=>({id,username:String(id),avatar:null});
 for(const mode of ['ffa','tdm','bomb'] as const){
  const io:any={to:()=>({emit(){}}),emit(){}};
  const server=new KapsStrikeServerManager(io);
  const room=server.createRoom(user(1),'a',{mode,maxPlayers:6});
  server.joinRoom(room.roomCode,user(2),'b');server.setReady('b',true);
  assert.equal(server.startGame('a').success,true);
  server.stopRoomSimulationLoop(room);
  server.tickSimulation(room);
  const c=server.joinRoom(room.roomCode,user(3),'c');
  assert.ok(c.success);
  if(room.bomb){room.bomb.phase='active';room.bomb.deadline=100;}
  const d=server.joinRoom(room.roomCode,user(4),'d');
  assert.ok(d.success);
  const p=room.players.get('d')!;
  if(mode==='ffa')assert.equal(p.team,'none');
  else assert.notEqual(p.team,room.players.get('c')!.team);
  if(room.bomb){
   assert.equal(p.state.hp,0);
   assert.equal(room.bomb.players.d.alive,false);
   room.bomb.phase='result';room.bomb.deadline=0;
   server.tickSimulation(room);
   assert.equal(p.state.hp,100);
  }
 }
});
