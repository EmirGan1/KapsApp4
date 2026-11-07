// Run against main and the changed tree with STRIKE_BENCH_ROOT; timing is diagnostic, not a CI threshold.
import {pathToFileURL} from 'node:url';
const root=process.env.STRIKE_BENCH_ROOT||process.cwd();
const {MAPS}=await import(pathToFileURL(root+'/src/games/kapsstrike/maps.ts').href);
const {fits,support}=await import(pathToFileURL(root+'/src/games/kapsstrike/physics.ts').href);
const {KapsStrikeServerManager}=await import(pathToFileURL(root+'/src/server/kapsstrikeServer.ts').href);
const samples=(fn:()=>void)=>{fn();const values=[];for(let i=0;i<7;i++){const start=performance.now();fn();values.push(performance.now()-start);}return +values.sort((a,b)=>a-b)[3].toFixed(2);};
const geometry:any={};for(const map of Object.values(MAPS) as any[]){let checksum=0;const points=Array.from({length:5000},(_,i)=>({x:Math.sin(i*13.71)*map.bounds,y:i%13,z:Math.cos(i*7.93)*map.bounds}));const ms=samples(()=>{for(const p of points)checksum+=Number(fits(map,p,1.8))+support(map,p,p.y+.4);});geometry[map.id]={ms,checksum};}
const manager=new KapsStrikeServerManager({to:()=>({emit(){}}),emit(){}});const room=manager.createRoom({id:1,username:'p1'},'p1',{map:'district',mode:'tdm',maxPlayers:8});for(let i=2;i<=8;i++)manager.joinRoom(room.roomCode,{id:i,username:'p'+i},'p'+i);
const snapshotsMs=samples(()=>{for(let i=0;i<1000;i++){const frame=room.buildSharedSnapshotBase?.();for(const p of room.players.values())room.getSnapshotForPlayer(p.id,...(frame?[frame]:[]));}});
console.log(JSON.stringify({root,geometry,snapshotsMs,players:room.players.size},null,2));
