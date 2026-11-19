import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createServer } from "vite";
import { createClient } from "@libsql/client";
import express from "express";
import { chromium } from "playwright";
import { registerTravel } from "../src/server/travel";
import { resolveAyvalikUser } from "../src/server/ayvalikAuth";
import { TRAVEL_API } from "../src/shared/travel";

const db = createClient({ url: "file::memory:" });
await db.execute(
  "CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,avatar TEXT,color TEXT,roles TEXT,is_admin INTEGER DEFAULT 0,token TEXT,isBanned INTEGER DEFAULT 0,is_banned INTEGER DEFAULT 0,status TEXT DEFAULT 'approved')",
);
await db.execute(
  "CREATE TABLE user_sessions(user_id INTEGER,token TEXT,expires_at TEXT)",
);
for (let id = 1; id <= 3; id++)
  await db.execute({
    sql: "INSERT INTO users(id,username,token) VALUES(?,?,?)",
    args: [
      id,
      id === 1 ? "Dido" : id === 2 ? "Emirgan" : "Other",
      "travel-browser-" + id,
    ],
  });
const app = express();
registerTravel(
  app,
  db,
  (req) => resolveAyvalikUser(req, db),
  (_req, _res, next) => next(),
  [1, 2],
);
const vite = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "private-travel-fixture",
      configureServer(server) {
        server.middlewares.use(TRAVEL_API, (req, res, next) => {
          req.url = TRAVEL_API + req.url;
          app(req as any, res as any, next);
        });
        server.middlewares.use(async (req, res, next) => {
          if (
            !req.url?.startsWith("/gezi-planlama") &&
            !req.url?.startsWith("/__travel")
          )
            return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/__travel",
              '<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/travel.fixture.tsx"></script></body></html>',
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
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const errors: string[] = [];
async function contextFor(id: number, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
  });
  await context.addInitScript((id) => {
    localStorage.setItem("lan_token", "travel-browser-" + id);
    localStorage.setItem("test_travel_user", String(id));
  }, id);
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
try {
  const { page: a, context: ca } = await contextFor(1);
  const { page: b, context: cb } = await contextFor(2, 390);
  const { page: outsider, context: co } = await contextFor(3);
  await outsider.goto(base + "/gezi-planlama");
  await outsider.getByRole("heading", { name: "Bu alan özeldir" }).waitFor();
  assert.equal(
    await outsider
      .getByRole("button", { name: "Yeni Gezi Planı Oluştur" })
      .count(),
    0,
  );
  await a.goto(base + "/gezi-planlama");
  await a.getByRole("button", { name: "Yeni Gezi Planı Oluştur" }).click();
  await a.getByLabel("Gezi adı", { exact: true }).fill("Birlikte Budapeşte");
  await a.getByLabel("Şehir / ülke").fill("Budapeşte, Macaristan");
  await a.getByLabel("Gidiş tarihi").fill("2027-04-16");
  await a.getByLabel("Dönüş tarihi").fill("2027-04-19");
  await a.getByLabel("Toplam bütçe", { exact: true }).fill("1000");
  await a.getByRole("button", { name: "Kaydet", exact: true }).click();
  await a.getByRole("heading", { name: "Planımız şekilleniyor." }).waitFor();
  const tripUrl = a.url().replace("/overview", "");
  await a.screenshot({
    path: "/tmp/travel-desktop-overview.png",
    fullPage: true,
  });
  console.log("PASS trip creation", tripUrl);
  await b.goto(tripUrl + "/discover");
  await b.getByRole("heading", { name: "İlhamı rotaya dönüştür" }).waitFor();
  await b
    .getByRole("button", { name: "Planımıza ekle", exact: true })
    .first()
    .click();
  await b.getByLabel("Tarih", { exact: true }).fill("2027-04-16");
  await b.getByLabel("Saat", { exact: true }).fill("10:00");
  await b.getByRole("button", { name: "Kaydet", exact: true }).click();
  await b.getByRole("button", { name: "Planımızda", exact: true }).waitFor();
  await a
    .getByRole("link", { name: "Yerler & deneyimler", exact: true })
    .click();
  await a
    .getByRole("heading", { name: "Balıkçı Tabyası", exact: true })
    .waitFor();
  await a.getByRole("button", { name: "Ziyaret ettik", exact: true }).click();
  await a
    .getByRole("button", { name: "Ziyaret edildi", exact: true })
    .waitFor();
  console.log("PASS discovery import and shared place");
  await a.getByRole("link", { name: "Bütçe", exact: true }).click();
  await a.getByRole("button", { name: "Gider ekle", exact: true }).click();
  await a.getByLabel("Başlık", { exact: true }).fill("Otel");
  await a.getByLabel("Tahminî tutar").fill("250");
  await a.getByLabel("Gerçek tutar").fill("200");
  await a.getByLabel("Ödeyen", { exact: true }).selectOption("1");
  await a.getByRole("button", { name: "Kaydet", exact: true }).click();
  await a.getByRole("button", { name: "Otel", exact: true }).waitFor();
  assert.ok(
    (await a.locator(".t-split-result").textContent())?.includes("100"),
  );
  console.log("PASS budget math");
  await b.getByRole("link", { name: "Hazırlık & bavul", exact: true }).click();
  await b.getByRole("button", { name: "Hazırlık ekle", exact: true }).click();
  await b.getByLabel("Başlık", { exact: true }).fill("Pasaportları kontrol et");
  await b.getByLabel("Kategori", { exact: true }).fill("Bavul");
  await b.getByRole("button", { name: "Kaydet", exact: true }).click();
  await b
    .getByRole("checkbox", { name: "Pasaportları kontrol et tamamlandı" })
    .click();
  await b.waitForFunction(
    () =>
      document.querySelector<HTMLInputElement>(
        'input[aria-label="Pasaportları kontrol et tamamlandı"]',
      )?.checked,
  );
  await b.getByRole("link", { name: "Rezervasyonlar", exact: true }).click();
  await b
    .getByRole("button", { name: "Rezervasyon ekle", exact: true })
    .click();
  await b.getByLabel("Başlık", { exact: true }).fill("Ortak otel");
  await b
    .getByLabel("Rezervasyon numarası", { exact: true })
    .fill("PRIVATE-123");
  await b.getByRole("button", { name: "Kaydet", exact: true }).click();
  await b.getByRole("button", { name: "Ayrıntılar", exact: true }).click();
  await b.getByRole("button", { name: "Yorum ekle", exact: true }).click();
  await b.getByLabel("Başlık", { exact: true }).fill("Geç giriş");
  await b
    .getByLabel("Yorum", { exact: true })
    .fill("Giriş saatini birlikte teyit edelim.");
  await b.getByRole("button", { name: "Kaydet", exact: true }).click();
  await b.getByRole("button", { name: "Ayrıntılar", exact: true }).click();
  await b.getByRole("heading", { name: "Geç giriş", exact: true }).waitFor();
  await b.getByRole("button", { name: "Pencereyi kapat", exact: true }).click();
  console.log("PASS task, booking and shared comment");
  await b.getByRole("link", { name: "Notlar & kararlar", exact: true }).click();
  await b.getByRole("button", { name: "Karar aç", exact: true }).click();
  await b.getByLabel("Başlık", { exact: true }).fill("Akşam planı");
  await b.getByLabel("Seçenekler").fill("Tuna yürüyüşü\nKafe");
  await b.getByRole("button", { name: "Kaydet", exact: true }).click();
  await b.getByRole("button", { name: /Tuna yürüyüşü/ }).click();
  await b
    .getByRole("button", { name: /Tuna yürüyüşü/ })
    .filter({ hasText: "Emirgan" })
    .waitFor();
  await a.getByRole("link", { name: "Notlar & kararlar", exact: true }).click();
  await a
    .getByRole("button", { name: /Tuna yürüyüşü/ })
    .filter({ hasText: "Emirgan" })
    .waitFor();
  await a.getByRole("button", { name: "Düzenle", exact: true }).click();
  await a.getByLabel("Başlık", { exact: true }).fill("Benim bekleyen taslağım");
  const decision = (
    await db.execute(
      "SELECT id,version,data FROM private_travel_entries WHERE kind='decision'",
    )
  ).rows[0];
  await b.request.post(
    base + TRAVEL_API + "/trip/" + tripUrl.split("/").at(-1) + "/mutate",
    {
      headers: { Authorization: "Bearer travel-browser-2" },
      data: {
        operation: "update",
        id: decision.id,
        version: Number(decision.version),
        data: {
          ...JSON.parse(String(decision.data)),
          title: "Diğer kullanıcının düzenlemesi",
        },
      },
    },
  );
  await a.getByRole("button", { name: "Kaydet", exact: true }).click();
  await a
    .getByRole("alert")
    .filter({ hasText: /kayıt değiştirildi/ })
    .waitFor();
  assert.equal(
    await a.getByLabel("Başlık", { exact: true }).inputValue(),
    "Benim bekleyen taslağım",
  );
  await a.getByRole("button", { name: "Pencereyi kapat" }).click();
  await b.reload();
  await b
    .getByRole("heading", { name: "Diğer kullanıcının düzenlemesi" })
    .waitFor();
  await b.getByRole("link", { name: "Günlük program", exact: true }).click();
  const downloadPromise = b.waitForEvent("download");
  await b.getByRole("button", { name: "Takvime aktar" }).click();
  assert.equal(
    (await downloadPromise).suggestedFilename(),
    "gezi-programi.ics",
  );
  for (const section of [
    "overview",
    "places",
    "itinerary",
    "map",
    "budget",
    "checklists",
    "bookings",
    "together",
    "discover",
  ]) {
    await b.goto(tripUrl + "/" + section);
    await b.locator(".t-sync").waitFor();
    if (section === "map") {
      await b.getByRole("button", { name: "Haritayı yükle" }).click();
      await b
        .locator(".leaflet-container .leaflet-interactive")
        .first()
        .waitFor();
    }
    assert.ok(
      await b.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      section + " has no mobile horizontal overflow",
    );
  }
  await b.screenshot({
    path: "/tmp/travel-mobile-discover.png",
    fullPage: true,
  });
  await a.getByRole("button", { name: "Not ekle", exact: true }).click();
  await a.getByLabel("Başlık", { exact: true }).fill("Offline taslağım");
  await ca.setOffline(true);
  await a.getByRole("button", { name: "Kaydet", exact: true }).click();
  await a
    .getByRole("alert")
    .filter({ hasText: "Bağlantı kurulamadı" })
    .waitFor();
  assert.equal(
    await a.getByLabel("Başlık", { exact: true }).inputValue(),
    "Offline taslağım",
  );
  await ca.setOffline(false);
  await a.getByRole("button", { name: "Kaydet", exact: true }).click();
  await a.getByRole("heading", { name: "Offline taslağım" }).waitFor();
  await a.goto(tripUrl + "/overview");
  await a.getByRole("heading", { name: "Planımız şekilleniyor." }).waitFor();
  await a.reload();
  await a.getByRole("heading", { name: "Planımız şekilleniyor." }).waitFor();
  await a.screenshot({
    path: "/tmp/travel-desktop-populated.png",
    fullPage: true,
  });
  for (const [page, id, peer, expected] of [
    [a, 1, 2, 1],
    [b, 2, 1, 1],
    [a, 1, 3, 0],
    [outsider, 3, 2, 0],
  ] as const) {
    await page.goto(base + "/__travel?fixture=dm&peer=" + peer);
    await page.getByRole("button", { name: "Ara", exact: true }).waitFor();
    await page.waitForTimeout(400);
    assert.equal(
      await page
        .getByRole("button", { name: "Gezi Planlama", exact: true })
        .count(),
      expected,
      "exclusive DM button for " + id + " / " + peer,
    );
  }
  await a.goto(base + "/__travel?fixture=dm&peer=2");
  await a.getByRole("button", { name: "Gruplar", exact: true }).click();
  await a.getByText("Gezi Grubu", { exact: true }).click();
  assert.equal(
    await a.getByRole("button", { name: "Gezi Planlama", exact: true }).count(),
    0,
  );
  assert.equal(
    (await db.execute("PRAGMA integrity_check")).rows[0].integrity_check,
    "ok",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS two-account mobile/desktop planner, real API persistence, discovery import, expense math, tasks, votes, conflict draft preservation, calendar download, all nine mobile pages, reload, and exclusive DM button in both directions",
  );
  await ca.close();
  await cb.close();
  await co.close();
} catch (error) {
  console.error(error);
  for (const [i, context] of browser.contexts().entries())
    for (const page of context.pages()) {
      console.error(
        "Page",
        i,
        page.url(),
        await page.locator("dialog").allTextContents(),
      );
      await page
        .screenshot({ path: "/tmp/travel-error-" + i + ".png" })
        .catch(() => {});
    }
  throw error;
} finally {
  await browser.close();
  await vite.close();
  db.close();
}
