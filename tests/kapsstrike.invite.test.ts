import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect,Socket} from 'socket.io-client';
import {createClient} from '@libsql/client';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
test('private room invites go only to the authorized friend, never the global socket audience',async()=>{
 const db=createClient({url:'file::memory:'});await db.execute('CREATE TABLE friends (id INTEGER PRIMARY KEY,user1 INTEGER,user2 INTEGER,status INTEGER)');await db.execute('INSERT INTO friends VALUES (1,1,2,1)');
 const http=createServer(),io=new Server(http),manager=new KapsStrikeServerManager(io,db),clients:Socket[]=[];
 io.on('connection',socket=>{const id=Number(socket.handshake.auth.testUser);socket.data.user={id,username:`User ${id}`};manager.register(socket,socket.data.user);socket.on('disconnect',()=>manager.handleDisconnect(socket,id));});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));
 const ack=(c:Socket,event:string,data:any):Promise<any>=>new Promise((r,j)=>c.timeout(3000).emit(event,data,(error:any,result:any)=>error?j(error):r(result)));
 try {
  for(let id=1;id<=3;id++){const c=connect(`http://127.0.0.1:${(http.address() as any).port}`,{auth:{testUser:id},transports:['websocket'],forceNew:true});clients.push(c);await new Promise<void>((r,j)=>{c.once('connect',()=>r());c.once('connect_error',j);});}
  const received:any[][]=[[],[],[]];clients.forEach((c,i)=>c.on('strike:invite_received',m=>received[i].push(m)));
  const created=await ack(clients[0],'strike:create_room',{password:'locked',name:'Real room'});
  assert.equal((await ack(clients[0],'strike:send_invite',{targetUserId:2,roomCode:created.room.roomCode,roomName:'Spoofed'})).success,true);
  await new Promise(r=>setTimeout(r,40));assert.equal(received[1].length,1);assert.equal(received[1][0].roomName,'Real room');assert.equal(received[2].length,0);assert.equal(received[0].length,0);
  assert.equal((await ack(clients[0],'strike:send_invite',{targetUserId:3})).success,false);
  assert.equal((await ack(clients[2],'strike:send_invite',{targetUserId:2,roomCode:created.room.roomCode})).success,false);
 }finally{for(const c of clients)c.close();for(const room of manager.rooms.values())manager.stopRoomSimulationLoop(room);await new Promise<void>(r=>io.close(()=>r()));if(http.listening)await new Promise<void>(r=>http.close(()=>r()));db.close();}
});
