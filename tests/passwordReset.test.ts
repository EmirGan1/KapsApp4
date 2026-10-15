import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { initPasswordResetDb, registerPasswordResetRoutes } from '../src/server/passwordResetController.ts';

async function fixture() {
  const client=createClient({url:':memory:'});
  await client.execute(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,password TEXT,token TEXT,role TEXT,status TEXT,isBanned INTEGER DEFAULT 0,is_banned INTEGER DEFAULT 0)`);
  await client.execute(`CREATE TABLE user_sessions(user_id INTEGER,token TEXT,expires_at TEXT)`);
  await client.execute(`CREATE TABLE notifications(id INTEGER PRIMARY KEY,user_id INTEGER,type TEXT,content TEXT,read INTEGER,target_id INTEGER,metadata TEXT,created_at TEXT)`);
  await client.execute(`CREATE TABLE password_resets(id INTEGER PRIMARY KEY,user_id INTEGER,token TEXT,used INTEGER)`);
  await client.execute(`INSERT INTO password_resets VALUES(1,2,'legacy',0)`);
  const password=await bcrypt.hash('old-password',4);
  for(const [id,username,role,token] of [[1,'emirgan','ROOT','root-session'],[2,'Alice','user','alice-session'],[3,'Bob','user','bob-session'],[4,'OtherRoot','ROOT','other-root']] as const)
    await client.execute({sql:`INSERT INTO users(id,username,role,token,password,status) VALUES(?,?,?,?,?,'approved')`,args:[id,username,role,token,password]});
  await client.execute(`INSERT INTO user_sessions VALUES(2,'second-device','2099-01-01T00:00:00.000Z')`);
  await initPasswordResetDb(client);
  const routes=new Map<string,any>();
  const app={post:(paths:any,h:any)=>{for(const p of Array.isArray(paths)?paths:[paths])routes.set('POST '+p,h);},get:(path:string,h:any)=>routes.set('GET '+path,h)} as any;
  const disconnected:number[]=[];
  const sockets=new Map([[1,{data:{user:{id:2,username:'Alice',role:'user'}},emit(){},disconnect(){disconnected.push(1);}}],[2,{data:{user:{id:2,username:'Alice',role:'user'}},emit(){},disconnect(){disconnected.push(2);}}]]) as any;
  const invalidated:number[]=[];
  const service=registerPasswordResetRoutes(app,client,{sockets:{sockets}} as any,id=>invalidated.push(id));
  const call=(path:string,body:any={},headers:any={},params:any={})=>new Promise<any>((resolve,reject)=>{
    let code=200; const res={headersSent:false,setHeader(){},status(c:number){code=c;return this;},json(data:any){this.headersSent=true;resolve({code,data});return this;}};
    const req={body,headers,params,ip:'127.0.0.1',socket:{remoteAddress:'127.0.0.1'}};
    try{routes.get(path)(req,res);}catch(err){reject(err);}
  });
  return {client,call,service,disconnected,invalidated};
}
const key='a'.repeat(64), other='b'.repeat(64);
const auth={authorization:'Bearer root-session'};
const request=(f:any,username='alice',requesterKey=key)=>f.call('POST /api/auth/request-password-reset',{username,requesterKey});
const status=(f:any,k=key)=>f.call('GET /api/auth/password-reset-status/:username',{}, {'x-password-reset-key':k},{username:'ALICE'});
const decide=(f:any,id:string,decision='APPROVE',headers:any=auth)=>f.call('POST /api/admin/password-reset/decide',{requestId:id,decision},headers);

test('legacy tokens are invalidated and neither legacy endpoint bypasses approval',async()=>{
 const f=await fixture();try{
 assert.equal((await f.client.execute('SELECT used FROM password_resets')).rows[0].used,1);
 for(const path of ['/api/auth/reset-password','/api/reset-password'])assert.equal((await f.call('POST '+path,{token:'legacy',newPassword:'attacker-password'})).code,400);
 const legacy=await f.call('POST /api/auth/forgot-password',{username:'Alice'});assert.equal(legacy.code,400);assert.equal(legacy.data.resetToken,undefined);
 }finally{f.client.close();}
});
test('request -> pending -> admin approval -> same-browser completion; one-time and all sessions revoked',async()=>{
 const f=await fixture();try{
 const r=await request(f);assert.equal(r.data.status,'PENDING');assert.equal(r.data.resetToken,undefined);
 assert.equal((await status(f)).data.status,'PENDING');
 assert.equal((await status(f,other)).code,403);
 const notif=(await f.client.execute('SELECT * FROM notifications')).rows;assert.equal(notif.length,2);
 assert.ok(notif.every(n=>!String(n.metadata).includes(key)));
 assert.equal((await decide(f,r.data.requestId)).code,200);
 const approved=await status(f);assert.equal(approved.data.status,'APPROVED');assert.ok(approved.data.resetToken);
 assert.equal((await status(f,other)).code,403);
 const body={username:'Alice',requesterKey:key,resetToken:approved.data.resetToken,newPassword:'new-password-123'};
 assert.equal((await f.call('POST /api/auth/complete-password-reset',{...body,requesterKey:other})).code,403);
 assert.equal((await f.call('POST /api/auth/complete-password-reset',body)).code,200);
 assert.equal((await f.call('POST /api/auth/complete-password-reset',body)).code,403);
 const user=(await f.client.execute('SELECT * FROM users WHERE id=2')).rows[0];
 assert.equal(await bcrypt.compare(body.newPassword,String(user.password)),true);assert.equal(user.token,null);
 assert.equal((await f.client.execute('SELECT * FROM user_sessions WHERE user_id=2')).rows.length,0);
 assert.deepEqual(f.disconnected,[1,2]);assert.deepEqual(f.invalidated,[2]);
 }finally{f.client.close();}
});
test('only verified emirgan/ROOT sessions can decide, never forged names',async()=>{
 const f=await fixture();try{
 const r=await request(f);
 for(const headers of [{},{'x-username':'emirgan'},{authorization:'Bearer invalid'},{authorization:'Bearer bob-session'}])
 assert.equal((await decide(f,r.data.requestId,'APPROVE',headers)).code,403);
 assert.equal((await decide(f,r.data.requestId,'APPROVE',{authorization:'Bearer other-root'})).code,200);
 assert.equal((await decide(f,r.data.requestId,'REJECT')).code,409);
 }finally{f.client.close();}
});
test('root recovery is blocked, including mixed case usernames',async()=>{
 const f=await fixture();try{
 for(const u of ['EMIRGAN','OtherRoot'])assert.equal((await request(f,u)).code,403);
 }finally{f.client.close();}
});
test('rejection is stable across polls and a new request can follow',async()=>{
 const f=await fixture();try{
 const r=await request(f);assert.equal((await decide(f,r.data.requestId,'REJECT')).code,200);
 assert.equal((await status(f)).data.status,'REJECTED');assert.equal((await status(f)).data.status,'REJECTED');
 const n=await request(f);assert.equal(n.data.status,'PENDING');assert.notEqual(n.data.requestId,r.data.requestId);
 }finally{f.client.close();}
});
test('another browser cannot replace/claim an open request and duplicate request is idempotent',async()=>{
 const f=await fixture();try{
 const r=await request(f);assert.equal((await request(f)).data.requestId,r.data.requestId);
 assert.equal((await request(f,'Alice',other)).code,409);
 }finally{f.client.close();}
});
test('approved login interception requires ownership even with no password or a wrong password',async()=>{
 const f=await fixture();try{
 const r=await request(f);await decide(f,r.data.requestId);
 const user=(await f.client.execute('SELECT * FROM users WHERE id=2')).rows[0];
 for(const password of ['', 'incorrect']){
 let data:any;assert.equal(await f.service.interceptLogin({body:{password,requesterKey:key}} as any,{json:(d:any)=>data=d} as any,user),true);
 assert.equal(data.requirePasswordReset,true);assert.ok(data.resetToken);
 }
 for(const requesterKey of [undefined,other])assert.equal(await f.service.interceptLogin({body:{requesterKey}} as any,{} as any,user),false);
 }finally{f.client.close();}
});
test('pending login resumes waiting; correct-password cancellation makes approval impossible',async()=>{
 const f=await fixture();try{
 const r=await request(f),user=(await f.client.execute('SELECT * FROM users WHERE id=2')).rows[0];
 let response:any;assert.equal(await f.service.interceptLogin({body:{password:'',requesterKey:key}} as any,{json:(d:any)=>response=d} as any,user),true);
 assert.equal(response.status,'PENDING');
 assert.equal(await f.service.interceptLogin({body:{password:'old-password',requesterKey:key}} as any,{} as any,user),false);
 await f.service.cancelPending(2);assert.equal((await decide(f,r.data.requestId)).code,409);
 assert.equal((await status(f)).data.status,'CANCELLED');
 }finally{f.client.close();}
});
test('expired approval cannot complete or disclose a token',async()=>{
 const f=await fixture();try{
 const r=await request(f);await decide(f,r.data.requestId);const approved=await status(f);
 await f.client.execute({sql:'UPDATE password_reset_requests SET expires_at=? WHERE id=?',args:['2000-01-01T00:00:00.000Z',r.data.requestId]});
 assert.equal((await status(f)).data.status,'EXPIRED');assert.equal((await status(f)).data.resetToken,undefined);
 assert.equal((await f.call('POST /api/auth/complete-password-reset',{username:'Alice',requesterKey:key,resetToken:approved.data.resetToken,newPassword:'new-password'})).code,403);
 }finally{f.client.close();}
});
test('completion validates password length and pending requests cannot reset',async()=>{
 const f=await fixture();try{
 await request(f);
 for(const newPassword of ['short','ü'.repeat(40)])assert.equal((await f.call('POST /api/auth/complete-password-reset',{username:'Alice',requesterKey:key,resetToken:key,newPassword})).code,400);
 assert.equal((await f.call('POST /api/auth/complete-password-reset',{username:'Alice',requesterKey:key,resetToken:key,newPassword:'valid-password'})).code,403);
 }finally{f.client.close();}
});

test('concurrent completion consumes the approval at most once',async()=>{
 const f=await fixture();try{
 const r=await request(f);await decide(f,r.data.requestId);const approved=await status(f);
 const body={username:'Alice',requesterKey:key,resetToken:approved.data.resetToken,newPassword:'concurrent-password'};
 const results=await Promise.all([f.call('POST /api/auth/complete-password-reset',body),f.call('POST /api/auth/complete-password-reset',body)]);
 assert.equal(results.filter(r=>r.code===200).length,1);
 assert.ok(results.every(r=>r.code===200||r.code===403));
 assert.equal((await f.client.execute('SELECT status FROM password_reset_requests')).rows[0].status,'COMPLETED');
 }finally{f.client.close();}
});
test('disabled root accounts and expired session tokens cannot approve',async()=>{
 const f=await fixture();try{
 const r=await request(f);
 await f.client.execute(`INSERT INTO user_sessions VALUES(1,'expired-root','2000-01-01T00:00:00.000Z')`);
 assert.equal((await decide(f,r.data.requestId,'APPROVE',{authorization:'Bearer expired-root'})).code,403);
 await f.client.execute('UPDATE users SET is_banned=1 WHERE id=1');
 assert.equal((await decide(f,r.data.requestId)).code,403);
 }finally{f.client.close();}
});
test('reset-request throttling blocks abuse without generating duplicate notifications',async()=>{
 const f=await fixture();try{
 for(let i=0;i<10;i++)assert.equal((await request(f)).code,200);
 assert.equal((await request(f)).code,429);
 assert.equal((await f.client.execute('SELECT count(*) AS count FROM notifications')).rows[0].count,2);
 }finally{f.client.close();}
});

test('migration revokes credentials from the earlier username-only reset implementation',async()=>{
 const f=await fixture();try{
 await f.client.execute("ALTER TABLE users ADD COLUMN reset_status TEXT DEFAULT 'NONE'");
 await f.client.execute('ALTER TABLE users ADD COLUMN reset_token TEXT');
 await f.client.execute("UPDATE users SET reset_status='APPROVED',reset_token='public-legacy-secret' WHERE id=2");
 await initPasswordResetDb(f.client);
 const row=(await f.client.execute('SELECT reset_status,reset_token FROM users WHERE id=2')).rows[0];
 assert.equal(row.reset_status,'NONE');assert.equal(row.reset_token,null);
 }finally{f.client.close();}
});
