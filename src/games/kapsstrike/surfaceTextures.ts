import {DynamicTexture} from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type {Scene} from '@babylonjs/core/scene';
import type {Solid} from './types';

/** High-fidelity procedural surface textures; organic stucco, stone flagstones, masonry bricks, and weathered materials without crude lines. */
export function surfaceTexture(scene:Scene,key:string,color:string,surface:Solid['surface'],label?:string,resolution=128){
 if(typeof document==='undefined'||scene.getEngine().getClassName()==='NullEngine'||(!surface&&!label))return undefined;
 const size=label?256:resolution;
 const texture=new DynamicTexture(key,{width:size,height:label?64:size},scene,true);
 const c=texture.getContext() as unknown as CanvasRenderingContext2D;
 c.fillStyle=color;c.fillRect(0,0,size,label?64:size);

 if(label){
  c.fillStyle='rgba(15,23,42,0.85)';c.fillRect(2,2,size-4,60);
  c.strokeStyle='#f59e0b';c.lineWidth=3;c.strokeRect(4,4,size-8,56);
  c.fillStyle='#fef3c7';c.font=`900 ${label.length>16?17:21}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(label,size/2,33,size-20);
 }else{
  c.save();
  const s=size/128;
  c.scale(s,s);

  let seed=148923;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed>>>0)/4294967296;};

  // Base subtle micro-mottling
  for(let i=0;i<48;i++){
   const px=rand()*128,py=rand()*128,pr=6+rand()*16;
   const g=c.createRadialGradient(px,py,0,px,py,pr);
   g.addColorStop(0,rand()>.5?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.07)');
   g.addColorStop(1,'rgba(0,0,0,0)');
   c.fillStyle=g;c.fillRect(px-pr,py-pr,pr*2,pr*2);
  }

  if(surface==='stone'){
   // Realistic flagstone / cobblestone paver blocks with organic bevels, varied tones and mortar recesses
   const cols=4,rows=4,cellW=128/cols,cellH=128/rows;
   for(let r=0;r<rows;r++){
    const y=r*cellH;
    const xOffset=(r%2)*(cellW*0.5);
    for(let col=-1;col<=cols;col++){
     const x=col*cellW+xOffset;
     const stoneW=cellW-3+rand()*2-1;
     const stoneH=cellH-3+rand()*2-1;
     const stoneRadius=3;
     // Recessed mortar background
     c.fillStyle='rgba(30,25,20,0.45)';
     c.fillRect(x+1,y+1,stoneW+2,stoneH+2);
     // Varied stone tone
     const shade=rand();
     c.fillStyle=shade>0.6?'rgba(255,255,255,0.12)':shade<0.3?'rgba(0,0,0,0.14)':'rgba(255,255,255,0.02)';
     c.beginPath();
     c.roundRect(x+1.5,y+1.5,stoneW-1,stoneH-1,stoneRadius);
     c.fill();
     // Chiseled bevel highlight (top & left)
     c.strokeStyle='rgba(255,255,255,0.22)';c.lineWidth=1;
     c.beginPath();
     c.moveTo(x+2,y+stoneH);c.lineTo(x+2,y+2);c.lineTo(x+stoneW,y+2);
     c.stroke();
     // Chiseled bevel shadow (bottom & right)
     c.strokeStyle='rgba(0,0,0,0.35)';
     c.beginPath();
     c.moveTo(x+stoneW,y+2);c.lineTo(x+stoneW,y+stoneH);c.lineTo(x+2,y+stoneH);
     c.stroke();
     // Natural surface pit flecks
     for(let f=0;f<4;f++){
      c.fillStyle=rand()>.5?'rgba(255,255,255,0.18)':'rgba(0,0,0,0.25)';
      c.fillRect(x+3+rand()*(stoneW-6),y+3+rand()*(stoneH-6),1.2,1.2);
     }
    }
   }
  }

  if(surface==='brick'){
   // Running bond masonry bricks with authentic mortar beds and tone variation
   const rows=8,rowH=128/rows,brickW=128/3.5;
   for(let r=0;r<rows;r++){
    const y=r*rowH;
    const xShift=(r%2)*(brickW*0.5);
    // Dark mortar seam
    c.fillStyle='rgba(45,35,30,0.4)';
    c.fillRect(0,y,128,1.8);
    for(let bx=-1;bx<=4;bx++){
     const x=bx*brickW+xShift;
     c.fillRect(x,y,1.8,rowH);
     // Brick body tone
     const bTone=rand();
     c.fillStyle=bTone>0.7?'rgba(255,220,180,0.1)':bTone<0.3?'rgba(50,20,10,0.18)':'rgba(255,255,255,0.03)';
     c.fillRect(x+2,y+2,brickW-2.5,rowH-2.5);
     // Top edge highlight
     c.fillStyle='rgba(255,255,255,0.14)';
     c.fillRect(x+2,y+2,brickW-2.5,1);
    }
   }
  }

  if(surface==='plaster'||surface==='concrete'||surface==='asphalt'){
   // Multi-octave mineral stucco trowel finish without artificial grid lines
   for(let i=0;i<32;i++){
    const px=rand()*128,py=rand()*128,pr=10+rand()*24;
    const g=c.createRadialGradient(px,py,0,px,py,pr);
    g.addColorStop(0,rand()>.45?'rgba(255,250,235,0.1)':'rgba(25,35,45,0.12)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=g;c.fillRect(px-pr,py-pr,pr*2,pr*2);
   }
   if(surface==='asphalt'){
    // Dense aggregate road specks and micro-pitting
    c.fillStyle='rgba(200,215,225,0.16)';
    for(let i=0;i<400;i++){
     c.fillRect(rand()*128,rand()*128,0.85,0.85);
    }
    c.fillStyle='rgba(15,20,25,0.25)';
    for(let i=0;i<300;i++){
     c.fillRect(rand()*128,rand()*128,1.2,1.2);
    }
   }
   if(surface==='concrete'){
    // Subtle formwork panel seams with tie holes
    c.strokeStyle='rgba(40,50,45,0.2)';c.lineWidth=1;
    c.strokeRect(2,2,124,124);
    for(const [tx,ty] of [[12,12],[116,12],[12,116],[116,116]]){
     c.fillStyle='rgba(15,20,18,0.45)';c.beginPath();c.arc(tx,ty,2,0,Math.PI*2);c.fill();
     c.strokeStyle='rgba(255,255,255,0.2)';c.stroke();
    }
   }
  }

  if(surface==='metal'){
   // Brushed tactical gunmetal: fine horizontal brush streaks, panel rivets, beveled edges
   for(let y=0;y<128;y+=2){
    c.fillStyle=rand()>.5?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.12)';
    c.fillRect(0,y,128,1);
   }
   // Border chamfer & rivets
   c.strokeStyle='rgba(255,255,255,0.18)';c.lineWidth=1;
   c.strokeRect(2,2,124,124);
   c.strokeStyle='rgba(0,0,0,0.4)';
   c.strokeRect(3,3,122,122);
   for(const [rx,ry] of [[8,8],[120,8],[8,120],[120,120]]){
    c.fillStyle='rgba(10,15,20,0.6)';c.beginPath();c.arc(rx,ry,2.2,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(255,255,255,0.3)';c.beginPath();c.arc(rx-0.6,ry-0.6,0.9,0,Math.PI*2);c.fill();
   }
  }

  if(surface==='wood'){
   // Natural organic wood grain planks
   const plankH=128/4;
   for(let p=0;p<4;p++){
    const y=p*plankH;
    c.fillStyle='rgba(20,12,6,0.35)';c.fillRect(0,y+plankH-1.5,128,1.5);
    c.fillStyle='rgba(255,230,190,0.1)';c.fillRect(0,y+0.5,128,1);
    for(let g=0;g<5;g++){
     c.strokeStyle=rand()>.5?'rgba(40,25,15,0.25)':'rgba(255,220,170,0.12)';c.lineWidth=1;
     c.beginPath();
     const startY=y+3+rand()*(plankH-6);
     c.moveTo(0,startY);
     c.bezierCurveTo(40,startY+rand()*4-2,80,startY+rand()*4-2,128,startY+rand()*2-1);
     c.stroke();
    }
   }
  }

  if(surface==='glass'){
   c.fillStyle='rgba(196,228,236,0.25)';
   c.beginPath();c.moveTo(10,0);c.lineTo(45,0);c.lineTo(115,128);c.lineTo(80,128);c.fill();
   c.fillStyle='rgba(255,255,255,0.2)';
   c.beginPath();c.moveTo(55,0);c.lineTo(65,0);c.lineTo(128,100);c.lineTo(128,116);c.fill();
  }

  if(surface==='water'){
   for(let y=4;y<128;y+=14){
    c.strokeStyle='rgba(180,225,245,0.25)';c.lineWidth=1.8;
    c.beginPath();c.moveTo(0,y);
    c.bezierCurveTo(32,y-4,64,y+4,96,y-3);
    c.bezierCurveTo(112,y+2,120,y,128,y);
    c.stroke();
   }
  }

  if(surface==='fabric'){
   // Woven canvas texture with soft awning bands
   for(let x=0;x<128;x+=24){
    c.fillStyle='rgba(255,255,255,0.15)';
    c.fillRect(x,0,12,128);
   }
   for(let i=0;i<128;i+=4){
    c.fillStyle='rgba(0,0,0,0.06)';
    c.fillRect(0,i,128,1);
   }
  }

  c.restore();

  // High-frequency surface grain at native resolution
  let fine=3719;
  for(let i=0;i<size*size/32;i++){
   fine=(Math.imul(fine,1664525)+1013904223)>>>0;
   const x=fine%size;
   fine=(Math.imul(fine,1664525)+1013904223)>>>0;
   const y=fine%size;
   c.fillStyle=i%2?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)';
   c.fillRect(x,y,1,1);
  }
 }

 // Ultra-fine weathering for high resolution tiles
 if(!label&&resolution>=512){
  let grain=71473;const random=()=>{grain=(Math.imul(grain,1664525)+1013904223)>>>0;return (grain>>>0)/4294967296;};
  if(surface==='brick'||surface==='stone'||surface==='concrete'||surface==='plaster'){
   for(let i=0;i<30;i++){
    let x=random()*size,y=random()*size;
    c.strokeStyle='rgba(25,32,40,0.18)';c.lineWidth=0.75;
    c.beginPath();c.moveTo(x,y);
    for(let j=0;j<3;j++){x+=(random()-0.5)*size*0.02;y+=random()*size*0.015;c.lineTo(x,y);}
    c.stroke();
   }
  }
 }

 texture.update();
 texture.anisotropicFilteringLevel=resolution>=512?8:2;
 return texture;
}
