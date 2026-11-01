import {PHYSICS as C,TARGET_HITBOXES as H} from './config';
import {rayBox} from './physics';
import type {Vec3} from './types';
export interface HitPose {position:Vec3;height:number;yaw?:number;pitch?:number}
export type BodyPart='head'|'neck'|'chest'|'abdomen'|'pelvis'|'legs'|'arm-l'|'arm-r';
export function playerHitboxes(height:number){
 const offset=C.standing-height,low=Math.max(.08,H.body.min-offset),high=H.body.max-offset,span=high-low;
 const box=(part:BodyPart,x:number,y:number,z:number,w:number,h:number,d:number)=>({part,min:{x:x-w/2,y:y-h/2,z:z-d/2},max:{x:x+w/2,y:y+h/2,z:z+d/2}});
 // Subdivide the visible torso without enlarging its silhouette. Cosmetics are not armour/hit geometry.
 const bands:[BodyPart,number,number][]=[['legs',0,.22],['pelvis',.22,.4],['abdomen',.4,.66],['chest',.66,1]];
 const boxes=bands.map(([part,a,b])=>box(part,0,low+(a+b)*span/2,0,H.body.radius*2,(b-a)*span,H.body.radius*2));
 // Arms match gearRoot's crouch scaling and rotate with the body yaw.
 const scale=height/C.standing;
 for(const side of [-1,1])boxes.push(box(side<0?'arm-l':'arm-r',side*.41,scale,0,.17,.62*scale,.22));
 boxes.push(box('neck',0,(H.body.max+H.head.min)/2-offset,0,.22,H.head.min-H.body.max,.22));
 boxes.push(box('head',0,(H.head.min+H.head.max)/2-offset,0,H.head.radius*2,H.head.radius*2,H.head.radius*2));
 return boxes;
}
export function tracePlayer(origin:Vec3,direction:Vec3,pose:HitPose,range:number){
 const yaw=pose.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=origin.x-pose.position.x,dz=origin.z-pose.position.z;
 const o={x:dx*c-dz*s,y:origin.y-pose.position.y,z:dx*s+dz*c};
 const d={x:direction.x*c-direction.z*s,y:direction.y,z:direction.x*s+direction.z*c};
 let distance=range,part:BodyPart|undefined;
 for(const b of playerHitboxes(pose.height)){
  let from=o,dir=d;
  if(b.part==='head'){
   const center=(b.min.y+b.max.y)/2,pitch=pose.pitch||0,c=Math.cos(pitch),s=Math.sin(pitch),y=o.y-center;
   from={x:o.x,y:y*c+o.z*s+center,z:-y*s+o.z*c};dir={x:d.x,y:d.y*c+d.z*s,z:-d.y*s+d.z*c};
  }
  const hit=rayBox(from,dir,b.min,b.max,range);if(hit<distance){distance=hit;part=b.part;}
 }
 return part?{distance,part}:undefined;
}
