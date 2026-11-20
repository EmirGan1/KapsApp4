import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { once } from "node:events";
import { createClient } from "@libsql/client";
import {
  parseDocument,
  normalize,
  newMemory,
  review,
  EXAM_STRUCTURE,
} from "../src/server/german/learning";
import { registerGerman } from "../src/server/german";
const paragraph = (text: string) => ({
  paragraph: { elements: [{ textRun: { content: text } }] },
});
test("Google Docs tabs, tables, duplicates and Unicode", () => {
  const parsed = parseDocument({
    tabs: [
      {
        documentTab: {
          body: {
            content: [
              paragraph("Arbeit"),
              paragraph("die Bewerbung — başvuru"),
              paragraph("die Bewerbung — başvuru"),
            ],
          },
        },
        childTabs: [
          {
            documentTab: {
              body: {
                content: [
                  {
                    table: {
                      tableRows: [
                        {
                          tableCells: [
                            { content: [paragraph("obwohl")] },
                            { content: [paragraph("rağmen")] },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  });
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.entries[0].article, "die");
  assert.notEqual(normalize("schon"), normalize("schön"));
  assert.equal(normalize("  ÄPFEL "), normalize("äpfel"));
  assert.equal(parseDocument({ body: { content: [] } }).entries.length, 0);
});
test("spaced learning is reversible; same-session success cannot establish mastery", () => {
  let m = newMemory();
  const start = new Date("2026-01-01T12:00:00Z");
  for (let i = 0; i < 10; i++)
    m = review(m, true, true, new Date(start.getTime() + i * 1000));
  assert.notEqual(m.state, "mastered");
  assert.equal(m.spaced, 1);
  for (let i = 1; i <= 6; i++)
    m = review(m, true, true, new Date(start.getTime() + i * 30 * 86400000));
  assert.equal(m.state, "mastered");
  m = review(m, false, true, new Date("2027-01-01"));
  assert.equal(m.state, "needs_review");
  assert.equal(
    EXAM_STRUCTURE.Lesen.parts.reduce((a, b) => a + b),
    30,
  );
});
test("real API permissions, source-independent recall, private sessions, versioning and grading", async () => {
  const db = createClient({ url: "file::memory:" }),
    app = express();
  await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)");
  await db.execute(
    "INSERT INTO users VALUES(1,'Emirgan'),(2,'Student'),(3,'Other')",
  );
  registerGerman(
    app,
    db,
    async (req) => {
      const id = Number(req.headers.authorization?.replace("Bearer ", ""));
      return Number.isSafeInteger(id) && id > 0 ? { id } : null;
    },
    (_q, _s, n) => n(),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = "http://127.0.0.1:" + address.port + "/api/kaps-german";
  const ask = (path: string, user = 1, body?: unknown) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + user,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    assert.equal((await fetch(base + "/access")).status, 401);
    assert.equal((await ask("/access", 2)).status, 403);
    assert.equal((await ask("/access")).status, 200);
    assert.equal(
      (await ask("/admin/access", 1, { userId: 2, enabled: true })).status,
      200,
    );
    assert.equal((await ask("/access", 2)).status, 200);
    assert.equal((await ask("/admin/users", 2)).status, 403);
    const word = parseDocument({
      body: { content: [paragraph("der Apfel — elma")] },
    }).entries[0];
    await db.execute({
      sql: "INSERT INTO german_words VALUES(?,?,1,?)",
      args: [word.id, JSON.stringify(word), new Date().toISOString()],
    });
    const start = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
    }).then((r) => r.json());
    const s = await ask("/sessions/" + start.id).then((r) => r.json());
    assert.equal(s.tasks[0].answer, undefined);
    assert.equal((await ask("/sessions/" + start.id, 2)).status, 404);
    assert.equal(
      (
        await ask("/sessions/" + start.id + "/answer", 1, {
          taskId: s.tasks[0].id,
          answer: "elma",
          version: s.version,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await ask("/sessions/" + start.id + "/answer", 1, {
          taskId: s.tasks[0].id,
          answer: "old",
          version: s.version,
        })
      ).status,
      409,
    );
    await ask("/sessions/" + start.id + "/submit", 1, {});
    let result: any;
    for (let i = 0; i < 100; i++) {
      result = await ask("/sessions/" + start.id).then((r) => r.json());
      if (result.state === "done") break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(result.state, "done");
    assert.equal(Object.values(result.results).length, 1);
    const owner = await ask("/overview").then((r) => r.json()),
      other = await ask("/overview", 2).then((r) => r.json());
    assert.equal(owner.words[0].memory.attempts, 1);
    assert.equal(other.words[0].memory.attempts, 0);
    assert.equal((await ask("/sessions", 1, { module: "Hören" })).status, 409);
    assert.equal(
      (await ask("/sessions", 1, { module: "Lesen", mode: "exam" })).status,
      409,
    );
    await ask("/admin/access", 1, { userId: 2, enabled: false });
    assert.equal((await ask("/access", 2)).status, 403);
    assert.equal(
      (await db.execute("PRAGMA integrity_check")).rows[0].integrity_check,
      "ok",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});

test("idempotent Google synchronization preserves memory, archives removed source, and fails safely", async () => {
  const { encrypt } = await import("../src/server/german/google");
  const db = createClient({ url: "file::memory:" }),
    app = express();
  registerGerman(
    app,
    db,
    async () => ({ id: 1 }),
    (_q, _r, n) => n(),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const a = server.address();
  assert.ok(a && typeof a !== "string");
  const base = "http://127.0.0.1:" + a.port + "/api/kaps-german";
  const native = globalThis.fetch;
  let fail = false,
    content = "der Apfel — elma";
  process.env.KAPS_GERMAN_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
  const ask = (path: string, body?: unknown) =>
    native(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer 1",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await ask("/access");
    await db.execute({
      sql: "INSERT INTO german_settings VALUES('google_token',?)",
      args: [encrypt(JSON.stringify({ refresh_token: "synthetic" }))],
    });
    globalThis.fetch = (async (url: any, init?: any) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/"))
        return Response.json({ access_token: "synthetic-access" });
      if (String(url).startsWith("https://docs.googleapis.com/"))
        return fail
          ? new Response("", { status: 403 })
          : Response.json({
              tabs: [
                { documentTab: { body: { content: [paragraph(content)] } } },
              ],
            });
      return native(url, init);
    }) as typeof fetch;
    async function run() {
      const n = Number(
        (await db.execute("SELECT COUNT(*) AS n FROM german_jobs")).rows[0].n,
      );
      await ask("/admin/sync", {});
      for (let i = 0; i < 200; i++) {
        const rows = await db.execute(
          "SELECT * FROM german_jobs ORDER BY started_at DESC LIMIT 1",
        );
        if (
          rows.rows[0]?.finished_at &&
          Number(
            (await db.execute("SELECT COUNT(*) AS n FROM german_jobs")).rows[0]
              .n,
          ) > n
        )
          return;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.fail("sync stalled");
    }
    await run();
    const first = (await db.execute("SELECT * FROM german_words")).rows[0];
    await db.execute({
      sql: "INSERT INTO german_memory VALUES(1,?,?)",
      args: [first.id, JSON.stringify({ ...newMemory(), attempts: 5 })],
    });
    await run();
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM german_words")).rows[0].n,
      1,
    );
    content = "der Apfel — elma meyvesi";
    await run();
    assert.equal(
      (await db.execute("SELECT id FROM german_words WHERE active=1")).rows[0]
        .id,
      first.id,
    );
    assert.equal(
      JSON.parse(
        String(
          (await db.execute("SELECT data FROM german_memory")).rows[0].data,
        ),
      ).attempts,
      5,
    );
    fail = true;
    await run();
    assert.equal(
      (
        await db.execute(
          "SELECT COUNT(*) AS n FROM german_words WHERE active=1",
        )
      ).rows[0].n,
      1,
    );
    fail = false;
    content = "";
    await run();
    assert.equal(
      (await db.execute("SELECT active FROM german_words")).rows[0].active,
      0,
    );
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM german_memory")).rows[0].n,
      1,
    );
  } finally {
    globalThis.fetch = native;
    delete process.env.KAPS_GERMAN_TOKEN_KEY;
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
