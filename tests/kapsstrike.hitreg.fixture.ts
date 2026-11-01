import {io} from 'socket.io-client';
import {StrikeController} from '../src/games/kapsstrike/controller';
import {StrikeRenderer} from '../src/games/kapsstrike/renderer';
import {DEFAULT_SETTINGS} from '../src/games/kapsstrike/config';
import {MAPS} from '../src/games/kapsstrike/maps';
import {createTraining} from '../src/games/kapsstrike/combat';
const w=window as any;
// An isolated measurement range only. Production map files and their collision remain unchanged.
MAPS.district.solids=[];MAPS.district.targets=[];
const canvas=document.createElement('canvas');canvas.style.cssText='width:100vw;height:100vh;display:block';document.body.style.margin='0';document.body.append(canvas);
if(new URLSearchParams(location.search).has('knife')){
 const r=new StrikeRenderer(canvas,MAPS.district,{...DEFAULT_SETTINGS,quality:'low',volume:0});const state=createTraining('district');state.player.weapon.selected='knife';state.player.protectedUntil=0;w.renderer=r;w.knifeState=state;
 w.knife=async(style:string,t:number)=>{
  r.updateSettings({...DEFAULT_SETTINGS,quality:'low',volume:0,cosmeticLoadout:{knife:'knife-'+style}});
  (r as any).lastSelectedWeapon='knife';(r as any).knifeDeployTimer=0;(r as any).inspectTime=2.4*(1-t);state.tick=Math.round(t*288);
  r.render(state,0,0,false,1,state.player.movement.position,.001);await r.scene.whenReadyAsync();r.scene.render();
 };

}else{
 const id=Number(new URLSearchParams(location.search).get('user')||1);const socket=io({auth:{testUser:id},transports:['websocket'],forceNew:true});w.socket=socket;
 const on=socket.on.bind(socket);socket.on=((event:string,listener:any)=>event==='strike:rtt'?on(event,(reply:any)=>listener(()=>setTimeout(reply,w.fixtureOneWayDelay*2||0))):on(event,listener)) as typeof socket.on;
 w.boot=(roomCode:string)=>{w.strike=new StrikeController(canvas,'district',{...DEFAULT_SETTINGS,quality:'low',controlMode:'touch',volume:0,showDebugStats:false},(hud)=>w.hud=hud,()=>{},undefined,{isMultiplayer:true,socket,roomCode,userId:id,team:id===1?'red':'blue'});w.strike.start(false);};
 w.aim=(distance:number)=>{clearInterval(w.aimTimer);const c=w.strike;w.aimTimer=setInterval(()=>{c.yaw=0;c.pitch=Math.atan2(.62,distance);},8);};
}
