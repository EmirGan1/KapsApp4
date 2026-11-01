// Execute unchanged against an isolated baseline worktree and the fixed tree.
import {pathToFileURL} from 'node:url';
const root=process.env.STRIKE_BENCH_ROOT||process.cwd();
const {KapsStrikeServerManager}=await import(pathToFileURL(root+'/src/server/kapsstrikeServer.ts').href);
const {MAPS}=await import(pathToFileURL(root+'/src/games/kapsstrike/maps.ts').href);
const {WEAPONS,WEAPON_ORDER}=await import(pathToFileURL(root+'/src/games/kapsstrike/config.ts').href);
MAPS.district.solids=[]; // Diagnostic test range only; production maps stay unchanged.
function pair(){const events:any[]=[];const manager=new KapsStrikeServerManager({to:(id:string)=>({emit:(name:string,value:any)=>events.push({id,name,value})}),emit(){}},undefined,true);const room=manager.createRoom({id:1,username:'a'},'a',{map:'district',mode:'ffa',scoreLimit:10000});manager.joinRoom(room.roomCode,{id:2,username:'b'},'b');manager.startGame('a');manager.stopRoomSimulationLoop(room);room.tick=1000;const [a,b]=[...room.players.values()] as any[];for(const p of [a,b]){p.state.protectedUntil=0;p.state.movement.position={x:0,y:0,z:p===a?0:5};p.state.movement.velocity={x:0,y:0,z:0};p.state.weapon.selected='smg';p.state.weapon.nextFire=0;p.state.weapon.switchUntil=0;p.history=[];}return {manager,room,a,b,events};}
const cmd=(n:number,tick:number,viewTick?:number)=>({sequence:n,tick,viewTick,yaw:0,pitch:Math.atan2(.62,5),moveX:0,moveZ:0,jump:false,sprint:false,crouch:false,fire:true,ads:true,reload:false});
const held=pair();held.b.state.hp=10000;for(let i=0;i<120;i++){if(i%4===0)held.manager.processPlayerInput('a',cmd(i+1,held.room.tick));held.manager.tickSimulation(held.room);}
const move=pair();move.b.state.movement.position.x=.9;for(const tick of [980,990,1000]){move.b.state.movement.position.x=(tick-980)*.045;move.b.recordHistory(tick,0);}move.manager.processPlayerInput('a',cmd(1,move.room.tick,980));move.manager.tickSimulation(move.room);
const ttk:any[]=[];for(const weapon of WEAPON_ORDER)for(const armor of [0,100]){if(weapon==='knife')continue;const f=pair();f.b.state.movement.position.z=5;f.a.state.weapon.selected=weapon;f.a.state.weapon.inventory=WEAPON_ORDER;f.a.state.yaw=0;f.a.state.pitch=Math.atan2(.62,5);if(armor)f.room.bomb={phase:'active',players:{b:{armor}}};let count=0,first=0,last=0;
 while(f.b.state.hp>0&&count<WEAPONS[weapon].capacity){const at=Math.max(f.room.tick,Math.ceil(f.a.state.weapon.nextFire));f.room.tick=at;if(!count)first=at;f.manager.verifyAndExecuteShot(f.room,f.a,true,at);last=at;count++;}
 ttk.push({weapon,armor,shots:count,killed:f.b.state.hp<=0,ttkMs:Math.round((last-first)/120*1000)});
}
console.log(JSON.stringify({label:process.env.STRIKE_BENCH_LABEL||'fixed',sparseDelivery:{inputMessages:30,acceptedShots:35-held.a.state.weapon.ammo.smg,damage:10000-held.b.state.hp},movingTarget:{inputTick:1000,renderedTick:980,damage:100-move.b.state.hp},ttk},null,2));
