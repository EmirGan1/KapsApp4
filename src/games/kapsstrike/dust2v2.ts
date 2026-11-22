import type { BombSite, MapDefinition, Solid, Vec3 } from "./types";

export type Footprint = readonly [west: number, east: number, south: number, north: number];

export interface Dust2Callout {
  name: string;
  bounds: Footprint;
  minY?: number;
  maxY?: number;
  anchor: Vec3;
}

const pt = (x: number, z: number, y = 0): Vec3 => ({ x, y, z });

/**
 * Calibrated CS:GO 2017 de_dust2 horizontal footprint (North-up: +Z = North, +X = East).
 * Coordinates are calibrated proportions for KapsStrike's 120 Hz capsule physics
 * (radius 0.32m, standing 1.8m, step 0.32m, max jump ~1.40m) — not a claim of Valve .bsp parity.
 *
 * Elevation tiers (all >= 0 for native support() compatibility):
 * - Sunken / Lowest Tier (y = 0.0m): Pit basin, Lower Tunnels, Mid Lower, Mid Doors, CT Mid, CT Spawn, Under A
 * - Main Ground Tier (y = 1.2m–1.8m): A Cross (1.2), Outside Long / Long Doors / Blue / Long Corner / A Long / Pit Plat (1.6), Top Mid / Catwalk (1.8)
 * - Upper-Mid Tier (y = 2.4m–2.8m): Outside Tunnels / Upper Tunnels / B Tunnels / B Site Courtyard (2.4), T Spawn / T Plat (2.8)
 * - High Tier (y = 3.2m): A Site Platform, A Short, B Plat / Back Plat
 */
export const DUST2_V2_BLOCKS: Record<string, Footprint> = {
  // South — T Spawn & exits
  "T Spawn": [-22, 14, -52, -40],
  "T Plat": [-42, -22, -48, -36],
  "T Ramp": [-42, -30, -36, -24],
  "Outside Tunnels": [-46, -26, -24, -10],
  "Suicide": [-3.5, 3.5, -40, -24],
  "T East Corridor": [14, 30, -48, -38],
  "Outside Long": [16, 34, -38, -22],
  "Top Mid to Long": [12, 22, -24, -16],

  // Center — Top Mid, Mid, Catwalk, Short, Mid Doors, CT Mid, CT Spawn, Under A
  "Top Mid": [-8, 14, -24, -10],
  "Mid": [-6, 8, -10, 16],
  "Catwalk": [8, 12.5, -10, 14],
  "Short Stairs": [8, 14, 14, 22],
  "A Short Landing": [8, 14, 22, 28],
  "A Short Bridge": [14, 26, 22, 28],
  "A Short": [22, 26, 28, 36],
  "Mid Doors": [-4, 6, 16, 20],
  "CT Mid": [-20, 8, 20, 32],
  "CT Spawn": [8, 22, 28, 34],
  "Under A": [14, 26, 22, 28],
  "CT Ramp": [26, 36, 22, 32],

  // East — Long Doors, Blue, Long Corner, Pit, A Long, Car, A Cross, A Ramp, A Site
  "Long Doors": [26, 36, -22, -12],
  "Long Corner": [36, 52, -22, -6],
  "Pit": [38, 52, -36, -22],
  "A Long": [38, 52, -6, 22],
  "A Cross": [36, 52, 22, 32],
  "A Ramp": [40, 52, 32, 40],
  "A Site": [26, 52, 32, 48],

  // West — Upper Tunnels, Tunnel Stairs, Lower Tunnels, B Tunnels, B Doors, B Window, B Site
  "Upper Tunnels": [-46, -26, -10, 12],
  "Tunnel Stairs": [-26, -16, 4, 10],
  "Lower Tunnels": [-16, -6, 4, 10],
  "B Tunnels": [-46, -38, 12, 28],
  "B Doors Approach": [-26, -20, 28, 34],
  "B Window Yard": [-20, -10, 32, 42],
  "B Window Approach": [-26, -20, 36, 42],
  "B Site": [-48, -26, 28, 48],
};

/** Authentic CS:GO Dust II tactical callouts for HUD display, minimap & validation. */
export const DUST2_V2_CALLOUTS: readonly Dust2Callout[] = [
  // T Spawn & South
  { name: "T Spawn", bounds: [-22, 14, -52, -40], anchor: pt(-2, -46, 2.8) },
  { name: "T Plat", bounds: [-42, -22, -48, -36], anchor: pt(-32, -42, 2.8) },
  { name: "T Ramp", bounds: [-42, -30, -36, -24], anchor: pt(-36, -30, 2.6) },
  { name: "Suicide", bounds: [-3.5, 3.5, -40, -24], anchor: pt(0, -32, 2.3) },
  { name: "Outside Tunnels", bounds: [-46, -26, -24, -10], anchor: pt(-36, -17, 2.4) },
  { name: "Outside Long", bounds: [14, 34, -48, -22], anchor: pt(25, -30, 1.6) },

  // Long A & Pit
  { name: "Long Doors", bounds: [26, 36, -22, -12], anchor: pt(31, -17, 1.6) },
  { name: "Blue", bounds: [36, 43, -14, -6], anchor: pt(41, -10, 1.6) },
  { name: "Long Corner", bounds: [36, 52, -22, -14], anchor: pt(44, -17, 1.6) },
  { name: "Side Pit", bounds: [38, 41.2, -34, -22], anchor: pt(39.6, -28, 0.8) },
  { name: "Pit Plat", bounds: [49, 52, -36, -22], anchor: pt(50.5, -28, 1.6) },
  { name: "Pit", bounds: [41.2, 49, -36, -22], anchor: pt(45, -30, 0) },
  { name: "Car", bounds: [46, 52, 7, 16], anchor: pt(47.5, 11.5, 1.6) },
  { name: "A Long", bounds: [38, 52, -6, 22], anchor: pt(44, 6, 1.6) },
  { name: "A Cross", bounds: [36, 52, 22, 32], anchor: pt(44, 26, 1.2) },
  { name: "A Ramp", bounds: [40, 52, 32, 40], anchor: pt(46, 36, 2.2) },

  // A Site
  { name: "Goose", bounds: [42, 52, 41, 48], minY: 2.6, anchor: pt(46.5, 44.5, 3.2) },
  { name: "Quad", bounds: [27, 32.5, 38.5, 44.5], minY: 2.6, anchor: pt(30, 41.5, 3.2) },
  { name: "Ninja", bounds: [26, 30, 44.5, 48], minY: 2.6, anchor: pt(28, 46, 3.2) },
  { name: "A Default", bounds: [32.5, 40, 35, 43], minY: 2.6, anchor: pt(35.5, 39, 3.2) },
  { name: "Barrels", bounds: [41, 47, 42, 47], minY: 2.6, anchor: pt(44, 44.5, 3.2) },
  { name: "A Site", bounds: [26, 52, 32, 48], minY: 2.6, anchor: pt(35.5, 39, 3.2) },
  { name: "Elevator", bounds: [26, 31, 28.5, 32], maxY: 2.5, anchor: pt(28, 30, 0.2) },

  // Mid, Catwalk, Short, CT Spawn
  { name: "Top Mid", bounds: [-8, 16, -24, -10], anchor: pt(2, -16, 1.8) },
  { name: "Xbox", bounds: [5.0, 8.0, 3.0, 7.0], anchor: pt(6.6, 5.0, 1.1) },
  { name: "Catwalk", bounds: [8, 12.5, -10, 14], minY: 1.4, anchor: pt(10.2, 4, 1.8) },
  { name: "Short Stairs", bounds: [8, 14, 14, 22], minY: 1.4, anchor: pt(10.8, 18, 2.5) },
  { name: "A Short", bounds: [8, 26, 22, 36], minY: 2.6, anchor: pt(19, 26, 3.2) },
  { name: "Mid", bounds: [-6, 8, -10, 16], anchor: pt(0, 4, 0) },
  { name: "Mid Doors", bounds: [-4, 6, 16, 20], anchor: pt(0, 18, 0) },
  { name: "B Boxes", bounds: [-17, -12, 25, 31], maxY: 2.5, anchor: pt(-14.5, 27.5, 0) },
  { name: "CT Mid", bounds: [-20, 8, 20, 32], maxY: 2.5, anchor: pt(-6, 26, 0) },
  { name: "Under A", bounds: [14, 26, 22, 28], maxY: 2.5, anchor: pt(20, 25, 0) },
  { name: "CT Ramp", bounds: [26, 36, 22, 32], maxY: 2.5, anchor: pt(31, 26, 0.6) },
  { name: "CT Spawn", bounds: [8, 22, 28, 34], maxY: 2.5, anchor: pt(14, 31, 0) },

  // Tunnels
  { name: "Upper Tunnels", bounds: [-46, -26, -10, 12], anchor: pt(-36, 2, 2.4) },
  { name: "Tunnel Stairs", bounds: [-26, -16, 4, 10], anchor: pt(-21, 7, 1.2) },
  { name: "Lower Tunnels", bounds: [-16, -6, 4, 10], anchor: pt(-11, 7, 0) },
  { name: "B Tunnels", bounds: [-46, -38, 12, 28], anchor: pt(-42, 20, 2.4) },

  // B Site
  { name: "B Doors", bounds: [-28, -20, 28, 34], anchor: pt(-25.5, 31.5, 2.2) },
  { name: "B Window", bounds: [-28, -14, 36, 42], anchor: pt(-24, 38.7, 2.4) },
  { name: "Close Left", bounds: [-48, -44, 28, 34], anchor: pt(-46.2, 30.8, 2.4) },
  { name: "B Car", bounds: [-38, -31, 28, 32], anchor: pt(-34.5, 31.5, 2.4) },
  { name: "Closet", bounds: [-31, -26.5, 28, 31], anchor: pt(-29, 29.3, 2.4) },
  { name: "Fence / Dog", bounds: [-48, -44, 34, 40], anchor: pt(-46, 37, 2.4) },
  { name: "Back Plat", bounds: [-48, -38, 43, 48], minY: 2.8, anchor: pt(-44, 45.5, 3.2) },
  { name: "B Plat", bounds: [-48, -36, 40, 48], minY: 2.8, anchor: pt(-41, 43, 3.2) },
  { name: "Back Site", bounds: [-36, -27, 43.5, 48], anchor: pt(-31.5, 45.8, 2.4) },
  { name: "Double Stack", bounds: [-36.5, -32, 39, 43], anchor: pt(-34.5, 41, 2.4) },
  { name: "Big Box", bounds: [-35, -30.5, 33, 37], anchor: pt(-32.8, 35, 2.4) },
  { name: "B Default", bounds: [-38, -32, 35.5, 40.5], anchor: pt(-35.2, 37.5, 2.4) },
  { name: "B Site", bounds: [-48, -26, 28, 48], anchor: pt(-35.2, 37.5, 2.4) },
];

export function getDust2V2Callout(x: number, y: number, z: number): string {
  for (const c of DUST2_V2_CALLOUTS) {
    const [w, e, s, n] = c.bounds;
    if (x < w || x > e || z < s || z > n) continue;
    if (c.minY !== undefined && y < c.minY) continue;
    if (c.maxY !== undefined && y > c.maxY) continue;
    return c.name;
  }
  return "Dust II V2";
}

export const DUST2_V2_SITES: readonly BombSite[] = [
  // Strictly scoped to elevated A Site platform (y = 3.2m), never leaking onto A Ramp/Long/Short/CT
  { id: "A", x: 35.5, y: 3.2, z: 39.0, radius: 3.8 },
  // Strictly scoped to B Site courtyard (y = 2.4m), never leaking into B Tunnels/B Doors/B Window
  { id: "B", x: -35.2, y: 2.4, z: 37.5, radius: 3.8 },
] as const;

const CORE_ROUTES: { name: string; points: Vec3[] }[] = [
  {
    name: "T Spawn → Long A → A Site",
    points: [
      pt(-2, -46, 2.8), pt(12, -44, 2.8), pt(26, -42, 1.6), pt(30, -28, 1.6),
      pt(31, -20, 1.6), pt(31, -16, 1.6), pt(44, -16, 1.6), pt(44, 8, 1.6),
      pt(44, 26, 1.2), pt(46, 32, 1.2), pt(46, 43.2, 3.2), pt(35.5, 43.2, 3.2), pt(35.5, 39, 3.2),
    ],
  },
  {
    name: "T Spawn → Catwalk → Short → A Site",
    points: [
      pt(0, -46, 2.8), pt(0, -32, 2.3), pt(0, -16, 1.8), pt(10.2, -14, 1.8),
      pt(10.2, 13, 1.8), pt(10.8, 24, 3.2), pt(24, 26, 3.2), pt(24, 34, 3.2),
      pt(35.5, 39, 3.2),
    ],
  },
  {
    name: "T Spawn → Upper Tunnels → B Site",
    points: [
      pt(-14, -45, 2.8), pt(-36, -42, 2.8), pt(-36, -22, 2.4), pt(-36, -12, 2.4),
      pt(-36, -2, 2.4), pt(-42, 8, 2.4), pt(-42, 26, 2.4), pt(-42, 33, 2.4),
      pt(-38.5, 34.5, 2.4), pt(-35.2, 37.5, 2.4),
    ],
  },
  {
    name: "CT Spawn → Under A → A Site",
    points: [
      pt(14, 31, 0), pt(18, 29, 0), pt(18, 25, 0), pt(28, 25, 0.2),
      pt(44, 26, 1.2), pt(46, 32, 1.2), pt(46, 43.2, 3.2), pt(35.5, 43.2, 3.2), pt(35.5, 39, 3.2),
    ],
  },
  {
    name: "CT Spawn → CT Mid → B Doors → B Site",
    points: [
      pt(14, 31, 0), pt(4, 30, 0), pt(-14, 30, 0), pt(-17.5, 31.5, 0),
      pt(-27.5, 31.5, 2.4), pt(-29.5, 36.5, 2.4), pt(-35.2, 37.5, 2.4),
    ],
  },
  {
    name: "Upper Tunnels → Lower Tunnels → Mid → CT Mid",
    points: [
      pt(-36, 7, 2.4), pt(-27, 7, 2.4), pt(-15, 7, 0), pt(-7, 7, 0),
      pt(0, 7, 0), pt(0, 18, 0), pt(0, 26, 0),
    ],
  },
];

export function dust2V2(): MapDefinition {
  const solids: Solid[] = [];
  let seq = 0;

  const box = (
    name: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail = false,
    extra?: Partial<Solid>
  ) => {
    const s: Solid = {
      id: `dust2v2-${name}-${seq++}`,
      kind: "box",
      x,
      y,
      z,
      w,
      h,
      d,
      color,
      surface,
      detail,
      ...extra,
    };
    solids.push(s);
    return s;
  };

  const ramp = (
    name: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    axis: "x" | "z",
    reverse = false,
    color = "#ccb795",
    surface: Solid["surface"] = "stone"
  ) => {
    const s: Solid = {
      id: `dust2v2-slope-${name}-${seq++}`,
      kind: "ramp",
      x,
      y,
      z,
      w,
      h,
      d,
      axis,
      reverse,
      color,
      surface,
    };
    solids.push(s);
    return s;
  };

  const deck = (
    name: string,
    west: number,
    east: number,
    south: number,
    north: number,
    top: number,
    base = 0,
    color = "#cbb898",
    surface: Solid["surface"] = "stone"
  ) =>
    box(
      `deck-${name}`,
      (west + east) / 2,
      (south + north) / 2,
      east - west,
      north - south,
      base,
      top - base,
      color,
      surface
    );

  const roof = (
    name: string,
    west: number,
    east: number,
    south: number,
    north: number,
    y: number,
    thickness = 0.36,
    color = "#a99375"
  ) =>
    box(
      `roof-${name}`,
      (west + east) / 2,
      (south + north) / 2,
      east - west,
      north - south,
      y,
      thickness,
      color,
      "plaster"
    );

  const addCrate = (
    tag: string,
    x: number,
    z: number,
    y: number,
    w: number,
    d: number,
    h: number,
    tone = "#957652",
    metalBands = true
  ) => {
    box(`crate-${tag}`, x, z, w, d, y, h, tone, "wood");
    box(`crate-lid-${tag}`, x, z, w + 0.06, d + 0.06, y + h, 0.055, "#7d6142", "wood", true);
    if (metalBands) {
      box(`crate-band-t-${tag}`, x, z, w + 0.045, d + 0.045, y + h * 0.76, 0.06, "#494f53", "metal", true);
      box(`crate-band-b-${tag}`, x, z, w + 0.045, d + 0.045, y + h * 0.22, 0.06, "#494f53", "metal", true);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        box(
          `crate-post-${tag}`,
          x + sx * (w / 2 + 0.012),
          z + sz * (d / 2 + 0.012),
          0.075,
          0.075,
          y,
          h,
          "#775c3e",
          "wood",
          true
        );
      }
    }
  };

  const addSedan = (
    tag: string,
    x: number,
    z: number,
    y: number,
    bodyColor: string,
    axis: "x" | "z"
  ) => {
    const alongZ = axis === "z";
    const w = alongZ ? 1.85 : 3.85;
    const d = alongZ ? 3.85 : 1.85;
    // Tight collision hull matching actual chassis silhouette (not an oversized invisible block)
    box(`${tag}-car-chassis`, x, z, w, d, y + 0.22, 0.68, bodyColor, "metal");
    box(
      `${tag}-car-cabin`,
      x + (alongZ ? 0 : -0.18),
      z + (alongZ ? -0.18 : 0),
      alongZ ? 1.58 : 2.0,
      alongZ ? 2.0 : 1.58,
      y + 0.9,
      0.58,
      bodyColor,
      "metal"
    );
    box(
      `${tag}-car-roof`,
      x + (alongZ ? 0 : -0.18),
      z + (alongZ ? -0.18 : 0),
      alongZ ? 1.48 : 1.72,
      alongZ ? 1.72 : 1.48,
      y + 1.48,
      0.08,
      "#e5dfd3",
      "metal",
      true
    );
    box(
      `${tag}-car-windshield`,
      x + (alongZ ? 0 : 0.82),
      z + (alongZ ? 0.82 : 0),
      alongZ ? 1.44 : 0.14,
      alongZ ? 0.14 : 1.44,
      y + 0.94,
      0.48,
      "#47616d",
      "glass",
      true
    );
    box(
      `${tag}-car-rear-glass`,
      x + (alongZ ? 0 : -1.16),
      z + (alongZ ? -1.16 : 0),
      alongZ ? 1.42 : 0.14,
      alongZ ? 0.14 : 1.42,
      y + 0.94,
      0.44,
      "#47616d",
      "glass",
      true
    );
    box(
      `${tag}-car-bumper-f`,
      x + (alongZ ? 0 : 1.96),
      z + (alongZ ? 1.96 : 0),
      alongZ ? 1.88 : 0.18,
      alongZ ? 0.18 : 1.88,
      y + 0.24,
      0.24,
      "#363b3e",
      "metal",
      true
    );
    box(
      `${tag}-car-bumper-r`,
      x + (alongZ ? 0 : -1.96),
      z + (alongZ ? -1.96 : 0),
      alongZ ? 1.88 : 0.18,
      alongZ ? 0.18 : 1.88,
      y + 0.24,
      0.24,
      "#363b3e",
      "metal",
      true
    );
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wx = x + (alongZ ? sx * 0.9 : sz * 1.25);
        const wz = z + (alongZ ? sz * 1.25 : sx * 0.9);
        box(`${tag}-wheel`, wx, wz, 0.36, 0.62, y, 0.62, "#25282b", "metal", true, {
          shape: "cylinder",
        });
      }
    }
  };

  const addBarrel = (tag: string, x: number, z: number, y: number, color = "#6f8484") =>
    box(`barrel-${tag}`, x, z, 0.56, 0.56, y, 0.94, color, "metal", false, {
      shape: "cylinder",
    });

  const addArchX = (
    tag: string,
    x: number,
    z: number,
    spanW: number,
    clearH: number,
    baseY: number,
    depth = 0.72,
    lintelTop = baseY + clearH + 1.4
  ) => {
    for (const side of [-1, 1]) {
      box(`${tag}-pier`, x + (side * (spanW / 2 + 0.32)), z, 0.64, depth, baseY, clearH + 0.4, "#b8a07d", "stone");
      for (let i = 0; i < 4; i++) {
        box(
          `${tag}-arch-stone`,
          x + side * (spanW / 2 - 0.15 - i * 0.34),
          z,
          0.38,
          depth + 0.06,
          baseY + clearH - 0.32 + i * 0.11,
          0.42 - i * 0.06,
          "#d3be9c",
          "stone",
          true
        );
      }
    }
    box(
      `${tag}-entry-lintel`,
      x,
      z,
      spanW + 1.28,
      depth,
      baseY + clearH,
      Math.max(0.45, lintelTop - (baseY + clearH)),
      "#cbb694",
      "stone"
    );
  };

  const addArchZ = (
    tag: string,
    x: number,
    z: number,
    spanD: number,
    clearH: number,
    baseY: number,
    depth = 0.72,
    lintelTop = baseY + clearH + 1.4
  ) => {
    for (const side of [-1, 1]) {
      box(`${tag}-pier`, x, z + side * (spanD / 2 + 0.32), depth, 0.64, baseY, clearH + 0.4, "#b8a07d", "stone");
      for (let i = 0; i < 4; i++) {
        box(
          `${tag}-arch-stone`,
          x,
          z + side * (spanD / 2 - 0.15 - i * 0.34),
          depth + 0.06,
          0.38,
          baseY + clearH - 0.32 + i * 0.11,
          0.42 - i * 0.06,
          "#d3be9c",
          "stone",
          true
        );
      }
    }
    box(
      `${tag}-entry-lintel`,
      x,
      z,
      depth,
      spanD + 1.28,
      baseY + clearH,
      Math.max(0.45, lintelTop - (baseY + clearH)),
      "#cbb694",
      "stone"
    );
  };

  // ============================================================================
  // PASS 1: AUTOMATIC SEALED PERIMETER FACADES (ZERO MAP-ESCAPE LEAKS)
  // Derived directly from DUST2_V2_BLOCKS shared edges (CS:GO 2017 North African stucco)
  // ============================================================================
  const rects = Object.values(DUST2_V2_BLOCKS);
  const cuts = (a: number, b: number) =>
    [...new Set(rects.flatMap((r) => [r[a], r[b]]))].sort((u, v) => u - v);
  const xs = cuts(0, 1);
  const zs = cuts(2, 3);
  const inside = (x: number, z: number) =>
    rects.some(([l, r, b, t]) => x > l && x < r && z > b && z < t);
  const plasterPalette = ["#dfd0b6", "#d5c2a2", "#e6d8c0", "#cbb594", "#d9c7aa"];
  let facadeIndex = 0;

  const buildPerimeter = (alongX: boolean, fixed: number, segments: number[]) => {
    let start = 0;
    let face = 0;
    for (let i = 0; i < segments.length; i++) {
      const mid = (segments[i] + segments[i + 1]) / 2;
      const occ = (off: number) => (alongX ? inside(mid, fixed + off) : inside(fixed + off, mid));
      const next = i === segments.length - 1 ? 0 : Number(occ(0.01)) - Number(occ(-0.01));
      if (face === next) continue;
      if (face) {
        const end = segments[i];
        const parts = Math.max(1, Math.ceil((end - start) / 11));
        for (let p = 0; p < parts; p++) {
          const width = (end - start) / parts;
          const center = start + (p + 0.5) * width;
          const wallHeight = 7.4 + (facadeIndex % 4) * 0.75;
          const tag = `facade-${facadeIndex}`;
          const xy = (u: number, offset: number): [number, number] =>
            alongX ? [center + u, fixed + offset * face] : [fixed + offset * face, center + u];
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
            detail = true
          ) => {
            const [px, pz] = xy(u, offset);
            box(tag + suffix, px, pz, alongX ? size : depth, alongX ? depth : size, y, h, color, surface, detail);
          };

          // Solid perimeter masonry wall (non-detail, blocks players & bullets cleanly)
          panel("", 0, -0.35, width + 0.04, 0.7, 0, wallHeight, plasterPalette[facadeIndex % plasterPalette.length], "plaster", false);
          // 2017 North African stone plinth, cornice & subtle frieze trim (detail only)
          panel("-plinth", 0, 0.04, width, 0.09, 0, 1.05, "#b39d7f", "stone");
          panel("-cornice", 0, 0.11, width, 0.22, wallHeight - 0.28, 0.28, "#ecdcc3", "stone");
          panel("-frieze", 0, 0.07, width, 0.14, wallHeight - 0.68, 0.12, "#c2a886", "stone");

          if (width >= 4.8) {
            const shutterColor = facadeIndex % 3 === 0 ? "#4c6c68" : facadeIndex % 3 === 1 ? "#684d37" : "#3c5d72";
            for (const u of [-width * 0.24, width * 0.24]) {
              panel("-win-frame", u, 0.04, 1.32, 0.08, 4.35, 1.56, "#ead5b5", "stone");
              panel("-win-glass", u, 0.075, 1.02, 0.06, 4.46, 1.32, "#2f414b", "glass");
              panel("-win-shutter-l", u - 0.56, 0.11, 0.34, 0.08, 4.45, 1.34, shutterColor, "wood");
              panel("-win-shutter-r", u + 0.56, 0.11, 0.34, 0.08, 4.45, 1.34, shutterColor, "wood");
              panel("-win-sill", u, 0.16, 1.5, 0.3, 4.24, 0.13, "#cdb898", "stone");
              panel("-win-lintel", u, 0.09, 1.48, 0.18, 5.9, 0.16, "#eed9b9", "stone");
            }
          }
          facadeIndex++;
        }
      }
      start = segments[i];
      face = next;
    }
  };
  for (const z of zs) buildPerimeter(true, z, xs);
  for (const x of xs) buildPerimeter(false, x, zs);

  // ============================================================================
  // PASS 1 & 2: MULTI-LEVEL ELEVATION DECKS, RAMPS, STAIRS & STRUCTURAL MASSING
  // ============================================================================

  // ----------------------------------------------------------------------------
  // 1. SOUTH: T SPAWN (y=2.8), T PLAT (y=2.8), T RAMP (2.8->2.4), SUICIDE (2.8->1.8),
  //    T EAST CORRIDOR (2.8->1.6), OUTSIDE LONG (1.6)
  // ----------------------------------------------------------------------------
  deck("t-spawn", -22, 14, -52, -40, 2.8, 0, "#d0be9e", "sand");
  deck("t-plat", -42, -22, -48, -36, 2.8, 0, "#cdb999", "sand");
  // T Ramp descending north from T Plat (y=2.8 at z=-36) to Outside Tunnels (y=2.4 at z=-24)
  deck("t-ramp-base", -42, -30, -36, -24, 2.4, 0, "#c8b392", "stone");
  ramp("t-ramp-slope", -36, -30, 12, 12, 2.4, 0.4, "z", true, "#cbb695", "sand");
  deck("outside-tunnels", -46, -26, -24, -10, 2.4, 0, "#ccb897", "sand");

  // Suicide ramp descending north from T Spawn (y=2.8 at z=-40) to Top Mid (y=1.8 at z=-24)
  deck("suicide-base", -3.5, 3.5, -40, -24, 1.8, 0, "#c7b392", "stone");
  ramp("suicide-slope", 0, -32, 7, 16, 1.8, 1.0, "z", true, "#ccb897", "sand");
  // Iconic Suicide overhead stone archway (high at y=5.8 so T Spawn -> Mid Doors sightline is 100% clear)
  addArchX("suicide-south", 0, -39.5, 5.8, 3.4, 2.8, 0.8, 7.6);
  addArchX("suicide-north", 0, -24.5, 5.8, 3.8, 1.8, 0.8, 7.4);

  // T East Corridor descending east from T Spawn (y=2.8 at x=14) to Outside Long (y=1.6 at x=24)
  deck("t-east-ramp-base", 14, 24, -48, -38, 1.6, 0, "#c8b493", "stone");
  ramp("t-east-slope", 19, -43, 10, 10, 1.6, 1.2, "x", true, "#ccb897", "sand");
  deck("t-east-flat", 24, 30, -48, -38, 1.6, 0, "#ccb897", "sand");

  // Outside Long (y=1.6) + Top Mid to Outside Long connector (1.8 -> 1.6)
  deck("outside-long", 16, 34, -38, -22, 1.6, 0, "#cbb898", "sand");
  deck("topmid-long-base", 14, 18, -24, -16, 1.6, 0, "#c8b493", "stone");
  ramp("topmid-long-slope", 16, -20, 4, 8, 1.6, 0.2, "x", true, "#cbb898", "sand");
  deck("topmid-long-east", 18, 22, -24, -16, 1.6, 0, "#cbb898", "sand");
  // Low wall/curb & storefront shutter along Outside Long (PDF Page 10)
  box("outside-long-shutter-frame", 16.25, -31.5, 0.24, 4.2, 1.6, 3.2, "#596369", "metal", true);
  box("outside-long-awning", 17.0, -31.5, 1.5, 4.5, 4.9, 0.16, "#a44533", "fabric", true);
  addCrate("outside-long-cover", 20.5, -26.2, 1.6, 1.55, 1.55, 1.45, "#937451");
  addCrate("outside-long-corner", 32.6, -34.2, 1.6, 1.65, 1.65, 1.55, "#617157");

  // T Spawn subtle sandstone terrace planters, market shade canopy & directional Long/B signage
  box("t-spawn-planter-w", -18.5, -49.5, 3.2, 1.4, 2.8, 0.72, "#bba584", "stone");
  box("t-spawn-planter-e", 10.5, -49.5, 3.2, 1.4, 2.8, 0.72, "#bba584", "stone");
  box("t-spawn-canopy", -13.5, -51.1, 7.6, 1.8, 6.2, 0.14, "#9d4633", "fabric", true);
  box("t-plat-canopy", -35.5, -47.1, 6.4, 1.8, 6.1, 0.14, "#356170", "fabric", true);
  addCrate("t-plat-crate", -28.5, -45.5, 2.8, 1.5, 1.5, 1.35, "#8f7150");
  box("outside-long-a-sign", 31.0, -22.38, 1.6, 0.08, 5.15, 0.95, "#a63a24", "plaster", true, { label: "A LONG →" });

  // ----------------------------------------------------------------------------
  // 2. EAST: LONG DOORS (y=1.6), BLUE, LONG CORNER (1.6), SUNKEN PIT (y=0.0),
  //    SIDE PIT (0.8), PIT PLAT (1.6), A LONG (1.6), CAR, A CROSS (1.2), A RAMP (1.2->3.2)
  // ----------------------------------------------------------------------------
  deck("long-doors-floor", 26, 36, -22, -12, 1.6, 0, "#c4b08e", "stone");
  // Long Doors vaulted vestibule roof with central sunlit skylight cutout
  roof("long-doors-w", 26, 29, -22, -12, 5.4);
  roof("long-doors-e", 33, 36, -22, -12, 5.4);
  roof("long-doors-s", 29, 33, -22, -19.5, 5.4);
  roof("long-doors-n", 29, 33, -14.5, -12, 5.4);
  for (const rz of [-18.5, -17.0, -15.5]) {
    box("long-doors-rafter", 31, rz, 4.2, 0.22, 5.25, 0.22, "#6e553c", "wood", true);
  }
  // South Long Doors archway & wooden double doors (center passage x ∈ [29.4, 32.6] = 3.2m clear)
  addArchX("long-doors-south", 31, -22, 4.8, 3.3, 1.6, 0.68, 5.75);
  box("long-doors-south-flank-w", 27.1, -22, 2.2, 0.68, 1.6, 4.15, "#cbb796", "stone");
  box("long-doors-south-flank-e", 34.9, -22, 2.2, 0.68, 1.6, 4.15, "#cbb796", "stone");
  for (const side of [-1, 1]) {
    box("long-door-south-leaf", 31 + side * 1.9, -21.7, 0.85, 0.18, 1.6, 2.85, "#6c543c", "wood");
    box("long-door-south-strap", 31 + side * 1.9, -21.58, 0.78, 0.06, 2.35, 0.08, "#3e4244", "metal", true);
    box("long-door-south-strap2", 31 + side * 1.9, -21.58, 0.78, 0.06, 3.55, 0.08, "#3e4244", "metal", true);
  }
  // East Long Doors archway & wooden double doors (center passage z ∈ [-18.6, -15.4] = 3.2m clear)
  addArchZ("long-doors-east", 36, -17, 4.8, 3.3, 1.6, 0.68, 5.75);
  box("long-doors-east-flank-s", 36, -20.9, 0.68, 2.2, 1.6, 4.15, "#cbb796", "stone");
  box("long-doors-east-flank-n", 36, -13.1, 0.68, 2.2, 1.6, 4.15, "#cbb796", "stone");
  for (const side of [-1, 1]) {
    box("long-door-east-leaf", 36.3, -17 + side * 1.9, 0.18, 0.85, 1.6, 2.85, "#6c543c", "wood");
    box("long-door-east-strap", 36.42, -17 + side * 1.9, 0.06, 0.78, 2.35, 0.08, "#3e4244", "metal", true);
    box("long-door-east-strap2", 36.42, -17 + side * 1.9, 0.06, 0.78, 3.55, 0.08, "#3e4244", "metal", true);
  }

  // Long Corner & Blue (y=1.6)
  deck("long-corner", 36, 52, -20, -6, 1.6, 0, "#ccb897", "sand");
  // West & East strips beside Pit Ramp at z ∈ [-22, -20]
  deck("pit-mouth-w", 36, 41.2, -22, -20, 1.6, 0, "#ccb897", "stone");
  deck("pit-mouth-e", 49, 52, -22, -20, 1.6, 0, "#ccb897", "stone");

  // SUNKEN PIT (y = 0.0m, genuinely 1.6m below A Long!), SIDE PIT (y = 0.8m), PIT PLAT (y = 1.6m)
  // Pit Ramp descending south from Long Corner (y=1.6 at z=-20) into Pit basin (y=0.0 at z=-26.5)
  ramp("pit-main-ramp", 45.1, -23.25, 7.8, 6.5, 0, 1.6, "z", false, "#c2ae8e", "concrete");
  // Pit Basin floor at y = 0.0 (walkable ground plane + concrete paving)
  box("pit-basin-slab", 45.1, -31.25, 7.8, 9.5, 0, 0.04, "#b9a68a", "concrete", true);
  // Side Pit (west shelf at y=0.8m with smooth north ramp to Long Corner and west ramp from Pit Basin)
  deck("side-pit-ledge", 38, 41.2, -36.0, -24.5, 0.8, 0, "#bfa989", "stone");
  ramp("side-pit-north-ramp", 39.6, -23.25, 3.2, 2.5, 0.8, 0.8, "z", false, "#c3ae8e", "stone");
  ramp("pit-to-side-pit-ramp", 42.3, -33.5, 2.2, 3.6, 0, 0.8, "x", true, "#c2ad8d", "stone");
  // Pit Plat (elevated east overlook at y=1.6m running alongside Pit) + low decorative guard rail
  deck("pit-plat", 49, 52, -36, -22, 1.6, 0, "#c8b393", "stone");
  box("pit-plat-rail-top", 49.08, -29.0, 0.08, 10.5, 2.32, 0.08, "#525a5f", "metal", true);
  for (const rz of [-33.5, -30.5, -27.5, -24.5]) {
    box("pit-plat-rail-post", 49.08, rz, 0.08, 0.08, 1.6, 0.75, "#525a5f", "metal", true);
  }
  // Iconic Pit low retaining cover wall along Side Pit edge & back concrete bunker curb
  box("pit-lip-wall-w", 41.35, -26.5, 0.32, 3.2, 0.8, 0.88, "#baa484", "stone");
  box("pit-back-bunker-curb", 46.2, -35.4, 4.8, 0.65, 0, 0.92, "#b59f80", "stone");

  // Iconic Blue Corrugated Shipping Container at Blue / Long Corner
  box("blue-container-body", 37.35, -9.8, 2.35, 5.6, 1.6, 2.58, "#2b5b8a", "metal");
  box("blue-container-roof", 37.35, -9.8, 2.42, 5.68, 4.18, 0.08, "#224a70", "metal", true);
  for (let kz = -2.2; kz <= 2.2; kz += 0.72) {
    box("blue-container-rib", 38.55, -9.8 + kz, 0.06, 0.14, 1.62, 2.52, "#1f4366", "metal", true);
  }

  // A Long (y = 1.6m) -> North Dip (1.6 -> 1.2) -> A Cross (y = 1.2m) -> A Ramp (1.2 -> 3.2)
  deck("a-long", 38, 52, -6, 18, 1.6, 0, "#cbb898", "sand");
  deck("a-long-dip-base", 38, 52, 18, 22, 1.2, 0, "#c4b191", "stone");
  ramp("a-long-dip-slope", 45, 20, 14, 4, 1.2, 0.4, "z", true, "#cbb898", "sand");
  // Street curbs & iconic A Car along East wall of A Long
  box("a-long-curb-w", 38.3, 6, 0.34, 24, 1.6, 0.12, "#b8a383", "stone", true);
  box("a-long-curb-e", 51.7, 6, 0.34, 24, 1.6, 0.12, "#b8a383", "stone", true);
  addSedan("a-long", 50.2, 11.5, 1.6, "#8c493b", "z");

  // A Cross (y = 1.2m) & CT Ramp (x=26..36, y=0.0 -> 1.2)
  deck("a-cross", 36, 52, 22, 32, 1.2, 0, "#c8b494", "sand");
  ramp("ct-ramp", 31, 27, 10, 10, 0, 1.2, "x", false, "#c6b190", "stone");
  // Elevator boost box tucked into CT Ramp / A Site retaining wall corner
  addCrate("a-elevator-boost", 27.6, 30.8, 0.15, 1.45, 1.45, 1.85, "#8f7150");

  // A Ramp climbing smoothly from A Cross (z=32, y=1.2) to A Site Platform (z=40, y=3.2)
  deck("a-ramp-base", 40, 52, 32, 40, 1.2, 0, "#c4b090", "stone");
  ramp("a-ramp-slope", 46, 36, 12, 8, 1.2, 2.0, "z", false, "#cbb796", "stone");

  // ----------------------------------------------------------------------------
  // 3. NORTH-EAST: A SITE PLATFORM (y=3.2), DEFAULT, QUAD, GOOSE, NINJA, BARRELS
  // ----------------------------------------------------------------------------
  deck("a-site-west", 26, 40, 32, 48, 3.2, 0, "#cbb797", "stone");
  deck("a-site-east", 40, 52, 40, 48, 3.2, 0, "#cbb797", "stone");
  // A Site south parapet curb (blocks ground CT Spawn sightlines while allowing A defenders to peek A Cross)
  box("a-site-south-parapet", 33.4, 32.2, 12.8, 0.42, 3.2, 0.85, "#d2bf9f", "stone");
  box("a-site-ramp-divider-curb", 40.0, 35.4, 0.36, 6.4, 3.2, 0.55, "#cbb694", "stone");
  // Painted red Bomb Site A markings on A Platform
  box("a-site-mark-n", 35.5, 41.6, 5.2, 0.18, 3.21, 0.02, "#b5482a", "stone", true);
  box("a-site-mark-s", 35.5, 36.4, 5.2, 0.18, 3.21, 0.02, "#b5482a", "stone", true);
  box("a-site-mark-w", 32.9, 39.0, 0.18, 5.4, 3.21, 0.02, "#b5482a", "stone", true);
  box("a-site-mark-e", 38.1, 39.0, 0.18, 5.4, 3.21, 0.02, "#b5482a", "stone", true);

  // Iconic A Site Cover: A Default (2-tier silhouette), Quad, Ninja, Goose, Barrels
  // A Default crate stack (protects planter from A Long & Catwalk)
  addCrate("a-default-main", 37.8, 39.6, 3.2, 1.7, 1.7, 1.72, "#977955");
  box("a-default-top", 37.8, 39.6, 1.18, 1.18, 4.92, 0.85, "#876946", "wood", true);
  addCrate("a-default-side", 37.8, 37.9, 3.2, 1.35, 1.35, 1.25, "#607056");
  // Quad 4-box / tall stack on West A Site
  addCrate("a-quad-base", 30.2, 41.4, 3.2, 1.75, 1.75, 1.62, "#967853");
  box("a-quad-upper", 30.2, 41.4, 1.32, 1.32, 4.82, 1.12, "#876946", "wood", true);
  addCrate("a-quad-wing", 28.6, 41.6, 3.2, 1.2, 1.4, 1.3, "#627258");
  // Ninja corner ambush crate
  addCrate("a-ninja-box", 28.4, 45.8, 3.2, 1.45, 1.45, 1.55, "#8f704e");
  // Barrels near Goose & A Site North-West
  addBarrel("a-goose-1", 43.2, 46.6, 3.2);
  addBarrel("a-goose-2", 44.0, 46.5, 3.2, "#7c6750");
  addBarrel("a-west-1", 31.4, 46.6, 3.2);
  // Goose corner curb & authentic painted GOOSE stencil + A site mural
  box("a-goose-step-curb", 47.0, 47.2, 6.8, 0.9, 3.2, 0.2, "#c0ad8e", "stone", true);
  box("a-goose-sign", 46.8, 47.72, 2.8, 0.08, 5.15, 1.0, "#8f3b28", "plaster", true, { label: "GOOSE" });
  box("a-site-wall-sign", 35.5, 47.72, 2.4, 0.08, 5.2, 1.15, "#a63a24", "plaster", true, { label: "BOMBSITE A" });

  // 2017 CS:GO North African Palace Facade rising behind A Site North wall (z = 48..54)
  box("a-north-palace-mass", 37, 51.5, 24, 6.2, 0, 12.2, "#f0e5d1", "plaster", true);
  box("a-north-palace-ledge", 37, 48.2, 24.4, 0.95, 7.1, 0.28, "#d9c5a4", "stone", true);
  box("a-north-palace-eave", 37, 48.05, 24.8, 1.15, 11.75, 0.34, "#b24730", "wood", true);
  for (let px = 28; px <= 46; px += 3.6) {
    box("a-palace-arch-win", px, 48.35, 1.9, 0.2, 7.5, 3.2, "#293842", "glass", true);
    for (const s of [-1, 1]) {
      box("a-palace-shutter", px + s * 0.72, 48.24, 0.38, 0.1, 7.65, 2.55, "#684d35", "wood", true);
    }
    box("a-palace-crown", px, 48.2, 2.35, 0.42, 10.65, 0.44, "#decab0", "stone", true);
  }

  // ----------------------------------------------------------------------------
  // 4. CENTER: TOP MID (1.8), MID SLOPE (1.8->0.0), XBOX, CATWALK (1.8),
  //    SHORT STAIRS (1.8->3.2), A SHORT BRIDGE (3.2 over Under A y=0.0),
  //    MID DOORS (0.0), CT MID (0.0), CT SPAWN (0.0)
  // ----------------------------------------------------------------------------
  deck("top-mid", -8, 14, -24, -10, 1.8, 0, "#ccb897", "sand");
  // Mid slope descending north from Top Mid (z=-10, y=1.8) to Lower Mid (z=2, y=0.0)
  ramp("mid-main-slope", 1, -4, 14, 12, 0, 1.8, "z", true, "#c9b595", "sand");
  // Lower Mid (z=2..16) sits natively on y=0.0 ground plane
  box("mid-lower-paving", 1, 9, 13.8, 13.8, 0, 0.03, "#c4b090", "sand", true);

  // Iconic Top Mid Green Box, Desert Palm Tree ('Palm') & Utility Pole
  addCrate("top-mid-green", 3.2, -18.5, 1.8, 1.5, 1.5, 1.42, "#596e54");
  box("mid-palm-trunk", 5.8, -12.6, 0.46, 0.46, 1.8, 6.2, "#785a3c", "wood", true, { shape: "cylinder" });
  for (const [dx, dz] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4], [1.0, 1.0], [-1.0, 1.0], [1.0, -1.0], [-1.0, -1.0]]) {
    box("mid-palm-frond", 5.8 + dx, -12.6 + dz, 1.4, 1.4, 7.85, 0.18, "#4c703e", "wood", true);
  }
  box("mid-utility-pole", -4.8, 1.2, 0.24, 0.24, 0, 6.8, "#6a5239", "wood", true, { shape: "cylinder" });
  box("mid-utility-crossarm", -4.8, 1.2, 1.5, 0.16, 6.2, 0.14, "#54402b", "wood", true);

  // Iconic Mid Xbox (allows reliable jump from Mid y=0.0 -> Xbox y=1.08 -> Catwalk y=1.80)
  addCrate("mid-xbox-main", 6.95, 5.0, 0, 1.7, 1.7, 1.08, "#947551");
  // Distinctive painted white/olive cargo markings identifying Xbox from Mid & Catwalk
  box("mid-xbox-mark-s", 6.95, 4.13, 1.35, 0.05, 0.48, 0.16, "#dcd2be", "wood", true);
  box("mid-xbox-mark-w", 6.08, 5.0, 0.05, 1.35, 0.48, 0.16, "#dcd2be", "wood", true);
  box("mid-xbox-step-pallet", 5.75, 5.0, 0.72, 1.35, 0, 0.28, "#7e6143", "wood");

  // Catwalk (narrow elevated walkway along east side of Mid, y=1.8m)
  deck("catwalk", 8, 12.5, -10, 14, 1.8, 0, "#cab695", "stone");
  // Low Catwalk Parapet Wall along west side (x=8.16), with Xbox jump opening at z ∈ [3.6, 6.4]
  box("catwalk-parapet-s", 8.16, -3.2, 0.32, 13.6, 1.8, 0.88, "#d4c2a3", "stone");
  box("catwalk-parapet-n", 8.16, 10.2, 0.32, 7.6, 1.8, 0.88, "#d4c2a3", "stone");
  // Catwalk Mashrabiya lattice windows along east facade
  for (const wz of [-4, 2, 9]) {
    box("catwalk-mashrabiya", 12.42, wz, 0.18, 1.55, 3.6, 1.75, "#6b5036", "wood", true);
  }

  // Short Stairs (z=14..21, climbs smoothly from Catwalk y=1.8 to A Short y=3.2 — 14 steps @ 0.10m rise)
  const shortSteps = 14;
  for (let i = 0; i < shortSteps; i++) {
    const stepTop = 1.8 + ((i + 1) * 1.4) / shortSteps;
    const stepZ = 14 + (i + 0.5) * (7.0 / shortSteps);
    box(`stair-tread-short-${i}`, 11.0, stepZ, 5.8, 7.0 / shortSteps + 0.015, 0, stepTop, "#c7b392", "stone");
  }
  // Short Stairs west parapet wall facing Mid
  for (let i = 0; i < shortSteps; i++) {
    const stepTop = 1.8 + ((i + 1) * 1.4) / shortSteps;
    const stepZ = 14 + (i + 0.5) * (7.0 / shortSteps);
    box("short-stairs-parapet", 8.16, stepZ, 0.32, 7.0 / shortSteps + 0.02, stepTop, 0.88, "#d4c2a3", "stone");
  }
  box("short-stairs-arch-header", 11.0, 21.2, 5.8, 0.5, 5.6, 1.4, "#d5c3a4", "stone", true);

  // A Short Upper Landing (y=3.2, solid base underneath separating from CT Spawn)
  deck("a-short-landing", 8, 14, 21, 28, 3.2, 0, "#cab696", "stone");
  box("a-short-landing-parapet-w", 8.16, 24.5, 0.32, 7.0, 3.2, 0.9, "#d4c2a3", "stone");
  box("a-short-landing-parapet-n", 11.0, 27.84, 6.0, 0.32, 3.2, 0.9, "#d4c2a3", "stone");

  // A Short Bridge spanning OVER Under A (deck y=2.90..3.20 -> 2.90m headroom underneath for CT Spawn -> A Ramp!)
  deck("a-short-bridge", 14, 26, 22, 28, 3.2, 2.9, "#c4b08f", "stone");
  // Low parapets on both sides of A Short Bridge (players can peek down or jump-drop into CT Spawn!)
  box("a-short-bridge-parapet-s", 20.0, 22.16, 12.0, 0.32, 3.2, 0.85, "#d2bf9f", "stone");
  box("a-short-bridge-parapet-n", 18.0, 27.84, 8.0, 0.32, 3.2, 0.85, "#d2bf9f", "stone");
  // Sculpted Under A arch beams framing the CT underpass
  box("under-a-arch-beam-w", 14.2, 25.0, 0.45, 6.0, 2.65, 0.55, "#bfa989", "stone");
  box("under-a-arch-beam-e", 25.8, 25.0, 0.45, 6.0, 2.65, 0.55, "#bfa989", "stone");
  // Painted red 'A' arrow sign facing Short Stairs / A Short
  box("short-a-sign", 11.2, 27.65, 1.5, 0.08, 4.65, 1.35, "#a63a24", "plaster", true, { label: "A →" });

  // A Short North Entry (y=3.2, solid base underneath sealing the north side of CT Spawn)
  deck("a-short-north", 22, 26, 28, 36, 3.2, 0, "#cab696", "stone");
  box("a-short-north-parapet-w", 22.16, 32.0, 0.32, 8.0, 3.2, 0.9, "#d2bf9f", "stone");

  // Mid Doors (z=16..20, y=0.0): authentic double wooden doors with 1.9m central passage & sniper slit
  addArchX("mid-doors", 0, 18.0, 4.6, 3.25, 0, 0.72, 6.2);
  box("mid-doors-wall-w", -3.3, 18.0, 1.4, 0.72, 0, 6.2, "#cbb796", "stone");
  box("mid-doors-wall-e", 4.3, 18.0, 3.4, 0.72, 0, 6.2, "#cbb796", "stone");
  // Offset double door leaves leaving clear 1.9m center walkthrough (x ∈ [-0.95, 0.95]) & iconic Mid slit
  box("mid-door-leaf-w", -1.6, 17.7, 1.25, 0.2, 0, 3.05, "#6b533b", "wood");
  box("mid-door-leaf-e", 1.6, 18.3, 1.25, 0.2, 0, 3.05, "#6b533b", "wood");
  for (const hy of [0.85, 2.15]) {
    box("mid-door-hinge-w", -1.6, 17.57, 1.15, 0.06, hy, 0.08, "#3e4244", "metal", true);
    box("mid-door-hinge-e", 1.6, 18.43, 1.15, 0.06, hy, 0.08, "#3e4244", "metal", true);
  }

  // Mid Doors overhead Mashrabiya wooden balcony trim & CT Mid directional A/B signage
  box("mid-doors-balcony-s", 0, 17.45, 5.6, 0.55, 5.05, 0.22, "#755a3e", "wood", true);
  box("mid-doors-balcony-rail", 0, 17.22, 5.4, 0.1, 5.27, 0.82, "#654d35", "wood", true);
  box("ct-mid-b-sign", -4.5, 31.72, 2.0, 0.08, 3.85, 1.0, "#a63a24", "plaster", true, { label: "← B" });
  box("ct-spawn-a-sign", 15.0, 33.72, 2.0, 0.08, 3.85, 1.0, "#a63a24", "plaster", true, { label: "A →" });
  // CT Mid & CT Spawn iconic cover: B Boxes (sandstone block stacks outside B Doors & CT Mid)
  box("ct-mid-b-boxes-w1", -15.2, 26.8, 1.75, 1.55, 0, 1.35, "#cbb898", "stone");
  box("ct-mid-b-boxes-w2", -15.2, 26.8, 1.3, 1.2, 1.35, 1.05, "#d6c4a5", "stone", true);
  box("ct-mid-b-boxes-e1", -4.2, 22.8, 1.7, 1.5, 0, 1.35, "#cbb898", "stone");
  box("ct-mid-b-boxes-e2", -4.2, 22.8, 1.25, 1.15, 1.35, 1.0, "#d6c4a5", "stone", true);
  // CT Spawn rear cover crate
  addCrate("ct-spawn-crate", 19.6, 32.5, 0, 1.5, 1.5, 1.45, "#617056");

  // ----------------------------------------------------------------------------
  // 5. WEST: UPPER TUNNELS (y=2.4), 2017 SUNLIT BROKEN ROOF, TUNNEL STAIRS (2.4->0.0),
  //    LOWER TUNNELS (y=0.0), B TUNNELS (y=2.4)
  // ----------------------------------------------------------------------------
  deck("upper-tunnels-floor", -46, -26, -10, 12, 2.4, 0, "#c2ae8e", "stone");
  // Upper Tunnels South entry portal arch (separates Outside Tunnels from Upper Tunnels)
  addArchX("upper-tunnels-south", -36, -10, 6.2, 3.6, 2.4, 0.72, 7.0);
  box("upper-tunnels-south-w", -42.75, -10, 6.5, 0.72, 2.4, 4.6, "#bfa989", "stone");
  box("upper-tunnels-south-e", -29.25, -10, 6.5, 0.72, 2.4, 4.6, "#bfa989", "stone");
  // Upper Tunnels 2017 Kasbah vaulted ceiling with sunlit central broken-roof opening
  roof("upper-tunnels-w", -46, -40, -10, 12, 6.6);
  roof("upper-tunnels-e", -32, -26, -10, 12, 6.6);
  roof("upper-tunnels-s", -40, -32, -10, -4, 6.6);
  roof("upper-tunnels-n", -40, -32, 6, 12, 6.6);
  // Exposed weathered cedar ceiling rafters spanning across the sunlit roof cutout
  for (let bz = -3.2; bz <= 5.2; bz += 2.1) {
    box("upper-tunnels-beam", -36, bz, 8.6, 0.24, 6.45, 0.26, "#6d553d", "wood", true);
  }
  // Upper Tunnels iconic central stone column with Moroccan blue ceramic dado trim
  box("upper-tunnels-column", -36.0, 2.0, 1.35, 1.35, 2.4, 4.2, "#b59f80", "stone");
  box("upper-tunnels-column-base", -36.0, 2.0, 1.62, 1.62, 2.4, 0.36, "#9c8669", "stone", true);
  box("upper-tunnels-column-cap", -36.0, 2.0, 1.66, 1.66, 6.24, 0.36, "#9c8669", "stone", true);
  box("upper-tunnels-tile-w", -45.88, 1.0, 0.06, 20.5, 3.85, 0.26, "#366474", "stone", true);
  box("upper-tunnels-tile-n", -32.0, 11.88, 11.5, 0.06, 3.85, 0.26, "#366474", "stone", true);
  // Upper Tunnels corner cover crate & B-direction stencil
  addCrate("upper-tunnels-crate", -43.5, -5.5, 2.4, 1.5, 1.5, 1.45, "#8f7150");
  box("upper-tunnels-b-sign", -38.5, 11.72, 1.8, 0.08, 4.9, 1.0, "#a63a24", "plaster", true, { label: "← B" });

  // Tunnel Stairs (x=-26..-16, z=4..10): 20 smooth treads stepping from Upper (2.4) down to Lower (0.0)
  const tunnelSteps = 20;
  for (let i = 0; i < tunnelSteps; i++) {
    const treadH = 2.4 - ((i + 0.5) * 2.4) / tunnelSteps;
    const treadX = -26 + (i + 0.5) * (10.0 / tunnelSteps);
    if (treadH > 0.04) {
      box(`stair-tread-tunnel-${i}`, treadX, 7.0, 10.0 / tunnelSteps + 0.015, 5.9, 0, treadH, "#bea888", "stone");
    }
  }
  // Completely sealed Tunnel Stairs ceiling + bulkhead drop to Lower Tunnels ceiling
  roof("tunnel-stairs", -26.2, -15.8, 3.8, 10.2, 6.6);
  box("tunnel-stairs-bulkhead", -16.0, 7.0, 0.45, 6.2, 3.6, 3.05, "#baa486", "stone");
  // Portal lintel at top of Tunnel Stairs
  box("tunnel-stairs-top-lintel", -26.0, 7.0, 0.45, 6.2, 5.6, 1.05, "#c6b08f", "stone");

  // Lower Tunnels (x=-16..-6, z=4..10, y=0.0): enclosed stone vault opening east into Mid
  roof("lower-tunnels", -16.2, -5.8, 3.8, 10.2, 3.6);
  for (const side of [-1, 1]) {
    box("lower-tunnels-tile", -11.0, 7.0 + side * 2.88, 9.8, 0.06, 1.45, 0.24, "#366474", "stone", true);
  }
  // Sculpted stone archway exiting Lower Tunnels east into Mid
  addArchZ("lower-tunnels-mid", -6.0, 7.0, 4.6, 3.1, 0, 0.65, 3.96);
  // Lower Tunnels recessed corner crate (clear of walk corridor)
  addCrate("lower-tunnels-corner", -14.4, 9.1, 0, 1.15, 1.15, 1.15, "#8b6d4a");

  // B Tunnels Corridor (x=-46..-38, z=12..28, y=2.4) leading straight into B Site
  deck("b-tunnels-floor", -46, -38, 12, 28, 2.4, 0, "#c2ae8e", "stone");
  roof("b-tunnels", -46.2, -37.8, 11.8, 28.2, 6.35);
  for (let bz = 14; bz <= 26; bz += 3.0) {
    box("b-tunnels-beam", -42, bz, 7.8, 0.24, 6.1, 0.24, "#6d553d", "wood", true);
  }
  for (const side of [-1, 1]) {
    box("b-tunnels-tile", -42 + side * 3.88, 20, 0.06, 15.2, 3.85, 0.24, "#366474", "stone", true);
  }
  // Iconic B Tunnel Exit archway entering B Site at z=28
  addArchX("b-tunnel-exit", -42.0, 28.0, 4.8, 3.25, 2.4, 0.72, 6.65);
  box("b-tunnel-exit-w", -45.5, 28.0, 2.0, 0.72, 2.4, 4.25, "#bfa989", "stone");
  box("b-tunnel-exit-e", -38.75, 28.0, 1.5, 0.72, 2.4, 4.25, "#bfa989", "stone");

  // ----------------------------------------------------------------------------
  // 6. NORTH-WEST: B SITE COURTYARD (y=2.4), B PLAT / BACK PLAT (y=3.2),
  //    B DOORS & RAMP, B WINDOW & SCAFFOLDING, B CAR, BIG BOX, DOUBLE STACK, FENCE/DOG
  // ----------------------------------------------------------------------------
  // Continuous solid floor slab across entire B Site (ZERO outer pits or void drops!)
  deck("b-site-courtyard", -48, -26, 28, 48, 2.4, 0, "#cab796", "sand");

  // B Plat & Back Plat (elevated stone platform y=3.2m along NW B Site + smooth steps)
  deck("b-plat", -48, -37, 40.5, 48, 3.2, 2.4, "#c4b08f", "stone");
  // South steps onto B Plat (4 smooth steps @ 0.20m rise from z=38.5 to z=40.5)
  for (let i = 0; i < 4; i++) {
    box(`b-plat-step-s-${i}`, -42.5, 38.75 + i * 0.5, 3.6, 0.52, 2.4, (i + 1) * 0.2, "#bea988", "stone");
  }
  // East steps onto B Plat (4 smooth steps @ 0.20m rise from x=-35 to x=-37)
  for (let i = 0; i < 4; i++) {
    box(`b-plat-step-e-${i}`, -35.25 - i * 0.5, 43.2, 0.52, 3.4, 2.4, (i + 1) * 0.2, "#bea988", "stone");
  }
  // Low defensive parapet lip along Back Plat edge
  box("b-plat-parapet-s", -39.0, 40.66, 3.4, 0.32, 3.2, 0.78, "#d0bd9e", "stone");

  // East B Site Dividing Wall (x=-26, z=28..48) with separate B DOORS & B WINDOW openings!
  box("b-east-wall-south", -26.0, 28.75, 0.68, 1.5, 0, 6.4, "#cbb796", "stone");
  // B Doors opening: z ∈ [29.5, 33.5] (4.0m arch, double wooden doors leaving 2.4m clear walkthrough)
  addArchZ("b-doors", -26.0, 31.5, 4.0, 3.0, 2.4, 0.68, 6.4);
  for (const side of [-1, 1]) {
    box("b-door-leaf", -25.7, 31.5 + side * 1.55, 0.18, 0.72, 2.4, 2.7, "#6b533b", "wood");
    box("b-door-hinge", -25.58, 31.5 + side * 1.55, 0.06, 0.66, 3.2, 0.08, "#3e4244", "metal", true);
    box("b-door-hinge2", -25.58, 31.5 + side * 1.55, 0.06, 0.66, 4.3, 0.08, "#3e4244", "metal", true);
  }
  // Solid masonry pier strictly separating B Doors (z<=33.5) from B Window (z>=36.8)
  box("b-east-wall-pier", -26.0, 35.15, 0.68, 3.3, 0, 6.4, "#cbb796", "stone");
  // B Window opening: z ∈ [36.8, 40.6] (sill y=2.95m = +0.55m jump from 2.4m, clear opening y=2.95..5.25m!)
  box("b-window-sill", -26.0, 38.7, 0.68, 3.8, 0, 2.95, "#bea888", "stone");
  box("b-window-lintel", -26.0, 38.7, 0.68, 3.8, 5.25, 1.15, "#cbb796", "stone");
  for (const side of [-1, 1]) {
    box("b-window-brick-tooth", -26.0, 38.7 + side * 1.72, 0.74, 0.34, 3.25 + (side > 0 ? 0.35 : 0), 0.42, "#9e5c3f", "brick", true);
  }
  // Solid north section of B East wall (z ∈ [40.6, 48.0])
  box("b-east-wall-north", -26.0, 44.3, 0.68, 7.4, 0, 6.4, "#cbb796", "stone");

  // Exterior B Doors Ramp (CT Mid x=-18 y=0.0 -> B Doors x=-26 y=2.4)
  ramp("b-doors-ramp", -22.0, 31.3, 8.0, 5.4, 0, 2.4, "x", true, "#c6b291", "stone");
  // Solid masonry divider wall between B Doors Ramp and B Window Scaffold
  box("b-exterior-divider", -22.5, 35.0, 7.2, 2.0, 0, 3.4, "#c3ae8e", "stone");

  // Exterior B Window Scaffolding Platform (y=2.4) + Ramp from CT Mid (x=-14 y=0.0 -> x=-21 y=2.4)
  deck("b-window-scaffold-deck", -26, -21, 36.2, 41.6, 2.4, 2.18, "#8e714e", "wood");
  ramp("b-window-scaffold-ramp", -17.5, 38.9, 7.0, 5.4, 0, 2.4, "x", true, "#bda888", "stone");
  // Tubular steel scaffolding legs & crossbars beneath B Window platform
  for (const sx of [-25.3, -21.5]) {
    for (const sz of [36.6, 41.2]) {
      box("b-window-scaffold-post", sx, sz, 0.1, 0.1, 0, 5.1, "#525b61", "metal", true);
    }
  }
  box("b-window-scaffold-rail", -23.4, 41.2, 4.0, 0.08, 4.9, 0.08, "#525b61", "metal", true);
  box("b-window-scaffold-plank", -25.4, 38.7, 0.55, 3.9, 2.42, 0.07, "#9c7c55", "wood", true);

  // Iconic B Site Cover & Landmarks:
  // B Car along south wall east of Tunnel Exit (clear of B Tunnel Exit & B Doors)
  addSedan("b-site", -34.2, 29.6, 2.4, "#dcd7cb", "x");
  // Big Box (classic tall cover between B Doors & B Default)
  addCrate("b-big-box", -32.2, 34.4, 2.4, 1.75, 1.75, 1.65, "#607056");
  // Double Stack (tall 2-tier stack north of B Default)
  addCrate("b-double-stack-low", -34.6, 40.8, 2.4, 1.75, 1.75, 1.65, "#987954");
  box("b-double-stack-high", -34.6, 40.8, 1.38, 1.38, 4.05, 1.25, "#876946", "wood", true);
  // B Default planter cover crate
  addCrate("b-default-crate", -37.2, 37.6, 2.4, 1.45, 1.45, 1.45, "#8e6f4e");
  // Back Site / Back Plat cover boxes & barrels
  addCrate("b-back-plat-box", -45.2, 45.2, 3.2, 1.45, 1.45, 1.4, "#967753");
  addBarrel("b-back-1", -29.2, 46.2, 2.4);
  addBarrel("b-back-2", -28.4, 46.1, 2.4, "#7c6750");
  // Fence / Dog wooden slat partition on far west wall of B Site
  box("b-fence-post-s", -45.6, 35.4, 0.16, 0.16, 2.4, 2.15, "#684f36", "wood");
  box("b-fence-post-n", -45.6, 38.6, 0.16, 0.16, 2.4, 2.15, "#684f36", "wood");
  box("b-fence-slats", -45.6, 37.0, 0.1, 3.2, 2.45, 1.95, "#785d41", "wood", true);
  // Painted red Bomb Site B markings & wall mural
  box("b-site-mark-n", -35.2, 39.9, 5.0, 0.18, 2.41, 0.02, "#b5482a", "stone", true);
  box("b-site-mark-s", -35.2, 35.1, 5.0, 0.18, 2.41, 0.02, "#b5482a", "stone", true);
  box("b-site-mark-w", -37.7, 37.5, 0.18, 5.0, 2.41, 0.02, "#b5482a", "stone", true);
  box("b-site-mark-e", -32.7, 37.5, 0.18, 5.0, 2.41, 0.02, "#b5482a", "stone", true);
  box("b-site-wall-sign", -35.0, 47.72, 2.4, 0.08, 4.9, 1.25, "#a63a24", "plaster", true, { label: "BOMBSITE B" });

  // ============================================================================
  // PASS 3: 2017 CS:GO NORTH AFRICAN SKYLINE, AWNINGS, ROOFTOPS & SILHOUETTES
  // (All detail: true — zero physics cost, batched cleanly by StrikeRenderer)
  // ============================================================================
  // B Site North Kasbah Fortress Tower & Crenellations
  box("b-fort-tower", -41, 51.5, 9.5, 5.6, 0, 11.4, "#c5ac88", "stone", true);
  for (let k = 0; k < 5; k++) {
    box("b-fort-merlon", -44.6 + k * 1.8, 48.95, 0.78, 0.52, 11.4, 0.72, "#d4be9b", "stone", true);
  }
  // Distant skyline buildings framing T Spawn, Mid, Long & B horizons
  const skylineBuildings: readonly [number, number, number, number, number, string][] = [
    [25, -3, 14, 16, 11.5, "#dccbb0"],     // Central block between Mid/Catwalk and A Long
    [22, 14, 14, 12, 10.6, "#d2be9e"],     // Block between Short and A Long
    [-16, -24, 14, 18, 10.8, "#d9c8ac"],   // Block between Outside Tunnels and Mid
    [-16, -4, 16, 12, 10.2, "#ceb998"],    // Block between Upper Tunnels and Mid
    [-29, 19, 14, 12, 11.2, "#d5c3a4"],    // Block between B Tunnels and CT Mid
    [4, -56, 22, 6, 12.0, "#e1d2b8"],      // T Spawn south kasbah skyline
    [56, 4, 6, 30, 11.4, "#d7c5a6"],       // East A Long horizon ridge
    [-53, 18, 6, 26, 11.0, "#cfb998"],     // West B Tunnels horizon ridge
    [-1, 38, 14, 8, 12.6, "#dfd0b6"],      // North CT Mid tower
  ];
  for (const [sx, sz, sw, sd, sh, scol] of skylineBuildings) {
    box("skyline-mass", sx, sz, sw, sd, 0, sh, scol, "plaster", true);
    box("skyline-cornice", sx, sz, sw + 0.36, sd + 0.36, sh - 0.24, 0.24, "#ece0cb", "stone", true);
    box("skyline-parapet", sx, sz, sw - 0.4, sd - 0.4, sh, 0.55, "#cbb593", "stone", true);
  }
  // Iconic North-African domed cupola above the central Mid/Long kasbah block
  box("kasbah-dome-drum", 25, -3, 5.2, 5.2, 11.5, 1.8, "#d8c4a3", "stone", true, { shape: "cylinder" });
  box("kasbah-dome-crown", 25, -3, 4.4, 4.4, 13.3, 1.4, "#c6a468", "stone", true, { shape: "cylinder" });
  box("kasbah-dome-finial", 25, -3, 0.3, 0.3, 14.7, 1.2, "#b58d47", "metal", true, { shape: "cylinder" });

  // Street awnings & AC units along Mid, Outside Long, A Long & CT Mid
  for (const [ax, az, ay, aw, ad, col] of [
    [-5.3, -4.0, 4.8, 1.3, 3.6, "#a44533"],
    [50.9, 2.0, 5.2, 1.4, 4.2, "#356170"],
    [39.0, 12.0, 5.2, 1.4, 3.8, "#9c4835"],
    [-11.5, 20.8, 4.2, 3.6, 1.3, "#356170"],
    [-34.5, -23.3, 5.2, 4.0, 1.3, "#a44533"],
  ] as const) {
    box("street-awning", ax, az, aw, ad, ay, 0.14, col, "fabric", true);
  }
  for (const [ux, uz, uy] of [
    [12.3, 6.0, 4.8],
    [-5.7, 12.5, 3.8],
    [38.4, 15.0, 4.6],
    [-26.4, 34.8, 4.8],
  ] as const) {
    box("ac-housing", ux, uz, 0.42, 0.78, uy, 0.56, "#bdb9af", "metal", true);
    box("ac-grille", ux, uz, 0.46, 0.44, uy + 0.08, 0.38, "#3e4347", "metal", true);
  }

  // 5 T Spawns (South T Spawn terrace y=2.8) + 5 CT Spawns (North-Center CT Spawn y=0.0)
  const spawns: Vec3[] = [
    // T Team (0..4)
    pt(-10, -47, 2.8),
    pt(-5, -48, 2.8),
    pt(0, -47, 2.8),
    pt(5, -48, 2.8),
    pt(9, -46, 2.8),
    // CT Team (5..9) — spaced >= 2.6m apart inside CT Spawn
    pt(9.5, 32.2, 0),
    pt(12.2, 30.2, 0),
    pt(14.8, 32.2, 0),
    pt(17.2, 29.6, 0),
    pt(19.8, 29.6, 0),
  ];

  return {
    id: "dust2v2",
    name: "Dust II V2 · CS:GO 2017",
    subtitle: "Orijinal de_dust2 (2017) · Long, Mid, Short, Tunnels, A & B",
    bounds: 62,
    sky: "#b7d8ee",
    floor: "#cbb998",
    floorSurface: "sand",
    solids,
    spawns,
    targets: [],
    hazard: { x: 140, z: 140, r: 0 },
    bombSites: [...DUST2_V2_SITES],
    routes: CORE_ROUTES,
    radarFootprint: rects,
    landmarks: DUST2_V2_CALLOUTS.map((c) => c.name),
  };
}
