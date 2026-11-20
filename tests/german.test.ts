import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { once } from "node:events";
import { createClient } from "@libsql/client";
import {
  parseDocument,
  normalize,
  newMastery,
  applyMasteryAttempt,
  EXAM_STRUCTURE,
} from "../src/server/german/learning";
import { registerGerman } from "../src/server/german";

const paragraph = (text: string) => ({
  paragraph: { elements: [{ textRun: { content: text } }] },
});

test("Test 13: Google Docs tabs, CEFR headings, duplicates, unclassified isolation and Unicode", () => {
  const parsed = parseDocument({
    tabs: [
      {
        tabProperties: { title: "B1 Kelimeler" },
        documentTab: {
          body: {
            content: [
              paragraph("Arbeit"),
              paragraph("die Bewerbung — başvuru"),
              paragraph("die Bewerbung — başvuru"),
              paragraph("unbekanntesKunstwort123 — test"),
            ],
          },
        },
        childTabs: [
          {
            documentTab: {
              body: {
                content: [
                  paragraph("A1 — Temel"),
                  {
                    table: {
                      tableRows: [
                        {
                          tableCells: [
                            { content: [paragraph("der Apfel")] },
                            { content: [paragraph("elma")] },
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
  assert.equal(parsed.entries.length, 3);
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.entries[0].level, "B1");
  assert.equal(parsed.entries[0].article, "die");
  assert.equal(parsed.entries[2].level, "A1");
  assert.notEqual(normalize("schon"), normalize("schön"));
  assert.equal(normalize("  ÄPFEL "), normalize("äpfel"));
  assert.equal(parseDocument({ body: { content: [] } }).entries.length, 0);

  // Entries without any heading AND not in reference dictionary must be marked UNCLASSIFIED, never defaulted to B1!
  const unheaded = parseDocument({
    body: {
      content: [paragraph("das Kunstwortxyz — uydurma kelime")],
    },
  });
  assert.equal(unheaded.entries[0].level, "UNCLASSIFIED");
});

test("Test 4 & 5: five consecutive correct answers mastery, reset to 0/5 on mistake, and optional review protection", () => {
  let m = newMastery("w1", "A1");
  assert.equal(m.consecutiveCorrect, 0);
  assert.equal(m.masteryStatus, "not_learned");

  // 1 -> 2 -> 3 -> 4
  m = applyMasteryAttempt(m, true);
  assert.equal(m.consecutiveCorrect, 1);
  assert.equal(m.masteryStatus, "learning");
  m = applyMasteryAttempt(m, true);
  assert.equal(m.consecutiveCorrect, 2);
  assert.equal(m.masteryStatus, "learning");
  m = applyMasteryAttempt(m, true);
  assert.equal(m.consecutiveCorrect, 3);
  assert.equal(m.masteryStatus, "learning");

  // Test 5: Incorrect at 3/5 resets consecutiveCorrect to 0/5
  m = applyMasteryAttempt(m, false);
  assert.equal(m.consecutiveCorrect, 0);
  assert.equal(m.totalCorrect, 3);
  assert.equal(m.totalIncorrect, 1);
  assert.equal(m.masteryStatus, "not_learned");
  assert.equal(m.masteredAt, null);

  // Reach 4/5 -> almost_mastered, then 5/5 -> mastered!
  for (let i = 1; i <= 4; i++) m = applyMasteryAttempt(m, true);
  assert.equal(m.consecutiveCorrect, 4);
  assert.equal(m.masteryStatus, "almost_mastered");
  assert.equal(m.masteredAt, null);

  m = applyMasteryAttempt(m, true);
  assert.equal(m.consecutiveCorrect, 5);
  assert.equal(m.masteryStatus, "mastered");
  assert.ok(m.masteredAt);
  const firstMasteredAt = m.masteredAt;

  // Optional review wrong answer must NEVER erase permanent mastery!
  m = applyMasteryAttempt(m, false, { isReview: true });
  assert.equal(m.masteryStatus, "mastered");
  assert.equal(m.consecutiveCorrect, 5);
  assert.equal(m.masteredAt, firstMasteredAt);
  assert.equal(m.totalIncorrect, 2);

  assert.equal(
    EXAM_STRUCTURE.Lesen.parts.reduce((a, b) => a + b),
    30,
  );
});

test("Tests 1-8 & 12: strict CEFR filtering, 5/5 progress, atomic double-submission guard, and user isolation", async () => {
  const db = createClient({ url: "file::memory:" });
  const app = express();
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

    // Seed A1 and B1 entries explicitly
    const parsed = parseDocument({
      body: {
        content: [
          paragraph("A1"),
          paragraph("der Apfel — elma"),
          paragraph("das Haus — ev"),
          paragraph("B1"),
          paragraph("die Bewerbung — başvuru"),
        ],
      },
    });
    for (const w of parsed.entries) {
      await db.execute({
        sql: "INSERT INTO german_words(id,data,active,imported_at,cefr_level,canonical_key,topic) VALUES(?,?,1,?,?,?,?)",
        args: [w.id, JSON.stringify(w), new Date().toISOString(), w.level, w.canonicalKey, w.topic],
      });
    }

    // Strict filtering guards
    assert.equal((await ask("/sessions", 1, { levels: [] })).status, 400);
    assert.equal((await ask("/sessions", 1, { levels: ["C1"] })).status, 409);
    assert.equal((await ask("/sessions", 1, { levels: ["B1"], direction: "invalid" })).status, 400);

    // Selecting ONLY A1 must never include B1 words
    const a1Start = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
      activity: "translation",
      levels: ["A1"],
    }).then((r) => r.json());
    const a1Session = await ask("/sessions/" + a1Start.id).then((r) => r.json());
    assert.ok(a1Session.tasks.every((t: any) => t.level === "A1"));

    // Selecting ONLY B1 starts a DIFFERENT session instead of returning the A1 active session!
    const b1Start = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
      activity: "translation",
      levels: ["B1"],
    }).then((r) => r.json());
    assert.notEqual(b1Start.id, a1Start.id);
    const b1Session = await ask("/sessions/" + b1Start.id).then((r) => r.json());
    assert.ok(b1Session.tasks.every((t: any) => t.level === "B1"));

    // Test 12: Double checking the same task awards XP and increments mastery ONLY ONCE!
    const b1Task = b1Session.tasks[0];
    const [chk1, chk2] = await Promise.all([
      ask("/sessions/" + b1Start.id + "/check", 1, {
        taskId: b1Task.id,
        answer: "die Bewerbung",
      }).then((r) => r.json()),
      ask("/sessions/" + b1Start.id + "/check", 1, {
        taskId: b1Task.id,
        answer: "die Bewerbung",
      }).then((r) => r.json()),
    ]);
    assert.equal(chk1.xpAwarded + chk2.xpAwarded, 5, "Duplicate check must award XP only once");

    // Check 4 more times in new sessions to hit 5/5 Mastered on B1 (1/1 words = 100%)
    await ask("/sessions/" + b1Start.id + "/submit", 1, {});
    for (let step = 2; step <= 5; step++) {
      const nextStart = await ask("/sessions", 1, {
        module: "vocabulary",
        mode: "practice",
        activity: "translation",
        levels: ["B1"],
      }).then((r) => r.json());
      const nextSess = await ask("/sessions/" + nextStart.id).then((r) => r.json());
      const chk = await ask("/sessions/" + nextStart.id + "/check", 1, {
        taskId: nextSess.tasks[0].id,
        answer: "die Bewerbung",
      }).then((r) => r.json());
      const updatedMastery = Object.values(chk.masteryUpdates)[0] as any;
      assert.equal(updatedMastery.consecutiveCorrect, step);
      assert.equal(
        updatedMastery.masteryStatus,
        step === 5 ? "mastered" : step === 4 ? "almost_mastered" : "learning",
      );
      await ask("/sessions/" + nextStart.id + "/submit", 1, {});
    }

    // Verify B1 progress is 100% and A1 progress is 0% for User 1, while User 2 is completely isolated (0%)
    const ownerOverview = await ask("/overview?compact=1", 1).then((r) => r.json());
    const user2Overview = await ask("/overview?compact=1", 2).then((r) => r.json());
    const ownerB1 = ownerOverview.progressByLevel.find((p: any) => p.level === "B1");
    const ownerA1 = ownerOverview.progressByLevel.find((p: any) => p.level === "A1");
    const user2B1 = user2Overview.progressByLevel.find((p: any) => p.level === "B1");
    assert.equal(ownerB1.mastered, 1);
    assert.equal(ownerB1.percent, 100);
    assert.equal(ownerA1.mastered, 0);
    assert.equal(ownerA1.percent, 0);
    assert.equal(user2B1.mastered, 0);
    assert.equal(user2B1.percent, 0);

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

test("idempotent Google synchronization preserves mastery, deduplicates, and fails safely", async () => {
  const { encrypt } = await import("../src/server/german/google");
  const db = createClient({ url: "file::memory:" });
  const app = express();
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
  let fail = false;
  let content = "A1\nder Apfel — elma";
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
            (await db.execute("SELECT COUNT(*) AS n FROM german_jobs")).rows[0].n,
          ) > n
        )
          return;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.fail("sync stalled");
    }

    await run();
    const first = (await db.execute("SELECT * FROM german_words")).rows[0];
    assert.equal(first.cefr_level, "A1");

    await db.execute({
      sql: "INSERT INTO german_mastery(user_id,word_id,cefr_level,consecutive_correct,total_correct,total_incorrect,mastery_status) VALUES(1,?,'A1',4,4,0,'almost_mastered')",
      args: [first.id],
    });

    await run();
    assert.equal(
      (await db.execute("SELECT COUNT(*) AS n FROM german_words")).rows[0].n,
      1,
    );
    content = "A1\nder Apfel — elma meyvesi";
    await run();
    assert.equal(
      (await db.execute("SELECT id FROM german_words WHERE active=1")).rows[0].id,
      first.id,
    );
    assert.equal(
      (await db.execute("SELECT consecutive_correct FROM german_mastery")).rows[0]
        .consecutive_correct,
      4,
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
  } finally {
    globalThis.fetch = native;
    delete process.env.KAPS_GERMAN_TOKEN_KEY;
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});

test("practice lifecycle: expired resume does not auto-fail, blank guard, cursor recovery, concurrent start", async () => {
  const db = createClient({ url: "file::memory:" });
  const app = express();
  await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)");
  await db.execute("INSERT INTO users VALUES(1,'Emirgan')");
  registerGerman(app, db, async () => ({ id: 1 }), (_q, _r, n) => n());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const ask = (path: string, body?: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/kaps-german${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer lifecycle-test",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  try {
    await ask("/access");
    for (const line of ["A1", "der Apfel — elma", "die Schule — okul"]) {
      if (line === "A1") continue;
      const w = parseDocument({
        body: { content: [paragraph("A1"), paragraph(line)] },
      }).entries[0];
      await db.execute({
        sql: "INSERT INTO german_words(id,data,active,imported_at,cefr_level,canonical_key,topic) VALUES(?,?,1,?,?,?,?)",
        args: [w.id, JSON.stringify(w), new Date().toISOString(), w.level, w.canonicalKey, w.topic],
      });
    }
    const starts = await Promise.all([
      ask("/sessions", { activity: "translation", levels: ["A1"] }),
      ask("/sessions", { activity: "translation", levels: ["A1"] }),
    ]);
    const ids = await Promise.all(starts.map((r) => r.json()));
    assert.equal(ids[0].id, ids[1].id);
    const id = ids[0].id;
    await db.execute({
      sql: "UPDATE german_sessions SET deadline=? WHERE id=?",
      args: ["2020-01-01T00:00:00Z", id],
    });
    assert.equal(
      (await ask("/sessions", { activity: "translation", levels: ["A1"] }).then((r) => r.json())).id,
      id,
    );
    assert.equal((await ask("/sessions/" + id + "/submit", {})).status, 422);
    let session = await ask("/sessions/" + id).then((r) => r.json());
    assert.equal(session.state, "active");
    const stored = JSON.parse(
      String(
        (await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [id] }))
          .rows[0].tasks,
      ),
    );
    const saved = await ask("/sessions/" + id + "/answer", {
      taskId: session.tasks[0].id,
      answer: stored[0].answer,
      version: session.version,
      draft: true,
      positionTaskId: session.tasks[1].id,
    });
    assert.equal(saved.status, 200);
    session = await ask("/sessions/" + id).then((r) => r.json());
    assert.equal(session.position, 1);
    assert.equal(session.answers[stored[0].id], stored[0].answer);
    assert.equal((await ask("/sessions/" + id + "/submit", {})).status, 202);
    session = await ask("/sessions/" + id).then((r) => r.json());
    assert.equal(session.state, "done");
    assert.equal(session.results[stored[0].id].score, 1);
    assert.equal((await db.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
