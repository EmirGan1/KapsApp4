import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';import {once} from 'node:events';import {createClient} from '@libsql/client';
import {registerSocialNavigation} from '../src/server/socialNavigation';import {notificationPostPath,postIdFromPath,positiveId,mentionRanges} from '../src/shared/socialNavigation';import {getTabFromPathname} from '../src/routes';
test('post notification links retain exact IDs, profile routing and reject invalid targets',()=>{
 assert.equal(notificationPostPath({type:'like',target_id:7}),'/gonderi/7');assert.equal(notificationPostPath({type:'comment',target_id:'8'}),'/gonderi/8');
 for(const target_id of [0,-1,'bad',NaN,1.5])assert.equal(notificationPostPath({type:'like',target_id}),null);
 assert.equal(notificationPostPath({type:'new_message',target_id:7}),null);assert.equal(postIdFromPath('/gonderi/7'),7);assert.equal(postIdFromPath('/gonderi/nope'),null);assert.equal(positiveId({}),null);
 assert.deepEqual(getTabFromPathname('/gonderi/7'),{tab:'feed'});assert.deepEqual(getTabFromPathname('/profil/2'),{tab:'profile',userId:2});
});
test('explicit @mentions use exact longest usernames and do not link email addresses or prefixes',()=>{
 const text='@Ali Can ve (@Ayşe), @Ali! a@Ali.com @Alim';
 const users=[{id:1,username:'Ali'},{id:2,username:'Ali Can'},{id:3,username:'Ayşe'}];
 const ranges=mentionRanges(text,users);assert.deepEqual(ranges.map(r=>r.id),[2,3,1]);assert.deepEqual(ranges.map(r=>text.slice(r.start,r.end)),['@Ali Can','@Ayşe','@Ali']);
});
test('authenticated single-post lookup works independently of feed page/subject; exact identities and atomic like notification targets',async()=>{
 const db=createClient({url:':memory:'});await db.batch([
 'CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,avatar TEXT,color TEXT)',"INSERT INTO users VALUES(1,'Owner',NULL,NULL),(2,'Ali Can',NULL,NULL),(3,'Ali Caner',NULL,NULL)",
 'CREATE TABLE posts(id INTEGER PRIMARY KEY,user_id INTEGER,caption TEXT,image TEXT,subject TEXT,created_at TEXT)',"INSERT INTO posts VALUES(7,1,'Old physics post',NULL,'Physics','2020-01-01'),(99,2,'Recent general',NULL,NULL,'2026-11-22')",
 'CREATE TABLE likes(id INTEGER PRIMARY KEY,post_id INTEGER,user_id INTEGER)',
 'CREATE TABLE comments(id INTEGER PRIMARY KEY,post_id INTEGER,user_id INTEGER,content TEXT)',"INSERT INTO comments VALUES(1,7,2,'A comment')",
 'CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,content TEXT,read INTEGER,sender_id INTEGER,target_id INTEGER,created_at TEXT)'
 ],'write');
 const events:any[]=[];const app=express();app.use(express.json());registerSocialNavigation(app,db,{to:(room:string)=>({emit:(type:string,data:any)=>events.push({room,type,data})}),emit:(type:string)=>events.push({type})},async req=>(await db.execute({sql:'SELECT * FROM users WHERE id=?',args:[Number(req.headers.authorization?.replace('Bearer ',''))]})).rows[0]);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/social`;
 const ask=(path:string,user=2,post=false)=>fetch(base+path,{method:post?'POST':'GET',headers:{Authorization:`Bearer ${user}`,'Content-Type':'application/json'},body:post?'{}':undefined});
 try{
 assert.equal((await ask('/posts/7',0)).status,401);assert.equal((await ask('/posts/404')).status,404);assert.equal((await ask('/posts/bad')).status,400);
 const old=await(await ask('/posts/7')).json();assert.equal(old.id,7);assert.equal(old.subject,'Physics');assert.equal(old.comments_count,1);assert.equal(old.is_liked,false);
 assert.equal((await(await ask('/users/resolve?username=Ali%20Can')).json()).id,2);assert.equal((await ask('/users/resolve?username=Ali')).status,404);assert.equal((await ask('/users/resolve?username=missing')).status,404);
 assert.equal((await ask('/posts/7/like',2,true)).status,200);const notification=events.find(e=>e.type==='new_notification');assert.equal(notification.room,'dm-user:1');assert.equal(notification.data.target_id,7);assert.equal(notification.data.sender_username,'Ali Can');assert.equal((await(await ask('/posts/7')).json()).is_liked,true);
 await ask('/posts/7/like',2,true);assert.equal((await db.execute('SELECT count(*) AS n FROM notifications')).rows[0].n,1);assert.equal((await(await ask('/posts/7')).json()).likes_count,0);
 await ask('/posts/7/like',1,true);assert.equal((await db.execute('SELECT count(*) AS n FROM notifications')).rows[0].n,1);
 await db.execute('DELETE FROM posts WHERE id=7');assert.equal((await ask('/posts/7')).status,404);assert.equal((await ask('/posts/7/like',2,true)).status,404);
 }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
