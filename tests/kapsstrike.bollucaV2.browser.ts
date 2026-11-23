import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const OUT_MIRAGE = ".playwright-cli/bollucav2-qa";
const OUT_DUST_AFTER = ".playwright-cli/dust2v2-after";
mkdirSync(OUT_MIRAGE, { recursive: true });
mkdirSync(OUT_DUST_AFTER, { recursive: true });

const vite = await createServer({
  cacheDir: "node_modules/.vite-strike-bollucav2-qa",
  logLevel: "error",
  plugins: [
    {
      name: "bollucav2-qa",
      configureServer(s) {
        s.middlewares.use("/__qa", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__qa",
              '<html><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4198, strictPort: true },
});

await vite.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.STRIKE_CHROMIUM ||
    "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const MIRAGE_HIGH_VIEWS: Record<string, [[number, number, number], [number, number, number]]> = {
  "a-site-palace": [[23.0, 4.62, -43.0], [21.5, 1.8, -28.0]],
  "a-ramp": [[35.5, 2.2, -31.5], [18.5, 2.2, -31.5]],
  "top-mid-window": [[16.5, 2.22, 5.2], [-28.0, 2.8, 4.2]],
  "window-mid": [[-27.5, 3.62, 4.0], [16.0, 1.6, 5.0]],
  "catwalk-underpass": [[-9.5, 3.2, 13.0], [-25.0, 2.0, 13.5]],
  "b-site-balcony": [[-38.5, 4.02, 32.3], [-36.5, 1.5, 21.0]],
  "b-site-market": [[-37.5, 1.8, 15.5], [-35.5, 1.6, 28.0]],
  "ct-spawn": [[-24.0, 1.8, -40.5], [10.0, 2.2, -39.5]],
  "connector-stairs": [[-2.0, 2.82, -13.5], [22.0, 2.0, -28.0]],
  "underpass": [[-17.0, 1.62, 16.0], [-17.0, 2.4, 34.0]],
};

const MIRAGE_MED_VIEWS: Record<string, [[number, number, number], [number, number, number]]> = {
  "a-site-palace": MIRAGE_HIGH_VIEWS["a-site-palace"],
  "top-mid-window": MIRAGE_HIGH_VIEWS["top-mid-window"],
  "b-site-balcony": MIRAGE_HIGH_VIEWS["b-site-balcony"],
};

const DUST_VIEWS: Record<string, [[number, number, number], [number, number, number]]> = {
  "t-spawn-mid": [[0, 4.42, -45], [0, 1.6, 20]],
  "a-long": [[43.5, 3.22, -12], [44.5, 3.8, 36]],
  "a-site": [[33.5, 4.82, 34.5], [40.5, 4.2, 44]],
  "upper-tunnels": [[-36.0, 4.02, -7.5], [-36.0, 4.5, 9]],
  "b-site": [[-41.5, 4.2, 31.5], [-31.0, 3.4, 41]],
  "ct-mid": [[-6.0, 1.62, 26.5], [-24.5, 3.2, 36.5]],
};

async function runCapture(
  mapId: string,
  quality: "medium" | "high",
  views: Record<string, [[number, number, number], [number, number, number]]>,
  outDir: string,
  prefix: string,
  captureOverhead = false,
) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  const failedUrls: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url().includes("/kapsstrike/")) {
      failedUrls.push(`${res.status()} ${res.url()}`);
    }
  });

  await page.goto(`http://127.0.0.1:4198/__qa?mode=engine&quality=${quality}&map=${mapId}`);
  await page.getByRole("button", { name: "Start test", exact: true }).dispatchEvent("click");
  await page.waitForFunction(
    () => (window as any).strike?.renderer.scene.isReady() && (window as any).strike?.state.tick > 4,
    undefined,
    { timeout: 90000 },
  );
  // Wait for all catalog WebP textures to finish uploading
  await page.waitForFunction(
    () => {
      const r = (window as any).strike?.renderer;
      if (!r) return false;
      const texs = r.scene.textures || [];
      return texs.every((t: any) => !t.isReady || t.isReady());
    },
    undefined,
    { timeout: 90000 },
  );

  const metrics = await page.evaluate(() => {
    const c = (window as any).strike;
    const r = c.renderer;
    c.pause();
    r.gunRoot.setEnabled(false);
    // Measure 5 software-WebGL frames
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) r.scene.render();
    const avgMs = (performance.now() - t0) / 5;
    const active = r.scene.meshes.filter((m: any) => m.isEnabled()).length;
    const mats = r.scene.materials.length;
    const textured = r.scene.materials.filter((m: any) => m.diffuseTexture || m.albedoTexture).length;
    const draws = r.scene.getActiveMeshes().length;
    return {
      meshes: r.scene.meshes.length,
      active,
      mats,
      textured,
      draws,
      avgFrameMs: Number(avgMs.toFixed(1)),
    };
  });

  assert.equal(failedUrls.length, 0, `${mapId} (${quality}) 404 textures: ${failedUrls.join(", ")}`);
  assert.ok(metrics.textured >= 8, `${mapId} (${quality}) expected >=8 textured materials, got ${metrics.textured}`);

  await page.locator("button").evaluateAll((buttons) => buttons.forEach((b) => b.remove()));

  for (const [name, [pos, target]] of Object.entries(views)) {
    await page.evaluate(
      ([p, t]) => {
        const r = (window as any).strike.renderer;
        r.camera.mode = 0;
        r.camera.rotationQuaternion = null;
        r.camera.upVector.set(0, 1, 0);
        r.camera.position.set(p[0], p[1], p[2]);
        const look = r.camera.position.clone();
        look.set(t[0], t[1], t[2]);
        r.camera.setTarget(look);
        r.scene.render();
      },
      [pos, target],
    );
    await page.screenshot({ path: `${outDir}/${prefix}-${name}.png` });
  }

  if (captureOverhead) {
    await page.evaluate(() => {
      const r = (window as any).strike.renderer;
      r.scene.fogEnabled = false;
      r.scene.fogMode = 0;
      r.camera.position.set(0, 130, -0.001);
      const t = r.camera.position.clone();
      t.set(0, 0, 0);
      r.camera.setTarget(t);
      r.camera.mode = 1;
      r.camera.orthoLeft = -62;
      r.camera.orthoRight = 62;
      r.camera.orthoTop = 58;
      r.camera.orthoBottom = -58;
      r.scene.render();
    });
    await page.screenshot({ path: `${outDir}/${prefix}-overhead.png` });
  }

  await page.evaluate(() => (window as any).strike.dispose());
  assert.equal(errors.length, 0, `${mapId} (${quality}) page errors: ${errors.join("; ")}`);
  await page.close();
  console.log(`METRICS ${mapId} ${quality}`, metrics);
}

try {
  await runCapture("bollucav2", "medium", MIRAGE_MED_VIEWS, OUT_MIRAGE, "medium", false);
  await runCapture("bollucav2", "high", MIRAGE_HIGH_VIEWS, OUT_MIRAGE, "high", true);
  await runCapture("dust2v2", "medium", DUST_VIEWS, OUT_DUST_AFTER, "medium", false);
  await runCapture("dust2v2", "high", DUST_VIEWS, OUT_DUST_AFTER, "high", false);
  console.log("PASS Bolluca V2 & Dust II V2 AFTER WebGL visual verification");
} finally {
  await browser.close();
  await vite.close();
}
