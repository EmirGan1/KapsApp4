import type {MapDefinition,Solid,Vec3} from './types';
import {BOMB_SITES} from './bomb';
import {addDust2Architecture,carvedOpening} from './dust2Architecture';
import {fits,surface,overlaps,support} from './physics';
import {PHYSICS} from './config';
import {DUST2_FOOTPRINT,RADAR_METRES} from './dust2Footprint';
export const dust2Point=(px:number,py:number):Vec3=>({x:(px-512)*RADAR_METRES,y:0,z:(512-py)*RADAR_METRES});
export const DUST2_AREAS={
 'T Spawn':[390,920],'CT Spawn':[600,210],'Bombsite A':[820,172],'Bombsite B':[210,130],
 'A Long':[895,410],'A Long Doors':[710,640],'A Short / Catwalk':[626,405],Mid:[484,480],
 'Mid Doors':[464,374],'Upper Tunnels':[180,455],'Lower Tunnels':[370,410],
 'B Tunnels':[175,290],'B Doors':[260,235],'B Window':[320,170],'CT Mid':[540,250],
 'A Ramp':[842,240],'A Site':[820,172],'B Site':[210,130],
} as const;
/** Radar-derived horizontal reconstruction. Not a claim of measured Source 2 mesh parity. */
 export function dustDistrict():MapDefinition{
 const n=128,cell=8*RADAR_METRES,solids:Solid[]=[];let serial=0;
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#c8b99e',detail=false,surface:Solid['surface']='plaster')=>{
  const s:Solid={id:`district-${name}-${serial++}`,kind:'box',x,y,z,w,h,d,color,detail,surface};solids.push(s);return s;
 };
 const closed=DUST2_FOOTPRINT.map((r,iy)=>[...r].map((c,ix)=>{const p=dust2Point(ix*8+4,iy*8+4);return c==='0'&&!carvedOpening(p.x,p.z);})),used=closed.map(r=>r.map(()=>false));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  if(!closed[y][x]||used[y][x])continue;
  let w=1,d=1;while(w<24&&x+w<n&&closed[y][x+w]&&!used[y][x+w])w++;
  outer:while(d<24&&y+d<n){for(let a=0;a<w;a++)if(!closed[y+d][x+a]||used[y+d][x+a])break outer;d++;}
  for(let b=0;b<d;b++)for(let a=0;a<w;a++)used[y+b][x+a]=true;
  const p=dust2Point(x*8+w*4,y*8+d*4),h=6.5+(x+y)%3;
  box('city-block',p.x,0,p.z,w*cell,h,d*cell,['#c8b99e','#d4c5ac','#bcae96'][(x+y)%3]);
  box('cornice',p.x,h,p.z,w*cell+.12,.18,d*cell+.12,'#e2d2b8',true,'stone');
  if(w>=3&&d>=3){
   box('block-plinth',p.x,0,p.z,w*cell+.08,.42,d*cell+.08,'#a89376',true,'stone');
   box('block-frieze',p.x,h-.55,p.z,w*cell+.1,.14,d*cell+.1,'#b59e7d',true,'stone');
  }
 }
 const walkable=(x:number,z:number)=>{const ix=Math.floor(x/cell+64),iy=Math.floor(64-z/cell);return ix>=0&&iy>=0&&ix<n&&iy<n&&!closed[iy][ix];};
 for(const name of ['A Long Doors','Mid Doors'] as const){
  const p=dust2Point(DUST2_AREAS[name][0],DUST2_AREAS[name][1]);
  for(const side of [-1,1])box('door-leaf',p.x+side*1.3,0,p.z,.65,2.8,.18,'#797367',false,'wood');
  for(const side of [-1,1]){box('door-jamb',p.x+side*1.95,0,p.z,.3,3.7,.4,'#bda98a');for(let k=0;k<3;k++)box('door-ironwork',p.x+side*1.3,.5+k*.8,p.z-.12,.6,.07,.08,'#4d5049',true,'metal');}
  box('door-arch-header',p.x,3.4,p.z,4.2,.35,.4,'#d2bc99');
  if(name==='A Long Doors'){
   box('long-doors-ceiling',p.x,3.8,p.z,4.2,.3,7,'#a99578');
   for(const side of [-1,1])box('long-doors-chamber-pier',p.x+side*1.95,0,p.z-3.2,.32,3.8,.45,'#bda98a',true,'stone');
   box('long-doors-south-arch',p.x,3.4,p.z-3.2,4.2,.4,.45,'#d2bc99',true,'stone');
  }
 }
 const terrain=addDust2Architecture(solids,walkable);
 const heightAt=(x:number,z:number)=>Math.max(0,...terrain.filter(s=>overlaps(s,{x,y:0,z},.01)).map(s=>surface(s,x,z)));
 const navMap={id:'district',solids} as MapDefinition;
 const nav=closed.map((row,y)=>row.map((blocked,x)=>{const p=dust2Point(x*8+4,y*8+4);p.y=heightAt(p.x,p.z);return !blocked&&fits(navMap,p,PHYSICS.standing)?p:null;}));
 const nearest=(px:number,py:number)=>{
  let best={x:0,y:0},dist=Infinity;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(nav[y][x]){const d=(x*8+4-px)**2+(y*8+4-py)**2;if(d<dist){dist=d;best={x,y};}}
  return best;
 };
 const spawn=(px:number,py:number)=>{const p=nearest(px,py);return {...nav[p.y][p.x]!};};
 const path=(name:string,from:readonly number[],to:readonly number[])=>{
  const a=nearest(from[0],from[1]),b=nearest(to[0],to[1]),start=a.y*n+a.x,target=b.y*n+b.x;
  const edge=(a:Vec3,b:Vec3)=>{let y=a.y;const length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length/.1);
    for(let i=1;i<=steps;i++){const p={x:a.x+(b.x-a.x)*i/steps,y,z:a.z+(b.z-a.z)*i/steps};p.y=support(navMap,p,y+PHYSICS.step);if(!fits(navMap,p,PHYSICS.standing))return false;y=p.y;}return Math.abs(y-b.y)<.35;};
  const queue=[start],prev=new Map<number,number>([[start,-1]]);
  for(let i=0;i<queue.length&&!prev.has(target);i++){
   const v=queue[i],x=v%n,y=Math.floor(v/n);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*n+xx;if(xx<0||yy<0||xx>=n||yy>=n||!nav[yy][xx]||Math.abs(nav[yy][xx]!.y-nav[y][x]!.y)>.65||prev.has(k)||!edge(nav[y][x]!,nav[yy][xx]!))continue;prev.set(k,v);queue.push(k);}
  }
  if(!prev.has(target))throw new Error(`Disconnected Dust II route: ${name}`);
  const result:number[]=[];for(let v=target;v!==-1;v=prev.get(v)!)result.push(v);result.reverse();
  return{name,points:result.map(v=>({...nav[Math.floor(v/n)][v%n]!}))};
 };
 const routes=[path('T → A',DUST2_AREAS['T Spawn'],DUST2_AREAS['A Site']),path('T → B',DUST2_AREAS['T Spawn'],DUST2_AREAS['B Site']),path('CT → A',DUST2_AREAS['CT Spawn'],DUST2_AREAS['A Site']),path('CT → B',DUST2_AREAS['CT Spawn'],DUST2_AREAS['B Site'])];
 for(const s of BOMB_SITES){
  box('site-paving',s.x,s.y+.02,s.z,s.radius*2,.03,s.radius*2,'#c4b28f',true,'stone');
  const sign=box('site-sign',s.x,s.y+2.8,s.z+s.radius+.3,2.5,1,.1,'#a65b35',true);sign.label='BOMBSITE '+s.id;
 }
 const spawns=[-16,-8,0,8,16].map(dx=>spawn(390+dx,920)).concat([-16,-8,0,8,16].map(dx=>spawn(600+dx,210)));
 // Matching neighborhood gateway boards mounted flush against outer building facades.
 for(const [text,x,z,color] of [
  ['Gazeteciler Sitesi',-10,-47.2,'#315c49'],
  ['Yeni Nesil Eyüp Sitesi',48.0,-16.9,'#244f75'],
 ] as [string,number,number,string][]){
  box('neighborhood-sign-post',x,0,z,.18,3.6,.18,'#3b4348',true,'metal');
  const board=box('neighborhood-sign-board',x,3.55,z,6.8,1.15,.18,color,true,'metal');
  board.label=text;
  box('neighborhood-sign-trim',x,4.15,z,6.95,.08,.22,'#d3ad5d',true,'metal');
 }
 // Interior & exterior photo frames across tunnels, chambers and exposed city-block walls.
 const photoFrames:NonNullable<MapDefinition['photoFrames']>=[];
 const photoAspects:readonly number[]=[.5625,.5625,4/3,16/9,.75,4/3,.75,1.803,4/3,4/3,4/3,4/3,.75,.75,.75];
 const interiorSlots:{x:number;y:number;z:number;rotationY:number;wallLength:number;wallHeight:number}[]=[
  // B Tunnels interior walls
  {x:-47.28,y:4.3,z:17.5,rotationY:Math.PI/2,wallLength:5.2,wallHeight:3.4},
  {x:-42.72,y:4.3,z:26.5,rotationY:-Math.PI/2,wallLength:5.2,wallHeight:3.4},
  {x:-47.28,y:4.3,z:26.5,rotationY:Math.PI/2,wallLength:5.2,wallHeight:3.4},
  // Upper Tunnels interior walls
  {x:-42.75,y:4.3,z:4.5,rotationY:Math.PI/2,wallLength:4.4,wallHeight:3.4},
  {x:-28.25,y:4.3,z:5.1,rotationY:-Math.PI/2,wallLength:5.0,wallHeight:3.4},
  // Lower Tunnels interior walls
  {x:-17.5,y:1.85,z:11.98,rotationY:Math.PI,wallLength:4.8,wallHeight:2.6},
  {x:-13.5,y:1.85,z:8.02,rotationY:0,wallLength:4.8,wallHeight:2.6},
  // CT Underpass interior wall
  {x:22,y:1.55,z:31.85,rotationY:0,wallLength:4.2,wallHeight:2.2},
 ];
 const facades:{solid:Solid;x:number;z:number;rotationY:number;wallLength:number}[]=[];
 for(const wall of solids.filter(s=>s.id.includes('city-block'))){
  for(const side of [-1,1]){
   const x=wall.x+side*(wall.w/2+.13),z=wall.z;
   if(walkable(x,z))facades.push({solid:wall,x,z,rotationY:side>0?Math.PI/2:-Math.PI/2,wallLength:wall.d});
   const fx=wall.x,fz=wall.z+side*(wall.d/2+.13);
   if(walkable(fx,fz))facades.push({solid:wall,x:fx,z:fz,rotationY:side>0?0:Math.PI,wallLength:wall.w});
  }
 }
 facades.sort((a,b)=>b.wallLength-a.wallLength);
 const exteriorSlots:{x:number;y:number;z:number;rotationY:number;wallLength:number;wallHeight:number}[]=[];
 const usedWalls=new Set<string>();
 for(const facade of facades){
  if(exteriorSlots.length>=12)break;
  if(usedWalls.has(facade.solid.id)||facade.wallLength<5||facade.solid.h<5)continue;
  exteriorSlots.push({x:facade.x,y:facade.solid.h*.54,z:facade.z,rotationY:facade.rotationY,wallLength:facade.wallLength,wallHeight:facade.solid.h});
  usedWalls.add(facade.solid.id);
 }
 const allSlots=[... exteriorSlots.slice(0,8), ...interiorSlots, ...exteriorSlots.slice(8)];
 const order=[1,8,3,11,5,14,2,9,6,12,4,15,7,10,13];
 for(let i=0;i<allSlots.length;i++){
  const slot=allSlots[i];
  const photoNum=order[i%order.length];
  const aspect=photoAspects[photoNum-1];
  const height=Math.min(slot.wallHeight*.65,slot.wallLength*.65/aspect);
  photoFrames.push({
   id:`district-photo-frame-${i+1}`,
   image:`/kapsstrike/photos/photo-${String(photoNum).padStart(2,'0')}.jpg`,
   x:slot.x,
   y:slot.y,
   z:slot.z,
   width:height*aspect,
   height,
   rotationY:slot.rotationY,
  });
 }
 return{id:'district',bombSites:BOMB_SITES,name:'Dust II · Reconstruction',subtitle:'Long A, Mid, Catwalk ve B Tunnels',bounds:58,sky:'#b9d8ec',floor:'#c7bba4',floorSurface:'sand',solids,photoFrames,spawns,targets:[],hazard:{x:100,z:100,r:0},routes,landmarks:Object.keys(DUST2_AREAS)};
}
