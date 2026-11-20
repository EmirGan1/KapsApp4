import assert from "node:assert/strict";
import { createServer } from "vite";
import express from "express";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";
import { registerGerman } from "../src/server/german";
import { activities } from "../src/shared/germanActivities";
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
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
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
  await page.getByRole("button", { name: "Alıştırmalar", exact: true }).click();
  await page.getByRole("button", { name: /Çeviri Görevi/ }).click();
  page.once("dialog", d => d.accept());
  await page.getByRole("button", { name: "Oturumu tamamla", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Henüz yanıt vermedin" }).waitFor();
  await page
    .getByRole("textbox", { name: "Yanıtın", exact: true })
    .fill("der Apfel");
  await page.waitForTimeout(1800);
  await page.reload();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Yanıtın", exact: true })
      .inputValue(),
    "der Apfel",
  );
  const resumedId = new URL(page.url()).searchParams.get('session');
  await db.execute({ sql: 'UPDATE german_sessions SET deadline=? WHERE id=?', args: ['2020-01-01T00:00:00Z', resumedId!] });
  await page.reload();
  await page.locator('.kg-task').waitFor();
  await page.waitForTimeout(1500);
  assert.equal(await page.getByRole('heading', { name: 'Oturum sonuçları', exact: true }).count(), 0);
  await page.getByRole('button', { name:'Çalışmaya Başla', exact:true }).click();
  await page.locator('.kg-task').waitFor();
  assert.equal(await page.getByRole('textbox', { name:'Yanıtın', exact:true }).inputValue(), 'der Apfel');
  await page.getByRole('button', { name:'Kaydet ve çık', exact:true }).click();
  await page.getByRole('button', { name:/Çeviri Görevi/ }).click();
  await page.locator('.kg-task').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('session'), resumedId);
  assert.equal(await page.getByRole('textbox', { name:'Yanıtın', exact:true }).inputValue(), 'der Apfel');
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Oturumu tamamla", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Oturum sonuçları", exact: true })
    .waitFor();
  assert.ok((await page.locator("main").textContent())?.includes("100 / 100"));
  // Exercise every interaction against the real authenticated backend on mobile.
  for (const content of ["die Schule — okul", "das Haus — ev", "Ich freue mich darauf. — Bunu sabırsızlıkla bekliyorum.", "der Baum — ağaç / ağaç bitkisi"]) {
    const w = parseDocument({ body: { content: [{ paragraph: { elements: [{ textRun: { content } }] } }] } }).entries[0];
    await db.execute({ sql: "INSERT INTO german_words VALUES(?,?,1,?)", args: [w.id, JSON.stringify(w), new Date().toISOString()] });
  }
  for (const direction of ['de_tr', 'tr_de']) {
    await db.execute("UPDATE german_sessions SET state='done' WHERE state='active'");
    await page.goto(base + "/dersler/kaps-german?tab=practice");
    await page.getByRole('combobox', { name: 'Soru yönü' }).selectOption(direction);
    for (const level of ['A1', 'B2', 'C1']) await page.getByRole('checkbox', { name: level, exact: true }).uncheck();
    assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 2);
    await page.getByRole('button', { name: /Çeviri Görevi/ }).click();
    await page.locator('.kg-activity-badge').waitFor();
    const sid = new URL(page.url()).searchParams.get('session');
    const row = (await db.execute({ sql: 'SELECT tasks FROM german_sessions WHERE id=?', args: [sid!] })).rows[0];
    const tasks = JSON.parse(String(row.tasks));
    for (const task of tasks) {
      assert.ok(['A2','B1'].includes(task.level));
      const source = JSON.parse(String((await db.execute({ sql: 'SELECT data FROM german_words WHERE id=?', args: [task.vocabularyIds[0]] })).rows[0].data));
      assert.equal(task.answer, direction === 'de_tr' ? source.tr : source.de);
    }
    console.log('PASS mobile multi-level selection and backend language direction: ' + direction);
  }
  for (const [type, title] of activities) {
    await db.execute("UPDATE german_sessions SET state='done' WHERE state='active'");
    await page.goto(base + "/dersler/kaps-german?tab=practice");
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.locator('.kg-activity-badge').waitFor();
    const sessionId = new URL(page.url()).searchParams.get('session');
    const row = (await db.execute({ sql: 'SELECT tasks FROM german_sessions WHERE id=?', args: [sessionId!] })).rows[0];
    const task = JSON.parse(String(row.tasks))[0];
    assert.equal(task.type, type);
    const input = page.locator('.kg-activity-input');
    if (task.interaction?.tiles) {
      const wanted = type === 'spelling' ? Array.from(task.answer) : task.answer.split(' ');
      for (const tile of wanted) await input.locator('.kg-tiles button:not(:disabled)').filter({ hasText: new RegExp('^' + String(tile === ' ' ? '␣' : tile).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
    } else if (type === 'matching') {
      const answers = JSON.parse(task.answer);
      for (let i = 0; i < answers.length; i++) await input.locator('select').nth(i).selectOption(answers[i]);
    } else if (type === 'multi') {
      for (const a of task.answer.split(' | ')) await input.getByRole('button').nth(task.options.indexOf(a)).click();
    } else if (task.options.length) {
      const optionIndex = task.options.indexOf(task.answer);
      await input.getByRole('button').nth(optionIndex).click();
    } else await input.getByRole('textbox').fill(task.answer);
    await page.getByRole('button', { name: 'Yanıtı kontrol et', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Harika, doğru!' }).waitFor();
    await page.reload();
    await page.locator('.kg-activity-badge').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log('PASS mobile interaction, server evaluation and reload: ' + type);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
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
