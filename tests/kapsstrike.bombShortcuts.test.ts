import test from 'node:test';
import assert from 'node:assert/strict';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
for(const disconnected of [false,true])test('real bomb handler rejects fast detonation with another human; disconnected='+disconnected,()=>{
 const io:any={to:()=>({emit(){}}),emit(){}},server=new KapsStrikeServerManager(io);
 const room=server.createRoom({id:901,username:'t',avatar:null},'t',{mode:'bomb'});
 server.joinRoom(room.roomCode,{id:902,username:'ct',avatar:null},'ct');server.setReady('ct',true);
 assert.ok(server.startGame('t').success);server.stopRoomSimulationLoop(room);server.tickSimulation(room);
 room.players.get('ct')!.isDisconnected=disconnected;
 room.bomb!.phase='planted';room.bomb!.deadline=100;
 const handlers=new Map<string,Function>();
 const socket:any={id:'t',join(){},on(event:string,handler:Function){handlers.set(event,handler);return this;},emit(){},once(){return this;}};
 server.register(socket,{id:901,username:'t'});
 let result:any;handlers.get('strike:bomb_action')!({kind:'fast_detonate'},(value:any)=>result=value);
 assert.equal(result.success,false);assert.equal(room.bomb!.deadline,100);
});
