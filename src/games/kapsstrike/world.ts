import type {MapDefinition,PlayerState,StrikeWorld,Vec3} from './types';
import {PHYSICS as C,SPECIAL_WEAPONS,WEAPONS} from './config';
import {collisionSolids,fits,raySolid,support} from './physics';
export const DROP_INTERVAL = Math.round(90/C.dt);
export const DROP_WARNING = Math.round(12/C.dt);
/** Candidates are on authored, continuous spawn-to-spawn routes, never random rooftops or water. */
export function supplyLocations(map:MapDefinition):Vec3[]{
 const points:Vec3[]=[];
 for(const route of map.routes||[])for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/7));
  for(let j=1;j<=n;j++){
   const p={x:a.x+(b.x-a.x)*j/n,y:0,z:a.z+(b.z-a.z)*j/n};p.y=support(map,p,C.step);
   if(fits(map,p,C.standing)&&map.spawns.every(s=>Math.hypot(s.x-p.x,s.z-p.z)>7)&&!points.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<4))points.push(p);
  }
 }
 return points;
}
function random(w:StrikeWorld){w.seed=(Math.imul(w.seed,1664525)+1013904223)>>>0;return w.seed/4294967296;}
const candidates=new WeakMap<MapDefinition,Vec3[]>();
function locations(map:MapDefinition){let p=candidates.get(map);if(!p){p=supplyLocations(map);candidates.set(map,p);}return p;}
export function createWorld(map:MapDefinition,seed=Date.now()):StrikeWorld{
 const w:StrikeWorld={pickups:[],nextDrop:DROP_INTERVAL,serial:0,seed:seed>>>0};
 const pool=[...locations(map)];
 for(let i=0;i<3&&pool.length;i++){
  const p=pool.splice(Math.floor(random(w)*pool.length),1)[0];
  w.pickups.push({id:`supply-${++w.serial}`,position:{...p},weapon:SPECIAL_WEAPONS[i%2],kind:'chest',opened:false,expires:0});
 }
 return w;
}
export function advanceWorld(w:StrikeWorld,map:MapDefinition,tick:number){
 w.pickups=w.pickups.filter(p=>!p.expires||p.expires>tick);
 if(!w.drop&&tick>=w.nextDrop-DROP_WARNING){
  const pool=locations(map);if(pool.length)w.drop={position:{...pool[Math.floor(random(w)*pool.length)]},warning:tick,landing:w.nextDrop};
 }
 if(w.drop&&tick>=w.drop.landing){
  w.pickups.push({id:`drop-${++w.serial}`,position:{...w.drop.position},weapon:'railgun',kind:'airdrop',opened:false,expires:tick+DROP_INTERVAL*2});
  w.nextDrop=tick+DROP_INTERVAL;w.drop=undefined;
 }
 // Bounded even when a match is configured for a long duration.
 if(w.pickups.length>32)w.pickups.splice(3,w.pickups.length-32);
}
export function nearestSupply(w:StrikeWorld,map:MapDefinition,p:PlayerState){
 if(p.hp<=0)return undefined;
 const eye={...p.movement.position,y:p.movement.position.y+1.1};
 return w.pickups.filter(s=>!s.opened).map(s=>({s,d:Math.hypot(s.position.x-eye.x,s.position.y+.5-eye.y,s.position.z-eye.z)})).filter(({s,d})=>{
  if(d>2.8)return false;
  const dir={x:(s.position.x-eye.x)/d,y:(s.position.y+.5-eye.y)/d,z:(s.position.z-eye.z)/d};
  return !collisionSolids(map).some(solid=>raySolid(eye,dir,solid,d)<d-.1);
 }).sort((a,b)=>a.d-b.d)[0]?.s;
}
export function claimSupply(w:StrikeWorld,map:MapDefinition,p:PlayerState,tick:number){
 const s=nearestSupply(w,map,p);if(!s)return false;
 s.opened=true;s.expires=tick+Math.round(15/C.dt);
 p.weapon.inventory=Array.from(new Set([...(p.weapon.inventory||[]),s.weapon]));
 p.weapon.selected=s.weapon;p.weapon.ammo[s.weapon]=WEAPONS[s.weapon].capacity;
 p.weapon.reloadUntil=0;p.weapon.switchUntil=tick+24;p.weapon.triggerHeld=true;
 return true;
}
export function dropInventory(w:StrikeWorld,p:PlayerState,tick:number){
 for(const weapon of p.weapon.inventory||[])if(SPECIAL_WEAPONS.includes(weapon))w.pickups.push({id:`weapon-${++w.serial}`,position:{...p.movement.position},weapon,kind:'dropped',opened:false,expires:tick+DROP_INTERVAL});
 p.weapon.inventory=[];p.weapon.selected='rifle';p.weapon.reloadUntil=0;
}
