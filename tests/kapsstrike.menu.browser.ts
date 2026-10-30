import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
const server = await createServer({
  cacheDir: "node_modules/.vite-kapsstrike-menu",
  logLevel: "error",
  plugins: [
    {
      name: "strike-menu",
      configureServer(s) {
        s.middlewares.use("/__strike-menu", async (req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__strike-menu",
              '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4192, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: any,
        ...args: any[]
      ) {
        if (String(kind).startsWith("webgl")) return null;
        return (original as any).call(this, kind, ...args);
      } as any;
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4192/__strike-menu");
    await page
      .getByText("Bu oyun WebGL destekli", { exact: false })
      .waitFor();
    await page.getByRole("button", { name: "Karakterini seç", exact: true }).click();
    await page.getByRole("heading", { name: "Karakter / Skin", exact: true }).waitFor();
    await page.getByRole("button", { name: "Paneli kapat", exact: true }).click();
    await page.getByRole("button", { name: "Kontrolleri düzenle", exact: true }).click();
    await page.getByRole("heading", { name: "Kontroller", exact: true }).waitFor();
    await page.getByRole("button", { name: "Paneli kapat", exact: true }).click();
    await page.getByRole("button", { name: /Tek Oyunculu Antrenman/ }).click();
    assert.ok(
      await page
        .getByRole("button", { name: "Antrenmanı Başlat", exact: true })
        .isDisabled(),
    );
    await page
      .getByRole("button", { name: "Neon City", exact: false })
      .click();
    await page.getByRole("button", { name: "Ayarlar", exact: true }).click();
    await page.getByLabel(/Grafik Kalitesi/).selectOption("high");
    await page.getByLabel("FOV", { exact: false }).fill("105");
    assert.equal(
      await page.getByLabel("FOV", { exact: false }).inputValue(),
      "105",
    );
    await page.getByRole("button", { name: "Paneli kapat", exact: true }).click();
    await page.getByRole("button", { name: "Kontroller", exact: true }).click();
    await page.getByRole("heading", { name: "Kontroller" }).waitFor();
    await page.getByRole("button", { name: "Paneli kapat", exact: true }).click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: `/tmp/kapsstrike-menu-${width}.png`,
      fullPage: true,
    });
    assert.equal(errors.length, 0, errors.join(";"));
    await context.close();
    console.log(
      "PASS menu/settings/controls/unsupported-WebGL layout",
      width,
      height,
    );
  }
} finally {
  await browser.close();
  await server.close();
}
