import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {createClient} from '@libsql/client';
import {initAyvalikCasTables,registerAyvalikCasRoutes} from '../src/server/ayvalikController';
test('CAS accepts valid multi-device sessions; rooms persist and enforce membership, invites and capacity',async()=>{
 const db=createClient({url:'file::memory:'});
 await db.execute(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,avatar TEXT,color TEXT,roles TEXT,is_admin INTEGER DEFAULT 0,token TEXT,isBanned INTEGER DEFAULT 0,is_banned INTEGER DEFAULT 0,status TEXT DEFAULT 'approved')`);
 await db.execute('CREATE TABLE user_sessions(user_id INTEGER,token TEXT,expires_at TEXT)');
 for(let i=1;i<=5;i++){await db.execute({sql:'INSERT INTO users(id,username,token) VALUES(?,?,?)',args:[i,'Kişi '+i,'latest-'+i]});await db.execute({sql:'INSERT INTO user_sessions VALUES(?,?,?)',args:[i,'session-'+i,'2099-01-01T00:00:00.000Z']});}
 await db.execute("INSERT INTO user_sessions VALUES(1,'expired','2000-01-01T00:00:00.000Z')");await initAyvalikCasTables(db);
 const app=express();app.use(express.json());registerAyvalikCasRoutes(app,db);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${(server.address() as any).port}/api/ayvalik`;
 const req=async(path:string,user=1,body?:any,token='session-'+user)=>{const res=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:res.status,...await res.json()};};
 try{
  assert.equal((await req('/messages',1,{content:'Sahte test mesajı'})).success,true);
  assert.equal((await req('/messages',1,{content:'bad'},'expired')).status,401);
  assert.equal((await req('/rooms',1,{name:'Kılıç odası',capacity:2})).success,true);
  let listing=await req('/rooms',2);let id=listing.rooms[0].id;assert.equal(listing.rooms[0].members[0].username,'Kişi 1');
  assert.equal((await req(`/rooms/${id}/invite`,3,{userId:4})).success,false,'outsider cannot invite');
  assert.equal((await req(`/rooms/${id}/invite`,1,{userId:2})).success,true);
  assert.equal((await req('/rooms',2)).invites.length,1);
  const joins=await Promise.all([req(`/rooms/${id}/join`,2,{}),req(`/rooms/${id}/join`,3,{})]);assert.equal(joins.filter(r=>r.success).length,1);
  listing=await req('/rooms');assert.equal(listing.rooms[0].members.length,2);assert.equal((await req(`/rooms/${id}/join`,4,{})).success,false);
  assert.equal((await req('/rooms',1,{capacity:3})).success,false,'one room per person');
  await req(`/rooms/${id}/leave`,1,{});listing=await req('/rooms');assert.equal(listing.rooms[0].members.length,1);const remaining=listing.rooms[0].members[0].id;assert.equal(listing.rooms[0].owner_id,remaining);
  await req(`/rooms/${id}/leave`,remaining,{});assert.equal((await req('/rooms')).rooms.length,0);
  assert.equal((await req('/rooms',4,{capacity:3})).success,true);id=(await req('/rooms')).rooms[0].id;await req(`/rooms/${id}/join`,2,{});await req(`/rooms/${id}/join`,3,{});assert.equal((await req('/rooms')).rooms[0].members.length,3);
  await db.execute('UPDATE users SET is_banned=1 WHERE id=5');assert.equal((await req('/rooms',5)).status,401);
 }finally{await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
