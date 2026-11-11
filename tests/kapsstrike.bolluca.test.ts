import test from "node:test";
import assert from "node:assert/strict";
import { MAPS } from "../src/games/kapsstrike/maps";
import { fits, move, newMovement, support } from "../src/games/kapsstrike/physics";
import { grenadeLineClear } from "../src/games/kapsstrike/grenades";
import { bombInteract, BOMB_RULES, stepBomb } from "../src/games/kapsstrike/bomb";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
import type { Vec3 } from "../src/games/kapsstrike/types";

const map = MAPS.bolluca;
function walk(start: Vec3, targets: Vec3[]) {
  const player = newMovement(start);
  let tick = 0;
  for (const target of targets) {
    for (let i = 0; i < 1200; i++) {
      const { x, y, z } = player.position;
      const distance = Math.hypot(x - target.x, z - target.z);
      const reached = distance < .14 && Math.abs(y - target.y) < .35;
      if (reached && Math.hypot(player.velocity.x, player.velocity.z) < .2) break;
      assert.ok(i < 1199, JSON.stringify({ start, target, position: player.position }));
      const yaw = Math.atan2(target.x - x, target.z - z);
      move(player, { sequence: tick, tick, yaw, pitch: 0, moveX: 0, moveZ: distance < .08 ? 0 : Math.min(1, distance * 1.1),
        jump: false, sprint: false, crouch: false, fire: false, ads: false, reload: false }, map, tick++);
      assert.ok(fits(map, player.position, player.height));
    }
  }
}

for (const route of map.routes!) {
  test("Bolluca walk: " + route.name, () => walk(route.points[0], route.points.slice(1)));
}

test("Bolluca spawn placements stand on supported floors and are separated", () => {
  for (const [i, spawn] of map.spawns.entries()) {
    assert.ok(fits(map, spawn, 1.8));
    assert.equal(support(map, spawn, spawn.y + .01), spawn.y);
    for (const other of map.spawns.slice(i + 1)) assert.ok(Math.hypot(spawn.x - other.x, spawn.z - other.z) >= 2);
  }
});

test("Bolluca perimeter stops sprinting jumps at street seams", () => {
  const inside = (x: number, z: number) => map.radarFootprint!.some(([west, east, south, north]) =>
    x >= west && x <= east && z >= south && z <= north);
  let checked = 0;
  for (const wall of map.solids.filter(solid => /^bolluca-facade-\d+$/.test(solid.id))) {
    const horizontal = wall.w > wall.d;
    for (const side of [-1, 1]) {
      const dx = horizontal ? 0 : side, dz = horizontal ? side : 0;
      const x = wall.x - dx * 1.5, z = wall.z - dz * 1.5;
      if (!inside(x, z) || inside(wall.x + dx, wall.z + dz)) continue;
      const y = support(map, { x, y: 0, z }, 3.4);
      if (!fits(map, { x, y, z }, 1.8)) continue;
      const player = newMovement({ x, y, z });
      for (let tick = 0; tick < 105; tick++) {
        move(player, { sequence: tick, tick, yaw: Math.atan2(dx, dz), pitch: 0,
          moveX: 0, moveZ: 1, jump: tick === 4, sprint: true, crouch: false,
          fire: false, ads: false, reload: false }, map, tick);
        assert.ok(inside(player.position.x, player.position.z), wall.id);
        assert.ok(fits(map, player.position, player.height), wall.id);
      }
      checked++;
    }
  }
  assert.ok(checked > 40);
});

test("Bolluca keeps cross-site fire blocked and Window sees Mid", () => {
  const [a, b] = map.bombSites!;
  const eye = (p: Vec3) => ({ ...p, y: p.y + 1.62 });
  assert.equal(grenadeLineClear(map, eye(a), eye(b)), false);
  assert.equal(grenadeLineClear(map, eye({ x: -28, y: 2, z: 4 }), eye({ x: 8, y: 0, z: 4 })), true);
});

test("Bolluca server rooms plant and defuse at both sites and Dust II remains the default", () => {
  for (const site of map.bombSites!) {
    const server = new KapsStrikeServerManager({ to: () => ({ emit() {} }), emit() {} } as never);
    const user = (id: number) => ({ id, username: String(id), avatar: null });
    assert.equal(server.createRoom(user(3), "default", { mode: "bomb" }).map, "district");
    const room = server.createRoom(user(1), "a", { mode: "bomb", map: "bolluca" });
    server.joinRoom(room.roomCode, user(2), "b");
    server.setReady("b", true);
    assert.equal(server.startGame("a").success, true);
    server.stopRoomSimulationLoop(room);
    const match = room.bomb!;
    const t = match.players[match.carrier!];
    const ct = Object.values(match.players).find(player => player.team === "CT")!;
    stepBomb(match, BOMB_RULES.buy);
    const now = BOMB_RULES.buy + 1;
    t.position = { x: 34.42208, y: 3.2, z: 37.9984 };
    assert.equal(bombInteract(match, t.id, true, now), false);
    t.position = { ...site };
    assert.ok(bombInteract(match, t.id, true, now));
    for (let i = 1; i < 50 && match.phase === "active"; i++) {
      bombInteract(match, t.id, true, now + i / 10);
      stepBomb(match, now + i / 10);
    }
    assert.equal(match.site, site.id);
    assert.equal(match.phase, "planted");
    ct.position = { ...site };
    const defuse = now + BOMB_RULES.plant + 1;
    assert.ok(bombInteract(match, ct.id, true, defuse));
    for (let i = 0; i < 110 && match.phase === "planted"; i++) {
      bombInteract(match, ct.id, true, defuse + i / 10);
      stepBomb(match, defuse + i / 10);
    }
    assert.equal(match.winner, "CT");
    assert.equal(ct.defuses, 1);
  }
});

test("Bolluca includes faithful Mirage architectural landmarks across A Site, Mid, Palace, Underpass, Market and B Site", () => {
  for (const token of [
    "bolluca-crate-tetris",
    "bolluca-crate-tetris-top",
    "bolluca-sandwich-back-wall",
    "bolluca-a-stairs-east-parapet",
    "bolluca-crate-a-default",
    "bolluca-crate-triple",
    "bolluca-crate-triple-wing",
    "bolluca-crate-firebox",
    "bolluca-ticket-booth",
    "bolluca-palace-dome-crown",
    "bolluca-window-under-bench",
    "bolluca-window-vent-frame",
    "bolluca-underpass-tile-band-1",
    "bolluca-b-canopy",
    "bolluca-crate-b-default",
    "bolluca-crate-b-ebox",
    "bolluca-crate-b-bench",
    "bolluca-van",
    "bolluca-van-cab-hood",
    "bolluca-market-counter",
    "bolluca-market-window-sill",
  ]) {
    assert.ok(map.solids.some(s => s.id === token), `missing Mirage landmark: ${token}`);
  }
});

