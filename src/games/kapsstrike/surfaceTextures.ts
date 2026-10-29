import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type {Scene} from '@babylonjs/core/scene';
import type {Solid} from './types';
/** Original, deterministic, reusable 128px material tiles. No downloads or external asset licences. */
export function surfaceTexture(scene:Scene,key:string,color:string,surface:Solid['surface'],label?:string){
 if(typeof document==='undefined'||scene.getEngine().getClassName()==='NullEngine'||(!surface&&!label))return undefined;
 const size=label?256:128;
 const texture=new DynamicTexture(key,{width:size,height:label?64:size},scene,true);
 const c=texture.getContext() as unknown as CanvasRenderingContext2D;
 c.fillStyle=color;c.fillRect(0,0,size,label?64:size);
 if(label){
  c.strokeStyle='#e0e9e0';c.lineWidth=2;c.strokeRect(4,4,248,56);
  c.fillStyle='#f1f0df';c.font=`bold ${label.length>16?17:21}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(label,128,33,236);
 }else{
  let seed=9127;for(let i=0;i<1600;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%128;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%128;c.fillStyle=i%2?'#ffffff12':'#00000012';c.fillRect(x,y,surface==='metal'?1:2,1);}
  if(surface==='brick'||surface==='stone'){
   c.strokeStyle='#302b2845';c.lineWidth=surface==='stone'?2:3;
   const rows=surface==='stone'?3:4;
   for(let r=0;r<rows;r++){const y=r*128/rows;c.beginPath();c.moveTo(0,y);c.lineTo(128,y);c.stroke();for(let x=(r%2)*32;x<=128;x+=64){c.beginPath();c.moveTo(x,y);c.lineTo(x,y+128/rows);c.stroke();}}
  }
  if(surface==='wood'){c.strokeStyle='#37271b50';for(let x=0;x<128;x+=21){c.beginPath();c.moveTo(x,0);c.lineTo(x+1,128);c.stroke();}c.strokeStyle='#e0c9a22a';for(let y=4;y<128;y+=13){c.beginPath();c.moveTo(0,y);c.lineTo(128,y+8);c.stroke();}}
  if(surface==='metal'){for(let x=0;x<128;x+=16){c.fillStyle='#ffffff16';c.fillRect(x,0,2,128);c.fillStyle='#00000020';c.fillRect(x+2,0,1,128);}c.fillStyle='#202b3555';for(const x of [5,121])for(const y of [5,121])c.fillRect(x,y,3,3);}
  if(surface==='concrete'){c.strokeStyle='#3f47432b';c.strokeRect(1,1,126,126);c.beginPath();c.moveTo(39,0);c.lineTo(45,15);c.lineTo(42,24);c.stroke();}
  if(surface==='glass'){c.fillStyle='#c4e4ec22';c.beginPath();c.moveTo(15,0);c.lineTo(45,0);c.lineTo(110,128);c.lineTo(80,128);c.fill();c.fillStyle='#c4e4ec12';c.fillRect(0,87,128,10);}
  if(surface==='water'){c.strokeStyle='#b7dae24a';c.lineWidth=2;for(let y=5;y<128;y+=17){c.beginPath();c.moveTo(0,y);c.bezierCurveTo(35,y-7,75,y+7,128,y);c.stroke();}}
  if(surface==='fabric'){c.fillStyle='#e5cc922a';for(let x=0;x<128;x+=32)c.fillRect(x,0,14,128);}
 }
 texture.update();texture.anisotropicFilteringLevel=4;return texture;
}
