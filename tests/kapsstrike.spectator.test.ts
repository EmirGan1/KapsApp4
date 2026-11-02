import test from 'node:test';
import assert from 'node:assert/strict';
import {TeamSpectator} from '../src/games/kapsstrike/spectator';
import {createBombMatch,BOMB_RULES} from '../src/games/kapsstrike/bomb';
import {PHYSICS as C} from '../src/games/kapsstrike/config';
import {fits} from '../src/games/kapsstrike/physics';
import {MAPS} from '../src/games/kapsstrike/maps';
import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';
import type {PlayerSnapshot} from '../src/games/kapsstrike/types';

const b=createBombMatch([{id:'me',team:'T',position:{x:0,y:0,z:0}},{id:'enemy',team:'CT',position:{x:0,y:0,z:0}}],0);
const player=(id:string,userId:number,team='red',hp=100,connected=true)=>({id,userId,team,hp,connected} as PlayerSnapshot);
const roster=[player('me',1,'red',0),player('enemy',2,'blue'),player('a',3),player('b',5),player('dead',7,'red',0),player('offline',9,'red',100,false)];

test('dead observer cycles both ways through only connected living teammates, never self or enemies',()=>{
 const s=new TeamSpectator();assert.equal(s.update(b,'me','red',0,roster)?.id,'a');assert.equal(s.count,2);
 assert.equal(s.cycle(1)?.id,'b');assert.equal(s.cycle(1)?.id,'a');assert.equal(s.cycle(-1)?.id,'b');
 assert.equal(s.update(b,'me','red',100,roster),undefined);assert.equal(s.count,0);
});
test('target survives snapshot reordering; death, disconnect and departure immediately fall back',()=>{
 const s=new TeamSpectator();s.update(b,'me','red',0,roster);s.cycle();
 assert.equal(s.update(b,'me','red',0,[...roster].reverse())?.id,'b');
 for(const replacement of [player('b',5,'red',0),player('b',5,'red',100,false),undefined]){
  const list=roster.filter(p=>p.id!=='b');if(replacement)list.push(replacement);
  assert.equal(s.update(b,'me','red',0,list)?.id,'a');
 }
 assert.equal(s.update(b,'me','red',0,roster.filter(p=>p.id!=='a'&&p.id!=='b')),undefined);
 assert.equal(s.cycle(),undefined);
});
test('new round, side swap, respawn and leaving bomb mode clear the previous selection',()=>{
 const s=new TeamSpectator();s.update(b,'me','red',0,roster);s.cycle();
 assert.equal(s.update({...b,round:2},'me','red',0,roster)?.id,'a');
 assert.equal(s.update({...b,round:7},'me','blue',0,roster)?.id,'enemy');
 assert.equal(s.update({...b,phase:'finished'},'me','blue',0,roster),undefined);
 assert.equal(s.update(undefined,'me','red',0,roster),undefined);
 assert.equal(s.update(b,'me','none',0,roster),undefined);
});

function serverMatch(count=10){
 const server=new KapsStrikeServerManager({to:()=>({emit(){}}),emit(){}} as any);
 const room=server.createRoom({id:1,username:'Player 1',avatar:null},'p1',{mode:'bomb',maxPlayers:10});
 for(let i=2;i<=count;i++){assert.ok(server.joinRoom(room.roomCode,{id:i,username:`Player ${i}`,avatar:null},`p${i}`).success);server.setReady(`p${i}`,true);}
 assert.ok(server.startGame('p1').success);server.stopRoomSimulationLoop(room);server.tickSimulation(room);
 return {server,room,bomb:room.bomb!};
}
for(const outcome of ['elimination','timeout','explosion','defuse'] as const)test(`10-player ${outcome}: score once, no early respawn, then all players restart cleanly`,()=>{
 const {server,room,bomb}=serverMatch();bomb.phase='active';bomb.deadline=room.tick*C.dt+100;
 const victim=room.players.get('p1')!;victim.state.hp=0;victim.state.deadUntil=0;
 if(outcome==='elimination')for(const p of room.players.values())if(p.team==='red')p.state.hp=0;
 if(outcome==='timeout')bomb.deadline=room.tick*C.dt;
 if(outcome==='explosion'||outcome==='defuse'){
  bomb.phase='planted';bomb.position={x:34.42208,y:3.2,z:37.9984};bomb.deadline=outcome==='explosion'?room.tick*C.dt:100;
  if(outcome==='defuse'){
   const ct=room.players.get('p2')!;ct.state.movement.position={...bomb.position};
   bomb.action={player:ct.id,kind:'defuse',started:room.tick*C.dt-BOMB_RULES.defuse,position:{...bomb.position}};
   bomb.players[ct.id].holdUntil=100;
  }
 }
 server.tickSimulation(room);assert.equal(bomb.phase,'result');assert.equal(bomb.scores.T+bomb.scores.CT,1);
 room.tick=Math.ceil(bomb.deadline/C.dt)-3;server.tickSimulation(room);
 assert.equal(bomb.round,1);assert.equal(victim.state.hp,0);assert.equal(bomb.scores.T+bomb.scores.CT,1);
 for(const p of room.players.values()){p.state.weapon.triggerHeld=true;p.state.weapon.reloadUntil=99999;p.state.pitch=.8;}
 room.tick=Math.ceil(bomb.deadline/C.dt)-1;server.tickSimulation(room);
 assert.equal(bomb.round,2);assert.equal(bomb.phase,'buy');assert.equal(bomb.explosion,undefined);assert.equal(bomb.action,undefined);
 for(const p of room.players.values()){
  assert.equal(p.state.hp,100);assert.equal(p.state.pitch,0);assert.equal(p.state.deadUntil,0);
  assert.equal(p.state.weapon.triggerHeld,false);assert.equal(p.state.weapon.reloadUntil,0);assert.equal(p.pendingFire,undefined);
  assert.equal(p.inputQueue.length,0);assert.equal(p.heldInput,undefined);assert.equal(bomb.players[p.id].alive,true);
  assert.ok(fits(MAPS.district,p.state.movement.position,C.standing));
 }
 assert.equal(bomb.players[bomb.carrier!].team,'T');
});
test('10-player halftime/reconnect keeps actual side; overtime ends once and stops simulation',()=>{
 const {server,room,bomb}=serverMatch();
 for(let round=1;round<=14;round++){
  bomb.phase='active';bomb.deadline=room.tick*C.dt+100;
  const losingSide=round%2?'blue':'red';
  for(const p of room.players.values())p.state.hp=p.team===losingSide?0:100;
  server.tickSimulation(room);assert.equal(bomb.phase,'result');
  room.tick=Math.ceil(bomb.deadline/C.dt)-1;server.tickSimulation(room);
  if(round<14){assert.equal(bomb.round,round+1);assert.equal(bomb.phase,'buy');}
  for(const p of room.players.values()){
   assert.equal(p.team,bomb.players[p.id].team==='T'?'red':'blue');assert.equal(p.originalTeam,p.team);
  }
  if(round===6){
   assert.equal(room.players.get('p1')!.team,'blue');
   assert.ok(server.joinRoom(room.roomCode,{id:1,username:'Player 1',avatar:null},'reconnected').success);
   assert.equal(room.players.get('reconnected')!.team,'blue');
   assert.equal(room.getSnapshotForPlayer('reconnected').players.find(p=>p.id==='reconnected')!.team,'blue');
  }
 }
 assert.equal(bomb.phase,'finished');assert.equal(room.status,'game_over');assert.equal(room.loopInterval,null);
});
