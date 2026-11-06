import {StrikeRenderer} from '../src/games/kapsstrike/renderer';
import {MAPS} from '../src/games/kapsstrike/maps';
import {DEFAULT_SETTINGS} from '../src/games/kapsstrike/config';
import {createTraining} from '../src/games/kapsstrike/combat';
const query=new URLSearchParams(location.search),before=query.has('before');
// Recreate the reported pre-fix seam only in the isolated visual fixture.
const map=before?{...MAPS.district,solids:MAPS.district.solids.filter(s=>!s.id.includes('a-retaining-core-infill'))}:MAPS.district;
const canvas=document.createElement('canvas');canvas.style.cssText='width:100vw;height:100vh;display:block';document.body.style.margin='0';document.body.append(canvas);
const renderer=new StrikeRenderer(canvas,map,{...DEFAULT_SETTINGS,quality:query.get('quality')==='high'?'high':'low',volume:0,dynamicResolution:false,scale:1});
const state=createTraining('district');state.targets=[];state.player.movement.position={x:35.9,y:3.2,z:35.2};
(window as any).capture=async(view:string)=>{
 const poses:Record<string,number[]>={seam:[35.9,3.2,35.2,Math.PI,-.18],short:[21,3.2,36,Math.PI/2,0],ramp:[39,3.2,31,0,0]};
 const [x,y,z,yaw,pitch]=poses[view];state.player.movement.position={x,y,z};
 renderer.render(state,yaw,pitch,false,1,{x,y,z},.016);
 await renderer.scene.whenReadyAsync();renderer.scene.render();
 return {meshes:renderer.scene.meshes.length,core:map.solids.some(s=>s.id.includes('a-retaining-core-infill')),position:{x,y,z}};
};
(window as any).renderer=renderer;
