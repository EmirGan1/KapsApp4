import { MAPS } from "../src/games/kapsstrike/maps";
import test from "node:test";
import assert from "node:assert/strict";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
import { WEAPONS } from "../src/games/kapsstrike/config";
import { InputCommand } from "../src/games/kapsstrike/types";

function createMockIo() {
  const emitted: { event: string; data: any; room?: string }[] = [];
  return {
    emitted,
    to(room: string) {
      return {
        emit(event: string, data: any) {
          emitted.push({ event, data, room });
        },
      };
    },
    emit(event: string, data: any) {
      emitted.push({ event, data });
    },
  };
}

test("KapsStrikeServerManager - Room creation, options & lobby state", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const hostUser = { id: 1, username: "Emirgan", avatar: null, color: "#3b82f6" };
  const room = manager.createRoom(hostUser, "socket-host-1", {
    name: "Kaps Pro Arena",
    map: "warehouse",
    mode: "tdm",
    maxPlayers: 8,
    timeLimit: 300,
    scoreLimit: 30,
  });

  assert.equal(room.name, "Kaps Pro Arena");
  assert.equal(room.mode, "tdm");
  assert.equal(room.map, "warehouse");
  assert.equal(room.status, "lobby");
  assert.equal(room.players.size, 1);

  const hostPlayer = room.players.get("socket-host-1");
  assert.ok(hostPlayer);
  assert.equal(hostPlayer.username, "Emirgan");
  assert.equal(hostPlayer.team, "red"); // First player gets red
  assert.equal(hostPlayer.isHost, true);

  const roomsList = manager.getRoomsList();
  assert.equal(roomsList.length, 1);
  assert.equal(roomsList[0].name, "Kaps Pro Arena");
  assert.equal(roomsList[0].playerCount, 1);
  assert.equal(roomsList[0].maxPlayers, 8);
});

test("KapsStrikeServerManager - Joining, auto team-balance & password protection", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 1, username: "Host", avatar: null, color: "#ef4444" };
  const room = manager.createRoom(host, "sock-1", {
    name: "Locked Arena",
    password: "secret123",
    mode: "tdm",
    maxPlayers: 4,
  });

  const p2 = { id: 2, username: "Player2", avatar: null, color: "#3b82f6" };

  // 1. Wrong password fails
  const failJoin = manager.joinRoom(room.roomCode, p2, "sock-2", "wrongpass");
  assert.equal(failJoin.success, false);
  assert.equal(failJoin.error, "Hatalı oda şifresi.");

  // 2. Correct password succeeds & balances to blue team (red has 1, blue has 0)
  const okJoin = manager.joinRoom(room.roomCode, p2, "sock-2", "secret123");
  assert.equal(okJoin.success, true);
  assert.equal(room.players.size, 2);
  const p2Player = room.players.get("sock-2")!;
  assert.equal(p2Player.team, "blue");

  // 3. Player 3 joins -> balances back to red team (red has 1, blue has 1 -> redCount <= blueCount -> red)
  const p3 = { id: 3, username: "Player3", avatar: null };
  const okJoin3 = manager.joinRoom(room.roomCode, p3, "sock-3", "secret123");
  assert.equal(okJoin3.success, true);
  assert.equal(room.players.size, 3);
  const p3Player = room.players.get("sock-3")!;
  assert.equal(p3Player.team, "red");
});

test("KapsStrikeServerManager - Ready toggle, team switch & match start", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 1, username: "Host", avatar: null };
  const challenger = { id: 2, username: "Challenger", avatar: null };

  const room = manager.createRoom(host, "sock-host", { mode: "tdm" });
  manager.joinRoom(room.roomCode, challenger, "sock-challenger");

  // Challenger switches to red team
  const switchOk = manager.switchTeam("sock-challenger", "red");
  assert.equal(switchOk, true);
  assert.equal(room.players.get("sock-challenger")!.team, "red");

  // Toggle ready
  manager.setReady("sock-challenger", true);
  assert.equal(room.players.get("sock-challenger")!.ready, true);

  // Host starts the match
  const startRes = manager.startGame("sock-host");
  assert.equal(startRes.success, true);
  assert.equal(room.status, "in_progress");

  // Stop simulation loop for clean test termination
  manager.stopRoomSimulationLoop(room);
  manager.leaveRoom("sock-host", 1);
  manager.leaveRoom("sock-challenger", 2);
});

test("KapsStrikeServerManager - Authoritative 60Hz tick, input queue & anti-teleport", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 1, username: "Speedy", avatar: null };
  const room = manager.createRoom(host, "sock-speedy", { mode: "ffa" });
  manager.startGame("sock-speedy");
  manager.stopRoomSimulationLoop(room); // Manual ticking in unit test

  const player = room.players.get("sock-speedy")!;
  const initialPos = { ...player.state.movement.position };

  // Send normal movement input command
  const input: InputCommand = {
    sequence: 1,
    tick: 1,
    moveX: 1,
    moveZ: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    sprint: true,
    crouch: false,
    fire: false,
    ads: false,
    reload: false,
  };
  manager.processPlayerInput("sock-speedy", input);

  // Run server simulation tick directly
  manager.tickSimulation(room);

  // Verify displacement is controlled and within maximum physics bound (<= 0.5m per tick)
  const dist = Math.hypot(
    player.state.movement.position.x - initialPos.x,
    player.state.movement.position.z - initialPos.z
  );
  assert.ok(dist <= 0.5, `Displacement per tick must not exceed physics limit: ${dist}`);
  assert.equal(player.lastSequence, 1);

  manager.leaveRoom("sock-speedy", 1);
});

test("KapsStrikeServerManager - Hit detection, lag compensation rewind & TDM friendly fire", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const r1 = { id: 1, username: "RedShooter", avatar: null };
  const r2 = { id: 2, username: "RedTeammate", avatar: null };
  const b1 = { id: 3, username: "BlueTarget", avatar: null };

  const room = manager.createRoom(r1, "sock-r1", { mode: "tdm" });
  manager.joinRoom(room.roomCode, r2, "sock-r2");
  manager.joinRoom(room.roomCode, b1, "sock-b1");

  manager.switchTeam("sock-r2", "red");
  manager.switchTeam("sock-b1", "blue");
  manager.startGame("sock-r1");
  manager.stopRoomSimulationLoop(room); // Manual ticking in unit test

  const shooter = room.players.get("sock-r1")!;
  const teammate = room.players.get("sock-r2")!;
  const enemy = room.players.get("sock-b1")!;

  // Position shooter and teammate directly in crosshairs
  shooter.state.movement.position = { x: 0, y: 1, z: 0 };
  teammate.state.movement.position = { x: 0, y: 1, z: 5 };
  enemy.state.movement.position = { x: 30, y: 1, z: 30 }; // enemy elsewhere
  shooter.state.yaw = 0;
  shooter.state.pitch = 0;

  shooter.state.protectedUntil = 0;
  teammate.state.protectedUntil = 0;
  enemy.state.protectedUntil = 0;

  // Record historical frames for lag compensation rewind
  room.players.forEach((p) => p.recordHistory(room.tick, Date.now()));

  // Shooter fires with rifle at teammate
  shooter.state.weapon.selected = "rifle";
  shooter.state.weapon.ammo.rifle = 30;

  (manager as any).verifyAndExecuteShot(room, shooter, false, room.tick);

  // TDM Friendly fire must be protected: teammate HP remains 100
  assert.equal(teammate.state.hp, 100, "Teammate in TDM must not take friendly fire damage");

  // Now place Enemy in crosshairs and move teammate away
  enemy.state.movement.position = { x: 0, y: 1, z: 5 };
  teammate.state.movement.position = { x: 30, y: 1, z: 30 };
  shooter.state.weapon.ammo.rifle = 30;
  shooter.state.weapon.nextFire = 0;

  room.players.forEach((p) => p.recordHistory(room.tick, Date.now()));

  (manager as any).verifyAndExecuteShot(room, shooter, false, room.tick);

  // Enemy must have taken damage
  assert.ok(enemy.state.hp < 100, `Enemy should take damage from rifle, hp is ${enemy.state.hp}`);
  assert.ok(shooter.damage > 0, "Shooter dealt damage should be credited");

  manager.leaveRoom("sock-r1", 1);
  manager.leaveRoom("sock-r2", 2);
  manager.leaveRoom("sock-b1", 3);
});

test("KapsStrikeServerManager - 10 Player concurrent load test", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 1, username: "Host10", avatar: null };
  const room = manager.createRoom(host, "sock-1", { mode: "tdm", maxPlayers: 10 });

  // Add 9 players
  for (let i = 2; i <= 10; i++) {
    const res = manager.joinRoom(room.roomCode, { id: i, username: `Player_${i}`, avatar: null }, `sock-${i}`);
    assert.equal(res.success, true);
  }

  assert.equal(room.players.size, 10);
  assert.equal(manager.startGame("sock-1").success, true);
  manager.stopRoomSimulationLoop(room); // Manual ticking in unit test

  // Push inputs from 10 players for 60 ticks (1 full second of 60Hz authoritative simulation)
  for (let tick = 1; tick <= 60; tick++) {
    for (let i = 1; i <= 10; i++) {
      manager.processPlayerInput(`sock-${i}`, {
        sequence: tick,
        tick,
        moveX: (i % 3) - 1,
        moveZ: ((i + 1) % 3) - 1,
        yaw: (tick * 0.1) % (Math.PI * 2),
        pitch: 0,
        jump: tick % 30 === 0,
        sprint: true,
        crouch: false,
        fire: tick % 15 === 0,
        ads: false,
        reload: false,
      });
    }
    manager.tickSimulation(room);
  }

  // Check state consistency
  assert.equal(room.players.size, 10);
  for (const p of room.players.values()) {
    assert.ok(!Number.isNaN(p.state.movement.position.x), "Position X must be a valid number");
    assert.ok(!Number.isNaN(p.state.movement.position.y), "Position Y must be a valid number");
    assert.ok(!Number.isNaN(p.state.movement.position.z), "Position Z must be a valid number");
    assert.ok(p.state.hp >= 0 && p.state.hp <= 100, "HP must remain within 0-100");
  }

  // Cleanup
  for (let i = 1; i <= 10; i++) {
    manager.leaveRoom(`sock-${i}`, i);
  }
  assert.equal(manager.getRoomsList().length, 0);
});

test("KapsStrikeServerManager - Full room capacity rejection", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 1, username: "Host", avatar: null };
  const room = manager.createRoom(host, "sock-1", { mode: "ffa", maxPlayers: 2 });

  // Add 2nd player -> room becomes full (2/2)
  const p2 = manager.joinRoom(room.roomCode, { id: 2, username: "P2", avatar: null }, "sock-2");
  assert.equal(p2.success, true);

  // Attempt to add 3rd player -> must be rejected
  const p3 = manager.joinRoom(room.roomCode, { id: 3, username: "P3", avatar: null }, "sock-3");
  assert.equal(p3.success, false);
  assert.equal(p3.error, "Oda dolu.");

  manager.leaveRoom("sock-1", 1);
  manager.leaveRoom("sock-2", 2);
});

test("KapsStrikeServerManager - Host migration on disconnect", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 1, username: "OriginalHost", avatar: null };
  const room = manager.createRoom(host, "sock-host", { mode: "tdm", maxPlayers: 4 });

  manager.joinRoom(room.roomCode, { id: 2, username: "SecondPlayer", avatar: null }, "sock-p2");
  assert.equal(room.players.get("sock-host")!.isHost, true);
  assert.equal(room.players.get("sock-p2")!.isHost, false);

  // Original host disconnects / leaves
  manager.leaveRoom("sock-host", 1);

  // Second player must automatically inherit host status
  assert.equal(room.players.size, 1);
  const remainingPlayer = room.players.get("sock-p2")!;
  assert.equal(remainingPlayer.isHost, true);
  assert.equal(room.hostId, 2);

  manager.leaveRoom("sock-p2", 2);
});

test("KapsStrikeServerManager - Fire rate exploit & ammo validation", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const shooter = { id: 1, username: "ExploitTester", avatar: null };
  const target = { id: 2, username: "TargetDummy", avatar: null };
  const room = manager.createRoom(shooter, "sock-shooter", { mode: "ffa" });
  manager.joinRoom(room.roomCode, target, "sock-target");

  manager.startGame("sock-shooter");
  manager.stopRoomSimulationLoop(room);

  const shooterPlayer = room.players.get("sock-shooter")!;
  const targetPlayer = room.players.get("sock-target")!;

  shooterPlayer.state.weapon.selected = "sniper"; // 50 RPM = fires at most once every ~72 ticks at 60Hz
  shooterPlayer.state.weapon.ammo.sniper = 5;
  shooterPlayer.state.weapon.nextFire = 0;
  shooterPlayer.state.protectedUntil = 0;
  targetPlayer.state.protectedUntil = 0;

  shooterPlayer.state.movement.position = { x: 0, y: 1.6, z: 0 };
  targetPlayer.state.movement.position = { x: 0, y: 1.6, z: 10 };
  shooterPlayer.state.yaw = 0;
  shooterPlayer.state.pitch = 0;

  // 1st shot fires legally
  (manager as any).verifyAndExecuteShot(room, shooterPlayer, false, room.tick);
  assert.equal(shooterPlayer.state.weapon.ammo.sniper, 4);

  // 2nd shot immediately in the same tick / next tick -> should be blocked by fire rate limit
  const hpAfterFirst = targetPlayer.state.hp;
  (manager as any).verifyAndExecuteShot(room, shooterPlayer, false, room.tick + 1);
  assert.equal(shooterPlayer.state.weapon.ammo.sniper, 4, "Ammo must not decrease on cooldown");
  assert.equal(targetPlayer.state.hp, hpAfterFirst, "Target must not take damage when cooldown is active");

  manager.leaveRoom("sock-shooter", 1);
  manager.leaveRoom("sock-target", 2);
});

test("KapsStrikeServerManager - All 5 weapons hitscan & spread resolution", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const shooter = { id: 1, username: "ArsenalTester", avatar: null };
  const target = { id: 2, username: "Target", avatar: null };
  const room = manager.createRoom(shooter, "sock-shooter", { mode: "ffa" });
  manager.joinRoom(room.roomCode, target, "sock-target");
  manager.startGame("sock-shooter");
  manager.stopRoomSimulationLoop(room);

  const s = room.players.get("sock-shooter")!;
  const t = room.players.get("sock-target")!;

  s.state.protectedUntil = 0;
  t.state.protectedUntil = 0;
  s.state.movement.position = { x: 0, y: 1.6, z: 0 };
  t.state.movement.position = { x: 0, y: 1.6, z: 6 };
  s.state.yaw = 0;
  s.state.pitch = 0;

  const weaponsToTest = ["rifle", "smg", "sniper", "shotgun", "pistol"] as const;

  for (const w of weaponsToTest) {
    t.state.hp = 100;
    s.state.weapon.selected = w;
    s.state.weapon.ammo[w] = WEAPONS[w].capacity;
    s.state.weapon.nextFire = 0;
    s.state.weapon.reloadUntil = 0;
    s.state.weapon.switchUntil = 0;

    (manager as any).verifyAndExecuteShot(room, s, false, room.tick);

    assert.ok(
      t.state.hp < 100,
      `Target should take damage from weapon: ${w}, hp is ${t.state.hp}`
    );
  }

  manager.leaveRoom("sock-shooter", 1);
  manager.leaveRoom("sock-target", 2);
});

test("KapsStrikeServerManager - High latency & packet delay simulation (150ms-300ms)", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const p1 = { id: 1, username: "LaggyShooter", avatar: null };
  const p2 = { id: 2, username: "MovingTarget", avatar: null };
  const room = manager.createRoom(p1, "sock-1", { mode: "ffa" });
  manager.joinRoom(room.roomCode, p2, "sock-2");
  manager.startGame("sock-1");
  manager.stopRoomSimulationLoop(room);

  const shooter = room.players.get("sock-1")!;
  const victim = room.players.get("sock-2")!;

  shooter.state.protectedUntil = 0;
  victim.state.protectedUntil = 0;

  // Simulate 20 ticks of movement while target moves from z: 2 to z: 8
  for (let tick = 1; tick <= 20; tick++) {
    victim.state.movement.position = { x: 0, y: 0, z: 2 + tick * 0.3 };
    victim.recordHistory(tick, Date.now() - (20 - tick) * 16);
    room.tick = tick;
  }

  // Shooter shoots at tick 20, but client shot was rendered 10 ticks ago (approx 160ms lag)
  shooter.state.movement.position = { x: 0, y: 0, z: 0 };
  shooter.state.yaw = 0;
  shooter.state.pitch = 0;
  shooter.state.weapon.selected = "rifle";
  shooter.state.weapon.ammo.rifle = 30;
  shooter.state.weapon.nextFire = 0;

  // Lag compensation should rewind victim to tick 10 position and verify hit
  (manager as any).verifyAndExecuteShot(room, shooter, false, 10);

  assert.ok(victim.state.hp < 100, "Lag compensation must successfully hit rewound position");

  manager.leaveRoom("sock-1", 1);
  manager.leaveRoom("sock-2", 2);
});

test("KapsStrikeServerManager - Robust room code lookup (case-insensitive, prefix-free, spaces)", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  const host = { id: 10, username: "RoomCreator", avatar: null };
  const room = manager.createRoom(host, "sock-host-10", { name: "Test Lookup Room" });

  const rawCode = room.roomCode; // e.g. "KS-AB12"
  const bareCode = rawCode.replace("KS-", ""); // e.g. "AB12"

  // 1. Exact match
  assert.ok(manager.findRoomByCode(rawCode));

  // 2. Lowercase match
  assert.ok(manager.findRoomByCode(rawCode.toLowerCase()));

  // 3. Bare code without "KS-"
  assert.ok(manager.findRoomByCode(bareCode));

  // 4. Bare code lowercase
  assert.ok(manager.findRoomByCode(bareCode.toLowerCase()));

  // 5. Code with surrounding spaces
  assert.ok(manager.findRoomByCode(`  ${rawCode}  `));

  // 6. Join with bare lowercase code succeeds
  const joiner = { id: 11, username: "Joiner", avatar: null };
  const joinRes = manager.joinRoom(bareCode.toLowerCase(), joiner, "sock-joiner-11");
  assert.equal(joinRes.success, true);
  assert.equal(joinRes.room?.roomCode, rawCode);

  manager.leaveRoom("sock-host-10", 10);
  manager.leaveRoom("sock-joiner-11", 11);
});

test("KapsStrikeServerManager - Dual event compatibility and payload flexibility", () => {
  const io = createMockIo() as any;
  const manager = new KapsStrikeServerManager(io);

  // Mock socket implementation for register testing
  const registeredEvents = new Map<string, Function>();
  const mockSocket = {
    id: "mock-sock-user-20",
    join: (_room: string) => {},
    leave: (_room: string) => {},
    on(event: string, fn: Function) {
      registeredEvents.set(event, fn);
    },
    emit: (_event: string, _data: any) => {},
    to: (_r: string) => ({
      emit: (_event: string, _data: any) => {},
    }),
  } as any;

  manager.register(mockSocket, { id: 20, username: "SocketTester", avatar: null });

  // Verify dual event listeners exist
  assert.ok(registeredEvents.has("strike:get_rooms"), "strike:get_rooms must be registered");
  assert.ok(registeredEvents.has("strike:list_rooms"), "strike:list_rooms must be registered");
  assert.ok(registeredEvents.has("strike:start_game"), "strike:start_game must be registered");
  assert.ok(registeredEvents.has("strike:start_match"), "strike:start_match must be registered");
  assert.ok(registeredEvents.has("strike:voice_signal"), "strike:voice_signal must be registered");

  // Create room via socket handler
  let createRes: any = null;
  registeredEvents.get("strike:create_room")!({ name: "Socket Room" }, (res: any) => {
    createRes = res;
  });
  assert.equal(createRes?.success, true);
  const code = createRes.room.roomCode;

  // Second user connects and joins via { roomId: code }
  const mockSocket2 = {
    id: "mock-sock-user-21",
    join: (_room: string) => {},
    leave: (_room: string) => {},
    on(event: string, fn: Function) {
      registeredEvents.set("u2_" + event, fn);
    },
    emit: (_event: string, _data: any) => {},
    to: (_r: string) => ({ emit: (_e: string, _d: any) => {} }),
  } as any;

  manager.register(mockSocket2, { id: 21, username: "Joiner2", avatar: null });

  let joinRes: any = null;
  // Test joining with { roomId: code } (frontend format)
  registeredEvents.get("u2_strike:join_room")!({ roomId: code }, (res: any) => {
    joinRes = res;
  });
  assert.equal(joinRes?.success, true);
  assert.equal(joinRes.room.players.length, 2);

  // Test WebRTC voice signaling relay between the two players
  let voiceSignalReceived = false;
  io.to = (sockId: string) => ({
    emit(event: string, data: any) {
      if (sockId === "mock-sock-user-21" && event === "strike:voice_signal") {
        voiceSignalReceived = true;
      }
    },
  });

  registeredEvents.get("strike:voice_signal")!({
    targetUserId: 21,
    data: { type: "offer", sdp: "dummy-sdp" },
  });
  assert.equal(voiceSignalReceived, true, "Voice signal must be relayed to target user");

  // Host starts match via strike:start_match
  let startRes: any = null;
  registeredEvents.get("strike:start_match")!((res: any) => {
    startRes = res;
  });
  assert.equal(startRes?.success, true);

  // Clean up
  manager.leaveRoom("mock-sock-user-20", 20);
  manager.leaveRoom("mock-sock-user-21", 21);
});


test("duplicate start aliases preserve the active round and scores", () => {
  const manager = new KapsStrikeServerManager(createMockIo() as any);
  const room = manager.createRoom({id:1,username:"Host",avatar:null},"host",{mode:"ffa"});
  manager.startGame("host");
  manager.stopRoomSimulationLoop(room);
  room.tick = 42;
  room.players.get("host")!.score = 123;
  assert.equal(manager.startGame("host").success,true);
  assert.equal(room.tick,42);
  assert.equal(room.players.get("host")!.score,123);
  manager.stopRoomSimulationLoop(room);
  manager.leaveRoom("host",1);
});

test("queued duplicates, invalid weapons and flood cannot buy extra simulation steps", () => {
  const manager = new KapsStrikeServerManager(createMockIo() as any);
  const room = manager.createRoom({id:1,username:"Host",avatar:null},"host",{mode:"ffa"});
  manager.startGame("host"); manager.stopRoomSimulationLoop(room);
  const p = room.players.get("host")!;
  const command: InputCommand={sequence:1,tick:0,moveX:1,moveZ:0,yaw:0,pitch:0,jump:false,sprint:true,crouch:false,fire:false,ads:false,reload:false};
  manager.processPlayerInput("host",command);
  manager.processPlayerInput("host",command);
  assert.equal(p.inputQueue.length,1);
  manager.processPlayerInput("host",{...command,sequence:2,weapon:"__proto__" as any});
  manager.processPlayerInput("host",{...command,sequence:2,moveX:100});
  assert.equal(p.inputQueue.length,1);
  for(let i=2;i<2000;i++) manager.processPlayerInput("host",{...command,sequence:i});
  assert.equal(p.inputQueue.length,24);
  const start={...p.state.movement.position};
  manager.tickSimulation(room);
  assert.equal(p.lastSequence,1);
  assert.equal(p.inputQueue.length,23);
  assert.ok(Math.hypot(p.state.movement.position.x-start.x,p.state.movement.position.z-start.z)<=13/120);
  manager.leaveRoom("host",1);
});

test("knife: authoritative cooldown and heavy damage", () => {
  const manager = new KapsStrikeServerManager(createMockIo() as any);
  const room = manager.createRoom({id:1,username:"Host",avatar:null},"host",{mode:"ffa"});
  manager.joinRoom(room.roomCode,{id:2,username:"Target",avatar:null},"target");
  manager.startGame("host");manager.stopRoomSimulationLoop(room);
  const host=room.players.get("host")!, target=room.players.get("target")!;
  host.state.movement.position={x:0,y:0,z:-28};
  target.state.movement.position={x:0,y:0,z:-26.3};
  target.state.protectedUntil=0;
  host.state.weapon.selected='knife';
  const input:InputCommand={sequence:1,tick:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:true,ads:false,reload:false};
  manager.processPlayerInput('host',input);manager.tickSimulation(room);
  assert.equal(target.state.hp,60);
  assert.equal(host.state.weapon.ammo.knife,1);
  for(let i=2;i<120;i++){manager.processPlayerInput('host',{...input,sequence:i,tick:room.tick});manager.tickSimulation(room);}
  assert.equal(target.state.hp,60,'holding fire must not repeat knife attacks');
  manager.processPlayerInput('host',{...input,sequence:120,fire:false});manager.tickSimulation(room);
  manager.processPlayerInput('host',{...input,sequence:121,ads:true});manager.tickSimulation(room);
  assert.equal(target.state.hp,0);
  assert.equal(host.kills,1);
  manager.leaveRoom('host',1);manager.leaveRoom('target',2);
});

for (const blocked of [false,true]) test(`knife refuses ${blocked ? "solid-covered" : "out-of-range"} targets`,()=>{
 const manager = new KapsStrikeServerManager(createMockIo() as any);
 const room=manager.createRoom({id:1,username:"Host",avatar:null},"h",{mode:"ffa"});
 manager.joinRoom(room.roomCode,{id:2,username:"Target",avatar:null},"t");manager.startGame("h");manager.stopRoomSimulationLoop(room);
 const h=room.players.get("h")!,t=room.players.get("t")!;
 h.state.movement.position={x:0,y:0,z:-28};t.state.movement.position={x:0,y:0,z:blocked?-26.3:-24};
 h.state.weapon.selected="knife";t.state.protectedUntil=0;
 const solids=MAPS.warehouse.solids;
 if(blocked) solids.push({id:"test-melee-wall",kind:"box",x:0,y:0,z:-27.2,w:4,h:3,d:.1,color:"#222222"});
 try {
  manager.processPlayerInput("h",{sequence:1,tick:0,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:true,ads:false,reload:false});manager.tickSimulation(room);
  assert.equal(t.state.hp,100);
 } finally { if(blocked) solids.pop();manager.leaveRoom("h",1);manager.leaveRoom("t",2); }
});
