import {createServer} from 'vite';
import {Server} from 'socket.io';
import {BattleRoyaleManager} from '../src/server/battleRoyaleServer';
import {chromium,type Page} from 'playwright';
import assert from 'node:assert/strict';
const vite=await createServer({cacheDir:'node_modules/.vite-game-mobile',logLevel:'error',plugins:[{name:'mobile-input-fixture',configureServer(s){s.middlewares.use('/__mobile',async(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/__mobile','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/mobileInput.fixture.tsx"></script></body></html>'));});}}],server:{host:'127.0.0.1',port:4199,strictPort:true}});
const io=new Server(vite.httpServer!);const royale=new BattleRoyaleManager(io);
io.on('connection',socket=>{
 let room:any;
 socket.on('royale:get_rooms',cb=>cb([]));socket.on('royale:get_leaderboard',(_data,cb)=>cb([]));
 socket.on('fixture:start',()=>{room=royale.createRoom({id:1,username:'Sensor Tester',avatar:null,platform:'tablet'},{capacity:2,mode:'deathmatch'});socket.join(room.id);socket.emit('royale:room_state',royale.getPublicRoomState(room));(royale as any).launchGamePlay(room);});
 socket.on('royale:input',data=>{if(room)royale.processPlayerInput(room.id,1,data);});
 socket.on('disconnect',()=>{if(room)royale.leaveRoom(room.id,1);});
});
await vite.listen();
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors:string[]=[];
async function sample(page:Page,alpha:number,beta=60,gamma=0){await page.evaluate(({alpha,beta,gamma})=>{const e=new Event('deviceorientation');Object.defineProperties(e,{alpha:{value:alpha},beta:{value:beta},gamma:{value:gamma}});window.dispatchEvent(e);},{alpha,beta,gamma});await page.waitForTimeout(30);}
try{
 for(const profile of [
  {name:'iPadOS desktop UA 1366',width:1366,height:1024,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18 Safari/605.1.15',platform:'MacIntel',ios:true,angle:90},
  {name:'Android tablet 1600',width:1600,height:900,ua:'Mozilla/5.0 (Linux; Android 14; SM-X900) AppleWebKit/537.36 Chrome/134.0 Safari/537.36',platform:'Linux armv8l',ios:false,angle:0},
  {name:'iPhone landscape',width:844,height:390,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',platform:'iPhone',ios:true,angle:270}
 ]){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:true,isMobile:true,userAgent:profile.ua});
  await context.addInitScript({content:`
   const profile=${JSON.stringify(profile)};
   Object.defineProperty(navigator,'platform',{get:function(){return profile.platform;}});Object.defineProperty(navigator,'maxTouchPoints',{get:function(){return 5;}});
   Object.defineProperty(screen.orientation,'angle',{configurable:true,get:function(){return profile.angle;}});
   window.permissionCalls=0;window.permissionDecision='granted';
   if(profile.ios){Object.defineProperty(DeviceOrientationEvent,'requestPermission',{configurable:true,value:function(){window.permissionCalls++;return Promise.resolve(window.permissionDecision);}});Object.defineProperty(HTMLCanvasElement.prototype,'requestPointerLock',{configurable:true,value:undefined});}
   const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);const sensors=new Set();window.sensors=sensors;
   window.addEventListener=function(type,fn,options){if(type==='deviceorientation')sensors.add(fn);return add(type,fn,options);};
   window.removeEventListener=function(type,fn,options){if(type==='deviceorientation')sensors.delete(fn);return remove(type,fn,options);};
  `});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(profile.name+': '+e.message));
  await page.goto('http://127.0.0.1:4199/__mobile');
  await page.getByRole('button',{name:'Mobil Kontroller / Jiroskop',exact:true}).click();
  assert.equal(await page.getByLabel('Kontrol düzeni',{exact:true}).inputValue(),'auto');
  if(profile.ios){await page.evaluate(()=>(window as any).permissionDecision='denied');await page.getByRole('button',{name:'Jiroskobu etkinleştir / izin ver',exact:true}).click();await page.locator('[data-gyro-status="denied"]').waitFor({timeout:3000}).catch(async e=>{console.log('GYRO DIAGNOSTIC',await page.evaluate(()=>({secure:isSecureContext,calls:(window as any).permissionCalls,decision:(window as any).permissionDecision,request:typeof (DeviceOrientationEvent as any).requestPermission,statuses:[...document.querySelectorAll('[data-gyro-status]')].map(e=>({status:e.getAttribute('data-gyro-status'),text:e.textContent})),settings:localStorage.getItem('kapsstrike-settings')})));throw e;});assert.equal(await page.getByLabel('Jiroskop modu',{exact:true}).inputValue(),'off');await page.evaluate(()=>(window as any).permissionDecision='granted');}
  await page.getByRole('button',{name:'Jiroskobu etkinleştir / izin ver',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('kapsstrike-settings')!).gyroMode==='always');
  await sample(page,0);await page.locator('[data-gyro-status="active"]').waitFor();
  await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();
  await page.getByRole('button',{name:/Tek Oyunculu Antrenman/}).click();await page.getByRole('button',{name:'Antrenmanı Başlat',exact:true}).click();
  await page.waitForFunction(()=>(window as any).strike?.active&&(window as any).strike?.isTouchDevice);
  await page.locator('.ks-touch-overlay').waitFor();
  const cdp=await context.newCDPSession(page);
  const joystick=await page.locator('.ks-touch-joystick-zone').boundingBox();assert.ok(joystick);
  const moveBefore=await page.evaluate(()=>(window as any).strike.state.player.movement.position.z);
  const jx=joystick.x+joystick.width/2,jy=joystick.y+joystick.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jx,y:jy,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:jx,y:jy-44,id:1}]});await page.waitForTimeout(220);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await page.evaluate(()=>(window as any).strike.state.player.movement.position.z)>moveBefore,'visible joystick moves player');
  const look=await page.locator('.ks-touch-look-zone').boundingBox();assert.ok(look);const lx=look.x+look.width*.35,ly=look.y+look.height*.4;
  const lookBefore=await page.evaluate(()=>(window as any).strike.yaw);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:lx,y:ly,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:lx+30,y:ly,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(Math.abs(await page.evaluate(()=>(window as any).strike.yaw)-lookBefore)>.05,'touch drag aims');
  const fire=await page.locator('.ks-touch-btn-fire-main').boundingBox();assert.ok(fire);const ammo=await page.evaluate(()=>(window as any).strike.state.player.weapon.ammo.rifle);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:fire.x+fire.width/2,y:fire.y+fire.height/2,id:3}]});await page.waitForTimeout(160);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  assert.ok(await page.evaluate(()=>(window as any).strike.state.player.weapon.ammo.rifle)<ammo,'touch fire');assert.equal(await page.evaluate(()=>(window as any).strike.touchFire),false,'touch cancellation releases fire');
  const before=await page.evaluate(()=>(window as any).strike.yaw);await sample(page,0);await sample(page,10);
  const first=await page.evaluate(()=>(window as any).strike.yaw);assert.ok(Math.abs(first-before)>.1&&Math.abs(first-before)<.25,'gyro radian gain once');
  await page.getByTitle('Ayarlar & Duraklat',{exact:true}).click();
  await page.getByRole('button',{name:/Mobil Kontroller \/ Jiroskop/}).click();
  await page.getByLabel('Jiroskop hassasiyeti',{exact:true}).fill('2');
  const paused=await page.evaluate(()=>(window as any).strike.yaw);await sample(page,20);assert.equal(await page.evaluate(()=>(window as any).strike.yaw),paused);
  if(await page.getByRole('button',{name:'Paneli kapat',exact:true}).count())await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();await page.getByRole('button',{name:/Oyuna Devam Et/}).click();await sample(page,0);await sample(page,10);
  const second=await page.evaluate(()=>(window as any).strike.yaw);assert.ok(Math.abs(Math.abs(second-paused)-2*Math.abs(first-before))<.02,'live sensitivity update');
  await page.getByTitle('Ayarlar & Duraklat',{exact:true}).click();await page.getByRole('button',{name:/Mobil Kontroller \/ Jiroskop/}).click();await page.getByLabel('Jiroskop modu',{exact:true}).selectOption('ads');
  if(await page.getByRole('button',{name:'Paneli kapat',exact:true}).count())await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();await page.getByRole('button',{name:/Oyuna Devam Et/}).click();const adsBefore=await page.evaluate(()=>(window as any).strike.yaw);await sample(page,0);await sample(page,10);assert.equal(await page.evaluate(()=>(window as any).strike.yaw),adsBefore);
  await page.evaluate(()=>(window as any).strike.setTouchAds(true));await sample(page,20);assert.ok(Math.abs(await page.evaluate(()=>(window as any).strike.yaw)-adsBefore)>.1);
  await page.getByTitle('Ayarlar & Duraklat',{exact:true}).click();await page.getByRole('button',{name:/Mobil Kontroller \/ Jiroskop/}).click();await page.getByLabel('Kontrol düzeni',{exact:true}).selectOption('keyboard');if(await page.getByRole('button',{name:'Paneli kapat',exact:true}).count())await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();await page.getByRole('button',{name:/Oyuna Devam Et/}).click();
  assert.equal(await page.locator('.ks-touch-overlay').count(),0);
  const origin=await page.evaluate(()=>({...((window as any).strike.state.player.movement.position)}));await page.keyboard.down('KeyW');try{await page.waitForFunction(p=>{const now=(window as any).strike.state.player.movement.position;return Math.hypot(now.x-p.x,now.z-p.z)>.08;},origin,{timeout:3000});}finally{await page.keyboard.up('KeyW');}
  await page.getByTitle('Ayarlar & Duraklat',{exact:true}).click();await page.getByRole('button',{name:/Mobil Kontroller \/ Jiroskop/}).click();await page.getByLabel('Kontrol düzeni',{exact:true}).selectOption('touch');if(await page.getByRole('button',{name:'Paneli kapat',exact:true}).count())await page.getByRole('button',{name:'Paneli kapat',exact:true}).click();await page.getByRole('button',{name:/Oyuna Devam Et/}).click();await page.locator('.ks-touch-overlay').waitFor();
  await page.getByTitle('Ayarlar & Duraklat',{exact:true}).click();await page.getByRole('button',{name:/Menüye \/ Lobiye Dön/}).click();await page.getByRole('button',{name:'Oyundan çık',exact:true}).click();
  await page.waitForFunction(()=>(window as any).exited);assert.equal(await page.evaluate(()=>(window as any).sensors.size),0);assert.equal(await page.evaluate(()=>(window as any).engineStore.Instances.length),0);
  await page.close();await context.close();console.log('PASS production KapsStrike tablet + gyro + permission + mode switch + cleanup',profile.name);
 }
 // Royale uses the same permission/tracker and receives real manager state over Socket.IO.
 const context=await browser.newContext({viewport:{width:1366,height:1024},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18 Safari/605.1.15'});
 await context.addInitScript({content:"Object.defineProperty(navigator,'platform',{get:function(){return 'MacIntel';}});Object.defineProperty(navigator,'maxTouchPoints',{get:function(){return 5;}});Object.defineProperty(DeviceOrientationEvent,'requestPermission',{configurable:true,value:function(){return Promise.resolve('granted');}});localStorage.setItem('kaps_br_control_mode','desktop');localStorage.setItem('kaps_br_gyro_enabled','true');"});
 const page=await context.newPage();page.on('pageerror',e=>errors.push('Royale: '+e.message));await page.goto('http://127.0.0.1:4199/__mobile?game=royale');await page.getByRole('button',{name:'Fixture match',exact:true}).click();
 await page.getByTitle('Jiroskop ve Kontrol Ayarları',{exact:true}).click();
 await page.getByRole('button',{name:/iOS Safari Sensör İznini Etkinleştir/}).click();await sample(page,0);await page.locator('[data-gyro-status="active"]').waitFor();
 await page.getByRole('button',{name:'Jiroskop ayarlarını kapat',exact:true}).click();
 await page.waitForFunction(()=>(window as any).packets.some((p:any)=>p.platform==='tablet'));
 const angle=await page.evaluate(()=>(window as any).packets.at(-1).angle);await sample(page,0);await sample(page,10);
 await page.waitForFunction(angle=>Math.abs((window as any).packets.at(-1).angle-angle)>.1,angle);
 await page.getByRole('button',{name:'Klavye',exact:true}).click();await page.waitForFunction(()=>(window as any).packets.at(-1).platform==='pc');
 assert.equal(await page.evaluate(()=>localStorage.getItem('kaps_br_control_mode_v2')),'desktop');
 await context.close();console.log('PASS Royale iPad default touch despite old desktop preference, iOS grant, sensor-to-input angle and explicit keyboard switch');
 assert.deepEqual(errors,[]);
}finally{await browser.close();for(const room of royale.rooms.values()){clearInterval(room.gameLoopInterval);clearInterval(room.countdownTimer);}await new Promise<void>(resolve=>io.close(()=>resolve()));await vite.close();}
