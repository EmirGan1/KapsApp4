import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import express from "express";
import { createClient } from "@libsql/client";
import { registerUniversity } from "../src/server/university";
import { emptyUniversityData } from "../src/shared/university";
import { resolveAyvalikUser } from "../src/server/ayvalikAuth";
const db = createClient({ url: "file::memory:" });
const app = express();
let server: ReturnType<typeof app.listen>,
  base = "";
const folder = randomUUID(),
  record = randomUUID();
const data = {
  ...emptyUniversityData(),
  title: "Sertifika",
  category: "certificates",
};
const headers = (id = 11) => ({
  Authorization: "Bearer u-" + id,
  "Content-Type": "application/json",
});
const req = (path: string, body?: unknown, id = 11) =>
  fetch(base + "/api/university-vault" + path, {
    headers: headers(id),
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
before(async () => {
  await db.execute(
    "CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,token TEXT,is_admin INTEGER,is_banned INTEGER,isBanned INTEGER,status TEXT,avatar TEXT,color TEXT,roles TEXT)",
  );
  await db.execute(
    "CREATE TABLE user_sessions(user_id INTEGER,token TEXT,expires_at TEXT)",
  );
  for (const [id, name] of [
    [11, "Emirgan"],
    [12, "Dido"],
    [13, "emirgan"],
  ])
    await db.execute({
      sql: "INSERT INTO users VALUES(?,?,?,1,0,0,'approved','','','')",
      args: [id, name, "u-" + id],
    });
  process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID = "11";
  registerUniversity(
    app,
    db,
    (r) => resolveAyvalikUser(r, db),
    (_r, _s, next) => next(),
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const a = server.address();
  assert.ok(a && typeof a !== "string");
  base = "http://127.0.0.1:" + a.port;
});
after(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  db.close();
  delete process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID;
});
test("only pinned owner, including downloads; username and admin do not grant access", async () => {
  assert.equal(
    (await fetch(base + "/api/university-vault/access")).status,
    401,
  );
  assert.equal(
    (await fetch(base + "/api/university-vault/access?token=u-11")).status,
    401,
  );
  for (const id of [12, 13])
    for (const path of ["/access", "/items", "/items/" + record + "/file"])
      assert.equal((await req(path, undefined, id)).status, 403);
  assert.equal((await req("/access")).status, 200);
  await db.execute("UPDATE users SET username='Renamed' WHERE id=11");
  assert.equal((await req("/access")).status, 200);
  await db.execute("UPDATE users SET is_banned=1 WHERE id=11");
  assert.equal((await req("/access")).status, 401);
  await db.execute("UPDATE users SET is_banned=0 WHERE id=11");
});
test("folders, records, moves and circular folder rejection", async () => {
  assert.equal(
    (
      await req("/items", {
        id: folder,
        kind: "folder",
        data: { ...data, title: "Belgeler" },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/items", {
        id: record,
        parentId: folder,
        kind: "record",
        data,
      })
    ).status,
    200,
  );
  const child = randomUUID();
  await req("/items", {
    id: child,
    kind: "folder",
    parentId: folder,
    data: { ...data, title: "Alt klasör" },
  });
  assert.equal(
    (
      await req("/items", {
        id: folder,
        version: 1,
        kind: "folder",
        parentId: child,
        data,
      })
    ).status,
    400,
  );
  assert.equal(
    (await req("/items/" + folder + "/delete", { version: 1 })).status,
    409,
  );
  const list = await req("/items").then((r) => r.json());
  assert.equal(list.items.length, 3);
  assert.equal(list.items.find((i: any) => i.id === record).parentId, folder);
});
test("simultaneous edits preserve current version", async () => {
  const edits = await Promise.all(
    ["Bir", "İki"].map((title) =>
      req("/items", {
        id: record,
        parentId: folder,
        kind: "record",
        version: 1,
        data: { ...data, title },
      }),
    ),
  );
  assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (await req("/items/" + record + "/delete", { version: 1 })).status,
    409,
  );
});
test("private file roundtrip, replacement and signatures", async () => {
  const form = new FormData();
  form.append("version", "2");
  form.append(
    "file",
    new Blob(["%PDF-1.7\nprivate document"], { type: "application/pdf" }),
    "certificate.pdf",
  );
  const uploaded = await fetch(
    base + "/api/university-vault/items/" + record + "/file",
    { method: "POST", headers: { Authorization: "Bearer u-11" }, body: form },
  );
  assert.equal(uploaded.status, 200);
  const response = await req("/items/" + record + "/file");
  assert.match(response.headers.get("content-disposition")!, /^attachment/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "%PDF-1.7\nprivate document");
  const list = await req("/items").then((r) => r.json());
  assert.ok(!JSON.stringify(list).includes("private document"));
  assert.equal(
    list.items.find((i: any) => i.id === record).file.hash.length,
    64,
  );
  const bad = new FormData();
  bad.append("version", "3");
  bad.append("file", new Blob(["<script>alert(1)</script>"]), "evil.pdf");
  assert.equal(
    (
      await fetch(base + "/api/university-vault/items/" + record + "/file", {
        method: "POST",
        headers: { Authorization: "Bearer u-11" },
        body: bad,
      })
    ).status,
    400,
  );
  const stale = new FormData();
  stale.append("version", "2");
  stale.append("file", new Blob(["%PDF-1.7\nstale"]), "old.pdf");
  assert.equal(
    (
      await fetch(base + "/api/university-vault/items/" + record + "/file", {
        method: "POST",
        headers: { Authorization: "Bearer u-11" },
        body: stale,
      })
    ).status,
    409,
  );
});
test("application evidence links, safe deletion, input limits and pinned identity", async () => {
  const application = randomUUID();
  await req("/items", {
    id: application,
    kind: "record",
    data: {
      ...data,
      title: "RWTH",
      category: "applications",
      requirementIds: [record],
    },
  });
  assert.equal(
    (await req("/items/" + record + "/delete", { version: 3 })).status,
    409,
  );
  assert.equal(
    (
      await req("/items", {
        id: randomUUID(),
        kind: "record",
        data: { ...data, url: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/items", {
        id: randomUUID(),
        kind: "record",
        data: { ...data, date: "2026-02-31" },
      })
    ).status,
    400,
  );
  await req("/items/" + application + "/delete", { version: 1 });
  assert.equal(
    (await req("/items/" + record + "/delete", { version: 3 })).status,
    200,
  );
  assert.equal((await req("/items/" + record + "/file")).status, 404);
  process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID = "12";
  assert.equal((await req("/access", undefined, 12)).status, 403);
  process.env.KAPSAPP_UNIVERSITY_EMIRGAN_ID = "11";
  assert.equal(
    (await db.execute("PRAGMA integrity_check")).rows[0].integrity_check,
    "ok",
  );
});
