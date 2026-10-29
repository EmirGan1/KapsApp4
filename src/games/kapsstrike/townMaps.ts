import type {MapDefinition,MapId,Solid} from './types';
/** Author-authored districts. Numeric solids are shared by server rays, physics and rendering. */
export function townMap(id:MapId):MapDefinition {
 const solids:Solid[]=[];let serial=0;
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,detail=false)=>solids.push({id:`${id}-town-${++serial}`,kind:'box',x,y,z,w,h,d,color,detail});
 const ramp=(x:number,z:number,w:number,h:number,d:number,axis:'x'|'z',color:string)=>solids.push({id:`${id}-town-${++serial}`,kind:'ramp',x,y:0,z,w,h,d,axis,color});
 const road=(x:number,z:number,w:number,d:number,color='#58626b')=>box(x,.005,z,w,.025,d,color,true);
 const house=(x:number,z:number,w:number,d:number,h:number,color:string,trim:string)=>{
  for(const side of [-1,1]) {
   box(x+side*(w/2-.2),0,z,.4,h,d,color);
   for(const q of [-1,1]) box(x+q*(w/4+.6),0,z+side*d/2,w/2-1.2,h,.4,color);
   box(x,2.4,z+side*d/2,2.4,h-2.4,.4,color);
   box(x,2.35,z+side*(d/2+.04),2.8,.12,.12,trim,true);
   for(const wx of [-w*.3,w*.3]) {
    box(x+wx,1.25,z+side*(d/2+.23),1.6,1.1,.04,'#619099',true);
    box(x+wx,2.35,z+side*(d/2+.25),1.9,.09,.16,trim,true);
   }
  }
  box(x,h,z,w+.6,.3,d+.6,trim);
  box(x,h+.3,z-d/2,w,.3,.25,color);
 };
 const car=(x:number,z:number,color:string)=>{box(x,0,z,2,1.05,4,color);box(x,1.05,z-.35,1.7,.65,1.8,'#334352');for(const q of [-1,1])box(x+q*.95,.16,z, .22,.4,3.1,'#27313a',true);};
 const lamp=(x:number,z:number,neon=false)=>{box(x,0,z,.18,4,.18,'#44515c');box(x,3.9,z+.4,.7,.14,.95,neon?'#71d6df':'#e6cb92',true);};
 // Each skyline follows its own block plan; none uses an enclosing arena wall.
 const skyline = id==='warehouse' ? [
  [-36,-22,6,10,22],[-36,14,6,8,24],[36,-24,6,8,18],[35,9,7,12,14],[36,30,5,9,10],[-20,-36,22,9,5],[20,-36,22,11,5],[-20,36,22,7,5],[20,36,22,8,5]
 ] : id==='dust' ? [
  [-35,-18,7,6,18],[-36,13,6,4,16],[35,-7,6,5,14],[34,25,8,7,16],[-14,-36,28,5,5],[22,-35,22,6,7],[-12,36,36,4,6],[22,36,14,4,5]
 ] : [
  [-36,-25,5,18,12],[-35,5,7,12,10],[-36,28,5,16,12],[36,-22,5,15,18],[35,14,7,19,18],[-20,-36,22,14,5],[17,-36,14,20,5],[-18,36,14,14,5],[12,36,24,17,5]
 ];
 for(const [x,z,w,h,d] of skyline){
  const color=id==='dust'?'#a7835f':id==='neon'?'#293a54':'#667883';
  box(x,0,z,w,h,d,color);
  if(Math.abs(x)>30)for(let level=2;level<h-1;level+=3) box(x-Math.sign(x)*(w/2+.03),level,z,.045,1.2,d*.5,id==='neon'?'#61d7d0':'#7496a1',true);
  else for(let level=2;level<h-1;level+=3)box(x,level,z-Math.sign(z)*(d/2+.03),w*.6,1.2,.045,id==='neon'?'#9e78c7':'#7496a1',true);
 }
 for(const side of [-1,1])box(0,0,side*36.5,7,1.1,1,id==='dust'?'#b89b72':'#5d6d77');
 const spawns=[{x:0,y:0,z:-28},{x:-28,y:0,z:-27},{x:28,y:0,z:-27},{x:-12,y:0,z:-28},{x:12,y:0,z:-28},{x:0,y:0,z:28},{x:-28,y:0,z:27},{x:28,y:0,z:27},{x:-12,y:0,z:28},{x:12,y:0,z:28}];
 let elevated={x:-17,y:5.3,z:12};
 let name='',subtitle='',sky='',floor='';
 if(id==='warehouse') {
  name='Urban Strike · Liman Mahallesi';subtitle='Kavşaklar, dükkânlar, servis sokakları ve balkon rotası';sky='#9db8c9';floor='#808b87';
  road(0,0,10,68);road(0,-3,66,9);road(-27,5,5,48);road(27,-9,5,36);
  for(const side of [-1,1]) {box(side*6,0,0,1.7,.16,64,'#aeb7b6');for(const z of [-25,-9,7,24])lamp(side*7,z);}
  house(-17,12,12,10,5,'#b8ab95','#526d77');house(17,13,11,13,7,'#899e9f','#485c6b');
  house(-17,-17,10,10,4,'#b8856c','#6d6f69');house(18,-17,12,9,5.8,'#d0be9b','#6a7e83');
  box(-17,2.6,6.6,7,.65,.15,'#6a927e',true);box(17,2.6,6.2,7,.6,.15,'#b9aa74',true);
  ramp(-25,0,4,5.3,18,'z','#78909c');box(-25,5,12,4,.3,6,'#708692');
  for(let i=0;i<12;i++) box(8,0,5+i*.5,2,(i+1)*.2,.5,'#8d9a9e');box(8,2.1,12,3,.3,3,'#8d9a9e');
  car(-10,-5,'#628195');car(12,1,'#b28d68');car(27,15,'#8c6462');
  box(0,0,16,3,.8,3,'#899b85');box(0,.8,16,2.5,.2,2.5,'#75956a',true);
  for(const z of [-24,-16,7,24])box(0,.04,z,.13,.015,3,'#e9d6a1',true);
 } else if(id==='dust') {
  name='Dust Town · Sarnıç Pazarı';subtitle='Birbirine geçen avlular, kemerler, pazar ve düz çatılar';sky='#d8bc95';floor='#c2a474';
  house(-17,-12,13,10,4,'#bb9270','#a07857');house(17,11,12,12,4.5,'#cfad82','#9f7956');house(-17,15,10,10,3.5,'#d2b28b','#a78665');
  // Offset courtyards replace the urban cross-road topology.
  box(-4,0,8,.5,2.7,11,'#b18a61');box(6,0,-6,.5,2.4,14,'#c19b70');
  for(const side of [-1,1]) {box(side*3.1,0,2,1.2,3.4,1.1,'#c8a67b');box(side*1.8,2.7,2,1.5,.7,1.1,'#c8a67b');}
  box(0,3.25,2,2.3,.65,1.1,'#c8a67b');
  for(const x of [-8,5,14]) {box(x,0,22,3.7,1,2,'#9a7654');for(const q of [-1,1])box(x+q*1.8,0,22,.12,2.6,2,'#765e48');box(x,2.6,22,4.4,.16,3.3,x<0?'#a97460':'#b7a179');}
  ramp(26,-1,4,4.8,24,'z','#b99a73');box(26,4.5,14,4,.3,6,'#b99a73');box(24,4.5,14,2,.3,5,'#b99a73');
  for(let i=0;i<14;i++)box(-8,0,12+i*.42,2.5,(i+1)*.25,.42,'#a98b67');box(-8,3.2,19,3,.3,3,'#a98b67');
  for(const [x,z] of [[-7,-18],[10,-17],[24,0],[-26,6]])box(x,0,z,2,1.2,2,'#9c805d');
  box(0,0,14,3.5,.8,3.5,'#a18666');box(0,.8,14,2.8,.15,2.8,'#74a2aa',true);
  elevated={x:17,y:4.8,z:11};
 } else {
  name='Neon City · Üst Hat';subtitle='Çatı bağlantıları, iki yükseklikte geçitler ve gece meydanı';sky='#101a31';floor='#293747';
  road(0,-15,60,6,'#253140');road(-27,0,5,60,'#253140');road(25,0,6,60,'#253140');
  house(-18,4,11,13,4,'#3b4961','#67718e');house(18,18,12,10,6,'#35465d','#68899b');house(17,-13,11,10,8,'#4e4b70','#7b7192');
  ramp(-26,-10,4,4.3,24,'z','#5a6c85');box(-26,4,5,4,.3,6,'#5a6c85');
  box(-3,4,5,46,.3,3,'#526a80');box(0,4.3,3.6,44,.45,.12,'#67b5c5');
  ramp(26,0,4,6.3,28,'z','#576f85');box(26,6,17,4,.3,6,'#576f85');box(12,6,23,30,.3,3,'#576f85');
  box(0,0,13,9,3,8,'#38485d');ramp(-10.5,13,12,3,4,'x','#637d8e');
  for(const [x,z] of [[-18,-4],[18,11],[17,-19]]) {box(x,3,z,5,.8,.1,'#9e78c7',true);box(x,3.15,z-.1,3,.12,.13,'#61d7d0',true);}
  for(const side of [-1,1])for(const z of [-25,-4,19])lamp(side*30,z,true);
  for(const [x,z] of [[-10,-12],[8,-4],[-13,22]]){box(x,0,z,2.2,1.4,2.2,'#566376');box(x,1.4,z,2.3,.08,2.3,'#6ebfc9',true);}
  car(-25,20,'#605d81');elevated={x:0,y:3,z:13};
 }
 return {id,name,subtitle,bounds:38,sky,floor,solids,spawns,targets:[{id:'close',position:{x:0,y:0,z:-15}},{id:'mid',position:{x:-8,y:0,z:8}},{id:'far',position:{x:20,y:0,z:27}},{id:'elevated',position:elevated},{id:'strafer',position:{x:0,y:0,z:-7},moving:true}],hazard:{x:-31,z:31,r:1.6}};
}
