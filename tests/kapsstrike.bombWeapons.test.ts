import test from 'node:test';import assert from 'node:assert/strict';
import {createBombMatch,buyBombEquipment,refundBombEquipment} from '../src/games/kapsstrike/bomb';
import {dropBombWeapon,pickupBombWeapon} from '../src/games/kapsstrike/bombWeapons';
import {createTraining} from '../src/games/kapsstrike/combat';import {MAPS} from '../src/games/kapsstrike/maps';import {newMovement} from '../src/games/kapsstrike/physics';
import type { MapDefinition } from "../src/games/kapsstrike/types";
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
 const stationary={x:0,y:0,z:0};
 const far=grenadeLaunch('a','smoke','p','T',origin,forward,0,false,stationary);
 const near=grenadeLaunch('b','smoke','p','T',origin,forward,0,true,stationary);
 for(let i=1;i<=150;i++)for(const g of [far,near])stepGrenade(g,open,1/120,i/120);
 assert.ok(far.position.z>near.position.z+5);
 assert.equal(far.expires,12.25);
 assert.equal(grenadeEffect('frag',wall,origin,target,forward),0);
 assert.ok(grenadeEffect('frag',open,origin,target,forward)>0);
 assert.ok(grenadeEffect('flash',open,origin,target,{...forward,z:-1})>grenadeEffect('flash',open,origin,target,forward));
});

test('full grenade throws gain range from aiming up, running forward and jumping', async () => {
 const { grenadeLaunch, stepGrenade } = await import('../src/games/kapsstrike/grenades');
 const { aimDirection } = await import('../src/games/kapsstrike/combat');
 const { PHYSICS } = await import('../src/games/kapsstrike/config');
 const open: MapDefinition = { ...MAPS.district, bounds: 100, solids: [] };
 const stationary = { x: 0, y: 0, z: 0 };
 const running = { ...stationary, z: PHYSICS.sprintSpeed };
 const jumping = { ...running, y: PHYSICS.jumpSpeed };
 const throwGrenade = (pitch: number, velocity: typeof stationary, short = false, map = open) => {
  const origin = { x: 0, y: short ? 0.65 : PHYSICS.eye, z: 0 };
  const grenade = grenadeLaunch('test', 'frag', 'p', 'T', origin, aimDirection(0, pitch), 0, short, velocity);
  let peak = origin.y;
  for (let tick = 1; tick <= 200 && grenade.expires === undefined; tick++) {
   stepGrenade(grenade, map, PHYSICS.dt, tick * PHYSICS.dt);
   peak = Math.max(peak, grenade.position.y);
  }
  return { position: grenade.position, peak };
 };
 const flat = throwGrenade(0, stationary);
 assert.ok(flat.position.z > 25);
 assert.ok(throwGrenade(-0.30, stationary).position.z > flat.position.z + 2);
 assert.ok(throwGrenade(0.50, stationary).position.z < flat.position.z);
 const run = throwGrenade(0, running);
 const jump = throwGrenade(0, jumping);
 assert.ok(run.position.z > flat.position.z + 5);
 assert.ok(jump.position.z > run.position.z + 3);
 assert.ok(jump.peak > run.peak + 2);

 const short = throwGrenade(1.48, jumping, true);
 assert.ok(short.position.z > 2 && short.position.z < 5);
 assert.ok(short.peak > 0.70 && short.peak < 1);
 assert.deepEqual(short, throwGrenade(-1.48, stationary, true));

 const wall = { ...open, solids: [
  { id: 'wall', kind: 'box' as const, x: 0, y: 0, z: 2, w: 10, h: 10, d: 0.15, color: '#888' },
 ] };
 assert.ok(throwGrenade(0, jumping, false, wall).position.z < 2);
});

test('frag and smoke wait for a landing after the fuse, while flash bursts midair', async () => {
 const { FRAG_BURST_DURATION, grenadeLaunch, stepGrenade } = await import('../src/games/kapsstrike/grenades');
 const map: MapDefinition = { ...MAPS.district, bounds: 100, solids: [
  { id: 'platform', kind: 'box', x: 0, y: 0, z: 0, w: 5, h: 2, d: 5, color: '#888' },
 ] };
 const still = { x: 0, y: 0, z: 0 };
 const dt = 1 / 120;
 for (const kind of ['frag', 'smoke', 'flash'] as const) {
  const grenade = grenadeLaunch('test', kind, 'p', 'T', { x: 0, y: 3.62, z: 0 },
   { x: 0, y: 1, z: 0 }, 0, false, still);
  let burstAt = 0;
  for (let tick = 1; tick <= 600; tick++) {
   if (stepGrenade(grenade, map, dt, tick * dt)) {
    burstAt = tick * dt;
    break;
   }
  }
  if (kind === 'flash') {
   assert.equal(burstAt, grenade.detonate);
   assert.ok(grenade.position.y > 3.62);
  } else {
   assert.ok(burstAt > grenade.detonate);
   assert.equal(grenade.position.y, 2.12);
   assert.equal(grenade.expires, burstAt + (kind === 'frag' ? FRAG_BURST_DURATION : 11));
   assert.equal(stepGrenade(grenade, map, dt, burstAt + dt), false);
  }
 }
});

test('frag damages beyond the previous radius but still respects walls and its new limit', async () => {
 const { FRAG_RADIUS, grenadeEffect } = await import('../src/games/kapsstrike/grenades');
 const open: MapDefinition = { ...MAPS.district, solids: [] };
 const wall: MapDefinition = { ...open, solids: [
  { id: 'wall', kind: 'box', x: 0, y: 0, z: 3, w: 5, h: 3, d: .2, color: '#888' },
 ] };
 const origin = { x: 0, y: .12, z: 0 };
 const facing = { x: 0, y: 0, z: -1 };
 const target = { x: 0, y: 1.62, z: 7 };
 assert.ok(grenadeEffect('frag', open, origin, target, facing) > 0);
 assert.equal(grenadeEffect('frag', wall, origin, target, facing), 0);
 assert.equal(grenadeEffect('frag', open, origin, { ...origin, z: FRAG_RADIUS }, facing), 0);
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
