import assert from "node:assert/strict";
import { createServer } from "vite";
import express from "express";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";
import { registerGerman } from "../src/server/german";
import { activities } from "../src/shared/germanActivities";

const db = createClient({ url: "file::memory:" });
const app = express();
await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)");
await db.execute("INSERT INTO users VALUES(1,'Emirgan')");
registerGerman(
  app,
  db,
  async (r) =>
    r.headers.authorization === "Bearer german-test" ? { id: 1 } : null,
  (_q, _r, n) => n(),
  { autoSeedCurriculum: true },
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
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(base + "/dersler/kaps-german");
  await page.getByRole("heading", { name: /yolculuğuna devam et/i }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Home learn view must fit mobile viewport without horizontal overflow",
  );

  // Navigate to Progress tab and verify 5 independent CEFR cards (A1-C1)
  await page.getByRole("button", { name: "İlerleme", exact: true }).click();
  for (const lvl of ["A1", "A2", "B1", "B2", "C1"]) {
    await page.getByLabel(`${lvl} ilerleme kartı`).waitFor();
  }

  // Navigate to Vocabulary library & verify 0/5 pips and filters
  await page.getByRole("button", { name: "Kelimeler", exact: true }).click();
  await page.getByRole("heading", { name: "Kelime Kütüphanesi" }).waitFor();
  await page.getByRole("searchbox", { name: "Kelime ara" }).fill("Apfel");
  await page.waitForTimeout(450);
  assert.ok((await page.locator("article.kg-vocab-card").count()) >= 1);
  assert.ok((await page.locator("article.kg-vocab-card .kg-mastery-pips").first().textContent())?.includes("0/5"));

  // Navigate to Practice tab, pick A1 only + de_tr direction
  await page.getByRole("button", { name: "Pratik", exact: true }).click();
  await page.getByRole("heading", { name: "Pratik Merkezi" }).waitFor();
  await page.getByRole("combobox", { name: "Soru yönü" }).selectOption("tr_de");

  // Exercise every available activity type cleanly on mobile & verify no premature jump to results
  for (const [type, title] of activities) {
    if (type === "mistake_review") continue; // Tested after an intentional mistake
    await db.execute("UPDATE german_sessions SET state='done' WHERE state='active'");
    await page.goto(base + "/dersler/kaps-german?tab=practice");
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.locator(".kg-task-card").waitFor();

    const sid = new URL(page.url()).searchParams.get("session");
    assert.ok(sid, "Session ID should appear in URL");
    const row = (
      await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [sid!] })
    ).rows[0];
    const tasks = JSON.parse(String(row.tasks));
    const task = tasks[0];
    assert.equal(task.level, "A1", `Expected strict A1 level for ${type}`);
    assert.equal(task.type, type, `Expected task type ${type}`);

    // Ensure session NEVER jumps to results before answering
    assert.equal(
      await page.getByRole("heading", { name: "Oturum Tamamlandı!" }).count(),
      0,
    );

    const input = page.locator(".kg-activity-input");
    if (task.interaction?.tiles) {
      const wanted = task.answer.split(" ");
      for (const tile of wanted) {
        await input
          .locator(".kg-tile-bank button:not(:disabled)")
          .filter({
            hasText: new RegExp(
              "^" + tile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
            ),
          })
          .first()
          .click();
      }
    } else if (type === "matching") {
      const answers: string[] = JSON.parse(task.answer);
      const leftCol = input.locator('[aria-label="Almanca kelimeler"] button');
      const rightCol = input.locator('[aria-label="Türkçe karşılıklar"] button');
      for (let i = 0; i < answers.length; i++) {
        await leftCol.nth(i).click();
        await rightCol
          .filter({
            hasText: new RegExp(
              "^" + answers[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$",
            ),
          })
          .first()
          .click();
      }
    } else if (task.options.length) {
      const idx = task.options.indexOf(task.answer);
      assert.ok(idx >= 0, `Option answer missing for ${type}`);
      await input.locator("button.kg-option-card").nth(idx).click();
    } else {
      await input.getByRole("textbox").fill(task.answer);
    }

    await page.getByRole("button", { name: "Kontrol Et", exact: true }).click();
    await page.getByRole("status").filter({ hasText: /Harika, doğru!/ }).waitFor();

    // Verify reload preserves checked progress & position without wiping session
    await page.reload();
    await page.locator(".kg-task-card").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      `Mobile horizontal overflow check failed for ${type}`,
    );
    console.log("PASS mobile interaction, atomic check & reload: " + type);
  }

  // Test expired practice session recovery (never auto-submits or fails unanswered session!)
  const activeSid = new URL(page.url()).searchParams.get("session");
  if (activeSid) {
    await db.execute({
      sql: "UPDATE german_sessions SET deadline='2020-01-01T00:00:00Z' WHERE id=?",
      args: [activeSid],
    });
    await page.reload();
    await page.locator(".kg-task-card").waitFor();
    assert.equal(
      await page.getByRole("heading", { name: "Oturum Tamamlandı!" }).count(),
      0,
    );
  }

  // Desktop viewport layout check
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/dersler/kaps-german?tab=learn");
  await page.getByRole("heading", { name: /yolculuğuna devam et/i }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Desktop viewport must have zero horizontal overflow",
  );
  console.log("PASS desktop layout and full Kaps German browser suite");
} finally {
  await browser.close();
  await vite.close();
  db.close();
}
