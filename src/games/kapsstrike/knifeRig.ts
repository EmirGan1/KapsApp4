import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData';
import type {Material} from '@babylonjs/core/Materials/material';
export type KnifeRig={karambit:TransformNode;blade:TransformNode;bite:TransformNode;update:(style:string,deploy:number,inspect:number,time:number,dt:number)=>void};
/** Closed, bevelled sections. All parts share real hinge transforms, never per-mesh centre spins. */
function loft(scene:Scene,name:string,sections:{z:number;y:number;x:number;w:number;h:number}[],sides=12){
 const positions:number[]=[],indices:number[]=[],uvs:number[]=[];
 for(let j=0;j<sections.length;j++){const s=sections[j];for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;positions.push(s.x+Math.cos(a)*s.w,s.y+Math.sin(a)*s.h,s.z);uvs.push(i/sides,j/(sections.length-1));}}
 for(let j=0;j<sections.length-1;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
 for(const j of [0,sections.length-1]){const s=sections[j],center=positions.length/3;positions.push(s.x,s.y,s.z);uvs.push(.5,.5);for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides;indices.push(center,...(j===0?[b,a]:[a,b]));}}
 const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);const data=new VertexData();Object.assign(data,{positions,indices,normals,uvs});const mesh=new Mesh(name,scene);data.applyToMesh(mesh);return mesh;
}
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function keys(t:number,poses:number[][]){for(let i=1;i<poses.length;i++){const a=poses[i-1],b=poses[i];if(t<=b[0]){const q=smooth((t-a[0])/(b[0]-a[0]));return [a[1]+(b[1]-a[1])*q,a[2]+(b[2]-a[2])*q];}}return poses.at(-1)!.slice(1);}
export function createKnifeRig(scene:Scene,root:TransformNode,material:(color:string,metal?:boolean)=>Material):KnifeRig{
 const attach=(m:Mesh,parent:TransformNode,style:string,part:string,color:string)=>{m.parent=parent;m.metadata={knifeStyle:style,knifePart:part};m.material=material(color,part!=='handle');m.renderingGroupId=2;m.isPickable=false;return m;};
 const karambit=new TransformNode('karambit-ring-pivot',scene);karambit.parent=root;karambit.position.set(0,-.005,-.23);
 const body=new TransformNode('karambit-body',scene);body.parent=karambit;body.position.set(0,.005,.23);
 const grip=Array.from({length:21},(_,i)=>{const t=i/20;return {z:-.18+t*.215,x:0,y:.008+Math.sin(t*Math.PI)*.012,w:.018+Math.sin(t*Math.PI)*.009,h:.023+Math.sin(t*Math.PI)*.013-Math.pow(Math.sin(t*3*Math.PI),2)*.003};});
 attach(loft(scene,'karambit-sculpted-grip',grip),body,'karambit','handle','#23313b');
 const profile=[[-.005,.014,.008,.031],[.025,.022,.009,.038],[.06,.027,.009,.044],[.10,.026,.008,.047],[.14,.011,.007,.048],[.175,-.014,.006,.042],[.20,-.047,.005,.033],[.218,-.082,.003,.019],[.225,-.112,.0003,.0005]];
 attach(loft(scene,'karambit-hawkbill',profile.map(([z,y,w,h])=>({z,y,x:0,w,h})),4),body,'karambit','blade','#d8e3e9');
 const ring=attach(MeshBuilder.CreateTorus('karambit-integrated-ring',{diameter:.108,thickness:.017,tessellation:40},scene),body,'karambit','ring','#9baeba');ring.position.set(0,-.005,-.23);ring.rotation.z=Math.PI/2;
 for(const z of [-.15,-.05]){const pin=attach(MeshBuilder.CreateCylinder('karambit-flush-pin',{diameter:.014,height:.056,tessellation:12},scene),body,'karambit','ring','#81939e');pin.position.set(0,.018,z);pin.rotation.z=Math.PI/2;}
 const fixed=new TransformNode('butterfly-safe-hinge',scene);fixed.parent=root;fixed.position.set(0,-.028,.018);
 const blade=new TransformNode('butterfly-blade-hinge',scene);blade.parent=root;blade.position.set(0,-.028,.018);
 const bite=new TransformNode('butterfly-bite-hinge',scene);bite.parent=blade;bite.position.y=.08;
 function handle(parent:TransformNode,name:string){
  // Actual open channels bounded by rounded rails and spacers, no painted-on "holes".
  for(const x of [-.012,.012]){const rail=Array.from({length:9},(_,i)=>{const t=i/8;return {x,y:0,z:-t*.28,w:.006*(.7+Math.sin(t*Math.PI)*.3),h:.022*(.8+Math.sin(t*Math.PI)*.2)};});attach(loft(scene,name+'-rail',rail,8),parent,'butterfly','handle','#233541');}
  for(const z of [-.02,-.11,-.20,-.275]){const pin=attach(MeshBuilder.CreateCylinder(name+'-spacer',{diameter:.025,height:.035,tessellation:12},scene),parent,'butterfly','ring','#748997');pin.rotation.z=Math.PI/2;pin.position.z=z;}
  const cap=attach(MeshBuilder.CreateSphere(name+'-rounded-butt',{diameter:.037,segments:12},scene),parent,'butterfly','handle','#233541');cap.position.z=-.28;cap.scaling.y=1.25;
 }
 handle(fixed,'butterfly-safe');handle(bite,'butterfly-bite');
 const balisongBlade=attach(loft(scene,'butterfly-ground-blade',[{z:0,y:0,x:0,w:.006,h:.024},{z:.05,y:0,x:0,w:.007,h:.027},{z:.21,y:.005,x:0,w:.005,h:.025},{z:.29,y:.01,x:0,w:.003,h:.014},{z:.33,y:.017,x:0,w:.0002,h:.0003}],4),blade,'butterfly','blade','#d8e3e9');balisongBlade.position.y=.04;
 for(const [i,hinge] of [fixed,bite].entries()){const pin=attach(MeshBuilder.CreateCylinder('butterfly-hinge-pin-'+i,{diameter:.025,height:.045,tessellation:16},scene),hinge,'butterfly','ring','#9babb6');pin.rotation.z=Math.PI/2;}
 const latch=attach(MeshBuilder.CreateCapsule('butterfly-latch',{height:.045,radius:.007,tessellation:10},scene),bite,'butterfly','ring','#9babb6');latch.position.set(0,0,-.30);latch.rotation.x=Math.PI/2;
 // Gloved grip stays with the hand while the karambit rolls around its index finger.
 for(const style of ['karambit','butterfly']){
  const x=0;
  const palm=attach(MeshBuilder.CreateSphere(style+'-glove-palm',{diameter:.115,segments:12},scene),root,style,'handle','#182630');palm.position.set(x,-.058,-.125);palm.scaling.set(.65,.65,1.25);
  for(const z of [-.07,-.11,-.15]){const finger=attach(MeshBuilder.CreateCapsule(style+'-glove-finger',{height:.08,radius:.013,tessellation:10},scene),root,style,'handle','#283b45');finger.rotation.z=Math.PI/2;finger.position.set(x,-.028,z);}
  const wrist=attach(MeshBuilder.CreateCapsule(style+'-glove-wrist',{height:.17,radius:.035,tessellation:10},scene),root,style,'handle','#182630');wrist.rotation.x=Math.PI/2;wrist.position.set(x,-.075,-.245);
  if(style==='karambit'){const finger=attach(MeshBuilder.CreateCapsule('karambit-ring-finger',{height:.08,radius:.013,tessellation:10},scene),root,style,'handle','#283b45');finger.rotation.z=Math.PI/2;finger.position.set(0,-.005,-.23);}
 }
 const settle=(node:TransformNode,target:number,dt:number,active:boolean)=>{if(active)node.rotation.x=target;else{const a=Math.atan2(Math.sin(node.rotation.x),Math.cos(node.rotation.x));node.rotation.x=a*Math.exp(-dt*22);}};
 return {karambit,blade,bite,update(style,deploy,inspect,time,dt){
  const busy=deploy>=0||inspect>=0;
  let k=0,b=0,h=0;
  if(style==='karambit'){
   if(deploy>=0)k=(1-smooth(deploy))*Math.PI*2;
   else if(inspect>=0){const t=smooth(Math.max(0,Math.min(1,(inspect-.12)/.76)));k=t*Math.PI*2;}
   else k=Math.sin(time*1.9)*.035;
  }
  if(style==='butterfly'){
   if(deploy>=0)[b,h]=keys(deploy,[[0,Math.PI,Math.PI],[.28,2.3,-.5],[.62,-.3,4.8],[.85,.12,6.5],[1,0,Math.PI*2]]);
   else if(inspect>=0)[b,h]=keys(inspect,[[0,0,0],[.2,Math.PI,Math.PI],[.45,Math.PI*1.7,.3],[.7,Math.PI*2,Math.PI*2],[1,Math.PI*2,Math.PI*2]]);
  }
  settle(karambit,k,dt,style==='karambit'&&busy);if(style==='karambit'&&!busy)karambit.rotation.x=k;
  settle(blade,b,dt,style==='butterfly'&&busy);settle(bite,h,dt,style==='butterfly'&&busy);
 }};
}
