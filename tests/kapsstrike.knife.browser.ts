import {createServer} from 'vite';import {chromium} from 'playwright';import {mkdir} from 'node:fs/promises';import assert from 'node:assert/strict';
const output=process.env.STRIKE_QA_OUTPUT||'/tmp/strike-knives';await mkdir(output,{recursive:true});
const vite=await createServer({cacheDir:'node_modules/.vite-knives',logLevel:'error',plugins:[{name:'knife-preview',configureServer(s){s.middlewares.use('/__knives',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__knives','<html><body><script type="module" src="/tests/kapsstrike.hitreg.fixture.ts"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4196,strictPort:true}});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors:string[]=[];
try{const p=await browser.newPage({viewport:{width:960,height:600}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4196/__knives?knife=1');await p.waitForFunction(()=>(window as any).knife);
 const frames=process.env.STRIKE_KNIFE_FRAMES?Array.from({length:Number(process.env.STRIKE_KNIFE_FRAMES)},(_,i)=>i/Number(process.env.STRIKE_KNIFE_FRAMES)):[0,.2,.4,.6,.8,.99];
 for(const style of ['karambit','butterfly'])for(const [i,t] of frames.entries()){await p.evaluate(({style,t})=>(window as any).knife(style,t),{style,t});await p.screenshot({path:`${output}/${style}-${i}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS two production knife rigs; inspect samples each:',frames.length,'zero page errors');
}finally{await browser.close();await vite.close();}
