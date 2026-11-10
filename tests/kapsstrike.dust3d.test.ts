import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS} from '../src/games/kapsstrike/maps';
import {move,newMovement,raySolid,surface,fits,support} from '../src/games/kapsstrike/physics';
const map=MAPS.district;
function walk(start:{x:number;y:number;z:number},target:{x:number;z:number},ticks=1000){
 const m=newMovement(start);let reached=false;
 for(let i=0;i<ticks;i++){
  const distance=Math.hypot(target.x-m.position.x,target.z-m.position.z);if(distance<.22){reached=true;break;}
  const yaw=Math.atan2(target.x-m.position.x,target.z-m.position.z);
  move(m,{sequence:i,tick:i,moveX:0,moveZ:1,yaw,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false},map,i);
  assert.ok(fits(map,m.position,m.height),JSON.stringify(m.position));
 }
 for(let i=0;i<35;i++)move(m,{sequence:5000+i,tick:5000+i,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:false},map,5000+i);
 assert.ok(reached,JSON.stringify({start,target,end:m.position}));return m;
}
for(const [name,start,target,height] of [
 ['Short stairs',{x:13,y:0,z:14.3},{x:13,z:24},3.2],
 ['Upper entrance',{x:-38,y:0,z:-10.5},{x:-38,z:5},2.4],
 ['Upper to Lower stairs',{x:-26.7,y:2.4,z:10},{x:-19.5,z:10},0],
 ['B Doors ramp',{x:-18.5,y:0,z:30},{x:-30,z:30},2.4],
 ['B Window stairs',{x:-22,y:0,z:32.9},{x:-22,z:39},2.4],
] as const)test(`3D traversal without jumping: ${name}`,()=>{const m=walk(start,target);assert.ok(Math.abs(m.position.y-height)<.13,JSON.stringify(m.position));});
test('all four published spawn/site paths walk with shared fixed-step physics',()=>{
 for(const route of map.routes!){let p={...route.points[0]};for(const target of route.points.slice(1)){const m=walk(p,target,240);p={...m.position};}}
});
test('reverse ramp top, raycast and underside agree',()=>{
 const r=map.solids.find(s=>s.id==='district-b-doors-ramp')!;
 for(const t of [.1,.5,.9]){const x=r.x-r.w/2+r.w*t,y=surface(r,x,r.z);assert.ok(Math.abs(y-2.4*(1-t))<1e-6);assert.ok(Math.abs(raySolid({x,y:10,z:r.z},{x:0,y:-1,z:0},r,20)-(10-y))<1e-6);}
});
test('planting cannot happen beneath the elevated A platform',async()=>{
 const {createBombMatch,bombInteract,stepBomb,BOMB_SITES}=await import('../src/games/kapsstrike/bomb');const a=BOMB_SITES[0];
 const m=createBombMatch([{id:'t',team:'T',position:{x:a.x,y:0,z:a.z}},{id:'ct',team:'CT',position:{x:0,y:0,z:0}}],0);stepBomb(m,15);assert.equal(bombInteract(m,'t',true,16),false);
});

test('A Long ramp turns onto the raised platform',()=>{let m=walk({x:47,y:0,z:20.5},{x:47,z:29});m=walk(m.position,{x:39,z:30});m=walk(m.position,{x:39,z:36});assert.ok(Math.abs(m.position.y-3.2)<.1);});
test('Short stair landing connects through the full elevated Catwalk to A',()=>{let m=walk({x:13,y:0,z:14.3},{x:13,z:24});for(const t of [{x:13,z:27},{x:21,z:27},{x:21,z:36},{x:34,z:36}])m=walk(m.position,t);assert.ok(Math.abs(m.position.y-3.2)<.1);});
test('Upper room connects through the stairwell to Lower and back',()=>{let m=walk({x:-38,y:2.4,z:5},{x:-38,z:10});m=walk(m.position,{x:-27.4,z:10});m=walk(m.position,{x:-19.5,z:10});assert.ok(m.position.y<.1);m=walk(m.position,{x:-29,z:10});assert.ok(Math.abs(m.position.y-2.4)<.1);});

test('A/B standing positions have no direct cross-site sightline',async()=>{
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');
 const points=(s:typeof BOMB_SITES[number])=>[-2,0,2].flatMap(x=>[-2,0,2].map(z=>({x:s.x+x,y:s.y,z:s.z+z}))).filter(p=>fits(map,p,1.8));
 let checked=0;for(const p of points(BOMB_SITES[0]))for(const q of points(BOMB_SITES[1])){
  const eye={...p,y:p.y+1.6},dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,r=Math.hypot(dx,dy,dz),dir={x:dx/r,y:dy/r,z:dz/r};
  assert.ok(map.solids.some(s=>!s.detail&&raySolid(eye,dir,s,r)<r),JSON.stringify({p,q}));checked++;
 }assert.ok(checked>=40);
});

test('CT underpass connects directly to A Ramp without a T-side detour',()=>{
 let m=walk({x:9.4,y:0,z:33.5},{x:25,z:33});m=walk(m.position,{x:25,z:20.5});m=walk(m.position,{x:47,z:20.5});m=walk(m.position,{x:47,z:29});m=walk(m.position,{x:39,z:30});m=walk(m.position,{x:39,z:36});assert.ok(Math.abs(m.position.y-3.2)<.1);
});
test('Upper room exits through B Tunnels into B Site',()=>{let m=walk({x:-38,y:2.4,z:10},{x:-45,z:10});m=walk(m.position,{x:-45,z:33});m=walk(m.position,{x:-34,z:33});m=walk(m.position,{x:-34,z:42});assert.ok(Math.abs(m.position.y-2.4)<.1);});

test('Lower Tunnels exits east through its arch to Mid',()=>{const m=walk({x:-19,y:0,z:10},{x:-5.5,z:10});assert.ok(m.position.y<.1);});

test('B exterior apron and window rear pocket are filled to site level',()=>{
 const map=MAPS.district;
 for(const x of [-26,-25,-24])for(const z of [33.5,35,36,41,42,43]){
  const floor=map.solids.find(s=>s.id.includes('infill')&&Math.abs(x-s.x)<=s.w/2&&Math.abs(z-s.z)<=s.d/2);
  assert.ok(floor,`filled B pocket ${x},${z}`);assert.equal(floor!.y+floor!.h,2.4);assert.equal(support(map,{x,y:2.4,z},2.41),2.4);
 }
});

test('A Long upper-ramp side pocket has an escape onto the ramp and site',()=>{
 const p={x:49.5,y:1.6,z:31};assert.equal(support(map,p,1.61),1.6);
 let m=walk(p,{x:47,z:30});m=walk(m.position,{x:39,z:30});m=walk(m.position,{x:39,z:36});assert.ok(Math.abs(m.position.y-3.2)<.1);
});

test('CT Spawn and CT Mid have no direct sightlines onto A Site or B Site',async()=>{
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');
 const ctSpawns=map.spawns.slice(5);
 for(const site of BOMB_SITES){
  for(const ct of ctSpawns){
   const eye={x:ct.x,y:ct.y+1.62,z:ct.z};
   for(const dx of [-3,-1.5,0,1.5,3]){
    for(const dz of [-3,-1.5,0,1.5,3]){
     const target={x:site.x+dx,y:site.y,z:site.z+dz};
     if(!fits(map,target,1.8))continue;
     const targetEye={...target,y:target.y+1.62};
     const vx=targetEye.x-eye.x,vy=targetEye.y-eye.y,vz=targetEye.z-eye.z,dist=Math.hypot(vx,vy,vz);
     const dir={x:vx/dist,y:vy/dist,z:vz/dist};
     const blocked=map.solids.some(s=>!s.detail&&!s.hidden&&raySolid(eye,dir,s,dist)<dist-0.1);
     assert.ok(blocked,`Unblocked sightline from CT Spawn ${JSON.stringify(ct)} to Site ${site.id} ${JSON.stringify(target)}`);
    }
   }
  }
 }
});



test('A retaining-wall courtyard has no occupiable hidden ground volume and A Long sees A Site',async()=>{
 const core=map.solids.find(s=>s.id.includes('a-retaining-core-infill'))!;
 assert.ok(core&&!core.detail&&!core.hidden);
 let checked=0;
 for(let x=27.2;x<=36.4;x+=.4)for(let z=22.8;z<=33.2;z+=.4){
  assert.equal(fits(map,{x,y:0,z},1.8),false,`empty A core ${x},${z}`);
  assert.ok(support(map,{x,y:3.2,z},3.25)>=3.2);
  assert.ok(raySolid({x,y:10,z},{x:0,y:-1,z:0},core,20)<6.85);
  checked++;
 }
 assert.ok(checked>500);
 const {BOMB_SITES}=await import('../src/games/kapsstrike/bomb');
 const aSite=BOMB_SITES[0];
 const longEye={x:47,y:0.8+1.62,z:24.5};
 const siteEye={x:aSite.x,y:aSite.y+1.62,z:aSite.z};
 const vx=siteEye.x-longEye.x,vy=siteEye.y-longEye.y,vz=siteEye.z-longEye.z,dist=Math.hypot(vx,vy,vz);
 const dir={x:vx/dist,y:vy/dist,z:vz/dist};
 const blocked=map.solids.some(s=>!s.detail&&!s.hidden&&raySolid(longEye,dir,s,dist)<dist-0.1);
 assert.equal(blocked,false,'A Long should have a direct sightline onto A Site');
});
test('walking or jumping off the A edge cannot enter the former retaining-wall pit',()=>{
 for(const x of [35.5,35.85,36.2])for(const jump of [false,true])for(const crouch of [false,true]){
  const m=newMovement({x,y:3.2,z:35.15});
  assert.ok(fits(map,m.position,m.height));
  for(let i=0;i<360;i++){
   move(m,{sequence:i,tick:i,moveX:0,moveZ:1,yaw:Math.PI,pitch:0,jump:jump&&i<25,sprint:true,crouch,fire:false,ads:false,reload:false},map,i);
   assert.ok(fits(map,m.position,m.height));
   assert.ok(m.position.z>=22.8,`entered pit: ${JSON.stringify(m.position)}`);
   assert.ok(m.position.y>=3.19,`fell below A deck: ${JSON.stringify(m.position)}`);
  }
 }
});

test('Dust II cover crates are removed and previously open catwalk edges have a solid deck',()=>{
 assert.ok(!map.solids.some(s=>/crate|xbox|tarp/.test(s.id)));
 for(const [x,z] of [[11.5,25.5],[11.5,26],[11.5,27],[11.5,28.5],[22.5,27.5],[22.5,28]]){
  assert.ok(map.solids.some(s=>!s.detail&&raySolid({x,y:3.24,z},{x:0,y:-1,z:0},s,.08)<.08),`deck at ${x},${z}`);
 }
});

test('aiming down sights permits jumping off supported Dust II ground',()=>{
 const m=newMovement(map.spawns[0]);
 const baseline=m.position.y;
 move(m,{sequence:1,tick:1,moveX:0,moveZ:0,yaw:0,pitch:0,jump:true,sprint:false,crouch:false,fire:false,ads:true,reload:false},map,1);
 assert.ok(m.position.y>baseline);
 assert.ok(m.velocity.y>0);
});
