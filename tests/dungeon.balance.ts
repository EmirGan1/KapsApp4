import { createRun, makeHero, step } from "../src/games/dungeon/engine";
import { HeroClass } from "../src/games/dungeon/types";
import { drive } from "./dungeon.pilot";
const teams: HeroClass[][] = [
  ["warrior", "warrior"],
  ["mage", "mage"],
  ["healer", "healer"],
  ["warrior", "mage"],
  ["warrior", "healer"],
  ["mage", "healer"],
  ["warrior", "mage", "healer"],
  ["warrior", "mage", "healer", "mage"],
  ["warrior", "warrior", "warrior", "warrior"],
  ["mage", "mage", "mage", "mage"],
  ["healer", "healer", "healer", "healer"],
];
for (const team of teams) {
  const r = createRun(
    "balance",
    42,
    "explorer",
    team.map((c, i) => makeHero(i + 1, "P" + i, c)),
  );
  for (let i = 0; i < 25000 && r.status === "playing"; i++) {
    drive(r);
    step(r);
  }
  console.log(
    JSON.stringify({
      team,
      status: r.status,
      ticks: r.tick,
      depth: r.depth,
      room: r.floor.rooms.filter((c) => c.cleared).length,
      kills: r.kills,
      players: r.players.map((p) => ({
        hp: p.hp,
        mana: p.mana,
        pos: [p.x, p.y],
        downs: p.downs,
      })),
      enemies: r.enemies
        .map((e) => ({ kind: e.kind, hp: e.hp, pos: [e.x, e.y] }))
        .slice(0, 3),
    }),
  );
}
