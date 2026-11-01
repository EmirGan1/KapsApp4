import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import {Scene} from '@babylonjs/core/scene';
import {Mesh} from '@babylonjs/core/Meshes/mesh';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {PointLight} from '@babylonjs/core/Lights/pointLight';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import type {Vec3} from './types';
import type {BombMatch} from './bomb';
/** Bounded, pooled CS-style C4 detonation visual effect. Its camera offsets never modify gameplay aim. */
export class BombEffects{
 private seen='';public age=10;private position:Vec3={x:0,y:0,z:0};
 private meshes:Mesh[]=[];private mats:StandardMaterial[]=[];
 private sparks:Mesh[]=[];private sparkMats:StandardMaterial[]=[];
 private scorchMesh?:Mesh;private scorchMat?:StandardMaterial;
 private blastLight?:PointLight;
 private textures:DynamicTexture[]=[];
 constructor(private scene:Scene){}
 update(blast:BombMatch['explosion'],dt:number,eye:Vec3,low:boolean){
  if(blast){
   const key=blast.at+':'+JSON.stringify(blast.position);
   if(key!==this.seen){
    this.seen=key;this.age=0;this.position={...blast.position};this.create();
   }
  }else if(this.age<3){
   this.age=10;this.seen='';
  }
  this.age+=Math.min(.1,Math.max(0,dt));
  const t=this.age;
  for(const [i,m] of this.meshes.entries()){
   m.setEnabled(t<3&&(i<2||!low||i<6));if(!m.isEnabled())continue;
   const mat=this.mats[i];m.position.set(this.position.x,this.position.y+.2,this.position.z);
   if(i===0){
    // Primary supersonic ground shockwave ring
    const size=1+t*28;
    m.scaling.set(size,1+t*1.5,size);
    mat.alpha=Math.max(0,.92*(1-t/.9));
   }else if(i===1){
    // Primary white-hot / orange C4 fireball core
    const scale=.6+t*15.5;
    m.scaling.setAll(scale);
    m.position.y+=1.1+t*1.4;
    m.rotation.y=t*2.4;
    const heat=Math.max(0,1-t/1.15);
    mat.emissiveColor=new Color3(1,.45+heat*.5,.15+heat*.65);
    mat.alpha=Math.max(0,.98*heat);
   }else if(i<5){
    // Secondary rising fireball lobes forming the CS C4 mushroom cap
    const n=i-2,a=n*2.094+t*1.2,r=(.4+t*2.4)*(1+n*.18);
    m.position.x+=Math.sin(a)*r;
    m.position.z+=Math.cos(a)*r;
    m.position.y+=.8+t*(3.2+n*.6);
    m.scaling.setAll(.8+t*(4.2+n*.5));
    mat.alpha=Math.max(0,.88*(1-t/1.75));
   }else{
    // Billowing dark smoke & ash column (persists up to t = 3.0s)
    const n=i-2,a=n*2.39996,r=(.35+t*2.1)*(1+n*.09);
    m.position.x+=Math.sin(a)*r;
    m.position.z+=Math.cos(a)*r;
    m.position.y+=t*(1.45+n*.18);
    m.scaling.setAll(.45+t*(1.35+n*.06));
    mat.alpha=Math.max(0,.72*(1-t/3));
   }
  }
  // Ballistic glowing sparks & debris chunks
  for(const [i,sp] of this.sparks.entries()){
   const active=t>0&&t<1.65&&(!low||i<6);
   sp.setEnabled(active);
   if(!active)continue;
   const angle=i*(Math.PI*2/Math.max(1,this.sparks.length))+0.37;
   const speed=7.5+(i%4)*3.2;
   const vy=6.8+(i%3)*2.6;
   sp.position.set(
    this.position.x+Math.cos(angle)*speed*t,
    Math.max(this.position.y+.08,this.position.y+.35+vy*t-.5*13.5*t*t),
    this.position.z+Math.sin(angle)*speed*t
   );
   sp.rotation.set(t*9+i,t*7,t*11);
   const sScale=Math.max(.2,1-t/1.65);
   sp.scaling.setAll(sScale);
   this.sparkMats[i].alpha=Math.max(0,1-t/1.65);
  }
  // Glowing ground crater / scorch mark
  if(this.scorchMesh&&this.scorchMat){
   const active=t>=0&&t<3;
   this.scorchMesh.setEnabled(active);
   if(active){
    this.scorchMesh.position.set(this.position.x,this.position.y+.04,this.position.z);
    const expand=Math.min(1,t/.25);
    this.scorchMesh.scaling.setAll(.8+expand*4.2);
    const glow=Math.max(0,1-t/1.2);
    this.scorchMat.emissiveColor=new Color3(.95*glow+.08,.38*glow+.06,.08*glow+.05);
    this.scorchMat.alpha=Math.max(0,.85*(1-t/3));
   }
  }
  // Dynamic blast point light illuminating the bombsite
  if(this.blastLight){
   const active=t>=0&&t<1.4;
   this.blastLight.setEnabled(active);
   if(active){
    this.blastLight.position.set(this.position.x,this.position.y+2.4,this.position.z);
    this.blastLight.intensity=Math.max(0,(1-t/1.4)*6.5);
   }
  }
  const d=Math.hypot(eye.x-this.position.x,eye.y-this.position.y,eye.z-this.position.z),strength=Math.max(0,1-d/75)*Math.max(0,1-t/1.5)*.032;
  if(!strength)return {x:0,y:0,z:0};
  return {x:Math.sin(t*79)*strength,y:Math.sin(t*97)*strength,z:Math.sin(t*61)*strength*.75};
 }
 private cloudTexture(fire:boolean){
  if(typeof document==='undefined'||this.scene.getEngine().getClassName()==='NullEngine')return undefined;
  const texture=new DynamicTexture('blast-cloud-'+fire,128,this.scene,false),c=texture.getContext() as unknown as CanvasRenderingContext2D;c.clearRect(0,0,128,128);
  for(let i=0;i<18;i++){const a=i*2.39996,r=i===0?0:12+((i*17)%25),x=64+Math.sin(a)*r,y=64+Math.cos(a)*r,size=fire?32:28;const g=c.createRadialGradient(x,y,0,x,y,size);const shade=130+(i*13)%85;g.addColorStop(0,fire?'rgba(255,248,205,.98)':`rgba(${shade},${shade},${shade},.72)`);g.addColorStop(.45,fire?'rgba(255,140,28,.82)':`rgba(${shade-35},${shade-35},${shade-30},.45)`);g.addColorStop(1,'rgba(40,35,30,0)');c.fillStyle=g;c.fillRect(x-size,y-size,size*2,size*2);}
  texture.hasAlpha=true;texture.update(false);this.textures.push(texture);return texture;
 }
 private create(){
  if(this.meshes.length)return;
  const smoke=this.cloudTexture(false),fire=this.cloudTexture(true);
  for(let i=0;i<14;i++){
   const m=i===0?MeshBuilder.CreateTorus('bomb-shockwave',{diameter:2,thickness:.14,tessellation:48},this.scene):i===1?MeshBuilder.CreateSphere('bomb-fireball',{diameter:2,segments:16},this.scene):MeshBuilder.CreatePlane('bomb-smoke-'+i,{size:2.2},this.scene);
   const isFire=i<5;
   const mat=new StandardMaterial('bomb-fx-'+i,this.scene);
   mat.diffuseColor=Color3.FromHexString(isFire?'#ffac46':'#55535a');
   mat.emissiveColor=Color3.FromHexString(isFire?'#ff701f':'#1f1e24');
   mat.specularColor=Color3.Black();mat.alpha=.65;mat.disableLighting=true;mat.backFaceCulling=false;
   if(i>0){
    if(i>1)m.billboardMode=Mesh.BILLBOARDMODE_ALL;
    const texture=isFire?fire:smoke;
    if(texture){
     mat.diffuseTexture=texture;mat.opacityTexture=texture;mat.emissiveTexture=texture;
     mat.emissiveColor=isFire?new Color3(1,.82,.52):new Color3(.58,.55,.52);
    }
    m.rotation.z=i*1.37;
   }
   m.material=mat;m.isPickable=false;m.checkCollisions=false;m.setEnabled(false);
   this.meshes.push(m);this.mats.push(mat);
  }
  for(let i=0;i<12;i++){
   const sp=MeshBuilder.CreateBox('bomb-debris-'+i,{width:.18,height:.12,depth:.26},this.scene);
   const smat=new StandardMaterial('bomb-debris-mat-'+i,this.scene);
   smat.disableLighting=true;
   smat.diffuseColor=Color3.FromHexString('#ffcc55');
   smat.emissiveColor=Color3.FromHexString(i%2===0?'#ff9922':'#ffee88');
   smat.specularColor=Color3.Black();
   sp.material=smat;sp.isPickable=false;sp.checkCollisions=false;sp.setEnabled(false);
   this.sparks.push(sp);this.sparkMats.push(smat);
  }
  this.scorchMesh=MeshBuilder.CreateDisc('bomb-scorch',{radius:1.2,tessellation:32},this.scene);
  this.scorchMesh.rotation.x=Math.PI/2;
  this.scorchMat=new StandardMaterial('bomb-scorch-mat',this.scene);
  this.scorchMat.disableLighting=true;this.scorchMat.backFaceCulling=false;
  this.scorchMat.diffuseColor=Color3.FromHexString('#1e1916');
  this.scorchMat.emissiveColor=Color3.FromHexString('#ff6b1a');
  this.scorchMat.specularColor=Color3.Black();
  this.scorchMesh.material=this.scorchMat;this.scorchMesh.isPickable=false;this.scorchMesh.setEnabled(false);
  this.blastLight=new PointLight('bomb-blast-light',new Vector3(0,2,0),this.scene);
  this.blastLight.diffuse=Color3.FromHexString('#ff9d42');
  this.blastLight.specular=Color3.FromHexString('#ffd28a');
  this.blastLight.range=42;
  this.blastLight.intensity=0;
  this.blastLight.setEnabled(false);
 }
 dispose(){
  for(const m of this.meshes)m.dispose();
  for(const m of this.mats)m.dispose();
  for(const sp of this.sparks)sp.dispose();
  for(const sm of this.sparkMats)sm.dispose();
  this.scorchMesh?.dispose();this.scorchMat?.dispose();
  this.blastLight?.dispose();
  for(const t of this.textures)t.dispose();
  this.meshes=[];this.mats=[];this.sparks=[];this.sparkMats=[];this.textures=[];
 }
}
