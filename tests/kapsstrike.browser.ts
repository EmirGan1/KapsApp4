import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const server = await createServer({
  logLevel: "error",
  plugins: [
    {
      name: "strike-test",
      configureServer(s) {
        s.middlewares.use("/__strike", async (req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__strike",
              '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4191, strictPort: true },
});
await server.listen();
const useNull =
  process.env.STRIKE_NULL_ENGINE === "1" || process.argv.includes("--null");
const browser = await chromium.launch({
  headless: true,
  args: useNull
    ? ["--autoplay-policy=no-user-gesture-required"]
    : [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--autoplay-policy=no-user-gesture-required",
      ],
});
const failures: string[] = [];
try {
  for (const map of ["warehouse", "dust", "neon"]) {
    const page = await browser.newPage({
      viewport: { width: 960, height: 600 },
    });
    page.on("console", (m) => {
      if (m.text().startsWith("STRIKE") || m.type() === "error")
        console.log("BROWSER", m.text());
    });
    page.on("pageerror", (e) => {
      failures.push(e.message);
      console.log("PAGE ERROR", e.message);
    });
    await page.goto(
      `http://127.0.0.1:4191/__strike?mode=engine&map=${map}${useNull ? "&renderer=null" : ""}`,
    );
    await page.getByRole("button", { name: "Start test" }).click();
    await page.waitForFunction(
      () => !!(window as any).strike && document.pointerLockElement !== null,
    );
    // Sync automation's absolute cursor with the native locked cursor before relative input.
    await page.mouse.move(480, 300);
    await page.waitForTimeout(600);
    const start = await page.evaluate(
      () => (window as any).strike.state.player.movement.position.z,
    );
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyW");
    assert.ok(
      await page.evaluate(
        (start) =>
          (window as any).strike.state.player.movement.position.z > start,
        start,
      ),
    );
    await page.mouse.down({ button: "right" });
    await page.mouse.down();
    await page.waitForTimeout(100);
    // Headless pointer lock reports absolute protocol warps. Aim through the real
    // relative-input handler; leave ammo, hitboxes, damage and cadence untouched.
    await page.evaluate(() => {
      const c = (window as any).strike,
        p = c.state.player.movement.position,
        t = c.state.targets[0].position;
      const reset = new MouseEvent("mousemove");
      Object.defineProperties(reset, {
        movementX: { value: 0 },
        movementY: { value: 0 },
      });
      window.dispatchEvent(reset);
      const yaw = Math.atan2(t.x - p.x, t.z - p.z),
        pitch = Math.atan2(
          p.y + 1.62 - (t.y + 0.9),
          Math.hypot(t.x - p.x, t.z - p.z),
        );
      const dx = (yaw - c.yaw) / (0.002 * c.settings.sensitivity),
        dy = (pitch - c.pitch) / (0.002 * c.settings.sensitivity);
      const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 150),
      );
      for (let i = 0; i < steps; i++) {
        const event = new MouseEvent("mousemove");
        Object.defineProperties(event, {
          movementX: { value: dx / steps },
          movementY: { value: dy / steps },
        });
        window.dispatchEvent(event);
      }
    });
    await page.waitForTimeout(650);
    await page.mouse.up();
    await page.mouse.up({ button: "right" });

    assert.ok(
      await page.evaluate(() => (window as any).strike.state.damage > 0),
    );
    assert.ok(
      await page.evaluate(() => (window as any).strike.state.score >= 1),
    );
    assert.ok(
      await page.evaluate(
        () => (window as any).strike.state.player.weapon.ammo.rifle < 30,
      ),
    );
    await page.keyboard.press("KeyR");
    await page.waitForFunction(
      () => (window as any).strike.state.player.weapon.ammo.rifle === 30,
      undefined,
      { timeout: 15000 },
    );
    assert.equal(
      await page.evaluate(
        () => (window as any).strike.state.player.weapon.ammo.rifle,
      ),
      30,
    );
    await page.keyboard.press("Digit3");
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(
        () => (window as any).strike.state.player.weapon.selected,
      ),
      "sniper",
    );
    await page.mouse.down({ button: "right" });
    await page.waitForTimeout(300);
    await page.mouse.up({ button: "right" });
    // A reproducible damage situation tests the actual production death/respawn path.
    await page.evaluate(() => {
      const s = (window as any).strike.state;
      s.player.protectedUntil = 0;
      s.player.movement.position = { x: -21, y: 0, z: 27 };
      s.player.hp = 12;
    });
    await page.waitForFunction(
      () => (window as any).strike.state.player.hp === 0,
    );
    await page.waitForFunction(
      () => (window as any).strike.state.player.hp === 100,
    );
    if (!useNull) await page.screenshot({ path: `/tmp/kapsstrike-${map}.png` });
    const stats = await page.evaluate(() =>
      (window as any).strike.renderer.stats(),
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    const tick = await page.evaluate(() => (window as any).strike.state.tick);
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(() => (window as any).strike.state.tick),
      tick,
    );
    const result = await page.evaluate(() => {
      const c = (window as any).strike;
      c.dispose();
      c.dispose();
      return {
        disposed: c.renderer.engine.isDisposed,
        locked: document.pointerLockElement !== null,
        scenes: c.renderer.engine.scenes.length,
      };
    });
    assert.ok(result.disposed);
    assert.equal(result.locked, false);
    assert.equal(result.scenes, 0);
    console.log(
      "PASS map + controls + weapon + reload + ADS + death/respawn + pause/disposal",
      map,
      JSON.stringify(
        useNull
          ? {
              ...stats,
              fps: undefined,
              drawCalls: undefined,
              renderer: "NullEngine",
            }
          : stats,
      ),
    );
    await page.close();
  }
  if (!useNull) {
    const high = await browser.newPage({
      viewport: { width: 960, height: 600 },
    });
    high.on("pageerror", (e) => failures.push(e.message));
    await high.goto(
      "http://127.0.0.1:4191/__strike?mode=engine&map=neon&quality=high",
    );
    await high.getByRole("button", { name: "Start test" }).click();
    await high.waitForFunction(
      () =>
        (window as any).hud?.tick > 30 &&
        (window as any).strike.renderer.scene.isReady(),
    );
    assert.ok(
      await high.evaluate(
        () => (window as any).strike.renderer.stats().drawCalls > 0,
      ),
    );
    await high.screenshot({ path: "/tmp/kapsstrike-high.png" });
    await high.evaluate(() => (window as any).strike.dispose());
    await high.close();
    console.log("PASS actual WebGL High profile with shadows");
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    page.on("console", (m) => {
      if (m.text().startsWith("STRIKE") || m.type() === "error")
        console.log("BROWSER", m.text());
    });
    page.on("pageerror", (e) => {
      failures.push(e.message);
      console.log("PAGE ERROR", e.message);
    });
    await page.goto("http://127.0.0.1:4191/__strike");
    await page.getByRole("button", { name: "Ayarlar", exact: true }).click();
    await page.getByLabel(/Grafik Kalitesi/).selectOption("medium");
    await page.getByRole("button", { name: "Kaydet ve Dön", exact: true }).click();
    await page.getByRole("button", { name: /Tek Oyunculu Antrenman/ }).click();
    await page
      .getByRole("button", { name: "Antrenmanı Başlat", exact: true })
      .click();
    await page.waitForFunction(() => document.pointerLockElement !== null);
    await page.waitForSelector(".ks-hud");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "/tmp/kapsstrike-ui.png" });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Menüye dön", exact: true }).click();
    await page
      .getByRole("button", { name: "Oyundan çık", exact: true })
      .click();
    assert.equal(await page.locator(".ks-root").count(), 0);
    assert.equal(failures.length, 0, failures.join("\n"));
    console.log(
      "PASS actual React menu, settings, HUD, exit; zero page errors",
    );
    await page.close();
  } else {
    assert.equal(failures.length, 0, failures.join("\n"));
    console.log(
      "Controller browser tests used NullEngine; no WebGL pixels or real GPU FPS verified.",
    );
  }
} finally {
  await browser.close();
  await server.close();
}
