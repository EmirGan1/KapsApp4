import type { BombSite, MapDefinition, Solid, Vec3 } from "./types";

type Footprint = readonly [west: number, east: number, south: number, north: number];
const point = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });

// North-up. Routes share exact edges, so every street opening is derived from the same footprint.
const blocks: Record<string, Footprint> = {
  "T Spawn": [38, 51, 1, 15],
  "Side Alley": [18, 40, 7, 14],
  "House": [14, 22, 13, 27],
  "Back Alley": [7, 20, 25, 35],
  "Apartments": [-41, 11, 32, 39],
  "Underpass": [-20, -15, 8, 33],
  "Top Mid": [10, 22, 0, 10],
  "Mid": [-25, 13, 0, 10],
  "Catwalk": [-27, 15, 10, 16],
  "Short": [-32, -25, 12, 27],
  "B Site": [-45, -29, 19, 37],
  "Market": [-44, -32, 10, 19],
  "Market Alley": [-42, -35, -34, 10],
  "Sniper Alley": [-34, -30, -35, -16],
  "CT Spawn": [-42, -11, -45, -34],
  "Ticket": [-13, 10, -42, -35],
  "A Site": [8, 37, -42, -21],
  "Window": [-31, -25, 0, 8],
  "Ladder Room": [-28, -25, 7, 14],
  "Jungle": [-32, -21, -21, 0],
  "Stairs": [-22, 10, -24, -17],
  "Connector": [-5, 2, -19, 0],
  "A Ramp": [36, 48, -28, -20],
  "Palace Alley": [43, 49, -47, 2],
  "Palace": [18, 45, -49, -42],
};

const routes: { name: string; points: Vec3[] }[] = [
  { name: "T Spawn → A Ramp → A", points: [point(45, 7), point(46, -24), point(33.8, -24), point(34, -31), point(28, -31, 1), point(22, -31, 1.2)] },
  { name: "T Spawn → Palace → A", points: [point(45, 7), point(46, -43), point(37, -45, 3), point(23, -45, 3), point(23, -42, 3), point(23, -36, 1.2)] },
  { name: "T Spawn → Top Mid → Connector → A", points: [point(45, 11), point(20, 11), point(20, 5), point(-1, 5), point(-1, -17.5, 1.2), point(-1, -22), point(9, -22), point(13, -23), point(22, -23), point(22, -31, 1.2)] },
  { name: "T Spawn → Back Alley → Apartments → B", points: [point(45, 11), point(19, 11), point(19, 33), point(11, 33, 2.4), point(7, 35, 2.4), point(-37, 35, 2.4), point(-37, 27), point(-38, 25)] },
  { name: "Apartments → Underpass → Mid", points: [point(-17.5, 35, 2.4), point(-17.5, 25), point(-17.5, 6)] },
  { name: "Mid → Underpass → Apartments", points: [point(-17.5, 6), point(-17.5, 25), point(-17.5, 35, 2.4)] },
  { name: "Top Mid → Catwalk → B Short", points: [point(12, 7), point(12, 13), point(-18, 13, 3.35), point(-28, 14), point(-28, 22), point(-36, 22)] },
  { name: "CT Spawn → Market → B", points: [point(-32, -39), point(-38, -39), point(-38, 13), point(-38, 25)] },
  { name: "CT Spawn → Ticket → A", points: [point(-24, -38), point(12, -38), point(15, -40.5), point(17, -41.08), point(22, -41.08), point(22, -31, 1.2)] },
  { name: "CT Spawn → Jungle → Window", points: [point(-32.5, -39), point(-32.5, -19), point(-28, -19), point(-28, 4, 2)] },
  { name: "Window → Ladder Room → Short", points: [point(-28, 4, 2), point(-26.7, 7, 2), point(-26.7, 13, .15), point(-29, 13), point(-29, 17)] },
  { name: "A → Jungle → Window", points: [point(14, -24), point(9, -22.5), point(-21.5, -22.5), point(-21.5, -19), point(-28, -19), point(-28, 4, 2)] },
];

const sites: BombSite[] = [
  { id: "A", ...point(22, -31, 1.2), radius: 3.5 },
  { id: "B", ...point(-38, 25), radius: 3.5 },
];

export function bolluca(): MapDefinition {
  const solids: Solid[] = [];
  const box = (id: string, x: number, z: number, w: number, d: number, y: number, h: number,
    color: string, surface: Solid["surface"], detail = false) =>
    solids.push({ id: "bolluca-" + id, kind: "box", x, y, z, w, h, d, color, surface, detail });
  const ramp = (id: string, x: number, z: number, w: number, d: number, y: number, h: number,
    axis: "x" | "z", reverse = false) =>
    solids.push({ id: "bolluca-slope-" + id, kind: "ramp", x, y, z, w, h, d, axis, reverse, color: "#c4ac87", surface: "stone" });
  const deck = (id: string, x: number, z: number, w: number, d: number, top: number, base = 0) =>
    box("deck-" + id, x, z, w, d, base, top - base, "#cbb697", "stone");
  const roof = (id: string, x: number, z: number, w: number, d: number, y: number) =>
    box("roof-" + id, x, z, w, d, y, .35, "#b19678", "wood");
  const steps = (id: string, x: number, z: number, w: number, run: number, height: number) => {
    const count = Math.ceil(height / .22);
    for (let i = 0; i < count; i++) {
      box("step-" + id + "-" + i, x, z + run * (i + .5) / count, w, Math.abs(run) / count, 0,
        (i + 1) * height / count, "#b6a082", "stone");
    }
  };

  // Merge collinear perimeter edges before adding façades. No decorative meshes participate in collision.
  const rects = Object.values(blocks);
  const cuts = (a: number, b: number) => [...new Set(rects.flatMap(r => [r[a], r[b]]))].sort((x, y) => x - y);
  const xs = cuts(0, 1), zs = cuts(2, 3);
  const inside = (x: number, z: number) => rects.some(([l, r, b, t]) => x > l && x < r && z > b && z < t);
  const plaster = ["#c9ae90", "#c59c84", "#dfc7a7", "#a7aaa0", "#d0b491"];
  let facade = 0;
  const walls = (alongX: boolean, fixed: number, segments: number[]) => {
    let start = 0, face = 0;
    for (let i = 0; i < segments.length; i++) {
      const middle = (segments[i] + segments[i + 1]) / 2;
      const occupied = (offset: number) => alongX ? inside(middle, fixed + offset) : inside(fixed + offset, middle);
      const next = i === segments.length - 1 ? 0 : Number(occupied(.01)) - Number(occupied(-.01));
      if (face === next) continue;
      if (face) {
        const end = segments[i];
        // Segment long walls into varied façades with contiguous collision.
        const count = Math.ceil((end - start) / 11);
        for (let part = 0; part < count; part++) {
          const width = (end - start) / count, center = start + (part + .5) * width;
          const height = 5.8 + (facade % 4) * .85;
          const id = "facade-" + facade;
          const xy = (u: number, offset: number) => alongX
            ? [center + u, fixed + offset * face] as const : [fixed + offset * face, center + u] as const;
          const panel = (suffix: string, u: number, offset: number, size: number, depth: number, y: number,
            h: number, color: string, surface: Solid["surface"], detail = true) =>
            box(id + suffix, ...xy(u, offset), alongX ? size : depth, alongX ? depth : size, y, h, color, surface, detail);
          panel("", 0, -.32, width, .64, 0, height, plaster[facade % plaster.length], "plaster", false);
          panel("-plinth", 0, .045, width, .09, 0, .9, "#a89b85", "stone");
          panel("-cornice", 0, .1, width, .20, height - .25, .24, "#f2dac0", "stone");
          if (width > 4) {
            const color = facade % 3 === 0 ? "#43706d" : "#54413a";
            for (const u of [-width * .24, width * .24]) {
              panel("-frame-" + u, u, .045, 1.27, .08, 3, 1.45, "#e6cfad", "stone");
              panel("-shutter-" + u, u, .11, 1.06, .10, 3.1, 1.22, color, "wood");
              panel("-sill-" + u, u, .17, 1.48, .32, 2.92, .13, "#cdb898", "stone");
              panel("-header-" + u, u, .09, 1.4, .18, 4.39, .14, "#ebd4b4", "stone");
            }
            if (facade % 3 === 0) {
              panel("-balcony", 0, .33, 2.75, .66, 2.7, .16, "#bea88b", "stone");
              panel("-rail", 0, .61, 2.75, .08, 3.52, .11, "#433d37", "metal");
              for (let j = -2; j <= 2; j++)
                panel("-baluster-" + j, j * .5, .61, .055, .06, 2.86, .7, "#433d37", "metal");
            } else {
              panel("-doorframe", 0, .07, 1.35, .12, .03, 2.12, "#e0c5a3", "stone");
              panel("-door", 0, .135, 1.1, .08, .06, 1.94, color, "wood");
            }
          }
          facade++;
        }
      }
      start = segments[i];
      face = next;
    }
  };
  for (const z of zs) walls(true, z, xs);
  for (const x of xs) walls(false, x, zs);

  // Skyline mass sits outside the walkable footprint, beyond the physical boundary.
  for (const [i, [x, z, w, d, h]] of [
    [47, 20, 8, 6, 11], [-39, 43, 8, 5, 10], [-46, -41, 5, 7, 9],
    [32, -52, 8, 5, 12], [-6, -31, 7, 6, 10],
  ].entries()) {
    box("skyline-" + i, x, z, w, d, 0, h, plaster[i], "plaster", true);
    box("skyline-cornice-" + i, x, z, w + .36, d + .36, h - .22, .23, "#e5cbb0", "stone", true);
    for (const offset of [-2, 0, 2])
      box("skyline-shutter-" + i + "-" + offset, x + offset, z - d / 2, .9, .12, h - 2.35, 1.15, "#526461", "wood", true);
  }

  // Walkable section and elevation changes.
  deck("a-platform", 22, -31, 10, 8, 1.2);
  ramp("a-ramp", 30, -31, 6, 6, 0, 1.2, "x", true);
  ramp("ticket", 22, -38, 8, 6, 0, 1.2, "z");
  steps("a-stairs", 22, -23, 8, -4, 1.2);
  steps("connector-exit", -1.5, -22, 7, 3, 1.2);
  deck("connector-landing", -1.5, -17, 7, 4, 1.2);
  steps("connector", -1.5, -9, 7, -6, 1.2);
  deck("connector-upper", -1.5, -15.5, 7, 1, 1.2);
  roof("connector", -1.5, -8, 7, 10, 3.8);
  ramp("jungle", -28, -10, 6, 11, 0, 2, "z");
  deck("window", -28.5, 1.75, 7, 12.5, 2);
  roof("window", -28.5, 3, 7, 10, 5.5);
  ramp("ladder-room", -26.5, 10.5, 3, 5, 0, 2, "z", true);
  roof("ladder-room", -26.5, 10, 3, 5, 4.8);
  for (let i = 0; i < 6; i++)
    box("ladder-rung-" + i, -27.91, 9.5, .12, .75, 1.15 + i * .34, .055, "#65513d", "metal", true);
  box("window-sill", -25, 4, .32, 4, 0, 2.85, "#b39b80", "stone");
  box("window-pier-south", -25, 1, .42, 2, 0, 5.5, "#bdab91", "plaster");
  box("window-pier-north", -25, 7, .42, 2, 0, 5.5, "#bdab91", "plaster");
  box("window-header", -25, 4, .44, 4, 4.85, .65, "#cab498", "stone");
  deck("catwalk-bridge", -17.5, 13, 5, 6, 3.35, 3);
  ramp("catwalk-east", -9.5, 13, 11, 6, 0, 3.35, "x", true);
  ramp("catwalk-west", -23.5, 13, 7, 6, 0, 3.35, "x");
  box("mid-parapet-west", -23, 10, 6, .34, 0, 1.05, "#c0a483", "stone");
  box("mid-parapet-east", -2.5, 10, 25, .34, 0, 1.05, "#c0a483", "stone");
  roof("underpass", -17.5, 21.5, 5, 11, 3);
  ramp("underpass-exit", -17.5, 29, 5, 6, 0, 2.4, "z");
  deck("apps-west", -29.5, 35.5, 23, 7, 2.4);
  deck("apps-east", -3.5, 35.5, 29, 7, 2.4);
  ramp("apps-entry", 15, 33, 8, 3, 0, 2.4, "x", true);
  ramp("apps-drop", -37, 29.5, 5, 5, 0, 2.4, "z");
  roof("apartments-west", -27, 35.5, 28, 7, 5.4);
  roof("apartments-east", 1, 35.5, 20, 7, 5.4);
  ramp("palace-entry", 41.5, -45.5, 7, 7, 0, 3, "x", true);
  deck("palace", 28, -45.5, 20, 7, 3);
  deck("palace-balcony", 23, -41.5, 8, 1, 3, 2.72);
  roof("palace", 31.5, -46, 27, 6, 6.1);
  roof("market", -38, 14.5, 12, 9, 3.7);

  const arch = (id: string, x: number, z: number, width: number, height: number, base = 0) => {
    for (const side of [-1, 1]) {
      box(id + "-pier-" + side, x + side * width / 2, z, .65, .8, base, height, "#b59a77", "stone");
      for (let i = 0; i < 4; i++)
        box(id + "-arch-" + side + "-" + i, x + side * (width / 2 - .35 - i * .42), z,
          .52, .82, base + height - .55 + i * .15, .68 - i * .10, "#c8ac83", "stone");
    }
    box(id + "-entry-lintel", x, z, width + .65, .8, base + height, .7, "#bfa988", "plaster");
  };
  arch("market-gate", -38, 19, 4.8, 3.2);
  box("market-door-west", -42.2, 19, 3.6, .65, 0, 4.1, "#a99f83", "plaster");
  box("market-door-east", -35.15, 19, .9, .65, 0, 4.1, "#a99f83", "plaster");
  box("market-window-sill", -33.7, 19, 2, .65, 0, .82, "#ad9675", "stone");
  box("market-window-header", -33.7, 19, 2, .65, 2.65, 1.45, "#a99f83", "plaster");
  box("market-window-jamb", -32.35, 19, .7, .65, 0, 4.1, "#a99f83", "plaster");
  box("apps-window-west", -40.25, 32, 1.5, .5, 2.4, 3, "#c39b87", "plaster");
  box("apps-window-east", -32, 32, 5, .5, 2.4, 3, "#c39b87", "plaster");
  box("apps-window-header", -37, 32, 5, .5, 4.7, .7, "#c39b87", "plaster");
  arch("short-arch", -28.5, 19.5, 4.5, 3.2);
  arch("palace-portico", 23, -42, 5.5, 2.65, 3);
  box("palace-front-west", 19.1, -42, 2.2, .6, 0, 6.1, "#d6b593", "plaster");
  box("palace-front-east", 31.5, -42, 11, .6, 0, 6.1, "#d6b593", "plaster");
  deck("palace-threshold", 23, -42, 5.6, .6, 3, 2.72);
  for (const x of [20.15, 25.85]) {
    box("palace-railing-" + x, x, -41.52, .11, .95, 3, .55, "#4f4842", "metal", true);
    box("palace-capital-" + x, x, -42, .89, .89, 5.3, .18, "#e3c9a2", "stone", true);
  }
  arch("underpass-mouth", -17.5, 24, 4.25, 2.6);
  arch("connector-arch", -1.5, -12, 5.2, 3.9);

  const crate = (id: string, x: number, z: number, y: number, w: number, d: number, h: number) => {
    box("crate-" + id, x, z, w, d, y, h, "#917251", "wood");
    for (const side of [-1, 1])
      box("crate-band-" + id + side, x + side * w * .35, z, .09, d + .03, y, h + .025, "#625546", "metal", true);
  };
  crate("tetris", 31, -26.5, 0, 2.5, 1.9, 1.4);
  crate("tetris-top", 31.4, -26.5, 1.4, 1.3, 1.5, .85);
  crate("triple", 19.5, -34, 1.2, 2, 1.45, 1.8);
  crate("firebox", 26, -33.8, 1.2, 1.55, 1.4, 1.45);
  crate("shadow", 19, -39.5, 0, 1.8, 1.65, 1.7);
  crate("top-mid", 14, 2.5, 0, 2.1, 1.6, 1.25);
  crate("short-corner", -30, 24.5, 0, 1.4, 1.55, 1.3);
  crate("b-default", -40.1, 25.8, 0, 1.65, 1.7, 1.5);
  crate("b-bench", -43.5, 28, 0, .9, 3, .58);
  box("van", -42, 33, 2.3, 4.2, .25, 1.9, "#d4d4bc", "metal");
  box("van-windscreen", -42, 30.88, 1.88, .06, 1.35, .48, "#526a71", "glass", true);
  for (const x of [-43.05, -40.95]) for (const z of [31.6, 34.4])
    box("van-wheel-" + x + "-" + z, x, z, .4, .7, .02, .66, "#3d3d39", "metal");
  box("ticket-booth", 8.5, -40.3, 2.15, 2.2, 0, 2.5, "#829794", "plaster");
  box("ticket-shutter", 8.5, -39.18, 1.6, .06, 1.14, .8, "#465f63", "metal", true);
  box("market-awning", -38, 18.5, 4, 1.6, 3.02, .15, "#9d5850", "fabric", true);
  box("b-canopy", -42, 24, 4.3, 6, 4.1, .16, "#72816a", "fabric", true);
  box("b-canopy-post", -40, 21.2, .13, .13, 0, 4.1, "#615444", "metal");
  box("market-counter", -43, 14.5, .9, 4, 0, 1.04, "#866b54", "wood");
  box("market-countertop", -43, 14.5, 1, 4.12, 1.04, .14, "#bc9c72", "wood");
  for (const x of [-40.4, -36.8, -33.6])
    box("market-joist-" + x, x, 14.5, .15, 8.8, 3.46, .24, "#79614c", "wood", true);
  for (const x of [-35, -28, -21, -14, -7, 0, 7])
    box("apps-joist-" + x, x, 35.5, .17, 7, 5.17, .24, "#876851", "wood", true);
  for (const z of [-13, -10, -7, -4])
    box("connector-joist-" + z, -1.5, z, 7, .18, 3.55, .26, "#866f57", "wood", true);
  for (const x of [27, 34]) {
    box("palace-column-" + x, x, -47.5, .65, .65, 3, 3.1, "#d2b492", "stone");
    box("palace-column-foot-" + x, x, -47.5, .85, .85, 3, .25, "#a88b69", "stone", true);
  }
  for (const [id, x, z, label] of [["a", 10.5, -41.5, "A · BOLLUCA"], ["b", -43.5, 19.45, "B · PAZAR"]] as const)
    solids.push({ id: "bolluca-sign-" + id, kind: "box", x, y: 3.6, z, w: 3, d: .12, h: .72,
      color: "#51413a", label, detail: true });

  return {
    id: "bolluca", name: "Bolluca", subtitle: "Palace, Mid ve Pazar", bounds: 54, sky: "#bfd8ec", floor: "#c7b79b", floorSurface: "stone",
    solids, routes, radarFootprint: rects, landmarks: Object.keys(blocks), bombSites: sites, targets: [], hazard: { x: 120, z: 120, r: 0 },
    spawns: [point(43, 5), point(46, 6), point(49, 8), point(43, 10), point(47, 12),
      point(-31, -40), point(-28, -41), point(-25, -38), point(-22, -41), point(-19, -39)],
  };
}
