import type {MapDefinition,Solid,Vec3} from './types';
import {BOMB_SITES} from './bomb';
import {addDust2Architecture,carvedOpening} from './dust2Architecture';
import {fits,surface,overlaps,support} from './physics';
import {PHYSICS} from './config';
import {DUST2_FOOTPRINT,RADAR_METRES} from './dust2Footprint';
import {DUST2_AREAS,dust2Point} from './dustDistrict';

/**
 * Dust II (2) — 100% Pure CS:GO 2017 Dust II Reference PDF Reconstruction.
 * Built strictly from KapsStrike_Dust_II_3D_Referans_Textbook.pdf (Pages 3–50, Görsel #01–#27)
 * with zero non-PDF community photo frames or invented signage.
 */
export function dust2Pdf():MapDefinition{
 const n=128,cell=8*RADAR_METRES,solids:Solid[]=[];let serial=0;
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#c8b99e',detail=false,surface:Solid['surface']='plaster')=>{
  const s:Solid={id:`district2-${name}-${serial++}`,kind:'box',x,y,z,w,h,d,color,detail,surface};solids.push(s);return s;
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
   for(const side of [-1,1]){
    box('long-doors-chamber-pier',p.x+side*1.95,0,p.z-3.2,.32,4.2,.45,'#bda98a',true,'stone');
    box('long-doors-chamber-wall-coping',p.x+side*2.05,4.15,p.z-1.6,.36,.28,4.2,'#d2bc99',true,'stone');
   }
   box('long-doors-south-arch',p.x,3.45,p.z-3.2,4.2,.48,.48,'#d2bc99',true,'stone');
  }
 }
 const archSolids:Solid[]=[];
 const terrain=addDust2Architecture(archSolids,walkable);
 for(const s of archSolids){
  s.id=s.id.replace(/^district-/,'district2-');
  solids.push(s);
 }
 const heightAt=(x:number,z:number)=>Math.max(0,...terrain.filter(s=>overlaps(s,{x,y:0,z},.01)).map(s=>surface(s,x,z)));
 const navMap={id:'district2',solids} as MapDefinition;
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
  if(!prev.has(target))throw new Error(`Disconnected Dust II (2) route: ${name}`);
  const result:number[]=[];for(let v=target;v!==-1;v=prev.get(v)!)result.push(v);result.reverse();
  return{name,points:result.map(v=>({...nav[Math.floor(v/n)][v%n]!}))};
 };
 const routes=[
  path('T → A',DUST2_AREAS['T Spawn'],DUST2_AREAS['A Site']),
  path('T → B',DUST2_AREAS['T Spawn'],DUST2_AREAS['B Site']),
  path('CT → A',DUST2_AREAS['CT Spawn'],DUST2_AREAS['A Site']),
  path('CT → B',DUST2_AREAS['CT Spawn'],DUST2_AREAS['B Site']),
 ];
 for(const s of BOMB_SITES){
  box('site-paving',s.x,s.y+.02,s.z,s.radius*2,.03,s.radius*2,'#c4b28f',true,'stone');
  const sign=box('site-sign',s.x,s.y+2.1,45.88,2.5,1,.1,'#a65b35',true);sign.label='BOMBSITE '+s.id;
 }
 const spawns=[-16,-8,0,8,16].map(dx=>spawn(390+dx,920)).concat([-16,-8,0,8,16].map(dx=>spawn(600+dx,210)));
 return{
  id:'district2',
  bombSites:BOMB_SITES,
  name:'Dust II (2) · CS:GO 2017 PDF',
  subtitle:'CS:GO 2017 Referans PDF Birebir Mimari',
  bounds:58,
  sky:'#b9d8ec',
  floor:'#c7bba4',
  floorSurface:'sand',
  solids,
  photoFrames:[],
  spawns,
  targets:[],
  hazard:{x:100,z:100,r:0},
  routes,
  landmarks:[
   'T Spawn','T Plat','T Ramp','Outside Long','Long Doors','Blue','Long Corner',
   'Pit','Side Pit','Pit Plat','A Long','A Car','A Cross','A Ramp','A Plat',
   'A Default','Goose','Elevator','Barrels','A Ninja','Short Boost','A Short',
   'Catwalk','Short Stairs','Suicide','Top Mid','Palm','Mid','Xbox','Right Mid',
   'Lower Tunnels','Mid Doors','CT Mid','CT Spawn','Outside Tunnels','Upper Tunnels',
   'Tunnel Stairs','B Tunnels','B Plat','Back Plat','Big Box','Double Stack',
   'B Default','Fence','B Car','Closet','Close Left','B Doors','B Window','Scaffold','B Boxes'
  ],
 };
}
