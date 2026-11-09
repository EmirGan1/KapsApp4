import type {Vec3,MapDefinition} from './types';
import {collisionSolids,raySolid} from './physics';
/** Touch friction only: reduces a deliberate swipe near a visible torso. No auto-aim or fire. */
export function touchAimFriction(eye:Vec3,yaw:number,pitch:number,targets:{position:Vec3;hp:number;friendly?:boolean}[],map:MapDefinition, aiming = false){
 let friction = 1;
 for(const target of targets){
  if(target.hp<=0||target.friendly)continue;
  const to={x:target.position.x-eye.x,y:target.position.y+1.05-eye.y,z:target.position.z-eye.z},d=Math.hypot(to.x,to.y,to.z);
  if(d<1||d>35)continue;
  const dy=Math.atan2(Math.sin(Math.atan2(to.x,to.z)-yaw),Math.cos(Math.atan2(to.x,to.z)-yaw)),dp=-Math.atan2(to.y,Math.hypot(to.x,to.z))-pitch;
  const angle = Math.hypot(dy,dp);
  const radius = aiming ? .075 : .06;
  if(angle>=radius)continue;
  const dir={x:to.x/d,y:to.y/d,z:to.z/d};
  if(collisionSolids(map).some(s=>!s.detail&&raySolid(eye,dir,s,d)<d-.1))continue;
  friction = Math.min(friction, 1 - (1 - angle / radius) * (aiming ? .32 : .22));
 }
 return friction;
}
