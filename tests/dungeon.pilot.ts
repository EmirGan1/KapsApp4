import { Run, Intent, Point } from "../src/games/dungeon/types";
import { applyIntent, alive } from "../src/games/dungeon/engine";
import {
  path,
  distance,
  line,
  walkable,
} from "../src/games/dungeon/generation";
import { CLASSES } from "../src/games/dungeon/definitions";
export function pilot(r: Run, id: number): Partial<Intent>[] {
  const p = r.players.find((a) => a.id === id)!;
  if (!alive(p)) return [];
  const commands: Partial<Intent>[] = [];
  const enemy = r.enemies
    .filter((e) => e.hp > 0)
    .sort((a, b) => distance(a, p) - distance(b, p))[0];
  const ally = r.players
    .filter((a) => a.connected && alive(a))
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (p.hp < p.maxHp * 0.45 && p.potions) commands.push({ action: "potion" });
  if (p.hero === "healer" && ally && ally.hp < ally.maxHp * 0.7)
    commands.push({
      action: "cast",
      slot: 1,
      x: ally.x,
      y: ally.y,
      target: ally.id,
    });
  if (enemy) {
    const d = distance(p, enemy),
      s = (slot: number, target: Point = enemy) => {
        if (
          p.cooldowns[slot] <= r.tick &&
          p.mana >= CLASSES[p.hero].skills[slot].cost
        )
          commands.push({
            action: "cast",
            slot,
            x: target.x,
            y: target.y,
            target: ally?.id,
          });
      };
    if (p.hero === "warrior") {
      if (d < 2) s(1);
      if (p.hp < p.maxHp * 0.6) s(2, p);
      if (d < 4 && p.hp < p.maxHp * 0.75) s(4, p);
    }
    if (p.hero === "mage") {
      if (d < 3) s(1, p);
      if (d < 7) {
        s(2);
        s(4);
      }
    }
    if (p.hero === "healer" && p.hp < p.maxHp * 0.6) {
      s(2, p);
      s(4, p);
    }
    if (d <= CLASSES[p.hero].range && line(r.floor, p, enemy)) s(0);
  }
  const danger = (a: Point) =>
    r.zones
      .filter(
        (z) => z.owner === "enemy" && z.kind !== "ice" && z.until > r.tick,
      )
      .some((z) => distance(a, z) <= z.radius + 0.2);
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
    .filter(
      (a) =>
        walkable(r.floor, a.x, a.y) &&
        !r.enemies.some((e) => e.hp > 0 && distance(a, e) < 0.5),
    );
  let destination: Point | undefined;
  if (danger(p)) {
    destination = neighbors.sort(
      (a, b) =>
        Number(danger(a)) - Number(danger(b)) ||
        r.zones.reduce((n, z) => n + distance(b, z) - distance(a, z), 0),
    )[0];
  } else if (enemy) {
    if (distance(p, enemy) > CLASSES[p.hero].range || !line(r.floor, p, enemy))
      destination = path(
        r.floor,
        p,
        enemy,
        new Set(
          r.enemies
            .filter((e) => e !== enemy && e.hp > 0)
            .map((e) => e.y * r.floor.width + e.x),
        ),
      )[0];
    else if (p.hero !== "warrior" && distance(p, enemy) < 3)
      destination = neighbors
        .filter((a) => !danger(a))
        .sort((a, b) => distance(b, enemy) - distance(a, enemy))[0];
  } else {
    const down = r.players.find((a) => a.hp === 0 && !a.dead && a.connected);
    if (down) {
      if (distance(p, down) <= 1.5) {
        commands.push({ action: "interact" });
        return commands;
      }
      destination = path(r.floor, p, down)[0];
    } else {
      const c = r.floor.rooms.find((c) => !c.cleared && !c.optional);
      let goal: Point;
      if (c) {
        goal = { x: c.x + Math.floor(c.w / 2), y: c.y + Math.floor(c.h / 2) };
        if (c.kind === "puzzle" && distance(p, goal) <= 1.5)
          commands.push({ action: "interact" });
      } else {
        goal = r.floor.exit;
        if (distance(p, goal) <= 1.5) commands.push({ action: "interact" });
      }
      if (distance(p, goal) > 0.5) destination = path(r.floor, p, goal)[0];
    }
  }
  if (destination && r.tick >= p.moveAt && !danger(destination))
    commands.push({
      action: "move",
      dx: destination.x - p.x,
      dy: destination.y - p.y,
    });
  return commands;
}
export function drive(r: Run) {
  for (const p of r.players)
    for (const d of pilot(r, p.id))
      applyIntent(r, p.id, { ...d, seq: p.seq + 1, floor: r.depth } as Intent);
}
