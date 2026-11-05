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
