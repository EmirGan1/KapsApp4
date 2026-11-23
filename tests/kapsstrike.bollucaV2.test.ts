import test from "node:test";
import assert from "node:assert/strict";
import { MAPS, BOMB_MAPS } from "../src/games/kapsstrike/maps";
import {
  BOLLUCA_V2_BLOCKS,
  BOLLUCA_V2_CALLOUTS,
  BOLLUCA_V2_SITES,
  getBollucaV2Callout,
} from "../src/games/kapsstrike/bollucaV2";
import { fits, move, newMovement, raySolid, support } from "../src/games/kapsstrike/physics";
import { PHYSICS as C } from "../src/games/kapsstrike/config";
import { bombInteract, createBombMatch, stepBomb } from "../src/games/kapsstrike/bomb";
import { advanceWorld, claimSupply, createWorld, DROP_INTERVAL, supplyLocations } from "../src/games/kapsstrike/world";
import { createTraining } from "../src/games/kapsstrike/combat";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
import type { MapDefinition, Vec3 } from "../src/games/kapsstrike/types";

const map = MAPS.bollucav2;

interface Waypoint {
  x: number;
  z: number;
  y?: number;
  jump?: boolean;
  tol?: number;
}

const wp = (x: number, z: number, opts: { y?: number; jump?: boolean; tol?: number } = {}): Waypoint => ({
  x,
  z,
  ...opts,
});

function hasLineOfSight(m: MapDefinition, from: Vec3, to: Vec3): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return true;
  const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
  for (const s of m.solids) {
    if (s.detail || s.hidden) continue;
    if (raySolid(from, dir, s, dist) < dist - 0.08) return false;
  }
  return true;
}

/**
 * Simulates a real player capsule walking/sprinting/jumping through an ordered list of waypoints
 * using the actual 120 Hz fixed-step `move()` physics engine.
 */
function traverseRoute(
  m: MapDefinition,
  name: string,
  points: Waypoint[],
  allowJumpOnWaypoints = true,
): Vec3 {
  const startY =
    points[0].y ?? support(m, { x: points[0].x, y: 0, z: points[0].z }, 4.5);
  const state = newMovement({ x: points[0].x, y: startY, z: points[0].z });
  assert.ok(
    fits(m, state.position, C.standing),
    `${name}: start position blocked at ${JSON.stringify(state.position)}`,
  );

  let tick = 1;
  for (let i = 1; i < points.length; i++) {
    const target = points[i];
    const tol = target.tol ?? 1.2;
    let reached = false;
    let stuckTicks = 0;
    let prevX = state.position.x;
    let prevZ = state.position.z;

    for (let step = 0; step < 1400; step++) {
      const dx = target.x - state.position.x;
      const dz = target.z - state.position.z;
      const horiz = Math.hypot(dx, dz);
      const yOk = target.y === undefined || Math.abs(state.position.y - target.y) <= 0.8;
      if (horiz <= tol && yOk) {
        reached = true;
        break;
      }

      const yaw = Math.atan2(dx, dz);
      const moved = Math.hypot(state.position.x - prevX, state.position.z - prevZ);
      if (moved < 0.012 && state.grounded) stuckTicks++;
      else stuckTicks = 0;
      prevX = state.position.x;
      prevZ = state.position.z;

      const wantsJump =
        allowJumpOnWaypoints &&
        Boolean(target.jump) &&
        state.grounded &&
        (horiz < 2.6 || stuckTicks >= 3);

      move(
        state,
        {
          sequence: tick,
          tick,
          moveX: 0,
          moveZ: 1,
          yaw,
          pitch: 0,
          jump: wantsJump,
          sprint: !target.jump,
          crouch: false,
          fire: false,
          ads: false,
          reload: false,
        },
        m,
        tick,
      );
      tick++;
      assert.ok(
        Math.abs(state.position.x) < m.bounds && Math.abs(state.position.z) < m.bounds,
        `${name}: player escaped map bounds at ${JSON.stringify(state.position)}`,
      );
      assert.ok(
        state.position.y >= -0.05 && state.position.y <= 9,
        `${name}: abnormal elevation ${state.position.y} at step ${step}`,
      );
    }

    assert.ok(
      reached,
      `${name}: failed to reach waypoint #${i} (${target.x}, ${target.z}, y=${target.y ?? "any"}) from (${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`,
    );
  }
  return state.position;
}

// =============================================================================
// 1. MANDATORY CS:GO MIRAGE ROUTES (WALKABLE BIDIRECTIONAL + DROP/JUMP ROUTES)
// =============================================================================
const WALKABLE_BIDIRECTIONAL_ROUTES: { id: string; label: string; points: Waypoint[] }[] = [
  {
    id: "M01",
    label: "T Spawn -> Palace Alley -> A Ramp -> A Site",
    points: [
      wp(45, 7, { y: 0 }),
      wp(47.5, -10, { y: 0 }),
      wp(47.5, -25, { y: 0 }),
      wp(35, -25, { y: 0 }),
      wp(34.5, -31.5, { y: 0 }),
      wp(27.5, -31.5, { y: 1.2 }),
      wp(22, -31.5, { y: 1.2 }),
    ],
  },
  {
    id: "M02",
    label: "T Spawn -> Side Alley -> Top Mid -> Connector -> Stairs -> A Site",
    points: [
      wp(45, 11, { y: 0 }),
      wp(28, 12, { y: 0 }),
      wp(19.5, 11, { y: 0 }),
      wp(19.5, 5.5, { y: 0.6 }),
      wp(6, 5.5, { y: 0 }),
      wp(-2, 5.5, { y: 0 }),
      wp(-2, -13.5, { y: 1.2 }),
      wp(-2, -21.5, { y: 0 }),
      wp(14, -21.5, { y: 0 }),
      wp(22, -22, { y: 0 }),
      wp(22, -28, { y: 1.2 }),
      wp(22, -31.5, { y: 1.2 }),
    ],
  },
  {
    id: "M03",
    label: "Top Mid -> Catwalk (Over Underpass Bridge) -> B Short -> B Site",
    points: [
      wp(16.5, 6, { y: 0.6 }),
      wp(11, 13, { y: 0 }),
      wp(-3, 13, { y: 0 }),
      wp(-17, 13, { y: 3.1 }),
      wp(-27.5, 13.5, { y: 0 }),
      wp(-28.5, 22, { y: 0 }),
      wp(-35, 24.5, { y: 0.14 }),
      wp(-39, 25.5, { y: 0.14 }),
    ],
  },
  {
    id: "M04",
    label: "B Apartments -> Underpass (Under Catwalk Bridge) -> Mid",
    points: [
      wp(-17, 36, { y: 2.4 }),
      wp(-17, 29, { y: 1.3 }),
      wp(-17, 23, { y: 0 }),
      wp(-17, 13, { y: 0 }),
      wp(-17, 5, { y: 0 }),
    ],
  },
  {
    id: "M05",
    label: "CT Spawn -> Ticket -> A Site",
    points: [
      wp(-25, -40, { y: 0 }),
      wp(-4, -40, { y: 0 }),
      wp(12, -39.5, { y: 0 }),
      wp(21.5, -39.5, { y: 0 }),
      wp(21.5, -35.5, { y: 1.2 }),
      wp(21.5, -31.5, { y: 1.2 }),
    ],
  },
  {
    id: "M06",
    label: "CT Spawn -> Market Alley -> Market Door -> B Site",
    points: [
      wp(-32, -40, { y: 0 }),
      wp(-40, -40, { y: 0 }),
      wp(-40, -10, { y: 0 }),
      wp(-40, 14, { y: 0 }),
      wp(-40.3, 19, { y: 0, tol: 0.8 }),
      wp(-39, 25.5, { y: 0.14 }),
    ],
  },
  {
    id: "M07",
    label: "CT Spawn -> Sniper Alley -> Jungle -> Window -> Vent -> Ladder Room -> B Short -> B Site",
    points: [
      wp(-32.5, -40, { y: 0 }),
      wp(-32.5, -20, { y: 0 }),
      wp(-29, -18, { y: 0 }),
      wp(-29, 3.5, { y: 2.0 }),
      wp(-28.75, 8.2, { y: 2.0, tol: 0.8 }),
      wp(-28.75, 13.8, { y: 0 }),
      wp(-28.5, 22, { y: 0 }),
      wp(-39, 25.5, { y: 0.14 }),
    ],
  },
  {
    id: "M08",
    label: "A Site -> A Stairs -> Jungle -> Window",
    points: [
      wp(22, -31.5, { y: 1.2 }),
      wp(22, -21.5, { y: 0 }),
      wp(-23, -21.5, { y: 0 }),
      wp(-29, -18, { y: 0 }),
      wp(-29, 3.5, { y: 2.0 }),
    ],
  },
  {
    id: "M09",
    label: "T Spawn -> Side Alley -> House -> Back Alley -> B Apartments (Walk to Balcony)",
    points: [
      wp(45, 11, { y: 0 }),
      wp(24, 12, { y: 0 }),
      wp(19, 17, { y: 0 }),
      wp(19, 30, { y: 0 }),
      wp(18.5, 34.5, { y: 0 }),
      wp(10.5, 34.5, { y: 2.4 }),
      wp(-10, 36.5, { y: 2.4 }),
      wp(-38.5, 36.5, { y: 2.4 }),
      wp(-38.5, 32.3, { y: 2.4 }),
    ],
  },
];

test("Bolluca V2: all 9 core Mirage walkable routes traverse cleanly in BOTH directions without jumping", () => {
  for (const r of WALKABLE_BIDIRECTIONAL_ROUTES) {
    traverseRoute(map, `${r.id} FWD (${r.label})`, r.points, false);
    traverseRoute(map, `${r.id} REV (${r.label})`, [...r.points].reverse(), false);
  }
});

test("Bolluca V2: drop & jump routes (Palace Balcony->A, B Apps Balcony<->Van/B Site, Market Window<->B Site, Window->Mid)", () => {
  // 1. T Spawn -> Palace -> Palace Balcony -> drop to A Site
  traverseRoute(
    map,
    "Palace Balcony drop -> A Site",
    [
      wp(45, 7, { y: 0 }),
      wp(47.5, -47.5, { y: 0 }),
      wp(36, -46.5, { y: 3.0 }),
      wp(23, -46.5, { y: 3.0 }),
      wp(23, -43.0, { y: 3.0 }),
      wp(23, -38.5, { y: 0.6 }),
      wp(22, -31.5, { y: 1.2 }),
    ],
    false,
  );

  // 2. B Apartments Balcony -> drop into B Site
  traverseRoute(
    map,
    "B Apartments Balcony drop -> B Site",
    [
      wp(-38.5, 36.5, { y: 2.4 }),
      wp(-38.5, 32.3, { y: 2.4 }),
      wp(-38.5, 29.5, { y: 0 }),
      wp(-39.0, 25.5, { y: 0.14 }),
    ],
    false,
  );

  // 3. B Site -> Van Hood (jump) -> Van Roof (jump) -> B Apartments Balcony (jump)
  traverseRoute(
    map,
    "B Site -> Van climb -> B Apartments Balcony",
    [
      wp(-43.4, 26.8, { y: 0, tol: 0.6 }),
      wp(-43.4, 28.65, { y: 1.1, jump: true, tol: 0.65 }),
      wp(-43.4, 31.2, { y: 2.0, jump: true, tol: 0.75 }),
      wp(-40.4, 32.3, { y: 2.4, jump: true, tol: 0.9 }),
      wp(-38.5, 35.5, { y: 2.4 }),
    ],
    true,
  );

  // 4. Market Window jump in BOTH directions (Market -> B Site and B Site -> Market)
  traverseRoute(
    map,
    "Market -> Market Window (jump) -> B Site",
    [
      wp(-35.5, 16.2, { y: 0, tol: 0.7 }),
      wp(-35.5, 18.2, { y: 0.30, tol: 0.6 }),
      wp(-35.5, 20.6, { y: 0, jump: true, tol: 0.8 }),
      wp(-36.0, 24.5, { y: 0.14 }),
    ],
    true,
  );
  traverseRoute(
    map,
    "B Site -> Market Window (jump) -> Market",
    [
      wp(-35.5, 21.0, { y: 0, tol: 0.7 }),
      wp(-35.5, 19.0, { y: 0.78, jump: true, tol: 0.6 }),
      wp(-35.5, 16.5, { y: 0, tol: 0.8 }),
    ],
    true,
  );

  // 5. Window / Sniper's Nest -> Mid drop (jump over window sill)
  traverseRoute(
    map,
    "Window -> Mid drop",
    [
      wp(-27.0, 4.5, { y: 2.0, tol: 0.6 }),
      wp(-25.0, 4.5, { y: 2.84, jump: true, tol: 0.6 }),
      wp(-22.0, 4.5, { y: 0, tol: 0.9 }),
    ],
    true,
  );
});

// =============================================================================
// 2. CALLOUTS, LANDMARKS & MULTI-TIER VERTICALITY
// =============================================================================
test("Bolluca V2: all authentic CS:GO Mirage callouts resolve and iconic props exist", () => {
  const requiredCallouts = [
    "T Spawn",
    "T Ramp",
    "A Ramp",
    "Palace Alley",
    "Palace",
    "Palace Balcony",
    "Side Alley",
    "House",
    "Back Alley",
    "B Apartments",
    "B Balcony",
    "Top Mid",
    "Mid",
    "Mid Boxes",
    "Chair",
    "Connector",
    "Underpass",
    "Catwalk",
    "B Short",
    "Window",
    "Ladder Room",
    "Vent",
    "Jungle",
    "Stairs",
    "A Site",
    "A Stairs",
    "Tetris",
    "Sandwich",
    "A Default",
    "Triple Box",
    "Firebox",
    "Ninja",
    "Shadow",
    "Ticket",
    "Ticket Booth",
    "B Site",
    "B Default",
    "E-Box",
    "Bench",
    "Back Site",
    "Van",
    "Market",
    "Market Door",
    "Market Window",
    "Market Alley",
    "Sniper Alley",
    "CT Spawn",
  ];
  const available = new Set(BOLLUCA_V2_CALLOUTS.map((c) => c.name));
  for (const name of requiredCallouts) {
    assert.ok(available.has(name), `Missing Mirage callout: ${name}`);
    const entry = BOLLUCA_V2_CALLOUTS.find((c) => c.name === name)!;
    const resolved = getBollucaV2Callout(entry.anchor.x, entry.anchor.y, entry.anchor.z);
    assert.notEqual(resolved, "Bolluca V2", `Callout ${name} did not resolve`);
  }

  const requiredSolids = [
    "bollucav2-crate-tetris-base",
    "bollucav2-sandwich-wall",
    "bollucav2-a-stairs-east-parapet",
    "bollucav2-crate-a-default",
    "bollucav2-crate-triple-main",
    "bollucav2-crate-firebox-base",
    "bollucav2-crate-ninja-crate",
    "bollucav2-ticket-booth",
    "bollucav2-palace-dome-crown",
    "bollucav2-mid-chair-seat",
    "bollucav2-crate-top-mid-boxes",
    "bollucav2-window-sill",
    "bollucav2-window-under-bench",
    "bollucav2-b-canopy-tarp",
    "bollucav2-crate-b-default",
    "bollucav2-crate-b-ebox",
    "bollucav2-crate-b-bench",
    "bollucav2-van-body",
    "bollucav2-market-counter",
    "bollucav2-market-window-sill",
    "bollucav2-b-minaret-shaft",
  ];
  for (const id of requiredSolids) {
    assert.ok(map.solids.some((s) => s.id === id), `Missing Mirage landmark solid: ${id}`);
  }
});

test("Bolluca V2: true two-tier elevation overlaps (Catwalk Bridge over Underpass, Palace Balcony over Shadow)", () => {
  // Catwalk Bridge (y=3.1) directly over Underpass (y=0.0)
  const yCatwalk = support(map, { x: -17, y: 0, z: 13 }, 4.0);
  const yUnderpass = support(map, { x: -17, y: 0, z: 13 }, 1.2);
  assert.ok(Math.abs(yCatwalk - 3.1) < 0.05, `Catwalk Bridge should be 3.1m, got ${yCatwalk}`);
  assert.ok(Math.abs(yUnderpass - 0.0) < 0.05, `Underpass floor should be 0.0m, got ${yUnderpass}`);
  assert.ok(fits(map, { x: -17, y: 0, z: 13 }, C.standing), "Standing player must fit Under Catwalk Bridge in Underpass");
  assert.ok(fits(map, { x: -17, y: 3.1, z: 13 }, C.standing), "Standing player must fit ON TOP of Catwalk Bridge");

  // Palace Balcony (y=3.0) directly over Shadow / Under-Balcony (y=0.0)
  const yBalcony = support(map, { x: 23, y: 0, z: -43.1 }, 4.0);
  const yShadow = support(map, { x: 23, y: 0, z: -43.1 }, 1.2);
  assert.ok(Math.abs(yBalcony - 3.0) < 0.05, `Palace Balcony should be 3.0m, got ${yBalcony}`);
  assert.ok(Math.abs(yShadow - 0.0) < 0.05, `Shadow below Balcony should be 0.0m, got ${yShadow}`);
  assert.ok(fits(map, { x: 23, y: 0, z: -43.1 }, C.standing), "Standing player must fit under Palace Balcony in Shadow");
  assert.ok(fits(map, { x: 23, y: 3.0, z: -43.1 }, C.standing), "Standing player must fit ON Palace Balcony");

  // Key elevation hierarchy
  assert.ok(Math.abs(support(map, { x: 17.5, y: 0, z: 4.5 }, 2.0) - 0.6) < 0.05, "Top Mid terrace should be 0.6m");
  assert.ok(Math.abs(support(map, { x: 22, y: 0, z: -31.5 }, 2.5) - 1.2) < 0.05, "A Platform should be 1.2m");
  assert.ok(Math.abs(support(map, { x: -29, y: 0, z: 4 }, 3.0) - 2.0) < 0.05, "Window Room should be 2.0m");
  assert.ok(Math.abs(support(map, { x: -10, y: 0, z: 36.5 }, 3.5) - 2.4) < 0.05, "B Apartments should be 2.4m");
});

// =============================================================================
// 3. SPAWNS, SIGHTLINES & WALL OCCLUSION
// =============================================================================
test("Bolluca V2: 5 T & 5 CT spawns valid, separated, with zero cross-map spawn sightlines", () => {
  assert.equal(map.spawns.length, 10);
  const tSpawns = map.spawns.slice(0, 5);
  const ctSpawns = map.spawns.slice(5, 10);

  for (const s of map.spawns) {
    assert.ok(fits(map, s, C.standing), `Spawn blocked: ${JSON.stringify(s)}`);
    assert.ok(Math.abs(support(map, s, s.y + 0.1) - s.y) < 0.08, `Spawn unsupported: ${JSON.stringify(s)}`);
  }
  for (let i = 0; i < map.spawns.length; i++) {
    for (let j = i + 1; j < map.spawns.length; j++) {
      const d = Math.hypot(map.spawns[i].x - map.spawns[j].x, map.spawns[i].z - map.spawns[j].z);
      assert.ok(d >= 2.0, `Spawns ${i} & ${j} too close (${d.toFixed(2)}m)`);
    }
  }
  for (const ts of tSpawns) {
    for (const cs of ctSpawns) {
      assert.equal(
        hasLineOfSight(map, { x: ts.x, y: ts.y + C.eye, z: ts.z }, { x: cs.x, y: cs.y + C.eye, z: cs.z }),
        false,
        "Unfair direct T-to-CT spawn sightline",
      );
    }
  }
});

test("Bolluca V2: authentic Mirage sightlines open & solid structural dividers block bullets", () => {
  // 1. Classic Top Mid -> Sniper Window AWP sightline OPEN!
  assert.equal(
    hasLineOfSight(map, { x: 17.5, y: 0.6 + C.eye, z: 4.5 }, { x: -27.5, y: 2.0 + C.eye, z: 4.5 }),
    true,
    "Top Mid -> Sniper Window AWP duel sightline must be OPEN",
  );
  // 2. Palace Balcony -> A Site Default OPEN!
  assert.equal(
    hasLineOfSight(map, { x: 23, y: 3.0 + C.eye, z: -42.8 }, { x: 22, y: 1.2 + C.eye, z: -31.5 }),
    true,
    "Palace Balcony -> A Site sightline must be OPEN",
  );
  // 3. Market Window -> B Site OPEN, Market Door -> B Site OPEN, solid divider pier BLOCKED!
  assert.equal(
    hasLineOfSight(map, { x: -35.5, y: C.eye, z: 17.0 }, { x: -37.5, y: 0.14 + C.eye, z: 25.5 }),
    true,
    "Market Window -> B Site sightline must be OPEN",
  );
  assert.equal(
    hasLineOfSight(map, { x: -40.3, y: C.eye, z: 16.5 }, { x: -40.0, y: 0.14 + C.eye, z: 24.5 }),
    true,
    "Market Door -> B Site sightline must be OPEN",
  );
  assert.equal(
    hasLineOfSight(map, { x: -37.55, y: C.eye, z: 17.0 }, { x: -37.55, y: C.eye, z: 21.0 }),
    false,
    "Solid wall pier between Market Door and Market Window must block bullets",
  );
  // 4. B Apartments Balcony -> B Site OPEN!
  assert.equal(
    hasLineOfSight(map, { x: -38.5, y: 2.4 + C.eye, z: 32.5 }, { x: -39.0, y: 0.14 + C.eye, z: 25.5 }),
    true,
    "B Apartments Balcony -> B Site sightline must be OPEN",
  );
  // 5. Solid wall between Market and B Short MUST block sightlines!
  assert.equal(
    hasLineOfSight(map, { x: -35.0, y: C.eye, z: 15.0 }, { x: -29.0, y: C.eye, z: 15.0 }),
    false,
    "Solid masonry wall between Market and B Short must block sightlines",
  );
  // 6. Dense A Site <-> B Site occlusion matrix
  const [siteA, siteB] = BOLLUCA_V2_SITES;
  let checked = 0;
  for (let ax = -3; ax <= 3; ax += 1.5) {
    for (let az = -3; az <= 3; az += 1.5) {
      for (let bx = -3; bx <= 3; bx += 1.5) {
        for (let bz = -3; bz <= 3; bz += 1.5) {
          checked++;
          assert.equal(
            hasLineOfSight(
              map,
              { x: siteA.x + ax, y: siteA.y + C.eye, z: siteA.z + az },
              { x: siteB.x + bx, y: siteB.y + C.eye, z: siteB.z + bz },
            ),
            false,
            `A/B sightline leak at A(${ax},${az}) -> B(${bx},${bz})`,
          );
        }
      }
    }
  }
  assert.ok(checked >= 500);
});

// =============================================================================
// 4. BOMB PLANTING, SERVER LIFECYCLE, PERIMETER SEAL & NULLENGINE RENDERING
// =============================================================================
test("Bolluca V2: Bomb plant boundaries strictly scoped to A & B sites; server Bomb mode works & preserves original bolluca", () => {
  assert.ok(BOMB_MAPS.some((m) => m.id === "bollucav2"), "Bolluca V2 must be registered in BOMB_MAPS");
  assert.ok(BOMB_MAPS.some((m) => m.id === "bolluca"), "Original Bolluca must remain untouched in BOMB_MAPS");
  assert.ok(BOMB_MAPS.some((m) => m.id === "dust2v2"), "Dust II V2 must remain untouched in BOMB_MAPS");

  for (const site of BOLLUCA_V2_SITES) {
    assert.ok(fits(map, { x: site.x, y: site.y, z: site.z }, C.standing));
    const match = createBombMatch(
      [
        { id: "t", team: "T", position: { x: site.x, y: site.y, z: site.z } },
        { id: "ct", team: "CT", position: { x: -25, y: 0, z: -40 } },
      ],
      0,
      false,
      map.bombSites,
    );
    stepBomb(match, 15);
    assert.equal(bombInteract(match, "t", true, 16), true, `Must accept plant at site ${site.id}`);
    match.players.t.holdUntil = 20;
    stepBomb(match, 19.25);
    assert.equal(match.phase, "planted");
    assert.equal(match.site, site.id);
  }

  const illegalZones: [string, Vec3][] = [
    ["A Ramp", { x: 42, y: 0, z: -25 }],
    ["Palace", { x: 28, y: 3.0, z: -47 }],
    ["Mid", { x: 0, y: 0, z: 4.5 }],
    ["Connector", { x: -2, y: 1.2, z: -13 }],
    ["Window", { x: -29, y: 2.0, z: 4 }],
    ["Market", { x: -39, y: 0, z: 14 }],
    ["B Apartments", { x: -20, y: 2.4, z: 36.5 }],
    ["CT Spawn", { x: -25, y: 0, z: -40 }],
  ];
  for (const [label, pos] of illegalZones) {
    const match = createBombMatch(
      [
        { id: "t", team: "T", position: { ...pos } },
        { id: "ct", team: "CT", position: { x: -25, y: 0, z: -40 } },
      ],
      0,
      false,
      map.bombSites,
    );
    stepBomb(match, 15);
    assert.equal(bombInteract(match, "t", true, 16), false, `Must REJECT bomb plant outside site at ${label}`);
  }

  // Zero Kill Race supply crates/airdrops
  assert.deepEqual(supplyLocations(map), []);
  const world = createWorld(map, 42);
  assert.equal(world.pickups.length, 0);
  advanceWorld(world, map, DROP_INTERVAL * 3);
  assert.equal(world.pickups.length, 0);
  assert.equal(world.drop, undefined);
  assert.equal(claimSupply(world, map, createTraining("bollucav2").player, 1), false);

  // Server room creation & simulation
  const io: any = { to: () => ({ emit() {} }), emit() {} };
  const server = new KapsStrikeServerManager(io);
  const room = server.createRoom({ id: 201, username: "mirage-t", avatar: null }, "mt-1", {
    mode: "bomb",
    map: "bollucav2",
  });
  assert.equal(room.map, "bollucav2");
  server.joinRoom(room.roomCode, { id: 202, username: "mirage-ct", avatar: null }, "mct-1");
  server.setReady("mct-1", true);
  assert.equal(server.startGame("mt-1").success, true);
  server.stopRoomSimulationLoop(room);
  assert.equal(room.bomb?.sites?.length, 2);
  assert.equal(room.getSnapshotForPlayer("mt-1").world!.pickups.length, 0);
  server.tickSimulation(room);
  assert.equal(room.world.pickups.length, 0);

  // FFA/Kill Race rejects bomb-only bollucav2
  const ffaRoom = server.createRoom({ id: 203, username: "ffa", avatar: null }, "mffa-1", {
    mode: "ffa",
    map: "bollucav2",
  });
  assert.notEqual(ffaRoom.map, "bollucav2");
  server.leaveRoom("mt-1", 201);
  server.leaveRoom("mct-1", 202);
  server.leaveRoom("mffa-1", 203);
});

test("Bolluca V2: sealed perimeter prevents escape, zero skyline overlap, and Babylon NullEngine renders all 3 tiers", async () => {
  const rects = Object.values(BOLLUCA_V2_BLOCKS);
  const insideFootprint = (x: number, z: number, pad = 0.01) =>
    rects.some(([l, r, b, t]) => x >= l - pad && x <= r + pad && z >= b - pad && z <= t + pad);

  const probes: [Vec3, number][] = [
    [{ x: 51.2, y: 0, z: 7 }, Math.PI / 2],
    [{ x: 45, y: 0, z: 15.2 }, 0],
    [{ x: -46.2, y: 0, z: 25 }, -Math.PI / 2],
    [{ x: -20, y: 2.4, z: 39.2 }, 0],
    [{ x: -25, y: 0, z: -46.2 }, Math.PI],
    [{ x: 30, y: 3.0, z: -50.2 }, Math.PI],
  ];
  for (const [start, yaw] of probes) {
    const m = newMovement({ ...start });
    for (let tick = 1; tick <= 220; tick++) {
      move(
        m,
        {
          sequence: tick,
          tick,
          moveX: 0,
          moveZ: 1,
          yaw,
          pitch: 0,
          jump: tick % 45 === 1,
          sprint: true,
          crouch: false,
          fire: false,
          ads: false,
          reload: false,
        },
        map,
        tick,
      );
      assert.ok(
        insideFootprint(m.position.x, m.position.z, 0.35),
        `Player escaped perimeter near ${JSON.stringify(start)} -> ${JSON.stringify(m.position)}`,
      );
    }
  }

  // Zero skyline overlap into playable footprint
  const skylineMasses = map.solids.filter((s) => s.id.includes("skyline-mass"));
  assert.ok(skylineMasses.length >= 6);
  for (const s of skylineMasses) {
    const sMinX = s.x - s.w / 2;
    const sMaxX = s.x + s.w / 2;
    const sMinZ = s.z - s.d / 2;
    const sMaxZ = s.z + s.d / 2;
    for (const [blockName, [bw, be, bs, bn]] of Object.entries(BOLLUCA_V2_BLOCKS)) {
      const overlapX = Math.min(sMaxX, be) - Math.max(sMinX, bw);
      const overlapZ = Math.min(sMaxZ, bn) - Math.max(sMinZ, bs);
      assert.ok(
        !(overlapX > 0.05 && overlapZ > 0.05),
        `Skyline block ${s.id} overlaps playable block "${blockName}" by ${overlapX.toFixed(2)}x${overlapZ.toFixed(2)}m`,
      );
    }
  }

  // Babylon NullEngine verification across low, medium, high
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine");
  const { StrikeRenderer } = await import("../src/games/kapsstrike/renderer");
  const { DEFAULT_SETTINGS } = await import("../src/games/kapsstrike/config");
  const state = createTraining("bollucav2");
  for (const quality of ["low", "medium", "high"] as const) {
    const engine = new NullEngine();
    const renderer = new StrikeRenderer({} as HTMLCanvasElement, map, { ...DEFAULT_SETTINGS, quality }, engine);
    try {
      renderer.render(state, 0, 0, false, 1, state.player.movement.position, 1 / 60);
      assert.ok(
        renderer.scene.meshes.length > 80,
        `Bolluca V2 (${quality}) must build a complete scene, got ${renderer.scene.meshes.length} meshes`,
      );
    } finally {
      renderer.dispose();
    }
  }
});
