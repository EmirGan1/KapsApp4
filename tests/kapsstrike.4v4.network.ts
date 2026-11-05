import {createServer} from 'node:http';import {Server} from 'socket.io';import {io as connect,type Socket} from 'socket.io-client';import assert from 'node:assert/strict';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';import {BOMB_SITES,BOMB_RULES} from '../src/games/kapsstrike/bomb';import {PHYSICS as C,WEAPONS} from '../src/games/kapsstrike/config';import type {StrikeSnapshot} from '../src/games/kapsstrike/types';
const http=createServer(),io=new Server(http),manager=new KapsStrikeServerManager(io),clients:Socket[]=[],latest=new Map<number,StrikeSnapshot>();
io.on('connection',socket=>{const id=Number(socket.handshake.auth.testUser);manager.register(socket,{id,username:'P'+id,avatar:null});socket.on('disconnect',()=>manager.handleDisconnect(socket,id));});
await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+(http.address() as any).port;
const ack=(s:Socket,event:string,data?:unknown):Promise<any>=>new Promise((resolve,reject)=>{const cb=(error:any,value:any)=>error?reject(error):resolve(value);if(data===undefined)s.timeout(5000).emit(event,cb);else s.timeout(5000).emit(event,data,cb);});
async function client(id:number){const s=connect(url,{auth:{testUser:id},transports:['websocket'],forceNew:true});clients.push(s);s.on('strike:snapshot',v=>latest.set(id,v));s.on('strike:rtt',cb=>cb());await new Promise<void>((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
async function until(check:()=>boolean,message:string){const end=Date.now()+30000;while(Date.now()<end){if(check())return;await new Promise(r=>setTimeout(r,30));}throw Error(message);}
async function hold(s:Socket,check:()=>boolean){assert.ok((await ack(s,'strike:bomb_action',{kind:'hold',held:true})).success);const timer=setInterval(()=>s.emit('strike:bomb_action',{kind:'hold',held:true}),100);try{await until(check,'objective action timed out');}finally{clearInterval(timer);await ack(s,'strike:bomb_action',{kind:'hold',held:false});}}
try{
 const sockets:Socket[]=[];for(let id=1;id<=8;id++)sockets.push(await client(id));
 const created=await ack(sockets[0],'strike:create_room',{mode:'bomb',maxPlayers:8});assert.ok(created.success);const code=created.room.roomCode;
 for(const s of sockets.slice(1)){assert.ok((await ack(s,'strike:join_room',{roomCode:code})).success);assert.ok((await ack(s,'strike:set_ready',{ready:true})).success);}
 assert.ok((await ack(sockets[0],'strike:start_game')).success);const room=manager.rooms.get(code)!;
 await until(()=>latest.size===8&&[...latest.values()].every(v=>v.bomb?.phase==='buy'),'eight initial snapshots');assert.equal(room.players.size,8);assert.equal([...room.players.values()].filter(p=>p.team==='red').length,4);
 for(const [i,s]of sockets.entries()){const bp=room.bomb!.players[s.id!];bp.money=5000;assert.ok((await ack(s,'strike:bomb_action',{kind:'buy',item:'smg'})).success);s.emit('strike:input',{sequence:1,tick:room.tick,moveX:1,moveZ:1,yaw:0,pitch:0,jump:true,sprint:true,crouch:false,fire:true,ads:false,reload:false});}
 assert.ok((await ack(sockets[1],'strike:bomb_action',{kind:'buy',item:'kit'})).success);
 await until(()=>[...latest.values()].every(v=>v.ackSequence===1),'all eight inputs acknowledged');for(const s of sockets){const p=room.players.get(s.id!)!;assert.equal(p.state.weapon.selected,'smg');assert.equal(p.state.hp,100);assert.equal(p.state.weapon.ammo.smg,WEAPONS.smg.capacity);assert.deepEqual(p.state.movement.position,p.state.movement.spawnPosition);}
 console.log('PASS eight real sockets: lobby/readiness, 4v4 roster, purchases and frozen buy input');
 for(const site of BOMB_SITES){
  room.bomb!.phase='active';room.bomb!.deadline=room.tick*C.dt+BOMB_RULES.round;
  const t=room.players.get(sockets[0].id!)!,ct=room.players.get(sockets[1].id!)!;
  for(const [p,dx]of [[t,0],[ct,1.5]] as const){p.state.movement.position={x:site.x+dx,y:site.y,z:site.z};p.state.movement.velocity={x:0,y:0,z:0};p.state.movement.lastSafePosition={...p.state.movement.position};p.inputQueue=[];p.heldInput=undefined;}
  // Fixture teleports must reach the authoritative objective state before sending real input.
  await until(()=>Math.hypot(room.bomb!.players[t.id].position.x-site.x,room.bomb!.players[t.id].position.z-site.z)<.1,'placement synchronized');
  await hold(sockets[0],()=>room.bomb!.phase==='planted');assert.equal(room.bomb!.site,site.id);await until(()=>[...latest.values()].every(v=>v.bomb?.phase==='planted'),'all clients see plant');
  await hold(sockets[1],()=>room.bomb!.phase==='result');assert.equal(room.bomb!.winner,'CT');const round=room.bomb!.round;await until(()=>room.bomb!.round===round+1,'next round');await until(()=>[...latest.values()].every(v=>v.bomb?.round===round+1&&v.localState?.hp===100),'eight synchronized respawns');
  assert.equal(room.players.size,8);console.log('PASS eight real sockets: '+site.id+' plant, kit defuse, score and synchronized next round');
 }
 const before=room.players.get(sockets[7].id!)!.team,old=sockets[7].id!;sockets[7].disconnect();await until(()=>room.players.get(old)?.isDisconnected===true,'disconnect reservation');const replacement=await client(8);assert.ok((await ack(replacement,'strike:join_room',{roomCode:code})).success);assert.equal(room.players.size,8);assert.equal(room.players.has(old),false);assert.equal(room.players.get(replacement.id!)!.team,before);assert.equal(room.bomb!.players[replacement.id!].id,replacement.id);
 console.log('PASS reserved reconnect replaces socket without a ninth player or side change');
}finally{for(const s of clients){if(s.connected)await ack(s,'strike:leave_room').catch(()=>{});s.close();}for(const room of manager.rooms.values())manager.stopRoomSimulationLoop(room);await new Promise<void>(resolve=>io.close(()=>resolve()));}
