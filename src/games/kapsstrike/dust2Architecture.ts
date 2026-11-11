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
    (x>26.5&&x<38.5&&z>22.5&&z<43.5)||
    (x>22.5&&x<25&&z>43&&z<46)||
    (x>-43&&x<-26&&z>1.5&&z<12.5)||
    (x>-26.5&&x<-24.5&&z>5&&z<8.5)||
    (x>-47.4&&x<-42.6&&z>12&&z<32)||
    (x>-30&&x<-20&&z>37&&z<40)||
    (x>-30&&x<-18&&z>27&&z<33)||
    (x>-29&&x<-25.5&&z>33&&z<44)||
    (x>-3&&x<7.5&&z>33.8&&z<35.8)||
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
    solids.push({id:'district-'+name,kind:'ramp',x,y:0,z,w,d,h,axis,reverse,color:'#ccb99b',surface:'stone'});

  // Helper for detailed CS:GO style wooden/military crates (detail sub-parts do not alter collision)
  const addCrateDetail=(tag:string,x:number,y:number,z:number,w:number,h:number,d:number,tone='#8c6d49',metalBand=true)=>{
    box(`${tag}-lid`,x,y+h,z,w+.06,.06,d+.06,tone,true,'wood');
    box(`${tag}-base-skid-l`,x-w*.32,y,z,.14,.08,d+.04,'#6e5437',true,'wood');
    box(`${tag}-base-skid-r`,x+w*.32,y,z,.14,.08,d+.04,'#6e5437',true,'wood');
    for(const sx of [-1,1])for(const sz of [-1,1]){
      box(`${tag}-post`,x+sx*(w/2+.015),y+h*.5,z+sz*(d/2+.015),.08,h,.08,tone,true,'wood');
    }
    if(metalBand){
      box(`${tag}-band-top`,x,y+h*.78,z,w+.05,.06,d+.05,'#4a4f52',true,'metal');
      box(`${tag}-band-bot`,x,y+h*.22,z,w+.05,.06,d+.05,'#4a4f52',true,'metal');
    }
  };

  // Helper for wrecked CS:GO style sedans (A Car & B Car)
  const addWreckedSedan=(tag:string,x:number,y:number,z:number,bodyColor:string,axis:'x'|'z'='z')=>{
    const alongZ=axis==='z';
    const w=alongZ?1.85:3.9,d=alongZ?3.9:1.85;
    box(`${tag}-chassis`,x,y+.22,z,w,.68,d,bodyColor,false,'metal');
    box(`${tag}-cabin`,x,y+.9,z+(alongZ?-.15:0),alongZ?1.62:2.05,.62,alongZ?2.05:1.62,bodyColor,true,'metal');
    box(`${tag}-roof`,x,y+1.48,z+(alongZ?-.15:0),alongZ?1.52:1.75,.08,alongZ?1.75:1.52,'#e5dfd3',true,'metal');
    box(`${tag}-windshield`,x,y+.96,z+(alongZ?.82:0),alongZ?1.46:.12,.48,alongZ?.12:1.46,'#4d6672',true,'glass');
    box(`${tag}-rear-glass`,x,y+.96,z+(alongZ?-1.12:0),alongZ?1.44:.12,.45,alongZ?.12:1.44,'#4d6672',true,'glass');
    box(`${tag}-bumper-f`,x,y+.26,z+(alongZ?1.98:0),alongZ?1.9:.16,.24,alongZ?.16:1.9,'#3c4043',true,'metal');
    box(`${tag}-bumper-r`,x,y+.26,z+(alongZ?-1.98:0),alongZ?1.9:.16,.24,alongZ?.16:1.9,'#3c4043',true,'metal');
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const wx=x+(alongZ?sx*.92:sz*1.28),wz=z+(alongZ?sz*1.28:sx*.92);
      const wheel=box(`${tag}-wheel`,wx,y,wz,.36,.62,.62,'#282b2e',true,'metal');
      wheel.shape='cylinder';
    }
  };

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
  // 1. A SITE PLATFORM, A LONG RAMP, GOOSE, CAR, PIT & BLUE CONTAINER
  //    Faithful to Reference PDF GÖRSEL #03, #08, #09, #20, #21
  // ============================================================================
  box('a-site-infill',39.5,0,39.5,25,3.2,13);
  ramp('a-ramp-long',47,24.5,8,7,1.6,'z');
  box('a-ramp-corner',47,0,29,3,1.6,2);
  box('a-ramp-landing',37.8,0,30.75,2.4,3.2,6.5);
  box('a-ramp-apron-infill',49,0,30.5,4,1.6,5);
  box('a-rear-parapet',39.5,3.2,46.12,25,.85,.24);
  box('a-east-parapet',51.95,3.2,39.5,.24,.85,13);
  box('a-ramp-upper-base',43,0,30,8,1.6,5);
  solids.push({id:'district-a-ramp-upper',kind:'ramp',x:43,y:1.6,z:30,w:8,d:5,h:1.6,axis:'x',reverse:true,color:'#ccb99b',surface:'stone'});

  // Sandstone retaining wall coping & hazard markings around A Platform edge
  box('a-plat-south-coping',32.5,3.15,33.1,11,.14,.36,'#b89e7a',true,'stone');
  box('a-plat-east-coping',43.0,3.15,36.8,.36,.14,7.4,'#b89e7a',true,'stone');
  box('a-site-target-border-n',34.42,3.22,40.4,5.2,.03,.18,'#b5482a',true,'stone');
  box('a-site-target-border-s',34.42,3.22,35.6,5.2,.03,.18,'#b5482a',true,'stone');
  box('a-site-target-border-w',31.9,3.22,38.0,.18,.03,4.9,'#b5482a',true,'stone');
  box('a-site-target-border-e',36.94,3.22,38.0,.18,.03,4.9,'#b5482a',true,'stone');

  // Goose back corner architecture at northeast A site (GÖRSEL #03, #08)
  box('a-goose-backwall',43.5,3.2,45.8,8.5,4.2,.45,'#d8c7ab',false,'plaster');
  box('a-goose-east-wing',47.6,3.2,43.8,.45,4.0,4.2,'#d4c2a4',false,'plaster');
  box('a-goose-step-curb',43.5,3.2,45.1,6.4,.18,.9,'#bfb094',true,'stone');
  const gooseSign=box('a-goose-sign',43.5,5.1,45.52,2.8,1.05,.08,'#8f3d2b',true,'plaster');
  gooseSign.label='GOOSE';

  // A Cross & A Long road curbs, A Car, Blue Container, Pit (GÖRSEL #09, #20)
  box('a-cross-curb-west',42.8,0,20.5,.28,.12,14,'#b9a587',true,'stone');
  box('a-cross-curb-east',51.2,0,12.0,.28,.12,28,'#b9a587',true,'stone');
  addWreckedSedan('a-long-car',50.1,0,17.2,'#8d4c3e','z');
  // Blue corrugated container along east wall of A Long (GÖRSEL #09)
  box('blue-container-body',49.8,0,-2.2,2.3,2.55,5.8,'#2e5b88',false,'metal');
  box('blue-container-roof',49.8,2.55,-2.2,2.38,.08,5.88,'#24496e',true,'metal');
  for(let k=-2.4;k<=2.4;k+=.8){
    box('blue-container-rib',48.62,0,-2.2+k,.06,2.5,.14,'#214466',true,'metal');
  }
  // Pit defensive retaining wall & platform at south A Long (GÖRSEL #09)
  box('pit-retaining-wall',47.8,0,-12.6,4.2,1.15,.38,'#c6b192',false,'stone');
  box('pit-side-wing',45.6,0,-14.8,.38,1.25,4.6,'#c6b192',false,'stone');
  box('pit-back-bunker',48.2,0,-17.2,4.8,2.8,.45,'#bfa98a',false,'stone');

  // ============================================================================
  // 2. CT UNDERPASS BRIDGE & LOW A-SITE TERRACE
  //    Naturally blocks ground-level CT Spawn (y=0) from seeing A Site (y=3.2)
  //    while keeping A Long -> A Site and Catwalk -> A Site completely open.
  // ============================================================================
  box('a-retaining-core-infill',31.8,0,27.8,10,3.2,11.2,'#c8b698',false,'stone');
  box('a-terrace-south-parapet',31.8,3.2,22.4,10,.95,.4,'#d2c0a2',false,'stone');
  box('a-terrace-west-coping',26.9,3.2,27.8,.35,.88,10.8,'#cbb798',true,'stone');

  // CT Underpass bridge deck, arch beam (y=2.48..3.20m) & north bridge pier (y=0..4.25m)
  box('ct-underpass-roof',21.0,2.92,33.1,4.2,.28,4.6,'#b8a78b');
  box('ct-underpass-arch-beam',19.0,2.48,33.1,.4,.72,4.6,'#bfa989',false,'stone');
  box('ct-underpass-north-pier',19.0,0,37.8,.45,4.25,5.2,'#c4b193',false,'stone');
  box('ct-underpass-north-lower-wall',23.0,0,35.2,7.6,3.2,.4,'#b8a587',false,'stone');
  box('ct-underpass-south-pier',19.0,0,30.2,.45,3.2,1.4,'#c4b193',true,'stone');

  // ============================================================================
  // 3. CLEAN CS:GO B-SITE ENTRANCE (B DOORS, B WINDOW, SCAFFOLD & B CAR)
  //    Faithful to Reference PDF GÖRSEL #04, #05, #16, #24
  // ============================================================================
  ramp('tunnel-entrance-ramp',-38,-4,7,12,2.4,'z');
  box('b-apron-infill',-25.5,0,38.7,4,2.4,12.6);
  box('b-window-rear-infill',-23.5,0,42.5,8,2.4,5);
  // Continuous B Site platform floor slab eliminating any grid holes in B Site / Closet / Back Plat
  box('b-site-floor-infill',-38.2,0,36.8,18.6,2.4,18.8,'#c8b596',false,'stone');
  ramp('b-doors-ramp',-24,30,10,4.8,2.4,'x',true);

  // Outer perimeter walls of B Site & B Window pocket (sealing all rear/side edges)
  box('b-site-south-perimeter-wall',-35.5,0,27.2,13.4,5.8,.45,'#c4b092',false,'stone');
  box('b-site-west-perimeter-wall',-47.6,0,36.8,.45,6.8,19.2,'#bfa98b',false,'stone');
  box('b-site-north-perimeter-wall',-33.5,0,46.2,28.2,6.8,.45,'#bfa98b',false,'stone');

  // B Doors Wall (x=-28.8, z=27.2..38.0) with central doorway & angled wooden double doors
  box('b-doors-south-jamb-wall',-28.8,0,27.95,.45,5.8,1.5,'#cbb89a',false,'stone');
  box('b-doors-north-jamb-wall',-28.8,2.4,35.15,.45,3.4,5.7,'#cbb89a',false,'stone');
  box('b-doors-arch-lintel',-28.8,4.9,30.5,.45,.9,3.6,'#d6c4a6',false,'stone');
  for(const side of [-1,1]){
    box('b-doors-leaf',-28.55,2.4,30.5+side*1.45,.18,2.5,.65,'#797367',false,'wood');
    box('b-doors-frame-trim',-28.8,2.4,30.5+side*1.78,.52,2.5,.18,'#9c8466',true,'wood');
  }

  // B Window Wall (z=38.0, x=-28.8..-19.5) with raised breach opening at x=-22 & scaffolding (GÖRSEL #04, #24)
  box('b-window-west-flank',-26.2,2.4,38.0,5.2,3.4,.45,'#cbb89a',false,'stone');
  box('b-window-sill',-22.0,2.2,38.0,3.2,.2,.45);
  for(const side of [-1,1]){
    box('b-window-jamb',-22+side*1.65,2.4,38.0,.3,2.5,.45);
    box('b-window-brick-tooth',-22+side*1.42,2.8+Math.abs(side)*.3,38.0,.28,.45,.52,'#a66b4c',true,'stone');
  }
  box('b-window-lintel',-22.0,4.9,38.0,3.6,.9,.45);
  box('b-window-east-flank',-19.85,0,38.0,.7,5.8,.45,'#cbb89a',false,'stone');
  box('b-window-east-alcove-wall',-19.5,0,39.25,.45,5.8,9.5,'#c4b092',false,'stone');
  // Tubular scaffolding & timber plank ledge at B Window
  for(const sx of [-23.4,-20.6]){
    box('b-window-scaffold-post',sx,2.4,38.45,.08,2.8,.08,'#576066',true,'metal');
  }
  box('b-window-scaffold-plank',-22.0,2.42,38.45,3.1,.07,.42,'#8f724f',true,'wood');
  box('b-window-scaffold-crossbar',-22.0,4.6,38.45,3.1,.06,.06,'#576066',true,'metal');

  // B Car in B Closet / SW alcove (GÖRSEL #05, #16) - clear of all walk routes
  addWreckedSedan('b-closet-car',-40.8,2.4,29.2,'#d8d4c8','x');
  // B Site target markings & Back Plat low wall
  box('b-site-target-border-n',-37.1,2.42,43.0,4.8,.03,.18,'#b5482a',true,'stone');
  box('b-site-target-border-s',-37.1,2.42,38.4,4.8,.03,.18,'#b5482a',true,'stone');
  box('b-back-plat-parapet',-41.5,2.4,45.8,8.5,1.05,.32,'#b89f7d',true,'stone');

  // ============================================================================
  // 4. SHORT STAIRS, MID XBOX, COMPLETELY SEALED B TUNNELS & LOWER TUNNELS
  //    Fixes the known critical B Tunnel gap bug completely (GÖRSEL #14, #16, #27)
  // ============================================================================
  box('short-stairs-outside-wall',14.85,0,20,.3,6.5,10,'#c8b99e');
  for(let i=0;i<32;i++)box('short-stairs-parapet',11.15,0,15+(i+.5)*.25,.3,(i+1)*.1+.9,.255);
  box('short-landing-parapet',11.15,3.2,24,.3,.9,2);
  box('short-elbow-parapet',17,3.2,28.85,4,.9,.3);
  box('short-a-approach-parapet',24.5,3.2,34.15,5,.9,.3);
  box('short-arch-header',13,5.2,22.8,3.8,1.3,.45,'#d4c2a4',true,'stone');

  // Mid Xbox crate stack at Catwalk / Mid corner (GÖRSEL #18, #26)
  box('mid-xbox-main',9.35,0,13.6,1.65,1.55,1.65,'#987954',false,'wood');
  addCrateDetail('mid-xbox-main',9.35,0,13.6,1.65,1.55,1.65,'#876843');
  box('mid-xbox-step',7.95,0,13.6,1.05,.82,1.25,'#a68863',false,'wood');
  // Top Mid Green Box & Suicide arches (GÖRSEL #13, #15)
  box('top-mid-green-box',2.2,0,-15.8,1.5,1.45,1.5,'#586e54',false,'wood');
  box('suicide-arch-header',-3.3,3.8,-26.5,4.8,1.4,.55,'#d2bf9f',true,'stone');

  // Stair treads (Short, Upper-to-Lower Tunnels, B Window)
  for(let i=0;i<32;i++)box('stair-tread-short',13,0,15+(i+.5)*.25,3.3,(i+1)*.1,.255);
  for(let i=0;i<24;i++)box('tunnel-stair-tread',-27+(i+.5)*.25,0,10,.255,2.4-(i*.1),2.8);
  for(let i=0;i<24;i++)box('window-stair-tread',-22,0,33.2+(i+.5)*.20834,2.6,(i+1)*.1,.214);

  // ----------------------------------------------------------------------------
  // COMPLETE, GAP-FREE TUNNEL SYSTEM (Upper Tunnels, Tunnel Stairs, Lower Tunnels, B Tunnels)
  // ----------------------------------------------------------------------------
  // 4A. T-Side Tunnel Entrance Ramp Side Walls & Portal Arch (x: -41.6..-34.4, z: -10..2)
  box('tunnel-entrance-wall-w',-41.65,0,-4.0,.35,6.8,12.4,'#c2ae90',false,'stone');
  box('tunnel-entrance-wall-e',-34.35,0,-4.0,.35,6.8,12.4,'#c2ae90',false,'stone');
  box('tunnel-entrance-arch-lintel',-38.0,4.8,-9.8,7.6,2.0,.55,'#d4c1a3',false,'stone');
  box('tunnel-entrance-roof',-38.0,6.8,-3.8,7.6,.35,12.2,'#9e8c70',false,'plaster');

  // 4B. Upper Tunnels Continuous Floor Slab & Full Perimeter Walls (x: -47.6..-27.0, z: 1.5..13.2)
  // Main Upper Tunnels floor slab (leaves x: -27..-20, z: 8.5..11.5 open for the stairs down to Lower)
  box('upper-tunnel-floor-infill',-37.3,0,7.35,20.6,2.4,11.8,'#c4b193',false,'stone');
  box('upper-tunnel-floor-ne-infill',-25.8,0,12.25,2.8,2.4,1.9,'#c4b193',false,'stone');
  box('upper-tunnel-floor-se-infill',-25.8,0,5.0,2.8,2.4,7.2,'#c4b193',false,'stone');

  // South Wall of Upper Tunnels (z = 1.55, flanking the x = -41.5..-34.5 entrance ramp)
  box('upper-tunnel-south-wall-w',-44.55,0,1.55,6.1,6.8,.35,'#baa586',false,'stone');
  box('upper-tunnel-south-wall-e',-30.7,0,1.55,7.6,6.8,.35,'#baa586',false,'stone');
  box('upper-tunnel-south-lintel',-38.0,5.2,1.55,7.2,1.6,.35,'#cbb798',false,'stone');

  // West Wall of Upper Tunnels (x = -47.5, z = 1.5..13.2, connecting flush into b-tunnels at z = 13)
  box('upper-tunnel-west-wall',-47.5,0,7.35,.35,6.8,11.9,'#baa586',false,'stone');
  box('upper-tunnel-wall',-43,2.4,4.5,.3,4.4,5,'#c2ae90',false,'stone');

  // North Wall of Upper Tunnels (z = 13.1, x = -42.5..-27.0, sealing the north side east of B Tunnels)
  box('upper-tunnel-north-wall',-34.75,0,13.1,15.5,6.8,.35,'#baa586',false,'stone');

  // East Wall of Upper Tunnels (x = -27.0, z = 1.5..8.5 and z = 11.5..13.2, framing the stairwell at z = 10)
  box('upper-tunnel-wall',-27.0,0,5.0,.35,6.8,7.0,'#baa586',false,'stone');
  box('upper-tunnel-wall',-27.0,0,12.35,.35,6.8,1.7,'#baa586',false,'stone');
  box('upper-tunnel-stair-lintel',-27.0,5.2,10.0,.35,1.6,3.2,'#cbb798',false,'stone');

  // Upper Tunnels Vaulted Ceiling, Beams, Tile Trim & Central Column (GÖRSEL #14)
  box('upper-tunnels-roof',-37.25,6.8,7.35,20.8,.35,12.0,'#9e8c70',false,'plaster');
  for(const x of [-42,-30])box('upper-roof-remnant',x,6.72,7,2,.25,10,'#b5a083',true,'plaster');
  for(let z=2;z<=12;z+=2.5)box('upper-tunnel-roof-beam',-37.2,6.62,z,20.2,.22,.24,'#76654e',true,'wood');
  box('upper-support-column',-35.5,2.4,7.5,1.2,4.4,1.2,'#a99578',false,'stone');
  box('upper-support-column-base',-35.5,2.4,7.5,1.48,.38,1.48,'#8f7c60',true,'stone');
  box('upper-support-column-cap',-35.5,6.42,7.5,1.52,.38,1.52,'#8f7c60',true,'stone');
  // Decorative Moroccan tile band along Upper Tunnels walls
  box('upper-tunnel-tile-band-n',-34.75,3.85,12.9,15.2,.24,.06,'#3f6a78',true,'stone');
  box('upper-tunnel-tile-band-w',-47.3,3.85,7.35,.06,.24,11.4,'#3f6a78',true,'stone');

  // 4C. Tunnel Stairwell Enclosure (x: -27.2..-20.5, z: 7.8..12.2) — Completely seals side walls & ceiling!
  box('tunnel-stairs-wall-n',-23.8,0,11.65,6.8,6.8,.35,'#b8a487',false,'stone');
  box('tunnel-stairs-wall-s',-23.8,0,8.35,6.8,6.8,.35,'#b8a487',false,'stone');
  box('tunnel-stairs-roof',-23.8,6.8,10.0,6.8,.35,3.8,'#9e8c70',false,'plaster');
  box('tunnel-stairs-drop-bulkhead',-20.5,3.5,10.0,.35,3.3,3.8,'#b8a487',false,'stone');

  // 4D. Lower Tunnels (x: -22.5..-9.3, z: 7.8..12.2, y: 0..3.5) (GÖRSEL #27)
  box('lower-tunnels-roof',-16,3.5,10,13.4,.35,4.6,'#9e8c70',false,'plaster');
  for(const side of [-1,1]){
    box('lower-tunnel-side-wall',-15.2,0,10+side*2.2,11.6,3.5,.3,'#b8a487',false,'stone');
    box('lower-tunnel-tile-band',-15.2,1.5,10+side*2.03,11.4,.2,.05,'#3f6a78',true,'stone');
  }
  for(const end of [-1,1]){
    for(const side of [-1,1])box('lower-arch-pier',-16+end*6.5,0,10+side*1.8,.35,3.5,.8);
    for(let i=0;i<7;i++){const z=8.5+i*.5,y=2.8+.4*(1-Math.abs(z-10)/2.2);box('lower-arch-stone',-16+end*6.5,y,z,.4,.55,.5,'#d7c3a2',true);}
    box('lower-arch-lintel',-16+end*6.5,3.15,10,.35,.35,4.4);
  }

  // 4E. B Tunnels Corridor (x: -47.5..-42.5, z: 13..31, y: 2.4..6.6) (GÖRSEL #16)
  const tunnel=(name:string,x:number,z:number,w:number,d:number,floor:number,roof:number)=>{
    box(name+'-roof',x,roof,z,w+.4,.35,d+.4,'#9e8c70',false,'plaster');
    for(const side of [-1,1]){
      box(name+'-wall',x+side*w/2,floor,z,.3,roof-floor,d,'#baa586',false,'stone');
      box(name+'-tile-band',x+side*(w/2-.16),floor+1.45,z,.05,.22,d-.4,'#3f6a78',true,'stone');
    }
    for(const end of [-1,1]){
      const zz=z+end*d/2;
      for(const side of [-1,1])box('arch-pier',x+side*(w/2-.4),floor,zz,.8,roof-floor,.35);
      for(let i=0;i<7;i++){const xx=-w/2+.7+i*(w-1.4)/6,yy=roof-.7+.45*(1-Math.abs(xx)/(w/2));box('arch-keystone',x+xx,yy,zz,(w-1.2)/7,.55,.4,'#d7c3a2',true);}
      box('entry-lintel',x,roof-.35,zz,w,.35,.3);
    }
  };
  box('b-tunnels-floor-infill',-45,0,22.2,5.3,2.4,18.8,'#c4b193',false,'stone');
  tunnel('b-tunnels',-45,22,5,18,2.4,6.6);
  for(let z=15;z<=29;z+=3.5)box('b-tunnels-roof-beam',-45,6.38,z,4.8,.22,.24,'#76654e',true,'wood');

  // Seal the sides of the Mid exit and support the base of the elevated B tunnel walls.
  for(const side of [-1,1]){
    box('b-tunnels-wall-base-infill',-45+side*2.5,0,22,.35,2.42,18.4);
    box('mid-exit-wing',-9.52,0,10+side*2.02,.35,3.5,.62);
  }
  box('b-tunnels-south-threshold-infill',-45,0,13.08,5.28,2.4,.42);
  box('b-tunnels-north-threshold-infill',-45,0,30.94,5.28,2.4,.42);

  // ============================================================================
  // 5. ICONIC A & B SITE CRATE STACKS, BARRELS & ARCHITECTURAL LANDMARKS
  // ============================================================================
  // Curated site cover crates (exact ID counts preserved for test suite)
  box('b-site-cover-crate',-37.7,2.4,42.6,1.8,1.65,1.7,'#a88962',false,'wood');
  addCrateDetail('b-site-cover',-37.7,2.4,42.6,1.8,1.65,1.7);
  box('b-double-stack-upper',-37.7,4.05,42.6,1.45,1.25,1.45,'#947652',true,'wood');
  box('b-big-box-east',-31.2,2.4,35.8,1.75,1.6,1.75,'#637359',false,'wood');
  addCrateDetail('b-big-box-east',-31.2,2.4,35.8,1.75,1.6,1.75,'#55634c');

  box('a-site-cover-crate-west',30.1,3.2,40.6,1.65,1.55,1.55,'#a88962',false,'wood');
  addCrateDetail('a-quad-west',30.1,3.2,40.6,1.65,1.55,1.55);
  box('a-quad-stack-second',30.1,4.75,40.6,1.3,1.15,1.3,'#967853',true,'wood');

  box('a-site-cover-crate-east',38,3.2,42.7,2.05,1.9,1.55,'#9b7d5b',false,'wood');
  addCrateDetail('a-default-east',38,3.2,42.7,2.05,1.9,1.55);

  box('a-site-cover-crate-inner',37.2,3.2,37.5,1.45,1.35,1.35,'#64745a',false,'wood');
  addCrateDetail('a-default-inner',37.2,3.2,37.5,1.45,1.35,1.35,'#53624a');

  box('a-short-cover-crate',27.5,3.2,37.3,1.45,1.65,1.05,'#9b7d5b',false,'wood');
  addCrateDetail('a-short-boost',27.5,3.2,37.3,1.45,1.65,1.05);

  // Keep the barrel cover at the two sites + Goose edge barrels.
  for(const [x,z,y] of [[31,42,3.2],[45.2,42.8,3.2],[-40,45,2.4],[-31,40,2.4]])for(let i=0;i<2;i++){
    const s=box('barrel',x+i*.65,y,z,.52,.9,.52,'#738786',false,'metal');
    s.shape='cylinder';
  }

  // Authentic CS:GO 2017 North-African arched stucco & sandstone building behind A Site (PDF GÖRSEL #08 & #09)
  box('a-north-palace-mass',35,0,49.5,18.4,11.4,6,'#f2e8d5',false,'plaster');
  box('a-north-palace-plinth',35,3.2,46.32,18.6,1.35,.48,'#c9b28f',true,'stone');
  box('a-north-palace-gallery-ledge',35,6.35,46.12,18.6,.28,.98,'#d8c4a3',true,'stone');
  box('a-north-palace-terracotta-eave',35,10.85,45.98,18.8,.32,1.18,'#b34730',true,'wood');
  box('a-north-palace-parapet',35,11.17,46.22,18.6,.52,.48,'#f2e8d5',true,'plaster');
  for(let x=28;x<=42;x+=3.5){
    // Recessed Moorish arched window bays with timber shutters (PDF GÖRSEL #08, #09)
    box('a-north-arch-recess',x,6.65,46.36,1.95,3.35,.18,'#26343f',true,'glass');
    for(const side of [-1,1]){
      box('a-north-arch-pier',x+side*1.08,6.6,46.24,.26,3.5,.42,'#d8c4a3',true,'stone');
      box('a-north-shutter',x+side*.72,6.85,46.26,.40,2.6,.12,'#6b4f35',true,'wood');
    }
    box('a-north-arch-crown',x,9.95,46.22,2.38,.48,.44,'#d8c4a3',true,'stone');
  }

  // B Site North Fortress Wall & Crenellations (PDF GÖRSEL #04 & #05)
  box('b-fort-tower',-40,0,49,8,10.5,5,'#bda17c',false,'stone');
  for(const side of [-1,1])for(let k=0;k<5;k++)box('fort-merlon',-43.2+k*1.6,10.5,49+side*2.3,.72,.68,.55,'#cdb590',true,'stone');
  // B Site West Fence & Painted Red 'B' Callout Sign (PDF GÖRSEL #04, #05 & Page 37)
  box('b-site-fence-frame',-47.25,2.4,40.2,.12,2.1,4.6,'#6e563b',true,'wood');
  const bSiteWallSign=box('b-site-wall-letter',-36.8,4.2,45.88,1.6,1.6,.08,'#a83824',true,'plaster');
  bSiteWallSign.label='B';

  // Outside Long Shuttered Shopfront & Crate Stack (PDF Page 10 GÖRSEL #21)
  box('outside-long-shutter-frame',28.5,0,-23.8,3.6,3.4,.22,'#5b656b',true,'metal');
  box('outside-long-awning',28.5,3.45,-23.2,3.8,.16,1.2,'#9c4332',true,'wood');
  box('outside-long-crate',33.8,0,-23.2,1.5,1.45,1.5,'#987954',true,'wood');

  // Mid Desert Palm Tree & Utility Pole at Top Mid / Palm (PDF Page 24 GÖRSEL #12 & Page 25 GÖRSEL #26)
  const palmTrunk=box('mid-palm-trunk',1.45,0,-6.2,.46,6.4,.46,'#7a5c3e',true,'wood');
  palmTrunk.shape='cylinder';
  for(const [dx,dz] of [[1.45,0],[-1.45,0],[0,1.45],[0,-1.45],[1.05,1.05],[-1.05,1.05],[1.05,-1.05],[-1.05,-1.05]]){
    box('mid-palm-frond',1.45+dx,6.25,-6.2+dz,1.45,.18,1.45,'#4a6e3d',true,'wood');
  }
  const midPole=box('mid-utility-pole',1.65,0,2.5,.24,6.8,.24,'#6e553b',true,'wood');
  midPole.shape='cylinder';
  box('mid-utility-crossarm',1.65,6.2,2.5,.16,.14,1.6,'#57422d',true,'wood');

  // Catwalk & Short Stairs Mashrabiya Lattice Windows & Painted 'A' Arrow (PDF GÖRSEL #10, #11, #18)
  for(const z of [18.5,24.5]){
    box('short-mashrabiya-frame',14.95,4.1,z,.24,1.85,1.55,'#6b5037',true,'wood');
  }
  const shortASign=box('short-a-wall-sign',22.5,4.8,34.32,1.5,1.4,.08,'#a83824',true,'plaster');
  shortASign.label='A';

  // CT Mid Limestone Block Stack ('B Boxes') outside B Doors & B Window (PDF Page 28 & 42 GÖRSEL #24)
  box('ct-mid-b-boxes-lower',-18.2,0,31.8,1.8,1.35,1.6,'#c8b698',true,'stone');
  box('ct-mid-b-boxes-upper',-18.2,1.35,31.8,1.35,1.05,1.25,'#d4c3a6',true,'stone');
  box('ct-mid-east-b-boxes-lower',-1.8,0,24.5,1.75,1.35,1.55,'#c8b698',true,'stone');
  box('ct-mid-east-b-boxes-upper',-1.8,1.35,24.5,1.3,1.05,1.2,'#d4c3a6',true,'stone');

  // Lower Tunnels Recessed Corner Crate Stack (PDF Page 32 GÖRSEL #27 — clear of stair path)
  box('lower-tunnel-corner-crate',-21.2,0,11.35,1.15,1.15,.95,'#8c6d49',true,'wood');

  // North-African / Middle-Eastern environmental façade details across Mid, Long & Catwalk
  for(const [ax,ay,az,aw,ad,col] of [
    [17.5,3.6,-16.5,3.2,1.1,'#9e4736'],
    [17.5,3.6,-4.5,3.2,1.1,'#386475'],
    [-6.2,3.8,-6.0,1.1,3.2,'#8d5c34'],
    [16.8,6.2,27.0,3.0,1.0,'#9e4736'],
  ] as const){
    box('street-awning',ax,ay,az,aw,.14,ad,col,true,'wood');
  }
  for(const [ux,uy,uz] of [[15.1,4.2,18.5],[-6.2,4.2,4.5],[26.8,4.5,20.5],[-28.5,4.6,34.5]] as const){
    box('ac-unit-housing',ux,uy,uz,.42,.58,.78,'#b8b4aa',true,'metal');
    box('ac-unit-grille',ux,uy,uz,.46,.42,.42,'#44494d',true,'metal');
  }

  // Close the exposed grid edges on the west landing and at the inner elbow.
  box('catwalk-deck-west-seam',11.66,2.92,27,.64,.28,3.4);
  box('catwalk-deck-elbow-seam',22.35,2.92,27.85,.62,.28,1.5);

  // Railings stop accidental falls along the short bridge, leaving both ends open.
  for(const side of [-1,1])box('catwalk-parapet',21+side*1.85,3.2,31.5,.3,.85,6);

  return solids.filter(s=>/raised-floor|catwalk-deck|stair-tread|a-ramp|entrance-ramp|doors-ramp|infill/.test(s.id));
}
