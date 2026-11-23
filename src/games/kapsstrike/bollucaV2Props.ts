import type { Solid } from "./types";

export interface BollucaV2Builder {
  box: (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail?: boolean,
  ) => void;
  cyl: (
    id: string,
    x: number,
    z: number,
    diamX: number,
    diamZ: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail?: boolean,
  ) => void;
  cone: (
    id: string,
    x: number,
    z: number,
    diam: number,
    y: number,
    h: number,
    color: string,
    surface: Solid["surface"],
    detail?: boolean,
  ) => void;
  sign: (
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    color: string,
    label: string,
  ) => void;
}

/**
 * High-fidelity CS:GO Mirage (2019–2020) architectural details, Moroccan arches,
 * tactical cover stacks, B Site green canopy, delivery Van, Market interior,
 * Palace colonnade/pergola, Ticket Booth, and skyline silhouettes for Bolluca V2.
 */
export function appendBollucaV2ArchitectureAndProps(b: BollucaV2Builder): void {
  const { box, cyl, cone, sign } = b;

  // Helper: Wooden tactical crate with lid trim & dark steel strapping
  const crate = (
    id: string,
    x: number,
    z: number,
    y: number,
    w: number,
    d: number,
    h: number,
    tone = "#977754",
  ) => {
    box("crate-" + id, x, z, w, d, y, h, tone, "wood");
    box("crate-lid-" + id, x, z, w + 0.06, d + 0.06, y + h, 0.045, "#7d6041", "wood", true);
    for (const side of [-1, 1]) {
      box("crate-band-" + id + "-" + side, x + side * w * 0.34, z, 0.08, d + 0.03, y, h + 0.02, "#4d463e", "metal", true);
    }
  };

  // Helper: Stacked sandbag cluster (decorative or low tactical trim)
  const sandbags = (id: string, x: number, z: number, y: number, alongX: boolean, detail = true) => {
    for (let row = 0; row < 2; row++) {
      for (let i = -1; i <= 1; i++) {
        const u = i * 0.56 + (row % 2) * 0.14;
        const px = alongX ? x + u : x;
        const pz = alongX ? z : z + u;
        box(
          `sandbag-${id}-${row}-${i}`,
          px,
          pz,
          alongX ? 0.52 : 0.34,
          alongX ? 0.34 : 0.52,
          y + row * 0.2,
          0.2,
          row === 0 ? "#b89f78" : "#c5ad86",
          "fabric",
          detail,
        );
      }
    }
  };

  // Helper: Moroccan sandstone archway (axis X = spanning along X; axis Z = spanning along Z)
  const archX = (id: string, x: number, z: number, width: number, height: number, base = 0, depth = 0.85) => {
    for (const side of [-1, 1]) {
      box(`${id}-pier-${side}`, x + (side * width) / 2, z, 0.68, depth, base, height, "#bda27e", "stone");
      box(`${id}-plinth-${side}`, x + (side * width) / 2, z, 0.82, depth + 0.12, base, 0.32, "#9f8769", "stone", true);
      box(`${id}-cap-${side}`, x + (side * width) / 2, z, 0.84, depth + 0.14, base + height - 0.18, 0.18, "#e3cca8", "stone", true);
      for (let i = 0; i < 4; i++) {
        box(
          `${id}-spandrel-${side}-${i}`,
          x + side * (width / 2 - 0.34 - i * 0.4),
          z,
          0.48,
          depth + 0.04,
          base + height - 0.52 + i * 0.14,
          0.62 - i * 0.1,
          "#d0b48d",
          "stone",
          true,
        );
      }
    }
    box(`${id}-entry-lintel`, x, z, width + 0.72, depth, base + height, 0.75, "#ccb28e", "plaster");
  };

  const archZ = (id: string, x: number, z: number, width: number, height: number, base = 0, depth = 0.85) => {
    for (const side of [-1, 1]) {
      box(`${id}-pier-${side}`, x, z + (side * width) / 2, depth, 0.68, base, height, "#bda27e", "stone");
      box(`${id}-plinth-${side}`, x, z + (side * width) / 2, depth + 0.12, 0.82, base, 0.32, "#9f8769", "stone", true);
      box(`${id}-cap-${side}`, x, z + (side * width) / 2, depth + 0.14, 0.84, base + height - 0.18, 0.18, "#e3cca8", "stone", true);
      for (let i = 0; i < 4; i++) {
        box(
          `${id}-spandrel-${side}-${i}`,
          x,
          z + side * (width / 2 - 0.34 - i * 0.4),
          depth + 0.04,
          0.48,
          base + height - 0.52 + i * 0.14,
          0.62 - i * 0.1,
          "#d0b48d",
          "stone",
          true,
        );
      }
    }
    box(`${id}-entry-lintel`, x, z, depth, width + 0.72, base + height, 0.75, "#ccb28e", "plaster");
  };

  // ============================================================================
  // 1. MAJOR ARCHWAYS & ARCHITECTURAL TRANSITIONS
  // ============================================================================
  archZ("a-ramp-arch", 37.5, -25.0, 7.0, 3.8, 0, 0.9);
  archX("connector-north-arch", -2.0, -2.5, 6.8, 3.6, 0, 0.85);
  archX("connector-south-arch", -2.0, -16.5, 6.8, 3.4, 1.2, 0.85);
  archZ("top-mid-arch", 18.2, 4.5, 8.2, 4.0, 0, 0.85);
  archX("underpass-mouth", -17.0, 23.6, 5.2, 2.75, 0, 0.8);
  archX("short-south-arch", -28.5, 19.2, 5.4, 3.4, 0, 0.85);
  archZ("short-west-arch", -29.8, 23.0, 6.0, 3.4, 0, 0.85);
  box("short-arcade-roof", -28.5, 22.8, 5.6, 7.2, 4.15, 0.36, "#cfb592", "stone", true);
  archX("palace-portico", 23.0, -44.0, 6.2, 2.8, 3.0, 0.85);
  archX("market-door-arch", -40.3, 19.0, 3.6, 3.1, 0, 0.72);
  archX("ct-market-arch", -40.0, -34.5, 6.4, 3.6, 0, 0.85);
  archZ("ticket-arch", 6.2, -40.0, 6.4, 3.8, 0, 0.85);

  // ============================================================================
  // 2. A SITE TACTICAL COVER: TETRIS, SANDWICH, STAIRS, DEFAULT, TRIPLE, FIREBOX, NINJA, TICKET
  //    Faithful to Mirage Reference Atlas IMAGE 05, 06, 08
  // ============================================================================
  // A Site Platform stone curbs & red bomb plant border
  box("a-platform-curb-n", 21.5, -27.05, 11.1, 0.24, 1.14, 0.12, "#b59b79", "stone", true);
  box("a-platform-curb-s", 21.5, -35.95, 11.1, 0.24, 1.14, 0.12, "#b59b79", "stone", true);
  box("a-platform-curb-w", 16.05, -31.5, 0.24, 9.1, 1.14, 0.12, "#b59b79", "stone", true);
  box("a-site-mark-n", 22.0, -28.6, 5.2, 0.16, 1.21, 0.02, "#b8452a", "stone", true);
  box("a-site-mark-s", 22.0, -34.4, 5.2, 0.16, 1.21, 0.02, "#b8452a", "stone", true);
  box("a-site-mark-w", 19.4, -31.5, 0.16, 5.8, 1.21, 0.02, "#b8452a", "stone", true);
  box("a-site-mark-e", 24.6, -31.5, 0.16, 5.8, 1.21, 0.02, "#b8452a", "stone", true);

  // A Stairs east parapet + Sandwich dividing wall (classic Mirage pocket between Stairs and Tetris!)
  box("a-stairs-east-parapet", 26.2, -24.5, 0.38, 4.6, 0, 1.9, "#cbb18e", "stone");
  box("a-stairs-parapet-cap", 26.2, -24.5, 0.48, 4.7, 1.9, 0.14, "#e2cfb3", "stone", true);
  box("sandwich-wall", 28.4, -20.5, 4.2, 0.42, 0, 2.25, "#c4aa86", "stone");
  box("sandwich-step-block", 27.6, -21.6, 1.1, 1.1, 0, 0.65, "#a78f72", "stone");

  // Tetris stepped crate stack (east of Sandwich, overlooking A Ramp & Stairs)
  crate("tetris-base", 31.6, -26.0, 0, 2.4, 2.1, 1.15, "#9c7c58");
  crate("tetris-mid", 32.0, -26.2, 1.15, 1.45, 1.5, 0.85, "#886947");
  crate("tetris-step-north", 31.4, -24.1, 0, 1.4, 1.2, 0.92, "#ae9677");

  // A Default (east edge of A Platform overlooking A Ramp)
  crate("a-default", 25.4, -29.2, 1.2, 1.55, 1.55, 1.85, "#607358");
  box("a-default-top", 25.4, -29.2, 1.32, 1.32, 3.05, 0.82, "#8c6e4d", "wood", true);

  // Triple Box (iconic 3-crate L-cluster on west/south-west A Platform)
  crate("triple-main", 18.8, -34.2, 1.2, 2.0, 1.5, 1.85, "#917250");
  crate("triple-wing", 17.5, -32.9, 1.2, 1.28, 1.32, 1.48, "#9e7f5c");
  box("triple-upper", 18.8, -34.2, 1.36, 1.28, 3.05, 0.95, "#7e6042", "wood", true);

  // Firebox & Ninja corner (south-east corner of A Platform)
  crate("firebox-base", 25.8, -34.6, 1.2, 1.6, 1.45, 1.55, "#957553");
  box("firebox-upper", 25.9, -34.6, 1.22, 1.18, 2.75, 0.92, "#7f6243", "wood", true);
  // Ninja protective low cover tucked behind Firebox
  crate("ninja-crate", 27.9, -35.0, 0.55, 1.25, 1.25, 1.4, "#8a6d4d");

  // Shadow / Under Palace Balcony cover
  crate("shadow-box", 18.4, -41.5, 0, 1.75, 1.6, 1.55, "#7e6245");
  cyl("a-ramp-barrel-1", 36.8, -30.4, 0.66, 0.66, 0, 1.05, "#4e696b", "metal");
  cyl("a-ramp-barrel-2", 36.8, -31.2, 0.66, 0.66, 0, 1.05, "#87593d", "metal");

  // Ticket Booth (CT approach to A Site, iconic turquoise/slate kiosk with roof & shutter)
  box("ticket-booth", 8.2, -41.8, 2.3, 2.35, 0, 2.65, "#6b8b8c", "plaster");
  box("ticket-roof", 8.2, -41.8, 2.65, 2.7, 2.65, 0.24, "#4e6668", "metal", true);
  box("ticket-shutter", 8.2, -40.6, 1.65, 0.08, 1.15, 0.85, "#3b5257", "metal", true);
  box("ticket-counter", 8.2, -40.5, 1.8, 0.22, 1.04, 0.12, "#d2bc9d", "stone", true);
  crate("ticket-box", 10.1, -41.8, 0, 1.25, 1.25, 1.42, "#927452");
  crate("ct-trash-box", 5.8, -37.2, 0, 1.15, 1.35, 1.15, "#687a62");

  // Palace Interior Columns, Wall Tile Band, Ceiling Joists & Balcony Pergola (IMAGE 05, 06, 08)
  for (const x of [26.0, 33.0]) {
    box(`palace-column-${x}`, x, -48.6, 0.72, 0.72, 3.0, 3.2, "#d8ba96", "stone");
    box(`palace-column-base-${x}`, x, -48.6, 0.94, 0.94, 3.0, 0.28, "#ab8e6c", "stone", true);
    box(`palace-column-cap-${x}`, x, -48.6, 0.98, 0.98, 5.92, 0.28, "#e8cfa9", "stone", true);
  }
  for (const x of [21, 25, 29, 33, 37, 41]) {
    box(`palace-beam-${x}`, x, -47.5, 0.22, 6.8, 5.95, 0.25, "#6d5239", "wood", true);
  }
  box("palace-tile-band-s", 31.0, -50.8, 24.0, 0.06, 4.25, 0.3, "#36687a", "stone", true);
  // Palace Balcony wooden pergola & iron side railings
  for (const x of [19.8, 26.2]) {
    box(`palace-rail-${x}`, x, -43.1, 0.12, 1.8, 3.0, 0.75, "#47413c", "metal", true);
    box(`palace-pergola-beam-${x}`, x, -42.9, 0.22, 2.6, 5.55, 0.22, "#6c5239", "wood", true);
  }
  for (let z = -43.8; z <= -41.8; z += 0.5) {
    box(`palace-pergola-slat-${z.toFixed(1)}`, 23.0, z, 7.2, 0.14, 5.77, 0.1, "#7c6044", "wood", true);
  }
  crate("palace-corner-crate", 36.2, -49.6, 3.0, 1.35, 1.35, 1.25, "#8f714f");

  // ============================================================================
  // 3. MIDDLE: TOP MID BOXES / CART, CHAIR, MID BOXES, UNDER-WINDOW BENCH, CATWALK AWNINGS
  //    Faithful to Mirage Reference Atlas IMAGE 05, 11, 12
  // ============================================================================
  // Top Mid Boxes & wooden hand-cart (classic Mirage Top Mid cover)
  crate("top-mid-boxes", 14.5, 2.2, 0.6, 2.2, 1.65, 1.32, "#927351");
  box("top-mid-cart-top", 14.7, 2.2, 1.48, 1.35, 1.92, 0.68, "#627359", "wood", true);
  box("top-mid-cart-handle", 16.0, 2.2, 0.9, 0.12, 1.15, 0.1, "#6c523a", "wood", true);
  cyl("top-mid-wheel-l", 14.2, 3.1, 0.62, 0.16, 0.6, 0.62, "#323432", "metal", true);
  cyl("top-mid-wheel-r", 14.2, 1.3, 0.62, 0.16, 0.6, 0.62, "#323432", "metal", true);

  // Chair cubby along south Mid wall (classic Mirage Chair position!)
  box("mid-chair-alcove-w", 4.2, 0.2, 0.45, 2.1, 0, 2.2, "#c8ae8a", "plaster");
  box("mid-chair-alcove-e", 7.8, 0.2, 0.45, 2.1, 0, 2.2, "#c8ae8a", "plaster");
  box("mid-chair-seat", 6.0, 0.15, 0.95, 0.85, 0, 0.56, "#8d6d4c", "wood");
  box("mid-chair-back", 6.0, -0.22, 0.95, 0.14, 0.56, 0.68, "#795b3e", "wood", true);
  sandbags("mid-chair-bags", 8.8, 0.2, 0, true);

  // Mid Boxes (central Mid cover between Connector and Window, leaves Connector mouth & Top Mid -> Window AWP sightline OPEN!)
  crate("mid-box-main", -7.2, 2.2, 0, 1.75, 1.65, 1.48, "#967754");
  crate("mid-box-step", -5.6, 2.2, 0, 1.15, 1.25, 0.82, "#876948");

  // Under-Window boost bench & Mid-side barrels (IMAGE 11)
  box("window-under-bench", -23.85, 1.2, 1.25, 1.6, 0, 0.95, "#9c7e5b", "wood");
  crate("window-boost-crate", -23.95, 3.8, 0, 1.15, 1.35, 1.0, "#8d6f4e");
  cyl("mid-barrel-1", -11.5, 0.2, 0.64, 0.64, 0, 1.0, "#506a6c", "metal");

  // Catwalk Mid Box, Overhead Awnings, Street Posts & Cables (IMAGE 11, 12)
  crate("catwalk-mid-box", -4.5, 14.8, 0.45, 1.3, 1.15, 1.25, "#987a58");
  crate("short-corner-box", -30.5, 24.5, 0, 1.45, 1.55, 1.35, "#937452");
  box("short-corner-top", -30.5, 24.5, 1.15, 1.22, 1.35, 0.72, "#7e6143", "wood", true);
  box("catwalk-awning-e", 4.5, 15.2, 5.8, 1.5, 4.2, 0.16, "#9e4838", "fabric", true);
  box("catwalk-awning-w", -8.5, 15.2, 5.6, 1.5, 4.6, 0.16, "#3a6674", "fabric", true);
  box("catwalk-corner-post", -24.8, 15.4, 0.28, 0.28, 0, 4.7, "#5e4c3b", "wood", true);
  // Overhead Mid utility wires spanning north-south across the street
  box("mid-wire-1", -12.0, 7.5, 0.06, 17.0, 6.1, 0.06, "#26282a", "metal", true);
  box("mid-wire-2", 0.0, 7.5, 0.06, 17.0, 6.25, 0.06, "#26282a", "metal", true);
  box("mid-wire-3", 11.0, 7.5, 0.06, 17.0, 6.15, 0.06, "#26282a", "metal", true);

  // Connector & Jungle interior details
  for (const z of [-14.5, -11.5, -8.5, -5.5]) {
    box(`connector-joist-${z}`, -2.0, z, 7.6, 0.2, 3.75, 0.24, "#80664d", "wood", true);
  }
  box("connector-cornice-n", -2.0, -2.5, 8.2, 0.28, 4.0, 0.28, "#e2d0b4", "stone", true);
  box("connector-cornice-s", -2.0, -16.5, 8.2, 0.28, 4.0, 0.28, "#e2d0b4", "stone", true);
  box("jungle-cubby-pillar", -25.8, -16.2, 0.65, 1.85, 0, 3.8, "#c7b090", "stone");
  box("jungle-arch-beam", -29.0, -16.2, 7.8, 0.48, 3.4, 0.56, "#b89f7d", "stone", true);
  // Window & Ladder Room vent trim + visual ladder rungs
  box("window-vent-frame-l", -30.5, 8.0, 0.5, 0.45, 2.0, 2.2, "#5b6469", "metal", true);
  box("window-vent-frame-r", -26.8, 8.0, 0.5, 0.45, 2.0, 2.2, "#5b6469", "metal", true);
  box("window-vent-lintel", -28.65, 8.0, 4.2, 0.45, 4.2, 0.6, "#4d565b", "metal", true);
  for (let i = 0; i < 7; i++) {
    box(`ladder-rung-${i}`, -30.72, 10.6, 0.1, 0.78, 0.55 + i * 0.34, 0.055, "#65513d", "metal", true);
  }

  // Underpass ceramic Moroccan wainscot & blue tile band
  for (const side of [-1, 1]) {
    box(`underpass-wainscot-${side}`, -17.0 + side * 2.86, 19.5, 0.06, 15.0, 0, 1.25, "#dfd7c6", "stone", true);
    box(`underpass-tile-band-${side}`, -17.0 + side * 2.84, 19.5, 0.08, 15.0, 1.25, 0.28, "#356679", "stone", true);
  }

  // ============================================================================
  // 4. B SITE: CENTRAL GREEN CANOPY, VAN, DEFAULT, E-BOX, BENCH, BACK SITE, MARKET, B APPS
  //    Faithful to Mirage Reference Atlas IMAGE 07, 09, 10
  // ============================================================================
  // Subtle B Site stone plant plinth (0.14m curb step, trivially walked over without jumping)
  box("b-site-plinth", -39.0, 25.5, 7.0, 6.6, 0, 0.14, "#c5ad8c", "stone");
  box("b-site-mark-n", -39.0, 28.4, 5.4, 0.16, 0.15, 0.02, "#b8452a", "stone", true);
  box("b-site-mark-s", -39.0, 22.6, 5.4, 0.16, 0.15, 0.02, "#b8452a", "stone", true);
  box("b-site-mark-w", -41.7, 25.5, 0.16, 5.8, 0.15, 0.02, "#b8452a", "stone", true);
  box("b-site-mark-e", -36.3, 25.5, 0.16, 5.8, 0.15, 0.02, "#b8452a", "stone", true);

  // Central B Site Green-Tarped Canopy Pergola (IMAGE 07, 09, 10)
  box("b-canopy-tarp", -39.0, 25.5, 6.2, 6.6, 4.25, 0.18, "#597354", "fabric", true);
  box("b-canopy-frame-n", -39.0, 28.7, 6.3, 0.24, 4.05, 0.22, "#6c533c", "wood", true);
  box("b-canopy-frame-s", -39.0, 22.3, 6.3, 0.24, 4.05, 0.22, "#6c533c", "wood", true);
  box("b-canopy-frame-w", -42.05, 25.5, 0.24, 6.6, 4.05, 0.22, "#6c533c", "wood", true);
  box("b-canopy-frame-e", -35.95, 25.5, 0.24, 6.6, 4.05, 0.22, "#6c533c", "wood", true);
  for (const [px, pz] of [
    [-41.9, 28.5],
    [-36.1, 28.5],
    [-41.9, 22.5],
    [-36.1, 22.5],
  ] as const) {
    box(`b-canopy-post-${px}-${pz}`, px, pz, 0.26, 0.26, 0.14, 4.0, "#7b634b", "wood");
  }

  // B Site Tactical Crates: B Default, E-Box, Pillar Box, Back Site / Forest Cover
  crate("b-default", -41.0, 26.2, 0.14, 1.65, 1.7, 1.52, "#607358");
  box("b-default-top", -41.0, 26.2, 1.32, 1.36, 1.66, 0.84, "#8d6f4e", "wood", true);
  crate("b-ebox", -35.8, 28.1, 0.14, 1.5, 1.5, 1.68, "#917352");
  box("b-ebox-top", -35.8, 28.1, 1.24, 1.24, 1.82, 0.82, "#5c6d54", "wood", true);
  crate("b-pillar-box", -41.2, 22.4, 0.14, 1.45, 1.45, 1.55, "#967754");
  crate("b-back-site-box", -45.6, 21.8, 0, 1.55, 1.65, 1.45, "#876a4a");

  // B Bench & Red Corner Tarp (west side of B Site, IMAGE 07, 09)
  crate("b-bench", -45.7, 28.2, 0, 1.0, 3.4, 0.6, "#b29879");
  box("b-bench-back", -46.5, 28.2, 0.36, 3.8, 0.6, 0.9, "#9f8465", "stone", true);
  box("b-bench-red-tarp", -45.0, 24.4, 3.2, 4.0, 3.9, 0.15, "#a6483c", "fabric", true);
  sandbags("b-bench-bags", -45.5, 25.2, 0, false);

  // Iconic B Apartments White Delivery Van (climbable hood -> roof -> Apps Balcony! IMAGE 07, 09)
  // Positioned at x=-43.4, z=29.8..32.6 right beside Balcony (z=31.6..33.0, y=2.4)
  box("van-body", -43.4, 30.9, 2.25, 3.5, 0.25, 1.75, "#e0dcd0", "metal");
  box("van-cab-hood", -43.4, 28.65, 2.15, 1.05, 0.25, 0.85, "#e0dcd0", "metal"); // y top = 1.10m (easy jump from ground)
  box("van-roof-rack", -43.4, 31.0, 2.0, 2.9, 2.0, 0.08, "#565a5c", "metal", true);
  box("van-windscreen", -43.4, 29.15, 1.88, 0.08, 1.18, 0.56, "#466169", "glass", true);
  box("van-grille", -43.4, 28.1, 1.65, 0.06, 0.45, 0.38, "#323638", "metal", true);
  box("van-bumper", -43.4, 28.05, 2.25, 0.14, 0.28, 0.2, "#323638", "metal", true);
  for (const x of [-44.45, -42.35]) {
    for (const z of [29.0, 32.0]) {
      cyl(`van-wheel-${x}-${z}`, x, z, 0.44, 0.68, 0.0, 0.66, "#2c2e2b", "metal", true);
    }
  }

  // Market (Kitchen/Shop) Interior Counter, Shelves, Striped Awning & Ceiling Joists
  box("market-awning", -40.3, 19.6, 4.2, 1.5, 3.18, 0.16, "#9e483d", "fabric", true);
  box("market-counter", -44.8, 14.0, 1.0, 4.6, 0, 1.05, "#876c54", "wood");
  box("market-countertop", -44.8, 14.0, 1.12, 4.72, 1.05, 0.14, "#be9e74", "wood");
  box("market-shelf-east", -34.2, 13.5, 0.6, 4.2, 0, 2.35, "#745b44", "wood", true);
  box("market-window-shutter-l", -36.55, 19.36, 0.36, 0.08, 0.95, 1.75, "#3f6968", "wood", true);
  box("market-window-shutter-r", -34.45, 19.36, 0.36, 0.08, 0.95, 1.75, "#3f6968", "wood", true);
  for (const x of [-43.0, -39.5, -36.0]) {
    box(`market-joist-${x}`, x, 14.0, 0.16, 9.6, 3.62, 0.24, "#79614c", "wood", true);
  }

  // B Apartments Balcony trim, Awning, Interior Ceiling Joists, Kitchen Appliances & Barrels
  box("apps-balcony-beam", -38.5, 31.6, 6.2, 0.28, 2.18, 0.24, "#6f553e", "wood", true);
  box("apps-balcony-awning", -38.5, 31.4, 6.4, 0.95, 5.42, 0.16, "#8c4a3b", "fabric", true);
  for (const x of [-38, -31, -24, -17, -10, -3, 4]) {
    box(`apps-joist-${x}`, x, 36.5, 0.18, 6.8, 5.36, 0.24, "#876851", "wood", true);
  }
  box("apps-kitchen-stove", -8.5, 39.2, 2.2, 0.85, 2.4, 0.95, "#b8b4aa", "metal", true);
  box("apps-kitchen-cabinet", -12.2, 39.2, 3.0, 0.8, 2.4, 0.95, "#7c5e44", "wood", true);
  cyl("apps-barrel-1", 4.5, 39.0, 0.65, 0.65, 2.4, 0.95, "#7f5d3e", "wood");
  cyl("apps-barrel-2", 5.3, 39.0, 0.65, 0.65, 2.4, 0.95, "#745437", "wood");
  crate("back-alley-crate", 7.2, 30.5, 0, 1.25, 1.25, 1.15, "#8e704f");

  // T Spawn & CT Spawn tactical ambiance
  sandbags("t-spawn-bags", 44.0, 14.8, 0, true);
  cyl("t-spawn-barrel-1", 50.6, 13.8, 0.66, 0.66, 0, 1.0, "#4f686a", "metal");
  cyl("t-spawn-barrel-2", 50.6, 12.9, 0.66, 0.66, 0, 1.0, "#8a5a3f", "metal");
  crate("ct-spawn-supply", -16.5, -45.4, 0, 1.8, 1.35, 1.25, "#607358");
  cyl("ct-spawn-barrel", -38.0, -45.5, 0.66, 0.66, 0, 1.0, "#4e6769", "metal");

  // ============================================================================
  // 5. MOROCCAN SKYLINE TOWERS, PALACE GOLD DOME & B-SIDE MINARET
  //    Strictly positioned OUTSIDE all playable blocks (verified by unit test!)
  // ============================================================================
  const skylineTowers: readonly [number, number, number, number, number, string][] = [
    [48, 22, 8, 6, 12.5, "#d8ba96"],
    [-39, 46, 9, 6, 11.5, "#cda284"],
    [-51, -40, 6, 8, 10.5, "#e0c8a4"],
    [32, -55, 10, 5, 13.5, "#d4b592"],
    [-12, -31, 6, 6, 10.8, "#c9a684"],
    [10, -51, 8, 5, 11.5, "#dbb994"],
    [-52, 16, 6, 9, 11.0, "#cba082"],
    [3, 22, 8, 6, 10.2, "#dfc5a1"],
    [32, 22, 9, 7, 11.2, "#d2b08d"],
  ];
  for (const [i, [x, z, w, d, h, tone]] of skylineTowers.entries()) {
    box(`skyline-mass-${i}`, x, z, w, d, 0, h, tone, "plaster", true);
    box(`skyline-cornice-${i}`, x, z, w + 0.42, d + 0.42, h - 0.26, 0.26, "#e8d0b2", "stone", true);
    box(`skyline-parapet-${i}`, x, z, w - 0.36, d - 0.36, h, 0.58, "#c8aa8a", "stone", true);
    for (const offset of [-2, 0, 2]) {
      box(`skyline-shutter-${i}-${offset}`, x + offset, z - d / 2 - 0.04, 0.92, 0.12, h - 2.4, 1.2, "#3f6565", "wood", true);
    }
  }
  // Palace Gold-Domed Cupola (IMAGE 05, 08)
  cyl("palace-dome-drum", 32, -55, 4.8, 4.8, 13.5, 1.9, "#ddc6a4", "stone", true);
  cyl("palace-dome-crown", 32, -55, 3.9, 3.9, 15.4, 1.4, "#c89d4e", "metal", true);
  cone("palace-dome-spire", 32, -55, 3.6, 16.8, 1.6, "#cfa557", "metal", true);
  // B-Side Moroccan Minaret Tower (IMAGE 05, 09)
  box("b-minaret-shaft", -39, 46, 3.0, 3.0, 11.5, 4.5, "#d2b695", "stone", true);
  box("b-minaret-lantern", -39, 46, 2.1, 2.1, 16.0, 1.8, "#e3cca9", "stone", true);
  cone("b-minaret-cap", -39, 46, 2.2, 17.8, 1.8, "#3e6c69", "metal", true);

  // ============================================================================
  // 6. AUTHENTIC DIRECTIONAL SITE MARKERS (A / B)
  // ============================================================================
  sign("site-a", 13.0, 3.6, -43.4, 3.4, 0.14, 0.72, "#51413a", "BOMBSITE A · PALACE");
  sign("site-b", -40.3, 3.65, 19.45, 3.4, 0.14, 0.72, "#51413a", "BOMBSITE B · MARKET");
  sign("mid-dir", 10.2, 3.6, 9.6, 3.4, 0.14, 0.72, "#51413a", "← B SHORT   A SITE →");
}
