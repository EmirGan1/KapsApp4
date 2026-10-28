import { Floor, Point, Tile, Chamber } from "./types";
import { THEMES } from "./definitions";
export function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function tile(f: Floor, x: number, y: number): Tile {
  return Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < f.width &&
    y < f.height
    ? f.tiles[y * f.width + x]
    : "#";
}
export function walkable(f: Floor, x: number, y: number) {
  return !["#", "D"].includes(tile(f, x, y));
}
export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
export function line(f: Floor, a: Point, b: Point) {
  let x = a.x,
    y = a.y;
  const dx = Math.abs(b.x - x),
    dy = Math.abs(b.y - y),
    sx = x < b.x ? 1 : -1,
    sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  for (let i = 0; i < 100; i++) {
    if (!walkable(f, x, y)) return false;
    if (x === b.x && y === b.y) return true;
    const e = 2 * err;
    if (e > -dy) {
      err -= dy;
      x += sx;
    }
    if (e < dx) {
      err += dx;
      y += sy;
    }
  }
  return false;
}
export function path(
  f: Floor,
  a: Point,
  b: Point,
  blocked = new Set<number>(),
): Point[] {
  const start = a.y * f.width + a.x,
    end = b.y * f.width + b.x,
    queue = [start],
    prev = new Int32Array(f.width * f.height).fill(-1);
  prev[start] = start;
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n];
    if (id === end) break;
    const x = id % f.width,
      y = Math.floor(id / f.width);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        j = ny * f.width + nx;
      if (
        !walkable(f, nx, ny) ||
        prev[j] !== -1 ||
        (j !== end && blocked.has(j))
      )
        continue;
      prev[j] = id;
      queue.push(j);
    }
  }
  if (prev[end] === -1) return [];
  const result: Point[] = [];
  for (let k = end; k !== start; k = prev[k])
    result.push({ x: k % f.width, y: Math.floor(k / f.width) });
  return result.reverse();
}
export function generateFloor(seed: number, depth: number): Floor {
  const random = seeded(seed + depth * 7919),
    width = 87,
    height = 43,
    tiles: Tile[] = Array(width * height).fill("#");
  const rooms: Chamber[] = [];
  const set = (x: number, y: number, t: Tile = ".") => {
    tiles[y * width + x] = t;
  };
  // Nine generous chambers, a connected serpentine backbone and an optional treasure branch.
  const order = [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [1, 1],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ];
  const kinds: Chamber["kind"][] = [
    "start",
    "combat",
    "swarm",
    "trap",
    "puzzle",
    "shrine",
    "elite",
    "upgrade",
    "boss",
  ];
  for (let i = 0; i < 9; i++) {
    const [gx, gy] = order[i],
      w = i === 8 ? 17 : 11 + Math.floor(random() * 5),
      h = i === 8 ? 11 : 8 + Math.floor(random() * 3),
      x = 3 + gx * 21 + Math.floor(random() * 2),
      y = 2 + gy * 14 + Math.floor(random() * 2);
    const room: Chamber = {
      id: i,
      x,
      y,
      w,
      h,
      kind: kinds[i],
      entered: i === 0,
      cleared: i === 0,
    };
    rooms.push(room);
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) set(xx, yy);
  }
  const center = (r: Chamber) => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  });
  for (let i = 1; i < rooms.length; i++) {
    let a = center(rooms[i - 1]),
      b = center(rooms[i]);
    while (a.x !== b.x) {
      set(a.x, a.y);
      set(a.x, a.y + 1);
      a.x += Math.sign(b.x - a.x);
    }
    while (a.y !== b.y) {
      set(a.x, a.y);
      set(a.x + 1, a.y);
      a.y += Math.sign(b.y - a.y);
    }
    set(a.x, a.y);
  }
  const treasure: Chamber = {
    id: 9,
    x: 69,
    y: 17,
    w: 14,
    h: 10,
    kind: "treasure",
    entered: false,
    cleared: false,
    optional: true,
  };
  for (let yy = treasure.y; yy < treasure.y + treasure.h; yy++)
    for (let xx = treasure.x; xx < treasure.x + treasure.w; xx++) set(xx, yy);
  const branch = center(rooms[3]);
  for (let x = branch.x; x <= treasure.x + 2; x++) {
    set(x, branch.y);
    set(x, branch.y + 1);
  }
  rooms.push(treasure);
  const spawn = center(rooms[0]),
    exit = center(rooms[8]);
  set(exit.x, exit.y, ">");
  for (const r of rooms.filter((r) => r.id !== 0 && r.kind !== "boss")) {
    const c = center(r);
    if (r.kind === "shrine") {
      set(c.x, c.y, "H");
      set(c.x + 2, c.y, "M");
    } else if (r.kind === "upgrade") set(c.x, c.y, "U");
    else if (r.kind === "puzzle") {
      set(c.x, c.y, "S");
      set(r.x + r.w - 1, c.y, "D");
      set(c.x - 2, c.y, "K");
    } else {
      set(r.x + 1, r.y + 1, "C");
      if (r.kind === "trap")
        for (let j = 2; j < r.w - 2; j += 3) set(r.x + j, r.y + 2, "^");
    }
    if (depth > 1 && r.kind !== "shrine")
      for (let j = 0; j < 3; j++)
        set(r.x + 2 + j, r.y + r.h - 2, depth === 2 ? "~" : "!");
  }
  return {
    width,
    height,
    tiles,
    rooms,
    spawn,
    exit,
    theme: THEMES[depth - 1],
    explored: Array(width * height).fill(0),
  };
}
export function validateFloor(f: Floor) {
  const reached = new Set<number>(),
    queue = [f.spawn];
  for (let n = 0; n < queue.length; n++) {
    const a = queue[n],
      key = a.y * f.width + a.x;
    if (reached.has(key)) continue;
    reached.add(key);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      if (
        walkable(f, a.x + dx, a.y + dy) &&
        !reached.has((a.y + dy) * f.width + a.x + dx)
      )
        queue.push({ x: a.x + dx, y: a.y + dy });
  }
  return (
    walkable(f, f.spawn.x, f.spawn.y) &&
    reached.has(f.exit.y * f.width + f.exit.x) &&
    f.rooms.every((r) => reached.has((r.y + 2) * f.width + r.x + 2))
  );
}
