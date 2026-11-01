import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type {Scene} from '@babylonjs/core/scene';
import type {Solid} from './types';
/** Original mineral/enamel surface synthesis; no copied game textures or correlated RNG stripes. */
export function surfaceTexture(scene:Scene,key:string,color:string,surface:Solid['surface'],label?:string,resolution=128){
 if(typeof document==='undefined'||scene.getEngine().getClassName()==='NullEngine'||(!surface&&!label))return undefined;
 const size=label?256:resolution,t=new DynamicTexture(key,{width:size,height:label?64:size},scene,true),c=t.getContext() as unknown as CanvasRenderingContext2D;
 c.fillStyle=color;c.fillRect(0,0,size,label?64:size);
 if(label){c.fillStyle='#f9ecd5';c.font=`bold ${label.length>16?17:22}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(label,128,32,244);}
 else{
  const n=Math.min(size,512),canvas=document.createElement('canvas');canvas.width=canvas.height=n;const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(n,n);
  const base=[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)];
  const hash=(x:number,y:number)=>{let v=Math.imul(x,374761393)^Math.imul(y,668265263);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;};
  const noise=(x:number,y:number,period:number)=>{const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b,s=u*u*(3-2*u),q=v*v*(3-2*v);const at=(xx:number,yy:number)=>hash((xx+period)%period,(yy+period)%period);return (at(a,b)*(1-s)+at(a+1,b)*s)*(1-q)+(at(a,b+1)*(1-s)+at(a+1,b+1)*s)*q;};
  const stone=surface==='stone'||surface==='brick',mineral=stone||surface==='concrete'||surface==='plaster'||surface==='asphalt';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const u=x/n,v=y/n,coarse=noise(u*4,v*4,4),fine=noise(u*32,v*32,32),grain=hash(x,y);
   let value=mineral?(coarse-.5)*24+(fine-.5)*7+(grain-.5)*8:(coarse-.5)*7+(grain-.5)*3;
   if(stone){
    const rows=surface==='brick'?6:4,row=Math.floor(v*rows),xx=(u*4+(row%2)*.5)%1,yy=(v*rows)%1;
    const edge=Math.min(xx,1-xx,yy,1-yy),chip=noise(u*64,v*64,64)*.008;
    if(edge<.003+chip*.2)value-=7;else value+=(hash(Math.floor(u*4+(row%2)*.5),row)-.5)*12;
   }
   if(surface==='asphalt')value=(coarse-.5)*8+(grain-.5)*14;
   if(surface==='wood')value+=(noise(u*64,v*4,64)-.5)*7;
   const i=(y*n+x)*4;for(let k=0;k<3;k++)pixels.data[i+k]=Math.max(0,Math.min(255,base[k]+value));pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);c.imageSmoothingEnabled=true;c.drawImage(canvas,0,0,size,size);
  if(surface==='glass'){const g=c.createLinearGradient(0,0,size,size);g.addColorStop(0,'#c7dce533');g.addColorStop(1,'#15242c11');c.fillStyle=g;c.fillRect(0,0,size,size);}
  if(surface==='fabric'){c.fillStyle='#00000008';for(let x=0;x<size;x+=4)c.fillRect(x,0,1,size);}
 }
 t.update();t.anisotropicFilteringLevel=resolution>=512?8:2;return t;
}
