import type {Solid} from './types';

/** Heights are authored visual estimates for the 3D Dust II reconstruction. */
export const DUST2_LEVELS={a:3.2,upperTunnel:2.4,lowerTunnel:0};
export const CATWALK=[{x:13,z:16},{x:13,z:27},{x:21,z:27},{x:21,z:36},{x:34,z:36}];
const segment=(x:number,z:number,a:{x:number;z:number},b:{x:number;z:number},r:number)=>
  x>=Math.min(a.x,b.x)-r&&x<=Math.max(a.x,b.x)+r&&z>=Math.min(a.z,b.z)-r&&z<=Math.max(a.z,b.z)+r;

export function catwalkAt(x:number,z:number){
  return CATWALK.slice(1).some((b,i)=>segment(x,z,CATWALK[i],b,1.65));
}

export function carvedOpening(x:number,z:number){
  return (
    (x>7&&x<27&&z>31&&z<35)||
    (x>23&&x<27&&z>19&&z<35)||
    (x>23&&x<49&&z>19&&z<23)||
    (x>-43&&x<-26&&z>1.5&&z<12.5)||
    (x>-47.4&&x<-42.6&&z>12&&z<32)||
    (x>-30&&x<-20&&z>37&&z<40)||
    (x>-30&&x<-18&&z>27&&z<33)||
    (x>-23&&x<-9&&z>6&&z<13)||
    (x>-10&&x<-4&&z>8.3&&z<11.7)||
    (Math.abs(x-13)<2&&z>15&&z<27)||
    (Math.abs(x+23)<5&&Math.abs(z-10)<1.6)||
    (Math.abs(x+22)<1.8&&z>28&&z<40)||
    catwalkAt(x,z)
  );
}

export function deckHeight(x:number,z:number){
  if(x<-20&&x>-30&&z>37&&z<40)return 2.4;
  if(x>37.5&&x<41&&z>30&&z<34)return 3.2;
  if(x>27&&x<52&&z>33&&z<46)return DUST2_LEVELS.a;
  if(catwalkAt(x,z)&&z>=23)return DUST2_LEVELS.a;
  if((x<-27&&z>2)||(x<-24&&z>2&&z<13))return DUST2_LEVELS.upperTunnel;
  return 0;
}

export function addDust2Architecture(solids:Solid[],walkable:(x:number,z:number)=>boolean){
  let serial=0;
  const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,color='#cbb89a',detail=false,surface:Solid['surface']='stone')=>{
    const s:Solid={id:`district-${name}-${serial++}`,kind:'box',x,y,z,w,h,d,color,detail,surface};
    solids.push(s);
    return s;
  };
  const ramp=(name:string,x:number,z:number,w:number,d:number,h:number,axis:'x'|'z',reverse=false)=>
    solids.push({id:'district-'+name,kind:'ramp',x,y:0,z,w,d,h,axis,reverse,color:'#bbac91',surface:'stone'});

  // Floors follow the existing footprint; no new terrain is painted over buildings.
  const cell=.89408;
  const noFloor=(x:number,z:number)=>
    ((x>42&&x<52&&z>21&&z<29)||(x>38.9&&x<47&&z>27.5&&z<32.5))||
    (Math.abs(x-13)<2&&z>15&&z<23)||
    (x>-29&&x<-19&&Math.abs(z-30)<2.4)||
    (x>-27&&x<-20&&Math.abs(z-10)<1.7)||
    (Math.abs(x+22)<1.8&&z>32.6&&z<38.3);

  const floors=Array.from({length:128},(_,iz)=>Array.from({length:128},(_,ix)=>{
    const x=(ix+.5-64)*cell,z=(64-iz-.5)*cell,h=deckHeight(x,z);
    return h&&walkable(x,z)&&!noFloor(x,z)?(catwalkAt(x,z)&&x>-5?-h:h):0;
  }));
  const used=floors.map(row=>row.map(()=>false));
  for(let iz=0;iz<128;iz++)for(let ix=0;ix<128;ix++){
    const v=floors[iz][ix];if(!v||used[iz][ix])continue;
    let w=1,d=1;while(ix+w<128&&floors[iz][ix+w]===v&&!used[iz][ix+w])w++;
    outer:while(iz+d<128){for(let k=0;k<w;k++)if(floors[iz+d][ix+k]!==v||used[iz+d][ix+k])break outer;d++;}
    for(let zz=0;zz<d;zz++)for(let xx=0;xx<w;xx++)used[iz+zz][ix+xx]=true;
    const x=(ix+w/2-64)*cell,z=(64-iz-d/2)*cell,h=Math.abs(v),bridge=v<0;
    box(bridge?'catwalk-deck':'raised-floor',x,bridge?h-.28:0,z,w*cell+.006,bridge?.28:h,d*cell+.006);
  }

  // ============================================================================
  // 1. A SITE PLATFORM, A LONG RAMP & GOOSE ARCHITECTURE
  // ============================================================================
  box('a-site-infill',39.5,0,39.5,25,3.2,13);
  ramp('a-ramp-long',47,24.5,8,7,1.6,'z');
  box('a-ramp-corner',47,0,29,3,1.6,2);
  box('a-ramp-landing',38.5,0,31.5,3,3.2,5);
  box('a-ramp-apron-infill',49,0,30.5,4,1.6,5);
  box('a-rear-parapet',39.5,3.2,46.12,25,.85,.24);
  box('a-east-parapet',51.95,3.2,39.5,.24,.85,13);
  box('a-ramp-upper-base',43,0,30,8,1.6,5);
  solids.push({id:'district-a-ramp-upper',kind:'ramp',x:43,y:1.6,z:30,w:8,d:5,h:1.6,axis:'x',reverse:true,color:'#bbac91',surface:'stone'});

  // Goose back corner architecture & stepped sandbag wall at northeast A site
  box('a-goose-backwall',43.5,3.2,45.8,8.5,4.2,.45,'#d8c7ab',false,'plaster');
  const gooseSign=box('a-goose-sign',43.5,5.1,45.52,2.6,.95,.08,'#8f3d2b',true,'plaster');
  gooseSign.label='GOOSE';

  // ============================================================================
  // 2. CT SPAWN, CT UNDERPASS & A-SITE SIGHTLINE ISOLATION WALLS
  //    Blocks direct sightlines from CT Spawn / CT Mid onto A Site while keeping
  //    CT Underpass -> A Long and Short / Catwalk -> A Site 100% walkable.
  // ============================================================================
  // North boundary wall of CT Spawn & CT Mid (blocks any direct look north from CT Spawn)
  box('ct-spawn-north-wall',2.0,0,35.6,34.0,7.8,.45,'#c6b394',false,'stone');
  // Ground-level north wall of CT Underpass beneath the Catwalk deck (y=0..2.92)
  box('ct-underpass-north-lower-wall',23.0,0,35.2,8.0,2.92,.4,'#b8a587',false,'stone');
  // East retaining wall along CT-to-Long connector (separates x=25 underpass corridor from A Site)
  box('ct-long-east-retaining-wall',26.85,0,27.8,.45,7.8,11.6,'#c2ae90',false,'stone');
  // North retaining wall of CT-to-Long corridor (blocks diagonal views from z=20.5 up to A Site)
  box('ct-long-north-retaining-wall',34.8,0,22.4,16.2,7.8,.45,'#c2ae90',false,'stone');
  // West retaining wall along A-Ramp upper landing (x=36.8, z=22.4..33.4)
  box('a-ramp-west-retaining-wall',36.8,0,27.9,.45,7.8,11.0,'#c2ae90',false,'stone');
  // South retaining & overhang wall along A Site facing CT Spawn (x=26.8..35.4, z=33.2)
  box('a-site-south-overhang-wall',31.1,0,33.2,8.6,7.8,.45,'#c8b698',false,'stone');
  // West retaining wall of A Site north of Catwalk entrance (x=26.85, z=38.2..46.2)
  box('a-site-west-retaining-wall',26.85,0,42.2,.45,7.8,8.0,'#c8b698',false,'stone');

  // Elevated Catwalk & Short A corridor walls (y=3.2..7.8, preserving full headroom below for CT Underpass)
  box('catwalk-west-high-wall',19.1,3.2,37.4,.35,4.6,17.2,'#cbb89a',false,'plaster');
  box('catwalk-north-high-wall',23.0,3.2,38.2,8.0,4.6,.4,'#c4b193',false,'plaster');
  box('catwalk-east-high-wall',22.9,3.2,29.5,.35,4.6,9.0,'#cbb89a',false,'plaster');
  box('a-short-south-high-wall',29.1,3.2,34.0,12.4,4.6,.35,'#cbb89a',false,'plaster');
  // Catwalk-to-A Portal overhead arch lintel & Ninja double-box screen
  box('catwalk-portal-lintel',26.85,5.35,36.1,.5,2.45,4.2,'#bfa989',false,'stone');
  box('a-short-ninja-crate',28.6,3.2,39.4,1.7,2.9,2.2,'#a8987c',false,'wood');
  box('a-short-ninja-tarp',28.6,6.1,39.4,1.8,.08,2.3,'#5c8785',true,'fabric');

  // CT Underpass ceiling & fascia beam
  box('ct-underpass-roof',22.5,2.92,33.2,8.6,.28,4.8,'#b8a78b');
  box('ct-underpass-fascia',18.3,2.25,33.2,.35,.95,4.8,'#a99578');

  // ============================================================================
  // 3. B SITE FORTRESS, B DOORS, B WINDOW & CT-MID SIGHTLINE ISOLATION
  //    Seals B Site into an authentic walled courtyard with B Doors & B Window
  //    chokepoints so CT Spawn / CT Mid cannot see into B Site.
  // ============================================================================
  ramp('tunnel-entrance-ramp',-38,-4,7,12,2.4,'z');
  box('b-apron-infill',-25.5,0,38.7,4,2.4,12.6);
  box('b-window-rear-infill',-23.5,0,42.5,8,2.4,5);
  ramp('b-doors-ramp',-24,30,10,4.8,2.4,'x',true);

  // East perimeter wall sealing B Window stairwell & B Site from CT Mid / CT Spawn (x=-19.8, z=32.5..48.0)
  box('b-window-east-perimeter-wall',-19.8,0,40.25,.45,7.8,15.5,'#c4b092',false,'stone');
  // South perimeter wall of B Doors ramp & B Site (z=27.2, x=-42.2..-19.8)
  box('b-site-south-perimeter-wall',-31.0,0,27.2,22.4,7.8,.45,'#c4b092',false,'stone');
  // West wall of B Window chute & B-Doors-to-Window divider (x=-23.8, z=32.5..36.4, y=2.4..7.8)
  box('b-window-west-divider-wall',-23.8,2.4,34.45,.4,5.4,3.9,'#c8b698',false,'stone');
  // B-Site South-East Fortress Wall separating B Doors apron from B Site core (x=-27.6, z=36.2, y=2.4..7.8)
  box('b-site-se-fortress-wall',-27.6,2.4,36.2,7.6,5.4,.45,'#bfa988',false,'stone');

  // B Doors Archway & Jamba Walls at top of B-Doors ramp (x=-28.8)
  box('b-doors-south-jamb-wall',-28.8,0,27.85,.45,7.6,1.5,'#bda888',false,'stone');
  box('b-doors-north-jamb-wall',-28.8,2.4,34.35,.45,5.2,3.9,'#bda888',false,'stone');
  box('b-doors-arch-lintel',-28.8,5.1,30.5,.5,2.5,3.8,'#cdb99a',false,'stone');
  for(const side of [-1,1]){
    box('b-doors-leaf',-28.55,2.4,30.5+side*1.45,.18,2.7,.65,'#797367',false,'wood');
  }

  // Iconic B-Doors interior Double-Stack Sanctuary Crates (blocks straight sightlines through B Doors into B Site)
  box('b-doors-sanctuary-crate',-36.4,2.4,29.8,1.5,3.2,4.4,'#a8987c',false,'wood');
  box('b-doors-sanctuary-tarp',-36.4,5.6,29.8,1.6,.08,4.5,'#689c9a',true,'fabric');

  // CT-Mid & B-Slope staggered baffle walls (prevents CT Spawn / CT Mid from looking down B Doors ramp)
  box('ct-mid-arch-baffle',2.2,0,30.1,.5,7.4,4.2,'#c8b698',false,'stone');
  box('b-slope-entry-baffle',-14.5,0,29.2,.5,7.4,4.6,'#c8b698',false,'stone');

  // B Window raised breach opening (x=-22, z=38) with full flanking masonry walls
  box('b-window-sill',-22,2.2,38,3,.2,.4);
  for(const side of [-1,1])box('b-window-jamb',-22+side*1.65,2.4,38,.3,2.8,.5);
  box('b-window-lintel',-22,5.2,38,3.6,.35,.5);
  box('b-window-east-flank',-20.1,2.4,38,1.0,5.2,.45,'#c4b092',false,'stone');
  box('b-window-west-flank',-26.2,2.4,38,5.2,5.2,.45,'#c4b092',false,'stone');
  // Interior B-Window screen crate on B back-plat (blocks deep sightlines while allowing window breach)
  box('b-window-backplat-crate',-22.0,2.4,42.2,2.4,2.8,1.4,'#b1a58b',false,'wood');

  // ============================================================================
  // 4. SHORT STAIRS, MID XBOX, TUNNELS & ICONIC DUST II COVER
  // ============================================================================
  box('short-stairs-outside-wall',14.85,0,20,.3,6.5,10,'#c8b99e');
  for(let i=0;i<32;i++)box('short-stairs-parapet',11.15,0,15+(i+.5)*.25,.3,(i+1)*.1+.9,.255);
  box('short-landing-parapet',11.15,3.2,24,.3,.9,2);
  box('short-elbow-parapet',17,3.2,28.85,4,.9,.3);
  box('short-a-approach-parapet',24.5,3.2,34.15,5,.9,.3);

  // Iconic Mid Xbox crate at Short entrance corner
  box('mid-xbox-crate',9.3,0,12.6,1.9,1.65,1.9,'#b1a58b',false,'wood');
  box('mid-xbox-tarp',9.3,1.65,12.6,2.0,.08,2.0,'#689c9a',true,'fabric');
  // A Long Blue Shipping Container along east wall
  box('a-long-blue-container',50.2,0,8.0,2.1,2.6,5.4,'#2d5a7b',false,'metal');

  // Stair treads (Short, Upper-to-Lower Tunnels, B Window)
  for(let i=0;i<32;i++)box('stair-tread-short',13,0,15+(i+.5)*.25,3.3,(i+1)*.1,.255);
  for(let i=0;i<24;i++)box('tunnel-stair-tread',-27+(i+.5)*.25,0,10,.255,2.4-(i*.1),2.8);
  for(let i=0;i<24;i++)box('window-stair-tread',-22,0,33.2+(i+.5)*.20834,2.6,(i+1)*.1,.214);

  // Tunnel enclosures, with entrance arches and intentionally broken upper roof beams.
  const tunnel=(name:string,x:number,z:number,w:number,d:number,floor:number,roof:number)=>{
    box(name+'-roof',x,roof,z,w,.3,d,'#9e8c70',false,'plaster');
    for(const side of [-1,1]){
      if(name==='lower-tunnels'&&side===-1){for(const q of [-1,1])box(name+'-wall',x+side*w/2,floor,z+q*(d/2-.4),.25,roof-floor,.8);}
      else box(name+'-wall',x+side*w/2,floor,z,.25,roof-floor,d);
    }
    for(const end of [-1,1]){
      const zz=z+end*d/2;
      for(const side of [-1,1])box('arch-pier',x+side*(w/2-.4),floor,zz,.8,roof-floor,.35);
      for(let i=0;i<7;i++){const xx=-w/2+.7+i*(w-1.4)/6,yy=roof-.7+.45*(1-Math.abs(xx)/(w/2));box('arch-keystone',x+xx,yy,zz,(w-1.2)/7,.55,.4,'#d7c3a2',true);}
      box('entry-lintel',x,roof-.35,zz,w,.35,.3);
    }
  };

  // Lower runs east–west: stairs enter its west arch, Mid exits the east arch.
  box('lower-tunnels-roof',-16,3.5,10,13,.3,4.4,'#9e8c70',false,'plaster');
  for(const side of [-1,1])box('lower-tunnel-side-wall',-16,0,10+side*2.2,13,3.5,.25);
  for(const end of [-1,1]){
    for(const side of [-1,1])box('lower-arch-pier',-16+end*6.5,0,10+side*1.8,.35,3.5,.8);
    for(let i=0;i<7;i++){const z=8.5+i*.5,y=2.8+.4*(1-Math.abs(z-10)/2.2);box('lower-arch-stone',-16+end*6.5,y,z,.4,.55,.5,'#d7c3a2',true);}
    box('lower-arch-lintel',-16+end*6.5,3.15,10,.35,.35,4.4);
  }
  box('upper-support-column',-35.5,2.4,7.5,1.2,4.2,1.2,'#a99578');
  box('upper-tunnel-wall',-43,2.4,4.5,.3,4.4,5);
  box('upper-tunnel-wall',-28,2.4,5.1,.3,4.4,6.2);
  box('upper-tunnel-wall',-28,2.4,11.9,.3,4.4,.2);
  for(let z=2;z<=12;z+=2.5)box('upper-tunnel-roof-beam',-35.5,6.7,z,15.5,.22,.22,'#76654e',false,'wood');
  for(const x of [-42,-30])box('upper-roof-remnant',x,6.8,7,2,.25,10,'#b5a083',false,'plaster');
  tunnel('b-tunnels',-45,22,5,18,2.4,6.6);

  // Site cover: original crate geometry, tarpaulins, barrels
  for(const [x,z,y] of [[33,38,3.2],[37,40,3.2],[-35,44,2.4],[-39,39,2.4]]){
    box('shipping-crate',x,y,z,1.8,1.45,1.6,'#b1a58b',false,'wood');
    box('crate-tarp',x,y+1.45,z,1.9,.08,1.7,'#689c9a',true,'fabric');
    for(const side of [-1,1])box('crate-brace',x+side*.77,y+.1,z,.08,1.3,1.65,'#d1c2a6',true,'wood');
  }
  for(const [x,z,y] of [[31,42,3.2],[-40,45,2.4],[-31,40,2.4]])for(let i=0;i<2;i++){
    const s=box('barrel',x+i*.65,y,z,.52,.9,.52,'#738786',false,'metal');
    s.shape='cylinder';
  }

  // Original hotel facade behind A: recessed windows, projecting balcony and roofline.
  box('a-hotel',35,0,49.5,18,12,6,'#e1d7c2',false,'plaster');
  box('hotel-balcony',35,6.2,45.9,18.5,.3,1.4,'#d9cbb2',true,'stone');
  box('hotel-cornice',35,11.7,46.2,19,.35,.65,'#ece0c8',true,'stone');
  for(let x=28;x<=42;x+=3.5){
    box('hotel-recess',x,6.5,46.44,2.4,3.7,.12,'#426c69',true,'glass');
    for(const side of [-1,1])box('hotel-window-frame',x+side*1.25,6.3,46.3,.18,4.1,.35,'#e8ddc7',true,'stone');
    box('hotel-window-header',x,10.2,46.3,2.65,.2,.35,'#e8ddc7',true,'stone');
    for(let k=0;k<5;k++)box('balcony-rail',x-1+k*.5,6.6,45.5,.06,.85,.06,'#638481',true,'metal');
  }
  const hotelSign=box('hotel-sign',43,5,46.1,1.8,4.8,.12,'#729b97',true);
  hotelSign.label='KAPS HAN';
  box('b-fort-tower',-40,0,49,5,11,5,'#bda17c',false,'stone');
  for(const side of [-1,1])for(let k=0;k<4;k++)box('fort-merlon',-42.2+k*1.45,11,49+side*2.3,.65,.65,.55,'#cdb590',true,'stone');

  // Railings stop accidental falls along the short bridge, leaving both ends open.
  for(const side of [-1,1])box('catwalk-parapet',21+side*1.85,3.2,31.5,.3,.85,6);

  return solids.filter(s=>/raised-floor|catwalk-deck|stair-tread|a-ramp|entrance-ramp|doors-ramp|infill/.test(s.id));
}
