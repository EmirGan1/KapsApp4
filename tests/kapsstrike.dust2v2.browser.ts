import { createServer } from "vite";
import { chromium } from "playwright";
import assert from "node:assert/strict";

const vite = await createServer({
  cacheDir: "node_modules/.vite-strike-dust2v2-qa",
  logLevel: "error",
  plugins: [
    {
      name: "dust2v2-qa",
      configureServer(s) {
        s.middlewares.use("/__dust2v2", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__dust2v2",
              '<html><body style="margin:0"><div id="root"></div><script type="module" src="/tests/kapsstrike.fixture.tsx"></script></body></html>'
            )
          );
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 4199, strictPort: true },
});

await vite.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.STRIKE_CHROMIUM || undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

const viewpoints: Record<string, [[number, number, number], [number, number, number]]> = {
  "t-spawn-mid-awp": [[0, 4.42, -45], [0, 1.6, 20]],
  "a-long-boulevard": [[43.5, 3.22, -12], [44.5, 3.8, 36]],
  "sunken-pit": [[45.0, 1.62, -31], [44.5, 2.8, 8]],
  "a-site-platform": [[33.5, 4.82, 34.5], [40.5, 4.2, 44]],
  "upper-tunnels-roof": [[-36.0, 4.02, -7.5], [-36.0, 4.5, 9]],
  "b-site-courtyard": [[-41.5, 4.2, 31.5], [-31.0, 3.4, 41]],
  "ct-mid-b-window": [[-6.0, 1.62, 26.5], [-24.5, 3.2, 36.5]],
  "under-a-bridge": [[16.0, 1.62, 29.0], [26.0, 1.6, 25.0]],
};

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4199/__dust2v2?mode=engine&quality=medium&map=dust2v2");
  await page.getByRole("button", { name: "Start test", exact: true }).click();
  await page.waitForFunction(
    () => (window as any).strike?.renderer.scene.isReady() && (window as any).strike?.state.tick > 5,
    { timeout: 30000 }
  );

  const metrics = await page.evaluate(() => {
    const c = (window as any).strike;
    const r = c.renderer;
    c.pause();
    r.gunRoot.setEnabled(false);
    const activeMeshes = r.scene.meshes.filter((m: any) => m.isEnabled()).length;
    const texturedMaterials = r.scene.materials.filter((m: any) => m.diffuseTexture || m.albedoTexture).length;
    return { activeMeshes, texturedMaterials };
  });
  assert.ok(metrics.activeMeshes > 40, `Expected >40 active meshes, got ${metrics.activeMeshes}`);
  assert.ok(metrics.texturedMaterials >= 6, `Expected >=6 textured materials, got ${metrics.texturedMaterials}`);

  await page.locator("button").evaluateAll((buttons) => buttons.forEach((b) => b.remove()));

  for (const [name, [pos, target]] of Object.entries(viewpoints)) {
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
      [pos, target]
    );
    await page.screenshot({ path: `/tmp/dust2v2-${name}.png` });
  }

  // Full overhead orthographic plan capture
  await page.evaluate(() => {
    const r = (window as any).strike.renderer;
    r.scene.fogMode = 0;
    r.camera.position.set(0, 130, -0.001);
    const t = r.camera.position.clone();
    t.set(0, 0, 0);
    r.camera.setTarget(t);
    r.camera.mode = 1;
    r.camera.orthoLeft = -78;
    r.camera.orthoRight = 78;
    r.camera.orthoTop = 62;
    r.camera.orthoBottom = -62;
    r.scene.render();
  });
  await page.screenshot({ path: "/tmp/dust2v2-overhead-plan.png" });

  await page.evaluate(() => (window as any).strike.dispose());
  assert.equal(errors.length, 0, `WebGL page errors: ${errors.join("; ")}`);
  await page.close();
  console.log("PASS Dust II V2 WebGL visual verification", metrics, Object.keys(viewpoints).length + 1, "captures");
} finally {
  await browser.close();
  await vite.close();
}
