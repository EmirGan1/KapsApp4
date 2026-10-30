import type {MapDefinition,MapId,Solid,Vec3} from './types';
type Surface=Solid['surface'];
/** Three authored places, not palette variants of a common arena.
 * Every solid uses the same dimensions for the renderer, server rays and capsule physics.
 * Tiny facade fittings are cosmetic; doors, roofs, stairs, vehicles and cover are solid.
 */
export function townMap(id:MapId):MapDefinition {
 const solids:Solid[]=[];let serial=0;
 const b=(tag:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,surface?:Surface,detail=false,shape?:Solid['shape'])=>{
  const s:Solid={id:`${id}-${tag}-${++serial}`,kind:'box',x,y,z,w,h,d,color,surface,detail,shape};solids.push(s);return s;
 };
 const deco=(tag:string,x:number,y:number,z:number,w:number,h:number,d:number,color:string,surface?:Surface)=>b(tag,x,y,z,w,h,d,color,surface,true);
 const road=(x:number,z:number,w:number,d:number,color='#454d52')=>deco('street',x,.012,z,w,.025,d,color,'asphalt');
 const sign=(text:string,x:number,y:number,z:number,w:number,color:string,glow=false)=>{const s=deco('sign',x,y,z,w,.75,.09,color);s.label=text;s.glow=glow;};
 const ramp=(tag:string,x:number,z:number,w:number,h:number,d:number,axis:'x'|'z',color:string,surface:Surface='concrete')=>solids.push({id:`${id}-${tag}-${++serial}`,kind:'ramp',x,y:0,z,w,h,d,axis,color,surface});
 const steps=(x:number,z:number,w:number,length:number,height:number,color:string)=>{
  const n=Math.ceil(height/.2);for(let i=0;i<n;i++)b('stair-tread',x,0,z+(i+.5)*length/n,w,height*(i+1)/n,length/n+.015,color,'concrete');
 };
 const lamp=(x:number,z:number,night=false)=>{b('lamp-post',x,0,z,.14,5,.14,'#46515a','metal');deco('lamp-arm',x,4.85,z+.55,.16,.14,1.2,'#46515a','metal');const s=deco('lamp-head',x,4.7,z+1,.6,.13,.8,night?'#61d7d0':'#e6cb92');s.glow=night;};
 const barrel=(x:number,z:number,color='#957457')=>{b('barrel',x,0,z,.85,1.12,.85,color,'metal',false,'cylinder');for(const y of [.15,.85])deco('barrel-ring',x,y,z,.9,.08,.9,'#49505a','metal').shape='cylinder';};
 const crate=(x:number,z:number)=>{b('cargo-crate',x,0,z,1.3,1.05,1.2,'#a17e55','wood');for(const side of [-1,1])deco('crate-binding',x+side*.45,0,z,.09,1.09,1.23,'#655745');};
 const vehicle=(x:number,z:number,truck=false,future=false)=>{
  const color=future?'#426a82':truck?'#a2957d':'#8a6b59';
  b('vehicle-chassis',x,.25,z,2.1,.85,truck?6.4:4.5,color,'metal');
  b('vehicle-cabin',x,1.1,z+(truck?1.7:-.2),1.9,truck?1.7:.75,truck?2:2.1,future?'#61d7d0':'#668a96','glass');
  if(truck)b('truck-cargo',x,1.1,z-1.2,2.25,2,3.7,'#98a2a5','metal');
  for(const q of [-1,1])for(const zoff of [-1.5,1.5])deco('wheel',x+q*1.05,.08,z+zoff,.32,.6,.65,'#252d35');
  for(const q of [-1,1])deco('headlight',x+q*.65,.65,z+2.3,.35,.2,.08,future?'#61d7d0':'#eee3b6').glow=future;
 };
 const building=(tag:string,x:number,z:number,w:number,d:number,h:number,color:string,style:'desert'|'port'|'city',interior=true)=>{
  const trim=style==='desert'?'#a47b54':style==='port'?'#667782':'#4b5e79';
  const surface:Surface=style==='desert'?'plaster':style==='port'?'brick':'metal';
  const door=style==='port'?4:2.5,lintel=style==='port'?3.5:2.7;
  if(interior){
   for(const side of [-1,1]){
    b(`${tag}-side`,x+side*w/2,0,z,.42,h,d,color,surface);
    for(const half of [-1,1])b(`${tag}-entry-pier`,x+half*(w+door)/4,0,z+side*d/2,(w-door)/2,h,.42,color,surface);
    b(`${tag}-entry-lintel`,x,lintel,z+side*d/2,door,h-lintel,.42,color,surface);
    deco('door-frame',x-door/2-.04,0,z+side*(d/2+.25),.12,lintel,.13,trim,'wood');
    deco('door-frame',x+door/2+.04,0,z+side*(d/2+.25),.12,lintel,.13,trim,'wood');
   }
   deco(`${tag}-interior-floor`,x,.04,z,w,.035,d,style==='desert'?'#b6a086':'#7f8786','concrete');
   // Natural interior cover leaves the through-door route open.
   if(w>13){b('interior-counter',x-w*.3,0,z+.6,2.2,1,3.4,trim,'wood');crate(x+w*.3,z-d*.25);}
  }else b(tag,x,0,z,w,h,d,color,surface);
  b(`${tag}-roof`,x,h,z,w+.65,.28,d+.65,trim,style==='desert'?'stone':'metal');
  if(style==='city'&&interior&&h>10)b('tower-mezzanine',x,4,z,w,.3,d,trim,'metal');
  for(const side of [-1,1]){
   b('roof-parapet',x+side*w/2,h+.28,z,.2,.45,d,trim,surface);
   for(let level=1.1;level<h-1;level+=2.8){
    if(style==='port'&&tag!=='port-office'&&level<2)continue;
    for(let wx=-w/2+1.6;wx<w/2-1;wx+=3){
     // Keep the ground-floor doorway open and legible.
     if(level<2&&Math.abs(wx)<door/2+1)continue;
     const window=deco('window-recess',x+wx,level,z+side*(d/2+.225),1.4,1.05,.045,style==='city'?'#698c9d':'#304b59','glass');
     if(style==='city'&&Math.round(wx+level)%3===0)window.glow=true;
     deco('window-sill',x+wx,level-.07,z+side*(d/2+.29),1.65,.12,.22,trim,'stone');
     if(style==='desert')for(const q of [-1,1])deco('wooden-shutter',x+wx+q*.82,level,z+side*(d/2+.27),.3,1.1,.08,'#76634c','wood');
    }
   }
   deco('facade-cornice',x,h-.25,z+side*(d/2+.27),w+.45,.17,.3,trim,surface);
  }
  // Articulated side facades are visible from the alleys, not just from the front.
  for(const side of [-1,1])for(let level=style==='port'?3.6:1.2;level<h-1;level+=2.8)for(let wz=-d/2+1.7;wz<d/2-1;wz+=3){
   const window=deco('side-window',x+side*(w/2+.235),level,z+wz,.045,1.05,1.35,style==='city'?'#698c9d':'#45616a','glass');
   if(style==='city'&&Math.round(wz+level)%3===0)window.glow=true;
   deco('side-window-sill',x+side*(w/2+.29),level-.08,z+wz,.2,.12,1.6,trim,'stone');
   if(style==='desert')for(const q of [-1,1])deco('side-shutter',x+side*(w/2+.27),level,z+wz+q*.8,.09,1.1,.27,'#76634c','wood');
  }
  if(style==='desert'){
   b('roof-chimney',x+w*.28,h+.28,z-d*.25,.7,1,.7,trim,'stone');
   deco('entry-awning',x,2.5,z-d/2-.9,door+1,.12,1.8,'#ad7661','fabric');
  }else if(style==='port'){
   for(const offset of [-w*.25,w*.25])b('roof-ventilator',x+offset,h+.28,z,1.3,.65,1.3,'#829397','metal',false,'cylinder');
   for(const offset of [-w*.3,w*.3])deco('loading-bay-mark',x+offset,.075,z-d/2-1.5,1,.025,2.3,'#c2aa69');
  }else{
   b('tower-setback',x,h+.28,z,w*.52,2.5,d*.55,trim,'metal');
   deco('roof-antenna',x+w*.2,h+2.78,z,.09,3,.09,'#718699','metal');
   const beacon=deco('roof-beacon',x+w*.2,h+5.7,z,.22,.22,.22,'#9e78c7');beacon.glow=true;
  }
  if(style==='city')for(const side of [-1,1]){const s=deco('facade-light',x+side*(w/2+.24),.6,z,.035,h-.8,.16,'#61d7d0');s.glow=true;}
  if(style==='port')for(const side of [-1,1])deco('rain-pipe',x+side*(w/2-.35),0,z-d/2-.28,.12,h,.14,'#52616a','metal');
 };
 const backdrop=(x:number,z:number,w:number,d:number,h:number,color:string,style:'desert'|'port'|'city')=>{
  // Outside the playable boundary: continue the place into the horizon.
  building('distant-block',x,z,w,d,h,color,style,false);
 };
 const balcony=(x:number,y:number,z:number,w:number,d:number,color:string)=>{
  b('balcony-deck',x,y-.25,z,w,.25,d,color,'metal');
  b('balcony-rail',x,y,z+d/2,w,.72,.1,color,'metal');
  for(const side of [-1,1])b('balcony-rail',x+side*w/2,y,z,.1,.72,d,color,'metal');
 };
 const routes:NonNullable<MapDefinition['routes']>=[];
 const route=(name:string,points:number[][])=>routes.push({name,points:points.map(([x,z])=>({x,y:0,z}))});
 let name='',subtitle='',sky='',floor='';let spawns:Vec3[]=[];let elevated={x:0,y:0,z:0};
 const spawn=(points:number[][])=>spawns=points.map(([x,z])=>({x,y:0,z}));
 let landmarks:string[]=[];
 if(id==='dust'){
  name='Dust Town · Sarnıç Pazarı';subtitle='Pazar meydanı, kıvrılan kasaba sokakları, avlular ve bağlı çatılar';sky='#d6c3a2';floor='#c8b28c';
  // Six separate blocks shape a branching, offset network of alleys and courts.
  building('caravan-house',-15,-24,18,16,5.6,'#c6a17b','desert');
  building('tea-house',15,-24,18,16,6.2,'#d7b993','desert');
  building('baths',-19,0,20,15,5,'#b79b7e','desert');
  building('merchant-house',22,0,16,17,7,'#d0ab7a','desert');
  building('rooftop-house',-19,25,18,15,4.5,'#d7b993','desert');
  building('bakery',19,27,15,15,5.2,'#c6a17b','desert');
  road(0,-25,8,34,'#bcaa8d');road(-3,3,10,18,'#bcaa8d');road(4,15,23,18,'#bcaa8d');road(-34,0,6,83,'#bcaa8d');road(36,4,6,82,'#bcaa8d');
  // Open square framed by a colonnade and a real arch, not an arena wall.
  for(const x of [-7,0,7]){b('arcade-pier',x,0,10,.7,3.5,.9,'#af9472','stone');}
  for(const x of [-3.5,3.5])for(let i=0;i<18;i++){
   const dx=-3.15+(i+.5)*6.3/18,opening=2.5+Math.sqrt(1-(dx/3.15)**2)*1.2;
   b('arch-keystone',x+dx,opening,10,6.3/18+.01,4.2-opening,.9,'#c6b08d','stone');
  }
  for(const [x,z] of [[-4,21],[4,22],[12,14]]){
   b('market-counter',x,0,z,3.6,1,1.8,'#927052','wood');
   for(const side of [-1,1])b('stall-post',x+side*1.7,0,z,.1,2.7,1.7,'#76634c','wood');
   deco('market-canopy',x,2.7,z,4.2,.12,3.2,'#ad7661','fabric');
   for(const q of [-1,0,1])deco('market-produce',x+q*.8,1.02,z,.5,.3,.6,q===0?'#9eae72':'#c29466').shape='cylinder';
  }
  // Well and bench belong to a side courtyard, keeping the square's routes clear.
  b('well',-5,0,2,2.4,.8,2.4,'#ad9879','stone',false,'cylinder');deco('well-water',-5,.8,2,1.7,.03,1.7,'#71969a','water').shape='cylinder';
  b('courtyard-bench',-6,0,-3,2.7,.45,.55,'#91704e','wood');
  sign('SARNIC PAZARI',0,4.2,9.5,7,'#785e45');sign('CAY EVI',15,2.9,-32.3,4,'#765e48');sign('FIRIN',19,2.8,19.2,4,'#765e48');
  ramp('roof-ramp',28,-27,3.5,6.48,24,'z','#b5a083','stone');b('roof-landing',28,6.2,-13,4,.28,4,'#b5a083','stone');b('roof-link',20,6.2,-15,12,.28,3.5,'#b5a083','stone');
  steps(-7,12,2.5,11,4.78,'#b5a083');b('roof-landing',-7,4.5,24,3,.28,3,'#b5a083','stone');b('roof-link',-11,4.5,24,6,.28,3,'#b5a083','stone');
  balcony(15,3.2,-33.8,7,2.3,'#a47b54');
  for(const [x,z] of [[-27,-10],[-30,12],[29,16],[-27,-37]]){barrel(x,z);crate(x+1.4,z);}
  vehicle(36,-16);lamp(-5,-35);lamp(9,30);
  for(const [x,z,w,d,h] of [[-43,-33,15,18,7],[-45,15,14,20,5],[42,32,17,15,8],[17,50,27,13,7],[-20,51,24,16,6],[43,-40,16,20,6]])backdrop(x,z,w,d,h,'#b79b7e','desert');
  for(const [x,z,w,h] of [[-74,20,36,18],[65,63,49,22],[-30,86,57,24]])b('distant-dune',x,-4,z,w,h,w*1.3,'#b8a17e',undefined,true,'cone');
  spawn([[0,-38],[-30,-37],[32,-38],[-6,-38],[8,-39],[0,38],[-31,37],[32,39],[-8,39],[12,40]]);
  elevated={x:15,y:6.48,z:-24};
  route('Pazar ve kemer',[[0,-38],[0,-12],[3,0],[3,7],[3,12],[0,16],[0,33],[0,38]]);
  route('Batı avlu sokağı',[[0,-38],[-30,-38],[-34,-10],[-34,34],[0,38]]);
  route('Doğu çatıaltı sokağı',[[0,-38],[32,-40],[32,-35],[32,34],[32,39],[0,38]]);
  landmarks=['pazar','kemerli geçit','sarnıç','çay evi','bağlı çatılar'];
 }else if(id==='neon'){
  name='Neon City · Üst Hat';subtitle='Gökdelen bulvarı, çift erişimli üst geçit, kulüp çatısı ve transit meydanı';sky='#111d35';floor='#303d4c';
  road(0,-2,17,88,'#253140');road(0,9,82,12,'#253140');road(-38,0,6,85,'#253140');road(39,4,6,82,'#253140');
  building('west-arcology',-23,-18,18,22,12,'#42566c','city');building('east-tower',24,-6,20,18,18,'#35475d','city');
  building('neon-club',-24,22,15,15,8,'#484e70','city');building('tech-store',25,25,16,14,7,'#42566c','city');building('transit-hall',-3,39,24,12,14,'#35475d','city');
  // Different heights and suspended routes; street space continues beneath them.
  ramp('west-skyway-ramp',-36,-10,3.2,5.8,28,'z','#718699','metal');
  ramp('east-skyway-ramp',37,-10,3.2,5.8,28,'z','#718699','metal');
  b('skyway',0,5.52,8,74,.28,4,'#718699','metal');
  for(const side of [-1,1]){b('skyway-rail',0,5.8,8+side*2,67,.7,.1,'#526a80','metal');deco('skyway-light',0,5.82,8+side*2.06,67,.08,.08,'#61d7d0').glow=true;}
  b('west-skyway-landing',-36,5.52,6,4,.28,4,'#718699','metal');b('east-skyway-landing',37,5.52,6,4,.28,4,'#718699','metal');
  b('transit-platform',0,0,17,10,3.3,10,'#4b5e79','metal');ramp('plaza-ramp',-9,17,8,3.3,4,'x','#718699','metal');
  steps(-34.5,10,2.5,20,8.28,'#718699');b('club-roof-link',-31,8,31.7,8,.28,3.4,'#718699','metal');
  for(const z of [-37,-31,-25,-19,-13,-7,0,28])deco('lane-marker',0,.045,z,.16,.01,2,'#61d7d0').glow=true;
  for(const x of [-9.5,9.5])for(const z of [-34,-16,3,30])lamp(x,z,true);
  sign('KAPS / TRANSIT',-3,4.5,32.7,12,'#365b78',true);sign('NOVA LAB',24,4.2,-15.3,10,'#576489',true);sign('ORBIT CLUB',-24,3.7,14.2,10,'#9e78c7',true);sign('24 / TECH',25,3,17.7,8,'#3c7c84',true);
  // Lit shop interiors, terminals and street furniture instead of random crates.
  for(const [x,z] of [[22,22],[28,22],[-20,20]]){b('shop-terminal',x,0,z,1.2,1.6,.8,'#4b5e79','metal');deco('terminal-display',x,1,z-.43,.9,.5,.03,'#61d7d0').glow=true;}
  vehicle(-8,-8,false,true);vehicle(36,29,false,true);
  b('bus-shelter-roof',-10,3,-33,4,.2,6,'#4b5e79','metal');for(const z of [-35.8,-30.2])b('bus-shelter-post',-10,0,z,.12,3,.12,'#718699','metal');b('bus-bench',-10,0,-33,.65,.55,4,'#718699','metal');
  for(const [x,z,w,d,h] of [[-51,-33,15,21,30],[-52,4,18,20,37],[52,-19,17,24,43],[49,29,16,19,28],[-28,56,20,17,36],[14,57,21,18,44],[-57,45,15,16,24],[40,-53,19,19,35]])backdrop(x,z,w,d,h,'#293d55','city');
  spawn([[0,-38],[-39,-37],[39,-38],[-7,-39],[8,-39],[19,40],[-38,38],[39,40],[-18,39],[16,44]]);
  elevated={x:0,y:5.8,z:8};
  route('Bulvar ve meydan',[[0,-38],[0,-8],[9,-2],[9,9],[9,29],[12,30],[12,35],[19,36],[19,40]]);
  route('Batı servis sokağı',[[0,-38],[-39,-38],[-40,0],[-40,37],[-18,39]]);
  route('Doğu teknoloji sokağı',[[0,-38],[40,-38],[40,-25],[40,36],[19,40]]);
  landmarks=['gökdelen bulvarı','üst hat köprüsü','transit platformu','Orbit kulübü','teknoloji mağazası'];
 }else{
  name='Liman Mahallesi · Kıyı Terminali';subtitle='Deniz ve iskeleler, vinçli rıhtım, yükleme sokakları ve depo içleri';sky='#aac5d2';floor='#87938f';
  deco('mainland',25,-.015,0,94,.025,180,'#88938e','concrete');
  deco('sea',-76,-.03,0,104,.04,240,'#427f94','water');
  // A stepped shoreline and three piers replace a four-sided arena perimeter.
  for(const [z,d] of [[-39,22],[-10,20],[17,18],[42,16]]){
   const s=b('water-boundary',-37,0,z,26,30,d,'#427f94');s.hidden=true;
   b('quay-edge',-23.7,0,z,.4,.85,d,'#6e7e80','concrete');
  }
  const offshore=b('offshore-boundary',-45,0,0,10,30,96,'#427f94');offshore.hidden=true;
  for(const z of [-24,4,30]){
   b('pier-deck',-31,0,z,16,.24,7.6,'#9ba5a0','concrete');
   for(const side of [-1,1]){b('pier-rail',-31,.24,z+side*3.8,16,.8,.14,'#596e79','metal');for(const x of [-37,-30,-25])b('bollard',x,.24,z+side*3.1,.45,.65,.45,'#4b5b61','metal',false,'cylinder');}
   b('pier-end',-39,.24,z,.16,.8,7.6,'#596e79','metal');
  }
  road(10,0,10,88);road(9,-7,64,9);road(18,32,60,7);road(-19,0,6,82);
  building('west-depot',-9,-18,15,15,6,'#a09e90','port');building('east-warehouse',29,-23,20,18,7,'#ad9381','port');building('cargo-terminal',28,20,22,18,8,'#a09e90','port');building('port-office',1,24,12,10,5,'#bcc2b4','port');
  sign('KIYI TERMINALI / 04',29,4.4,-32.3,13,'#48636f');sign('GUMRUK',1,3.1,18.7,6,'#48636f');sign('DEPO 07',-9,3.8,-25.8,7,'#48636f');
  ramp('depot-roof-ramp',-20,-20,3.2,6.28,24,'z','#7b8b90','metal');b('depot-roof-landing',-20,6,-6,4,.28,4,'#7b8b90','metal');b('depot-roof-link',-13,6,-9,10,.28,4,'#7b8b90','metal');
  steps(-8,16,2.5,11,5.28,'#7b8b90');b('office-roof-link',-5,5,28,8,.28,3,'#7b8b90','metal');
  // Gantry crane, its four supports, trolley and cable form a recognizable port landmark.
  for(const x of [-21,-17])for(const z of [10,16])b('crane-leg',x,0,z,.55,14,.55,'#c2aa69','metal');
  b('crane-gantry',-24,14,13,24,.8,2.6,'#c2aa69','metal');b('crane-cab',-17,12.2,13,2.4,1.8,2.8,'#668a96','glass');deco('crane-cable',-32,5,13,.045,9,.045,'#4b5b61');deco('crane-hook',-32,4.5,13,.5,.6,.2,'#4b5b61');
  for(const [x,z,c] of [[32,4,'#667e85'],[39,4,'#a8755f'],[33,37,'#788c7a']] as [number,number,string][]){
   b('shipping-container',x,0,z,5.5,2.5,3,c,'metal');for(const q of [-2,-1,0,1,2])deco('container-rib',x+q,0,z-1.53,.07,2.5,.09,'#4c6069','metal');
  }
  vehicle(12,-14,true);vehicle(40,20,true);vehicle(4,34);
  for(const [x,z] of [[-18,-34],[-18,34],[15,8],[44,-10]])lamp(x,z);
  for(const [x,z] of [[-13,3],[33,-10],[-18,20]]){barrel(x,z,'#637780');crate(x+1.5,z);}
  balcony(1,3,17.6,7,2.4,'#667782');
  for(const [x,z,w,d,h] of [[26,-51,23,14,10],[52,-17,16,25,12],[52,25,18,24,9],[26,55,25,18,13],[-5,57,16,14,7]])backdrop(x,z,w,d,h,'#8d9b9c','port');
  // Distant ship hull and masts sit beyond the water, without gameplay collision.
  deco('freighter-hull',-67,0,11,14,4,37,'#4c6069','metal');deco('ship-bridge',-67,4,21,10,7,8,'#bec8c5','metal');for(const z of [0,9]){deco('ship-cargo',-67,4,z,11,3,6,'#a8755f','metal');deco('ship-mast',-67,4,z,.25,16,.25,'#788c7a','metal');}
  spawn([[0,-38],[-20,-37],[38,-38],[-8,-38],[12,-40],[0,39],[-20,39],[39,39],[-8,40],[12,40]]);
  elevated={x:-9,y:6.28,z:-18};
  route('Yükleme caddesi',[[0,-38],[10,-35],[9,-4],[10,14],[10,34],[10,39],[0,39]]);
  route('Rıhtım yolu',[[0,-38],[-20,-37],[-22.5,-37],[-22.5,-6],[-20,0],[-20,28],[-20,39],[0,39]]);
  route('Doğu servis yolu',[[0,-38],[42.5,-38],[42.5,-4],[42.5,33],[39,39],[0,39]]);
  landmarks=['deniz kıyısı','üç iskele','yük vinci','gümrük ofisi','depo içleri','açık yükleme alanı'];
 }

 // Purposeful small combat pockets beside the through-routes, with readable cover.
 if(id==='dust'){
  for(const [x,z] of [[-8,-12],[11,36],[9,-36]]){
   b('courtyard-planter',x,0,z,2.3,.85,1.1,'#a78d6a','stone');
   deco('planter-soil',x,.85,z,2.1,.03,.9,'#706650');
   for(const dx of [-.65,0,.65])deco('dry-plant',x+dx,.88,z,.18,.45,.18,'#7b8863').shape='cone';
  }
  for(const [x,z,y] of [[-15,-24,5.9],[15,-24,6.5],[-19,25,4.8],[19,27,5.5]]){
   deco('woven-roof-rug',x,y,z,3,.025,2,'#a87660','fabric');
   for(const dx of [-.8,.8])deco('wall-ceramic',x+dx,1,z-8.2,.35,.55,.35,'#b88760','stone').shape='cylinder';
  }
 }else if(id==='neon'){
  for(const [x,z] of [[11,-26],[-11,28],[31,-29]]){
   b('street-power-cabinet',x,0,z,1.8,1.25,.9,'#48677e','metal');
   const display=deco('public-map-display',x,1.28,z,1.6,.45,.6,'#4cbba9');display.glow=true;
  }
  for(const [x,z,y] of [[-23,-18,12.4],[24,-6,18.4],[25,25,7.4]]){
   for(const dx of [-2,2])deco('roof-solar-array',x+dx,y,z,3,.15,4,'#375475','glass');
  }
 }else{
  vehicle(21,-43,true);
  for(const [x,z] of [[18,5],[-5,10],[23,37]]){
   b('dock-cable-spool',x,0,z,1.3,1.2,1.3,'#857357','wood',false,'cylinder');
   deco('spool-cable',x,.18,z,1.36,.85,1.36,'#4b5962','metal').shape='cylinder';
  }
  for(const [x,z,y] of [[-9,-18,6.28],[29,-23,7.28],[28,20,8.28]]){
   deco('roof-duct',x+3,y,z,1.4,.55,4,'#70858a','metal');
   sign('YUKLEME / DIKKAT',x+4,1.6,z+7.8,2.8,'#886b42');
  }
 }
 // Authored district expansion: longer routes and broader doors/alleys; unchanged step risers.
 const expansion=1.35;
 for(const solid of solids){solid.x*=expansion;solid.z*=expansion;solid.w*=expansion;solid.d*=expansion;}
 for(const p of spawns){p.x*=expansion;p.z*=expansion;}
 for(const r of routes)for(const p of r.points){p.x*=expansion;p.z*=expansion;}
 elevated={...elevated,x:elevated.x*expansion,z:elevated.z*expansion};
 // Façade-level street detail is cosmetic and never blocks a traversal route.
 for(const base of [...solids].filter(s=>s.id.includes('lamp-post'))){
  deco('street-bin',base.x+.8,0,base.z,.5,.8,.5,id==='neon'?'#426279':'#667775','metal');
  deco('street-drain',base.x, .025,base.z+1.3,.7,.02,.4,'#35424a','metal');
 }

 return {id,name,subtitle,bounds:48*expansion,sky,floor,solids,spawns,routes,landmarks,targets:[{id:'close',position:{x:0,y:0,z:-25*expansion}},{id:'mid',position:{x:9*expansion,y:0,z:-4*expansion}},{id:'far',position:id==='dust'?{x:32*expansion,y:0,z:34*expansion}:{x:40*expansion,y:0,z:35*expansion}},{id:'elevated',position:elevated},{id:'strafer',position:{x:0,y:0,z:-10*expansion},moving:true}],hazard:id==='dust'?{x:-4*expansion,z:43*expansion,r:1.4}:{x:45*expansion,z:-43*expansion,r:1.4}};
}
