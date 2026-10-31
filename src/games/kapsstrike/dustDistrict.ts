import type {MapDefinition,Solid,Vec3} from './types';
import {BOMB_SITES} from './bomb';
/** Streets are carved out of closed city blocks, rather than scattered into a field. */
export function dustDistrict():MapDefinition {
 const solids:Solid[]=[];let serial=0;
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#baaa90',detail=false,surface:Solid['surface']='plaster')=>{
  const s:Solid={id:`district-${name}-${serial++}`,kind:'box',x,y,z,w,h,d,color,detail,surface};solids.push(s);return s;
 };
 const point=(x:number,z:number):Vec3=>({x,y:0,z});
 const routes=[
  {name:'A kervan geçidi',points:[[0,-64],[-32,-64],[-32,-40],[-52,-40],[-52,4],[-40,4],[-40,26]].map(([x,z])=>point(x,z))},
  {name:'Orta han',points:[[0,-64],[0,-36],[-12,-36],[-12,-12],[8,-12],[8,12],[0,12],[0,46],[24,46],[24,64],[0,64]].map(([x,z])=>point(x,z))},
  {name:'B kapalı çarşı',points:[[0,-64],[32,-64],[32,-44],[52,-44],[52,-12],[32,-12],[32,8],[48,8],[48,29],[41,29]].map(([x,z])=>point(x,z))},
  {name:'CT A dönüşü',points:[[0,64],[-24,64],[-24,46],[-40,46],[-40,26]].map(([x,z])=>point(x,z))},
  {name:'CT B dönüşü',points:[[0,64],[24,64],[24,29],[41,29]].map(([x,z])=>point(x,z))},
  {name:'A kısa bağlantı',points:[[-40,26],[-24,26],[-24,8],[-12,8],[-12,-12]].map(([x,z])=>point(x,z))},
 ];
 const rooms=[{x:0,z:-64,w:24,d:14},{x:0,z:64,w:24,d:14},{x:-40,z:26,w:20,d:20},{x:41,z:29,w:20,d:20},{x:-12,z:-12,w:16,d:16},{x:32,z:-12,w:16,d:14}];
 const street=(x:number,z:number)=>rooms.some(r=>Math.abs(x-r.x)<r.w/2&&Math.abs(z-r.z)<r.d/2)||routes.some(r=>r.points.some((p,i)=>{
  if(!i)return false;const a=r.points[i-1];
  return x>=Math.min(a.x,p.x)-4&&x<=Math.max(a.x,p.x)+4&&z>=Math.min(a.z,p.z)-4&&z<=Math.max(a.z,p.z)+4;
 }));
 // 2m authored cells, greedily merged into collision blocks. No escape around buildings.
 const n=80,step=2,closed=Array.from({length:n},(_,z)=>Array.from({length:n},(_,x)=>!street(-79+x*step,-79+z*step)));
 const used=closed.map(row=>row.map(()=>false));
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){
  if(!closed[z][x]||used[z][x])continue;
  let w=1,d=1;while(w<12&&x+w<n&&closed[z][x+w]&&!used[z][x+w])w++;
  outer:while(d<12&&z+d<n){for(let a=0;a<w;a++)if(!closed[z+d][x+a]||used[z+d][x+a])break outer;d++;}
  for(let b=0;b<d;b++)for(let a=0;a<w;a++)used[z+b][x+a]=true;
  const h=7+((x*7+z*11)%4),cx=-80+x*2+w,cz=-80+z*2+d;
  box('city-block',cx,0,cz,w*2,h,d*2,['#baaa90','#c3b49a','#ab9d86'][(x+z)%3]);
  box('roof-cornice',cx,h,cz,w*2+.25,.2,d*2+.25,'#d5c7ad',true,'stone');
 }
 // Facade fittings only along exposed street edges; all remain outside capsule clearance.
 for(let z=1;z<n-1;z+=3)for(let x=1;x<n-1;x+=3){
  if(!closed[z][x])continue;
  const cx=-79+x*2,cz=-79+z*2;
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
   if(closed[z+dz][x+dx])continue;
   const px=cx+dx*1.03,pz=cz+dz*1.03;
   box('window',px,2.7,pz,dx?.08:1.1,1.3,dz?.08:1.1,'#426064',true,'glass');
   box('window-sill',px+dx*.12,2.55,pz+dz*.12,dx?.3:1.5,.12,dz?.3:1.5,'#d5c7ad',true,'stone');
  }
 }
 // Covered interiors break the skyline and distinguish the two approaches.
 for(const [x,z,w,d] of [[-12,-12,16,16],[32,-12,16,14],[-52,-20,8,16],[24,51,8,14]]){
  box('interior-ceiling',x,4.8,z,w,.3,d,'#8e8170',false,'wood');
  box('entry-lintel',x,4.4,z,w,.3,.25,'#a89474',false,'stone');
 }
 for(const s of BOMB_SITES){
  const sign=box('site-sign',s.x,2.8,s.z+8.9,3.5,1.4,.12,'#9f5339',true);sign.label='BOMBSITE '+s.id;
  box('site-paving',s.x,.015,s.z,16,.02,16,'#9b927f',true,'stone');
  box('site-cover',s.x-7,0,s.z-6,2,1.2,1.8,'#776c59',false,'wood');
  box('site-cover',s.x+7,0,s.z+6,2,1.2,1.8,'#8b8578',false,'metal');
 }
 for(const [x,z,label] of [[-32,-42,'A ←'],[32,-42,'B →'],[-24,44,'A ←'],[24,44,'B →']] as const){const sign=box('route-sign',x,2.8,z,2.4,.9,.08,'#4d6b68',true);sign.label=label;}
 for(let i=0;i<20;i++)box('stair-tread',-55,0,-29+(i+.5)*.5,1.5,(i+1)*.12,.51,'#9b927f',false,'stone');
 box('stair-landing',-55,2.4,-18,1.5,.18,2,'#9b927f',false,'stone');
 solids.push({id:'district-access-ramp',kind:'ramp',x:55,y:0,z:-30,w:1.5,h:2.4,d:16,axis:'z',color:'#9b927f',surface:'stone'});
 const spawns=[-8,-4,0,4,8].map(x=>point(x,-64)).concat([-8,-4,0,4,8].map(x=>point(x,64)));
 return {id:'district',name:'Dust District',subtitle:'Dar geçitler, kapalı hanlar ve ayrılmış A/B bölgeleri',bounds:80,sky:'#d4dce0',floor:'#b7ae9b',solids,spawns,targets:[],hazard:{x:160,z:160,r:0},routes,landmarks:['A Kervansaray','B Kapalı Çarşı','Orta Han']};
}
