import type {BombSite, MapDefinition, Solid, Vec3} from './types';

/** Fictional arena. Its game-plan and entrances are authored independently of any school. */
export function kapsCampus(): MapDefinition {
 const solids: Solid[]=[];
 const box=(id:string,x:number,z:number,w:number,d:number,y:number,h:number,color:string,surface:Solid['surface']='concrete',detail=false)=>{
  solids.push({id:`campus-${id}`,kind:'box',x,y,z,w,d,h,color,surface,detail});
 };
 const wall=(id:string,x:number,z:number,w:number,d:number,color='#ece9df')=>box(id,x,z,w,d,0,4.8,color,'plaster');
 const trim=(id:string,x:number,z:number,w:number,d:number,y:number,h:number,color:string,surface:Solid['surface']='metal')=>box(id,x,z,w,d,y,h,color,surface,true);
 const point=(x:number,z:number):Vec3=>({x,y:0,z});

 // A three-lane, mirrored arena: two side halls and an exposed central court.
 // All perimeter openings are fictional game passages, with no relationship to the PDF.
 for(const z of [-18.5,18.5])for(const x of [-46,46])wall(`edge-${x}-${z}`,x,z,.65,37,'#d7d9d5');
 for(const x of [-23,23])for(const z of [-37,37])wall(`edge-${x}-${z}`,x,z,46,.65,'#d7d9d5');
 for(const side of [-1,1]){
  const prefix=side<0?'library':'gym';
  const outer=side*40,inner=side*16,siteX=side*28;
  wall(`${prefix}-outer`,outer,0,.55,24,side<0?'#e9e2d5':'#e5e9ec');
  // Eight-metre opening facing the court and six-metre openings at both ends.
  for(const z of [-8,8])wall(`${prefix}-court-${z}`,inner,z,.55,8,side<0?'#e9e2d5':'#e5e9ec');
  box(`${prefix}-entry-lintel`,inner,0,.65,8,3.15,1.65,'#f4f2eb','plaster');
  for(const z of [-12,12]){
   const x=side*21.5;
   wall(`${prefix}-end-inner-${z}`,x,z,11,.55);
   wall(`${prefix}-end-outer-${z}`,side*36,z,8,.55);
   box(`${prefix}-end-lintel-${z}`,siteX,z,6,.6,3.2,1.6,'#e8e5db','plaster');
  }
  box(`${prefix}-roof`,siteX,0,25,25,5.05,.28,'#d8dce0','concrete',true);
  for(const z of [-7,-2,3,8]){
   trim(`${prefix}-window-${z}`,outer-side*.35,z,.08,2.1,2.7,1.25,'#8eb9c6','glass');
   trim(`${prefix}-sill-${z}`,outer-side*.48,z,.26,2.35,2.58,.12,'#6b8491');
  }
  trim(`${prefix}-blue-band`,outer-side*.5,0,.08,23,4.35,.22,'#345d85');
  trim(`${prefix}-yellow-band`,inner+side*.5,0,.08,23,4.0,.16,'#e4bb4e');
  // A few large, readable cover pieces; small furniture stays visual only.
  box(`${prefix}-cover`,siteX+side*5,5,2,2,0,1.35,'#7890a1','wood');
  trim(`${prefix}-cover-cap`,siteX+side*5,5,2.06,2.06,1.35,.1,'#e1b85b','wood');
 }

 // West hall: an abstract reading room. Rows never narrow the three movement lanes.
 for(const z of [-8,-4,0,4,8]){
  trim(`library-shelf-${z}`,-38,z,1.1,2.2,.15,2.15,'#b08a62','wood');
  for(const h of [.5,1.15,1.75])trim(`library-shelf-edge-${z}-${h}`,-37.35,z,.16,2.3,h,.08,'#345d85','wood');
 }
 for(const z of [-6,6]){
  trim(`reading-table-${z}`,-29,z,2.5,1.15,.76,.12,'#d1ae76','wood');
  trim(`reading-leg-${z}`,-29,z,1.8,.7,0,.76,'#9cabb4','metal');
 }
 // East hall: generic sports floor, no institutional markings or signage.
 trim('gym-floor',28,0,22.5,22.5,.005,.02,'#caa477','wood');
 for(const x of [20,36])trim(`court-line-${x}`,x,0,.06,16,.03,.02,'#f7f4e9','wood');
 for(const z of [-8,8])trim(`court-end-${z}`,28,z,16,.06,.03,.02,'#f7f4e9','wood');
 for(const z of [-4,4]){
  trim(`gym-bench-${z}`,38,z,1,2,.45,.15,'#345d85','wood');
  trim(`gym-bench-leg-${z}`,38,z,.7,1.6,0,.45,'#6f7e88','metal');
 }

 // Centre: a broken sightline and two safe flanks, not a long empty firing gallery.
 box('planter-core',0,0,4,4,0,1.15,'#b7bdac','stone');
 trim('planter-top',0,0,4.1,4.1,1.15,.12,'#f0cf71','stone');
 for(const x of [-10,10]){
  box(`court-cover-${x}`,x,0,1.45,2.4,0,1.1,'#748d99','concrete');
  trim(`court-cover-cap-${x}`,x,0,1.55,2.5,1.1,.08,'#e7c05a');
 }
 for(const z of [-24,24]){
  box(`crossway-cover-${z}`,0,z,3,1.25,0,1.05,'#a7b9bf','concrete');
  trim(`crossway-accent-${z}`,0,z,3.05,1.28,1.05,.1,'#d9b74d');
 }
 // Closed decorative blocks establish a varied fictional campus silhouette.
 for(const side of [-1,1])for(const z of [-25,25]){
  const x=side*40;
  box(`closed-wing-${side}-${z}`,x,z,10,12,0,5.8,'#dfded7','plaster');
  trim(`closed-wing-roof-${side}-${z}`,x,z,10.4,12.4,5.8,.22,'#59758d');
  for(const dx of [-2.7,0,2.7])for(const h of [2.1,4.15])
   trim(`closed-window-${side}-${z}-${dx}-${h}`,x+dx,z+side*6.25,1.3,.08,h,1.05,'#91bac8','glass');
  const label=side<0?(z<0?'DERSLİK':'KÜTÜPHANE'):(z<0?'LABORATUVAR':'KANTİN');
  solids.push({id:`campus-closed-sign-${side}-${z}`,kind:'box',x:x-side*5.35,y:2.9,z,w:.1,h:.55,d:3.5,color:'#375c83',label,detail:true});
 }
 // Small non-colliding trees, lamps, posters, and visual doors are separated from physics.
 for(const [i,x,z] of [[0,-14,-25],[1,14,-25],[2,-14,25],[3,14,25]] as const){
  trim(`tree-trunk-${i}`,x,z,.48,.48,0,3.1,'#806e59','wood');
  trim(`tree-canopy-${i}`,x,z,3.5,3.5,2.5,2.2,'#648772','fabric');
 }
 for(const z of [-29,29])for(const x of [-9,9]){
  trim(`light-post-${x}-${z}`,x,z,.13,.13,0,4.2,'#526578');
  trim(`light-head-${x}-${z}`,x,z,.8,.55,4.15,.16,'#e8d4a1','glass');
 }
 // An optional raised overlook with two independent, fully supported ways back down.
 for(let i=0;i<12;i++)box(`stair-tread-${i}`,19.5,15.25+i*.5,2.4,.5,0,(i+1)*.2,'#c6c8c5','stone');
 solids.push({id:'campus-overlook-ramp',kind:'ramp',x:24,y:0,z:18,w:2.4,d:6,h:2.4,axis:'z',color:'#c6c8c5',surface:'stone'});
 box('overlook-deck',21.5,22.8,7,4,0,2.4,'#c6c8c5','concrete');
 trim('overlook-rail',21.5,24.8,7,.12,2.4,.8,'#48617b');
 for(const [id,x,z,label] of [['west',-16,0,'A · OKUMA'],['east',16,0,'B · SAHA']] as const){
  solids.push({id:`campus-direction-${id}`,kind:'box',x,y:3.5,z,w:.1,h:.6,d:2.7,color:'#355c80',label,detail:true});
 }

 const sites:readonly BombSite[]=[{id:'A',...point(-27,0),radius:3.25},{id:'B',...point(27,0),radius:3.25}];
 const routes=[
  {name:'Güney → Batı salonu → A',points:[point(-6,-31),point(-29,-25),point(-29,-14),point(-29,-7),point(-27,0)]},
  {name:'Güney → Doğu salonu → B',points:[point(6,-31),point(29,-25),point(29,-14),point(29,-7),point(27,0)]},
  {name:'Güney → Merkez → A',points:[point(0,-31),point(5,-19),point(5,-6),point(-7,-5),point(-13,0),point(-27,0)]},
  {name:'Kuzey → Batı salonu → A',points:[point(-6,31),point(-29,25),point(-29,14),point(-29,7),point(-27,0)]},
  {name:'Kuzey → Doğu salonu → B',points:[point(6,31),point(29,25),point(29,14),point(29,7),point(27,0)]},
  {name:'Kuzey → Merkez → B',points:[point(0,31),point(5,19),point(5,6),point(13,0),point(27,0)]},
 ];
 const spawns=[[-10,-31],[-5,-32],[0,-32],[5,-32],[10,-31],[-10,31],[-5,32],[0,32],[5,32],[10,31]].map(([x,z])=>point(x,z));
 return {id:'campus',name:'Kaps Kampüsü',subtitle:'Kurgusal avlu, okuma salonu ve spor alanı',bounds:48,sky:'#c8deeb',floor:'#aeb9ba',floorSurface:'concrete',solids,spawns,targets:[],hazard:{x:100,z:100,r:0},bombSites:sites,routes,landmarks:['Batı salonu','Merkez avlu','Doğu salonu','Kuzey geçidi','Güney geçidi'],radarFootprint:[[-46,46,-37,37]]};
}
