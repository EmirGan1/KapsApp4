import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:4183,strictPort:true}});await server.listen();
const browser=await chromium.launch({headless:true});const results:any[]=[];
const routes=['/','/ajanda','/akis','/sohbetler','/genel-sohbet','/dersler','/dersler/Mathematics','/bildirimler','/arkadaslar','/duyurular','/oyunlar','/hava-durumu','/profil','/harita','/sesli-sohbet','/emirgan','/tahminler'];
await mkdir('/tmp/mobile-layout',{recursive:true});
try{for(const [width,height]of [[360,740],[390,844],[844,390],[768,1024],[820,1180],[1024,768],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:width<1024,isMobile:width<1024,reducedMotion:'reduce'});const page=await context.newPage();
 await page.addInitScript(()=>{localStorage.setItem('lan_token','layout-fixture');localStorage.setItem('lan_username','emirgan');localStorage.setItem('lan_user_id','1')});
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1'||u.pathname.startsWith('/socket.io'))return r.abort();if(u.pathname.startsWith('/api'))return r.fulfill({status:503,json:{error:'Isolated offline layout fixture'}});return r.continue()});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of routes){try{errors.length=0;await page.goto('http://127.0.0.1:4183'+route);await page.locator('.app-content').waitFor();await page.waitForTimeout(100);assert.deepEqual(errors,[]);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
 const nav=page.getByRole('navigation',{name:'Mobil alt gezinti menüsü'});assert.equal(await nav.isVisible(),width<1024);
 if(width<1024){assert.equal(await page.locator('.app-content').evaluate(e=>getComputedStyle(e).paddingBottom),'56px');await page.getByRole('button',{name:'Daha Fazla',exact:true}).click();await page.getByRole('button',{name:'Menüyü Kapat'}).click()}
 results.push({width,height,route,pass:true});
 }catch(e:any){results.push({width,height,route,pass:false,error:e.message});console.log('FAIL',width,route,e.message.slice(0,180))}}
 await page.screenshot({path:`/tmp/mobile-layout/${width}x${height}.png`});await context.close();console.log('Completed',width,height)
}}finally{await browser.close();await server.close();await writeFile('/tmp/mobile-layout/results.json',JSON.stringify(results,null,2))}
console.log(JSON.stringify({total:results.length,pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length}));if(results.some(r=>!r.pass))process.exitCode=1;
