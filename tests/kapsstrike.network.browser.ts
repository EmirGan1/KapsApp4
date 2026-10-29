import { createServer } from "vite";
import { Server } from "socket.io";
import { SKINS } from "../src/games/kapsstrike/skins";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
const vite = await createServer({
  cacheDir: "node_modules/.vite-kapsstrike-network", logLevel: "error", plugins: [{ name: "strike-network-fixture", configureServer(s) {
  s.middlewares.use("/__strike_network", async (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(await s.transformIndexHtml("/__strike_network", '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.network.fixture.tsx"></script></body></html>'));
  });
}}], server: { host: "127.0.0.1", port: 4195, strictPort: true } });
const io = new Server(vite.httpServer!);
const db = createClient({url:'file::memory:'});
await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY,strike_kills INTEGER,strike_deaths INTEGER,strike_wins INTEGER,strike_matches INTEGER,strike_headshots INTEGER)');
await db.execute('INSERT INTO users (id) VALUES (1),(2)');
const manager = new KapsStrikeServerManager(io,db);
// Fixture identities only. Production continues using KapsApp's authenticated socket middleware.
io.on("connection", socket => {const id=Number(socket.handshake.auth.testUser);manager.register(socket, { id, username: `Tester ${id}` });socket.on("disconnect",()=>manager.handleDisconnect(socket,id));});
await vite.listen();
const browser = await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const errors: string[] = [];
try {
  const a = await browser.newPage({viewport:{width:960,height:600}});
  const mobile = await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const b = await mobile.newPage();
  for (const p of [a,b]) { p.on("pageerror", e => errors.push(e.message)); p.on('console', m=> {if(m.type()==='error') { errors.push(m.text()); console.log(m.text()); }}); }
  await Promise.all([a.goto("http://127.0.0.1:4195/__strike_network?user=1"),b.goto("http://127.0.0.1:4195/__strike_network?user=2")]);
  await a.getByRole("button",{name:"Karakter / Skin",exact:true}).click();
  for (const name of ['Classic Soldier','Urban Runner','Neon Striker','Shadow Operative','Desert Scout','Arctic Fighter','Cyber Agent','Street Warrior']) {
    await a.getByRole('button',{name,exact:true}).click();
    await a.getByLabel(`${name} 3D karakter önizleme`,{exact:true}).waitFor();
    const expected=Object.values(SKINS).find(s=>s.name===name)!.body.toUpperCase();
    await a.waitForFunction(color => (window as any).engineStore.Instances[0]?.scenes[0]?.getMeshByName('preview-body')?.material.diffuseColor.toHexString() === color,expected);
    assert.equal(await a.evaluate(()=>(window as any).engineStore.Instances.length),1);

  }
  await a.getByRole('button',{name:'Cyber Agent',exact:true}).click();
  await a.getByRole('button',{name:'Karakteri Kaydet',exact:true}).click();
  await a.getByText('Karakter hesabına kaydedildi.',{exact:true}).waitFor();
  assert.equal(await manager.profiles.get(1),'cyber');
  const preview=a.getByLabel('Cyber Agent 3D karakter önizleme',{exact:true});
  const box=await preview.boundingBox();assert.ok(box);
  const angle=await a.evaluate(()=>(window as any).engineStore.Instances[0].scenes[0].getTransformNodeByName('character-preview').rotation.y);
  await a.mouse.move(box.x+box.width/2,box.y+box.height/2);await a.mouse.down();await a.mouse.move(box.x+box.width/2+80,box.y+box.height/2);await a.mouse.up();
  assert.ok(await a.evaluate(angle=>(window as any).engineStore.Instances[0].scenes[0].getTransformNodeByName('character-preview').rotation.y>angle,angle));
  await a.screenshot({path:"/tmp/strike-skins-preview.png"});
  await a.getByRole("button",{name:"Kontroller",exact:true}).click();
  assert.equal(await a.evaluate(()=>(window as any).engineStore.Instances.length),0,"Preview engine disposed when panel closes");
  await a.getByRole("button",{name:"İleri tuşunu değiştir",exact:true}).click();
  await a.keyboard.press("KeyI");
  await a.getByRole("button",{name:"Ateş tuşunu değiştir",exact:true}).click();
  await a.keyboard.press("KeyF");
  await a.getByRole("button",{name:"ADS / ağır bıçak tuşunu değiştir",exact:true}).click();
  await a.keyboard.press("KeyG");
  await a.getByRole("button",{name:"Zıpla tuşunu değiştir",exact:true}).click();
  await a.keyboard.press("KeyI");
  await a.getByRole('alert').filter({hasText:'çakışıyor'}).waitFor();
  await a.getByRole('button',{name:'İptal',exact:true}).click();
  await a.getByRole("button",{name:"Geri",exact:true}).click();
  assert.equal(await a.evaluate(()=>JSON.parse(localStorage.getItem('kapsstrike-settings')!).bindings.forward),'KeyI');
  await a.getByRole("button",{name:"+ Oda Oluştur",exact:true}).click();
  await a.getByLabel("Oyun Modu").selectOption("ffa");
  await a.getByLabel(/^Harita/).selectOption(process.env.STRIKE_TEST_MAP || "warehouse");
  await a.getByRole("button",{name:"Odayı Oluştur",exact:true}).click();
  await a.locator('.ks-lobby-code').waitFor();
  const code=(await a.locator('.ks-lobby-code').textContent())!.trim();
  await b.getByPlaceholder('Oda kodu',{exact:true}).fill(code);
  await b.getByRole('button',{name:'Koda Katıl',exact:true}).click();
  await a.getByRole('button',{name:'Karakter / Skin',exact:true}).click();
  await a.getByRole('heading',{name:'Karakter / Skin',exact:true}).waitFor();
  await a.getByRole('button',{name:'Lobiye dön',exact:true}).click();
  await a.getByRole('button',{name:'Kontroller',exact:true}).click();
  await a.getByRole('heading',{name:'Kontroller',exact:true}).waitFor();
  await a.getByRole('button',{name:'Lobiye dön',exact:true}).click();
  await b.getByRole("button",{name:"HAZIR OL",exact:true}).click();
  await a.getByRole("button",{name:/MAÇI BAŞLAT/i}).click();
  for (const p of [a,b]) await p.waitForFunction(() => (window as any).strike?.remotePlayerList.length === 2);
  for (const p of [a,b]) assert.equal(await p.evaluate(() => (window as any).controllers.length),1,"Only one controller per match");
  await a.getByRole("button",{name:"Oyuna dön",exact:true}).click();
  await a.waitForFunction(() => document.pointerLockElement !== null);
  await b.waitForFunction(() => (window as any).strike?.active === true);
  await a.waitForTimeout(500);
  await b.waitForFunction(() => [...(window as any).strike.renderer.remotePlayerMeshes.values()].some((p:any)=>p.skin==='cyber'));
  assert.equal(await b.evaluate(() => (window as any).strike.renderer.scene.getMeshesById('preview-body').length),0);

  for (const p of [a,b]) {
    assert.equal(await p.evaluate(()=>(window as any).strike.renderer.scene.isReady()),true);
    assert.equal(await p.evaluate(()=>(window as any).strike.state.map),process.env.STRIKE_TEST_MAP || "warehouse");
    assert.equal(await p.evaluate(() => (window as any).controllers.length),1,"Only one controller per match");
    assert.ok(await p.evaluate(() => (window as any).strike.renderer.scene.getMeshByName('remote-body-'+(window as any).strike.remotePlayerList.find((x:any)=>x.id !== (window as any).socket.id).id)));
  }
  await a.keyboard.down("KeyI");
  await b.evaluate(() => (window as any).strike.setTouchMovement(1,0));
  const before = [...manager.rooms.values()][0];
  const pos = [...before.players.values()].map(p=>({...p.state.movement.position}));
  await a.waitForTimeout(500);
  await a.keyboard.up("KeyI");
  await b.evaluate(() => (window as any).strike.setTouchMovement(0,0));
  [...before.players.values()].forEach((p,i)=>assert.ok(Math.hypot(p.state.movement.position.x-pos[i].x,p.state.movement.position.z-pos[i].z)>.1));
  // Deterministic server-side setup of a clear firing lane; actual inputs,
  // raycasts, damage, ammo, deaths, respawn and score use production code.
  const players = [...before.players.values()];
  for (let i=0;i<2;i++) {
    players[i].state.movement.position = {x:0,y:0,z:i===0?-28:-18};
    players[i].state.movement.velocity = {x:0,y:0,z:0};
    players[i].state.protectedUntil = 0;
    players[i].history = [];
    players[i].inputQueue = [];
  }
  await a.waitForTimeout(300);
  await a.evaluate(() => { const c=(window as any).strike; c.yaw=0; c.pitch=.01; });
  await a.keyboard.down("KeyF");
  await b.waitForFunction(() => (window as any).strike.state.player.hp <= 0);
  await a.keyboard.up("KeyF");
  assert.equal(players[0].kills,1);
  assert.equal(players[1].deaths,1);
  assert.ok(await a.evaluate(() => (window as any).strike.lastHit));
  assert.equal(await b.evaluate(() => (window as any).strike.lastHit),undefined,"Victim must not receive shooter's hitmarker");
  await b.waitForFunction(() => (window as any).strike.state.player.hp === 100,{},{timeout:10000});
  assert.ok(players[1].state.protectedUntil > before.tick);
  // Six-slot wheel cycling, debounce, keyboard slot and actual server melee.
  await a.keyboard.press("Digit6");
  await a.waitForFunction(() => (window as any).strike.state.player.weapon.selected === 'knife');
  await a.evaluate(() => { const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new WheelEvent("wheel",{deltaY:100,cancelable:true}));
    canvas.dispatchEvent(new WheelEvent("wheel",{deltaY:100,cancelable:true}));
  });
  await a.waitForFunction(() => (window as any).strike.state.player.weapon.selected === "rifle");
  await a.waitForTimeout(200);
  assert.equal(await a.evaluate(()=>(window as any).strike.state.player.weapon.selected),'rifle');
  await a.keyboard.press("Digit6");
  await a.waitForTimeout(300);
  for(let i=0;i<2;i++) {players[i].state.movement.position={x:0,y:0,z:i===0?-28:-26.3};players[i].state.movement.velocity={x:0,y:0,z:0};players[i].state.protectedUntil=0;players[i].history=[];players[i].inputQueue=[];}
  await a.waitForTimeout(300);
  await a.evaluate(() => { const c=(window as any).strike;c.yaw=0;c.pitch=0; });
  await a.keyboard.down('KeyF');
  await b.waitForFunction(()=>(window as any).strike.state.player.hp < 100);
  await a.keyboard.up('KeyF');
  assert.equal(players[1].state.hp,60);
  await a.waitForTimeout(600);
  await a.keyboard.down('KeyG');
  await b.waitForFunction(()=>(window as any).strike.state.player.hp===0);
  await a.keyboard.up('KeyG');
  assert.equal(players[0].kills,2);
  await a.keyboard.down('Tab');
  await a.locator('.ks-score-table tr').filter({hasText:'Tester 1'}).getByText('2 / 0',{exact:true}).waitFor();
  await a.keyboard.up('Tab');
  for(const p of [a,b]) assert.equal(await p.evaluate(()=>(window as any).microphoneRequests),0,"No automatic microphone access");
  assert.deepEqual(errors,[]);
  await a.keyboard.press("Escape");
  await a.getByRole("button",{name:"Oyuna dön",exact:true}).waitFor();
  await a.getByRole("button",{name:"Kontroller",exact:true}).click();
  await a.getByRole("button",{name:"Zıpla tuşunu değiştir",exact:true}).click();await a.keyboard.press('KeyJ');
  await a.waitForFunction(()=>(window as any).strike.bindings.jump==='KeyJ');
  await a.getByRole('button',{name:'Oyuna dön',exact:true}).click();
  await a.keyboard.down('KeyJ');await a.waitForFunction(()=>(window as any).strike.state.player.movement.position.y>.1);
  await a.keyboard.up('KeyJ');await a.waitForTimeout(100);assert.ok(players[0].state.movement.position.y>.1);
  await a.keyboard.press('Escape');
  await a.getByRole("button",{name:"Menüye dön",exact:true}).click();
  assert.equal(await a.evaluate(()=>(window as any).strike.disposed),true);
  await a.waitForTimeout(100);assert.equal(before.players.size,1);
  await b.close();await a.waitForTimeout(100);assert.equal(manager.rooms.size,0);
  console.log("PASS: desktop + touch browser, real Socket.IO room create/join/start, one engine, remote meshes, authoritative movement/combat/death/score/respawn, ESC and cleanup");
} finally {
  for (const room of manager.rooms.values()) manager.stopRoomSimulationLoop(room);
  await browser.close(); await new Promise<void>(resolve=>io.close(()=>resolve())); await vite.close(); db.close();
}
