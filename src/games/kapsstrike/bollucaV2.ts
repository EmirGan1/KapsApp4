import type { BombSite, MapDefinition, Solid, Vec3 } from "./types";
import { appendBollucaV2ArchitectureAndProps } from "./bollucaV2Props";

export type FootprintRect = readonly [west: number, east: number, south: number, north: number];
const point = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });

/**
 * North-up classic CS:GO Mirage (2019–2020 Competitive Edition) navigable footprint.
 * Every adjoining corridor shares an exact boundary edge so the perimeter facade generator
 * automatically seals the entire playable shell with zero out-of-bounds gaps.
 */
export const BOLLUCA_V2_BLOCKS: Record<string, FootprintRect> = {
  "T Spawn": [38, 52, -2, 16],
  "Side Alley": [13, 40, 8, 16],
  "House": [15, 23, 15, 28],
  "Back Alley": [6, 21, 26, 36],
  "B Apartments": [-43, 11, 33, 40],
  "Underpass": [-20, -14, 8, 34],
  "Top Mid": [10, 23, -1, 10],
  "Mid": [-25, 13, -1, 10],
  "Catwalk": [-26, 13, 10, 16],
  "B Short": [-32, -25, 12, 27],
  "B Site": [-47, -29, 19, 33],
  "Market": [-46, -33.5, 9, 19],
  "Market Alley": [-44, -36, -36, 10],
  "Sniper Alley": [-35, -30, -36, -16],
  "CT Spawn": [-44, -10, -47, -35],
  "Ticket": [-12, 11, -44, -36],
  "A Site": [6, 38, -44, -20],
  "Window": [-33, -25, 0, 8],
  "Ladder Room": [-31, -26.5, 8, 13],
  "Jungle": [-33, -25, -22, 0],
  "Stairs": [-26, 10, -25, -18],
  "Connector": [-6, 2, -20, 0],
  "A Ramp": [37, 50, -30, -20],
  "Palace Alley": [44, 52, -50, 0],
  "Palace": [17, 46, -51, -44],
};

export interface BollucaV2Callout {
  name: string;
  anchor: Vec3;
  bounds: readonly [west: number, east: number, south: number, north: number, minY?: number, maxY?: number];
  priority?: number;
}

export const BOLLUCA_V2_CALLOUTS: readonly BollucaV2Callout[] = [
  // Specific sub-positions (higher priority)
  { name: "Tetris", anchor: point(31.8, -25.8, 0), bounds: [29.8, 35.0, -28.0, -22.5], priority: 3 },
  { name: "Sandwich", anchor: point(28.0, -22.5, 0), bounds: [26.0, 29.8, -25.0, -20.0], priority: 3 },
  { name: "A Stairs", anchor: point(22.0, -24.5, 0.6), bounds: [17.5, 26.2, -27.2, -21.5], priority: 3 },
  { name: "A Default", anchor: point(24.0, -29.8, 1.2), bounds: [22.8, 27.0, -31.8, -27.5], priority: 3 },
  { name: "Triple Box", anchor: point(18.6, -33.8, 1.2), bounds: [16.5, 21.5, -35.8, -31.8], priority: 3 },
  { name: "Firebox", anchor: point(25.8, -34.5, 1.2), bounds: [24.2, 27.2, -36.0, -33.0], priority: 3 },
  { name: "Ninja", anchor: point(28.0, -35.0, 0.55), bounds: [27.0, 30.2, -37.2, -33.5], priority: 3 },
  { name: "Shadow", anchor: point(21.5, -41.5, 0), bounds: [16.5, 27.5, -44.0, -39.5, -0.5, 2.2], priority: 3 },
  { name: "Palace Balcony", anchor: point(23.0, -43.1, 3.0), bounds: [19.0, 27.0, -44.5, -41.5, 2.4, 5.5], priority: 4 },
  { name: "Ticket Booth", anchor: point(8.2, -39.5, 0), bounds: [5.0, 12.5, -44.0, -36.0], priority: 3 },
  { name: "Chair", anchor: point(6.0, 0.6, 0), bounds: [3.8, 8.6, -1.0, 2.4], priority: 3 },
  { name: "Mid Boxes", anchor: point(-2.5, 3.2, 0), bounds: [-5.5, 1.5, 0.5, 6.0], priority: 3 },
  { name: "Vent", anchor: point(-28.5, 8.0, 2.0), bounds: [-31.0, -26.5, 7.0, 9.2], priority: 3 },
  { name: "Van", anchor: point(-43.4, 30.5, 0), bounds: [-46.5, -41.0, 27.5, 33.0], priority: 3 },
  { name: "Bench", anchor: point(-45.2, 28.0, 0), bounds: [-47.0, -43.5, 25.0, 30.5], priority: 3 },
  { name: "Back Site", anchor: point(-44.8, 21.5, 0), bounds: [-47.0, -42.5, 19.0, 25.0], priority: 3 },
  { name: "B Default", anchor: point(-40.5, 25.8, 0.14), bounds: [-42.5, -38.5, 23.8, 28.0], priority: 3 },
  { name: "E-Box", anchor: point(-35.8, 27.8, 0.14), bounds: [-38.0, -34.0, 26.2, 30.2], priority: 3 },
  { name: "Market Window", anchor: point(-35.5, 19.0, 0.9), bounds: [-37.0, -33.5, 17.2, 20.8], priority: 3 },
  { name: "Market Door", anchor: point(-40.3, 19.0, 0), bounds: [-42.8, -38.0, 17.2, 20.8], priority: 3 },
  { name: "B Balcony", anchor: point(-38.5, 32.3, 2.4), bounds: [-42.0, -35.0, 31.2, 34.0, 1.8, 5.0], priority: 4 },
  // Primary Mirage regions
  { name: "T Spawn", anchor: point(45.0, 7.0, 0), bounds: BOLLUCA_V2_BLOCKS["T Spawn"], priority: 1 },
  { name: "T Ramp", anchor: point(46.0, -10.0, 0), bounds: [44, 52, -20, 0], priority: 2 },
  { name: "Side Alley", anchor: point(29.0, 12.0, 0), bounds: BOLLUCA_V2_BLOCKS["Side Alley"], priority: 1 },
  { name: "House", anchor: point(19.0, 21.5, 0), bounds: BOLLUCA_V2_BLOCKS["House"], priority: 1 },
  { name: "Back Alley", anchor: point(14.0, 31.0, 0), bounds: BOLLUCA_V2_BLOCKS["Back Alley"], priority: 1 },
  { name: "B Apartments", anchor: point(-16.0, 36.5, 2.4), bounds: [-43, 11, 33, 40, 1.6, 5.6], priority: 2 },
  { name: "Underpass", anchor: point(-17.0, 18.0, 0), bounds: [-20, -14, 8, 34, -0.5, 2.5], priority: 2 },
  { name: "Top Mid", anchor: point(16.5, 4.5, 0.6), bounds: BOLLUCA_V2_BLOCKS["Top Mid"], priority: 1 },
  { name: "Mid", anchor: point(-8.0, 4.5, 0), bounds: BOLLUCA_V2_BLOCKS["Mid"], priority: 1 },
  { name: "Catwalk", anchor: point(-10.0, 13.0, 1.6), bounds: [-26, 13, 10, 16, 0.1, 6.0], priority: 2 },
  { name: "B Short", anchor: point(-28.5, 20.5, 0), bounds: BOLLUCA_V2_BLOCKS["B Short"], priority: 1 },
  { name: "B Site", anchor: point(-39.0, 25.5, 0.14), bounds: BOLLUCA_V2_BLOCKS["B Site"], priority: 1 },
  { name: "Market", anchor: point(-39.5, 14.0, 0), bounds: BOLLUCA_V2_BLOCKS["Market"], priority: 1 },
  { name: "Market Alley", anchor: point(-40.0, -14.0, 0), bounds: BOLLUCA_V2_BLOCKS["Market Alley"], priority: 1 },
  { name: "Sniper Alley", anchor: point(-32.5, -26.0, 0), bounds: BOLLUCA_V2_BLOCKS["Sniper Alley"], priority: 1 },
  { name: "CT Spawn", anchor: point(-26.0, -41.0, 0), bounds: BOLLUCA_V2_BLOCKS["CT Spawn"], priority: 1 },
  { name: "Ticket", anchor: point(-2.0, -40.0, 0), bounds: BOLLUCA_V2_BLOCKS["Ticket"], priority: 1 },
  { name: "A Site", anchor: point(21.5, -31.5, 1.2), bounds: BOLLUCA_V2_BLOCKS["A Site"], priority: 1 },
  { name: "Window", anchor: point(-29.0, 4.0, 2.0), bounds: BOLLUCA_V2_BLOCKS["Window"], priority: 2 },
  { name: "Ladder Room", anchor: point(-28.5, 10.5, 1.0), bounds: BOLLUCA_V2_BLOCKS["Ladder Room"], priority: 2 },
  { name: "Jungle", anchor: point(-29.0, -11.0, 1.0), bounds: BOLLUCA_V2_BLOCKS["Jungle"], priority: 1 },
  { name: "Stairs", anchor: point(-8.0, -21.5, 0), bounds: BOLLUCA_V2_BLOCKS["Stairs"], priority: 1 },
  { name: "Connector", anchor: point(-2.0, -10.0, 1.2), bounds: BOLLUCA_V2_BLOCKS["Connector"], priority: 2 },
  { name: "A Ramp", anchor: point(43.0, -25.0, 0), bounds: BOLLUCA_V2_BLOCKS["A Ramp"], priority: 2 },
  { name: "Palace Alley", anchor: point(48.0, -34.0, 0), bounds: BOLLUCA_V2_BLOCKS["Palace Alley"], priority: 1 },
  { name: "Palace", anchor: point(30.0, -47.5, 3.0), bounds: BOLLUCA_V2_BLOCKS["Palace"], priority: 2 },
];

export function getBollucaV2Callout(x: number, y: number, z: number): string {
  let best: BollucaV2Callout | undefined;
  let bestPriority = -1;
  for (const c of BOLLUCA_V2_CALLOUTS) {
    const [w, e, s, n, minY, maxY] = c.bounds;
    if (x < w || x > e || z < s || z > n) continue;
    if (minY !== undefined && y < minY) continue;
    if (maxY !== undefined && y > maxY) continue;
    const p = c.priority ?? 1;
    if (p > bestPriority) {
      bestPriority = p;
      best = c;
    }
  }
  return best ? best.name : "Bolluca V2";
}

export const BOLLUCA_V2_SITES: readonly BombSite[] = [
  { id: "A", ...point(22.0, -31.5, 1.2), radius: 3.6 },
  { id: "B", ...point(-39.0, 25.5, 0.14), radius: 3.6 },
];

export const BOLLUCA_V2_ROUTES: { name: string; points: Vec3[] }[] = [
  {
    name: "T Spawn → A Ramp → A Site",
    points: [point(45, 7), point(47.5, -25), point(34.5, -25), point(34.5, -31.5), point(27.5, -31.5, 1.2), point(22, -31.5, 1.2)],
  },
  {
    name: "T Spawn → Palace → A Site",
    points: [point(45, 7), point(47.5, -47.5), point(37, -46.5, 3.0), point(23, -46.5, 3.0), point(23, -42.6, 3.0), point(22, -37.5, 0.6), point(22, -31.5, 1.2)],
  },
  {
    name: "T Spawn → Top Mid → Connector → A Site",
    points: [point(45, 11), point(20, 11), point(19.5, 5.5, 0.6), point(-2, 5.5), point(-2, -13, 1.2), point(-2, -21.5), point(15, -21.5), point(22, -22), point(22, -31.5, 1.2)],
  },
  {
    name: "T Spawn → Back Alley → B Apartments → B Site",
    points: [point(45, 11), point(20, 12), point(19, 32), point(18.5, 34.5), point(11, 34.5, 2.4), point(-14, 36, 2.4), point(-38.5, 36, 2.4), point(-38.5, 32.3, 2.4), point(-38.5, 25.5, 0.14)],
  },
  {
    name: "B Apartments → Underpass → Mid",
    points: [point(-17, 36, 2.4), point(-17, 24), point(-17, 13), point(-17, 5)],
  },
  {
    name: "Top Mid → Catwalk → B Short → B Site",
    points: [point(16, 6, 0.6), point(11, 13), point(-17, 13, 3.1), point(-27.5, 14), point(-28.5, 22), point(-36, 24.5, 0.14)],
  },
  {
    name: "CT Spawn → Market Door → B Site",
    points: [point(-31, -40), point(-40, -40), point(-40, 14), point(-40.3, 19), point(-39, 25.5, 0.14)],
  },
  {
    name: "CT Spawn → Ticket → A Site",
    points: [point(-24, -40), point(12, -39.5), point(21.5, -39.5), point(21.5, -31.5, 1.2)],
  },
  {
    name: "CT Spawn → Jungle → Window → Ladder Room → B Short",
    points: [point(-32.5, -40), point(-32.5, -19), point(-29, -19), point(-29, 4, 2.0), point(-28.5, 8.5, 2.0), point(-28.5, 14), point(-28.5, 22)],
  },
  {
    name: "A Site → Stairs → Jungle → Window",
    points: [point(22, -31.5, 1.2), point(22, -21.5), point(-24, -21.5), point(-29, -18), point(-29, 4, 2.0)],
  },
];

export function bollucaV2(): MapDefinition {
  const solids: Solid[] = [];

  const box = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail = false,
  ) => solids.push({ id: "bollucav2-" + id, kind: "box", x, y, z, w, h, d, color, surface, detail });

  const cyl = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail = false,
  ) => solids.push({ id: "bollucav2-" + id, kind: "box", shape: "cylinder", x, y, z, w, h, d, color, surface, detail });

  const cone = (
    id: string,
    x: number,
    z: number,
    diam: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail = false,
  ) => solids.push({ id: "bollucav2-" + id, kind: "box", shape: "cone", x, y, z, w: diam, h, d: diam, color, surface, detail });

  const ramp = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    axis: "x" | "z",
    reverse = false,
    color = "#cbb38f",
    surface: Solid["surface"] = "stone",
  ) => solids.push({ id: "bollucav2-slope-" + id, kind: "ramp", x, y, z, w, h, d, axis, reverse, color, surface });

  const deck = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    top: number,
    base = 0,
    color = "#cfb998",
    surface: Solid["surface"] = "stone",
  ) => box("deck-" + id, x, z, w, d, base, top - base, color, surface);

  const roof = (id: string, x: number, z: number, w: number, d: number, y: number) =>
    box("roof-" + id, x, z, w, d, y, 0.36, "#b49777", "wood");

  const steps = (id: string, x: number, z: number, w: number, run: number, height: number, base = 0) => {
    const count = Math.max(4, Math.ceil(height / 0.2));
    for (let i = 0; i < count; i++) {
      box(
        `step-${id}-${i}`,
        x,
        z + (run * (i + 0.5)) / count,
        w,
        Math.abs(run) / count + 0.02,
        base,
        ((i + 1) * height) / count,
        "#c0a988",
        "stone",
      );
    }
  };

  const sign = (
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    label: string,
  ) => solids.push({ id: "bollucav2-sign-" + id, kind: "box", x, y, z, w, h, d, color, label, detail: true });

  // ============================================================================
  // 0. SEALED MOROCCAN PERIMETER FACADES DERIVED DIRECTLY FROM BOLLUCA_V2_BLOCKS
  // ============================================================================
  const rects = Object.values(BOLLUCA_V2_BLOCKS);
  const cuts = (a: number, b: number) => [...new Set(rects.flatMap((r) => [r[a], r[b]]))].sort((u, v) => u - v);
  const xs = cuts(0, 1);
  const zs = cuts(2, 3);
  const inside = (x: number, z: number) => rects.some(([l, r, b, t]) => x > l && x < r && z > b && z < t);
  const plasterTones = ["#d9be99", "#cfab88", "#e4cfa9", "#c7a685", "#dcc29e"];
  let facadeIdx = 0;

  const buildPerimeterWalls = (alongX: boolean, fixed: number, segments: number[]) => {
    let start = 0;
    let face = 0;
    for (let i = 0; i < segments.length; i++) {
      const middle = (segments[i] + segments[i + 1]) / 2;
      const occupied = (offset: number) => (alongX ? inside(middle, fixed + offset) : inside(fixed + offset, middle));
      const next = i === segments.length - 1 ? 0 : Number(occupied(0.01)) - Number(occupied(-0.01));
      if (face === next) continue;
      if (face) {
        const end = segments[i];
        const count = Math.ceil((end - start) / 11);
        for (let part = 0; part < count; part++) {
          const width = (end - start) / count;
          const center = start + (part + 0.5) * width;
          const height = 6.2 + (facadeIdx % 4) * 0.85;
          const wx = alongX ? center : fixed;
          const wz = alongX ? fixed : center;
          // Semantic zone prefix so catalogMaterials routes regional plaster palettes accurately
          const zoneTag =
            wz < -18 && wx > 4
              ? "a-site"
              : wz > 18 && wx < -24
                ? "b-site"
                : wz > 8 && wz < 20 && wx < -32
                  ? "market"
                  : wx < -22 && wz > -20 && wz < 12
                    ? "window-jungle"
                    : wx > -8 && wx < 4 && wz > -21 && wz < 1
                      ? "connector"
                      : wz > 32
                        ? "apps"
                        : "mid";
          const id = `facade-${zoneTag}-${facadeIdx}`;
          const xy = (u: number, offset: number) =>
            alongX ? ([center + u, fixed + offset * face] as const) : ([fixed + offset * face, center + u] as const);
          const panel = (
            suffix: string,
            u: number,
            offset: number,
            size: number,
            depth: number,
            y: number,
            h: number,
            color: string,
            surface: Solid["surface"],
            detail = true,
          ) => box(id + suffix, ...xy(u, offset), alongX ? size : depth, alongX ? depth : size, y, h, color, surface, detail);

          panel("", 0, -0.34, width + 0.04, 0.68, 0, height, plasterTones[facadeIdx % plasterTones.length], "plaster", false);
          panel("-plinth", 0, 0.045, width, 0.09, 0, 0.96, "#ac967c", "stone");
          panel("-dado", 0, 0.06, width, 0.08, 0.96, 0.14, "#3a6674", "stone");
          panel("-cornice", 0, 0.11, width, 0.22, height - 0.28, 0.28, "#f0d8bc", "stone");
          panel("-trim", 0, 0.08, width, 0.16, height - 0.64, 0.12, "#bc9472", "stone");

          if (width > 4.2) {
            const shutterTone = facadeIdx % 3 === 0 ? "#3d6b69" : facadeIdx % 3 === 1 ? "#5c453a" : "#3a5a75";
            for (const u of [-width * 0.24, width * 0.24]) {
              panel(`-frame-${u.toFixed(1)}`, u, 0.045, 1.3, 0.08, 3.05, 1.5, "#e8d2b0", "stone");
              panel(`-shutter-${u.toFixed(1)}`, u, 0.11, 1.08, 0.1, 3.15, 1.24, shutterTone, "wood");
              panel(`-sill-${u.toFixed(1)}`, u, 0.17, 1.5, 0.32, 2.96, 0.14, "#cfb99a", "stone");
              panel(`-header-${u.toFixed(1)}`, u, 0.09, 1.46, 0.18, 4.46, 0.16, "#edd6b6", "stone");
            }
            if (facadeIdx % 3 === 0) {
              panel("-balcony", 0, 0.32, 2.8, 0.64, 2.74, 0.16, "#c2ac8e", "stone");
              panel("-rail", 0, 0.6, 2.8, 0.08, 3.56, 0.1, "#433d37", "metal");
              for (let j = -2; j <= 2; j++) {
                panel(`-baluster-${j}`, j * 0.52, 0.6, 0.055, 0.06, 2.9, 0.68, "#433d37", "metal");
              }
            } else {
              panel("-doorframe", 0, 0.07, 1.4, 0.12, 0.02, 2.2, "#e2c8a6", "stone");
              panel("-door", 0, 0.135, 1.14, 0.08, 0.06, 2.0, shutterTone, "wood");
            }
          }
          facadeIdx++;
        }
      }
      start = segments[i];
      face = next;
    }
  };
  for (const z of zs) buildPerimeterWalls(true, z, xs);
  for (const x of xs) buildPerimeterWalls(false, x, zs);

  // ============================================================================
  // 1. MULTI-TIER WALKABLE DECKS, RAMPS, STAIRCASES & INTERIOR PARTITIONS
  // ============================================================================

  // --- A SITE PLATFORM (y = 1.2m), A RAMP, TICKET RAMP & A STAIRS ---
  deck("a-platform", 21.5, -31.5, 11.0, 9.0, 1.2, 0, "#d2bc9a", "stone");
  ramp("a-ramp", 30.0, -31.5, 6.0, 7.0, 0, 1.2, "x", true);
  ramp("ticket-ramp", 21.5, -38.0, 11.0, 4.0, 0, 1.2, "z", false);
  steps("a-stairs", 22.0, -22.5, 8.0, -4.5, 1.2);

  // --- PALACE (y = 3.0m) & PALACE BALCONY OVERLOOKING A SITE ---
  ramp("palace-entry", 41.5, -47.5, 7.0, 7.0, 0, 3.0, "x", true);
  deck("palace-hall", 27.5, -47.5, 21.0, 7.0, 3.0, 0, "#cfb592", "stone");
  deck("palace-balcony", 23.0, -43.1, 7.2, 1.8, 3.0, 2.72, "#d2b894", "stone");
  roof("palace", 31.5, -47.5, 29.0, 7.0, 6.2);
  // Palace front wall at z = -44 separating Palace from A Site, leaving x=19.5..26.5 Balcony Portico open!
  box("palace-front-west", 18.25, -44.0, 2.5, 0.72, 0, 6.2, "#d8b895", "plaster");
  box("palace-front-east", 36.25, -44.0, 19.5, 0.72, 0, 6.2, "#d8b895", "plaster");
  // Under-balcony threshold slab (leaves 2.72m standing clearance below for Shadow!)
  deck("palace-threshold", 23.0, -44.0, 7.2, 0.74, 3.0, 2.72, "#cfb592", "stone");

  // --- CONNECTOR (Mid y=0 -> Upper Connector y=1.2 -> Stairs y=0) ---
  steps("connector-north", -2.0, -4.5, 8.0, -6.0, 1.2);
  deck("connector-landing", -2.0, -13.5, 8.0, 6.0, 1.2, 0, "#cbb594", "stone");
  steps("connector-south", -2.0, -20.0, 8.0, 3.5, 1.2);
  roof("connector", -2.0, -9.5, 8.0, 14.0, 4.0);

  // --- JUNGLE -> WINDOW / SNIPER'S NEST (y = 2.0m) -> VENT -> LADDER ROOM -> B SHORT ---
  ramp("jungle-slope", -29.0, -9.5, 8.0, 11.0, 0, 2.0, "z", false);
  deck("window-floor", -29.0, 4.0, 8.0, 8.0, 2.0, 0, "#c8b292", "stone");
  deck("jungle-landing", -29.0, -2.0, 8.0, 4.0, 2.0, 0, "#c8b292", "stone");
  roof("window-room", -29.0, 4.0, 8.0, 8.0, 5.4);
  // Sniper Window Wall at x = -25 (between Window Room y=2.0 and Mid y=0.0)
  box("window-pier-south", -25.0, 0.9, 0.48, 1.8, 0, 5.4, "#c5b194", "plaster");
  box("window-pier-north", -25.0, 7.1, 0.48, 1.8, 0, 5.4, "#c5b194", "plaster");
  box("window-sill", -25.0, 4.0, 0.44, 4.4, 0, 2.84, "#b89f80", "stone");
  box("window-sill-ledge", -24.95, 4.0, 0.58, 4.5, 2.74, 0.14, "#dac5a6", "stone", true);
  box("window-header", -25.0, 4.0, 0.48, 4.4, 4.88, 0.56, "#cbb596", "stone");
  // Ladder Room & Vent (z = 8..13, x = -31..-26.5)
  ramp("ladder-room-slope", -28.75, 10.5, 4.5, 5.0, 0, 2.0, "z", true);
  roof("ladder-room", -28.75, 10.5, 4.5, 5.0, 5.2);
  // Wall closing gap between Window north edge (x=-33..-31 and x=-26.5..-25)
  box("window-north-wall-w", -32.0, 8.0, 2.0, 0.5, 0, 5.4, "#c4ae8f", "plaster");
  box("window-north-wall-e", -25.75, 8.0, 1.5, 0.5, 0, 5.4, "#c4ae8f", "plaster");

  // --- TOP MID (y = 0.6m elevated terrace) -> MID (y = 0.0m) ---
  deck("top-mid-terrace", 16.5, 4.0, 11.0, 10.0, 0.6, 0, "#d0b894", "stone");
  ramp("top-mid-west-ramp", 9.5, 4.0, 3.0, 10.0, 0, 0.6, "x", false);
  ramp("top-mid-north-ramp", 16.5, 10.25, 11.0, 2.5, 0, 0.6, "z", true);
  box("top-mid-nw-chamfer", 10.3, 9.6, 1.4, 1.2, 0, 0.30, "#cbb38f", "stone");

  // --- CATWALK BRIDGE OVER UNDERPASS (y = 3.1m) & MID PARAPET ---
  deck("catwalk-bridge", -17.0, 13.0, 6.0, 6.0, 3.1, 2.78, "#cbb492", "stone");
  ramp("catwalk-east-ramp", -8.5, 13.0, 11.0, 6.0, 0, 3.1, "x", true);
  ramp("catwalk-west-ramp", -23.0, 13.0, 6.0, 6.0, 0, 3.1, "x", false);
  // Iconic low stone Mid-Catwalk parapet (with Top Mid opening x=7..13 & Mid jump gap)
  box("mid-parapet-west", -22.8, 10.0, 5.6, 0.38, 0, 1.02, "#c4a886", "stone");
  box("mid-parapet-east", -3.0, 10.0, 21.8, 0.38, 0, 1.02, "#c4a886", "stone");
  box("mid-parapet-coping-w", -22.8, 10.0, 5.7, 0.48, 1.02, 0.1, "#e2d1b7", "stone", true);
  box("mid-parapet-coping-e", -3.0, 10.0, 21.9, 0.48, 1.02, 0.1, "#e2d1b7", "stone", true);

  // --- UNDERPASS (y = 0.0m under Catwalk Bridge, rising smoothly to B Apartments y = 2.4m) ---
  roof("underpass-low", -17.0, 20.0, 6.0, 8.2, 2.82);
  ramp("underpass-stairs", -17.0, 28.5, 6.0, 9.0, 0, 2.4, "z", false);
  roof("underpass-high", -17.0, 28.5, 6.0, 9.2, 5.6);

  // --- B APARTMENTS (y = 2.4m) & B BALCONY OVERLOOKING B SITE ---
  ramp("apps-entry-ramp", 14.5, 34.5, 7.0, 3.0, 0, 2.4, "x", true);
  deck("apps-west", -30.5, 36.5, 25.0, 7.0, 2.4, 0, "#cab28f", "stone");
  deck("apps-east", -3.5, 36.5, 29.0, 7.0, 2.4, 0, "#cab28f", "stone");
  deck("apps-balcony", -38.5, 32.3, 6.2, 1.4, 2.4, 2.16, "#cdb592", "stone");
  roof("apps-west", -28.0, 36.5, 30.0, 7.0, 5.6);
  roof("apps-east", 0.5, 36.5, 21.0, 7.0, 5.6);
  // Apartments south wall at z = 33 (opening at x=-41.5..-35.5 for Balcony; arched window at x=-34..-31.5)
  box("apps-front-west", -42.25, 33.0, 1.5, 0.54, 0, 5.6, "#c9a08a", "plaster");
  box("apps-front-mid-pier", -34.75, 33.0, 1.5, 0.54, 0, 5.6, "#c9a08a", "plaster");
  box("apps-front-east-pier", -30.25, 33.0, 2.5, 0.54, 0, 5.6, "#c9a08a", "plaster");
  box("apps-balcony-header", -38.5, 33.0, 6.2, 0.54, 4.95, 0.65, "#c9a08a", "plaster");
  box("apps-window-sill", -32.75, 33.0, 2.5, 0.54, 0, 3.25, "#c9a08a", "plaster");
  box("apps-window-header", -32.75, 33.0, 2.5, 0.54, 4.95, 0.65, "#c9a08a", "plaster");

  // --- MARKET (KITCHEN / SHOP): WALKABLE MARKET DOOR + JUMPABLE/SIGHTLINE MARKET WINDOW ---
  roof("market", -39.75, 14.0, 12.5, 10.0, 3.85);
  box("market-parapet", -39.75, 19.1, 12.7, 0.32, 3.85, 0.62, "#dcc2a0", "stone", true);
  // North Market Wall at z = 19 (Market Door x=-42.1..-38.5; Market Window x=-36.6..-34.4)
  box("market-wall-west", -44.05, 19.0, 3.9, 0.66, 0, 4.1, "#b4a78a", "plaster");
  box("market-wall-mid", -37.55, 19.0, 1.9, 0.66, 0, 4.1, "#b4a78a", "plaster");
  box("market-window-sill", -35.5, 19.0, 2.2, 0.66, 0, 0.78, "#b29a79", "stone");
  box("market-window-step", -35.5, 18.2, 2.0, 0.72, 0, 0.30, "#9e8769", "stone");
  box("market-window-header", -35.5, 19.0, 2.2, 0.66, 2.95, 1.15, "#b4a78a", "plaster");
  box("market-wall-east", -33.95, 19.0, 0.9, 0.66, 0, 4.1, "#b4a78a", "plaster");

  // ============================================================================
  // 2. ARCHITECTURAL ARCHES, TACTICAL COVER, VAN, CANOPY, SKYLINE & MARKERS
  // ============================================================================
  appendBollucaV2ArchitectureAndProps({ box, cyl, cone, sign });

  return {
    id: "bollucav2",
    name: "Bolluca V2 · Mirage",
    subtitle: "CS:GO Mirage · A Site, Mid, Window ve B Market",
    bounds: 58,
    sky: "#bdd8ee",
    floor: "#cbb99b",
    floorSurface: "stone",
    solids,
    routes: BOLLUCA_V2_ROUTES,
    radarFootprint: rects,
    landmarks: Object.keys(BOLLUCA_V2_BLOCKS),
    bombSites: BOLLUCA_V2_SITES,
    targets: [],
    hazard: { x: 120, z: 120, r: 0 },
    spawns: [
      // 5 T Spawns (well-spaced inside T Spawn [38..52, -2..16])
      point(42, 3),
      point(46, 4),
      point(49, 7),
      point(43, 10),
      point(48, 12),
      // 5 CT Spawns (well-spaced inside CT Spawn [-44..-10, -47..-35])
      point(-33, -41),
      point(-29, -43),
      point(-25, -40),
      point(-21, -43),
      point(-17, -40),
    ],
  };
}
