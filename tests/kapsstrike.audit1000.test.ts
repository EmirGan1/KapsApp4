import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS} from '../src/games/kapsstrike/maps';
import {PHYSICS as C} from '../src/games/kapsstrike/config';
import {fits,support,newMovement,move} from '../src/games/kapsstrike/physics';
import {BOMB_RULES,BOMB_SHOP,BOMB_SITES,createBombMatch,stepBomb,bombInteract,buyBombEquipment} from '../src/games/kapsstrike/bomb';
import type {Vec3} from '../src/games/kapsstrike/types';
const map=MAPS.district;
const neutral={sequence:0,tick:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false};
const legs=[
 [{x:13,y:0,z:14.3},{x:13,y:3.2,z:24}],
 [{x:13,y:3.2,z:24},{x:13,y:3.2,z:27}],
 [{x:13,y:3.2,z:27},{x:21,y:3.2,z:27}],
 [{x:21,y:3.2,z:27},{x:21,y:3.2,z:36}],
 [{x:21,y:3.2,z:36},{x:30,y:3.2,z:36}],
] as const;
function match(offset=0){const a=BOMB_SITES[0];return createBombMatch([{id:'t',team:'T',position:{x:a.x,y:a.y,z:a.z}},{id:'ct',team:'CT',position:{x:a.x,y:a.y,z:a.z}}],offset);}
function plant(offset=0){const m=match(offset);stepBomb(m,offset+BOMB_RULES.buy);const now=offset+BOMB_RULES.buy+1;assert.ok(bombInteract(m,'t',true,now));m.players.t.holdUntil=now+BOMB_RULES.plant+1;stepBomb(m,now+BOMB_RULES.plant+.001);assert.equal(m.phase,'planted');return m;}
// 200 capsule/support samples at distinct longitudinal and lateral positions.
for(let i=0;i<200;i++)test('short clearance '+i,()=>{
 const leg=legs[i%5],fraction=(Math.floor(i/5)+.5)/40;
 const p:Vec3={x:leg[0].x+(leg[1].x-leg[0].x)*fraction,y:0,z:leg[0].z+(leg[1].z-leg[0].z)*fraction};
 const lateral=((i%4)-1.5)*.1;if(leg[0].x===leg[1].x)p.x+=lateral;else p.z+=lateral;
 p.y=support(map,p,3.25);assert.ok(fits(map,p,C.standing),JSON.stringify(p));
 if(i%5!==0)assert.ok(Math.abs(p.y-3.2)<.1,JSON.stringify(p));else assert.ok(p.y>=0&&p.y<=3.21);
});
// 5 legs, 20 lateral offsets, both directions: actual shared fixed-step movement.
for(let i=0;i<200;i++)test('short traversal '+i,()=>{
 const leg=legs[i%5],reverse=i>=100,offset=(Math.floor((i%100)/5)-9.5)*.015;
 const from:Vec3={...leg[reverse?1:0]},to:Vec3={...leg[reverse?0:1]};
 if(leg[0].x===leg[1].x){from.x+=offset;to.x+=offset;}else{from.z+=offset;to.z+=offset;}
 const m=newMovement(from);let reached=false;
 for(let tick=0;tick<1000;tick++){
  if(Math.hypot(to.x-m.position.x,to.z-m.position.z)<.23){reached=true;break;}
  move(m,{...neutral,tick,sequence:tick,moveZ:1,yaw:Math.atan2(to.x-m.position.x,to.z-m.position.z)},map,tick);
  assert.ok(fits(map,m.position,m.height),'capsule embedded');assert.ok(Number.isFinite(m.position.y));
 }
 assert.ok(reached,JSON.stringify({from,to,position:m.position}));
});
// Two sites, 50 angles, legal floor height vs the ground below the platform.
for(let i=0;i<200;i++)test('plant boundary '+i,()=>{
 const m=match(),site=BOMB_SITES[i%2],theta=(Math.floor(i/2)%50)*Math.PI*2/50;
 m.players.t.position={x:site.x+Math.cos(theta)*3.5,y:i<100?site.y:site.y-3,z:site.z+Math.sin(theta)*3.5};
 stepBomb(m,BOMB_RULES.buy);assert.equal(bombInteract(m,'t',true,BOMB_RULES.buy+1),i<100);
});
// Distinct budgets and replacement sequences: money conservation and one firearm.
const firearms=['smg','rifle','shotgun','sniper'] as const;
for(let i=0;i<200;i++)test('purchase conservation '+i,()=>{
 const m=match(),p=m.players.t,budget=5000+i*31;p.money=budget;
 const a=firearms[i%4],b=firearms[(i+1)%4];assert.ok(buyBombEquipment(m,'t',a,1));assert.ok(buyBombEquipment(m,'t',b,2));
 assert.equal(p.money,budget-BOMB_SHOP[b]);assert.deepEqual(p.weapons,['knife',b]);const before=p.money;
 assert.equal(buyBombEquipment(m,'t',b,3),false);assert.equal(p.money,before);
 assert.equal(buyBombEquipment(m,'t',a,BOMB_RULES.buy),false);assert.equal(p.money,before);
});
// Offset clocks and four outcomes verify idempotence, postplant elimination, timeout and economy.
for(let i=0;i<200;i++)test('round outcome '+i,()=>{
 const m=plant(i*37.125),now=m.deadline-BOMB_RULES.explode+.1,kind=i%4;
 if(kind===0){m.players.ct.alive=false;stepBomb(m,now);assert.equal(m.winner,'T');}
 if(kind===1){m.players.t.alive=false;stepBomb(m,now);assert.equal(m.phase,'planted');stepBomb(m,m.deadline);assert.equal(m.winner,'T');}
 if(kind===2){assert.ok(bombInteract(m,'ct',true,now));m.players.ct.holdUntil=now+BOMB_RULES.defuse+1;const before=m.players.t.money;stepBomb(m,now+BOMB_RULES.defuse+.001);assert.equal(m.winner,'CT');assert.equal(m.players.t.money-before,BOMB_RULES.lossReward+BOMB_RULES.plantLossBonus);}
 if(kind===3){const deadline=m.deadline;assert.ok(bombInteract(m,'ct',true,deadline-BOMB_RULES.defuse));m.players.ct.holdUntil=deadline+1;stepBomb(m,deadline);assert.equal(m.winner,'T');assert.equal(m.players.ct.defuses,0);}
 const scores={...m.scores},money=m.players.t.money;stepBomb(m,m.deadline-.01);assert.deepEqual(m.scores,scores);assert.equal(m.players.t.money,money);
});
