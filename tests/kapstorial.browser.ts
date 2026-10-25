import {createServer} from 'vite';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
import {KapstorialManager} from '../src/server/kapstorialServer';
import {TOTAL_PIXELS,MAP_WIDTH} from '../src/utils/kapstorialMaps';
import assert from 'node:assert/strict';
const server=await createServer({logLevel:'error',plugins:[{name:'kap-test',configureServer(s){s.middlewares.use('/__kap-test',async(req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__kap-test','<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapstorial.fixture.tsx"></script></body></html>'))})}}],server:{host:'127.0.0.1',port:4179,strictPort:true}});await server.listen();
const io=new Server(server.httpServer!);const manager:any=new KapstorialManager(io,null);
io.on('connection',socket=>manager.handleSocketEvents(socket,{id:1,username:'Test'}));
const browser=await chromium.launch({headless:true});let passed=0;
try{for(const [width,height] of [[390,844],[844,390],[768,1024],[1440,900]]){
 const room=manager.createRoom({id:1,username:'Test',avatar:null},{mapType:'archipelago',botCount:3});
 const context=await browser.newContext({viewport:{width,height},isMobile:width<1024,hasTouch:true});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:4179/__kap-test?room=${room.roomCode}`);await page.waitForSelector('text=Oyunu Başlat');
 assert.equal((await manager.startSpawnPhase(room.roomCode,1)).success,true);clearInterval(room.spawnTimerInterval);
 await page.waitForSelector('canvas');await page.waitForTimeout(300);
 const canvas=page.locator('canvas');const box=(await canvas.boundingBox())!;assert.equal(Math.round(box.width),width);assert.equal(Math.round(box.height),height);
 const land=room.terrain.findIndex((t:number,i:number)=>t===1&&i>MAP_WIDTH*100&&room.terrain[i-1]===1&&room.terrain[i+1]===1&&room.terrain[i-MAP_WIDTH]===1&&room.terrain[i+MAP_WIDTH]===1);const zoom=Math.min(width/600,height/400)*.96;const x=(width-600*zoom)/2+(land%600+.5)*zoom;const y=(height-400*zoom)/2+(Math.floor(land/600)+.5)*zoom;
 await page.mouse.click(Math.round(x),Math.round(y));await page.waitForTimeout(200);
 assert.ok(room.players[0].spawnPixel !== null, 'Browser selection must reach server');
 assert.equal(room.terrain[room.players[0].spawnPixel],1);
 manager.finishSpawnPhaseAndStartGame(room);clearInterval(room.gameTimerInterval);await page.waitForTimeout(200);
 assert.equal(await page.locator('text=Harita yükleniyor…').count(),0);
 for(let i=0;i<120;i++)manager.tick(room);
 await page.waitForTimeout(150);assert.equal(errors.length,0,errors.join(';'));assert.equal(room.owners.length,TOTAL_PIXELS);
 await page.getByRole('button',{name:'Haritayı ekrana sığdır'}).click();
 await page.screenshot({path:`/tmp/kapstorial-${width}x${height}.png`});await context.close();manager.destroyRoom(room.roomCode);passed++;console.log('PASS socket+canvas',width,height);
}}finally{for(const code of manager.rooms.keys())manager.destroyRoom(code);await browser.close();io.close();await server.close()}
console.log(`${passed} browser sessions passed`);
