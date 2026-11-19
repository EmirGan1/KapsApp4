import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@libsql/client";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const temp = await mkdtemp(join(tmpdir(), "kapsapp-university-production-"));
await symlink(join(root, "dist"), join(temp, "dist"), "dir");
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const address = probe.address();
assert.ok(address && typeof address !== "string");
const port = address.port;
await new Promise<void>((done) => probe.close(() => done()));
const url = "file:" + join(temp, "test.db");
const child = spawn(process.execPath, [join(root, "dist/server.cjs")], {
  cwd: temp,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    TURSO_DATABASE_URL: url,
    KAPSAPP_UNIVERSITY_EMIRGAN_ID: "101",

    KAPSAPP_AI_ENABLED: "0",
  },
});
let logs = "";
child.stdout.on("data", (d) => {
  logs += d;
});
child.stderr.on("data", (d) => {
  logs += d;
});
const exited = once(child, "exit");
const db = createClient({ url });
const base = "http://127.0.0.1:" + port;
const browser = await chromium.launch();
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (
      await fetch(base + "/api/health").then(
        (r) => r.ok,
        () => false,
      )
    ) {
      ready = true;
      break;
    }
    await delay(200);
  }
  assert.ok(ready, "Production server should boot. " + logs.slice(-1000));
  for (const [id, username] of [
    [101, "Emirgan"],
    [102, "Dido"],
    [103, "Other"],
  ] as const) {
    await db.execute({
      sql: "INSERT INTO users(id,username,password,token,status) VALUES(?,?,'fixture',?,'approved')",
      args: [id, username, "travel-production-" + id],
    });
    await db.execute({
      sql: "INSERT INTO user_sessions(user_id,token,created_at,expires_at) VALUES(?,?,?,?)",
      args: [
        id,
        "travel-production-" + id,
        new Date().toISOString(),
        "2099-01-01T00:00:00.000Z",
      ],
    });
  }
  await db.execute("INSERT INTO friends(user1,user2,status) VALUES(101,102,1)");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() => {
    localStorage.setItem("lan_token", "travel-production-101");
    localStorage.setItem("lan_username", "Emirgan");
    localStorage.setItem("lan_user_id", "101");
    sessionStorage.setItem("kapsapp-notification-dismissed", "1");
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  await page.goto(base + "/emirgan");
  await page
    .locator('select[aria-label="Panel bölümü"] option[value="university"]')
    .waitFor({ state: "attached" });
  await page
    .getByRole("combobox", { name: "Panel bölümü" })
    .selectOption("university");
  await page
    .getByRole("button", { name: "Kayıt / belge ekle", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page
    .getByRole("button", { name: "Kayıt / belge ekle", exact: true })
    .click();
  await page.getByLabel("Ad / başlık").fill("Production private record");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Production private record düzenle",
      exact: true,
    })
    .waitFor();
  await page.screenshot({
    path: "/tmp/university-integrated-mobile.png",
    fullPage: true,
  });
  const response = await fetch(base + "/api/university-vault/items", {
    headers: { Authorization: "Bearer travel-production-103" },
  });
  assert.equal(response.status, 403);
  assert.ok(
    !logs.includes("Production private record"),
    "private trip content must not appear in server logs",
  );
  console.log(
    "PASS built production server, real authentication, Emirgan panel menu, private record creation, mobile layout and other-user API rejection",
  );
} catch (error) {
  console.error(error);
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .screenshot({ path: "/tmp/travel-production-error.png" })
        .catch(() => {});
    }
  throw error;
} finally {
  await browser.close();
  child.kill("SIGTERM");
  await exited;
  db.close();
  await rm(temp, { recursive: true, force: true });
}
