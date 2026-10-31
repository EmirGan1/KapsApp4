import type {MapDefinition,Solid} from './types';
export function dustDistrict():MapDefinition{
 const solids:Solid[]=[];let serial=0;
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#c5a67f',detail=false,surface:Solid['surface']='plaster')=>{const s:Solid={id:'district-'+name+'-'+serial++,kind:'box',x,y,z,w,h,d,color,detail,surface};solids.push(s);return s;};
 const house=(x:number,z:number,w:number,d:number,h:number)=>{for(const side of [-1,1]){box('side-wall',x+side*w/2,0,z,.4,h,d);for(const q of [-1,1])box('door-pier',x+q*(w+3)/4,0,z+side*d/2,(w-3)/2,h,.4);box('entry-lintel',x,2.8,z+side*d/2,3,h-2.8,.4);for(let wx=-w/2+1.5;wx<w/2;wx+=3)for(let y=3.2;y<h-1;y+=2.8)box('window',x+wx,y,z+side*(d/2+.22),1.2,1,.04,'#385364',true,'glass');}box('roof',x,h,z,w+.5,.3,d+.5,'#a88c6a',false,'stone');};
 // Offset blocks divide three approaches; through-door interiors create lateral connections.
 house(-10,-24,12,15,6);house(12,-22,13,12,5.5);house(-10,3,10,17,7);house(10,4,9,14,6);house(-35,5,10,20,7);house(36,8,10,19,6);house(0,30,14,9,6);
 for(const [x,z,w,d] of [[-23,-8,9,65],[24,-7,9,65],[0,-6,7,65],[0,18,54,7]])box('street',x,.015,z,w,.025,d,'#b6a28a',true,'stone');
 for(const [x,z] of [[-27,13],[-18,19],[20,14],[27,20],[4,-8]]){box('cover',x,0,z,2.8,1.15,1.4,'#9f8765',false,'stone');box('cover-cap',x,1.15,z,3,.1,1.6,'#c1a67d',true,'stone');}
 for(const [x,z] of [[21,23],[27,24]]){box('market-counter',x,0,z,3,1,1.5,'#8e6e4e',false,'wood');box('market-canopy',x,2.7,z,3.5,.1,2.4,'#a66b58',true,'fabric');for(const q of [-1,1])box('market-post',x+q*1.4,0,z,.1,2.7,.1,'#776248',false,'wood');}
 for(const [id,x,z] of [['A',-23,15],['B',24,17]] as const){const s=box('site-sign',x,2.9,z+6,3,1,.15,'#a6604d',true);s.label='BOMBSITE '+id;box('site-mark',x,.05,z,10,.03,9,'#b99a65',true,'stone');}
 // Local architecture closes edges without a surrounding arena wall.
 for(const [x,z] of [[-44,-28],[44,-28],[-43,35],[43,36],[-19,49],[20,49],[-20,-49],[20,-49]])house(x,z,16,17,8);
 solids.push({id:'district-access-ramp',kind:'ramp',x:-30,y:0,z:-24,w:3,h:3,d:20,axis:'z',color:'#aa9579',surface:'stone'});
 box('ramp-landing',-30,3,-12,4,.25,4,'#aa9579',false,'stone');
 for(let i=0;i<20;i++)box('stair-tread',30,0,-24+(i+.5)*.5,2.5,(i+1)*.15,.515,'#aa9579',false,'stone');
 box('stair-landing',30,3,-12,3,.25,4,'#aa9579',false,'stone');
 const spawns=[-8,-4,0,4,8].map(x=>({x,y:0,z:-39})).concat([-8,-4,0,4,8].map(x=>({x,y:0,z:40})));
 return {hazard:{x:100,z:100,r:0},id:'district',name:'Dust District',subtitle:'A Avlusu, B Pazarı ve üç taktiksel yaklaşım',bounds:47,sky:'#d7c4a5',floor:'#cbb38c',solids,spawns,targets:[],routes:[{name:'A uzun',points:[{x:0,y:0,z:-39},{x:-23,y:0,z:-37},{x:-23,y:0,z:15}]},{name:'Mid',points:[{x:0,y:0,z:-39},{x:0,y:0,z:18}]},{name:'B ara sokak',points:[{x:0,y:0,z:-39},{x:24,y:0,z:-37},{x:24,y:0,z:17}]}],landmarks:['A Avlusu','B Pazarı','Orta Sokak']};
}
