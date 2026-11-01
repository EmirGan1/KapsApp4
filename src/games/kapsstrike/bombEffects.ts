import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import type {Vec3} from './types';
import type {BombMatch} from './bomb';
/** Bounded, pooled visual effect. Its camera offsets never modify gameplay aim. */
export class BombEffects{
 private seen='';private age=10;private position:Vec3={x:0,y:0,z:0};private meshes:Mesh[]=[];private mats:StandardMaterial[]=[];private textures:DynamicTexture[]=[];
 constructor(private scene:Scene){}
 update(blast:BombMatch['explosion'],dt:number,eye:Vec3,low:boolean){
  if(blast){const key=blast.at+':'+JSON.stringify(blast.position);if(key!==this.seen){this.seen=key;this.age=0;this.position={...blast.position};this.create();}}
  this.age+=Math.min(.1,Math.max(0,dt));const t=this.age;
  for(const [i,m] of this.meshes.entries()){
   m.setEnabled(t<3&&(i<2||!low||i<5));if(!m.isEnabled())continue;
   const mat=this.mats[i];m.position.set(this.position.x,this.position.y+.2,this.position.z);
   if(i===0){const size=1+t*23;m.scaling.set(size,1,size);mat.alpha=Math.max(0,.8*(1-t/.85));}
   else if(i===1){m.scaling.setAll(.4+t*13);mat.alpha=Math.max(0,.8*(1-t/.4));}
   else {const n=i-2,a=n*2.39996,r=(.3+t*1.8)*(1+n*.1);m.position.x+=Math.sin(a)*r;m.position.z+=Math.cos(a)*r;m.position.y+=t*(1.2+n*.15);m.scaling.setAll(.3+t*(1+n*.04));mat.alpha=Math.max(0,.6*(1-t/3));}
  }
  const d=Math.hypot(eye.x-this.position.x,eye.y-this.position.y,eye.z-this.position.z),strength=Math.max(0,1-d/65)*Math.max(0,1-t/1.3)*.024;
  if(!strength)return {x:0,y:0,z:0};
  return {x:Math.sin(t*73)*strength,y:Math.sin(t*91)*strength,z:Math.sin(t*57)*strength*.7};
 }
 private cloudTexture(fire:boolean){
  if(typeof document==='undefined'||this.scene.getEngine().getClassName()==='NullEngine')return undefined;
  const texture=new DynamicTexture('blast-cloud-'+fire,128,this.scene,false),c=texture.getContext() as unknown as CanvasRenderingContext2D;c.clearRect(0,0,128,128);
  for(let i=0;i<18;i++){const a=i*2.39996,r=i===0?0:12+((i*17)%25),x=64+Math.sin(a)*r,y=64+Math.cos(a)*r,size=fire?30:26;const g=c.createRadialGradient(x,y,0,x,y,size);const shade=130+(i*13)%85;g.addColorStop(0,fire?'rgba(255,241,188,.95)':`rgba(${shade},${shade},${shade},.65)`);g.addColorStop(.45,fire?'rgba(255,155,41,.75)':`rgba(${shade-35},${shade-35},${shade-30},.4)`);g.addColorStop(1,'rgba(40,35,30,0)');c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);}
  texture.hasAlpha=true;texture.update(false);this.textures.push(texture);return texture;
 }
 private create(){
  if(this.meshes.length)return;
  const smoke=this.cloudTexture(false),fire=this.cloudTexture(true);
  for(let i=0;i<12;i++){
   const m=i===0?MeshBuilder.CreateTorus('bomb-shockwave',{diameter:2,thickness:.055,tessellation:48},this.scene):MeshBuilder.CreatePlane(i===1?'bomb-fireball':'bomb-smoke-'+i,{size:2},this.scene);
   const mat=new StandardMaterial('bomb-fx-'+i,this.scene);mat.diffuseColor=Color3.FromHexString(i<2?'#ffac46':'#55535a');mat.emissiveColor=Color3.FromHexString(i<2?'#ff701f':'#151519');mat.specularColor=Color3.Black();mat.alpha=.6;mat.disableLighting=true;mat.backFaceCulling=false;if(i>0){m.billboardMode=Mesh.BILLBOARDMODE_ALL;const texture=i===1?fire:smoke;if(texture){mat.diffuseTexture=texture;mat.opacityTexture=texture;mat.emissiveTexture=texture;mat.emissiveColor=i===1?new Color3(1,.8,.55):new Color3(.55,.53,.50);}m.rotation.z=i*1.37;}m.material=mat;m.isPickable=false;m.checkCollisions=false;this.meshes.push(m);this.mats.push(mat);
  }
 }
 dispose(){for(const m of this.meshes)m.dispose();for(const m of this.mats)m.dispose();for(const t of this.textures)t.dispose();this.meshes=[];this.mats=[];this.textures=[];}
}
