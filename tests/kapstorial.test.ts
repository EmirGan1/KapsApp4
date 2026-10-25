import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KapstorialManager } from '../src/server/kapstorialServer';
import { generateTerrainMap, MAP_WIDTH as W, MAP_HEIGHT as H, TOTAL_PIXELS as N, MapType } from '../src/utils/kapstorialMaps';
function setup() {
 const events:any[]=[];
 const io:any={emit:(...v:any[])=>events.push(v),to:()=>({emit:(...v:any[])=>events.push(v)}),sockets:{sockets:new Map()}};
 const m:any=new KapstorialManager(io,null);const room=m.createRoom({id:1,username:'A',avatar:null},{mapType:'arena',botCount:0});
 m.joinRoom(room.roomCode,{id:2,username:'B',avatar:null});
 const handlers:any={};const socket:any={id:'s1',data:{currentKapstorialRoom:room.roomCode},on:(e:string,f:any)=>handlers[e]=f,join:()=>{},leave:()=>{}};
 m.handleSocketEvents(socket,{id:1});
 const call=(name:string,data?:any)=>{let result:any;handlers['kapstorial:'+name](data,(r:any)=>result=r);return result};
 return {m,room,call,events,handlers};
}
for(const type of ['world','europe','anatolia','archipelago','arena'] as MapType[])for(let seed=0;seed<50;seed++)test(`${type} seed ${seed}: reproducible valid enlarged map`,()=>{
 const grid=generateTerrainMap(type,seed);assert.equal(grid.length,240000);assert.equal(W,600);assert.equal(H,400);assert.ok(grid.some(x=>x===1));assert.ok(grid.some(x=>x===0));assert.ok(grid.every(x=>x<=2));assert.deepEqual(grid,generateTerrainMap(type,seed));
});
for(let i=0;i<100;i++)test(`authoritative attack regression ${i}`,()=>{
 const {m,room,call}=setup();room.terrain.fill(1);room.status='running';let a=room.players[0],b=room.players[1];const center=(30+i)*W+30;
 room.owners[center]=a.id;a.pixels=1;a.troops=1000;room.owners[center+100]=b.id;b.pixels=1;b.troops=1000;
 for(const targetPixel of [NaN,Infinity,-1,N,1.5,undefined])assert.equal(call('attack',{targetPixel,percentage:50}).success,false);
 assert.equal(call('attack',{targetPixel:center+100,percentage:50}).success,false);assert.equal(a.troops,1000);
 assert.equal(call('attack',{targetPixel:center+1,percentage:NaN}).success,false);
 assert.equal(call('attack',{targetPixel:center+1,percentage:50}).success,true);
 for(let tick=0;tick<100;tick++)m.processAttackWaves(room);
 assert.equal(room.attackWaves.length,0);assert.ok(a.pixels>1);assert.ok(Number.isFinite(a.troops));assert.ok(a.troops>=0);assert.equal([...room.owners].filter(v=>v===a.id).length,a.pixels);
 room.players.forEach((p:any)=>assert.ok(Number.isFinite(p.troops)&&p.troops>=0));m.destroyRoom(room.roomCode);
});
for(let i=0;i<50;i++)test(`naval regression ${i}`,()=>{
 const {m,room,call}=setup();room.status='running';room.terrain.fill(0);const start=100*W+20;room.terrain[start]=1;room.owners[start]=1;room.players[0].pixels=1;room.players[0].troops=1000;
 for(let x=50;x<70;x++)room.terrain[100*W+x]=1;
 assert.equal(call('attack',{targetPixel:100*W+40,percentage:50}).success,true);assert.ok(room.boats[0].targetPixel>=100*W+50);
 for(let t=0;t<60;t++)m.processNavalBoats(room);
 assert.equal(room.boats.length,0);assert.equal(room.owners[100*W+50],1);assert.equal(room.players[0].pixels,2);m.destroyRoom(room.roomCode);
});
for(let i=0;i<50;i++)test(`room lifecycle regression ${i}`,async()=>{
 const {m,room,call,handlers,events}=setup();assert.equal(room.botCount,0);room.players[1].isReady=true;
 m.leaveRoom(room.roomCode,2);m.joinRoom(room.roomCode,{id:3,username:'C',avatar:null});m.joinRoom(room.roomCode,{id:4,username:'D',avatar:null});assert.equal(new Set(room.players.map((p:any)=>p.id)).size,room.players.length);
 room.players.forEach((p:any)=>p.isReady=true);assert.equal((await m.startSpawnPhase(room.roomCode,1)).success,true);clearInterval(room.spawnTimerInterval);
 const snapshot=events.find((e:any)=>e[0]==='kapstorial:game_start')[1];assert.deepEqual(snapshot.terrain,Array.from(room.terrain));assert.equal(snapshot.room.status,'spawn_phase');
 m.finishSpawnPhaseAndStartGame(room);clearInterval(room.gameTimerInterval);
 assert.equal(m.joinRoom(room.roomCode,{id:1,username:'A',avatar:null}).success,true);
 assert.equal(call('accept_truce',{offererPlayerId:room.players[1].id}).success,false);
 assert.equal(call('donate_troops',{targetPlayerId:1,percentage:50}).success,false);
 let sync:any;handlers['kapstorial:sync']((s:any)=>sync=s);assert.equal(sync.owners.length,N);
 m.destroyRoom(room.roomCode);assert.equal(m.rooms.size,0);
});
for(const type of ['world','europe','anatolia','archipelago','arena'] as MapType[])for(let seed=1;seed<=2;seed++)test(`${type} full engine simulation ${seed}`,async()=>{
 const {m,room,events}=setup();room.terrain=generateTerrainMap(type,seed);room.totalConquerablePixels=room.terrain.reduce((sum:number,v:number)=>sum+(v===1?1:0),0);room.botCount=3;room.players.forEach((p:any)=>p.isReady=true);
 assert.equal((await m.startSpawnPhase(room.roomCode,1)).success,true);clearInterval(room.spawnTimerInterval);m.finishSpawnPhaseAndStartGame(room);clearInterval(room.gameTimerInterval);
 const replica=new Uint16Array(room.owners);
 for(let tick=0;tick<500;tick++){
  m.tick(room);const event=events.at(-1);if(event?.[0]==='kapstorial:tick')for(let i=0;i<event[1].deltas.length;i+=2)replica[event[1].deltas[i]]=event[1].deltas[i+1];
  if(tick%100===0){assert.deepEqual(replica,room.owners);for(const p of room.players){assert.ok(Number.isFinite(p.troops)&&p.troops>=0);assert.equal(p.pixels,[...room.owners].filter(v=>v===p.id).length)}}
 }
 assert.deepEqual(replica,room.owners);assert.ok(room.players.some((p:any)=>p.pixels>13));m.destroyRoom(room.roomCode);
});
test('entry fee is atomic and insufficient funds roll back',async()=>{
 const {m,room}=setup();room.buyIn=100;room.players.forEach((p:any)=>p.isReady=true);let rollback=0,commit=0,calls=0;
 m.client={transaction:async()=>({execute:async()=>({rowsAffected:++calls===1?1:0}),rollback:async()=>rollback++,commit:async()=>commit++,close:()=>{}})};
 assert.equal((await m.startSpawnPhase(room.roomCode,1)).success,false);assert.equal(rollback,1);assert.equal(commit,0);assert.equal(room.status,'waiting');m.destroyRoom(room.roomCode);
});
