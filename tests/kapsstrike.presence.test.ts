import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS} from '../src/games/kapsstrike/maps';import {PHYSICS as C} from '../src/games/kapsstrike/config';
import {roamingSpawns,spreadSpawn} from '../src/games/kapsstrike/spawns';import {fits,support} from '../src/games/kapsstrike/physics';
import {createTraining,takeDamage} from '../src/games/kapsstrike/combat';
import {COSMETICS,CASES,caseRewards} from '../src/games/kapsstrike/cosmetics';import {finishTextureUrl} from '../src/games/kapsstrike/finishAppearance';
import {knifeTiming} from '../src/games/kapsstrike/presentation';
import {straightKnifeMotion} from '../src/games/kapsstrike/knifeMotion';
for(const map of Object.values(MAPS))test(`${map.id}: dispersed ground/roof spawns have clearance, support and occupied avoidance`,()=>{
 const pool=roamingSpawns(map);assert.ok(pool.length>40);assert.ok(pool.some(p=>p.y>4));
 for(const p of pool){assert.ok(fits(map,p,C.standing),JSON.stringify(p));assert.ok(Math.abs(support(map,p,p.y+.06)-p.y)<.1);}
 const occupied=pool.slice(0,8),spawn=spreadSpawn(map,8,occupied);assert.ok(occupied.every(p=>Math.hypot(p.x-spawn.x,p.z-spawn.z)>C.radius*2));
 const unique=new Set(Array.from({length:100},(_,i)=>JSON.stringify(spreadSpawn(map,i,[]))));assert.ok(unique.size>40);
 assert.equal(roamingSpawns(map),pool);
});
test('spawn immunity is exactly four seconds, then normal damage resumes',()=>{
 assert.equal(C.protectionTicks*C.dt,4);const state=createTraining('warehouse');state.tick=state.player.protectedUntil-1;takeDamage(state,50,{x:0,y:0,z:0});assert.equal(state.player.hp,100);state.tick++;takeDamage(state,50,{x:0,y:0,z:0});assert.equal(state.player.hp,50);
});
test('forty new finishes have unique paint, all firearms and rarity odds remain normalized',()=>{
 const items=COSMETICS.filter(c=>c.id.includes('-expedition-'));assert.equal(items.length,40);assert.equal(new Set(items.map(c=>c.id)).size,40);assert.equal(new Set(items.map(c=>c.weapon)).size,9);assert.equal(new Set(items.map(c=>finishTextureUrl(c))).size,4); // gun families intentionally share each thematic atlas
 for(const box of CASES){const rewards=caseRewards(box.id);assert.ok(Math.abs(rewards.reduce((s,r)=>s+r.chance,0)-100)<1e-8);assert.ok(rewards.some(r=>r.item.id.includes('-expedition-')));assert.ok(Math.abs(rewards.filter(r=>r.item.rarity==='knife').reduce((s,r)=>s+r.chance,0)-5)<1e-8);}
});
test('straight blade motions remain finite, return to rest and distinguish tanto/tactical animations',()=>{
 for(const style of ['default','tanto'])for(const phase of ['draw','attack','inspect'] as const)for(const heavy of [false,true])for(let i=0;i<=100;i++){const pose=straightKnifeMotion(style,phase,i/100,heavy,1);assert.ok(Object.values(pose).every(Number.isFinite));if(i===100)assert.ok(Object.values(pose).every(v=>Math.abs(v)<1e-8));}
 assert.notDeepEqual(straightKnifeMotion('default','inspect',.5),straightKnifeMotion('tanto','inspect',.5));
});

test('karambit and butterfly keep their existing deployment and inspection timings',()=>{for(const style of ['karambit','butterfly'])assert.deepEqual(knifeTiming(style),{inspect:2.6,deploy:.24});});
