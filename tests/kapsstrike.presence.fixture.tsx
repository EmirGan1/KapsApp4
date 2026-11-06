import React from 'react';import {createRoot} from 'react-dom/client';
import {StrikeRenderer} from '../src/games/kapsstrike/renderer';import {MAPS} from '../src/games/kapsstrike/maps';import {DEFAULT_SETTINGS} from '../src/games/kapsstrike/config';import {createTraining} from '../src/games/kapsstrike/combat';import {knifeTiming} from '../src/games/kapsstrike/presentation';
import StrikeDamageFeedback from '../src/components/games/kapsstrike/StrikeDamageFeedback';import '../src/components/games/kapsstrike/kapsstrike.css';
const canvas=document.createElement('canvas');canvas.style.cssText='width:100vw;height:100vh;display:block';document.body.append(canvas);document.body.style.margin='0';
const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;pointer-events:none';document.body.append(overlay);const root=createRoot(overlay);
const r=new StrikeRenderer(canvas,MAPS.warehouse,{...DEFAULT_SETTINGS,quality:'low',volume:0,dynamicResolution:false}),state=createTraining('warehouse');state.targets=[];state.player.movement.position={x:0,y:0,z:-18};state.player.protectedUntil=480;
const remotes=[{id:'shielded',username:'Korunan oyuncu',position:{x:-2,y:0,z:-10},yaw:Math.PI,pitch:0,hp:100,protectedUntil:480,skin:'urban'},{id:'normal',username:'Normal oyuncu',position:{x:2,y:0,z:-10},yaw:Math.PI,pitch:0,hp:100,protectedUntil:0,skin:'classic'}];
const draw=async(tick:number,hp=100,hurt=0)=>{state.tick=tick;state.player.hp=hp;r.render(state,0,0,false,1,state.player.movement.position,1/60);r.renderRemotePlayers(remotes,'local','blue');root.render(<StrikeDamageFeedback hp={hp} dead={hp<=0} tick={tick} hurt={hurt?{until:tick+100,damage:hurt}:undefined}/>);await r.scene.whenReadyAsync();r.scene.render();};
const blade=async(style:string,phase:string,p:number)=>{
 r.updateSettings({...DEFAULT_SETTINGS,quality:'low',volume:0,cosmeticLoadout:{knife:`knife-${style}-expedition-3`}});state.player.weapon.selected='knife';state.player.weapon.inventory=['knife'];state.player.hp=100;state.player.protectedUntil=0;
 r.render(state,0,0,false,1,state.player.movement.position,0);
 const timing=knifeTiming(style),engine=r as any;engine.knifeDrawFlourishTimer=0;engine.knifeDeployTimer=phase==='draw'?timing.deploy*(1-p):0;engine.inspectTime=phase==='inspect'?timing.inspect*(1-p):0;engine.knifeAttackTimer=phase==='attack'?.28*(1-p):0;
 r.render(state,0,0,false,1,state.player.movement.position,0);await r.scene.whenReadyAsync();r.scene.render();return [...engine.gunRoot.position.asArray(),...engine.gunRoot.rotation.asArray()];
};
(window as any).presence={r,state,remotes,draw,blade};void draw(0);
