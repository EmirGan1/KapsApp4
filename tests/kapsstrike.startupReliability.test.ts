import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
import { StrikeController } from "../src/games/kapsstrike/controller";
import { DEFAULT_SETTINGS } from "../src/games/kapsstrike/config";
import type { StrikeSnapshot, StrikeRoomState } from "../src/games/kapsstrike/types";

interface Harness {
  io: SocketIOServer;
  manager: KapsStrikeServerManager;
  port: number;
  connectUser: (user: { id: number; username: string; avatar?: string | null; color?: string }) => Promise<ClientSocket>;
  close: () => Promise<void>;
}

async function createSocketHarness(): Promise<Harness> {
  const httpServer = http.createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    pingTimeout: 30000,
    pingInterval: 12000,
    connectTimeout: 25000,
  });
  const manager = new KapsStrikeServerManager(io);
  const clients: ClientSocket[] = [];

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const id = Number(auth.userId || 1);
    const username = String(auth.username || `User${id}`);
    socket.data.user = {
      id,
      username,
      avatar: auth.avatar ?? null,
      color: auth.color ?? "#3b82f6",
    };
    next();
  });

  io.on("connection", (socket) => {
    const u = socket.data.user;
    manager.register(socket, u);
    socket.on("disconnect", () => {
      manager.handleDisconnect(socket, u.id);
    });
  });

  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const address = httpServer.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;

  const connectUser = async (user: { id: number; username: string; avatar?: string | null; color?: string }) => {
    const client = createClient(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      reconnection: false,
      auth: {
        userId: user.id,
        username: user.username,
        avatar: user.avatar ?? null,
        color: user.color ?? "#3b82f6",
      },
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("Timed out connecting socket")), 4000);
      client.once("connect", () => {
        clearTimeout(t);
        resolve();
      });
      client.once("connect_error", (err) => {
        clearTimeout(t);
        reject(err);
      });
    });
    return client;
  };

  const close = async () => {
    for (const c of clients) {
      try {
        c.disconnect();
      } catch {}
    }
    for (const room of manager.rooms.values()) {
      manager.stopRoomSimulationLoop(room);
    }
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  };

  return { io, manager, port, connectUser, close };
}

function emitAck<T = any>(socket: ClientSocket, event: string, ...args: any[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    socket.timeout(4000).emit(event, ...args, (err: Error | null, res: T) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
}

function waitForEvent<T = any>(socket: ClientSocket, event: string, timeoutMs = 4000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for event ${event}`));
    }, timeoutMs);
    const handler = (data: T) => {
      clearTimeout(timer);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

test("KapsStrike startup - Quick match accepts both ({}, cb) and (cb) without throwing", async () => {
  const h = await createSocketHarness();
  try {
    const c1 = await h.connectUser({ id: 101, username: "Alpha" });
    const c2 = await h.connectUser({ id: 102, username: "Bravo" });

    // Regression test: KapsStrikeGame emits ("strike:quick_match", {}, cb)
    const r1 = await emitAck<{ success: boolean; room?: StrikeRoomState }>(c1, "strike:quick_match", {});
    assert.equal(r1.success, true);
    assert.ok(r1.room?.roomCode);
    assert.equal(r1.room?.players.length, 1);

    // Also supports 1-arg signature ("strike:quick_match", cb)
    const r2 = await emitAck<{ success: boolean; room?: StrikeRoomState }>(c2, "strike:quick_match");
    assert.equal(r2.success, true);
    assert.equal(r2.room?.roomCode, r1.room?.roomCode);
    assert.equal(r2.room?.players.length, 2);
  } finally {
    await h.close();
  }
});

test("KapsStrike startup - First-attempt match start delivers immediate frame-0 snapshot & sync handshake", async () => {
  const h = await createSocketHarness();
  try {
    const host = await h.connectUser({ id: 201, username: "HostPlayer" });
    const guest = await h.connectUser({ id: 202, username: "GuestPlayer" });

    const created = await emitAck<{ success: boolean; room?: StrikeRoomState }>(host, "strike:create_room", {
      name: "First Try Arena",
      map: "dust2v2",
      mode: "tdm",
      maxPlayers: 8,
    });
    assert.equal(created.success, true);
    const roomCode = created.room!.roomCode;

    const joined = await emitAck<{ success: boolean; room?: StrikeRoomState }>(guest, "strike:join_room", {
      roomCode,
    });
    assert.equal(joined.success, true);
    assert.equal(joined.room?.players.length, 2);

    const hostSnapPromise = waitForEvent<StrikeSnapshot>(host, "strike:snapshot");
    const guestSnapPromise = waitForEvent<StrikeSnapshot>(guest, "strike:snapshot");
    const guestStartPromise = waitForEvent<StrikeRoomState>(guest, "strike:match_started");

    const started = await emitAck<{ success: boolean; error?: string }>(host, "strike:start_game", {});
    assert.equal(started.success, true);

    const [hostSnap, guestSnap, guestStart] = await Promise.all([
      hostSnapPromise,
      guestSnapPromise,
      guestStartPromise,
    ]);
    assert.equal(guestStart.status, "in_progress");
    assert.equal(hostSnap.roomCode, roomCode);
    assert.equal(guestSnap.roomCode, roomCode);
    assert.equal(hostSnap.players.length, 2);
    assert.equal(guestSnap.players.length, 2);
    assert.ok(hostSnap.localState, "Host snapshot must include authoritative localState");
    assert.ok(guestSnap.localState, "Guest snapshot must include authoritative localState");

    // Explicit strike:request_sync also returns authoritative snapshot immediately
    const syncRes = await emitAck<{
      success: boolean;
      status?: string;
      snapshot?: StrikeSnapshot;
    }>(guest, "strike:request_sync", { roomCode });
    assert.equal(syncRes.success, true);
    assert.equal(syncRes.status, "in_progress");
    assert.equal(syncRes.snapshot?.roomCode, roomCode);
    assert.equal(syncRes.snapshot?.players.length, 2);
  } finally {
    await h.close();
  }
});

test("KapsStrike startup - 6 players joining simultaneously synchronize cleanly without duplicates", async () => {
  const h = await createSocketHarness();
  try {
    const host = await h.connectUser({ id: 301, username: "Host6" });
    const created = await emitAck<{ success: boolean; room?: StrikeRoomState }>(host, "strike:create_room", {
      name: "Concurrent 6P",
      map: "warehouse",
      mode: "tdm",
      maxPlayers: 8,
    });
    const roomCode = created.room!.roomCode;

    const others = await Promise.all(
      [302, 303, 304, 305, 306].map((id) => h.connectUser({ id, username: `P${id}` }))
    );

    const joinResults = await Promise.all(
      others.map((client) =>
        emitAck<{ success: boolean; room?: StrikeRoomState }>(client, "strike:join_room", { roomCode })
      )
    );
    for (const res of joinResults) {
      assert.equal(res.success, true);
    }

    const room = h.manager.rooms.get(roomCode)!;
    assert.equal(room.players.size, 6);
    const uniqueUsers = new Set([...room.players.values()].map((p) => p.userId));
    assert.equal(uniqueUsers.size, 6);

    // Balanced teams (3 red, 3 blue)
    const red = [...room.players.values()].filter((p) => p.team === "red").length;
    const blue = [...room.players.values()].filter((p) => p.team === "blue").length;
    assert.equal(red, 3);
    assert.equal(blue, 3);

    // Start match and verify all 6 receive snapshots
    const allClients = [host, ...others];
    const snapsPromise = Promise.all(allClients.map((c) => waitForEvent<StrikeSnapshot>(c, "strike:snapshot")));
    const started = await emitAck<{ success: boolean }>(host, "strike:start_game", {});
    assert.equal(started.success, true);

    const snaps = await snapsPromise;
    assert.equal(snaps.length, 6);
    for (const snap of snaps) {
      assert.equal(snap.players.length, 6);
      assert.ok(snap.localState);
    }
  } finally {
    await h.close();
  }
});

test("KapsStrike reliability - Lobby disconnect grace preserves room & password-protected reconnect", async () => {
  const h = await createSocketHarness();
  try {
    const host1 = await h.connectUser({ id: 401, username: "HostGrace" });
    const created = await emitAck<{ success: boolean; room?: StrikeRoomState }>(host1, "strike:create_room", {
      name: "Locked Grace Room",
      map: "bollucav2",
      mode: "tdm",
      password: "kapspassword",
    });
    assert.equal(created.success, true);
    const roomCode = created.room!.roomCode;

    // Transient disconnect in lobby
    host1.disconnect();
    await new Promise((r) => setTimeout(r, 80));

    // Room must still exist within the 20s lobby grace period
    const roomAfterDrop = h.manager.rooms.get(roomCode);
    assert.ok(roomAfterDrop, "Lobby room must survive transient disconnect within grace period");
    assert.equal(roomAfterDrop.players.size, 1);

    // Unauthorized stranger still cannot join without password
    const stranger = await h.connectUser({ id: 499, username: "Stranger" });
    const strangerFail = await emitAck<{ success: boolean; error?: string }>(stranger, "strike:join_room", {
      roomCode,
    });
    assert.equal(strangerFail.success, false);

    // Reconnecting host with a brand-new socket ID seamlessly restores lobby session without re-entering password
    const host2 = await h.connectUser({ id: 401, username: "HostGrace" });
    const rejoined = await emitAck<{ success: boolean; room?: StrikeRoomState }>(host2, "strike:join_room", {
      roomCode,
    });
    assert.equal(rejoined.success, true);
    assert.equal(rejoined.room?.roomCode, roomCode);
    assert.equal(rejoined.room?.players.length, 1);
    assert.equal(roomAfterDrop.players.has(host2.id!), true);
    assert.equal(roomAfterDrop.players.get(host2.id!)?.isDisconnected, false);

    // Host can immediately start the match after reconnecting
    const started = await emitAck<{ success: boolean }>(host2, "strike:start_game", {});
    assert.equal(started.success, true);
    assert.equal(roomAfterDrop.status, "in_progress");
  } finally {
    await h.close();
  }
});

test("KapsStrike reliability - Mid-match disconnect & reconnect restores team, stats, and snapshot without duplicates", async () => {
  const h = await createSocketHarness();
  try {
    const host = await h.connectUser({ id: 501, username: "HostMatch" });
    const guest1 = await h.connectUser({ id: 502, username: "GuestMatch" });

    const created = await emitAck<{ success: boolean; room?: StrikeRoomState }>(host, "strike:create_room", {
      name: "Reconnect Match",
      map: "dust2v2",
      mode: "tdm",
    });
    const roomCode = created.room!.roomCode;
    await emitAck(guest1, "strike:join_room", { roomCode });

    await emitAck(host, "strike:start_game", {});
    const room = h.manager.rooms.get(roomCode)!;
    const guestBefore = room.players.get(guest1.id!)!;
    const originalTeam = guestBefore.team;
    guestBefore.kills = 4;
    guestBefore.score = 450;

    // Guest drops mid-match
    guest1.disconnect();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(room.players.size, 2);
    assert.equal(guestBefore.isDisconnected, true);

    // Guest reconnects with new socket ID and calls strike:request_sync (exact flow of StrikeController)
    const guest2 = await h.connectUser({ id: 502, username: "GuestMatch" });
    const syncRes = await emitAck<{
      success: boolean;
      status?: string;
      room?: StrikeRoomState;
      snapshot?: StrikeSnapshot;
    }>(guest2, "strike:request_sync", { roomCode });

    assert.equal(syncRes.success, true);
    assert.equal(syncRes.status, "in_progress");
    assert.ok(syncRes.snapshot);
    assert.equal(room.players.size, 2, "Must not duplicate player on reconnect");
    const guestAfter = room.players.get(guest2.id!)!;
    assert.ok(guestAfter, "New socket ID must own the player entry");
    assert.equal(guestAfter.isDisconnected, false);
    assert.equal(guestAfter.team, originalTeam);
    assert.equal(guestAfter.kills, 4);
    assert.equal(guestAfter.score, 450);

    // Repeated match flow: return to lobby and start a second match cleanly
    const resetPromise = waitForEvent<StrikeRoomState>(guest2, "strike:match_reset_to_lobby");
    const resetAck = await emitAck<{ success: boolean }>(host, "strike:return_to_lobby");
    assert.equal(resetAck.success, true);
    const resetRoom = await resetPromise;
    assert.equal(resetRoom.status, "lobby");

    const snap2Promise = waitForEvent<StrikeSnapshot>(guest2, "strike:snapshot");
    const started2 = await emitAck<{ success: boolean }>(host, "strike:start_game", {});
    assert.equal(started2.success, true);
    const snap2 = await snap2Promise;
    assert.equal(snap2.players.length, 2);
  } finally {
    await h.close();
  }
});

test("StrikeController - Transient disconnect does not pause/kick and slow scene.isReady() never deadlocks startup", async () => {
  // Minimal DOM + socket harness so StrikeController can run in Node without WebGL
  const prevWindow = (globalThis as any).window;
  const prevDocument = (globalThis as any).document;

  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const makeTarget = () => ({
    addEventListener(type: string, fn: any) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: any) {
      listeners.get(type)?.delete(fn);
    },
  });

  (globalThis as any).window = {
    ...makeTarget(),
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  (globalThis as any).document = {
    ...makeTarget(),
    hidden: false,
    pointerLockElement: null,
    exitPointerLock() {},
  };

  const fakeCanvas: any = {
    ...makeTarget(),
    tabIndex: 0,
    focus() {},
    getClientRects: () => [{ width: 1280, height: 720 }],
  };

  const loopRef: { fn: (() => void) | null } = { fn: null };
  let sceneReady = false; // Simulate async PBR textures still downloading!
  const fakeRenderer: any = {
    scene: { isReady: () => sceneReady },
    engine: {
      runRenderLoop(fn: () => void) {
        loopRef.fn = fn;
      },
      stopRenderLoop() {
        loopRef.fn = null;
      },
    },
    render() {},
    process() {},
    renderRemotePlayers() {},
    updateSettings() {},
    resetView() {},
    stats: () => ({ fps: 60, drawCalls: 12, meshes: 20, activeMeshes: 15 }),
    dispose() {},
  };

  const socketHandlers = new Map<string, Set<(...args: any[]) => void>>();
  const emittedEvents: string[] = [];
  const fakeSocket: any = {
    id: "sock-initial",
    connected: true,
    io: { engine: { transport: { name: "websocket" } } },
    on(ev: string, fn: any) {
      if (!socketHandlers.has(ev)) socketHandlers.set(ev, new Set());
      socketHandlers.get(ev)!.add(fn);
    },
    off(ev: string, fn: any) {
      socketHandlers.get(ev)?.delete(fn);
    },
    emit(ev: string, ...args: any[]) {
      emittedEvents.push(ev);
      if (ev === "strike:request_sync") {
        const cb = args.find((a) => typeof a === "function");
        cb?.({
          success: true,
          status: "in_progress",
          snapshot: {
            roomCode: "KS-TEST",
            tick: 10,
            timeLeft: 295,
            ackSequence: 0,
            players: [
              {
                id: fakeSocket.id,
                userId: 777,
                username: "CtrlPlayer",
                team: "red",
                color: "#ef4444",
                hp: 100,
                score: 0,
                kills: 0,
                deaths: 0,
                position: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                yaw: 0,
                pitch: 0,
                stance: "stand",
                selectedWeapon: "rifle",
                deadUntil: 0,
                protectedUntil: 0,
              },
            ],
            events: [],
          },
        });
      }
    },
    timeout() {
      return {
        emit(ev: string, ...args: any[]) {
          emittedEvents.push(ev);
          const cb = args.find((a) => typeof a === "function");
          if (ev === "strike:request_sync") {
            cb?.(null, {
              success: true,
              status: "in_progress",
              snapshot: {
                roomCode: "KS-TEST",
                tick: fakeSocket.id === "sock-reconnected" ? 25 : 10,
                timeLeft: 295,
                ackSequence: 0,
                players: [
                  {
                    id: fakeSocket.id,
                    userId: 777,
                    username: "CtrlPlayer",
                    team: "red",
                    color: "#ef4444",
                    hp: 100,
                    score: 0,
                    kills: 0,
                    deaths: 0,
                    position: { x: 1, y: 0, z: 1 },
                    velocity: { x: 0, y: 0, z: 0 },
                    yaw: 0,
                    pitch: 0,
                    stance: "stand",
                    selectedWeapon: "rifle",
                    deadUntil: 0,
                    protectedUntil: 0,
                  },
                ],
                events: [],
              },
            });
          } else if (ev === "strike:ping") {
            cb?.(null, args[0], { inputBatch: true });
          }
        },
      };
    },
    trigger(ev: string, ...args: any[]) {
      socketHandlers.get(ev)?.forEach((fn) => fn(...args));
    },
  };

  let pausedCount = 0;
  let synchronizedCount = 0;
  const connectionStates: { connected: boolean; reconnecting: boolean }[] = [];

  const controller = new StrikeController(
    fakeCanvas,
    "warehouse",
    { ...DEFAULT_SETTINGS },
    () => {},
    () => {
      pausedCount++;
    },
    fakeRenderer,
    {
      socket: fakeSocket,
      roomCode: "KS-TEST",
      userId: 777,
      username: "CtrlPlayer",
      team: "red",
      isMultiplayer: true,
      onSynchronized: () => {
        synchronizedCount++;
      },
      onConnectionStateChange: (s) => {
        connectionStates.push({ connected: s.connected, reconnecting: s.reconnecting });
      },
    }
  );

  try {
    assert.ok(emittedEvents.includes("strike:request_sync"), "Must immediately request sync on init");
    controller.start(false);
    assert.ok(loopRef.fn, "Render loop must start");

    // First frame while scene.isReady() === false: not ready yet
    loopRef.fn();
    assert.equal(synchronizedCount, 0);

    // Wait >1.25s with scene.isReady() STILL false (simulating slow/cold PBR texture downloads):
    // Controller must still complete readiness instead of deadlocking until timeout!
    await new Promise((r) => setTimeout(r, 1260));
    assert.ok(loopRef.fn, "Render loop must remain active");
    loopRef.fn();
    assert.equal(synchronizedCount, 1, "Controller must become ready after fallback window even if async textures still load");
    assert.ok(emittedEvents.includes("strike:client_ready"), "Must notify server strike:client_ready");

    // Simulate transient socket disconnect -> must NOT pause or kick player!
    fakeSocket.connected = false;
    fakeSocket.trigger("disconnect");
    assert.equal(pausedCount, 0, "Transient disconnect must not pause/kick active player");
    assert.equal(connectionStates.at(-1)?.reconnecting, true);

    // Simulate reconnect with new socket ID -> must automatically call strike:request_sync and recover
    const syncCallsBefore = emittedEvents.filter((e) => e === "strike:request_sync").length;
    fakeSocket.id = "sock-reconnected";
    fakeSocket.connected = true;
    fakeSocket.trigger("connect");
    const syncCallsAfter = emittedEvents.filter((e) => e === "strike:request_sync").length;
    assert.ok(syncCallsAfter > syncCallsBefore, "Reconnect must trigger automatic strike:request_sync");
    assert.equal(connectionStates.at(-1)?.connected, true);
    assert.equal(connectionStates.at(-1)?.reconnecting, false);
    assert.equal(controller.state.player.id, "sock-reconnected");
  } finally {
    controller.dispose();
    (globalThis as any).window = prevWindow;
    (globalThis as any).document = prevDocument;
  }
});
