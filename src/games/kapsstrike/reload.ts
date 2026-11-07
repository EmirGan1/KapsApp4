import type {WeaponState} from './types';
import {PHYSICS as C,WEAPONS} from './config';
/** Shared prediction/authority timing; empty magazines reload without a trigger press. */
export function advanceReload(w:WeaponState,tick:number,manual:boolean,allowStart=true):boolean{
 const def=WEAPONS[w.selected];
 if(w.reloadUntil&&tick>=w.reloadUntil){w.ammo[w.selected]=def.capacity;w.reloadUntil=0;}
 if(!allowStart||w.selected==='knife'||tick<w.switchUntil||w.reloadUntil||w.ammo[w.selected]>=def.capacity||(!manual&&w.ammo[w.selected]>0))return false;
 w.reloadUntil=tick+Math.ceil(def.reload/C.dt);return true;
}
