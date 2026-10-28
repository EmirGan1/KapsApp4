import { createServer } from "vite";
import { Server } from "socket.io";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { DungeonManager } from "../src/server/dungeonServer";
const server = await createServer({
  logLevel: "error",
  plugins: [
    {
      name: "dungeon-test",
      configureServer(s) {
        s.middlewares.use("/__dungeon-test", async (req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__dungeon-test",
              '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/dungeon.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4182, strictPort: true },
});
await server.listen();
const io = new Server(server.httpServer!),
  manager = new DungeonManager(io, null);
io.on("connection", (s) =>
  manager.register(s, {
    id: Number(s.handshake.auth.id),
    username: "Kaşif " + s.handshake.auth.id,
  }),
);
const browser = await chromium.launch({ headless: true });
let passes = 0;
try {
  for (const [width, height] of [
    [390, 844],
    [844, 390],
    [768, 1024],
    [1440, 900],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
    });
    const a = await context.newPage(),
      b = await context.newPage();
    const errors: string[] = [];
    a.on("pageerror", (e) => errors.push(e.message));
    b.on("pageerror", (e) => errors.push(e.message));
    await a.goto("http://127.0.0.1:4182/__dungeon-test?user=1");
    await b.goto("http://127.0.0.1:4182/__dungeon-test?user=2");
    await a.getByRole("button", { name: "Odayı oluştur" }).click();
    await a.locator(".ds-code").waitFor();
    const code = await a.locator(".ds-code").innerText();
    await b.getByLabel("Oda kodu", { exact: true }).fill(code);
    await b.getByRole("button", { name: "Kodla katıl" }).click();
    await b.getByRole("button", { name: "M · Büyücü", exact: false }).click();
    await b.getByRole("button", { name: "Hazırım", exact: true }).click();
    await a.getByRole("button", { name: "Hazırım", exact: true }).click();
    await a.getByRole("button", { name: "Seferi başlat", exact: true }).click();
    await a.locator("canvas").waitFor();
    await b.locator("canvas").waitFor();
    const room = manager.rooms.get(code)!;
    assert.equal(room.players.length, 2);
    const oldX = room.players[0].x;
    await a
      .getByRole("button", { name: "Sağa", exact: true })
      .dispatchEvent("pointerdown", { pointerId: 1 });
    await a.waitForTimeout(250);
    await a
      .getByRole("button", { name: "Sağa", exact: true })
      .dispatchEvent("pointerup", { pointerId: 1 });
    assert.ok(room.players[0].x > oldX);
    await b.waitForTimeout(150);
    assert.equal(await b.locator(".ds-party button").count(), 2);
    // Both browsers are genuinely connected; reconnect keeps the same authoritative entity.
    await a.evaluate(() => {
      (window as any).dungeonSocket.disconnect();
    });
    await a.locator(".ds-notice").waitFor();
    await a.evaluate(() => {
      (window as any).dungeonSocket.connect();
    });
    await a.waitForFunction(() => (window as any).dungeonSocket.connected);
    await a.waitForTimeout(150);
    assert.equal(room.players.filter((p) => p.id === 1).length, 1);
    assert.ok(room.players[0].connected);
    await a.getByRole("button", { name: "Nasıl oynanır" }).click();
    const panel = a.locator(".ds-panel");
    assert.ok(await panel.evaluate((el) => el.scrollHeight > el.clientHeight));
    await panel.evaluate((el) => (el.scrollTop = el.scrollHeight));
    assert.ok(await panel.evaluate((el) => el.scrollTop > 0));
    await a.getByRole("button", { name: "Kapat ×" }).click();
    assert.ok(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    assert.ok(
      await a
        .locator(".ds-controls")
        .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1),
      "All touch controls fit the viewport",
    );
    await a.locator("canvas").scrollIntoViewIfNeeded();
    await a.screenshot({
      path: `/tmp/dungeon-${width}x${height}.png`,
      fullPage: true,
    });
    assert.equal(errors.length, 0, errors.join(";"));
    await a.getByRole("button", { name: "Oyun ayarları" }).click();
    await a.getByRole("button", { name: "Odadan ayrıl" }).click();
    await b.getByRole("button", { name: "Oyun ayarları" }).click();
    await b.getByRole("button", { name: "Odadan ayrıl" }).click();
    await context.close();
    manager.rooms.clear();
    manager.membership.clear();
    passes++;
    console.log(
      "PASS two-client lobby, class, ready, start, movement, reconnect, modal scroll, viewport",
      width,
      height,
    );
  }
} finally {
  await browser.close();
  manager.destroy();
  io.close();
  await server.close();
}
console.log(`${passes} viewport pairs passed`);
