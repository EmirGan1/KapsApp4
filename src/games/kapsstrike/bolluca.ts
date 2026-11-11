import type { BombSite, MapDefinition, Solid, Vec3 } from "./types";

type Footprint = readonly [west: number, east: number, south: number, north: number];
const point = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });

// North-up CS:GO Mirage architectural footprint (Bolluca).
// Routes share exact edges, so every street opening and interior chamber is derived from the same footprint.
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

  // Merge collinear perimeter edges before adding Moroccan/Mirage façades.
  const rects = Object.values(blocks);
  const cuts = (a: number, b: number) => [...new Set(rects.flatMap(r => [r[a], r[b]]))].sort((x, y) => x - y);
  const xs = cuts(0, 1), zs = cuts(2, 3);
  const inside = (x: number, z: number) => rects.some(([l, r, b, t]) => x > l && x < r && z > b && z < t);
  const plaster = ["#d2b494", "#c99e82", "#e1caa8", "#bc9e82", "#d6ba98"];
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
        const count = Math.ceil((end - start) / 11);
        for (let part = 0; part < count; part++) {
          const width = (end - start) / count, center = start + (part + .5) * width;
          const height = 6.0 + (facade % 4) * .85;
          const id = "facade-" + facade;
          const xy = (u: number, offset: number) => alongX
            ? [center + u, fixed + offset * face] as const : [fixed + offset * face, center + u] as const;
          const panel = (suffix: string, u: number, offset: number, size: number, depth: number, y: number,
            h: number, color: string, surface: Solid["surface"], detail = true) =>
            box(id + suffix, ...xy(u, offset), alongX ? size : depth, alongX ? depth : size, y, h, color, surface, detail);
          panel("", 0, -.32, width, .64, 0, height, plaster[facade % plaster.length], "plaster", false);
          panel("-plinth", 0, .045, width, .09, 0, .92, "#a48e76", "stone");
          panel("-dado-band", 0, .06, width, .08, .92, .14, "#3b6572", "stone");
          panel("-cornice", 0, .11, width, .22, height - .26, .26, "#f2dac0", "stone");
          panel("-crenel-trim", 0, .08, width, .16, height - .62, .12, "#b58d6d", "stone");
          if (width > 4) {
            const color = facade % 3 === 0 ? "#3f6d6a" : facade % 3 === 1 ? "#5a4339" : "#3a5a75";
            for (const u of [-width * .24, width * .24]) {
              panel("-frame-" + u, u, .045, 1.28, .08, 3, 1.48, "#e6cfad", "stone");
              panel("-shutter-" + u, u, .11, 1.06, .10, 3.1, 1.22, color, "wood");
              panel("-sill-" + u, u, .17, 1.48, .32, 2.92, .13, "#cdb898", "stone");
              panel("-header-" + u, u, .09, 1.44, .18, 4.41, .16, "#ebd4b4", "stone");
            }
            if (facade % 3 === 0) {
              panel("-balcony", 0, .33, 2.75, .66, 2.7, .16, "#bea88b", "stone");
              panel("-rail", 0, .61, 2.75, .08, 3.52, .11, "#433d37", "metal");
              for (let j = -2; j <= 2; j++)
                panel("-baluster-" + j, j * .5, .61, .055, .06, 2.86, .7, "#433d37", "metal");
            } else {
              panel("-doorframe", 0, .07, 1.38, .12, .03, 2.15, "#e0c5a3", "stone");
              panel("-door", 0, .135, 1.12, .08, .06, 1.96, color, "wood");
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

  // Moroccan skyline towers, domes, minarets & courtyard buildings beyond the physical perimeter (IMAGE 05, 08, 11)
  for (const [i, [x, z, w, d, h]] of [
    [47, 20, 8, 6, 11.5], [-39, 43, 8, 5, 10.5], [-46, -41, 5, 7, 9.5],
    [32, -53, 9, 6, 13], [-6, -31, 7, 6, 10.5], [14, -50, 7, 5, 11],
    [-48, 15, 5, 8, 10.5], [4, 22, 8, 6, 9.8],
  ].entries()) {
    box("skyline-" + i, x, z, w, d, 0, h, plaster[i % plaster.length], "plaster", true);
    box("skyline-cornice-" + i, x, z, w + .38, d + .38, h - .24, .24, "#e5cbb0", "stone", true);
    box("skyline-roof-parapet-" + i, x, z, w - .4, d - .4, h, .55, "#c9ac8c", "stone", true);
    for (const offset of [-2, 0, 2])
      box("skyline-shutter-" + i + "-" + offset, x + offset, z - d / 2, .9, .12, h - 2.35, 1.15, "#456461", "wood", true);
  }
  // Iconic Palace gold-domed cupola & B-Side Moroccan minaret tower (IMAGE 05, 08, 09)
  box("palace-dome-drum", 32, -52, 4.6, 4.6, 13, 1.8, "#d9c2a0", "stone", true);
  box("palace-dome-crown", 32, -52, 3.6, 3.6, 14.8, 1.4, "#c59b4f", "metal", true);
  box("palace-dome-finial", 32, -52, .35, .35, 16.2, 1.2, "#d8b467", "metal", true);
  box("b-minaret-shaft", -39, 43, 2.8, 2.8, 10.5, 4.2, "#cfb393", "stone", true);
  box("b-minaret-lantern", -39, 43, 2.0, 2.0, 14.7, 1.6, "#dfc7a7", "stone", true);
  box("b-minaret-cap", -39, 43, 1.4, 1.4, 16.3, 1.1, "#436d6a", "metal", true);

  // ============================================================================
  // 1. WALKABLE DECKS, RAMPS, STAIRS & ROOFS
  // ============================================================================
  // A Site Platform, Ramp, Ticket Ramp & A Stairs (IMAGE 06, 08)
  deck("a-platform", 22, -31, 10, 8, 1.2);
  box("a-platform-curb-n", 22, -27.05, 10.1, .22, 1.15, .12, "#a88f70", "stone", true);
  box("a-platform-curb-s", 22, -34.95, 10.1, .22, 1.15, .12, "#a88f70", "stone", true);
  box("a-platform-curb-w", 17.05, -31, .22, 8.1, 1.15, .12, "#a88f70", "stone", true);
  // Bomb site A painted hazard border on platform
  box("a-site-mark-n", 22, -28.6, 4.6, .16, 1.21, .02, "#b5482a", "stone", true);
  box("a-site-mark-s", 22, -33.4, 4.6, .16, 1.21, .02, "#b5482a", "stone", true);
  box("a-site-mark-w", 19.7, -31, .16, 4.8, 1.21, .02, "#b5482a", "stone", true);
  box("a-site-mark-e", 24.3, -31, .16, 4.8, 1.21, .02, "#b5482a", "stone", true);

  ramp("a-ramp", 30, -31, 6, 6, 0, 1.2, "x", true);
  ramp("ticket", 22, -38, 8, 6, 0, 1.2, "z");
  steps("a-stairs", 22, -23, 8, -4, 1.2);
  // A Stairs parapet & Sandwich dividing wall between Stairs and Tetris (IMAGE 06, 08)
  box("a-stairs-east-parapet", 26.15, -23.2, .35, 3.8, 0, 1.85, "#c5ad8d", "stone");
  box("a-stairs-top-coping", 26.15, -23.2, .45, 3.9, 1.85, .14, "#dfd0b8", "stone", true);
  box("sandwich-back-wall", 28.2, -21.3, 3.8, .38, 0, 2.2, "#bfa584", "stone");

  // Connector & Jungle (IMAGE 05, 06, 08, 11)
  steps("connector-exit", -1.5, -22, 7, 3, 1.2);
  deck("connector-landing", -1.5, -17, 7, 4, 1.2);
  steps("connector", -1.5, -9, 7, -6, 1.2);
  deck("connector-upper", -1.5, -15.5, 7, 1, 1.2);
  roof("connector", -1.5, -8, 7, 10, 3.8);
  box("connector-cornice-n", -1.5, -3.0, 7.2, .28, 3.8, .28, "#dfd0b8", "stone", true);
  box("connector-cornice-s", -1.5, -13.0, 7.2, .28, 3.8, .28, "#dfd0b8", "stone", true);

  ramp("jungle", -28, -10, 6, 11, 0, 2, "z");
  deck("window", -28.5, 1.75, 7, 12.5, 2);
  roof("window", -28.5, 3, 7, 10, 5.5);
  // Jungle interior cubby wall & sniper bench trim
  box("jungle-cubby-pillar", -24.6, -15.2, .55, 1.8, 0, 3.8, "#c7b090", "stone");
  box("jungle-arch-beam", -26.5, -15.2, 9.2, .45, 3.4, .55, "#b89f7d", "stone", true);

  // Window / Sniper's Nest & Ladder Room (IMAGE 05, 11)
  ramp("ladder-room", -26.5, 10.5, 3, 5, 0, 2, "z", true);
  roof("ladder-room", -26.5, 10, 3, 5, 4.8);
  for (let i = 0; i < 6; i++)
    box("ladder-rung-" + i, -27.91, 9.5, .12, .75, 1.15 + i * .34, .055, "#65513d", "metal", true);
  box("window-sill", -25, 4, .32, 4, 0, 2.85, "#b39b80", "stone");
  box("window-sill-ledge", -24.95, 4, .48, 4.1, 2.75, .14, "#d6c2a5", "stone", true);
  box("window-pier-south", -25, 1, .42, 2, 0, 5.5, "#bdab91", "plaster");
  box("window-pier-north", -25, 7, .42, 2, 0, 5.5, "#bdab91", "plaster");
  box("window-header", -25, 4, .44, 4, 4.85, .65, "#cab498", "stone");
  // Under-Window boost bench on Mid side (IMAGE 11)
  box("window-under-bench", -24.15, 1.4, 1.1, 1.5, 0, .95, "#9c7e5b", "wood");
  // Vent frame detail in Window/Ladder room
  box("window-vent-frame", -30.8, 6.2, .12, 1.2, 2.1, 1.1, "#5c6468", "metal", true);
  for (let k = 0; k < 4; k++)
    box("window-vent-slat-" + k, -30.75, 6.2, .14, 1.05, 2.25 + k * .22, .05, "#3d4346", "metal", true);

  // Mid, Catwalk & Underpass (IMAGE 05, 11, 12)
  deck("catwalk-bridge", -17.5, 13, 5, 6, 3.35, 3);
  ramp("catwalk-east", -9.5, 13, 11, 6, 0, 3.35, "x", true);
  ramp("catwalk-west", -23.5, 13, 7, 6, 0, 3.35, "x");
  box("mid-parapet-west", -23, 10, 6, .34, 0, 1.05, "#c0a483", "stone");
  box("mid-parapet-east", -2.5, 10, 25, .34, 0, 1.05, "#c0a483", "stone");
  box("mid-parapet-coping-e", -2.5, 10, 25.1, .44, 1.05, .1, "#dfd0b8", "stone", true);
  box("mid-parapet-coping-w", -23, 10, 6.1, .44, 1.05, .1, "#dfd0b8", "stone", true);
  // Catwalk overhead awnings & Mid street posts (IMAGE 11, 12)
  box("catwalk-awning-e", 4.5, 15.2, 5.5, 1.4, 4.1, .16, "#9e4838", "fabric", true);
  box("catwalk-awning-w", -8.5, 15.2, 5.5, 1.4, 4.4, .16, "#3b6572", "fabric", true);
  box("catwalk-corner-post", -24.8, 15.5, .28, .28, 0, 4.6, "#5e4c3b", "wood", true);

  // Underpass tunnel & ceramic tile wainscot (IMAGE 05, 11)
  roof("underpass", -17.5, 21.5, 5, 11, 3);
  ramp("underpass-exit", -17.5, 29, 5, 6, 0, 2.4, "z");
  for (const side of [-1, 1]) {
    box("underpass-tile-band-" + side, -17.5 + side * 2.38, 21.5, .06, 10.8, 1.2, .28, "#386678", "stone", true);
    box("underpass-wainscot-" + side, -17.5 + side * 2.4, 21.5, .05, 10.8, 0, 1.2, "#dfd8c8", "stone", true);
  }

  // B Apartments & Balcony (IMAGE 07, 09)
  deck("apps-west", -29.5, 35.5, 23, 7, 2.4);
  deck("apps-east", -3.5, 35.5, 29, 7, 2.4);
  ramp("apps-entry", 15, 33, 8, 3, 0, 2.4, "x", true);
  ramp("apps-drop", -37, 29.5, 5, 5, 0, 2.4, "z");
  roof("apartments-west", -27, 35.5, 28, 7, 5.4);
  roof("apartments-east", 1, 35.5, 20, 7, 5.4);
  // B Apartments exterior wooden balcony trim & Kitchen interior counter
  box("apps-balcony-beam", -37, 31.8, 5.2, .28, 2.15, .28, "#6e553e", "wood", true);
  box("apps-balcony-awning", -37, 31.2, 5.4, 1.4, 4.75, .16, "#8c4a3b", "fabric", true);
  box("apps-kitchen-stove", -8.5, 38.2, 2.4, .85, 2.4, .95, "#b8b4aa", "metal", true);
  box("apps-kitchen-cabinet", -12.0, 38.2, 3.2, .8, 2.4, .95, "#7c5e44", "wood", true);

  // Palace & Balcony (IMAGE 05, 06, 08)
  ramp("palace-entry", 41.5, -45.5, 7, 7, 0, 3, "x", true);
  deck("palace", 28, -45.5, 20, 7, 3);
  deck("palace-balcony", 23, -41.5, 8, 1, 3, 2.72);
  roof("palace", 31.5, -46, 27, 6, 6.1);
  // Palace Balcony wooden pergola & side shutter screen (IMAGE 06, 08)
  box("palace-pergola-beam-w", 19.4, -40.8, .22, 2.4, 5.4, .22, "#6e543b", "wood", true);
  box("palace-pergola-beam-e", 26.6, -40.8, .22, 2.4, 5.4, .22, "#6e543b", "wood", true);
  for (let z = -41.8; z <= -39.8; z += .5)
    box("palace-pergola-slat-" + z, 23, z, 7.6, .14, 5.62, .1, "#7b5f44", "wood", true);
  // Palace interior Moroccan tile band
  box("palace-interior-tile-s", 31, -48.6, 24, .06, 4.2, .28, "#386678", "stone", true);

  // Market / Kitchen (IMAGE 07, 09)
  roof("market", -38, 14.5, 12, 9, 3.7);
  box("market-parapet", -38, 19.1, 12.2, .32, 3.7, .65, "#d8be9e", "stone", true);

  // ============================================================================
  // 2. ARCHES, DOORWAYS & WINDOWS
  // ============================================================================
  const arch = (id: string, x: number, z: number, width: number, height: number, base = 0) => {
    for (const side of [-1, 1]) {
      box(id + "-pier-" + side, x + side * width / 2, z, .65, .8, base, height, "#b59a77", "stone");
      for (let i = 0; i < 4; i++)
        box(id + "-arch-" + side + "-" + i, x + side * (width / 2 - .35 - i * .42), z,
          .52, .82, base + height - .55 + i * .15, .68 - i * .10, "#c8ac83", "stone");
    }
    box(id + "-entry-lintel", x, z, width + .65, .8, base + height, .7, "#bfa988", "plaster");
  };
  const archZ = (id: string, x: number, z: number, width: number, height: number, base = 0) => {
    for (const side of [-1, 1]) {
      box(id + "-pier-" + side, x, z + side * width / 2, .8, .65, base, height, "#b59a77", "stone");
      for (let i = 0; i < 4; i++)
        box(id + "-arch-" + side + "-" + i, x, z + side * (width / 2 - .35 - i * .42),
          .82, .52, base + height - .55 + i * .15, .68 - i * .10, "#c8ac83", "stone", true);
    }
    box(id + "-entry-lintel", x, z, .8, width + .65, base + height, .7, "#bfa988", "plaster");
  };
  // Market Door & Market Window (IMAGE 07, 09)
  arch("market-gate", -38, 19, 4.8, 3.2);
  box("market-door-west", -42.2, 19, 3.6, .65, 0, 4.1, "#a99f83", "plaster");
  box("market-door-east", -35.15, 19, .9, .65, 0, 4.1, "#a99f83", "plaster");
  box("market-window-sill", -33.7, 19, 2, .65, 0, .82, "#ad9675", "stone");
  box("market-window-step", -33.7, 18.2, 1.8, .75, 0, .42, "#9c8567", "stone");
  box("market-window-header", -33.7, 19, 2, .65, 2.65, 1.45, "#a99f83", "plaster");
  box("market-window-jamb", -32.35, 19, .7, .65, 0, 4.1, "#a99f83", "plaster");
  box("market-window-shutter-l", -34.55, 19.36, .35, .08, .9, 1.65, "#426a68", "wood", true);
  box("market-window-shutter-r", -32.85, 19.36, .35, .08, .9, 1.65, "#426a68", "wood", true);

  // B Apartments windows & B Short Arches (IMAGE 07, 09, 10, 12)
  box("apps-window-west", -40.25, 32, 1.5, .5, 2.4, 3, "#c39b87", "plaster");
  box("apps-window-east", -32, 32, 5, .5, 2.4, 3, "#c39b87", "plaster");
  box("apps-window-header", -37, 32, 5, .5, 4.7, .7, "#c39b87", "plaster");
  arch("short-arch", -28.5, 19.5, 4.5, 3.2);
  archZ("short-west-arch", -29.2, 22.0, 5.2, 3.2);
  box("short-arcade-roof", -28.5, 22.2, 5.2, 6.2, 3.9, .35, "#cbb190", "stone", true);

  // Palace Portico & A Ramp Archway (IMAGE 06, 08)
  arch("palace-portico", 23, -42, 5.5, 2.65, 3);
  archZ("a-ramp-arch", 36.2, -24, 6.2, 3.6, 0);
  box("palace-front-west", 19.1, -42, 2.2, .6, 0, 6.1, "#d6b593", "plaster");
  box("palace-front-east", 31.5, -42, 11, .6, 0, 6.1, "#d6b593", "plaster");
  deck("palace-threshold", 23, -42, 5.6, .6, 3, 2.72);
  for (const x of [20.15, 25.85]) {
    box("palace-railing-" + x, x, -41.52, .11, .95, 3, .55, "#4f4842", "metal", true);
    box("palace-capital-" + x, x, -42, .89, .89, 5.3, .18, "#e3c9a2", "stone", true);
  }
  arch("underpass-mouth", -17.5, 24, 4.25, 2.6);
  arch("connector-arch", -1.5, -12, 5.2, 3.9);
  archZ("top-mid-arch", 17.5, 5.0, 7.6, 3.8);

  // ============================================================================
  // 3. ICONIC MIRAGE COVER: TETRIS, TRIPLE, DEFAULT, FIREBOX, TICKET, B CANOPY, VAN
  //    Faithful to Reference PDF IMAGE 06, 07, 08, 09, 10, 11, 12
  // ============================================================================
  const crate = (id: string, x: number, z: number, y: number, w: number, d: number, h: number, tone = "#917251") => {
    box("crate-" + id, x, z, w, d, y, h, tone, "wood");
    box("crate-lid-" + id, x, z, w + .06, d + .06, y + h, .05, "#7a5e40", "wood", true);
    for (const side of [-1, 1])
      box("crate-band-" + id + side, x + side * w * .35, z, .09, d + .03, y, h + .025, "#564b3e", "metal", true);
  };

  // A Site Cover: Tetris, Default, Triple Box, Firebox, Shadow/Under-Balcony (IMAGE 06, 08)
  crate("tetris", 31, -26.5, 0, 2.5, 1.9, 1.4, "#967755");
  crate("tetris-top", 31.4, -26.5, 1.4, 1.3, 1.5, .85, "#846646");
  crate("tetris-north-block", 31.2, -24.8, 0, 1.4, 1.1, 1.05, "#a89276");
  // A Default (tall crate stack at east edge of A Platform overlooking A Ramp)
  crate("a-default", 25.8, -28.6, 1.2, 1.45, 1.45, 1.85, "#607056");
  box("a-default-top", 25.8, -28.6, 1.25, 1.25, 3.05, .85, "#876b4c", "wood", true);
  // Triple Box (L-shaped 3-crate cluster on West/SW A Platform)
  crate("triple", 19.5, -34, 1.2, 2, 1.45, 1.8, "#8e6f4e");
  crate("triple-wing", 18.2, -32.8, 1.2, 1.25, 1.25, 1.45, "#9c7d5b");
  box("triple-upper", 19.5, -34, 1.35, 1.25, 3.0, .95, "#7d6042", "wood", true);
  // Firebox & Ninja corner (SE corner of A Platform)
  crate("firebox", 26, -33.8, 1.2, 1.55, 1.4, 1.45, "#947452");
  box("firebox-upper", 26.1, -33.8, 1.2, 1.15, 2.65, .95, "#7f6243", "wood", true);
  // Shadow / Under Palace Balcony
  crate("shadow", 19, -39.5, 0, 1.8, 1.65, 1.7, "#7d6245");

  // Ticket Booth & CT Spawn Cover (IMAGE 06, 08)
  box("ticket-booth", 8.5, -40.3, 2.15, 2.2, 0, 2.5, "#768f8d", "plaster");
  box("ticket-roof", 8.5, -40.3, 2.45, 2.5, 2.5, .22, "#596e6d", "metal", true);
  box("ticket-shutter", 8.5, -39.18, 1.6, .06, 1.14, .8, "#3e5559", "metal", true);
  box("ticket-counter-ledge", 8.5, -39.12, 1.75, .18, 1.04, .1, "#cdb89a", "stone", true);
  crate("ticket-box", 10.2, -40.3, 0, 1.15, 1.15, 1.35, "#8f7150");

  // Mid & Catwalk Cover: Top Mid Cart/Boxes, Chair, Catwalk Box (IMAGE 11, 12)
  crate("top-mid", 14, 2.5, 0, 2.1, 1.6, 1.25, "#8e704f");
  box("top-mid-cart-top", 14.2, 2.5, 1.45, 1.3, 1.25, .65, "#637258", "wood", true);
  box("mid-chair-box", 11.2, .8, 1.1, 1.0, 0, 1.05, "#9c7e5c", "wood");
  crate("catwalk-mid-box", -4.5, 14.8, 0, 1.25, 1.1, 1.25, "#987a58");
  crate("short-corner", -30, 24.5, 0, 1.4, 1.55, 1.3, "#917251");
  box("short-corner-top", -30, 24.5, 1.1, 1.2, 1.3, .75, "#7e6143", "wood", true);

  // B Site Cover: Central Green-Tarp Canopy, Default, E-Box, Bench, Back Jail & Van (IMAGE 07, 09, 10)
  crate("b-default", -40.1, 25.8, 0, 1.65, 1.7, 1.5, "#607056");
  box("b-default-top", -40.1, 25.8, 1.3, 1.35, 1.5, .85, "#8c6e4d", "wood", true);
  crate("b-ebox", -35.2, 27.6, 0, 1.45, 1.45, 1.65, "#8f7150");
  box("b-ebox-top", -35.2, 27.6, 1.2, 1.2, 1.65, .85, "#596850", "wood", true);
  crate("b-pillar-box", -40.2, 22.2, 0, 1.4, 1.4, 1.55, "#947653");
  // B Site painted bomb target borders
  box("b-site-mark-n", -38, 27.6, 4.4, .16, .02, .02, "#b5482a", "stone", true);
  box("b-site-mark-s", -38, 22.4, 4.4, .16, .02, .02, "#b5482a", "stone", true);
  box("b-site-mark-w", -40.2, 25.0, .16, 5.2, .02, .02, "#b5482a", "stone", true);
  box("b-site-mark-e", -35.8, 25.0, .16, 5.2, .02, .02, "#b5482a", "stone", true);

  // B Site Central Green-Tarped Canopy Pergola (IMAGE 07, 09, 10)
  box("b-canopy", -38.2, 24.8, 5.6, 6.2, 4.1, .18, "#5d7356", "fabric", true);
  box("b-canopy-frame-n", -38.2, 27.8, 5.7, .22, 3.92, .2, "#6b543e", "wood", true);
  box("b-canopy-frame-s", -38.2, 21.8, 5.7, .22, 3.92, .2, "#6b543e", "wood", true);
  box("b-canopy-frame-w", -40.95, 24.8, .22, 6.2, 3.92, .2, "#6b543e", "wood", true);
  box("b-canopy-frame-e", -35.45, 24.8, .22, 6.2, 3.92, .2, "#6b543e", "wood", true);
  box("b-canopy-post", -40, 21.2, .18, .18, 0, 4.1, "#615444", "metal");
  for (const [px, pz] of [[-40.8, 27.6], [-35.5, 27.6], [-35.5, 22.0]] as const)
    box("b-canopy-support-" + px + "-" + pz, px, pz, .24, .24, 0, 4.1, "#7c654d", "wood", true);

  // B Bench & Red Corner Tarp (IMAGE 07, 09)
  crate("b-bench", -43.5, 28, 0, .9, 3, .58, "#b09678");
  box("b-bench-back", -44.2, 28, .35, 3.4, .58, .85, "#9e8364", "stone", true);
  box("b-bench-red-tarp", -43.2, 24.2, 2.8, 3.6, 3.8, .14, "#a6483c", "fabric", true);

  // Detailed B Apartments Delivery Van (IMAGE 07, 09)
  box("van", -42, 33, 2.3, 4.2, .25, 1.9, "#dcd8cc", "metal");
  box("van-cab-hood", -42, 30.45, 2.15, .95, .25, 1.15, "#dcd8cc", "metal");
  box("van-roof-rack", -42, 33.2, 2.05, 3.4, 2.15, .08, "#585c5e", "metal", true);
  box("van-windscreen", -42, 30.88, 1.88, .08, 1.35, .52, "#4a646c", "glass", true);
  box("van-grille", -42, 29.96, 1.65, .06, .48, .42, "#34383a", "metal", true);
  box("van-bumper", -42, 29.92, 2.25, .14, .28, .2, "#34383a", "metal", true);
  for (const x of [-43.05, -40.95]) for (const z of [30.8, 34.4])
    box("van-wheel-" + x + "-" + z, x, z, .4, .7, .02, .66, "#2e302d", "metal");

  // Market Interior Counter, Display Shelves & Striped Awning (IMAGE 07, 09)
  box("market-awning", -38, 19.6, 4.4, 1.5, 3.12, .16, "#9d483e", "fabric", true);
  box("market-counter", -43, 14.5, .9, 4, 0, 1.04, "#866b54", "wood");
  box("market-countertop", -43, 14.5, 1, 4.12, 1.04, .14, "#bc9c72", "wood");
  box("market-shelf-south", -38, 10.55, 5.2, .55, 0, 2.4, "#755b43", "wood", true);
  for (const x of [-40.4, -36.8, -33.6])
    box("market-joist-" + x, x, 14.5, .15, 8.8, 3.46, .24, "#79614c", "wood", true);
  for (const x of [-35, -28, -21, -14, -7, 0, 7])
    box("apps-joist-" + x, x, 35.5, .17, 7, 5.17, .24, "#876851", "wood", true);
  for (const z of [-13, -10, -7, -4])
    box("connector-joist-" + z, -1.5, z, 7, .18, 3.55, .26, "#866f57", "wood", true);

  // Palace Interior Columns, Bases & Capitals (IMAGE 05, 08)
  for (const x of [27, 34]) {
    box("palace-column-" + x, x, -47.5, .65, .65, 3, 3.1, "#d2b492", "stone");
    box("palace-column-foot-" + x, x, -47.5, .88, .88, 3, .26, "#a88b69", "stone", true);
    box("palace-column-cap-" + x, x, -47.5, .92, .92, 5.82, .26, "#e3c9a2", "stone", true);
  }
  for (const x of [25, 30, 35, 40])
    box("palace-ceiling-beam-" + x, x, -45.5, .22, 6.8, 5.85, .24, "#6e543b", "wood", true);

  // Site directional signs
  for (const [id, x, z, label] of [
    ["a", 10.5, -41.5, "BOMBSITE A · PALACE"],
    ["b", -43.5, 19.45, "BOMBSITE B · MARKET"],
    ["mid", 9.5, 9.6, "← B SHORT   A SITE →"],
  ] as const)
    solids.push({ id: "bolluca-sign-" + id, kind: "box", x, y: 3.6, z, w: 3.2, d: .12, h: .72,
      color: "#51413a", label, detail: true });

  return {
    id: "bolluca", name: "Bolluca", subtitle: "Palace, Mid ve Pazar", bounds: 54, sky: "#bfd8ec", floor: "#c7b79b", floorSurface: "stone",
    solids, routes, radarFootprint: rects, landmarks: Object.keys(blocks), bombSites: sites, targets: [], hazard: { x: 120, z: 120, r: 0 },
    spawns: [point(43, 5), point(46, 6), point(49, 8), point(43, 10), point(47, 12),
      point(-31, -40), point(-28, -41), point(-25, -38), point(-22, -41), point(-19, -39)],
  };
}
