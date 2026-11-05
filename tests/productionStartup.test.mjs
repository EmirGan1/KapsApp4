import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';

test('production bundle starts and serves health, CAS page and initialized CAS API', {timeout:45000}, async()=>{
 const root=resolve(import.meta.dirname,'..');
 const cwd=await mkdtemp(join(tmpdir(),'kaps-production-'));
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 await symlink(join(root,'dist'),join(cwd,'dist'),'dir');
 const env={...process.env,NODE_ENV:'production',PORT:String(port),TURSO_DATABASE_URL:'file:'+join(cwd,'test.db'),LIBSQL_URL:'file:'+join(cwd,'test.db')};
 delete env.TURSO_AUTH_TOKEN;delete env.LIBSQL_AUTH_TOKEN;
 const child=spawn(process.execPath,[join(root,'dist/server.cjs')],{cwd,env,stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',v=>{output+=v;});child.stderr.on('data',v=>{output+=v;});
 try{
  let health;
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){
   if(child.exitCode!==null)assert.fail('Server exited before listening:\n'+output.slice(-5000));
   try{health=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1000)});if(health.ok)break;}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(health?.status,200,'health did not become ready');
  const cas=await fetch(`http://127.0.0.1:${port}/api/ayvalik/messages`,{signal:AbortSignal.timeout(3000)});assert.equal(cas.status,200);const body=await cas.json();assert.equal(body.success,true);assert.deepEqual(body.messages,[]);
  const page=await fetch(`http://127.0.0.1:${port}/ayvalik-cas`,{signal:AbortSignal.timeout(3000)});assert.equal(page.status,200);assert.match(await page.text(),/<html/i);
 }finally{
  if(child.exitCode===null){const closed=new Promise(r=>child.once('close',r));child.kill('SIGKILL');await closed;}await rm(cwd,{recursive:true,force:true});
 }
});
