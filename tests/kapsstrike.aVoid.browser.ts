import {createServer} from 'vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const vite=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:4212,strictPort:true},plugins:[{name:'a-void',configureServer(s){s.middlewares.use('/__aVoid',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__aVoid','<html><meta name="viewport" content="width=device-width,initial-scale=1"><script type="module" src="/tests/kapsstrike.aVoid.fixture.ts"></script></html>'));});}}]});await vite.listen();const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const quality of ['low','high'])for(const before of [true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:4212/__aVoid?quality=${quality}${before?'&before=1':''}`);await page.waitForFunction(()=>typeof(window as any).capture==='function');
  for(const view of before?['seam']:['seam','short','ramp']){
   const result=await page.evaluate(view=>(window as any).capture(view),view);assert.equal(result.core,!before);await page.screenshot({path:`/tmp/dust-a-void-${quality}-${before?'before':'after'}-${view}.png`});
  }
  assert.deepEqual(errors,[]);await page.evaluate(()=>(window as any).renderer.dispose());await page.close();console.log('PASS actual WebGL A seam, Short portal and ramp',quality,before?'before':'after');
 }
}finally{await browser.close();await vite.close();}
