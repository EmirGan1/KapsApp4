import assert from "node:assert/strict";
import { createServer } from "vite";
import express from "express";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";
import { registerUniversity } from "../src/server/university";
import { readFile } from "node:fs/promises";
const db = createClient({ url: "file::memory:" });
process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID = "11";
const app = express();
registerUniversity(
  app,
  db,
  async (req) => ({
    id: req.headers.authorization === "Bearer owner" ? 11 : 12,
  }),
  (_q, _r, n) => n(),
);
const vite = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "university-fixture",
      configureServer(server) {
        server.middlewares.use("/api/university-vault", (req, res, next) => {
          req.url = "/api/university-vault" + req.url;
          app(req as any, res as any, next);
        });
        server.middlewares.use("/__uni", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/__uni",
              '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script type="module" src="/tests/university.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
await vite.listen();
const address = vite.httpServer!.address();
assert.ok(address && typeof address !== "string");
const base = "http://127.0.0.1:" + address.port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
try {
  await page.goto(base + "/__uni");
  await page.getByRole("button", { name: "Klasör aç", exact: true }).click();
  await page.getByLabel("Ad / başlık").fill("Başvuru 2027");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page
    .getByRole("button", { name: /Başvuru 2027/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Kayıt / belge ekle", exact: true })
    .click();
  await page.getByLabel("Ad / başlık").fill("English CV");
  await page
    .getByRole("combobox", { name: "Kategori", exact: true })
    .selectOption("cv");
  await page
    .getByLabel("Profil", { exact: true })
    .fill("<script>alert('private')</script> IB student");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "CV indir · HTML", exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  assert.ok(path);
  const html = await readFile(path, "utf8");
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  await page
    .getByLabel("Belge ekle veya mevcut dosyayı değiştir")
    .setInputFiles({
      name: "cv.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nmy CV"),
    });
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page
    .getByRole("button", { name: "English CV indir", exact: true })
    .waitFor();
  await page.screenshot({
    path: "/tmp/university-desktop.png",
    fullPage: true,
  });
  const fileDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "English CV indir", exact: true })
    .click();
  assert.equal((await fileDownload).suggestedFilename(), "cv.pdf");
  await page
    .getByRole("button", { name: "English CV düzenle", exact: true })
    .click();
  await page.getByLabel("Ad / başlık").fill("English CV updated");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page.reload();
  await page.getByLabel("Başvuru arşivinde ara").fill("updated");
  await page
    .getByRole("button", { name: "English CV updated düzenle", exact: true })
    .waitFor();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/university-mobile.png", fullPage: true });
  await page.goto(base + "/__uni?outsider=1");
  await page
    .getByRole("status")
    .filter({ hasText: "yalnızca Emirgan" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Kayıt / belge ekle", exact: true })
      .count(),
    0,
  );
  console.log(
    "PASS folders, structured CV and escaped export, private upload/download, rename, persistence, cross-folder search, 390/768/1440 layouts and unauthorized user rejection",
  );
} catch (error) {
  console.error(error);
  await page.screenshot({ path: "/tmp/university-error.png" }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await vite.close();
  db.close();
  delete process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID;
}
