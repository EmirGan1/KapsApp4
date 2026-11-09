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
 const crate=(x:number,z:number)=>{b('cargo-crate',x,0,z,1.3,1.05,1.2,'#a17e55','wood');for(const side of [-1,1])deco('crate-binding',x+side*.45,0,z,.09,1.09,1.23,'#655745');};
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
   if(interior){
    // Interior & exterior framed photo slots on enterable buildings
    addBuildingPhotos(x,z,w,d,h,door);
   }
  };
 const routes:NonNullable<MapDefinition['routes']>=[];
 const route=(name:string,points:number[][])=>routes.push({name,points:points.map(([x,z,y=0])=>({x,y,z}))});
 let name='',subtitle='',sky='',floor='';let spawns:Vec3[]=[];let elevated={x:0,y:0,z:0};
 const spawn=(points:number[][])=>spawns=points.map(([x,z,y=0])=>({x,y,z}));
 let landmarks:string[]=[];
 const PHOTO_ASPECTS:readonly number[]=[.5625,.5625,4/3,16/9,.75,4/3,.75,1.803,4/3,4/3,4/3,4/3,.75,.75,.75];
 const mapSeed=id==='dust'?3:id==='neon'?7:11;
 const photoOrder=Array.from({length:15},(_,i)=>((i*4+mapSeed)%15)+1);
 let photoCursor=0;
 const nextPhotoAsset=()=>photoOrder[photoCursor++%photoOrder.length];
 const photoAnchors:{image:string;aspect:number;x:number;y:number;z:number;wallLength:number;wallHeight:number;rotationY:number}[]=[];
 const photo=(asset:number,x:number,y:number,z:number,wallLength:number,wallHeight:number,rotationY:number)=>{
  const idx=((asset-1)%PHOTO_ASPECTS.length+PHOTO_ASPECTS.length)%PHOTO_ASPECTS.length;
  photoAnchors.push({image:`/kapsstrike/photos/photo-${String(idx+1).padStart(2,'0')}.jpg`,aspect:PHOTO_ASPECTS[idx],x,y,z,wallLength,wallHeight,rotationY});
 };
 function addBuildingPhotos(x:number,z:number,w:number,d:number,h:number,door:number){
  const intY=Math.min(2.25,h*.46),intH=Math.min(2.9,h*.58);
  // Interior West & East walls (offset from center counter/crates)
  photo(nextPhotoAsset(),x-w/2+.25,intY,z-d*.2,d*.42,intH,Math.PI/2);
  photo(nextPhotoAsset(),x+w/2-.25,intY,z+d*.2,d*.42,intH,-Math.PI/2);
  // Interior North entry pier wall
  const pierW=(w-door)/2;
  if(pierW>=3.8){
   photo(nextPhotoAsset(),x+(w+door)/4,intY,z+d/2-.25,pierW*.82,intH,Math.PI);
   // Exterior South entry pier wall
   photo(nextPhotoAsset(),x-(w+door)/4,Math.min(2.8,h*.5),z-d/2-.25,pierW*.82,Math.min(3.4,h*.62),Math.PI);
  }
 }
 const bounds = 36;
 const deck = (tag:string,x:number,z:number,w:number,d:number,y:number,color:string) =>
  b(tag,x,y-.24,z,w,.24,d,color,'metal');
 const rail = (x:number,y:number,z:number,w:number,d:number,color:string) =>
  b('rail',x,y,z,w,.85,d,color,'metal');
 // The outside edge is a wall face or waterfront, with no walkable strip behind it.
 const edge = (tag:string,x:number,z:number,w:number,d:number,h:number,color:string,surface:Surface) =>
  b(tag,x,0,z,w,h,d,color,surface);
 const endWalls = (color:string,surface:Surface,west=-35) => {
  for(const z of [-35,35]) for(const x of [west/2,17.5]){
   const width=x<0?-west:35;
   edge('street-end',x,z,width+2,2,4,color,surface);
  }
  for(const z of [-18,18])edge('east-edge',35,z,2,38,4,color,surface);
 };
 const pictureWall = (x:number,z:number,y:number,width:number,rotationY=0) => {
  for(let i=0;i<3;i++){
   const offset=(i-1)*width/3;
   photo(nextPhotoAsset(),x+Math.cos(rotationY)*offset,y,z-Math.sin(rotationY)*offset,width/3.2,2.5,rotationY);
  }
 };
 let training: Vec3[];
 if(id==='dust'){
  name='Dust · Kemer Sokakları';subtitle='Dar taş sokaklar, küçük avlular ve basamaklı çatı geçidi';sky='#d6c3a2';floor='#c8b28c';
  const stone='#b49975';
  endWalls(stone,'stone');
  for(const z of [-18,18])edge('west-edge',-35,z,2,38,5,stone,'stone');
  // Edge-attached homes alternate left and right to make short bends and cross lanes.
  for(const [tag,x,z,w,d,h] of [
   ['caravan',-25,-18,18,12,4.6],['bakery',24,-12,19,11,5.2],
   ['workshop',-24,7,20,12,4.8],['tea-house',25,14,18,11,5.5],
   ['sarnic',-26,25,16,10,4.5],
  ] as const) building(tag,x,z,w,d,h,'#c4a482','desert');
  edge('caravan-annex',-4,-18,2.2,9,3.2,stone,'stone');
  edge('market-annex',6,-21,4,7,3.6,stone,'plaster');
  // Broken cross walls with wide portals. Neither long sightline spans the map.
  for(const [x,z,w] of [[-9,-5,14],[12.5,-5,13],[-16,18,16],[5,18,12]]){
   b('stone-spur',x,0,z,w,3.4,1.25,stone,'stone');
  }
  for(const x of [-1,4]){
   b('arcade-pier',x,0,4,.8,3.7,1.1,stone,'stone');
  }
  for(let i=0;i<12;i++){
   const dx=-2.1+(i+.5)*4.2/12;
   const opening=2.65+Math.sqrt(1-(dx/2.1)**2)*.75;
   b('arch-keystone',1.5+dx,opening,4,.36,3.7-opening,1.1,stone,'stone');
  }
  b('well',-5,0,10,1.8,.86,1.8,stone,'stone',false,'cylinder');
  for(const [x,z] of [[9,-12],[-6,25],[16,26]]){
   b('market-counter',x,0,z,2.5,1,1.25,'#927052','wood');
   deco('market-canopy',x,2.7,z,3.2,.12,2.2,'#ad7661','fabric');
  }
  steps(-12,1,2.8,12,2.6,stone);
  b('roof-landing',-12,0,15,3.2,2.6,4,stone,'stone');
  b('roof-terrace',-8,2.36,15,5,.24,3.5,stone,'stone');
  sign('SARNIÇ PAZARI',1.5,3.7,3.35,5,'#785e45');
  for(const z of [-21,0,27])road(0,z,8,11,'#bcaa8d');
  spawn([[-10,-29],[1,-28],[13,-27],[-10,-11],[29,-23],[-26,32],[-17,28],[0,30],[23,29],[28,2]]);
  route('Kemer ve sarnıç',[[-10,-29],[-2,-25],[-2,-20],[0,-9],[0,-2],[1.5,0],[1.5,8],[1,12],[-4,14],[-4,22],[4,26],[23,29]]);
  route('Batı taş avluları',[[1,-28],[-10,-22],[-12,-10],[-3,-9],[0,-2],[-8,0],[-8,13],[-5,16],[-5,22],[-10,25],[-17,28]]);
  route('Doğu dar geçidi',[[29,-23],[12,-22],[9,-18],[0,-9],[0,-2],[8,0],[12,9],[13,16],[13,22],[19,23]]);
  route('Kuzey dükkânları',[[-26,32],[-22,32],[-11,32],[1,33],[13,33],[23,29]]);
  route('Güney avluları',[[-10,-29],[-5,-25],[4,-25],[13,-27],[24,-25],[29,-23]]);
  elevated={x:-12,y:2.6,z:15};
  training=[{x:1,y:0,z:-18},{x:1.5,y:0,z:8},{x:19,y:0,z:24},{x:-7,y:0,z:-13}];
  landmarks=['kemer sokağı','sarnıç avlusu','çatı terası','pazar tezgâhları'];
 }else if(id==='warehouse'){
  name='Liman · Konteyner Hatları';subtitle='Rıhtıma paralel yük hatları, çapraz koridorlar ve kısa servis köprüsü';sky='#aac5d2';floor='#87938f';
  endWalls('#84918f','concrete',-23);
  deco('sea',-56,-.018,0,66,.03,115,'#427f94','water');
  edge('water-boundary',-30,0,15,24,72,'#427f94','water').hidden=true;
  for(const z of [-26,-8,10,28])edge('quay-edge',-22.25,z,.5,1.05,18.2,'#667e85','concrete');
  const cargo=(x:number,z:number,d:number,color:string,stacked=false)=>{
   b('shipping-container',x,0,z,2.6,2.55,d,color,'metal');
   if(stacked)b('stacked-container',x,2.55,z,2.6,2.55,d,'#71868a','metal');
   for(let dz=-d/2+.55;dz<d/2;dz+=.8)deco('container-rib',x+1.32,.12,z+dz,.045,2.25,.07,'#55666d','metal');
  };
  for(const [x,z,d,color,stacked] of [
   [-16,-22,12,'#a8755f',true],[-16,-4,9,'#667e85',false],[-16,17,14,'#788c7a',true],
   [-7,-12,13,'#667e85',true],[-7,7,12,'#a8755f',false],[-7,28,9,'#788c7a',false],
   [5,-26,10,'#788c7a',false],[5,-7,10,'#a8755f',true],[5,14,11,'#667e85',true],
   [16,-13,11,'#a8755f',true],[16,6,10,'#788c7a',false],[16,27,9,'#667e85',true],
  ] as const) cargo(x,z,d,color,stacked);
  building('customs-depot',27,0,13,13,5.2,'#a09e90','port');
  building('cold-storage',28,24,11,14,6,'#ad9381','port');
  building('dock-office',26,-23,15,12,5,'#bcc2b4','port');
  for(const x of [-19,-11])for(const z of [0,7])b('crane-leg',x,0,z,.55,10,.55,'#c2aa69','metal');
  b('crane-gantry',-15,10,3.5,17,.8,2.4,'#c2aa69','metal');
  for(const x of [-20,-11,-1,10,21])road(x,0,3.5,64);
  steps(10,-11,2.8,12,2.6,'#75878d');
  deck('service-platform',10,3,4,4,2.6,'#75878d');
  deck('service-bridge',12,3,8,3,2.6,'#75878d');
  rail(12,2.6,4.48,8,.1,'#667782');
  sign('RIHTIM 04',27,3.2,-6.8,7,'#48636f');
  deco('freighter-hull',-42,0,7,9,3.5,31,'#4c6069','metal');
  deco('ship-bridge',-42,3.5,13,7,4.5,6,'#bec8c5','metal');
  spawn([[0,-28],[-20,-28],[-12,-30],[10,-29],[19,-31],[0,29],[-20,29],[-12,31],[10,31],[21,30]]);
  route('Rıhtım hattı',[[-20,-28],[-20,-20],[-18,-18],[-18,-13],[-20,-9],[-20,10],[-18,12],[-18,20],[-20,24],[-20,29]]);
  route('Konteyner zikzağı',[[-12,-30],[-12,-3],[-12,16],[-12,23],[-1,23],[-1,29]]);
  route('Doğu servis hattı',[[19,-31],[17.75,-29.9],[17.75,-16.5],[19.6,-15],[19.6,8],[21,9],[21,18],[21,30]]);
  route('Gümrük deposu',[[19,-31],[17.75,-29.9],[17.75,-16.5],[19,-15],[20,-8],[27,-8],[27,8],[22,11],[21,19],[21,30]]);
  for(const [x,z] of [[0,-13],[1,9],[-20,-16],[-20,16]]){
   b('lane-baffle',x,0,z,1.9,2.2,.85,'#627b84','metal');
  }
  route('Orta yük hattı',[[0,-28],[0,-19],[-3,-16],[-3,-10],[0,-4],[-1,5],[-1,12],[0,23],[0,29]]);
  elevated={x:10,y:2.6,z:3};
  training=[{x:0,y:0,z:-18},{x:-11,y:0,z:2},{x:21,y:0,z:24},{x:0,y:0,z:7}];
  landmarks=['konteyner hatları','servis köprüsü','rıhtım','yük vinci'];
  pictureWall(27,-6.8,2,8);pictureWall(28,16.8,2,8);pictureWall(26,-29.3,2,9);
 }else{
  name='Neon City · Aktarma İstasyonu';subtitle='İki katlı metro koridorları, servis geçitleri ve neon köprüler';sky='#111d35';floor='#303d4c';
  endWalls('#34485d','metal');
  for(const z of [-18,18])edge('west-edge',-35,z,2,38,5,'#34485d','metal');
  for(const [tag,x,z,w,d,h] of [
   ['west-terminal',-25,-17,18,13,11],['east-terminal',25,18,18,13,12],
   ['neon-club',-26,20,16,13,9],['tech-store',26,-21,16,12,10],
  ] as const) building(tag,x,z,w,d,h,'#3c526a','city');
  // Thick station wings define small rooms and a covered north–south underpass.
  for(const [x,z,w,d] of [[-12,0,7,15],[12,0,7,15],[-15,13,4,7],[14,-13,4,7]]){
   b('station-wing',x,0,z,w,6.4,d,'#3b5066','metal');
   deco('station-window',x,2.2,z-d/2-.02,w*.6,1.2,.04,'#598fa3','glass').glow=true;
  }
  const level=3.6;
  deck('skyway-deck',0,0,17,12,level,'#718699');
  for(const side of [-1,1]){
   rail(side*8.45,level,0,.12,12,'#536a83');
   for(const x of [-5.7,5.7])rail(x,level,side*5.95,5.4,.12,'#536a83');
   deco('platform-strip',side*7.9,level+.03,0,.09,.03,11,'#61d7d0').glow=true;
  }
  ramp('south-platform-ramp',0,-12,4.2,level,12,'z','#718699','metal');
  ramp('north-platform-ramp',0,12,4.2,level,12,'z','#718699','metal');
  solids[solids.length-1].reverse=true;
  steps(-5,-18,2.6,12,level,'#718699');
  deck('stair-landing',-5,-5,2.8,2,level,'#718699');
  // Remove the rail only where the west stair opens onto the platform.
  const stairRail=solids.find(s=>s.id.includes('rail')&&s.x===-5.7&&s.z<0);
  if(stairRail){stairRail.x=-7.6;stairRail.w=1.6;}
  for(const [x,z] of [[-21,-4],[21,3],[-10,24],[12,-24]]){
   b('neon-kiosk',x,0,z,2,1.6,1.4,'#45657f','metal');
   deco('kiosk-display',x,.85,z-.72,1.6,.6,.05,'#5ddfd1').glow=true;
  }
  for(const x of [-5,5])road(x,0,3.6,66,'#253140');
  sign('AKTARMA / ÜST HAT',0,4.8,-6.3,8,'#3c7c84',true);
  sign('MİR BÜFE',-26,3.3,13.25,7,'#24566b',true);
  sign('Yenihayat Ekspertiz',25,3.3,11.25,10,'#576489',true);
  sign('Ke1 Muhasebe',26,3.3,-27.25,9,'#3c7c84',true);
  for(const [x,z,w,d,h] of [[-45,-24,12,15,36],[43,19,12,18,41],[-18,47,13,15,38],[21,-47,16,13,43]]){
   deco('skyline',x,0,z,w,h,d,'#293d55','metal');
  }
  spawn([[-1,-28],[-13,-28],[12,-27],[-24,-27],[24,-30],[-1,27],[-12,28],[12,28],[-23,29],[24,29]]);
  route('Alt hat servis koridoru',[[12,-27],[6,-24],[5,-12],[5,0],[5,12],[8,23],[12,28]]);
  route('Üst hat rampaları',[[0,-25],[0,-18],[0,-6,level],[0,6,level],[0,18],[0,25]]);
  route('Batı çarşı geçidi',[[-13,-28],[-13,-20],[-13,-10],[-19,-8],[-19,4],[-19,8.5],[-11,8.5],[-11,20],[-12,28]]);
  route('Doğu teknik geçidi',[[24,-30],[24,-28],[17,-28],[16,-22],[16,-17.5],[17,-17.5],[17,-8],[18,7],[15,9],[15,15],[14,24],[12,28]]);
  route('Güney transferi',[[-24,-27],[-18,-27],[-9,-25],[-3,-25],[6,-25],[12,-27]]);
  elevated={x:0,y:level,z:0};
  training=[{x:5,y:0,z:-12},{x:5,y:0,z:4},{x:8,y:0,z:24},{x:4,y:0,z:18}];
  landmarks=['kapalı alt hat','çift rampalı üst hat','neon büfe','servis merdiveni'];
  pictureWall(-12,-7.54,2.5,5,Math.PI);
  pictureWall(12,7.54,2.5,5);
 }

 const neighborhood = id==='warehouse' ? [-11,21] : [-12,16];
 for(const [i,label] of ['Gazeteciler Sitesi','Yeni Nesil Eyüp Sitesi'].entries()){
  sign(label,neighborhood[i],3.8,i===0?-34:34,8,i===0?'#315c49':'#244f75',id==='neon');
 }
 const photoFrames:NonNullable<MapDefinition['photoFrames']>=photoAnchors.map((frame,index)=>{
  const height=Math.min(frame.wallHeight*.65,frame.wallLength*.65/frame.aspect);
  return{id:`${id}-photo-frame-${index+1}`,image:frame.image,x:frame.x,y:frame.y,z:frame.z,width:height*frame.aspect,height,rotationY:frame.rotationY};
 });
 return {id,name,subtitle,bounds,sky,floor,solids,spawns,routes,landmarks,photoFrames,
  targets:[
   ...training.map((position,index)=>({id:['close','mid','far','strafer'][index],position,moving:index===3})),
   {id:'elevated',position:elevated},
  ],
  hazard:{x:bounds+2,z:bounds+2,r:0},
 };
}
