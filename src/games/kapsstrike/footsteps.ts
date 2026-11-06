import type {MapDefinition, Vec3, MovementState} from './types';
import {collisionSolids, surface} from './physics';
export type StepSurface = 'concrete' | 'wood' | 'grass';
/** Distance-based cadence: no footsteps from held keys against a wall or airborne motion. */
export class FootstepTracker {
  private actors = new Map<string,{position:Vec3; time:number; distance:number}>();
  reset(id?:string) {if(id)this.actors.delete(id);else this.actors.clear();}
  step(id:string, position:Vec3, grounded:boolean, stance:MovementState['stance'], now:number):number {
    const previous=this.actors.get(id);
    const entry={position:{...position},time:now,distance:previous?.distance||0};
    this.actors.set(id,entry);
    if(this.actors.size>32)this.actors.delete(this.actors.keys().next().value!);
    if(!previous)return 0;
    const dt=(now-previous.time)/1000, distance=Math.hypot(position.x-previous.position.x,position.z-previous.position.z);
    if(!grounded||stance==='slide'||dt<=0||dt>.25||distance>Math.max(1.5,dt*16)||distance/dt<.65){entry.distance=0;return 0;}
    const speed=distance/dt, crouched=stance==='crouch', stride=crouched?1.25:speed>7?2.25:1.9;
    entry.distance+=distance;
    if(entry.distance<stride)return 0;
    entry.distance%=stride;
    return crouched?.22:speed>7?1:.65;
  }
}
export function stepSurface(map:MapDefinition, position:Vec3):StepSurface {
  for(const solid of collisionSolids(map)) {
    if(Math.abs(position.x-solid.x)>solid.w/2+.1||Math.abs(position.z-solid.z)>solid.d/2+.1||Math.abs(position.y-surface(solid,position.x,position.z))>.18)continue;
    if(solid.surface==='wood')return 'wood';
    if(solid.surface==='fabric')return 'grass';
  }
  return 'concrete';
}
