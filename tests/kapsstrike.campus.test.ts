import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS, BOMB_MAPS} from '../src/games/kapsstrike/maps';
import {fits, move, newMovement, support} from '../src/games/kapsstrike/physics';
import {createBombMatch, bombInteract, stepBomb, BOMB_RULES} from '../src/games/kapsstrike/bomb';
import {computeRoamingSpawns} from '../src/games/kapsstrike/spawns';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';

const map=MAPS.campus;
test('fictional campus is registered in bomb and kill race without real school identifiers',()=>{
 assert.equal(map.name,'Kaps Kampüsü');
 assert.ok(BOMB_MAPS.includes(map as never));
 const content=JSON.stringify({name:map.name,subtitle:map.subtitle,solids:map.solids,landmarks:map.landmarks});
 assert.doesNotMatch(content,/fmv|ayazağa|ışık okulları|lise girişi|güvenlik/i);
 assert.equal(map.bombSites?.length,2);
 const server=new KapsStrikeServerManager({to:()=>({emit(){}}),emit(){}} as never);
 const owner={id:451,username:'player',avatar:null};
 assert.equal(server.createRoom(owner,'campus-bomb',{mode:'bomb',map:'campus'}).map,'campus');
 assert.equal(server.createRoom(owner,'campus-tdm',{mode:'tdm',map:'campus'}).map,'campus');
});

test('both starts and roaming spawns are supported and collision free',()=>{
 assert.equal(map.spawns.length,10);
 for(const spawn of [...map.spawns,...computeRoamingSpawns(map)]){
  assert.ok(fits(map,spawn,1.8),JSON.stringify(spawn));
  assert.ok(Math.abs(support(map,spawn,spawn.y+.05)-spawn.y)<.1);
 }
 for(let i=0;i<map.spawns.length;i++)for(let j=i+1;j<map.spawns.length;j++)
  assert.ok(Math.hypot(map.spawns[i].x-map.spawns[j].x,map.spawns[i].z-map.spawns[j].z)>2);
});

for(const route of map.routes??[])test(`campus traversable: ${route.name}`,()=>{
 const m=newMovement(route.points[0]);let tick=0;
 for(const target of route.points.slice(1)){
  let reached=false;
  for(let i=0;i<1300;i++){
   const distance=Math.hypot(target.x-m.position.x,target.z-m.position.z);
   if(distance<.2){reached=true;break;}
   const yaw=Math.atan2(target.x-m.position.x,target.z-m.position.z);
   move(m,{sequence:tick,tick,yaw,pitch:0,moveX:0,moveZ:Math.min(1,distance),jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false},map,tick++);
   assert.ok(fits(map,m.position,m.height),JSON.stringify({route:route.name,position:m.position}));
  }
  assert.ok(reached,JSON.stringify({route:route.name,target,position:m.position}));
 }
});

test('both fictional game objectives allow a plant and defuse on supported ground',()=>{
 for(const site of map.bombSites??[]){
  assert.ok(fits(map,site,1.8));
  assert.equal(support(map,site,site.y+.05),site.y);
  const match=createBombMatch([{id:'t',team:'T',position:{...site}},{id:'ct',team:'CT',position:{x:0,y:0,z:30}}],0,8,map.bombSites);
  stepBomb(match,BOMB_RULES.buy);
  const start=BOMB_RULES.buy+1;
  assert.ok(bombInteract(match,'t',true,start));
  for(let i=1;i<55&&match.phase==='active';i++){
   bombInteract(match,'t',true,start+i/10);stepBomb(match,start+i/10);
  }
  assert.equal(match.phase,'planted');assert.equal(match.site,site.id);
  match.players.ct.position={...site};
  const defuse=start+BOMB_RULES.plant+1;
  for(let i=0;i<120&&match.phase==='planted';i++){
   bombInteract(match,'ct',true,defuse+i/10);stepBomb(match,defuse+i/10);
  }
  assert.equal(match.winner,'CT');
 }
});
