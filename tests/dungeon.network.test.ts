import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as connect, Socket } from "socket.io-client";
import { DungeonManager } from "../src/server/dungeonServer";
import { createClient } from "@libsql/client";
const request = (s: Socket, event: string, data: any = {}) =>
  new Promise<any>((resolve, reject) =>
    s
      .timeout(2000)
      .emit("dungeon:" + event, data, (err: any, r: any) =>
        err ? reject(err) : resolve(r),
      ),
  );
async function setup() {
  const http = createServer(),
    io = new Server(http),
    db = createClient({ url: ":memory:" }),
    manager = new DungeonManager(io, db);
  await manager.initialize();
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (http.address() as any).port;
  io.on("connection", (s) =>
    manager.register(s, {
      id: Number(s.handshake.auth.id),
      username: "Player" + s.handshake.auth.id,
    }),
  );
  const clients: Socket[] = [];
  const join = async (id: number) => {
    const s = connect(`http://127.0.0.1:${port}`, {
      auth: { id },
      transports: ["websocket"],
      forceNew: true,
    });
    clients.push(s);
    await new Promise<void>((r) => s.on("connect", r));
    return s;
  };
  return {
    manager,
    db,
    join,
    close: async () => {
      clients.forEach((s) => s.disconnect());
      manager.destroy();
      await new Promise<void>((r) => io.close(() => r()));
      db.close();
    },
  };
}
const config = {
  name: "Network expedition",
  capacity: 2,
  difficulty: "explorer",
  private: false,
  password: "",
};
test("real sockets: lobby validation, capacity race, ready, authoritative movement, reconnect, duplicate sessions", async () => {
  const f = await setup();
  try {
    const a = await f.join(1),
      b = await f.join(2),
      c = await f.join(3);
    const created = await request(a, "create", config);
    assert.ok(created.ok);
    assert.equal((await request(a, "start")).ok, false);
    const results = await Promise.all([
      request(b, "join", { code: created.code }),
      request(c, "join", { code: created.code }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    const guest = results[0].ok ? b : c;
    const gid = results[0].ok ? 2 : 3;
    assert.equal((await request(guest, "start")).ok, false);
    await request(a, "ready", { ready: true });
    await request(guest, "ready", { ready: true });
    assert.ok((await request(a, "start")).ok);
    const room = f.manager.rooms.get(created.code)!;
    assert.equal(room.run!.players.length, 2);
    assert.equal((await request(a, "class", { hero: "mage" })).ok, false);
    assert.equal(
      (
        await request(a, "input", {
          seq: 1,
          floor: 1,
          action: "move",
          dx: 999,
          dy: 0,
        })
      ).ok,
      false,
    );
    const before = room.players[0].x;
    assert.ok(
      (
        await request(a, "input", {
          seq: 2,
          floor: 1,
          action: "move",
          dx: 1,
          dy: 0,
        })
      ).ok,
    );
    assert.equal(room.players[0].x, before + 1);
    assert.equal(
      (
        await request(a, "input", {
          seq: 2,
          floor: 1,
          action: "move",
          dx: 1,
          dy: 0,
        })
      ).ok,
      false,
    );
    a.disconnect();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(room.host, gid);
    assert.equal(room.players[0].connected, false);
    const reconnect = await f.join(1);
    assert.equal((await request(reconnect, "resume")).code, created.code);
    assert.ok((await request(reconnect, "join", { code: created.code })).ok);
    assert.equal(room.players[0].x, before + 1);
    const duplicate = await f.join(1);
    assert.ok((await request(duplicate, "join", { code: created.code })).ok);
    assert.equal(
      (
        await request(reconnect, "input", {
          seq: 3,
          floor: 1,
          action: "interact",
        })
      ).ok,
      false,
    );
    assert.equal(room.players.filter((p) => p.id === 1).length, 1);
  } finally {
    await f.close();
  }
});
test("private lobby secrets absent, password required, new join refused midrun", async () => {
  const f = await setup();
  try {
    const a = await f.join(1),
      b = await f.join(2),
      c = await f.join(3);
    let state: any;
    a.on("dungeon:state", (s) => (state = s));
    const created = await request(a, "create", {
      ...config,
      capacity: 3,
      private: true,
      password: "secret",
    });
    assert.equal((await request(b, "list")).rooms.length, 0);
    assert.equal(
      (await request(b, "join", { code: created.code, password: "wrong" })).ok,
      false,
    );
    assert.ok(
      (await request(b, "join", { code: created.code, password: "secret" })).ok,
    );
    assert.ok(!JSON.stringify(state).includes("secret"));
    assert.equal(state.passwordHash, undefined);
    await request(a, "ready", { ready: true });
    await request(b, "ready", { ready: true });
    await request(a, "start");
    assert.equal(
      (await request(c, "join", { code: created.code, password: "secret" })).ok,
      false,
    );
  } finally {
    await f.close();
  }
});
test("idempotent database rewards survive repeated saves and profile uses authenticated ID", async () => {
  const f = await setup();
  try {
    const a = await f.join(1),
      b = await f.join(2);
    const { code } = await request(a, "create", config);
    await request(b, "join", { code });
    await request(a, "ready", { ready: true });
    await request(b, "ready", { ready: true });
    await request(a, "start");
    const r = f.manager.rooms.get(code)!;
    r.run!.status = "won";
    r.run!.players[0].stats.kills = 7;
    await Promise.all([f.manager.persist(r), f.manager.persist(r)]);
    r.run!.rewardState = "retry";
    await f.manager.persist(r);
    const rows = await f.db.execute("SELECT * FROM dungeon_results");
    assert.equal(rows.rows.length, 2);
    const p = await request(a, "profile", { userId: 2 });
    assert.equal(p.wins, 1);
    assert.equal(p.kills, 7);
    assert.equal(p.title, "Kuşatma Kahramanı");
  } finally {
    await f.close();
  }
});
test("malformed events, cross-room input, explicit departure, room cleanup and expired reconnect", async () => {
  const f = await setup();
  try {
    const a = await f.join(1),
      b = await f.join(2),
      c = await f.join(3);
    assert.equal((await request(a, "create", null)).ok, false);
    const { code } = await request(a, "create", config);
    await request(b, "join", { code });
    await request(a, "ready", { ready: true });
    await request(b, "ready", { ready: true });
    await request(a, "start");
    assert.equal(
      (
        await request(c, "input", {
          code,
          seq: 1,
          floor: 1,
          action: "interact",
          userId: 1,
        })
      ).ok,
      false,
    );
    await request(a, "leave");
    const r = f.manager.rooms.get(code)!;
    assert.ok(r.players[0].dead);
    assert.equal((await request(a, "join", { code })).ok, false);
    b.disconnect();
    await new Promise((r) => setTimeout(r, 20));
    r.gone.set(2, 0);
    f.manager.tick();
    assert.ok(r.players[1].dead);
    assert.equal(r.run!.status, "lost");
    await f.manager.persist(r);
    for (let i = 0; i < 100 && r.run!.rewardState !== "saved"; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(r.run!.rewardState, "saved");
    r.updated = 0;
    f.manager.tick();
    assert.equal(f.manager.rooms.size, 0);
    assert.equal(f.manager.membership.size, 0);
  } finally {
    await f.close();
  }
});

test("reward retry keeps victory eligibility after both players leave and partial DB failure", async () => {
  const f = await setup();
  try {
    const a = await f.join(1),
      b = await f.join(2);
    const { code } = await request(a, "create", config);
    await request(b, "join", { code });
    await request(a, "ready", { ready: true });
    await request(b, "ready", { ready: true });
    await request(a, "start");
    const r = f.manager.rooms.get(code)!;
    r.run!.status = "won";
    const original = (f.manager as any).db;
    let writes = 0;
    (f.manager as any).db = {
      execute: async (query: any) => {
        if (++writes === 2) throw Error("simulated temporary storage outage");
        return original.execute(query);
      },
    };
    await f.manager.persist(r);
    assert.equal(r.run!.rewardState, "retry");
    await request(a, "leave");
    await request(b, "leave");
    assert.ok(
      f.manager.rooms.has(code),
      "Pending results retain the room for retry",
    );
    (f.manager as any).db = original;
    await f.manager.persist(r);
    const results = await f.db.execute(
      "SELECT won FROM dungeon_results ORDER BY user_id",
    );
    assert.deepEqual(
      results.rows.map((row) => row.won),
      [1, 1],
    );
    r.updated = 0;
    f.manager.tick();
    assert.equal(f.manager.rooms.size, 0);
  } finally {
    await f.close();
  }
});

test("cleanup of an abandoned expedition does not erase a newly created room membership", async () => {
  const f = await setup();
  try {
    const a = await f.join(1),
      b = await f.join(2);
    const { code } = await request(a, "create", config);
    await request(b, "join", { code });
    await request(a, "ready", { ready: true });
    await request(b, "ready", { ready: true });
    await request(a, "start");
    await request(a, "leave");
    const second = await request(a, "create", config);
    assert.ok(second.ok);
    f.manager.tick();
    assert.equal(f.manager.membership.get(1), second.code);
    assert.ok((await request(a, "ready", { ready: true })).ok);
  } finally {
    await f.close();
  }
});
