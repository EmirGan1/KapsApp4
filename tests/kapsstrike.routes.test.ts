import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/games/kapsstrike/maps';
import { fits, support } from '../src/games/kapsstrike/physics';
import { PHYSICS as C } from '../src/games/kapsstrike/config';
for(const map of Object.values(MAPS)) test(`${map.name}: all ten spawns connect through standing-height ground routes`,()=>{
 const reachable=new Set<string>(),queue:{x:number;z:number}[]=[map.spawns[0]];
 const key=(x:number,z:number)=>`${x},${z}`;
 reachable.add(key(queue[0].x,queue[0].z));
 for(let i=0;i<queue.length;i++){
  const p=queue[i];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=p.x+dx,z=p.z+dz,k=key(x,z);
   if(reachable.has(k)||Math.abs(x)>map.bounds-1||Math.abs(z)>map.bounds-1)continue;
   const y=support(map,{x,y:0,z},C.step);
   if(!fits(map,{x,y,z},C.standing))continue;
   reachable.add(k);queue.push({x,z});
  }
 }
 for(const spawn of map.spawns)assert.ok(reachable.has(key(spawn.x,spawn.z)),JSON.stringify(spawn));
 assert.ok(reachable.size>1500,'district must provide substantial connected walkable space');
});
test('district geometry differs structurally and includes interiors and distinct vertical routes',()=>{
 const signatures=Object.values(MAPS).map(m=>JSON.stringify(m.solids.filter(s=>!s.detail).map(({x,y,z,w,h,d,kind})=>[x,y,z,w,h,d,kind])));
 assert.equal(new Set(signatures).size,3);
 assert.equal(MAPS.warehouse.solids.filter(s=>s.kind==='ramp').length,1);
 assert.equal(MAPS.dust.solids.filter(s=>s.kind==='ramp').length,1);
 assert.equal(MAPS.neon.solids.filter(s=>s.kind==='ramp').length,3);
 assert.ok(MAPS.neon.solids.some(s=>s.y===6&&s.w>=30));
});
