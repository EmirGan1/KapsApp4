import type {MapDefinition,Solid,Vec3} from './types';
import {BOMB_SITES} from './bomb';
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
 const closed=DUST2_FOOTPRINT.map(r=>[...r].map(c=>c==='0')),used=closed.map(r=>r.map(()=>false));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  if(!closed[y][x]||used[y][x])continue;
  let w=1,d=1;while(w<24&&x+w<n&&closed[y][x+w]&&!used[y][x+w])w++;
  outer:while(d<24&&y+d<n){for(let a=0;a<w;a++)if(!closed[y+d][x+a]||used[y+d][x+a])break outer;d++;}
  for(let b=0;b<d;b++)for(let a=0;a<w;a++)used[y+b][x+a]=true;
  const p=dust2Point(x*8+w*4,y*8+d*4),h=6.5+(x+y)%3;
  box('city-block',p.x,0,p.z,w*cell,h,d*cell,['#c8b99e','#d4c5ac','#bcae96'][(x+y)%3]);
  box('cornice',p.x,h,p.z,w*cell+.08,.15,d*cell+.08,'#e2d2b8',true,'stone');
 }
 // Visible window and shutter compositions along exposed faces, outside walkable space.
 for(let y=1;y<n-1;y+=2)for(let x=1;x<n-1;x+=2){
  if(!closed[y][x])continue;
  for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])if(!closed[y+dy][x+dx]){
   const p=dust2Point(x*8+4+dx*4,y*8+4+dy*4);
   box('window',p.x,3,p.z,dx?.03:.65,.95,dy?.03:.65,'#57716e',true,'glass');
   box('shutter',p.x-dx*.04,3,p.z+dy*.04,dx?.06:.88,1.05,dy?.06:.88,'#718073',true,'wood');
  }
 }
 const nearest=(px:number,py:number)=>{
  let best={x:0,y:0},dist=Infinity;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!closed[y][x]){const d=(x*8+4-px)**2+(y*8+4-py)**2;if(d<dist){dist=d;best={x,y};}}
  return best;
 };
 const spawn=(px:number,py:number)=>{const p=nearest(px,py);return dust2Point(p.x*8+4,p.y*8+4);};
 const path=(name:string,from:readonly number[],to:readonly number[])=>{
  const a=nearest(from[0],from[1]),b=nearest(to[0],to[1]),start=a.y*n+a.x,target=b.y*n+b.x;
  const queue=[start],prev=new Map<number,number>([[start,-1]]);
  for(let i=0;i<queue.length&&!prev.has(target);i++){
   const v=queue[i],x=v%n,y=Math.floor(v/n);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,k=yy*n+xx;if(xx<0||yy<0||xx>=n||yy>=n||closed[yy][xx]||prev.has(k))continue;prev.set(k,v);queue.push(k);}
  }
  if(!prev.has(target))throw new Error(`Disconnected Dust II route: ${name}`);
  const result:number[]=[];for(let v=target;v!==-1;v=prev.get(v)!)result.push(v);result.reverse();
  return{name,points:result.map(v=>dust2Point((v%n)*8+4,Math.floor(v/n)*8+4))};
 };
 const routes=[path('T → A',DUST2_AREAS['T Spawn'],DUST2_AREAS['A Site']),path('T → B',DUST2_AREAS['T Spawn'],DUST2_AREAS['B Site']),path('CT → A',DUST2_AREAS['CT Spawn'],DUST2_AREAS['A Site']),path('CT → B',DUST2_AREAS['CT Spawn'],DUST2_AREAS['B Site'])];
 // Covered Upper/Lower Tunnel interiors. Roofs have consistent server collisions.
 for(const [px,py,w,d] of [[180,455,14,6],[350,410,9,4],[705,638,4,8]]){
  const p=dust2Point(px,py);box('tunnel-roof',p.x,4.6,p.z,w,.3,d,'#ae9d81',false,'stone');
  box('entry-lintel',p.x,4.3,p.z,w,.25,.15,'#c1ae8d',false,'stone');
 }
 for(const s of BOMB_SITES){
  box('site-paving',s.x,.02,s.z,s.radius*2,.03,s.radius*2,'#c4b28f',true,'stone');
  const sign=box('site-sign',s.x,2.8,s.z+s.radius+.3,2.5,1,.1,'#a65b35',true);sign.label='BOMBSITE '+s.id;
 }
 for(const name of ['A Long Doors','Mid Doors','B Doors'] as const){
  const p=dust2Point(DUST2_AREAS[name][0],DUST2_AREAS[name][1]);
  for(const side of [-1,1])box('door-leaf',p.x+side*1.3,0,p.z,.14,2.8,1.1,'#797367',true,'wood');
 }
 // Small edge-only elevation exercise until measured platform/ramp reference is available.
 const stair=spawn(130,670);
 for(let i=0;i<20;i++)box('stair-tread',stair.x,0,stair.z-2+(i+.5)*.1,.65,(i+1)*.06,.105,'#b7a88d',false,'stone');
 box('stair-landing',stair.x,1.2,stair.z+.5,.65,.12,1,'#b7a88d',false,'stone');
 const ramp=spawn(910,520);solids.push({id:'district-access-ramp',kind:'ramp',x:ramp.x,y:0,z:ramp.z,w:.7,h:1,d:6,axis:'z',color:'#b7a88d',surface:'stone'});
 const spawns=[-16,-8,0,8,16].map(dx=>spawn(390+dx,920)).concat([-16,-8,0,8,16].map(dx=>spawn(600+dx,210)));
 return{id:'district',name:'Dust II · Reconstruction',subtitle:'Long A, Mid, Catwalk ve B Tunnels',bounds:58,sky:'#d5dfe4',floor:'#c7bba4',solids,spawns,targets:[],hazard:{x:100,z:100,r:0},routes,landmarks:Object.keys(DUST2_AREAS)};
}
