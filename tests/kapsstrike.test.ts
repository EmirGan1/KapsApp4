import test from "node:test";
import assert from "node:assert/strict";
import {
  createTraining,
  simulate,
  takeDamage,
  shoot,
  eye,
} from "../src/games/kapsstrike/combat";
import { MAPS } from "../src/games/kapsstrike/maps";
import {
  PHYSICS as C,
  WEAPONS,
  WEAPON_ORDER,
  cleanSettings,
} from "../src/games/kapsstrike/config";
import {
  move,
  newMovement,
  fits,
  raySolid,
  rayBox,
} from "../src/games/kapsstrike/physics";
import {
  InputCommand,
  TrainingState,
  MapDefinition,
  MapId,
  WeaponId,
  Vec3,
} from "../src/games/kapsstrike/types";
const command = (
  s: TrainingState,
  patch: Partial<InputCommand> = {},
): InputCommand => ({
  sequence: s.lastSequence + 1,
  tick: s.tick,
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  pitch: 0,
  jump: false,
  sprint: false,
  crouch: false,
  fire: false,
  ads: false,
  reload: false,
  ...patch,
});
function empty(): MapDefinition {
  return { ...MAPS.warehouse, solids: [], bounds: 100 };
}
function advance(
  s: TrainingState,
  ticks: number,
  patch: Partial<InputCommand> = {},
) {
  for (let i = 0; i < ticks; i++)
    assert.equal(simulate(s, command(s, patch)), true);
}
for (const map of Object.values(MAPS))
  test(`${map.id}: valid, nonoverlapping spawns, targets, hazard and substantial geometry`, () => {
    assert.ok(map.solids.length > 15);
    for (const spawn of map.spawns) assert.ok(fits(map, spawn, C.standing));
    assert.ok(fits(map, { ...map.hazard, y: 0 }, C.standing));
    for (const t of map.targets)
      assert.ok(fits(map, t.position, C.standing), t.id);
    assert.equal(new Set(map.solids.map((s) => s.id)).size, map.solids.length);
  });
test("120Hz movement acceleration, diagonal normalization and hard speed cap", () => {
  for (const diagonal of [false, true]) {
    const m = newMovement({ x: 0, y: 0, z: 0 }),
      s = createTraining("warehouse");
    for (let t = 0; t < 1000; t++) {
      move(
        m,
        command(s, { moveZ: 1, moveX: diagonal ? 1 : 0, sprint: true }),
        empty(),
        t,
      );
      assert.ok(Math.hypot(m.velocity.x, m.velocity.z) <= C.maxSpeed + 1e-8);
    }
    assert.ok(Math.hypot(m.velocity.x, m.velocity.z) <= C.sprintSpeed + 0.1);
  }
});
test("jump requires fresh press; gravity returns to ground; slide loses momentum", () => {
  const s = createTraining("warehouse"),
    m = newMovement({ x: 0, y: 0, z: 0 });
  let max = 0;
  for (let t = 0; t < 300; t++) {
    move(m, command(s, { jump: true }), empty(), t);
    max = Math.max(max, m.position.y);
  }
  assert.ok(max > 1);
  assert.equal(m.position.y, 0);
  m.velocity.z = 10;
  move(m, command(s, { crouch: true }), empty(), 301);
  assert.equal(m.stance, "slide");
  for (let t = 302; t < 600; t++)
    move(m, command(s, { crouch: true }), empty(), t);
  assert.equal(m.stance, "crouch");
  assert.ok(Math.hypot(m.velocity.x, m.velocity.z) < 1);
});
test("walls, corners and boxes stop high-speed movement without tunneling", () => {
  const map = empty();
  map.solids = [
    {
      id: "wall",
      kind: "box",
      x: 0,
      y: 0,
      z: 3,
      w: 20,
      h: 4,
      d: 0.1,
      color: "",
    },
  ];
  const m = newMovement({ x: 0, y: 0, z: 0 }),
    s = createTraining("warehouse");
  for (let t = 0; t < 400; t++)
    move(m, command(s, { moveZ: 1, sprint: true }), map, t);
  assert.ok(m.position.z < 2.65);
  assert.ok(fits(map, m.position, m.height));
});
test("ramp and stairs ascend; low ceiling prevents standing", () => {
  const map = empty();
  map.solids = [
    {
      id: "ramp",
      kind: "ramp",
      x: 0,
      y: 0,
      z: 5,
      w: 4,
      h: 3,
      d: 10,
      axis: "z",
      color: "",
    },
    {
      id: "platform",
      kind: "box",
      x: 0,
      y: 0,
      z: 12,
      w: 4,
      h: 3,
      d: 4,
      color: "",
    },
  ];
  const m = newMovement({ x: 0, y: 0, z: -1 }),
    s = createTraining("warehouse");
  for (let t = 0; t < 220; t++) move(m, command(s, { moveZ: 1 }), map, t);
  assert.ok(m.position.y > 2.9);
  map.solids = [
    {
      id: "roof",
      kind: "box",
      x: 0,
      y: 1.3,
      z: 0,
      w: 5,
      h: 1,
      d: 5,
      color: "",
    },
  ];
  Object.assign(m, newMovement({ x: 0, y: 0, z: 0 }));
  move(m, command(s, {}), map, 221);
  assert.equal(m.stance, "crouch");
  assert.equal(m.height, C.crouching);
});
test("ramp ray tests the sloped wedge, not an imaginary full box", () => {
  const ramp: any = {
    id: "r",
    kind: "ramp",
    x: 0,
    y: 0,
    z: 0,
    w: 4,
    h: 4,
    d: 4,
    axis: "z",
    color: "",
  };
  assert.equal(
    raySolid({ x: -5, y: 3, z: -1.5 }, { x: 1, y: 0, z: 0 }, ramp, 20),
    Infinity,
  );
  assert.ok(
    Number.isFinite(
      raySolid({ x: -5, y: 3, z: 1.5 }, { x: 1, y: 0, z: 0 }, ramp, 20),
    ),
  );
  assert.equal(
    rayBox(
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: -1, y: 0, z: 3 },
      { x: 1, y: 3, z: 4 },
      10,
    ),
    3,
  );
});
for (const id of WEAPON_ORDER.filter(id => id !== "knife"))
  test(`${id}: ammo, RPM, reload lock, capacity, switching`, () => {
    const s = createTraining("warehouse");
    s.player.weapon.selected = id;
    advance(s, 120, { fire: true });
    const used = WEAPONS[id].capacity - s.player.weapon.ammo[id];
    assert.ok(used >= 1);
    assert.ok(used <= Math.ceil(WEAPONS[id].rpm / 60) + 1);
    if (!WEAPONS[id].automatic) assert.equal(used, 1);
    advance(s, 1, { reload: true });
    assert.ok(s.player.weapon.reloadUntil > s.tick);
    const ammo = s.player.weapon.ammo[id];
    advance(s, 60, { fire: true });
    assert.equal(s.player.weapon.ammo[id], ammo);
    advance(s, Math.ceil(WEAPONS[id].reload * 120) + 2);
    assert.equal(s.player.weapon.ammo[id], WEAPONS[id].capacity);
    advance(s, 1, { weapon: id === "pistol" ? "rifle" : "pistol", fire: true });
    assert.ok(s.player.weapon.switchUntil > s.tick);
  });
test("head/body hits are distinct, cover blocks damage, shotgun emits eight pellet rays", () => {
  for (const head of [false, true]) {
    const s = createTraining("warehouse");
    s.targets = [
      { id: "t", position: { x: 0, y: 0, z: -25 }, hp: 100, respawnAt: 0 },
    ];
    s.player.pitch = head ? 0 : 0.19;
    shoot(s, true);
    assert.ok(s.damage > 0);
    assert.equal(
      s.events.some((e) => e.kind === "hit" && e.head),
      head,
    );
  }
  const s = createTraining("warehouse");
  s.player.weapon.selected = "shotgun";
  shoot(s, false);
  assert.equal(s.events.filter((e) => e.kind === "shot").length, 8);
  s.player.weapon.ammo.shotgun = 0;
  s.tick = 100;
  assert.equal(shoot(s, false), false);
});
test("spawn protection, death, respawn, unique IDs, malformed/duplicate commands", () => {
  const s = createTraining("warehouse", "actor-17");
  takeDamage(s, 100, { x: 0, y: 0, z: 0 });
  assert.equal(s.player.hp, 100);
  advance(s, C.protectionTicks);
  takeDamage(s, 100, { x: 0, y: 0, z: 0 });
  assert.equal(s.player.hp, 0);
  advance(s, C.respawnTicks);
  assert.equal(s.player.hp, 100);
  assert.equal(s.player.id, "actor-17");
  assert.ok(s.player.protectedUntil > s.tick);
  const c = command(s);
  assert.ok(simulate(s, c));
  assert.equal(simulate(s, c), false);
  assert.equal(simulate(s, command(s, { yaw: NaN })), false);
  assert.equal(simulate(s, command(s, { tick: -1 })), false);
});
test("settings are finite and bounded", () => {
  const s = cleanSettings({
    scale: Infinity,
    fov: 999,
    volume: -3,
    sensitivity: NaN,
  });
  assert.equal(s.scale, 1);
  assert.equal(s.fov, 115);
  assert.equal(s.volume, 0);
  assert.equal(s.sensitivity, 1);
});
for (const id of ["warehouse", "dust", "neon"] as MapId[])
  for (let seed = 0; seed < 30; seed++)
    test(`${id} fuzz ${seed}: bounded legal state over 2400 fixed steps`, () => {
      const s = createTraining(id);
      for (let t = 0; t < 2400; t++) {
        simulate(
          s,
          command(s, {
            moveX: Math.sin((t + seed) / 43) > 0 ? 1 : -1,
            moveZ: Math.cos((t + seed) / 67) > 0 ? 1 : -1,
            yaw: Math.sin(t / 321),
            jump: t % 99 === 0,
            crouch: t % 130 < 20,
            sprint: true,
            fire: t % 2 === 0,
            reload: t % 503 === 0,
            weapon: WEAPON_ORDER[Math.floor(t / 300) % 5],
          }),
        );
        const m = s.player.movement;
        assert.ok(
          [m.position.x, m.position.y, m.position.z, s.player.hp].every(
            Number.isFinite,
          ),
        );
        assert.ok(Math.abs(m.position.x) <= MAPS[id].bounds);
        assert.ok(Math.abs(m.position.z) <= MAPS[id].bounds);
        assert.ok(Math.hypot(m.velocity.x, m.velocity.z) <= C.maxSpeed + 0.001);
        assert.ok(s.events.length <= 128);
      }
    });
test("step-up climbs a staircase with matching visual treads", () => {
  const map = empty();
  map.solids = Array.from({ length: 12 }, (_, i) => ({
    id: "step" + i,
    kind: "box" as const,
    x: 0,
    y: 0,
    z: i * 0.5,
    w: 4,
    h: (i + 1) * 0.25,
    d: 0.5,
    color: "",
  }));
  map.solids.push({
    id: "top",
    kind: "box",
    x: 0,
    y: 0,
    z: 8,
    w: 4,
    h: 3,
    d: 5,
    color: "",
  });
  const s = createTraining("warehouse"),
    m = newMovement({ x: 0, y: 0, z: -1 });
  for (let t = 0; t < 160; t++) move(m, command(s, { moveZ: 1 }), map, t);
  assert.ok(m.position.y >= 2.99, JSON.stringify(m.position));
  assert.ok(m.position.z > 5);
});
test("solid cover blocks hits; frame grouping preserves identical fixed-step results", () => {
  const s = createTraining("warehouse");
  s.player.movement.position = { x: 21, y: 0, z: -24 };
  s.targets = [
    { id: "covered", position: { x: 21, y: 0, z: -12 }, hp: 100, respawnAt: 0 },
  ];
  shoot(s, true);
  assert.equal(s.damage, 0);
  const run = (frames: number) => {
    const state = createTraining("warehouse");
    for (let f = 0; f < frames; f++)
      for (let t = 0; t < 120 / frames; t++)
        simulate(state, command(state, { moveZ: 1 }));
    return state.player.movement;
  };
  assert.deepEqual(run(30), run(60));
  assert.deepEqual(run(60), run(120));
});
for (const map of Object.values(MAPS))
  for (const ramp of map.solids.filter((s) => s.kind === "ramp"))
    test(`${map.id}/${ramp.id}: authored ramp is traversable from its low end`, () => {
      const pos = { x: ramp.x, y: ramp.y, z: ramp.z };
      if (ramp.axis === "x") pos.x -= ramp.w / 2 + 0.7;
      else pos.z -= ramp.d / 2 + 0.7;
      const m = newMovement(pos),
        s = createTraining(map.id);
      let highest = pos.y;
      for (
        let t = 0;
        t < Math.ceil((((ramp.axis === "x" ? ramp.w : ramp.d) + 1) / 5) * 120);
        t++
      ) {
        move(
          m,
          command(s, {
            moveX: ramp.axis === "x" ? 1 : 0,
            moveZ: ramp.axis === "z" ? 1 : 0,
          }),
          map,
          t,
        );
        highest = Math.max(highest, m.position.y);
      }
      assert.ok(
        highest >= ramp.y + ramp.h - 0.2,
        JSON.stringify({ highest, ramp }),
      );
    });
test("shotgun spread produces distinct deterministic pellet directions", () => {
  const a = createTraining("warehouse"),
    b = createTraining("warehouse");
  for (const s of [a, b]) {
    s.player.weapon.selected = "shotgun";
    shoot(s, false);
  }
  assert.deepEqual(a.events, b.events);
  const ends = a.events
    .filter((e) => e.kind === "shot")
    .map((e) => JSON.stringify(e.to));
  assert.equal(new Set(ends).size, 8);
});
test("moving training targets stay outside solid map geometry", () => {
  for (const map of Object.values(MAPS)) {
    const s = createTraining(map.id);
    for (let i = 0; i < 2000; i++) {
      simulate(s, command(s));
      for (const t of s.targets)
        assert.ok(fits(map, t.position, 1.86), `${map.id}/${t.id}`);
    }
  }
});
test("slide momentum decays even while forward and sprint remain held", () => {
  const m = newMovement({ x: 0, y: 0, z: 0 }),
    s = createTraining("warehouse");
  m.velocity.z = 10;
  for (let t = 0; t < 30; t++)
    move(m, command(s, { moveZ: 1, sprint: true, crouch: true }), empty(), t);
  assert.equal(m.stance, "slide");
  assert.ok(
    Math.hypot(m.velocity.x, m.velocity.z) < 8,
    "Holding forward must not refill slide momentum",
  );
});
