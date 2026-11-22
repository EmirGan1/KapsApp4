import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import{once}from'node:events';import{createClient}from'@libsql/client';
import{createContentDeletion,DeletionError}from'../src/server/contentDeletion';import{MessageRamCache}from'../src/server/messageRamCache';import{setupChatSocketHandlers}from'../src/server/socket';import{recordDeletion,liveRows}from'../src/utils/contentDeletion';
async function setup(){const db=createClient({url:':memory:'});await db.batch([
 'CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,is_admin INTEGER DEFAULT 0)',"INSERT INTO users VALUES(1,'Owner',0),(2,'Other',0),(3,'Emirgan',0)",
 'CREATE TABLE messages(id INTEGER PRIMARY KEY,sender INTEGER,receiver INTEGER,content TEXT,type TEXT,reply_to INTEGER)',
 'CREATE TABLE global_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,sender INTEGER,content TEXT,type TEXT,reply_to INTEGER,reactions TEXT,file_name TEXT,file_size TEXT,created_at TEXT)',
 'CREATE TABLE group_messages(id INTEGER PRIMARY KEY,group_id INTEGER,sender INTEGER,content TEXT,type TEXT,reply_to INTEGER)',
 "INSERT INTO messages VALUES(1,1,2,'private','text',NULL)","INSERT INTO global_messages(id,sender,content,type) VALUES(1,1,'global','text')","INSERT INTO group_messages VALUES(1,7,1,'group','text',NULL)",
 'CREATE TABLE posts(id INTEGER PRIMARY KEY,user_id INTEGER,image TEXT,attachments TEXT)',"INSERT INTO posts VALUES(9,1,'/uploads/post.png',NULL)",
 'CREATE TABLE likes(id INTEGER PRIMARY KEY,post_id INTEGER,user_id INTEGER)',"INSERT INTO likes VALUES(1,9,2)",
 'CREATE TABLE comments(id INTEGER PRIMARY KEY,post_id INTEGER,user_id INTEGER,content TEXT)',"INSERT INTO comments VALUES(1,9,1,'one'),(2,9,2,'two')",
 'CREATE TABLE mentions(kind TEXT,target TEXT,user_id INTEGER)',"INSERT INTO mentions VALUES('global','1',2),('post','9',2)",
 'CREATE TABLE notifications(id INTEGER PRIMARY KEY,type TEXT,target_id INTEGER,metadata TEXT)',`INSERT INTO notifications VALUES(1,'mention',1,'{"kind":"global"}'),(2,'like',9,NULL),(3,'mention',9,'{"kind":"post"}')`
],'write');const events:any[]=[],files:string[]=[];const delivery:any={emit:(event:string,data:any)=>events.push({event,data}),to:()=>delivery};const io:any={...delivery,to:()=>delivery};const cache=new MessageRamCache();cache.set('global',[{id:1,content:'global'}]);cache.set('group_7',[{id:1,content:'group'}]);const service=await createContentDeletion(db,io,cache,async url=>{files.push(url);});return{db,cache,service,events,files};}
test('owner and admin deletion is durable, scoped by table, invalidates RAM and scrubs quoted replies',async()=>{
 const{db,cache,service,events}=await setup();try{
 await db.execute("INSERT INTO global_messages(id,sender,content,type,reply_to) VALUES(2,2,'reply','text',1)");const version=cache.version('global');
 await assert.rejects(service.mutate('global',1,2),(e:any)=>e instanceof DeletionError&&e.status===403);assert.equal(events.length,0);assert.ok(cache.get('global'));
 await service.mutate('global',1,1);assert.equal(cache.get('global'),null);assert.notEqual(cache.version('global'),version);assert.equal((await db.execute('SELECT count(*) AS n FROM global_messages WHERE id=1')).rows[0].n,0);assert.equal((await db.execute('SELECT reply_to FROM global_messages WHERE id=2')).rows[0].reply_to,null);
 assert.equal((await db.execute('SELECT count(*) AS n FROM messages WHERE id=1')).rows[0].n,1);assert.equal((await db.execute('SELECT count(*) AS n FROM group_messages WHERE id=1')).rows[0].n,1);assert.equal(events[0].data.type,'global');
 assert.equal((await db.execute("SELECT count(*) AS n FROM mentions WHERE kind='global'")).rows[0].n,0);
 await service.mutate('group',1,3);assert.equal(cache.get('group_7'),null);await assert.rejects(service.mutate('private',1,2),(e:any)=>e.status===403);await service.mutate('private',1,1);assert.equal((await db.execute('SELECT count(*) AS n FROM messages')).rows[0].n,0);
 assert.equal((await service.mutate('global',1,1)).alreadyDeleted,true);await assert.rejects(service.mutate('global','g_pending',1),(e:any)=>e.status===400);
 }finally{db.close();}
});
test('post deletion is atomic; failed database writes emit no success and leave content, cache and files intact',async()=>{
 const{db,cache,service,events,files}=await setup();try{
 await db.execute("CREATE TRIGGER reject_post BEFORE DELETE ON posts BEGIN SELECT RAISE(ABORT,'disk failure');END");await assert.rejects(service.mutate('post',9,1));assert.equal((await db.execute('SELECT count(*) AS n FROM likes')).rows[0].n,1);assert.equal((await db.execute('SELECT count(*) AS n FROM comments')).rows[0].n,2);assert.equal(events.length,0);assert.equal(files.length,0);assert.ok(cache.get('global'));
 await db.execute('DROP TRIGGER reject_post');await service.mutate('post',9,3);assert.equal((await db.execute('SELECT count(*) AS n FROM posts')).rows[0].n,0);assert.equal((await db.execute('SELECT count(*) AS n FROM likes')).rows[0].n,0);assert.equal((await db.execute('SELECT count(*) AS n FROM comments')).rows[0].n,0);assert.deepEqual(files,['/uploads/post.png']);assert.equal((await db.execute("SELECT count(*) AS n FROM notifications WHERE target_id=9")).rows[0].n,0);
 }finally{db.close();}
});
test('REST uses the supplied session authenticator and never guesses a message table; socket deletion shares the same result',async()=>{
 const{db,cache,service}=await setup();const app=express();service.routes(app,async req=>req.headers.authorization==='Bearer session-only'?{id:1}:null);const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}`;
 try{
 const request=(path:string,auth=true)=>fetch(base+path,{method:'DELETE',headers:auth?{Authorization:'Bearer session-only'}:{}});
 assert.equal((await request('/api/messages/1?type=global',false)).status,401);assert.equal((await request('/api/messages/1')).status,400);assert.equal((await request('/api/messages/1?type=wat')).status,400);assert.equal((await request('/api/messages/g_temp?type=global')).status,400);
 assert.equal((await request('/api/messages/1?type=global')).status,200);assert.equal(cache.get('global'),null);assert.equal((await db.execute('SELECT count(*) AS n FROM messages')).rows[0].n,1);
 const handlers=new Map<string,any>();service.sockets({on:(name:string,handler:any)=>handlers.set(name,handler)},{id:3});const result=await new Promise<any>(resolve=>handlers.get('delete_message')({id:1,type:'group'},resolve));assert.equal(result.success,true);assert.equal(cache.get('group_7'),null);assert.equal((await db.execute('SELECT count(*) AS n FROM group_messages')).rows[0].n,0);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
test('a global send is never broadcast or acknowledged before its durable numeric ID exists',async()=>{
 const{db,service,cache}=await setup();const handlers=new Map<string,any>(),events:any[]=[];const io:any={emit:(event:string,data:any)=>events.push({event,data}),to:()=>io};const socket:any={on:(name:string,handler:any)=>handlers.set(name,handler),join:()=>{},leave:()=>{}};
 try{setupChatSocketHandlers(io,socket,{id:1},db,cache,async()=>({username:'Owner'}));const response=await new Promise<any>(resolve=>handlers.get('send_global_message')({type:'text',content:'durable'},resolve));assert.ok(Number.isSafeInteger(response.message.id));assert.equal((await db.execute({sql:'SELECT content FROM global_messages WHERE id=?',args:[response.message.id]})).rows[0].content,'durable');await service.mutate('global',response.message.id,1);assert.equal(cache.get('global'),null);
 const failed:any[]=[];setupChatSocketHandlers({emit:()=>failed.push('broadcast'),to:()=>({emit:()=>failed.push('room')})} as any,socket,{id:1},{execute:async()=>{throw new Error('write failed');}},cache,async()=>({}));const bad=await new Promise<any>(resolve=>handlers.get('send_global_message')({type:'text',content:'must not exist'},resolve));assert.ok(bad.error);assert.deepEqual(failed,[]);assert.equal(cache.get('global'),null);
 }finally{db.close();}
});
test('late client snapshots cannot resurrect deletes or quotes, and equal IDs in other content types survive',()=>{
 recordDeletion('global',{id:9001});assert.deepEqual(liveRows('global',[{id:9001},{id:9002,reply_to:9001,reply_message:{id:9001,content:'gone'}}]),[{id:9002,reply_to:null,reply_message:null}]);assert.deepEqual(liveRows('private',[{id:9001}]),[{id:9001}]);
 recordDeletion('comment',{id:9011,commentId:9011,postId:9022});assert.deepEqual(liveRows('comment',[{id:9011},{id:9022}]),[{id:9022}]);
});

test('a new message after invalidation does not turn a partial room into a complete history cache',()=>{
 const cache=new MessageRamCache();cache.push('global',{id:2});assert.equal(cache.get('global'),null);
 cache.set('global',[{id:1},{id:2}]);const before=cache.version('global');cache.push('global',{id:3});assert.deepEqual(cache.get('global')?.map(m=>m.id),[1,2,3]);assert.notEqual(cache.version('global'),before);
 cache.clear('global');cache.push('global',{id:4});assert.equal(cache.get('global'),null);
});
