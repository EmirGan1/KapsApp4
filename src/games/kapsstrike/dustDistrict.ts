import type {MapDefinition,Solid} from './types';
import {BOMB_SITES} from './bomb';
export function dustDistrict():MapDefinition{
 const solids:Solid[]=[];let serial=0;
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#c5a67f',detail=false,surface:Solid['surface']='plaster')=>{const s:Solid={id:'district-'+name+'-'+serial++,kind:'box',x,y,z,w,h,d,color,detail,surface};solids.push(s);return s;};
 const house=(x:number,z:number,w:number,d:number,h:number)=>{for(const side of [-1,1]){box('side-wall',x+side*w/2,0,z,.4,h,d);for(const q of [-1,1])box('door-pier',x+q*(w+3)/4,0,z+side*d/2,(w-3)/2,h,.4);box('entry-lintel',x,2.8,z+side*d/2,3,h-2.8,.4);for(let wx=-w/2+1.5;wx<w/2;wx+=3)for(let y=3.2;y<h-1;y+=2.8)box('window',x+wx,y,z+side*(d/2+.22),1.2,1,.04,'#385364',true,'glass');}box('roof',x,h,z,w+.5,.3,d+.5,'#a88c6a',false,'stone');};
 // Offset blocks divide three approaches; through-door interiors create lateral connections.
 house(-10,-24,12,15,6);house(12,-22,13,12,5.5);house(-10,3,10,17,7);house(10,4,9,14,6);house(-35,5,10,20,7);house(36,8,10,19,6);house(0,30,14,9,6);
 for(const [x,z,w,d] of [[-23,-8,9,65],[24,-7,9,65],[0,-6,7,65],[0,18,54,7]])box('street',x,.015,z,w,.025,d,'#b6a28a',true,'stone');
 for(const [x,z] of [[-27,13],[-18,19],[20,14],[27,20],[4,-8]]){box('cover',x,0,z,2.8,1.15,1.4,'#9f8765',false,'stone');box('cover-cap',x,1.15,z,3,.1,1.6,'#c1a67d',true,'stone');}
 for(const [x,z] of [[21,23],[27,24]]){box('market-counter',x,0,z,3,1,1.5,'#8e6e4e',false,'wood');box('market-canopy',x,2.7,z,3.5,.1,2.4,'#a66b58',true,'fabric');for(const q of [-1,1])box('market-post',x+q*1.4,0,z,.1,2.7,.1,'#776248',false,'wood');}
 // Local architecture closes edges without a surrounding arena wall.
 for(const [x,z] of [[-44,-28],[44,-28],[-43,35],[43,36],[-19,49],[20,49],[-20,-49],[20,-49]])house(x,z,16,17,8);
 solids.push({id:'district-access-ramp',kind:'ramp',x:-30,y:0,z:-24,w:3,h:3,d:20,axis:'z',color:'#aa9579',surface:'stone'});
 box('ramp-landing',-30,3,-12,4,.25,4,'#aa9579',false,'stone');
 for(let i=0;i<20;i++)box('stair-tread',30,0,-24+(i+.5)*.5,2.5,(i+1)*.15,.515,'#aa9579',false,'stone');
 box('stair-landing',30,3,-12,3,.25,4,'#aa9579',false,'stone');
 // Expand street distances while preserving connected doors, ramps and collision surfaces.
 const scale=1.7;
 for(const s of solids){s.x*=scale;s.z*=scale;s.w*=scale;s.d*=scale;}
 // Architectural identity: cornices, shutters, balconies, drainpipes and rooftop equipment.
 const walls=solids.filter(s=>s.id.includes('side-wall'));
 for(const wall of walls){
   box('cornice',wall.x,wall.h-.2,wall.z,.8,.28,wall.d+.7,'#dbc69f',true,'stone');
   box('drainpipe',wall.x+.5,0,wall.z-wall.d/2+.7,.16,wall.h,.16,'#726e62',true,'metal');
   for(let z=wall.z-wall.d/2+3;z<wall.z+wall.d/2-1;z+=5){
     box('side-window',wall.x+.38,2.6,z,.08,1.25,1.5,'#45616a',true,'glass');
     for(const q of [-1,1])box('shutter',wall.x+.43,2.6,z+q*.95,.12,1.3,.35,'#64776b',true,'wood');
     box('sill',wall.x+.55,2.45,z,.5,.16,2.1,'#d8c29c',true,'stone');
   }
 }
 for(const site of BOMB_SITES){
   // Paint only: the server uses these exact shared site centers and radii.
   box('site-paving-'+site.id,site.x,.055,site.z,16,.035,16,'#a8926b',true,'stone');
   for(const q of [-1,1]){
     box('site-boundary',site.x+q*8,.10,site.z,.18,.03,16,'#f7cc67',true);
     box('site-boundary',site.x,.10,site.z+q*8,16,.03,.18,'#f7cc67',true);
   }
   const sign=box('site-beacon-'+site.id,site.x,3.1,site.z+9,4,2,.18,'#be633e',true);sign.label='BOMBSITE '+site.id;
   for(const q of [-1,1])box('sign-post',site.x+q*1.6,0,site.z+9,.12,3.1,.12,'#716958',false,'metal');
   // Cover on the perimeter leaves a clear, usable plant zone in the center.
   box('site-cover',site.x-6,0,site.z-5,3,1.2,2,'#a09073',false,'stone');
   const ground=box('site-letter-'+site.id,site.x,.12,site.z,3,.04,3,'#d6ae64',true);ground.label=site.id;
 }
 for(const [x,z,label] of [[-39,-35,'A LONG →'],[40,-35,'B MARKET →'],[0,-54,'MID / A ←  B →']] as const){
   const sign=box('wayfinding',x,2.4,z,4,1,.1,'#456a70',true);sign.label=label;
 }
 const spawns=[-8,-4,0,4,8].map(x=>({x:x*scale,y:0,z:-39*scale})).concat([-8,-4,0,4,8].map(x=>({x:x*scale,y:0,z:40*scale})));
 return {hazard:{x:160,z:160,r:0},id:'district',name:'Dust District',subtitle:'Genişletilmiş A Avlusu, B Pazarı ve bağlantılı sokaklar',bounds:80,sky:'#d7c4a5',floor:'#cbb38c',solids,spawns,targets:[],routes:[{name:'A uzun',points:[{x:0,y:0,z:-66},{x:-39,y:0,z:-63},{x:-40,y:0,z:26}]},{name:'Mid',points:[{x:0,y:0,z:-66},{x:0,y:0,z:30}]},{name:'B ara sokak',points:[{x:0,y:0,z:-66},{x:41,y:0,z:-63},{x:41,y:0,z:29}]}],landmarks:['A Avlusu','B Pazarı','Orta Sokak']};
}
