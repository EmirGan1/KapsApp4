import { createServer } from "vite";
import { Server } from "socket.io";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
const vite = await createServer({ logLevel: "error", plugins: [{ name: "strike-network-fixture", configureServer(s) {
  s.middlewares.use("/__strike_network", async (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(await s.transformIndexHtml("/__strike_network", '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.network.fixture.tsx"></script></body></html>'));
  });
}}], server: { host: "127.0.0.1", port: 4195, strictPort: true } });
const io = new Server(vite.httpServer!);
const manager = new KapsStrikeServerManager(io);
// Fixture identities only. Production continues using KapsApp's authenticated socket middleware.
io.on("connection", socket => manager.register(socket, { id: Number(socket.handshake.auth.testUser), username: `Tester ${socket.handshake.auth.testUser}` }));
await vite.listen();
const browser = await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const errors: string[] = [];
try {
  const a = await browser.newPage({viewport:{width:960,height:600}});
  const mobile = await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const b = await mobile.newPage();
  for (const p of [a,b]) { p.on("pageerror", e => errors.push(e.message)); p.on('console', m=> {if(m.type()==='error') { errors.push(m.text()); console.log(m.text()); }}); }
  await Promise.all([a.goto("http://127.0.0.1:4195/__strike_network?user=1"),b.goto("http://127.0.0.1:4195/__strike_network?user=2")]);
  await a.getByRole("button",{name:"+ Oda Oluştur",exact:true}).click();
  await a.getByLabel("Oyun Modu").selectOption("ffa");
  await a.getByLabel(/^Harita/).selectOption(process.env.STRIKE_TEST_MAP || "warehouse");
  await a.getByRole("button",{name:"Odayı Oluştur",exact:true}).click();
  await a.locator('.ks-lobby-code').waitFor();
  await b.getByRole("button",{name:/Yenile/}).click();
  await b.getByRole("button",{name:"Katıl",exact:true}).click();
  await b.getByRole("button",{name:"HAZIR OL",exact:true}).click();
  await a.getByRole("button",{name:/MAÇI BAŞLAT/i}).click();
  for (const p of [a,b]) await p.waitForFunction(() => (window as any).strike?.remotePlayerList.length === 2);
  for (const p of [a,b]) assert.equal(await p.evaluate(() => (window as any).controllers.length),1,"Only one controller per match");
  await a.getByRole("button",{name:"Oyuna dön",exact:true}).click();
  await a.waitForFunction(() => document.pointerLockElement !== null);
  await b.waitForFunction(() => (window as any).strike?.active === true);
  await a.waitForTimeout(500);
  for (const p of [a,b]) {
    assert.equal(await p.evaluate(() => (window as any).controllers.length),1,"Only one controller per match");
    assert.ok(await p.evaluate(() => (window as any).strike.renderer.scene.getMeshByName('remote-body-'+(window as any).strike.remotePlayerList.find((x:any)=>x.id !== (window as any).socket.id).id)));
  }
  await a.keyboard.down("KeyW");
  await b.evaluate(() => (window as any).strike.setTouchMovement(1,0));
  const before = [...manager.rooms.values()][0];
  const pos = [...before.players.values()].map(p=>({...p.state.movement.position}));
  await a.waitForTimeout(500);
  await a.keyboard.up("KeyW");
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
  await a.evaluate(() => { const c=(window as any).strike; c.yaw=0; c.pitch=0; c.mouseFire=true; });
  await b.waitForFunction(() => (window as any).strike.state.player.hp <= 0);
  await a.evaluate(() => (window as any).strike.mouseFire=false);
  assert.equal(players[0].kills,1);
  assert.equal(players[1].deaths,1);
  assert.ok(await a.evaluate(() => (window as any).strike.lastHit));
  assert.equal(await b.evaluate(() => (window as any).strike.lastHit),undefined,"Victim must not receive shooter's hitmarker");
  await b.waitForFunction(() => (window as any).strike.state.player.hp === 100,{},{timeout:10000});
  assert.ok(players[1].state.protectedUntil > before.tick);
  assert.deepEqual(errors,[]);
  await a.keyboard.press("Escape");
  await a.getByRole("button",{name:"Oyuna dön",exact:true}).waitFor();
  await a.getByRole("button",{name:"Menüye dön",exact:true}).click();
  assert.equal(await a.evaluate(()=>(window as any).strike.disposed),true);
  console.log("PASS: desktop + touch browser, real Socket.IO room create/join/start, one engine, remote meshes, authoritative movement/combat/death/score/respawn, ESC and cleanup");
} finally {
  for (const room of manager.rooms.values()) manager.stopRoomSimulationLoop(room);
  await browser.close(); await new Promise<void>(resolve=>io.close(()=>resolve())); await vite.close();
}
