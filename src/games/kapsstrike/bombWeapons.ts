import type {BombMatch} from './bomb';
import type {MapDefinition,PlayerState,StrikeWorld} from './types';
import {nearestSupply,DROP_INTERVAL} from './world';
import {WEAPONS} from './config';
/** Server-owned drops preserve ammunition; picking up never creates money or duplicate guns. */
export function dropBombWeapon(m:BombMatch,w:StrikeWorld,p:PlayerState,tick:number,death=false){
 const owner=m.players[p.id],weapon=p.weapon.selected;
 if(!owner||(!death&&(!owner.alive||p.hp<=0))||!['buy','active','planted'].includes(m.phase)||weapon==='knife'||!owner.weapons.includes(weapon))return false;
 w.pickups.push({id:`weapon-${++w.serial}`,position:{...p.movement.position},weapon,ammo:p.weapon.ammo[weapon],kind:'dropped',opened:false,expires:tick+DROP_INTERVAL});
 owner.weapons=owner.weapons.filter(id=>id!==weapon);delete owner.purchase;
 p.weapon.inventory=[...owner.weapons];p.weapon.selected='knife';p.weapon.reloadUntil=0;p.weapon.switchUntil=tick+24;
 return true;
}
export function pickupBombWeapon(m:BombMatch,w:StrikeWorld,map:MapDefinition,p:PlayerState,tick:number){
 const owner=m.players[p.id];if(!owner?.alive||p.hp<=0||!['buy','active','planted'].includes(m.phase))return false;
 const item=nearestSupply(w,map,p);if(!item||item.kind!=='dropped'||item.weapon==='knife')return false;
 // Drop the existing firearm before accepting the new one. Consume atomically on the server.
 const previous=owner.weapons.find(id=>id!=='knife');
 if(previous){p.weapon.selected=previous;dropBombWeapon(m,w,p,tick);}
 item.opened=true;item.expires=tick+1;delete owner.purchase;
 owner.weapons=['knife',item.weapon];p.weapon.inventory=[...owner.weapons];p.weapon.selected=item.weapon;
 p.weapon.ammo[item.weapon]=Math.max(0,Math.min(WEAPONS[item.weapon].capacity,item.ammo??0));p.weapon.reloadUntil=0;p.weapon.switchUntil=tick+24;p.weapon.triggerHeld=true;
 return true;
}
