import {createServer} from 'vite';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const vite=await createServer({cacheDir:'node_modules/.vite-strike-map-qa',logLevel:'error',plugins:[{name:'map-qa',configureServer(s){s.middlewares.use('/__maps',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__maps','<html><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.fixture.tsx"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4198,strictPort:true}});
await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const views={warehouse:[[-21,2.1,-6],[-25,6,16]],dust:[[3,2.1,-10],[-1,2.6,13]],neon:[[-7,2.1,-31],[1,7,10]]};
 for(const [map,view] of Object.entries(views)){
  const page=await browser.newPage({viewport:{width:1280,height:720}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:4198/__maps?mode=engine&map=${map}`);
  await page.getByRole('button',{name:'Start test',exact:true}).click();
  await page.waitForFunction(()=>(window as any).strike?.renderer.scene.isReady()&&(window as any).strike?.state.tick>5);
  const materials=await page.evaluate(view=>{
   const c=(window as any).strike,r=c.renderer;c.pause();r.gunRoot.setEnabled(false);r.camera.rotationQuaternion=null;r.camera.upVector.set(0,1,0);
   r.camera.position.set(...view[0]);const target=r.camera.position.clone();target.set(...view[1]);r.camera.setTarget(target);r.scene.render();
   return r.scene.materials.filter((m:any)=>m.diffuseTexture).length;
  },view);
  assert.ok(materials>=8,'actual textured materials');
  await page.locator('button').evaluateAll(buttons=>buttons.forEach(b=>b.remove()));
  await page.screenshot({path:`/tmp/strike-${map}-street.png`});
  await page.evaluate(()=>{const r=(window as any).strike.renderer;r.scene.fogMode=0;r.camera.position.set(0,130,-.001);const target=r.camera.position.clone();target.set(0,0,0);r.camera.setTarget(target);r.camera.mode=1;r.camera.orthoLeft=-85;r.camera.orthoRight=85;r.camera.orthoTop=48;r.camera.orthoBottom=-48;r.scene.render();});
  await page.screenshot({path:`/tmp/strike-${map}-plan.png`});
  await page.evaluate(()=>(window as any).strike.dispose());assert.equal(errors.length,0,errors.join(';'));await page.close();console.log('PASS textured street + distinct overhead capture',map,materials);
 }
}finally{await browser.close();await vite.close();}
