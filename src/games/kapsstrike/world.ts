import type {MapDefinition,PlayerState,StrikeWorld,Vec3,WeaponId} from './types';
import {PHYSICS as C,SPECIAL_WEAPONS,WEAPONS} from './config';
import {collisionSolids,fits,raySolid,support} from './physics';
export const SUPPLY_RESPAWN = Math.round(10/C.dt);
export const DROP_INTERVAL = Math.round(90/C.dt);
export const DROP_WARNING = Math.round(12/C.dt);
/** Candidates are on authored, continuous spawn-to-spawn routes, never random rooftops or water. */
export function supplyLocations(map:MapDefinition):Vec3[]{
 if(map.id==='bolluca')return [];
 const points:Vec3[]=[];
 for(const route of map.routes||[])for(let i=1;i<route.points.length;i++){
  const a=route.points[i-1],b=route.points[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/7));
  for(let j=1;j<=n;j++){
   const p={x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n,z:a.z+(b.z-a.z)*j/n};p.y=support(map,p,p.y+C.step);
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
 if(map.id==='district'||map.id==='bolluca')return w;
 const pool=[...locations(map)];
 // 8 pickups: 3 Health boxes, 2 Armor boxes, 3 Special Weapons (carbine, lmg, railgun)
 const pickupTypes: Array<{ consumable?: "health" | "armor"; amount?: number; weapon?: WeaponId }> = [
  { consumable: 'health', amount: 50 },
  { consumable: 'health', amount: 50 },
  { consumable: 'health', amount: 50 },
  { consumable: 'armor', amount: 50 },
  { consumable: 'armor', amount: 50 },
  { weapon: 'carbine' },
  { weapon: 'lmg' },
  { weapon: 'railgun' },
 ];
 for(let i=0;i<pickupTypes.length&&pool.length;i++){
  const p=pool.splice(Math.floor(random(w)*pool.length),1)[0];
  const type=pickupTypes[i];
  w.pickups.push({
   id:`supply-${++w.serial}`,
   position:{...p},
   weapon:type.weapon || 'carbine',
   ...(type.consumable ? { consumable: type.consumable, amount: type.amount } : {}),
   kind:'chest',
   opened:false,
   expires:0
  });
 }
 return w;
}
export function advanceWorld(w:StrikeWorld,map:MapDefinition,tick:number){
 if(map.id==='bolluca'){
  w.drop=undefined;
  w.respawns=undefined;
  w.pickups=w.pickups.filter(p=>p.kind==='dropped'&&(!p.expires||p.expires>tick));
  return;
 }
 for(const job of [...(w.respawns||[])]){
  if(tick<job.at)continue;
  const pool=locations(map).filter(p=>Math.hypot(p.x-job.pickup.position.x,p.z-job.pickup.position.z)>4&&w.pickups.every(s=>s.opened||Math.hypot(s.position.x-p.x,s.position.z-p.z)>3.5)&&(!w.drop||Math.hypot(w.drop.position.x-p.x,w.drop.position.z-p.z)>3.5));
  if(!pool.length)continue; // Retry once space is free; never fall back into a wall or the old position.
  const position={...pool[Math.floor(random(w)*pool.length)]};
  w.pickups.push({...job.pickup,id:`supply-${++w.serial}`,position,opened:false,expires:0});
  w.respawns!.splice(w.respawns!.indexOf(job),1);
 }
 w.pickups=w.pickups.filter(p=>!p.expires||p.expires>tick);
 if(map.id!=='district'&&!w.drop&&tick>=w.nextDrop-DROP_WARNING){
  const pool=locations(map).filter(p=>w.pickups.every(s=>s.opened||Math.hypot(s.position.x-p.x,s.position.z-p.z)>3.5));if(pool.length)w.drop={position:{...pool[Math.floor(random(w)*pool.length)]},warning:tick,landing:w.nextDrop};
 }
 if(w.drop&&tick>=w.drop.landing){
  w.pickups.push({id:`drop-${++w.serial}`,position:{...w.drop.position},weapon:(['railgun','carbine','lmg'] as const)[Math.floor(random(w)*3)],kind:'airdrop',opened:false,expires:tick+DROP_INTERVAL*2});
  w.nextDrop=tick+DROP_INTERVAL;w.drop=undefined;
 }
 // Bounded even when a match is configured for a long duration.
 for(let i=0;w.pickups.length>32&&i<w.pickups.length;){
  if(w.pickups[i].opened||w.pickups[i].kind==='dropped')w.pickups.splice(i,1);else i++;
 }
}
export function nearestSupply(w:StrikeWorld,map:MapDefinition,p:PlayerState){
 if(p.hp<=0)return undefined;
 const eye={...p.movement.position,y:p.movement.position.y+1.1};
 return w.pickups.filter(s=>!s.opened&&(map.id!=='bolluca'||s.kind==='dropped')).map(s=>({s,d:Math.hypot(s.position.x-eye.x,s.position.y+.5-eye.y,s.position.z-eye.z)})).filter(({s,d})=>{
  if(d>2.8)return false;
  const dir={x:(s.position.x-eye.x)/d,y:(s.position.y+.5-eye.y)/d,z:(s.position.z-eye.z)/d};
  return !collisionSolids(map).some(solid=>raySolid(eye,dir,solid,d)<d-.1);
 }).sort((a,b)=>Math.abs(a.d-b.d)>.05?a.d-b.d:Number(b.s.kind==='airdrop')-Number(a.s.kind==='airdrop'))[0]?.s;
}
export function claimSupply(w:StrikeWorld,map:MapDefinition,p:PlayerState,tick:number){
 const s=nearestSupply(w,map,p);if(!s)return false;
 if(s.consumable==='health'){
  if(p.hp>=100)return false;const gain=Math.min(s.amount||50,100-p.hp);p.hp+=gain;p.lootNotice=`+${Math.ceil(gain)} Can`;
 }else if(s.consumable==='armor'){
  if((p.armor||0)>=100)return false;const gain=Math.min(s.amount||50,100-(p.armor||0));p.armor=(p.armor||0)+gain;p.lootNotice=`+${Math.ceil(gain)} Zırh`;
 }else{
  const weapons=s.weapons?.length?s.weapons:[s.weapon];
  p.weapon.inventory=Array.from(new Set([...(p.weapon.inventory||[]),...weapons]));
  for(const weapon of weapons)p.weapon.ammo[weapon]=WEAPONS[weapon].capacity;
  p.weapon.selected=weapons[0];p.weapon.reloadUntil=0;p.weapon.switchUntil=tick+24;p.weapon.triggerHeld=true;
  p.lootNotice=weapons.map(weapon=>WEAPONS[weapon].name).join(' + ');
 }
 // ONLY standard chests respawn! Airplane airdrops and dropped weapons never respawn in-place!
 if(s.kind==='chest')(w.respawns??=[]).push({at:tick+SUPPLY_RESPAWN,pickup:{...s,position:{...s.position}}});
 s.opened=true;s.expires=tick+Math.round(15/C.dt);p.lootNoticeUntil=tick+Math.round(3/C.dt);
 return true;
}
export function dropInventory(w:StrikeWorld,p:PlayerState,tick:number){
 for(const weapon of p.weapon.inventory||[])if(SPECIAL_WEAPONS.includes(weapon))w.pickups.push({id:`weapon-${++w.serial}`,position:{...p.movement.position},weapon,kind:'dropped',opened:false,expires:tick+DROP_INTERVAL});
 p.weapon.inventory=[];p.weapon.selected='rifle';p.weapon.reloadUntil=0;
}

export function supplyLabel(s:StrikeWorld['pickups'][number],p?:PlayerState){
 if(s.consumable==='health')return p&&p.hp>=100?'Can dolu':`+${s.amount||50} Can`;
 if(s.consumable==='armor')return p&&(p.armor||0)>=100?'Zırh dolu':`+${s.amount||50} Zırh`;
 return (s.weapons||[s.weapon]).map(weapon=>WEAPONS[weapon].name).join(' + ');
}
