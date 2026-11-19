import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { after, before, test } from "node:test";
import express from "express";
import { createClient } from "@libsql/client";
import { registerTravel } from "../src/server/travel";
import {
  emptyEntry,
  emptyTrip,
  TRAVEL_API,
  tripStats,
  distanceKm,
} from "../src/shared/travel";
import { resolveAyvalikUser } from "../src/server/ayvalikAuth";
import { getTabFromPathname } from "../src/routes";

const db = createClient({ url: "file::memory:" });
const app = express();
let server: ReturnType<typeof app.listen>;
let base = "";
const trip = randomUUID(),
  place = randomUUID();
const auth = (id: number) => ({
  Authorization: "Bearer user-" + id,
  "Content-Type": "application/json",
});
const send = (path: string, id: number, body?: unknown) =>
  fetch(base + TRAVEL_API + path, {
    headers: auth(id),
    method: body === undefined ? "GET" : "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const mutation = (id: number, body: unknown) =>
  send("/trip/" + trip + "/mutate", id, body);
before(async () => {
  await db.execute(
    "CREATE TABLE users (id INTEGER PRIMARY KEY,username TEXT,token TEXT,avatar TEXT,color TEXT,roles TEXT,is_admin INTEGER DEFAULT 0,is_banned INTEGER DEFAULT 0,isBanned INTEGER DEFAULT 0,status TEXT DEFAULT 'approved')",
  );
  await db.execute(
    "CREATE TABLE user_sessions(user_id INTEGER,token TEXT,expires_at TEXT)",
  );
  for (const [id, name] of [
    [1, "Dido"],
    [2, "Emirgan"],
    [3, "Admin"],
    [4, "dido"],
  ]) {
    await db.execute({
      sql: "INSERT INTO users(id,username,token,is_admin) VALUES(?,?,?,?)",
      args: [id, name, "user-" + id, id === 3 ? 1 : 0],
    });
  }
  await db.execute(
    "INSERT INTO user_sessions VALUES(1,'second-device','2099-01-01T00:00:00.000Z')",
  );
  registerTravel(
    app,
    db,
    (req) => resolveAyvalikUser(req, db),
    (_req, _res, next) => next(),
    [1, 2],
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = "http://127.0.0.1:" + address.port;
});
after(async () => {
  server?.closeAllConnections();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  db.close();
});

test("private authorization requires verified stable IDs on every path", async () => {
  assert.equal((await fetch(base + TRAVEL_API + "/access")).status, 401);
  assert.equal(
    (await fetch(base + TRAVEL_API + "/access?token=user-1")).status,
    401,
  );
  for (const id of [3, 4]) {
    for (const path of [
      "/access",
      "/trips",
      "/trip/" + trip,
      "/trip/" + trip + "/mutate",
      "/anything",
    ]) {
      assert.equal(
        (
          await send(
            path,
            id,
            path.endsWith("mutate") ? { operation: "trip" } : undefined,
          )
        ).status,
        403,
      );
    }
  }
  assert.equal((await send("/access", 1)).status, 200);
  assert.equal(
    (
      await fetch(base + TRAVEL_API + "/access", {
        headers: { Authorization: "Bearer second-device" },
      })
    ).status,
    200,
  );
  await db.execute("UPDATE users SET username='Renamed' WHERE id=1");
  assert.equal((await send("/access", 1)).status, 200);
  await db.execute("UPDATE users SET is_banned=1 WHERE id=1");
  assert.equal((await send("/access", 1)).status, 401);
  await db.execute("UPDATE users SET is_banned=0 WHERE id=1");
  assert.equal(
    getTabFromPathname("/gezi-planlama/" + trip + "/budget").tab,
    "travel",
  );
  assert.equal(getTabFromPathname("/gezi-planlamax").tab, "dashboard");
});
test("shared trip, persistent entries, and idempotent creation", async () => {
  const body = {
    id: trip,
    data: {
      ...emptyTrip(),
      name: "Budapeşte",
      destination: "Budapest",
      budget: 100000,
    },
  };
  assert.equal((await send("/trips", 1, body)).status, 201);
  assert.equal((await send("/trips", 1, body)).status, 201);
  const list = await send("/trips", 2).then((r) => r.json());
  assert.equal(list.trips.length, 1);
  assert.equal(list.trips[0].data.name, "Budapeşte");
  assert.equal(
    (
      await mutation(1, {
        operation: "create",
        id: place,
        kind: "place",
        data: {
          ...emptyEntry(),
          title: "Buda",
          lat: 47.5,
          lng: 19.03,
          estimated: 2000,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await mutation(1, {
        operation: "create",
        id: place,
        kind: "place",
        data: {
          ...emptyEntry(),
          title: "Buda",
          lat: 47.5,
          lng: 19.03,
          estimated: 2000,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await mutation(1, {
        operation: "create",
        id: place,
        kind: "place",
        data: { ...emptyEntry(), title: "Changed after lost response" },
      })
    ).status,
    409,
  );
  const snapshot = await send("/trip/" + trip, 2).then((r) => r.json());
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.entries[0].createdBy, 1);
  assert.equal((await send("/trip/" + randomUUID(), 1)).status, 404);
  assert.deepEqual(
    await send("/trip/" + trip + "?revision=" + snapshot.trip.revision, 1).then(
      (r) => r.json(),
    ),
    { unchanged: true },
  );
});
test("simultaneous edits and delete conflicts preserve the winning record", async () => {
  const before = await send("/trip/" + trip, 1).then((r) => r.json());
  const entry = before.entries[0];
  const responses = await Promise.all(
    [1, 2].map((id) =>
      mutation(id, {
        operation: "update",
        id: place,
        version: entry.version,
        data: { ...entry.data, title: "Version " + id },
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const after = await send("/trip/" + trip, 2).then((r) => r.json());
  assert.equal(after.entries[0].version, 2);
  assert.equal(
    (await mutation(2, { operation: "delete", id: place, version: 1 })).status,
    409,
  );
  assert.equal(after.trip.revision, before.trip.revision + 1);
  const metadata = {
    operation: "trip",
    version: after.trip.version,
    data: { ...after.trip.data, description: "One edit" },
  };
  const edits = await Promise.all([
    mutation(1, metadata),
    mutation(2, {
      ...metadata,
      data: { ...metadata.data, description: "Another edit" },
    }),
  ]);
  assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
});
test("votes belong to the authenticated voter and comments are private to the pair", async () => {
  const decision = randomUUID();
  assert.equal(
    (
      await mutation(1, {
        operation: "create",
        id: decision,
        kind: "decision",
        data: {
          ...emptyEntry(),
          title: "Müze mi?",
          options: ["Evet", "Sonra"],
        },
      })
    ).status,
    200,
  );
  await mutation(1, {
    operation: "vote",
    id: decision,
    choice: "Evet",
    userId: 2,
  });
  await mutation(1, { operation: "vote", id: decision, choice: "Sonra" });
  await mutation(2, { operation: "vote", id: decision, choice: "Evet" });
  let snapshot = await send("/trip/" + trip, 1).then((r) => r.json());
  assert.equal(snapshot.votes.length, 2);
  assert.equal(
    snapshot.votes.find((v: { userId: number }) => v.userId === 1).choice,
    "Sonra",
  );
  const comment = randomUUID();
  await mutation(1, {
    operation: "create",
    id: comment,
    kind: "comment",
    data: {
      ...emptyEntry(),
      title: "Aklımda",
      text: "Birlikte",
      parentId: decision,
    },
  });
  assert.equal(
    (await mutation(2, { operation: "delete", id: comment, version: 1 }))
      .status,
    403,
  );
  assert.equal(
    (await mutation(2, { operation: "delete", id: decision, version: 1 }))
      .status,
    200,
  );
  snapshot = await send("/trip/" + trip, 1).then((r) => r.json());
  assert.equal(snapshot.votes.length, 0);
  assert.ok(!snapshot.entries.some((e: { id: string }) => e.id === comment));
  assert.equal(
    (
      await mutation(1, {
        operation: "create",
        id: randomUUID(),
        kind: "comment",
        data: { ...emptyEntry(), title: "Bad parent", parentId: randomUUID() },
      })
    ).status,
    400,
  );
});
test("validation rejects injection URLs, oversized input, invalid money, dates and forged members", async () => {
  for (const data of [
    { url: "javascript:alert(1)" },
    { actual: -1 },
    { estimated: 0.1 },
    { date: "2026-02-30" },
    { assignee: 3 },
    { lat: 90.1, lng: 0 },
    { lat: 47.5, lng: null },
    { title: "x".repeat(201) },
  ]) {
    assert.equal(
      (
        await mutation(1, {
          operation: "create",
          id: randomUUID(),
          kind: "place",
          data: { ...emptyEntry(), title: "Test", ...data },
        })
      ).status,
      400,
    );
  }
  const response = await fetch(base + TRAVEL_API + "/trips", {
    method: "POST",
    headers: auth(1),
    body: JSON.stringify({
      id: randomUUID(),
      data: { ...emptyTrip(), name: "x".repeat(40000) },
    }),
  });
  assert.equal(response.status, 413);
  const snapshot = await send("/trip/" + trip, 1).then((r) => r.json());
  assert.equal(
    (
      await mutation(1, {
        operation: "trip",
        version: snapshot.trip.version,
        data: { ...snapshot.trip.data, currency: "HUF" },
      })
    ).status,
    409,
  );
  assert.equal((await send("/trip/not-a-uuid", 1)).status, 404);
});
test("budget math, stats and approximate distances use actual data", async () => {
  const expense = {
    ...emptyEntry(),
    title: "Hotel",
    estimated: 25000,
    actual: 20000,
    assignee: 1,
  };
  await mutation(1, {
    operation: "create",
    id: randomUUID(),
    kind: "expense",
    data: expense,
  });
  const snapshot = await send("/trip/" + trip, 2).then((r) => r.json());
  const stats = tripStats(snapshot.entries);
  assert.equal(stats.estimated, 25000);
  assert.equal(stats.actual, 20000);
  assert.equal(
    distanceKm(
      { ...emptyEntry(), lat: 47.5, lng: 19 },
      { ...emptyEntry(), lat: 47.5, lng: 19 },
    ),
    0,
  );
  const list = await send("/trips", 1).then((r) => r.json());
  assert.equal(list.trips[0].summary.places, 1);
  assert.equal(
    (await db.execute("PRAGMA integrity_check")).rows[0].integrity_check,
    "ok",
  );
});
test("missing configuration and replacing pinned identities both fail closed", async () => {
  for (const ids of [
    [NaN, NaN],
    [1, 3],
  ]) {
    const isolated = express();
    registerTravel(
      isolated,
      db,
      (req) => resolveAyvalikUser(req, db),
      (_req, _res, next) => next(),
      ids,
    );
    const listener = isolated.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(
      "http://127.0.0.1:" + address.port + TRAVEL_API + "/access",
      { headers: auth(1) },
    );
    assert.ok([403, 503].includes(response.status));
    listener.closeAllConnections();
    await new Promise<void>((resolve) => listener.close(() => resolve()));
  }
  for (let i = 0; i < 95; i++) await mutation(1, { operation: "invalid" });
  assert.equal((await mutation(1, { operation: "invalid" })).status, 429);
});
