import test from "node:test";
import assert from "node:assert/strict";
import { MAPS, BOMB_MAPS } from "../src/games/kapsstrike/maps";
import {
  DUST2_V2_BLOCKS,
  DUST2_V2_CALLOUTS,
  DUST2_V2_SITES,
  getDust2V2Callout,
} from "../src/games/kapsstrike/dust2v2";
import { fits, move, newMovement, raySolid, support } from "../src/games/kapsstrike/physics";
import { PHYSICS as C } from "../src/games/kapsstrike/config";
import { bombInteract, createBombMatch, stepBomb } from "../src/games/kapsstrike/bomb";
import { advanceWorld, claimSupply, createWorld, DROP_INTERVAL, supplyLocations } from "../src/games/kapsstrike/world";
import { createTraining } from "../src/games/kapsstrike/combat";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
import type { MapDefinition, Vec3 } from "../src/games/kapsstrike/types";

const map = MAPS.dust2v2;

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
  allowJumpOnWaypoints = true
): Vec3 {
  const startY =
    points[0].y ?? support(m, { x: points[0].x, y: 0, z: points[0].z }, 4.5);
  const state = newMovement({ x: points[0].x, y: startY, z: points[0].z });
  assert.ok(
    fits(m, state.position, C.standing),
    `${name}: start position blocked at ${JSON.stringify(state.position)}`
  );

  let tick = 1;
  for (let i = 1; i < points.length; i++) {
    const target = points[i];
    const tol = target.tol ?? 1.15;
    let reached = false;
    let stuckTicks = 0;
    let prevX = state.position.x;
    let prevZ = state.position.z;

    for (let step = 0; step < 1200; step++) {
      const dx = target.x - state.position.x;
      const dz = target.z - state.position.z;
      const horiz = Math.hypot(dx, dz);
      const yOk = target.y === undefined || Math.abs(state.position.y - target.y) <= 0.75;
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

      // Trigger jump when explicitly requested for an obstacle (Xbox / B Window sill)
      const wantsJump =
        allowJumpOnWaypoints &&
        Boolean(target.jump) &&
        state.grounded &&
        (horiz < 2.6 || stuckTicks >= 4);

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
        tick
      );
      tick++;
      assert.ok(
        Math.abs(state.position.x) < m.bounds && Math.abs(state.position.z) < m.bounds,
        `${name}: player escaped map bounds at ${JSON.stringify(state.position)}`
      );
      assert.ok(
        state.position.y >= -0.05 && state.position.y <= 9,
        `${name}: abnormal elevation ${state.position.y} at step ${step}`
      );
    }

    assert.ok(
      reached,
      `${name}: failed to reach waypoint #${i} (${target.x}, ${target.z}, y=${target.y ?? "any"}) from (${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`
    );
  }
  return state.position;
}

// -----------------------------------------------------------------------------
// 1. ALL 20 MANDATORY DUST II ROUTES (T01-T10 & CT01-CT10) — BIDIRECTIONAL
// -----------------------------------------------------------------------------
const ROUTES_20: { id: string; label: string; points: Waypoint[]; reversible?: boolean }[] = [
  {
    id: "T01",
    label: "T Spawn -> Outside Long -> Long Doors -> Blue -> A Long -> Car -> A Cross -> A Ramp -> A Site",
    points: [
      wp(0, -47, { y: 2.8 }),
      wp(12, -44, { y: 2.8 }),
      wp(26, -42, { y: 1.6 }),
      wp(30.5, -26, { y: 1.6 }),
      wp(31, -21, { y: 1.6 }),
      wp(31, -17, { y: 1.6 }),
      wp(38, -17, { y: 1.6 }),
      wp(42.5, -10, { y: 1.6 }),
      wp(44, 11.5, { y: 1.6 }),
      wp(44, 26, { y: 1.2 }),
      wp(46, 32, { y: 1.2 }),
      wp(46, 41.5, { y: 3.2 }),
      wp(41, 42.5, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "T02",
    label: "T Spawn -> Suicide -> Top Mid -> Catwalk -> Short Stairs -> A Short -> A Site",
    points: [
      wp(0, -47, { y: 2.8 }),
      wp(0, -32, { y: 2.3 }),
      wp(0, -14, { y: 1.8 }),
      wp(10.2, -13, { y: 1.8 }),
      wp(10.2, 4, { y: 1.8 }),
      wp(10.5, 13, { y: 1.8 }),
      wp(11, 23, { y: 3.2 }),
      wp(24, 26, { y: 3.2 }),
      wp(24, 34, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "T03",
    label: "T Spawn -> Suicide -> Mid -> Xbox (jump) -> Catwalk -> Short Stairs -> A Short -> A Site",
    points: [
      wp(0, -47, { y: 2.8 }),
      wp(0, -24, { y: 1.8 }),
      wp(0, 5, { y: 0 }),
      wp(4.8, 5, { y: 0, tol: 0.7 }),
      wp(6.9, 5, { y: 1.08, jump: true, tol: 0.7 }),
      wp(10.2, 5, { y: 1.8, jump: true, tol: 0.8 }),
      wp(10.8, 13.5, { y: 1.8 }),
      wp(11, 23.5, { y: 3.2 }),
      wp(24, 26, { y: 3.2 }),
      wp(24, 34, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "T04",
    label: "T Spawn -> Suicide -> Mid -> Mid Doors -> CT Mid -> CT Spawn -> Under A -> CT Ramp -> A Site",
    points: [
      wp(0, -47, { y: 2.8 }),
      wp(0, -16, { y: 1.8 }),
      wp(0, 8, { y: 0 }),
      wp(0, 18, { y: 0, tol: 0.65 }),
      wp(0, 29, { y: 0 }),
      wp(14, 30, { y: 0 }),
      wp(18, 26, { y: 0 }),
      wp(28, 26, { y: 0.25 }),
      wp(44, 26, { y: 1.2 }),
      wp(46, 32, { y: 1.2 }),
      wp(46, 41.5, { y: 3.2 }),
      wp(41, 42.5, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "T05",
    label: "T Spawn -> Suicide -> Mid -> Mid Doors -> CT Mid -> B Doors -> B Site",
    points: [
      wp(0, -47, { y: 2.8 }),
      wp(0, -16, { y: 1.8 }),
      wp(0, 10, { y: 0 }),
      wp(0, 18, { y: 0, tol: 0.65 }),
      wp(0, 29, { y: 0 }),
      wp(-16, 31.5, { y: 0 }),
      wp(-26, 31.5, { y: 2.4, tol: 0.7 }),
      wp(-29, 31.5, { y: 2.4 }),
      wp(-29.5, 36.5, { y: 2.4 }),
      wp(-35.2, 37.5, { y: 2.4 }),
    ],
  },
  {
    id: "T06",
    label: "T Spawn -> T Plat -> T Ramp -> Outside Tunnels -> Upper Tunnels -> B Tunnels -> B Site",
    points: [
      wp(-10, -47, { y: 2.8 }),
      wp(-34, -42, { y: 2.8 }),
      wp(-36, -24, { y: 2.4 }),
      wp(-36, -12, { y: 2.4 }),
      wp(-36, -4, { y: 2.4 }),
      wp(-41.5, 4, { y: 2.4 }),
      wp(-42, 22, { y: 2.4 }),
      wp(-42, 31, { y: 2.4 }),
      wp(-35.2, 37.5, { y: 2.4 }),
    ],
  },
  {
    id: "T07",
    label: "T Spawn -> Outside Tunnels -> Upper Tunnels -> Tunnel Stairs -> Lower Tunnels -> Mid -> CT Mid",
    points: [
      wp(-10, -47, { y: 2.8 }),
      wp(-34, -42, { y: 2.8 }),
      wp(-36, -16, { y: 2.4 }),
      wp(-31, 7, { y: 2.4 }),
      wp(-26, 7, { y: 2.4 }),
      wp(-15, 7, { y: 0 }),
      wp(-5, 7, { y: 0 }),
      wp(0, 12, { y: 0 }),
      wp(0, 18, { y: 0, tol: 0.65 }),
      wp(0, 26, { y: 0 }),
    ],
  },
  {
    id: "T08",
    label: "T Spawn -> Outside Long -> Long Doors -> Pit Basin -> Side Pit -> Pit Plat -> A Long",
    points: [
      wp(9, -46, { y: 2.8 }),
      wp(26, -42, { y: 1.6 }),
      wp(31, -21, { y: 1.6 }),
      wp(31, -17, { y: 1.6 }),
      wp(45, -17, { y: 1.6 }),
      wp(45, -28, { y: 0 }),
      wp(45, -33.0, { y: 0 }),
      wp(39.6, -33.0, { y: 0.8 }),
      wp(39.6, -28, { y: 0.8 }),
      wp(39.6, -21, { y: 1.6 }),
      wp(50.4, -21, { y: 1.6 }),
      wp(50.4, -30, { y: 1.6 }),
      wp(50.4, -18, { y: 1.6 }),
      wp(44, 6, { y: 1.6 }),
    ],
  },
  {
    id: "T09",
    label: "T Spawn -> Suicide -> Top Mid -> Top Mid to Long -> Outside Long -> Long Doors",
    points: [
      wp(0, -47, { y: 2.8 }),
      wp(0, -24, { y: 1.8 }),
      wp(8, -20, { y: 1.8 }),
      wp(20, -20, { y: 1.6 }),
      wp(23, -27, { y: 1.6 }),
      wp(31, -26, { y: 1.6 }),
      wp(31, -17, { y: 1.6 }),
    ],
  },
  {
    id: "T10",
    label: "B Site -> B Tunnels -> Upper Tunnels -> Tunnel Stairs -> Lower Tunnels -> Mid -> Catwalk (via Top Mid) -> A Site",
    points: [
      wp(-35.2, 37.5, { y: 2.4 }),
      wp(-42, 30, { y: 2.4 }),
      wp(-42, 12, { y: 2.4 }),
      wp(-31, 7, { y: 2.4 }),
      wp(-15, 7, { y: 0 }),
      wp(0, 7, { y: 0 }),
      wp(0, -12, { y: 1.8 }),
      wp(10.2, -12, { y: 1.8 }),
      wp(10.5, 13, { y: 1.8 }),
      wp(11, 24, { y: 3.2 }),
      wp(24, 26, { y: 3.2 }),
      wp(24, 34, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "CT01",
    label: "CT Spawn -> Under A -> CT Ramp -> A Cross -> A Ramp -> A Site",
    points: [
      wp(14, 31, { y: 0 }),
      wp(18, 29, { y: 0 }),
      wp(18, 25, { y: 0 }),
      wp(28, 25, { y: 0.25 }),
      wp(44, 26, { y: 1.2 }),
      wp(46, 32, { y: 1.2 }),
      wp(46, 41.5, { y: 3.2 }),
      wp(41, 42.5, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "CT02",
    label: "CT Spawn -> Under A -> A Cross -> A Long -> Car -> Blue -> Long Doors -> Outside Long",
    points: [
      wp(14, 31, { y: 0 }),
      wp(18, 25.5, { y: 0 }),
      wp(44, 25.5, { y: 1.2 }),
      wp(44, 11.5, { y: 1.6 }),
      wp(44, -10, { y: 1.6 }),
      wp(44, -17, { y: 1.6 }),
      wp(31, -17, { y: 1.6 }),
      wp(31, -24, { y: 1.6 }),
      wp(25, -30, { y: 1.6 }),
    ],
  },
  {
    id: "CT03",
    label: "CT Spawn -> Under A -> A Cross -> A Long -> Sunken Pit Basin",
    points: [
      wp(15, 31.5, { y: 0 }),
      wp(18, 25.5, { y: 0 }),
      wp(44, 25.5, { y: 1.2 }),
      wp(44, 0, { y: 1.6 }),
      wp(45, -18, { y: 1.6 }),
      wp(45, -30, { y: 0 }),
    ],
  },
  {
    id: "CT04",
    label: "CT Spawn -> CT Mid -> Mid Doors -> Mid -> Top Mid -> Suicide -> T Spawn",
    points: [
      wp(14, 31, { y: 0 }),
      wp(0, 29.5, { y: 0 }),
      wp(0, 18, { y: 0, tol: 0.65 }),
      wp(0, 6, { y: 0 }),
      wp(0, -16, { y: 1.8 }),
      wp(0, -32, { y: 2.3 }),
      wp(0, -47, { y: 2.8 }),
    ],
  },
  {
    id: "CT05",
    label: "CT Spawn -> CT Mid -> Mid Doors -> Mid -> Lower Tunnels -> Tunnel Stairs -> Upper Tunnels -> T Plat",
    points: [
      wp(10, 31.5, { y: 0 }),
      wp(0, 29.5, { y: 0 }),
      wp(0, 18, { y: 0, tol: 0.65 }),
      wp(0, 7, { y: 0 }),
      wp(-12, 7, { y: 0 }),
      wp(-27, 7, { y: 2.4 }),
      wp(-36, -6, { y: 2.4 }),
      wp(-36, -24, { y: 2.4 }),
      wp(-34, -42, { y: 2.8 }),
    ],
  },
  {
    id: "CT06",
    label: "CT Spawn -> CT Mid -> B Doors -> B Site -> B Plat / Back Plat",
    points: [
      wp(10, 31.5, { y: 0 }),
      wp(-6, 30, { y: 0 }),
      wp(-16, 31.5, { y: 0 }),
      wp(-26, 31.5, { y: 2.4, tol: 0.7 }),
      wp(-29, 34, { y: 2.4 }),
      wp(-33, 43.2, { y: 2.4 }),
      wp(-39, 43.2, { y: 3.2 }),
      wp(-43, 45.5, { y: 3.2 }),
    ],
  },
  {
    id: "CT07",
    label: "CT Spawn -> CT Mid -> B Doors -> B Site -> B Tunnels -> Upper Tunnels",
    points: [
      wp(12.5, 30.2, { y: 0 }),
      wp(-6, 30, { y: 0 }),
      wp(-16, 31.5, { y: 0 }),
      wp(-26, 31.5, { y: 2.4, tol: 0.7 }),
      wp(-30, 36, { y: 2.4 }),
      wp(-42, 32, { y: 2.4 }),
      wp(-42, 16, { y: 2.4 }),
      wp(-42, 2, { y: 2.4 }),
    ],
  },
  {
    id: "CT08",
    label: "CT Spawn -> CT Mid -> Mid Doors -> Mid -> Xbox (jump) -> Catwalk -> Short Stairs -> A Short -> A Site",
    points: [
      wp(10, 31.5, { y: 0 }),
      wp(0, 29.5, { y: 0 }),
      wp(0, 18, { y: 0, tol: 0.65 }),
      wp(0, 5, { y: 0 }),
      wp(4.8, 5, { y: 0, tol: 0.7 }),
      wp(6.9, 5, { y: 1.08, jump: true, tol: 0.7 }),
      wp(10.2, 5, { y: 1.8, jump: true, tol: 0.8 }),
      wp(10.8, 13.5, { y: 1.8 }),
      wp(11, 24, { y: 3.2 }),
      wp(24, 26, { y: 3.2 }),
      wp(24, 34, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
  {
    id: "CT09",
    label: "CT Spawn -> CT Mid -> B Window Yard -> B Window Scaffolding -> B Window (jump) -> B Site",
    points: [
      wp(10, 31.5, { y: 0 }),
      wp(-12, 30, { y: 0 }),
      wp(-12, 38.7, { y: 0 }),
      wp(-22, 38.7, { y: 2.4, tol: 0.7 }),
      wp(-24.8, 38.7, { y: 2.4, tol: 0.6 }),
      wp(-27.6, 38.7, { y: 2.4, jump: true, tol: 0.8 }),
      wp(-35.2, 37.5, { y: 2.4 }),
    ],
  },
  {
    id: "CT10",
    label: "B Site -> B Doors -> CT Mid -> CT Spawn -> Under A -> CT Ramp -> A Ramp -> A Site",
    points: [
      wp(-35.2, 37.5, { y: 2.4 }),
      wp(-29.5, 36.5, { y: 2.4 }),
      wp(-29, 31.5, { y: 2.4 }),
      wp(-26, 31.5, { y: 2.4, tol: 0.7 }),
      wp(-16, 31.5, { y: 0 }),
      wp(0, 29.5, { y: 0 }),
      wp(14, 30, { y: 0 }),
      wp(18, 25.5, { y: 0 }),
      wp(44, 25.5, { y: 1.2 }),
      wp(46, 32, { y: 1.2 }),
      wp(46, 41.5, { y: 3.2 }),
      wp(41, 42.5, { y: 3.2 }),
      wp(35.5, 39, { y: 3.2 }),
    ],
  },
];

test("Dust II V2: all 20 mandatory T01-T10 & CT01-CT10 routes traverse cleanly in BOTH directions using real move() physics", () => {
  assert.equal(ROUTES_20.length, 20);
  for (const r of ROUTES_20) {
    // Forward
    traverseRoute(map, `${r.id} FWD (${r.label})`, r.points, true);
    // Reverse (also mark jump waypoints immediately adjacent to sill/Xbox so reverse jumps work)
    const rev = [...r.points].reverse().map((p, idx, arr) => {
      const nextHadJump = idx > 0 && arr[idx - 1].jump;
      return { ...p, jump: Boolean(p.jump || nextHadJump) };
    });
    traverseRoute(map, `${r.id} REV (${r.label})`, rev, true);
  }
});

// -----------------------------------------------------------------------------
// 2. CALLOUTS & LANDMARKS COMPLETENESS
// -----------------------------------------------------------------------------
test("Dust II V2: all authentic CS:GO callouts resolve cleanly and iconic landmarks exist", () => {
  const requiredCallouts = [
    "T Spawn",
    "T Plat",
    "T Ramp",
    "Suicide",
    "Outside Tunnels",
    "Outside Long",
    "Long Doors",
    "Blue",
    "Long Corner",
    "Pit",
    "Side Pit",
    "Pit Plat",
    "A Long",
    "Car",
    "A Cross",
    "A Ramp",
    "A Site",
    "A Default",
    "Quad",
    "Goose",
    "Ninja",
    "Barrels",
    "Elevator",
    "Top Mid",
    "Mid",
    "Xbox",
    "Catwalk",
    "Short Stairs",
    "A Short",
    "Mid Doors",
    "CT Mid",
    "B Boxes",
    "CT Spawn",
    "Under A",
    "CT Ramp",
    "Upper Tunnels",
    "Tunnel Stairs",
    "Lower Tunnels",
    "B Tunnels",
    "B Doors",
    "B Window",
    "B Site",
    "B Car",
    "Close Left",
    "Closet",
    "Big Box",
    "Double Stack",
    "B Default",
    "B Plat",
    "Back Plat",
    "Back Site",
    "Fence / Dog",
  ];

  const available = new Set(DUST2_V2_CALLOUTS.map((c) => c.name));
  for (const name of requiredCallouts) {
    assert.ok(available.has(name), `Missing required callout: ${name}`);
    const entry = DUST2_V2_CALLOUTS.find((c) => c.name === name)!;
    const resolved = getDust2V2Callout(entry.anchor.x, entry.anchor.y, entry.anchor.z);
    assert.notEqual(resolved, "Dust II V2", `Callout ${name} anchor did not resolve to a zone`);
  }

  const requiredSolidTags = [
    "blue-container-body",
    "a-long-car-chassis",
    "b-site-car-chassis",
    "mid-xbox-main",
    "top-mid-green",
    "mid-palm-trunk",
    "long-door-south-leaf",
    "long-door-east-leaf",
    "mid-door-leaf-w",
    "mid-door-leaf-e",
    "b-door-leaf",
    "b-window-sill",
    "b-window-lintel",
    "b-window-scaffold-deck",
    "a-default-main",
    "a-quad-base",
    "a-goose-sign",
    "a-ninja-box",
    "upper-tunnels-column",
    "upper-tunnels-beam",
    "b-plat",
    "b-big-box",
    "b-double-stack-low",
    "b-fence-slats",
  ];
  for (const tag of requiredSolidTags) {
    assert.ok(
      map.solids.some((s) => s.id.includes(tag)),
      `Missing iconic landmark solid: ${tag}`
    );
  }
});

// -----------------------------------------------------------------------------
// 3. AUTHENTIC MULTI-TIER VERTICAL ELEVATIONS & UNDER-A BRIDGE CLEARANCE
// -----------------------------------------------------------------------------
test("Dust II V2: authentic vertical elevation tiers (Pit sunken, Lower Tunnels sunken, A Site high, Under A bridge)", () => {
  const floorAt = (x: number, z: number, ceiling = 5) => support(map, { x, y: 0, z }, ceiling);

  const yTSpawn = floorAt(0, -47);
  const yTopMid = floorAt(0, -16);
  const yMidLower = floorAt(0, 8);
  const yALong = floorAt(44, 6);
  const yPit = floorAt(45, -30);
  const ySidePit = floorAt(39.6, -28);
  const yPitPlat = floorAt(50.4, -28);
  const yACross = floorAt(44, 26);
  const yASite = floorAt(35.5, 39);
  const yAShortBridge = floorAt(20, 26, 4.0);
  const yUnderA = support(map, { x: 20, y: 0, z: 26 }, 1.2);
  const yUpperTunnels = floorAt(-36, -2);
  const yLowerTunnels = support(map, { x: -11, y: 0, z: 7 }, 1.5);
  const yBSite = floorAt(-35.2, 37.5);
  const yBPlat = floorAt(-43, 45);
  const yCTSpawn = floorAt(14, 31);

  assert.ok(Math.abs(yTSpawn - 2.8) < 0.05, `T Spawn should be 2.8m, got ${yTSpawn}`);
  assert.ok(Math.abs(yTopMid - 1.8) < 0.05, `Top Mid should be 1.8m, got ${yTopMid}`);
  assert.ok(Math.abs(yMidLower - 0.0) < 0.05, `Lower Mid should be 0.0m, got ${yMidLower}`);
  assert.ok(yALong - yPit >= 1.5, `Pit (${yPit}) must be significantly sunken below A Long (${yALong})`);
  assert.ok(ySidePit > yPit + 0.5 && ySidePit < yALong - 0.5, `Side Pit (${ySidePit}) must step between Pit and A Long`);
  assert.ok(Math.abs(yPitPlat - yALong) < 0.05, `Pit Plat (${yPitPlat}) must match A Long (${yALong})`);
  assert.ok(yUpperTunnels - yLowerTunnels >= 2.2, `Lower Tunnels (${yLowerTunnels}) must drop >=2.2m below Upper Tunnels (${yUpperTunnels})`);
  assert.ok(yASite - yACross >= 1.9, `A Site (${yASite}) must tower above A Cross (${yACross})`);
  assert.ok(yASite - yCTSpawn >= 3.0, `A Site (${yASite}) must tower above CT Spawn (${yCTSpawn})`);
  assert.ok(yBPlat - yBSite >= 0.75, `B Plat (${yBPlat}) must elevate above B Site courtyard (${yBSite})`);

  // True two-tier bridge: A Short Bridge at y=3.2 directly OVER Under A at y=0.0
  assert.ok(Math.abs(yAShortBridge - 3.2) < 0.05, `A Short Bridge top should be 3.2m, got ${yAShortBridge}`);
  assert.ok(Math.abs(yUnderA - 0.0) < 0.05, `Under A floor should be 0.0m, got ${yUnderA}`);
  assert.ok(fits(map, { x: 20, y: 0, z: 26 }, C.standing), "Standing player must fit cleanly Under A Bridge");
  assert.ok(fits(map, { x: 20, y: 3.2, z: 26 }, C.standing), "Standing player must fit cleanly ON TOP of A Short Bridge");
});

// -----------------------------------------------------------------------------
// 4. SPAWNS, SIGHTLINES, DOORWAYS & STAIRCASES
// -----------------------------------------------------------------------------
test("Dust II V2: 5 T & 5 CT spawns are valid, well-separated, and block unfair direct spawn/site sightlines", () => {
  assert.equal(map.spawns.length, 10);
  const tSpawns = map.spawns.slice(0, 5);
  const ctSpawns = map.spawns.slice(5, 10);

  for (const s of map.spawns) {
    assert.ok(fits(map, s, C.standing), `Spawn blocked: ${JSON.stringify(s)}`);
    const floor = support(map, s, s.y + 0.1);
    assert.ok(Math.abs(floor - s.y) < 0.08, `Spawn not supported at floor: ${JSON.stringify(s)} vs ${floor}`);
  }
  for (let i = 0; i < map.spawns.length; i++) {
    for (let j = i + 1; j < map.spawns.length; j++) {
      const d = Math.hypot(map.spawns[i].x - map.spawns[j].x, map.spawns[i].z - map.spawns[j].z);
      assert.ok(d >= 2.0, `Spawns ${i} and ${j} too close: ${d.toFixed(2)}m`);
    }
  }
  // No cross-map T-to-CT spawn-kill sightline at round start
  for (const ts of tSpawns) {
    for (const cs of ctSpawns) {
      assert.equal(
        hasLineOfSight(map, { x: ts.x, y: ts.y + C.eye, z: ts.z }, { x: cs.x, y: cs.y + C.eye, z: cs.z }),
        false,
        `Unfair spawn sightline from T(${ts.x},${ts.z}) to CT(${cs.x},${cs.z})`
      );
    }
  }
  // CT Spawn cannot directly see A Site or B Site
  const [siteA, siteB] = DUST2_V2_SITES;
  for (const cs of ctSpawns) {
    const eye = { x: cs.x, y: cs.y + C.eye, z: cs.z };
    assert.equal(
      hasLineOfSight(map, eye, { x: siteA.x, y: siteA.y + C.eye, z: siteA.z }),
      false,
      `CT spawn ${JSON.stringify(cs)} should not directly see A Site`
    );
    assert.equal(
      hasLineOfSight(map, eye, { x: siteB.x, y: siteB.y + C.eye, z: siteB.z }),
      false,
      `CT spawn ${JSON.stringify(cs)} should not directly see B Site`
    );
  }
});

test("Dust II V2: authentic sightlines (Mid AWP slit open, Long Doors->A blocked, A<->B occluded, B Window open)", () => {
  // 1. Iconic T Spawn -> Suicide -> Mid Doors slit -> CT Mid AWP sightline OPEN!
  assert.equal(
    hasLineOfSight(map, { x: 0, y: 2.8 + C.eye, z: -45 }, { x: 0, y: C.eye, z: 25 }),
    true,
    "Iconic T Spawn -> Suicide -> Mid Doors -> CT Mid sniper sightline must be open"
  );

  // 2. Long Doors interior MUST NOT have a direct sightline to A Site
  for (const lx of [28, 31, 34]) {
    for (const lz of [-20, -17, -14]) {
      assert.equal(
        hasLineOfSight(map, { x: lx, y: 1.6 + C.eye, z: lz }, { x: 35.5, y: 3.2 + C.eye, z: 39 }),
        false,
        `Long Doors (${lx},${lz}) must NOT have direct line of sight to A Site`
      );
    }
  }

  // 3. A Long -> A Site sightline OPEN (classic Long A duel)
  assert.equal(
    hasLineOfSight(map, { x: 45, y: 1.6 + C.eye, z: 4 }, { x: 45, y: 3.2 + C.eye, z: 42 }),
    true,
    "A Long -> A Site / Goose sightline should be open"
  );

  // 4. B Window sightline into B Site OPEN, solid pier between B Doors & B Window BLOCKED
  assert.equal(
    hasLineOfSight(map, { x: -23, y: 2.4 + C.eye, z: 38.7 }, { x: -35.2, y: 2.4 + C.eye, z: 37.5 }),
    true,
    "B Window scaffolding must have clear sightline through B Window into B Site"
  );
  assert.equal(
    hasLineOfSight(map, { x: -23, y: 2.4 + C.eye, z: 35.15 }, { x: -30, y: 2.4 + C.eye, z: 35.15 }),
    false,
    "Solid masonry pier between B Doors and B Window must block sightlines"
  );

  // 5. Dense A Site <-> B Site occlusion matrix
  const [siteA, siteB] = DUST2_V2_SITES;
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
              { x: siteB.x + bx, y: siteB.y + C.eye, z: siteB.z + bz }
            ),
            false,
            `A/B sightline leak at A(${ax},${az}) -> B(${bx},${bz})`
          );
        }
      }
    }
  }
  assert.ok(checked >= 500);
});

test("Dust II V2: all authored arch doorways and all three staircases pass standing clearance without jumping", () => {
  // Check every entry-lintel at its true local floor elevation
  const lintels = map.solids.filter((s) => s.id.includes("entry-lintel"));
  assert.ok(lintels.length >= 6, "Must have multiple authored archways");
  for (const lintel of lintels) {
    const floorY = support(map, { x: lintel.x, y: 0, z: lintel.z }, lintel.y - 0.1);
    const alongX = lintel.w > lintel.d;
    for (const off of [-0.6, 0, 0.6]) {
      const p = alongX
        ? { x: lintel.x, y: floorY, z: lintel.z + off }
        : { x: lintel.x + off, y: floorY, z: lintel.z };
      const pFloor = support(map, p, floorY + C.step);
      assert.ok(
        fits(map, { x: p.x, y: pFloor, z: p.z }, C.standing),
        `Doorway ${lintel.id} blocked at ${JSON.stringify(p)}`
      );
    }
  }

  // Short Stairs (y=1.8 -> 3.2) without jump
  const endShort = traverseRoute(
    map,
    "Short Stairs no-jump",
    [wp(10.5, 13.0, { y: 1.8 }), wp(11.0, 22.5, { y: 3.2 })],
    false
  );
  assert.ok(endShort.y >= 3.15, `Short Stairs should reach 3.2m, got ${endShort.y}`);

  // Tunnel Stairs (y=0.0 -> 2.4) uphill without jump
  const endTunnel = traverseRoute(
    map,
    "Tunnel Stairs uphill no-jump",
    [wp(-15.0, 7.0, { y: 0 }), wp(-27.0, 7.0, { y: 2.4 })],
    false
  );
  assert.ok(endTunnel.y >= 2.35, `Tunnel Stairs should reach 2.4m, got ${endTunnel.y}`);

  // B Plat Steps (y=2.4 -> 3.2) without jump (both South & East staircases)
  const endBPlatS = traverseRoute(
    map,
    "B Plat South stairs no-jump",
    [wp(-42.5, 37.8, { y: 2.4 }), wp(-42.5, 42.0, { y: 3.2 })],
    false
  );
  assert.ok(endBPlatS.y >= 3.15);
  const endBPlatE = traverseRoute(
    map,
    "B Plat East stairs no-jump",
    [wp(-34.2, 43.2, { y: 2.4 }), wp(-38.5, 43.2, { y: 3.2 })],
    false
  );
  assert.ok(endBPlatE.y >= 3.15);
});

// -----------------------------------------------------------------------------
// 5. BOMB PLANTING, DEFUSING, SERVER INTEGRATION & ZERO SUPPLY CRATES
// -----------------------------------------------------------------------------
test("Dust II V2: Bomb plant boundaries strictly scoped to A & B sites; rejects corridors and adjacent zones", () => {
  assert.ok(BOMB_MAPS.some((m) => m.id === "dust2v2"), "Dust II V2 must be registered in BOMB_MAPS");
  for (const site of DUST2_V2_SITES) {
    assert.ok(fits(map, { x: site.x, y: site.y, z: site.z }, C.standing));
    const match = createBombMatch(
      [
        { id: "t", team: "T", position: { x: site.x, y: site.y, z: site.z } },
        { id: "ct", team: "CT", position: { x: 14, y: 0, z: 31 } },
      ],
      0,
      false,
      map.bombSites
    );
    stepBomb(match, 15);
    assert.equal(bombInteract(match, "t", true, 16), true, `Must accept plant at site ${site.id}`);
    match.players.t.holdUntil = 20;
    stepBomb(match, 19.25);
    assert.equal(match.phase, "planted");
    assert.equal(match.site, site.id);
  }

  // Must REJECT planting outside site boundaries
  const illegalPositions: [string, Vec3][] = [
    ["A Long", { x: 44, y: 1.6, z: 10 }],
    ["A Ramp", { x: 46, y: 2.2, z: 36 }],
    ["A Short", { x: 24, y: 3.2, z: 32 }],
    ["Under A", { x: 20, y: 0, z: 25 }],
    ["CT Spawn", { x: 14, y: 0, z: 31 }],
    ["B Tunnels", { x: -42, y: 2.4, z: 22 }],
    ["B Doors", { x: -26, y: 2.4, z: 31.5 }],
    ["B Window", { x: -24, y: 2.4, z: 38.7 }],
    ["Mid", { x: 0, y: 0, z: 6 }],
  ];
  for (const [label, pos] of illegalPositions) {
    const match = createBombMatch(
      [
        { id: "t", team: "T", position: { ...pos } },
        { id: "ct", team: "CT", position: { x: 14, y: 0, z: 31 } },
      ],
      0,
      false,
      map.bombSites
    );
    stepBomb(match, 15);
    assert.equal(
      bombInteract(match, "t", true, 16),
      false,
      `Must REJECT bomb plant outside site at ${label}`
    );
  }
});

test("Dust II V2: Server Bomb room lifecycle works cleanly and never spawns Kill Race supply crates or airdrops", () => {
  assert.deepEqual(supplyLocations(map), []);
  const world = createWorld(map, 42);
  assert.equal(world.pickups.length, 0);
  advanceWorld(world, map, DROP_INTERVAL * 3);
  assert.equal(world.pickups.length, 0);
  assert.equal(world.drop, undefined);
  const training = createTraining("dust2v2");
  assert.equal(claimSupply(world, map, training.player, 1), false);

  const io: any = { to: () => ({ emit() {} }), emit() {} };
  const server = new KapsStrikeServerManager(io);
  // Bomb room selects dust2v2 cleanly
  const room = server.createRoom({ id: 101, username: "terrorist", avatar: null }, "t-1", {
    mode: "bomb",
    map: "dust2v2",
  });
  assert.equal(room.map, "dust2v2");
  server.joinRoom(room.roomCode, { id: 102, username: "counter", avatar: null }, "ct-1");
  server.setReady("ct-1", true);
  assert.equal(server.startGame("t-1").success, true);
  server.stopRoomSimulationLoop(room);
  assert.ok(room.bomb);
  assert.equal(room.bomb!.sites?.length, 2);
  assert.equal(room.bomb!.sites![0].x, DUST2_V2_SITES[0].x);
  assert.equal(room.getSnapshotForPlayer("t-1").world!.pickups.length, 0);
  server.tickSimulation(room);
  assert.equal(room.world.pickups.length, 0);

  // Kill Race rejects bomb-only dust2v2 (falls back to warehouse)
  const ffaRoom = server.createRoom({ id: 103, username: "runner", avatar: null }, "ffa-1", {
    mode: "ffa",
    map: "dust2v2",
  });
  assert.notEqual(ffaRoom.map, "dust2v2");
  server.leaveRoom("t-1", 101);
  server.leaveRoom("ct-1", 102);
  server.leaveRoom("ffa-1", 103);
});

// -----------------------------------------------------------------------------
// 6. PERIMETER SEAL, ZERO B-SITE PITS, ZERO TUNNEL GAPS & ZERO SKYLINE OVERLAP
// -----------------------------------------------------------------------------
test("Dust II V2: sealed perimeter prevents sprint-jump map escape; zero B-Site holes; zero tunnel gaps; zero skyline intrusion", () => {
  // 1. Perimeter escape test: sprint + jump into facade walls from inside playable blocks
  const rects = Object.values(DUST2_V2_BLOCKS);
  const insideFootprint = (x: number, z: number, pad = 0.01) =>
    rects.some(([l, r, b, t]) => x >= l - pad && x <= r + pad && z >= b - pad && z <= t + pad);

  const perimeterProbes: [Vec3, number][] = [
    [{ x: 0, y: 2.8, z: -50.8 }, Math.PI],          // T Spawn South wall
    [{ x: -40.8, y: 2.8, z: -42 }, -Math.PI / 2],   // T Plat West wall
    [{ x: 50.8, y: 1.6, z: 6 }, Math.PI / 2],       // A Long East wall
    [{ x: 50.8, y: 1.6, z: -30 }, Math.PI / 2],     // Pit Plat East wall
    [{ x: 35.5, y: 3.2, z: 46.8 }, 0],              // A Site North wall
    [{ x: -35.2, y: 2.4, z: 46.8 }, 0],             // B Site North wall
    [{ x: -46.8, y: 2.4, z: 36 }, -Math.PI / 2],    // B Site West wall
    [{ x: -44.8, y: 2.4, z: 20 }, -Math.PI / 2],    // B Tunnels West wall
    [{ x: 14, y: 0, z: 32.8 }, 0],                  // CT Spawn North wall
  ];
  for (const [start, yaw] of perimeterProbes) {
    const m = newMovement({ ...start });
    for (let tick = 1; tick <= 240; tick++) {
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
        tick
      );
      assert.ok(
        insideFootprint(m.position.x, m.position.z, 0.35),
        `Player escaped perimeter near ${JSON.stringify(start)} -> ${JSON.stringify(m.position)}`
      );
    }
  }

  // 2. Dense B Site floor scan: zero edge pits or holes anywhere in [-47.5, -26.5] x [28.5, 47.5]
  for (let x = -47.5; x <= -26.5; x += 1.0) {
    for (let z = 28.5; z <= 47.5; z += 1.0) {
      const y = support(map, { x, y: 0, z }, 4.5);
      assert.ok(y >= 2.38, `B Site hole/pit detected at (${x}, ${z}): floor y=${y}`);
    }
  }

  // 3. Tunnel enclosure & floor continuity check (Upper Tunnels, Tunnel Stairs, Lower Tunnels, B Tunnels)
  // Upper Tunnels floor
  for (let x = -45.5; x <= -26.5; x += 2) {
    for (let z = -9.5; z <= 11.5; z += 2) {
      const y = support(map, { x, y: 0, z }, 3.0);
      assert.ok(Math.abs(y - 2.4) < 0.08, `Upper Tunnels floor gap at (${x},${z}): y=${y}`);
    }
  }
  // Upper Tunnels intentional 2017 sunlit broken-roof opening vs surrounding solid roof
  assert.equal(
    hasLineOfSight(map, { x: -36, y: 4.5, z: 0 }, { x: -36, y: 12, z: 0 }),
    true,
    "Upper Tunnels 2017 broken-roof skylight should open to the sky"
  );
  assert.equal(
    hasLineOfSight(map, { x: -43, y: 4.5, z: 0 }, { x: -43, y: 12, z: 0 }),
    false,
    "Upper Tunnels perimeter roof must remain covered"
  );
  // B Tunnels & Lower Tunnels must be completely roofed overhead
  for (const [tx, ty, tz] of [
    [-42, 4.0, 16],
    [-42, 4.0, 22],
    [-21, 3.0, 7],
    [-11, 1.5, 7],
  ]) {
    assert.equal(
      hasLineOfSight(map, { x: tx, y: ty, z: tz }, { x: tx, y: 12, z: tz }),
      false,
      `Tunnel ceiling leak above (${tx},${ty},${tz})`
    );
  }

  // 4. Exterior skyline masses must NEVER clip into any playable block interior
  const skylineMasses = map.solids.filter((s) => s.id.includes("skyline-mass"));
  assert.ok(skylineMasses.length >= 6);
  for (const s of skylineMasses) {
    const sMinX = s.x - s.w / 2;
    const sMaxX = s.x + s.w / 2;
    const sMinZ = s.z - s.d / 2;
    const sMaxZ = s.z + s.d / 2;
    for (const [blockName, [bw, be, bs, bn]] of Object.entries(DUST2_V2_BLOCKS)) {
      const overlapX = Math.min(sMaxX, be) - Math.max(sMinX, bw);
      const overlapZ = Math.min(sMaxZ, bn) - Math.max(sMinZ, bs);
      assert.ok(
        !(overlapX > 0.05 && overlapZ > 0.05),
        `Skyline block ${s.id} overlaps playable area "${blockName}" by ${overlapX.toFixed(2)}x${overlapZ.toFixed(2)}m`
      );
    }
  }
});

// -----------------------------------------------------------------------------
// 7. BULLET RAYCAST VS CAPSULE PHYSICS CONSISTENCY & BABYLON RENDERER TIERS
// -----------------------------------------------------------------------------
test("Dust II V2: bullet raySolid() matches capsule support() across major ramps and renders in Babylon NullEngine", async () => {
  // Check vertical downward ray against support() on key ramps
  const rampPoints: [string, number, number][] = [
    ["A Ramp mid", 46, 36],
    ["B Doors Ramp mid", -22, 31.3],
    ["Pit Main Ramp mid", 45.1, -23.25],
    ["Mid Main Slope mid", 1, -4],
    ["CT Ramp mid", 31, 27],
    ["Suicide Slope mid", 0, -32],
    ["B Window Scaffold Ramp mid", -17.5, 38.9],
  ];
  for (const [label, x, z] of rampPoints) {
    const floorY = support(map, { x, y: 0, z }, 5.0);
    const origin = { x, y: 6.0, z };
    const dir = { x: 0, y: -1, z: 0 };
    let best = Infinity;
    for (const s of map.solids) {
      if (s.detail || s.hidden) continue;
      const d = raySolid(origin, dir, s, 8.0);
      if (d < best) best = d;
    }
    const rayY = origin.y - best;
    assert.ok(
      Math.abs(rayY - floorY) < 0.06,
      `${label}: raySolid Y (${rayY.toFixed(3)}) diverged from support() Y (${floorY.toFixed(3)})`
    );
  }

  // Verify Babylon NullEngine scene creation & rendering across low / medium / high
  const { NullEngine } = await import("@babylonjs/core/Engines/nullEngine");
  const { StrikeRenderer } = await import("../src/games/kapsstrike/renderer");
  const { DEFAULT_SETTINGS } = await import("../src/games/kapsstrike/config");
  const state = createTraining("dust2v2");

  for (const quality of ["low", "medium", "high"] as const) {
    const engine = new NullEngine();
    const renderer = new StrikeRenderer(
      {} as HTMLCanvasElement,
      map,
      { ...DEFAULT_SETTINGS, quality },
      engine
    );
    try {
      renderer.render(state, 0, 0, false, 1, state.player.movement.position, 1 / 60);
      assert.ok(
        renderer.scene.meshes.length > 100,
        `Dust II V2 (${quality}) must build a complete scene, got ${renderer.scene.meshes.length} meshes`
      );
    } finally {
      renderer.dispose();
    }
  }
});
