import {createServer} from 'vite';import {chromium} from 'playwright';import assert from 'node:assert/strict';
const vite=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:4203,strictPort:true},plugins:[{name:'gece-fixture',configureServer(s){s.middlewares.use('/__gece',async(_q,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__gece','<html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0"><div id="root"></div><script type="module" src="/tests/geceNobeti.fixture.tsx"></script></body></html>'));});}}]});await vite.listen();const browser=await chromium.launch({headless:true});
try{for(const [width,height]of [[1440,900],[390,844],[844,390]]){
 const page=await browser.newPage({viewport:{width,height}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({json:[]}));
 await page.goto('http://127.0.0.1:4203/__gece');await page.getByPlaceholder('Oyun veya masa ara...').fill('Gece Nöbeti');await page.getByRole('button',{name:'Nöbete Başla',exact:true}).click();
 const frame=page.frameLocator('iframe');await frame.getByRole('button',{name:'▶ NÖBETE BAŞLA'}).click();await frame.locator('#qtext').waitFor();assert.equal(await frame.locator('.opt').count(),4);
 assert.ok(await frame.locator('#charImg').evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0));assert.ok(await frame.locator('#scareImg').evaluate((n:HTMLImageElement)=>n.complete&&n.naturalWidth>0));
 await frame.locator('#doorBtn').click();assert.ok(Number(await frame.locator('#powtxt').innerText())<=80);
 // Play through all supplied questions with the real button handlers.
 for(let i=0;i<10;i++){const correct=await frame.locator('#game').evaluate(()=>{const state=window as any;return state.eval('Q[cur].a') as string;});await frame.getByRole('button',{name:correct,exact:true}).click();await frame.locator('#nextBtn').click();}
 await frame.locator('#win:not(.hidden)').waitFor();await page.getByRole('button',{name:'Oyunu yeniden başlat'}).click();await frame.locator('#start:not(.hidden)').waitFor();
 await frame.locator('#startBtn').click();
 const options=await frame.locator('.opt').allTextContents();const correct=await frame.locator('#game').evaluate(()=>(window as any).eval('Q[cur].a') as string);await frame.getByRole('button',{name:options.find(x=>x!==correct)!,exact:true}).click();await frame.locator('#over:not(.hidden)').waitFor();await frame.locator('#retryBtn').click();await frame.locator('#panel:not(.hidden)').waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await page.locator('iframe').boundingBox();assert.ok(bounds&&bounds.width<=width&&bounds.height>200);assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'Oyunlara dön'}).click();await page.getByRole('heading',{name:'Oyunlar & Kağıt Masaları'}).waitFor();assert.equal(await page.locator('iframe').count(),0);
 await page.goto('http://127.0.0.1:4203/__gece?oyun=gece-nobeti');await frame.locator('#startBtn').waitFor();assert.deepEqual(errors,[]);console.log('PASS hub entry, local images, win, failure/retry, restart, exit and direct link',width,height);await page.close();
}}finally{await browser.close();await vite.close();}
