import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../src/games/kapsstrike/maps';
import {PHYSICS as C,WEAPONS,WEAPON_ORDER} from '../src/games/kapsstrike/config';
import {collisionSolids,nearbyCollisionSolids,fits,support,overlaps,surface,clamp} from '../src/games/kapsstrike/physics';
import {createTraining,simulate} from '../src/games/kapsstrike/combat';
import {advanceReload} from '../src/games/kapsstrike/reload';
import {COSMETICS,CASES,caseRewards,rollCase} from '../src/games/kapsstrike/cosmetics';
import {caseCost} from '../src/games/kapsstrike/economy';
import {finishTextureUrl} from '../src/games/kapsstrike/finishAppearance';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
import type {InputCommand,Vec3,MapDefinition} from '../src/games/kapsstrike/types';
const command=(tick:number,sequence:number):InputCommand=>({tick,sequence,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false});
function referenceFits(map:MapDefinition,p:Vec3,height:number){return !collisionSolids(map).some(s=>{
 if(s.kind==='ramp')return overlaps(s,p)&&p.y+height>s.y+.001&&p.y<surface(s,p.x,p.z)-.001;
 const dx=p.x-clamp(p.x,s.x-s.w/2,s.x+s.w/2),dz=p.z-clamp(p.z,s.z-s.d/2,s.z+s.d/2),low=p.y+C.radius,high=p.y+height-C.radius,dy=low>s.y+s.h?low-s.y-s.h:high<s.y?s.y-high:0;
 return dx*dx+dy*dy+dz*dz<C.radius*C.radius-1e-6;
});}
for(const map of Object.values(MAPS))test(`${map.id}: broad phase preserves exact capsule and ramp results`,()=>{
 let seed=37;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 const points=[...map.spawns,...collisionSolids(map).flatMap(s=>[{x:s.x+s.w/2+C.radius-1e-5,y:s.y,z:s.z},{x:s.x,y:s.y+s.h,z:s.z}]),...Array.from({length:5000},()=>({x:(random()*2-1)*map.bounds,y:random()*12,z:(random()*2-1)*map.bounds}))];
 for(const p of points){for(const h of [C.standing,C.crouching])assert.equal(fits(map,p,h),referenceFits(map,p,h));let y=0;for(const s of collisionSolids(map)){const top=surface(s,p.x,p.z);if(overlaps(s,p)&&top<=p.y+C.step+.001)y=Math.max(y,top);}assert.equal(support(map,p,p.y+C.step),y);}
 assert.ok(nearbyCollisionSolids(map,map.spawns[0]).length<collisionSolids(map).length);
});
test('spatial cache refreshes when authored source or length changes',()=>{const map:MapDefinition={...MAPS.warehouse,solids:[]};const p={x:0,y:0,z:0};assert.ok(fits(map,p,C.standing));map.solids.push({...MAPS.warehouse.solids.find(s=>!s.detail)!,x:0,y:0,z:0,w:4,h:4,d:4});assert.equal(fits(map,p,C.standing),false);map.solids=[];assert.ok(fits(map,p,C.standing));});
for(const weapon of WEAPON_ORDER.filter(w=>w!=='knife'))test(`${weapon}: auto reload is timed once, finishes and respects equip/freeze`,()=>{
 const w=createTraining('warehouse').player.weapon;w.selected=weapon;w.ammo[weapon]=0;
 assert.ok(advanceReload(w,100,false));const end=w.reloadUntil;assert.equal(end,100+Math.ceil(WEAPONS[weapon].reload/C.dt));assert.equal(advanceReload(w,end-1,true),false);assert.equal(w.ammo[weapon],0);assert.equal(advanceReload(w,end,false),false);assert.equal(w.ammo[weapon],WEAPONS[weapon].capacity);
 w.ammo[weapon]=0;w.switchUntil=end+24;assert.equal(advanceReload(w,end,false),false);assert.equal(advanceReload(w,end+24,false,false),false);assert.ok(advanceReload(w,end+24,false));
});
test('empty knife never reloads; partial magazines remain manual',()=>{const w=createTraining('warehouse').player.weapon;w.selected='knife';w.ammo.knife=0;assert.equal(advanceReload(w,1,true),false);w.selected='rifle';w.ammo.rifle=2;assert.equal(advanceReload(w,1,false),false);assert.ok(advanceReload(w,1,true));});
test('client and authoritative server start empty reload without a new fire input',()=>{
 const manager=new KapsStrikeServerManager({to:()=>({emit(){}}),emit(){}} as any);const room=manager.createRoom({id:1,username:'one',avatar:null},'one',{map:'warehouse',mode:'ffa'});room.status='in_progress';const p=room.players.get('one')!;p.state.weapon.ammo.rifle=0;
 const local=createTraining('warehouse');local.player.weapon.ammo.rifle=0;simulate(local,command(0,1),false);manager.tickSimulation(room);
 assert.equal(p.state.weapon.reloadUntil,local.player.weapon.reloadUntil);assert.equal(room.events.filter(e=>e.kind==='reload').length,1);
 for(let i=0;i<5;i++)manager.tickSimulation(room);assert.equal(room.events.filter(e=>e.kind==='reload').length,1);
});
test('shared broadcast is detached from live motion and private states remain per recipient',()=>{
 const manager=new KapsStrikeServerManager({to:()=>({emit(){}}),emit(){}} as any);const room=manager.createRoom({id:1,username:'one',avatar:null},'one',{map:'warehouse',mode:'tdm'});manager.joinRoom(room.roomCode,{id:2,username:'two',avatar:null},'two');const frame=room.buildSharedSnapshotBase();const a=room.getSnapshotForPlayer('one',frame),b=room.getSnapshotForPlayer('two',frame);assert.equal(a.players,b.players);assert.equal(a.world,b.world);assert.notEqual(a.localState,b.localState);assert.equal(a.localState?.id,'one');assert.equal(b.localState?.id,'two');const x=a.players[0].position.x;room.players.get('one')!.state.movement.position.x+=3;assert.equal(a.players[0].position.x,x);
});
test('144 distinct new finishes cover every firearm/blade and all nine cases remain purchasable',()=>{
 const items=COSMETICS.filter(c=>c.id.includes('-prism-'));assert.equal(items.length,144);assert.equal(COSMETICS.length,267);assert.equal(new Set(COSMETICS.map(c=>c.id)).size,COSMETICS.length);assert.equal(new Set(items.map(finishTextureUrl)).size,144);
 for(const weapon of WEAPON_ORDER.filter(w=>w!=='knife'))assert.equal(items.filter(c=>c.weapon===weapon).length,12);
 for(const knife of ['default','tanto','karambit','butterfly'])assert.equal(items.filter(c=>c.knife===knife).length,12);
 assert.equal(CASES.length,9);const available=new Set<string>();for(const box of CASES){assert.equal(caseCost(box.id),0);assert.ok(caseCost(box.id,{[box.id]:true})>0);const pool=caseRewards(box.id);assert.ok(Math.abs(pool.reduce((s,p)=>s+p.chance,0)-100)<1e-8);for(const p of pool)available.add(p.item.id);for(const r of [0,.399999,.4,.699999,.7,.899999,.9,.949999,.95,.999999])assert.ok(rollCase(box.id,r));}
 assert.ok(items.every(c=>available.has(c.id)));
});

test('last-round prediction never rewrites the firing packet into an early manual reload',()=>{
 const manager=new KapsStrikeServerManager({to:()=>({emit(){}}),emit(){}} as any);const room=manager.createRoom({id:1,username:'one',avatar:null},'one',{map:'warehouse',mode:'ffa'});room.status='in_progress';const p=room.players.get('one')!;p.state.weapon.ammo.rifle=1;
 const local=createTraining('warehouse');local.player.weapon.ammo.rifle=1;const cmd={...command(0,1),fire:true};assert.ok(simulate(local,cmd,false));assert.equal(cmd.reload,false);assert.equal(local.player.weapon.ammo.rifle,0);assert.ok(local.player.weapon.reloadUntil>0);
 manager.processPlayerInput('one',{...cmd,shot:local.player.weapon.shotIndex});manager.tickSimulation(room);assert.equal(p.state.weapon.shotIndex,1);assert.equal(p.state.weapon.ammo.rifle,0);assert.equal(p.state.weapon.reloadUntil,local.player.weapon.reloadUntil);
});
