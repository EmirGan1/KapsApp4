import test from "node:test";
import assert from "node:assert/strict";
import { createRun, makeHero, step } from "../src/games/dungeon/engine";
import { HeroClass, Difficulty } from "../src/games/dungeon/types";
import { drive } from "./dungeon.pilot";
const classes: HeroClass[] = ["warrior", "mage", "healer"];
const teams: HeroClass[][] = [];
for (let size = 2; size <= 4; size++) {
  const add = (team: HeroClass[], start: number) => {
    if (team.length === size) {
      teams.push(team);
      return;
    }
    for (let i = start; i < 3; i++) add([...team, classes[i]], i);
  };
  add([], 0);
}
for (const team of teams)
  test(`complete expedition all classes ${team.join("+")}`, () => {
    const r = createRun(
      "expedition",
      42,
      "explorer",
      team.map((c, i) => makeHero(i + 1, "P" + i, c)),
    );
    for (let i = 0; i < 12000 && r.status === "playing"; i++) {
      drive(r);
      step(r);
    }
    assert.equal(
      r.status,
      "won",
      JSON.stringify({ team, depth: r.depth, tick: r.tick, status: r.status }),
    );
    assert.equal(r.depth, 3);
    assert.ok(r.kills > 0);
  });
for (const difficulty of [
  "explorer",
  "adventurer",
  "nightmare",
] as Difficulty[])
  for (let seed = 0; seed < 10; seed++)
    test(`varied expedition ${difficulty} seed ${seed} reaches terminal state`, () => {
      const r = createRun(
        "varied",
        seed,
        difficulty,
        ["warrior", "mage", "healer"].map((c, i) =>
          makeHero(i + 1, "P" + i, c as HeroClass),
        ),
      );
      for (let i = 0; i < 18000 && r.status === "playing"; i++) {
        drive(r);
        step(r);
      }
      assert.notEqual(
        r.status,
        "playing",
        JSON.stringify({
          seed,
          difficulty,
          depth: r.depth,
          rooms: r.floor.rooms.filter((c) => c.cleared).length,
          players: r.players.map((p) => [p.x, p.y]),
          enemies: r.enemies.map((e) => [e.kind, e.x, e.y]),
        }),
      );
    });
