import {createServer} from 'vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const vite=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:4198,strictPort:true},plugins:[{name:'photo-qa',configureServer(s){s.middlewares.use('/__photos',async(_q,r)=>{r.setHeader('Content-Type','text/html');r.end(await s.transformIndexHtml('/__photos','<html><body style="margin:0"><script type="module" src="/tests/kapsstrike.fixture.tsx"></script></body></html>'));});}}]});await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const map of ['dust','warehouse','neon','district']){
 const page=await browser.newPage({viewport:{width:1000,height:700}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:4198/__photos?mode=engine&quality=medium&map=${map}`);await page.getByText('Start test',{exact:true}).click();
 await page.waitForFunction(()=>{const c=(window as any).strike;return c&&c.renderer.scene.isReady()&&c.state.tick>2;},{},{timeout:90000});
 const result=await page.evaluate(async()=>{
  const c=(window as any).strike,r=c.renderer;c.pause();r.gunRoot.setEnabled(false);
  const mats=r.scene.materials.filter((m:any)=>m.name.startsWith('map-photo-'));
  const textures=[];for(const m of mats){const pixels=await m.diffuseTexture.readPixels();let min=255,max=0;for(let i=0;i<pixels.length;i+=4){min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);}textures.push({ready:m.diffuseTexture.isReady(),min,max});}
  const f=r.map.photoFrames[0];r.camera.position.set(f.x+Math.sin(f.rotationY)*8,f.y,f.z+Math.cos(f.rotationY)*8);r.camera.setTarget(r.camera.position.clone().set(f.x,f.y,f.z));r.scene.fogMode=0;r.scene.render();
  return {textures,frames:r.map.photoFrames.length};
 });assert.equal(result.textures.length,6);assert.ok(result.frames>=6);for(const t of result.textures){assert.ok(t.ready);assert.ok(t.max-t.min>100,'photo has actual color data');}
 await page.screenshot({path:`/tmp/photo-fixed-${map}.png`});assert.deepEqual(errors,[]);console.log('PASS production renderer',map,result.frames,'frames, six decoded nonblack textures');await page.close();
}}finally{await browser.close();await vite.close();}
