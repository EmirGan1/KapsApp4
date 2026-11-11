import {SPAWN_CANDIDATES} from "./spawnCandidates";
import type {MapDefinition,Vec3} from './types';
import {PHYSICS as C} from './config';
import {fits,support} from './physics';
/** Authoritative and deterministic: validate capsule clearance and ground before spawning. */
export function safeSpawn(map:MapDefinition,pool:readonly Vec3[],index:number,occupied:readonly Vec3[]=[]):Vec3 {
 const valid=pool.filter(p=>[p.x,p.y,p.z].every(Number.isFinite)&&Math.abs(p.x)<=map.bounds-C.radius&&Math.abs(p.z)<=map.bounds-C.radius&&fits(map,p,C.standing)&&Math.abs(support(map,p,p.y+.05)-p.y)<.1);
 if(!valid.length)throw new Error(`No safe spawn for ${map.id}`);
 const ordered=valid.map((_,i)=>valid[((Math.trunc(index)%valid.length)+valid.length+i)%valid.length]);
 const clearance=(p:Vec3)=>Math.min(Infinity,...occupied.map(q=>Math.abs(q.y-p.y)>C.standing?Infinity:Math.hypot(q.x-p.x,q.z-p.z)));
 const chosen=ordered.find(p=>clearance(p)>=C.radius*2+.1)||ordered.reduce((a,b)=>clearance(b)>clearance(a)?b:a);
 return {...chosen};
}

const roamingCache=new WeakMap<MapDefinition,Vec3[]>();
/** Expanded DM pool. Bomb rounds deliberately retain the authored team starts. */
export function computeRoamingSpawns(map:MapDefinition):Vec3[]{
 const cached=roamingCache.get(map);if(cached)return cached;
 const result:Vec3[]=map.spawns.map(p=>({...p}));
 const valid=(p:Vec3)=>Math.abs(p.x)<map.bounds-1&&Math.abs(p.z)<map.bounds-1&&fits(map,p,C.standing)&&Math.abs(support(map,p,p.y+.06)-p.y)<.1&&Math.hypot(p.x-map.hazard.x,p.z-map.hazard.z)>map.hazard.r+1;
 const add=(p:Vec3)=>{if(valid(p)&&result.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>2.8))result.push({...p});};
 const walkTo=(from:Vec3,to:Vec3)=>{let p={...from};const distance=Math.hypot(to.x-from.x,to.z-from.z),count=Math.ceil(distance/.3);for(let i=1;i<=count;i++){const next={x:from.x+(to.x-from.x)*i/count,y:p.y,z:from.z+(to.z-from.z)*i/count};next.y=support(map,next,p.y+C.step);if(!fits(map,next,C.standing)||Math.abs(next.y-p.y)>.45)return false;p=next;}return Math.abs(p.y-to.y)<.15;};
 const anchors=[...map.spawns,...(map.routes||[]).flatMap(r=>r.points)];
 for(const anchor of anchors)for(const [dx,dz]of [[0,0],[3,0],[-3,0],[0,3],[0,-3],[5,5],[-5,-5]]){
  const p={x:anchor.x+dx,y:anchor.y,z:anchor.z+dz};p.y=support(map,p,anchor.y+.3);
  if(valid(p)&&walkTo(anchor,p))add(p);
 }
 // Broad street coverage connected to a known route/start; enclosed pockets cannot qualify.
 for(let x=-map.bounds+4;x<map.bounds-3;x+=7)for(let z=-map.bounds+4;z<map.bounds-3;z+=7){
  const anchor=anchors.reduce((best,q)=>Math.hypot(q.x-x,q.z-z)<Math.hypot(best.x-x,best.z-z)?q:best,anchors[0]);
  if(Math.hypot(anchor.x-x,anchor.z-z)>16)continue;
  const p={x,y:support(map,{x,y:0,z},anchor.y+.3),z};if(valid(p)&&walkTo(anchor,p))add(p);
 }
 // A roof must have room for a capsule and an unobstructed walking drop to lower ground.
 let roofs=0;
 for(const s of map.solids){
  if(roofs>=12)break;
  if(s.detail||s.kind!=='box'||s.w<3||s.d<3||s.y+s.h<2||s.y+s.h>14)continue;
  const p={x:s.x,y:s.y+s.h,z:s.z};
  if(!valid(p)||![[-.8,0],[.8,0],[0,-.8],[0,.8]].every(([dx,dz])=>valid({x:p.x+dx,y:p.y,z:p.z+dz})))continue;
  const exit=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>{
   for(let d=.5;d<=30;d+=.5){const q={x:p.x+dx*d,y:p.y,z:p.z+dz*d};if(Math.abs(q.x)>map.bounds-1||Math.abs(q.z)>map.bounds-1||!fits(map,q,C.standing))return false;
    const floor=support(map,q,p.y+.05);if(floor<p.y-.6){q.y=floor;return valid(q);}
   }return false;
  });
  if(exit){const before=result.length;add(p);if(result.length>before)roofs++;}
 }
 roamingCache.set(map,result);return result;
}
/** Prefer separation from opponents, with a deterministic seed for reproducible respawns. */
export function spreadSpawn(map:MapDefinition,index:number,occupied:readonly Vec3[]=[]):Vec3{
 const pool=roamingSpawns(map);let best=pool[0],score=-Infinity;
 for(let i=0;i<pool.length;i++){const p=pool[(Math.abs(Math.trunc(index))+i)%pool.length];const distance=Math.min(35,...occupied.map(q=>Math.hypot(p.x-q.x,p.z-q.z)));if(distance>score){score=distance;best=p;}}
 return {...best};
}

export function roamingSpawns(map:MapDefinition):Vec3[]{
 const cached=roamingCache.get(map);if(cached)return cached;
 if(map.id==='campus')return computeRoamingSpawns(map);
 const pool:Vec3[]=[];
 const candidates=map.id==='bolluca'||map.id==='bolluca2'?[]:(SPAWN_CANDIDATES[map.id as keyof typeof SPAWN_CANDIDATES]??SPAWN_CANDIDATES.district);
 for(const p of [...map.spawns,...candidates]){
  if(pool.some(q=>Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<.1))continue;
  if(fits(map,p,C.standing)&&Math.abs(support(map,p,p.y+.06)-p.y)<.1)pool.push({...p});
 }
 if(!pool.length)throw Error('No safe roaming spawns');
 roamingCache.set(map,pool);return pool;
}
