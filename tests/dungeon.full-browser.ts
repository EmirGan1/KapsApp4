import { createServer } from "vite";
import { Server } from "socket.io";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { DungeonManager } from "../src/server/dungeonServer";
import { pilot } from "./dungeon.pilot";
const server = await createServer({
  logLevel: "error",
  plugins: [
    {
      name: "dungeon-full-test",
      configureServer(s) {
        s.middlewares.use("/__dungeon-full", async (req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__dungeon-full",
              '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/dungeon.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4183, strictPort: true },
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
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
const a = await context.newPage(),
  b = await context.newPage();
try {
  await a.goto("http://127.0.0.1:4183/__dungeon-full?user=1");
  await b.goto("http://127.0.0.1:4183/__dungeon-full?user=2");
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
  const room = manager.rooms.get(code)!;
  const start = performance.now();
  let prev = 0;
  // Test controllers send legal input through each real browser's own Socket.IO session.
  // The production 10 Hz server, rate limits, health and damage rules are unchanged.
  while (room.run!.status === "playing" && performance.now() - start < 600000) {
    const r = room.run!;
    for (const [page, id] of [
      [a, 1],
      [b, 2],
    ] as const) {
      const p = r.players.find((p) => p.id === id)!;
      const commands = pilot(r, id).map((intent, i) => ({
        ...intent,
        seq: p.seq + i + 1,
        floor: r.depth,
      }));
      if (commands.length)
        await page.evaluate(async (commands) => {
          for (const cmd of commands)
            await new Promise((resolve) =>
              (window as any).dungeonSocket.emit("dungeon:input", cmd, resolve),
            );
        }, commands);
    }
    if (r.depth !== prev) {
      console.log("Entered floor", r.depth, "seed", r.seed, "tick", r.tick);
      prev = r.depth;
    }
    await a.waitForTimeout(105);
  }
  assert.equal(
    room.run!.status,
    "won",
    JSON.stringify({
      status: room.run!.status,
      seed: room.run!.seed,
      depth: room.run!.depth,
      tick: room.run!.tick,
    }),
  );
  await a.getByRole("heading", { name: "Karanlık geride kaldı." }).waitFor();
  await b.getByRole("heading", { name: "Karanlık geride kaldı." }).waitFor();
  await a.screenshot({ path: "/tmp/dungeon-victory.png" });
  console.log(
    JSON.stringify({
      result: "PASS two real browser sessions complete expedition",
      seed: room.run!.seed,
      ticks: room.run!.tick,
      kills: room.run!.kills,
      wallSeconds: (performance.now() - start) / 1000,
    }),
  );
} finally {
  await browser.close();
  manager.destroy();
  io.close();
  await server.close();
}
