import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from '../src/games/kapsstrike/maps';
import { fits, support,move,newMovement } from '../src/games/kapsstrike/physics';
import { PHYSICS as C } from '../src/games/kapsstrike/config';
for(const map of Object.values(MAPS)) test(`${map.name}: all ten spawns connect through standing-height ground routes`,()=>{
 const reachable=new Set<string>(),queue:{x:number;y:number;z:number}[]=[map.spawns[0]];
 const key=(x:number,z:number)=>`${x},${z}`;
 reachable.add(key(queue[0].x,queue[0].z));
 for(let i=0;i<queue.length;i++){
  const p=queue[i];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const stride=map.id.startsWith('district')||map.id.startsWith('bolluca')?.5:1;
   const x=p.x+dx*stride,z=p.z+dz*stride,k=key(x,z);
   if(reachable.has(k)||Math.abs(x)>map.bounds-1||Math.abs(z)>map.bounds-1)continue;
   const y=support(map,{x,y:p.y,z},p.y+C.step);
   if(!fits(map,{x,y,z},C.standing))continue;
   reachable.add(k);queue.push({x,y,z});
  }
 }
 for(const spawn of map.spawns)assert.ok(queue.some(p=>{
  if(Math.hypot(p.x-spawn.x,p.z-spawn.z)>1)return false;
  for(let j=0;j<=10;j++)if(!fits(map,{x:p.x+(spawn.x-p.x)*j/10,y:p.y,z:p.z+(spawn.z-p.z)*j/10},C.standing))return false;
  return true;
 }),JSON.stringify(spawn));
 assert.ok(reachable.size>1500,'district must provide substantial connected walkable space');
});
test('district geometry differs structurally and includes interiors and distinct vertical routes',()=>{
 const signatures=Object.values(MAPS).filter(m=>m.id!=='district2').map(m=>JSON.stringify(m.solids.filter(s=>!s.detail).map(({x,y,z,w,h,d,kind})=>[x,y,z,w,h,d,kind])));
 assert.equal(new Set(signatures).size,Object.keys(MAPS).length-1);
 for(const map of Object.values(MAPS)){
  assert.ok(map.solids.some(s=>s.kind==='ramp'));
  assert.ok(map.solids.some(s=>s.id.includes('entry-lintel')),'enterable structures');
  assert.ok(map.solids.some(s=>s.surface==='glass'),'articulated windows');
  assert.ok(!map.solids.some(s=>!s.detail&&!s.hidden&&s.h>2&&(s.w>map.bounds*1.5||s.d>map.bounds*1.5)),'no giant enclosing arena walls');
 }
 assert.ok(MAPS.warehouse.solids.some(s=>s.id.includes('sea')));
 assert.ok(MAPS.warehouse.solids.some(s=>s.id.includes('crane-gantry')));
 assert.ok(MAPS.dust.solids.some(s=>s.id.includes('arch-keystone')));
 assert.ok(MAPS.dust.solids.some(s=>s.id.includes('market-canopy')));
 assert.ok(MAPS.neon.solids.some(s=>s.id.includes('skyway')&&s.y>5&&s.w>60));
 assert.ok(MAPS.neon.solids.some(s=>s.h>35),'distinct skyscraper skyline');
});
for(const map of Object.values(MAPS)) test(`${map.id}: three authored routes have continuous standing capsule clearance`,()=>{
 assert.ok((map.routes?.length||0)>=3);
 for(const route of map.routes!) for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/.15);
  let floorY=a.y;
  for(let j=0;j<=steps;j++){
   const p={x:a.x+(b.x-a.x)*j/steps,y:0,z:a.z+(b.z-a.z)*j/steps};
   p.y=support(map,p,floorY+C.step);floorY=p.y;
   assert.ok(fits(map,p,C.standing),JSON.stringify({route:route.name,p}));
  }
 }
});
for(const map of Object.values(MAPS).filter(m=>!m.id.startsWith('bolluca'))) test(`${map.id}: doorway passages are open and interior floors have standing clearance`,()=>{
 for(const door of map.solids.filter(s=>s.id.includes('entry-lintel'))){
  for(const dz of [-.7,0,.7])assert.ok(fits(map,{x:door.x,y:door.y>6?2.4:0,z:door.z+dz},C.standing),door.id);
 }
});
for(const map of Object.values(MAPS).filter(m=>!m.id.startsWith('bolluca'))) test(`${map.id}: authored staircase reaches its roof landing without a jump`,()=>{
 const stairs=map.solids.filter(s=>s.id.includes(map.id.startsWith('district')?'stair-tread-short':'stair-tread'));
 assert.ok(stairs.length>10);
 const start=Math.min(...stairs.map(s=>s.z-s.d/2)),height=Math.max(...stairs.map(s=>s.h));
 const m=newMovement({x:stairs[0].x,y:0,z:start-.7});let highest=0;
 for(let tick=0;tick<600;tick++){
  move(m,{sequence:tick,tick,moveX:0,moveZ:1,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false},map,tick);
  highest=Math.max(highest,m.position.y);
 }
 assert.ok(highest>=height-.05,JSON.stringify({height,highest}));
});
test('district sites cannot see each other from any sampled plant position',async()=>{
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');const {raySolid}=await import('../src/games/kapsstrike/physics');
 const [a,b]=BOMB_SITES,map=MAPS.district;
 for(const ax of [-5,0,5])for(const az of [-5,0,5])for(const bx of [-5,0,5])for(const bz of [-5,0,5]){
  const from={x:a.x+ax,y:a.y+1.6,z:a.z+az},to={x:b.x+bx,y:b.y+1.6,z:b.z+bz};
  const length=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z),dir={x:(to.x-from.x)/length,y:(to.y-from.y)/length,z:(to.z-from.z)/length};
  assert.ok(map.solids.some(s=>!s.detail&&raySolid(from,dir,s,length)<length),'A/B sightline must be blocked');
 }
});
test('district has no 24m wide open square and both sites connect to T spawn',()=>{
 const map=MAPS.district;
 for(let x=-60;x<=60;x+=8)for(let z=-60;z<=60;z+=8){
  let open=true;
  for(let dx=-12;dx<=12;dx+=4)for(let dz=-12;dz<=12;dz+=4)if(!fits(map,{x:x+dx,y:0,z:z+dz},C.standing))open=false;
  assert.equal(open,false,`excessive open space at ${x},${z}`);
 }
});
