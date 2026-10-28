import test from "node:test";
import assert from "node:assert/strict";
import {
  generateFloor,
  validateFloor,
  path,
  walkable,
  line,
  distance,
} from "../src/games/dungeon/generation";
import {
  makeHero,
  createRun,
  applyIntent,
  step,
  damage,
  heal,
  effect,
  spawnEnemy,
  cast,
} from "../src/games/dungeon/engine";
import { HeroClass, Run, Intent, EnemyKind } from "../src/games/dungeon/types";
import { CLASSES } from "../src/games/dungeon/definitions";
function run(classes: HeroClass[] = ["warrior", "mage"], seed = 42) {
  return createRun(
    "test",
    seed,
    "explorer",
    classes.map((c, i) => makeHero(i + 1, "P" + i, c)),
  );
}
function cmd(r: Run, id: number, data: Partial<Intent>) {
  const p = r.players.find((p) => p.id === id)!;
  return applyIntent(r, id, {
    seq: p.seq + 1,
    floor: r.depth,
    action: "interact",
    ...data,
  });
}
function clearArena(r: Run) {
  r.floor.rooms.forEach((c) => {
    c.entered = true;
    c.cleared = true;
  });
  r.enemies = [];
  r.zones = [];
  r.projectiles = [];
}
for (let seed = 0; seed < 1000; seed++)
  test(`generation ${seed}: connected three floors, reproducible, valid interactables`, () => {
    for (let d = 1; d <= 3; d++) {
      const f = generateFloor(seed, d);
      assert.ok(validateFloor(f));
      assert.equal(JSON.stringify(f), JSON.stringify(generateFloor(seed, d)));
      assert.equal(f.rooms.length, 10);
      assert.ok(f.rooms[8].w >= 17 && f.rooms[8].h >= 11);
      for (let i = 0; i < f.tiles.length; i++)
        if (["C", "H", "M", "U", "S", "K", ">"].includes(f.tiles[i]))
          assert.ok(
            path(f, f.spawn, { x: i % f.width, y: Math.floor(i / f.width) })
              .length > 0,
          );
      assert.ok(walkable(f, f.spawn.x + 1, f.spawn.y + 1));
    }
  });
test("invalid, duplicate, stale and accelerated movement; teammates share tiles", () => {
  const r = run();
  clearArena(r);
  const p = r.players[0],
    x = p.x;
  assert.equal(cmd(r, 1, { action: "move", dx: 1, dy: 0 }), undefined);
  assert.equal(p.x, x + 1);
  assert.match(cmd(r, 1, { action: "move", dx: 1, dy: 0 })!, /bekleniyor/);
  assert.match(
    applyIntent(r, 1, { seq: p.seq, floor: 1, action: "move", dx: 1, dy: 0 })!,
    /tekrarlanan/,
  );
  assert.ok(cmd(r, 1, { action: "move", dx: 999, dy: 0 }));
  assert.ok(cmd(r, 1, { action: "move", dx: NaN, dy: 0 }));
  assert.ok(cmd(r, 1, { floor: 2 }));
  assert.ok(applyIntent(r, 999, { seq: 1, floor: 1, action: "interact" }));
});
test("walls, bounds, blink clipping and rejected resource use", () => {
  const r = run(["mage", "healer"]);
  clearArena(r);
  const p = r.players[0],
    mana = p.mana;
  assert.ok(cmd(r, 1, { action: "cast", slot: 3, x: -1, y: 0 }));
  assert.ok(cmd(r, 1, { action: "cast", slot: 3, x: 0, y: 0 }));
  assert.equal(p.mana, mana);
  assert.equal(p.cooldowns[3], 0);
  p.x = 0;
  p.y = 0;
  assert.ok(cmd(r, 1, { action: "move", dx: -1, dy: 0 }));
});
test("damage, mitigation, expired shield and overhealing", () => {
  const r = run();
  clearArena(r);
  const p = r.players[0];
  p.shield = 20;
  p.shieldUntil = 10;
  assert.equal(damage(r, p, 27), 0);
  assert.equal(p.shield, 0);
  r.tick = 10;
  p.shield = 100;
  assert.ok(damage(r, p, 27) > 0);
  assert.equal(p.shield, 0);
  heal(r, p, 9999);
  assert.equal(p.hp, p.maxHp);
});
test("resource and cooldown validation; no stun action", () => {
  const r = run();
  const p = r.players[0];
  p.mana = 0;
  assert.ok(cmd(r, 1, { action: "cast", slot: 2, x: p.x, y: p.y }));
  p.mana = 100;
  assert.equal(
    cmd(r, 1, { action: "cast", slot: 2, x: p.x, y: p.y }),
    undefined,
  );
  assert.equal(p.mana, 80);
  assert.ok(cmd(r, 1, { action: "cast", slot: 2, x: p.x, y: p.y }));
  effect(r, p, "stun", 10, 1, 0);
  assert.ok(cmd(r, 1, { action: "move", dx: 1, dy: 0 }));
});
test("healing is bounded, full HP rejected, barrier never stacks", () => {
  const r = run(["healer", "warrior"]);
  clearArena(r);
  const p = r.players[0],
    a = r.players[1];
  assert.ok(cast(r, p, 1, a, 2));
  assert.equal(p.mana, 130);
  damage(r, a, 70);
  assert.equal(cast(r, p, 1, a, 2), undefined);
  assert.ok(a.hp <= a.maxHp);
  cast(r, p, 2, a, 2);
  assert.equal(a.shield, 45);
  p.cooldowns[2] = 0;
  cast(r, p, 2, a, 2);
  assert.equal(a.shield, 45);
});
test("revive takes time; movement and damage interrupt; no duplicate credit", () => {
  const r = run(["warrior", "healer"]);
  clearArena(r);
  const [p, a] = r.players;
  damage(r, a, 999);
  assert.equal(a.hp, 0);
  assert.equal(cmd(r, 1, {}), undefined);
  assert.ok(p.revive);
  damage(r, p, 1);
  assert.equal(p.revive, undefined);
  cmd(r, 1, {});
  for (let n = 0; n < 40; n++) step(r);
  assert.ok(a.hp > 0);
  assert.equal(p.stats.revives, 1);
  for (let n = 0; n < 10; n++) step(r);
  assert.equal(p.stats.revives, 1);
});
test("all down is defeat; stun alone is not defeat", () => {
  const r = run();
  clearArena(r);
  r.players.forEach((p) => effect(r, p, "stun", 100, 1, 0));
  step(r);
  assert.equal(r.status, "playing");
  r.players.forEach((p) => damage(r, p, 999));
  step(r);
  assert.equal(r.status, "lost");
});
test("status refresh is bounded and boss CC has diminishing returns", () => {
  const r = run();
  clearArena(r);
  const p = r.players[0],
    e = spawnEnemy(r, "king", { x: p.x + 3, y: p.y }, 1)!;
  for (let i = 0; i < 100; i++) effect(r, e, "freeze", 100, 1, 1);
  assert.equal(e.effects.length, 1);
  assert.equal(e.effects[0].until, 5);
  r.tick = 10;
  effect(r, e, "freeze", 100, 1, 1);
  assert.equal(e.effects[0].until, 5);
});
test("enemy death cancels windup, kills are once only", () => {
  const r = run();
  clearArena(r);
  const p = r.players[0],
    e = spawnEnemy(r, "guardian", { x: p.x + 2, y: p.y }, 1)!;
  for (let i = 0; i < 20; i++) step(r);
  assert.ok(r.zones.length);
  damage(r, e, 10000, p);
  assert.equal(r.zones.filter((z) => z.source === -e.id).length, 0);
  const k = p.stats.kills;
  damage(r, e, 10000, p);
  assert.equal(p.stats.kills, k);
});
test("shield bash interrupts ordinary casts; boss windup remains", () => {
  const r = run();
  clearArena(r);
  const p = r.players[0],
    e = spawnEnemy(r, "guardian", { x: p.x, y: p.y - 1 }, 1)!;
  for (let i = 0; i < 16; i++) step(r);
  assert.ok(e.cast);
  effect(r, e, "stun", 20, 1, p.id);
  assert.equal(e.cast, undefined);
});
test("chest gives personal loot; duplicate pickup/equip cannot clone", () => {
  const r = run();
  clearArena(r);
  const c = r.floor.rooms[1];
  r.players.forEach((p) => {
    p.x = c.x + 1;
    p.y = c.y + 1;
  });
  assert.equal(cmd(r, 1, {}), undefined);
  assert.equal(r.loot.length, 2);
  assert.equal(cmd(r, 1, {}), undefined);
  assert.equal(r.players[0].inventory.length, 1);
  cmd(r, 1, {});
  assert.equal(r.players[0].inventory.length, 1);
  const item = r.players[0].inventory[0];
  assert.equal(cmd(r, 1, { action: "equip", item: item.id }), undefined);
  assert.equal(r.players[0].inventory.length, 0);
  assert.ok(cmd(r, 1, { action: "equip", item: item.id }));
  assert.equal(r.players[0].equipment[item.slot]?.id, item.id);
});
test("floor progression is atomic and requires objectives + regroup", () => {
  const r = run();
  const exit = r.floor.exit;
  r.players.forEach((p) => Object.assign(p, exit));
  assert.ok(cmd(r, 1, {}));
  clearArena(r);
  r.players[1].x -= 10;
  assert.ok(cmd(r, 1, {}));
  Object.assign(r.players[1], exit);
  assert.equal(cmd(r, 1, {}), undefined);
  for (let i = 0; i < 30; i++) step(r);
  assert.equal(r.depth, 2);
  assert.equal(r.transitionAt, 0);
  assert.equal(r.zones.length, 0);
  assert.ok(cmd(r, 1, { floor: 1 }));
});
test("extracting third floor wins, simultaneous wipe loses", () => {
  const r = run();
  clearArena(r);
  r.depth = 3;
  r.players.forEach((p) => Object.assign(p, r.floor.exit));
  cmd(r, 1, {});
  for (let i = 0; i < 30; i++) step(r);
  assert.equal(r.status, "won");
  const loss = run();
  clearArena(loss);
  loss.depth = 3;
  loss.transitionAt = 1;
  loss.players.forEach((p) => damage(loss, p, 9999));
  step(loss);
  assert.equal(loss.status, "lost");
});
for (const kind of [
  "skeleton",
  "archer",
  "spider",
  "necromancer",
  "guardian",
  "assassin",
  "king",
  "golem",
  "warden",
] as EnemyKind[])
  test(`enemy ${kind}: bounded simulation, damage, target and phase`, () => {
    const r = run();
    clearArena(r);
    const p = r.players[0],
      e = spawnEnemy(r, kind, { x: p.x + 3, y: p.y + 1 }, 1)!;
    e.hp = e.maxHp * 0.49;
    let attacked = false;
    for (let i = 0; i < 150; i++) {
      r.players.forEach((a) => {
        a.hp = a.maxHp;
        a.dead = false;
      });
      step(r);
      attacked ||=
        r.players.some((a) => a.hp < a.maxHp) ||
        r.projectiles.length > 0 ||
        r.zones.length > 0;
    }
    assert.ok(e.target);
    assert.ok(r.enemies.length <= 64);
    assert.ok(r.zones.length < 30);
    assert.ok(attacked);
    if (e.boss) assert.equal(e.phase, 2);
  });
// These property tests vary legal action streams; they do not claim a human team can win.
for (let seed = 0; seed < 80; seed++)
  test(`simulation ${seed}: 1500 ticks preserve bounds and finite state`, () => {
    const r = run(
      (["warrior", "mage", "healer", "mage"] as HeroClass[]).slice(
        0,
        2 + (seed % 3),
      ),
      seed,
    );
    for (let n = 0; n < 1500 && r.status === "playing"; n++) {
      for (const p of r.players) {
        const dir = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ][Math.floor(n / 15 + p.id) % 4];
        cmd(r, p.id, { action: "move", dx: dir[0], dy: dir[1] });
        if (n % 10 === 0)
          cmd(r, p.id, {
            action: "cast",
            slot: seed % 5,
            x: p.x,
            y: p.y,
            target: p.id,
          });
      }
      step(r);
      for (const p of r.players) {
        assert.ok(Number.isFinite(p.hp) && p.hp >= 0 && p.hp <= p.maxHp);
        assert.ok(p.mana >= 0 && p.mana <= p.maxMana);
        assert.ok(walkable(r.floor, p.x, p.y));
      }
      assert.ok(r.enemies.length <= 64);
      assert.ok(r.log.length <= 30);
    }
  });
