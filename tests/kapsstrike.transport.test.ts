import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect, Socket} from 'socket.io-client';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const ack=(socket:Socket,event:string,data?:unknown):Promise<any>=>new Promise((resolve,reject)=>{
 const done=(error:any,result:any)=>error?reject(error):resolve(result);
 if(data===undefined)socket.timeout(3000).emit(event,done);else socket.timeout(3000).emit(event,data,done);
});
for (const count of [8,10]) test(`${count} actual socket clients: latency/jitter, canonical codes, replacement, reconnect, host transfer and results`,async()=>{
 const http=createServer(),io=new Server(http),manager=new KapsStrikeServerManager(io);
 const clients:Socket[]=[];const timers=new Set<ReturnType<typeof setTimeout>>();let load:ReturnType<typeof setInterval>|undefined;
 // Test-only account identities. Production socket authentication remains in server.ts.
 io.on('connection',socket=>{const id=Number(socket.handshake.auth.testUser);manager.register(socket,{id,username:`Load ${id}`});socket.on('disconnect',()=>manager.handleDisconnect(socket,id));});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(http.address() as any).port}`;
 const open=async(id:number)=>{const c=connect(url,{auth:{testUser:id},transports:['websocket'],forceNew:true});clients.push(c);await new Promise<void>((r,j)=>{c.once('connect',()=>r());c.once('connect_error',j);});return c;};
 try {
  const host=await open(1);const created=await ack(host,'strike:create_room',{map:'neon',mode:'ffa',maxPlayers:count});assert.ok(created.success);
  const code=created.room.roomCode,room=manager.rooms.get(code)!;
  for(let id=2;id<=count;id++){const c=await open(id);const joined=await ack(c,'strike:join_room',{roomCode:code.slice(3).toLowerCase()});assert.ok(joined.success);}
  assert.equal(room.players.size,count);
  const outsider=await open(99);assert.equal((await ack(outsider,'strike:join_room',{roomCode:code})).error,'Oda dolu.');
  const replacement=await open(2);assert.equal((await ack(replacement,'strike:join_room',{roomCode:code})).success,true);
  assert.equal([...room.players.values()].filter(p=>p.userId===2).length,1);
  const stale=clients[1];stale.close();await wait(50);
  assert.ok(room.players.has(replacement.id!),'old disconnect must preserve new membership');
  assert.equal(room.players.get(replacement.id!)!.state.id,replacement.id);
  assert.ok((await ack(host,'strike:start_game')).success);
  const active=clients.filter(c=>c.connected&&room.players.has(c.id!));
  const counts=new Map<string,number>();for(const c of active)c.on('strike:snapshot',()=>counts.set(c.id!,1+(counts.get(c.id!)||0)));
  const sequences=new Map<string,number>(),starts=new Map([...room.players.values()].map(p=>[p.id,{...p.state.movement.position}]));
  const durations:number[]=[];const original=manager.tickSimulation.bind(manager);manager.tickSimulation=(r)=>{const start=performance.now();original(r);durations.push(performance.now()-start);};
  let frame=0;
  load=setInterval(()=>{frame++;for(const [index,c] of active.entries()){
   const sequence=(sequences.get(c.id!)||0)+1;sequences.set(c.id!,sequence);
   const command={sequence,tick:room.tick,moveX:0,moveZ:index<5?1:-1,yaw:0,pitch:0,jump:false,sprint:true,crouch:false,fire:false,ads:false,reload:false,damage:999999,position:{x:999999,y:999999,z:999999}};
   // Symmetric RTT equivalents 0/100/200/300ms with deterministic delivery jitter.
   const delay=[0,50,100,150][index%4]+((frame*13+index*7)%31);
   const timer=setTimeout(()=>{timers.delete(timer);if(c.connected)c.emit('strike:input',command);},delay);timers.add(timer);
  }},1000/120);
  await wait(2200);clearInterval(load);load=undefined;await wait(220);
  assert.equal(room.players.size,count);
  assert.ok([...counts.values()].every(n=>n>=30&&n<=90),JSON.stringify([...counts.values()]));
  let moved=0;for(const p of room.players.values()){
   assert.ok(p.inputQueue.length<=24);assert.equal(p.state.hp,100);
   const s=starts.get(p.id)!;const distance=Math.hypot(p.state.movement.position.x-s.x,p.state.movement.position.z-s.z);
   assert.ok(distance<=13*2.7,'input flood cannot teleport');if(distance>.1)moved++;
  }assert.ok(moved>=count-2);
  host.close();await wait(80);assert.notEqual(room.hostId,1);assert.equal(room.players.size,count-1);
  const reconnect=await open(1);assert.ok((await ack(reconnect,'strike:join_room',{roomCode:code})).success);assert.equal(room.players.size,count);
  let result:any;reconnect.once('strike:game_over',r=>result=r);room.timeLeft=1;
  for(let i=0;i<25&&!result;i++)await wait(60);
  assert.ok(result);assert.equal(result.status,'game_over');assert.equal(room.status,'game_over');assert.equal(room.loopInterval,null);
  const locked=await ack(outsider,'strike:create_room',{password:'test-lock',maxPlayers:2});assert.ok(locked.success);
  const guest=await open(100);
  assert.equal((await ack(guest,'strike:join_room',{roomCode:locked.room.roomCode,password:'wrong'})).success,false);
  assert.ok((await ack(guest,'strike:join_room',{roomCode:locked.room.roomCode,password:'test-lock'})).success);
  durations.sort((a,b)=>a-b);console.log(JSON.stringify({players:count,delayedInputRttMs:[0,100,200,300],snapshots:[...counts.values()],physicsSteps:durations.length,p95StepMs:durations[Math.floor(durations.length*.95)]}));
 } finally {
  if(load)clearInterval(load);for(const t of timers)clearTimeout(t);for(const c of clients)c.close();
  for(const r of manager.rooms.values())manager.stopRoomSimulationLoop(r);
  await new Promise<void>(r=>io.close(()=>r()));if(http.listening)await new Promise<void>(r=>http.close(()=>r()));
 }
});
