import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createClient } from '@libsql/client';
import { createMentionService } from '../src/server/mentions';
import { canMentionEveryone, containsMention } from '../src/shared/mentions';
test('mention names respect token boundaries, multiple names, spaces, unicode and reserved broadcast permission',()=>{
 assert.ok(containsMention('Merhaba @Ayşe ve @Ali Can!','Ali Can'));assert.ok(containsMention('@Ayşe nasılsın?','Ayşe'));
 assert.ok(!containsMention('@Alim','Ali'));assert.ok(!containsMention('a@Ali.com','Ali'));assert.ok(canMentionEveryone('Emirgan'));assert.ok(!canMentionEveryone('Emirhan'));assert.ok(!canMentionEveryone('admin'));
});
test('persisted mentions: deduplication, broadcast restricted to one account, private/group audience and owner-scoped seen/open',async()=>{
 const db=createClient({url:':memory:'});
 await db.batch([
  'CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,avatar TEXT,isBanned INTEGER DEFAULT 0)',
  'CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,content TEXT,read INTEGER,sender_id INTEGER,target_id INTEGER,metadata TEXT,created_at TEXT)',
  'CREATE TABLE groups(id INTEGER PRIMARY KEY,members TEXT)',
  'CREATE TABLE global_messages(id INTEGER PRIMARY KEY,sender INTEGER,content TEXT)',
  'CREATE TABLE group_messages(id INTEGER PRIMARY KEY,sender INTEGER,content TEXT)',
  'CREATE TABLE messages(id INTEGER PRIMARY KEY,sender INTEGER,content TEXT)',
  'CREATE TABLE posts(id INTEGER PRIMARY KEY,user_id INTEGER,caption TEXT)',
  "INSERT INTO users(id,username) VALUES(1,'Emirgan'),(2,'Ayşe'),(3,'Ali Can'),(4,'Other')",
  "INSERT INTO groups VALUES(1,'[1,2]')",
  "INSERT INTO global_messages VALUES(10,1,'@Ayşe @Ali Can')",
  "INSERT INTO group_messages VALUES(20,1,'@herkes')",
  "INSERT INTO posts VALUES(30,1,'@Ayşe')",
 ],'write');
 const events:any[]=[],pushes:any[]=[];
 const service=await createMentionService(db,{to:(room:string)=>({emit:(event:string,data:any)=>events.push({room,event,data})})},{deliver:async(id:number,data:any)=>{pushes.push({id,data});}});
 await service.record('global',10,1,'@Ayşe @Ali Can @Ayşe');await service.record('global',10,1,'@Ayşe @Ali Can');
 assert.equal((await db.execute('SELECT count(*) AS n FROM mentions')).rows[0].n,2);assert.equal(pushes.length,2);
 assert.deepEqual(events.filter(e=>e.event==='new_notification').map(e=>e.room).sort(),['dm-user:2','dm-user:3']);
 await service.record('global',11,2,'@herkes @everyone');assert.equal((await db.execute('SELECT count(*) AS n FROM mentions')).rows[0].n,2);
 await service.record('global',12,1,'@herkes @Ayşe');assert.equal((await db.execute("SELECT count(*) AS n FROM mentions WHERE target='12'")).rows[0].n,3);
 await service.record('dm',13,1,'@herkes @Other','1:2');assert.deepEqual((await db.execute("SELECT user_id FROM mentions WHERE kind='dm'")).rows.map(r=>r.user_id),[2]);
 await service.record('group',20,1,'@herkes @Other',1);assert.deepEqual((await db.execute("SELECT user_id FROM mentions WHERE kind='group'")).rows.map(r=>r.user_id),[2]);
 await service.record('group',21,4,'@Ayşe',1);assert.equal((await db.execute("SELECT count(*) AS n FROM mentions WHERE target='21'")).rows[0].n,0);
 await service.record('post',30,1,'@Ayşe');
 const app=express();app.use(express.json());service.routes(app,async req=>(await db.execute({sql:'SELECT * FROM users WHERE id=?',args:[Number(req.headers.authorization)]})).rows[0]);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/mentions`;
 const ask=(path:string,user=2,body?:any)=>fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:String(user),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 try{
  assert.equal((await ask('/state',0)).status,401);
  const suggestions=await(await ask('/users?q=',2)).json();assert.equal(suggestions.everyone,false);assert.equal(suggestions.users.length,4);
  assert.equal((await(await ask('/users?q=',1)).json()).everyone,true);
  assert.equal((await ask('/users?kind=group&scope=1',4)).status,403);
  assert.equal((await ask('/open/global/10',4)).status,404);assert.equal((await(await ask('/open/global/10')).json()).content,'@Ayşe @Ali Can');
  await ask('/seen',4,{kind:'global',target:'10'});assert.equal((await db.execute("SELECT seen_at FROM mentions WHERE kind='global' AND target='10' AND user_id=2")).rows[0].seen_at,null);
  await ask('/seen',2,{kind:'global',target:'10'});const seen=(await db.execute("SELECT seen_at FROM mentions WHERE kind='global' AND target='10' AND user_id=2")).rows[0].seen_at;assert.ok(seen);
  await ask('/seen',2,{kind:'global',target:'10'});assert.equal((await db.execute("SELECT seen_at FROM mentions WHERE kind='global' AND target='10' AND user_id=2")).rows[0].seen_at,seen);
  assert.equal((await db.execute("SELECT seen_at FROM mentions WHERE kind='global' AND target='10' AND user_id=3")).rows[0].seen_at,null);
  await db.execute("UPDATE groups SET members='[1]' WHERE id=1");assert.equal((await ask('/open/group/20')).status,403);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});

test('real global and DM socket sends persist mentions under final message IDs and deliver only to recipients',async()=>{
 const {createServer}=await import('node:http');const {Server}=await import('socket.io');const {io:connect}=await import('socket.io-client');
 const {setupChatSocketHandlers}=await import('../src/server/socket');const {registerDirectMessages,DmPresence}=await import('../src/server/directMessages');
 const db=createClient({url:':memory:'});await db.batch([
 'CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,avatar TEXT,isBanned INTEGER DEFAULT 0)',
 'CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,content TEXT,read INTEGER,sender_id INTEGER,target_id INTEGER,metadata TEXT,created_at TEXT)',
 'CREATE TABLE global_messages(id INTEGER PRIMARY KEY,sender INTEGER,type TEXT,content TEXT,reply_to INTEGER,reactions TEXT,file_name TEXT,file_size TEXT,created_at TEXT)',
 'CREATE TABLE messages(id INTEGER PRIMARY KEY,sender INTEGER,receiver INTEGER,type TEXT,content TEXT,reply_to INTEGER,reactions TEXT,file_name TEXT,file_size TEXT,room_id TEXT,status TEXT,is_read INTEGER,read_at TEXT,created_at TEXT)',
 "INSERT INTO users(id,username) VALUES(1,'Emirgan'),(2,'Ayşe'),(3,'Other')"
 ],'write');
 const http=createServer(),io=new Server(http),presence=new DmPresence(),cache=new Map<string,any[]>();
 const service=await createMentionService(db,io,{deliver:async()=>{}});const getUser=async(id:number)=>(await db.execute({sql:'SELECT * FROM users WHERE id=?',args:[id]})).rows[0];
 io.use((s,n)=>{s.data.user={id:Number(s.handshake.auth.id)};n();});io.on('connection',socket=>{
  setupChatSocketHandlers(io,socket,socket.data.user,db,{get:(k:string)=>cache.get(k),push:(k:string,m:any)=>cache.set(k,[...(cache.get(k)||[]),m])},getUser,service.record);
  registerDirectMessages({io,socket,db,presence,getUser,notify:async()=>{},push:{deliver:async()=>{}},mention:service.record});
 });
 http.listen(0,'127.0.0.1');await once(http,'listening');const base=`http://127.0.0.1:${(http.address() as any).port}`;
 const a=connect(base,{auth:{id:1},forceNew:true}),b=connect(base,{auth:{id:2},forceNew:true});await Promise.all([new Promise<void>(resolve=>a.once('connect',()=>resolve())),new Promise<void>(resolve=>b.once('connect',()=>resolve()))]);
 const nextMention=()=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Missing mention event')),3000);const listener=(n:any)=>{if(n.type==='mention'){clearTimeout(timer);b.off('new_notification',listener);resolve(n);}};b.on('new_notification',listener);});
 try{
  const global=nextMention();await a.timeout(3000).emitWithAck('send_global_message',{type:'text',content:'@Ayşe selam'});const notification=await global;
  const meta=JSON.parse(notification.metadata);assert.equal(meta.kind,'global');assert.ok(Number(meta.target)>0);assert.equal((await db.execute({sql:'SELECT content FROM global_messages WHERE id=?',args:[Number(meta.target)]})).rows[0].content,'@Ayşe selam');
  const dm=nextMention();await a.timeout(3000).emitWithAck('send_message',{receiver:2,type:'text',content:'@Ayşe @Other özel mesaj'});assert.equal(JSON.parse((await dm).metadata).kind,'dm');
  assert.equal((await db.execute("SELECT count(*) AS n FROM mentions WHERE user_id=3")).rows[0].n,0);
 }finally{a.disconnect();b.disconnect();await new Promise<void>(r=>io.close(()=>r()));db.close();}
});
