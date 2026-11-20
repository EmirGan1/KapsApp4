import assert from "node:assert/strict";
import { createServer } from "vite";
import express from "express";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";
import { registerGerman } from "../src/server/german";
import { parseDocument } from "../src/server/german/learning";
const db = createClient({ url: "file::memory:" }),
  app = express();
await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)");
await db.execute("INSERT INTO users VALUES(1,'Emirgan')");
registerGerman(
  app,
  db,
  async (r) =>
    r.headers.authorization === "Bearer german-test" ? { id: 1 } : null,
  (_q, _r, n) => n(),
);
const vite = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "german-fixture",
      configureServer(s) {
        s.middlewares.use("/api/kaps-german", (q, r, n) => {
          q.url = "/api/kaps-german" + q.url;
          app(q as any, r as any, n);
        });
        s.middlewares.use(async (q, r, n) => {
          if (!q.url?.startsWith("/dersler/kaps-german")) return n();
          r.setHeader("Content-Type", "text/html");
          r.end(
            await s.transformIndexHtml(
              "/dersler/kaps-german",
              '<html><meta name="viewport" content="width=device-width,initial-scale=1"><body><div id="root"></div><script type="module" src="/tests/german.fixture.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
await vite.listen();
const a = vite.httpServer!.address();
assert.ok(a && typeof a !== "string");
const base = "http://127.0.0.1:" + a.port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  await page.goto(base + "/dersler/kaps-german");
  await page
    .getByRole("heading", { name: "Kelimelerinle başlayalım." })
    .waitFor();
  const word = parseDocument({
    body: {
      content: [
        {
          paragraph: {
            elements: [{ textRun: { content: "der Apfel — elma" } }],
          },
        },
      ],
    },
  }).entries[0];
  await db.execute({
    sql: "INSERT INTO german_words VALUES(?,?,1,?)",
    args: [word.id, JSON.stringify(word), new Date().toISOString()],
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Çalışmaya Başla", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Yanıtın", exact: true })
    .fill("elma");
  await page.waitForTimeout(1800);
  await page.reload();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Yanıtın", exact: true })
      .inputValue(),
    "elma",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Oturumu tamamla", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Oturum sonuçları", exact: true })
    .waitFor();
  assert.ok((await page.locator("main").textContent())?.includes("100 / 100"));
  await page
    .getByRole("button", { name: "Goethe B1 Hazırlık", exact: true })
    .click();
  for (const module of ["Lesen", "Hören", "Schreiben", "Sprechen"])
    await page.getByRole("heading", { name: module, exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: "/tmp/german-goethe-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: "/tmp/german-goethe-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS source vocabulary practice, automatic save/reload, objective grading, isolated Goethe dashboard and mobile layout",
  );
} catch (e) {
  console.error(e);
  await page.screenshot({ path: "/tmp/german-error.png" });
  throw e;
} finally {
  await browser.close();
  await vite.close();
  db.close();
}
