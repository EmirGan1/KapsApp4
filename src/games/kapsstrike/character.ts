import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { cleanSkin, SKINS } from './skins';
import { TARGET_HITBOXES as H } from './config';
/** Cosmetics never become collision/hit geometry. All variants retain identical server hitboxes. */
export function createCharacter(scene:Scene,id:string,skinValue:unknown,team='none',outline=false,outlineColor='#ff315d'){
 const skin=SKINS[cleanSkin(skinValue)];
 const root=new TransformNode(`character-${id}`,scene);
 const materials:StandardMaterial[]=[];
 const cache=new Map<string,StandardMaterial>();
 const material=(color:string,accent=false)=>{
  const key=color+accent;let m=cache.get(key);if(m)return m;
  m=new StandardMaterial(`${id}-${key}`,scene);m.diffuseColor=Color3.FromHexString(color);m.specularColor=Color3.Black();
  m.emissiveColor=m.diffuseColor.scale(accent ? 0.25 : 0.07);m.freeze();cache.set(key,m);materials.push(m);return m;
 };
 const part=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,accent=false)=>{
  const m=MeshBuilder.CreateBox(`${id}-${name}`,{width:w,height:h,depth:d},scene);m.parent=root;m.position.set(x,y,z);m.material=material(color,accent);m.isPickable=false;return m;
 };
 const body=part('body',0,(H.body.min+H.body.max)/2,0,H.body.radius*2,H.body.max-H.body.min,H.body.radius*2,skin.body);
 const head=part('head',0,(H.head.min+H.head.max)/2,0,H.head.radius*2,H.head.radius*2,H.head.radius*2,'#d8bba4');
 const gearRoot=new TransformNode(`${id}-gear`,scene);gearRoot.parent=root;
 const gear=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=part(name,x,y,z,w,h,d,color);m.parent=gearRoot;return m;};
 const teamColor=team==='red'?'#ed6a66':team==='blue'?'#68adf0':'#f39265';
 gear('team-band',0,1.12,.355,.6,.12,.035,teamColor).material=material(teamColor,true);
 gear('belt',0,.48,0,.7,.085,.7,skin.trim);
 gear('arm-l',-.41,1,0,.17,.62,.22,skin.body);gear('arm-r',.41,1,0,.17,.62,.22,skin.body);
 if(skin.gear==='helmet') {gear('helmet',0,1.84,0,.5,.16,.5,skin.trim);gear('pack',0,.97,-.41,.46,.56,.18,skin.trim);}
 if(skin.gear==='hood') {gear('hood',0,1.8,-.08,.5,.24,.4,skin.body);gear('scarf',0,1.41,.08,.48,.13,.4,skin.trim);}
 if(skin.gear==='antenna') {gear('antenna',.25,1.98,0,.035,.38,.035,skin.trim);gear('powerpack',0,1.04,-.4,.34,.5,.17,skin.trim);}
 if(skin.gear==='visor') {gear('visor',0,1.68,.24,.5,.12,.035,skin.trim);gear('shoulder',-.45,1.29,0,.24,.2,.3,skin.trim);}
 if(skin.gear==='hat') {gear('brim',0,1.84,0,.7,.035,.6,skin.trim);gear('hat-top',0,1.91,0,.4,.13,.38,skin.body);gear('scarf',0,1.39,.07,.51,.16,.45,skin.trim);}
 if(skin.gear==='parka') {gear('collar',0,1.4,0,.64,.19,.53,skin.trim);gear('hood',0,1.8,-.1,.54,.25,.41,skin.body);gear('coat-tail',0,.4,-.23,.65,.3,.19,skin.body);}
 if(skin.gear==='fins') {gear('fin-l',-.28,1.83,0,.1,.4,.23,skin.trim);gear('fin-r',.28,1.83,0,.1,.4,.23,skin.trim);gear('visor',0,1.67,.24,.44,.1,.04,skin.trim);}
 if(skin.gear==='cap') {gear('cap',0,1.84,0,.48,.13,.47,skin.trim);gear('cap-brim',0,1.81,.3,.5,.035,.25,skin.trim);gear('pad-r',.43,1.3,0,.25,.19,.35,skin.trim);}
 if(outline) for(const mesh of [body,head]) {
  const shell=MeshBuilder.CreateBox(`${id}-${mesh.name}-outline`,{width:mesh===body?H.body.radius*2:H.head.radius*2,height:mesh===body?H.body.max-H.body.min:H.head.radius*2,depth:mesh===body?H.body.radius*2:H.head.radius*2,sideOrientation:Mesh.BACKSIDE},scene);
  shell.parent=mesh;shell.scaling.setAll(1.045);
  const rim=new StandardMaterial(`${id}-outline-${outlineColor}`,scene);
  rim.diffuseColor=Color3.FromHexString(outlineColor);rim.emissiveColor=rim.diffuseColor;
  rim.specularColor=Color3.Black();rim.disableLighting=true;rim.alpha=1;rim.backFaceCulling=false;rim.freeze();materials.push(rim);
  shell.material=rim;shell.isPickable=false;
 }
 const normal=body.material;
 return {root,body,head,gearRoot,skin:cleanSkin(skinValue),team,flash:(enabled:boolean)=>{body.material=enabled?material('#f9e7cf',true):normal;},dispose:()=>{root.dispose();for(const m of materials)m.dispose();}};
}
