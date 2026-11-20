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
const temp = await mkdtemp(join(tmpdir(), "kapsapp-german-production-"));
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
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});

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
    [1, "Emirgan"],
    [2, "Dido"],
    [3, "Other"],
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
  await db.execute("INSERT INTO friends(user1,user2,status) VALUES(1,2,1)");

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() => {
    localStorage.setItem("lan_token", "travel-production-1");
    localStorage.setItem("lan_username", "Emirgan");
    localStorage.setItem("lan_user_id", "1");
    sessionStorage.setItem("kapsapp-notification-dismissed", "1");
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );

  const page = await context.newPage();
  await page.goto(base + "/dersler");
  await page.getByRole("link", { name: /Kaps German/ }).click();
  await page.getByRole("heading", { name: /yolculuğuna devam et/i }).waitFor();

  // Verify KapsApp outer BottomNav & outer mobile header are hidden when inside Kaps German!
  assert.equal(await page.locator('[data-testid="mobile-top-app-bar"]').count(), 0);
  assert.equal(await page.locator(".kapsapp-bottom-nav").count(), 0);
  assert.equal(await page.locator(".kg-mobile-nav").count(), 1);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );

  // Switch to Progress view & verify all 5 CEFR cards render in production build
  await page.getByRole("button", { name: "İlerleme", exact: true }).click();
  for (const lvl of ["A1", "A2", "B1", "B2", "C1"]) {
    await page.getByLabel(`${lvl} ilerleme kartı`).waitFor();
  }
  await page.reload();
  await page.getByLabel("A1 ilerleme kartı").waitFor();

  // Verify unauthorized user gets 403
  const response = await fetch(base + "/api/kaps-german/overview", {
    headers: { Authorization: "Bearer travel-production-3" },
  });
  assert.equal(response.status, 403);
  console.log(
    "PASS production authentication, Dersler entry, single mobile nav, 5 CEFR progress cards, reload and unauthorized rejection",
  );
} catch (error) {
  console.error(error);
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      await page
        .screenshot({ path: "/tmp/german-production-error.png" })
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
