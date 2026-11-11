import type { BombSite, MapDefinition, Solid, Vec3 } from "./types";

/**
 * Bolluca (2) — 100% Pure CS:GO Mirage Reference PDF Reconstruction.
 * Built from scratch strictly from KapsApp_Mirage_3D_Gorsel_Referans_Kitabi.pdf (Pages 4–17):
 * - Page 4: Official DE_MIRAGE top-down radar
 * - Page 5: Annotated Mirage callout map (Full layout & callouts)
 * - Page 6: Modern labeled Mirage minimap
 * - Page 7: Tactical callout map
 * - Page 8: Four-angle 3D Mirage miniature (solid 3D Moroccan city block massing)
 * - Page 9: A site - from A ramp (Tetris, Sandwich, Stairs, Jungle, Connector, Balcony, Default, Ticket)
 * - Page 10: B site - from B short (Arches, Empty/Pillar, E-Box, Default, B Canopy, Bench/Jail, Van, Apartments)
 * - Page 11: A site - from Connector (Triple Box, Default, Firebox, Palace Balcony, Shadow, Ticket Booth)
 * - Page 12: B site - from B apartments (Balcony, Van, Bench, Default, B Canopy, Market Window, Market Door, Arches)
 * - Page 13: B site - from interior arch (Catwalk / B Short brick arches looking into B Site)
 * - Page 14: Jungle / Stairs / Connector view
 * - Page 15: Middle (Mid) - main corridor view (Top Mid Cart, Chair, Catwalk, Underpass, Sniper's Nest Window)
 * - Page 16–17: Palace interior pillars & Market/Kitchen interior
 */
export const BOLLUCA2_BOMB_SITES: readonly BombSite[] = [
  { id: "A", x: 9.5, y: 0, z: -30.5, radius: 4.5 },
  { id: "B", x: -32.0, y: 0, z: 20.5, radius: 4.5 },
] as const;

type Block = readonly [west: number, east: number, south: number, north: number, floor?: number, roof?: number];

// Walkable sectors directly mapped to CS:GO Mirage radar (East = +x T Spawn, South-East = A Site, North-West = B Site, South-West = CT Spawn)
const MIRAGE_SECTORS: Record<string, Block> = {
  // T Side (East)
  tSpawn: [30, 44, -8, 12, 0],
  tRoofRamp: [22, 30, 8, 16, 0],
  tRoof: [14, 22, 12, 22, 1.2],
  backAlley: [4, 14, 20, 28, 1.2],
  topMid: [14, 30, -2, 8, 0],
  tPalaceAlley: [28, 38, -28, -8, 0],
  palaceEntry: [28, 38, -39, -28, 1.6, 5.8],

  // Mid, Catwalk, Window, Underpass, Connector (Center)
  mid: [-12, 14, -2, 8, 0],
  catwalkEast: [4, 14, 8, 13, 0],
  catwalkRamp: [-4, 4, 8, 13, 0],
  catwalkWest: [-14, -4, 8, 12.5, 1.2],
  windowRoom: [-22, -12, 0, 8, 1.6, 5.2],
  ladderRoom: [-20, -14, 8, 15, 1.2, 5.2],
  underpass: [-12, -5, 12.5, 22, 0, 4.5],
  connectorRamp: [-4, 3, -11, -2, 0, 5.2],
  connectorLanding: [-4, 3, -21, -11, 1.2, 5.2],

  // Jungle, Stairs, Sandwich, Tetris, A Ramp, Palace, A Site, Ticket, CT Spawn (South)
  windowJungleLink: [-20, -13, -11, 0, 1.2, 5.2],
  jungle: [-18, -4, -21, -11, 1.2, 5.2],
  aStairs: [3, 8.5, -21, -13, 1.2],
  sandwich: [8.5, 12.5, -21, -14, 0],
  tetris: [12.5, 18, -22, -14, 0],
  aRamp: [18, 28, -22, -14, 0],
  palaceHall: [21, 34, -39, -28, 1.6, 5.8],
  palaceBalcony: [14, 21, -39, -28, 0],
  aSite: [-18, 18, -39, -21, 0],
  ctSouth: [-24, -18, -39, -21, 0],
  ctJungleRamp: [-24, -18, -21, -11, 0],
  ctSpawn: [-35, -24, -36, -10, 0],
  ctMarketLink: [-35, -26, -10, 0, 0],

  // B Apartments, B Short, B Site, Market / Kitchen (North-West)
  bAptsEast: [-12, 4, 22, 30, 1.2, 5.0],
  bKitchen: [-18, -8, 30, 35, 1.2, 5.0],
  bAptsCorridor: [-32, -12, 26, 32, 1.2, 5.0],
  bBalcony: [-38, -32, 25, 31, 0],
  bShort: [-24, -14, 12, 26, 1.2],
  bSite: [-43, -24, 12, 29, 0],
  market: [-38, -25, 0, 12, 0, 5.2],
};

const blocks: readonly Block[] = Object.values(MIRAGE_SECTORS);

function insideAny(x: number, z: number, pad = 0): boolean {
  return blocks.some(([w, e, s, n]) => x >= w - pad && x <= e + pad && z >= s - pad && z <= n + pad);
}

/** Merge exposed perimeter segments of all walkable sectors into tall Moroccan facade walls. */
function buildPerimeterWalls(box: (id: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, detail?: boolean, surface?: Solid["surface"]) => Solid) {
  const xs = [...new Set(blocks.flatMap(([w, e]) => [w, e]))].sort((a, b) => a - b);
  const zs = [...new Set(blocks.flatMap(([, , s, n]) => [s, n]))].sort((a, b) => a - b);
  const colors = ["#f0e2c8", "#e4c299", "#deb28a", "#ece0ca"];
  let id = 0;

  for (const x of xs) {
    let start: number | undefined;
    for (let i = 0; i < zs.length - 1; i++) {
      const z0 = zs[i], z1 = zs[i + 1], mid = (z0 + z1) / 2;
      const exposed = insideAny(x - 0.05, mid) !== insideAny(x + 0.05, mid);
      if (exposed && start === undefined) start = z0;
      if ((!exposed || i === zs.length - 2) && start !== undefined) {
        const end = exposed ? z1 : z0;
        const zc = (start + end) / 2, len = end - start;
        const h = 6.8 + (id % 3) * 0.7;
        box(`bolluca2-facade-${++id}`, x, 0, zc, 0.64, h, len + 0.64, colors[id % 4], false, "plaster");
        box(`bolluca2-cornice-${id}`, x, h, zc, 0.92, 0.28, len + 0.86, "#b54b35", true, "wood");
        box(`bolluca2-frieze-${id}`, x, 3.85, zc, 0.74, 0.16, len + 0.7, "#8c5a3c", true, "wood");
        box(`bolluca2-plinth-${id}`, x, 0, zc, 0.72, 1.15, len + 0.68, "#b89b74", true, "stone");
        start = undefined;
      }
    }
  }
  for (const z of zs) {
    let start: number | undefined;
    for (let i = 0; i < xs.length - 1; i++) {
      const x0 = xs[i], x1 = xs[i + 1], mid = (x0 + x1) / 2;
      const exposed = insideAny(mid, z - 0.05) !== insideAny(mid, z + 0.05);
      if (exposed && start === undefined) start = x0;
      if ((!exposed || i === xs.length - 2) && start !== undefined) {
        const end = exposed ? x1 : x0;
        const xc = (start + end) / 2, len = end - start;
        const h = 6.8 + (id % 3) * 0.7;
        box(`bolluca2-facade-${++id}`, xc, 0, z, len + 0.64, h, 0.64, colors[id % 4], false, "plaster");
        box(`bolluca2-cornice-${id}`, xc, h, z, len + 0.86, 0.28, 0.92, "#b54b35", true, "wood");
        box(`bolluca2-frieze-${id}`, xc, 3.85, z, len + 0.7, 0.16, 0.74, "#8c5a3c", true, "wood");
        box(`bolluca2-plinth-${id}`, xc, 0, z, len + 0.68, 1.15, 0.72, "#b89b74", true, "stone");
        start = undefined;
      }
    }
  }
}

/**
 * Fill all non-walkable city blocks between corridors with solid 3D Moroccan buildings
 * matching the Four-Angle 3D Mirage Miniature on PDF Page 8.
 */
function buildSolidCityMassing(box: (id: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, detail?: boolean, surface?: Solid["surface"]) => Solid) {
  const step = 2;
  const xMin = -46, xMax = 46, zMin = -42, zMax = 38;
  const cols = (xMax - xMin) / step;
  const rows = (zMax - zMin) / step;
  const blocked: boolean[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cx = xMin + (c + 0.5) * step;
      const cz = zMin + (r + 0.5) * step;
      return !insideAny(cx, cz, 0.35);
    })
  );
  const used = blocked.map(r => r.map(() => false));
  const tones = ["#f0e2c8", "#e2be94", "#eddcc2", "#d9ad82"];
  let bId = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!blocked[r][c] || used[r][c]) continue;
      let w = 1, d = 1;
      while (w < 12 && c + w < cols && blocked[r][c + w] && !used[r][c + w]) w++;
      outer: while (d < 12 && r + d < rows) {
        for (let k = 0; k < w; k++) if (!blocked[r + d][c + k] || used[r + d][c + k]) break outer;
        d++;
      }
      for (let dr = 0; dr < d; dr++) for (let dc = 0; dc < w; dc++) used[r + dr][c + dc] = true;
      const bw = w * step, bd = d * step;
      const bx = xMin + (c + w / 2) * step;
      const bz = zMin + (r + d / 2) * step;
      const h = 6.6 + ((r + c) % 4) * 0.65;
      const col = tones[(r + c) % tones.length];
      box(`bolluca2-city-block-${++bId}`, bx, 0, bz, bw, h, bd, col, false, "plaster");
      box(`bolluca2-city-roof-${bId}`, bx, h, bz, bw + 0.18, 0.24, bd + 0.18, "#b54b35", true, "wood");
      if (bw >= 6 && bd >= 6) {
        box(`bolluca2-city-upper-${bId}`, bx, h + 0.24, bz, bw * 0.68, 1.6, bd * 0.68, "#f5ead6", true, "plaster");
        box(`bolluca2-city-upper-trim-${bId}`, bx, h + 1.84, bz, bw * 0.72, 0.22, bd * 0.72, "#b54b35", true, "wood");
      }
    }
  }
}

export function bolluca2(): MapDefinition {
  const solids: Solid[] = [];
  const box = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, detail = false, surface: Solid["surface"] = "stone"): Solid => {
    const finalId = id.startsWith("bolluca") ? id : `bolluca2-${id}`;
    const s: Solid = { id: finalId, kind: "box", x, y, z, w, h, d, color, detail, surface };
    solids.push(s);
    return s;
  };
  const ramp = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, axis: "x" | "z", reverse = false, color = "#ccb596"): Solid => {
    const finalId = id.startsWith("bolluca") ? id : `bolluca2-${id}`;
    const s: Solid = { id: finalId, kind: "ramp", x, y, z, w, h, d, axis, reverse, color, surface: "stone" };
    solids.push(s);
    return s;
  };
  const crate = (id: string, x: number, y: number, z: number, w: number, h: number, d: number, color = "#9c7a52") => {
    box(id, x, y, z, w, h, d, color, false, "wood");
    box(`${id}-lid`, x, y + h, z, w + 0.06, 0.06, d + 0.06, "#7b5d3b", true, "wood");
    box(`${id}-band-t`, x, y + h * 0.76, z, w + 0.05, 0.06, d + 0.05, "#474c50", true, "metal");
    box(`${id}-band-b`, x, y + h * 0.24, z, w + 0.05, 0.06, d + 0.05, "#474c50", true, "metal");
  };

  // 1. Sector Floor Decks & Interior Roofs
  let deckIdx = 0;
  for (const [name, [w, e, s, n, floor = 0, roof]] of Object.entries(MIRAGE_SECTORS)) {
    const cx = (w + e) / 2, cz = (s + n) / 2, bw = e - w, bd = n - s;
    if (floor > 0) {
      box(`bolluca-deck-${name}-${++deckIdx}`, cx, 0, cz, bw, floor, bd, "#ccb596", false, "stone");
    }
    if (roof) {
      box(`bolluca-roof-${name}-${deckIdx}`, cx, roof, cz, bw + 0.4, 0.36, bd + 0.4, "#c8a982", false, "plaster");
    }
  }

  // Elevated Overhang Decks (Palace Balcony at y=1.6 with Shadow underneath, and B Balcony at y=1.2)
  box("bolluca-deck-palace-balcony", 17.5, 1.35, -33.5, 7.0, 0.25, 11.0, "#8f6d48", false, "wood");
  box("bolluca-deck-b-balcony", -35.0, 0.96, 28.0, 6.0, 0.24, 6.0, "#8f6d48", false, "wood");

  // 2. Smooth Walkable Ramps & Staircases Connecting Every Elevation Level
  // T Spawn (x=30, y=0) -> T Roof (x=22, y=1.2)
  ramp("bolluca-slope-t-roof", 26.0, 0, 12.0, 8.0, 1.2, 8.0, "x", true);
  // T Palace Alley (z=-22, y=0) -> Palace Entry (z=-28, y=1.6)
  ramp("bolluca-slope-palace-entry", 33.0, 0, -25.0, 10.0, 1.6, 6.0, "z", true);
  // Mid Catwalk East (x=4, y=0) -> Catwalk West / B Short (x=-4, y=1.2)
  ramp("bolluca-slope-catwalk", 0.0, 0, 10.5, 8.0, 1.2, 5.0, "x", true);
  // Underpass (z=15, y=0) -> B Apartments East (z=22, y=1.2)
  ramp("bolluca-slope-underpass-apts", -8.5, 0, 18.5, 6.0, 1.2, 7.0, "z", false);
  // Connector: Mid (z=-2, y=0) -> Connector/Jungle/A Stairs Landing (z=-11, y=1.2)
  ramp("bolluca-slope-connector", -0.5, 0, -6.5, 7.0, 1.2, 9.0, "z", true);
  // Connector/Jungle Landing (z=-21, y=1.2) -> A Site North (z=-27, y=0)
  ramp("bolluca-slope-jungle-asite", -4.5, 0, -24.0, 9.0, 1.2, 6.0, "z", false);
  // Window-Jungle Link (z=-5, y=1.2) -> Sniper's Nest Window (z=0, y=1.6)
  ramp("bolluca-slope-jungle-window", -16.5, 1.2, -2.5, 7.0, 0.4, 5.0, "z", false);
  // Ladder Room (z=11.5, y=1.2) -> Sniper's Nest Window (z=8.0, y=1.6)
  ramp("bolluca-slope-ladder-window", -17.0, 1.2, 9.75, 6.0, 0.4, 3.5, "z", true);
  // CT Spawn (x=-24, y=0) -> Jungle (x=-18, y=1.2)
  ramp("bolluca-slope-ct-jungle", -21.0, 0, -16.0, 6.0, 1.2, 10.0, "x", false);
  // B Short South (x=-24, y=1.2) -> B Site East Arch Entry (x=-28.5, y=0)
  ramp("bolluca-slope-bshort-bsite", -26.25, 0, 21.75, 4.5, 1.2, 4.2, "x", false);
  // B Balcony Steps down to B Site by Van (z=25, y=1.2 -> z=21.5, y=0)
  ramp("bolluca-slope-bbalcony-drop", -35.5, 0, 23.25, 3.6, 1.2, 3.5, "z", false);
  // Palace Balcony South Steps down to A Site / Shadow (x=14, y=1.6 -> x=8.5, y=0)
  ramp("bolluca-slope-palace-drop", 11.25, 0, -33.5, 5.5, 1.6, 3.6, "x", false);

  // 3. Perimeter Facades & Solid 3D Moroccan City Massing (PDF Page 8)
  buildPerimeterWalls(box);
  buildSolidCityMassing(box);

  // 4. Doorway Lintels & Arch Portals (Matching Mirage arches)
  for (const [id, x, y, z, w, d] of [
    ["entry-lintel-connector-mid", -0.5, 3.8, -2.0, 6.2, 0.65],
    ["entry-lintel-palace-exit", 21.0, 4.4, -32.5, 0.65, 5.2],
    ["entry-lintel-a-ramp", 18.0, 4.0, -18.0, 0.65, 6.8],
    ["entry-lintel-market-door", -35.8, 3.4, 12.0, 3.2, 0.65],
    ["entry-lintel-b-apts", -32.0, 4.0, 28.5, 0.65, 4.6],
    ["entry-lintel-underpass-mid", -8.5, 3.4, 12.5, 5.8, 0.65],
  ] as const) {
    box(id, x, y, z, w, 1.2, d, "#e6cfb0", false, "stone");
    box(`${id}-trim`, x, y - 0.12, z, w + 0.12, 0.14, d + 0.12, "#b54b35", true, "wood");
  }

  // ============================================================================
  // 5. A SITE, TETRIS, SANDWICH, STAIRS, JUNGLE, CONNECTOR, PALACE & TICKET
  //    Strictly matching PDF Pages 9, 11, 14, 16
  // ============================================================================
  // A Ramp parapet wall & Tetris crate stack (PDF Page 9: A site - from A ramp)
  box("a-ramp-north-parapet", 21.5, 0, -14.2, 7.0, 1.35, 0.42, "#d8c09e", false, "stone");
  box("a-ramp-north-coping", 21.5, 1.35, -14.2, 7.1, 0.12, 0.52, "#b54b35", true, "wood");
  crate("bolluca2-crate-tetris", 15.2, 0, -16.8, 2.2, 1.35, 2.2, "#9e7c54");
  crate("bolluca2-crate-tetris-top", 15.6, 1.35, -16.4, 1.35, 1.05, 1.35, "#876742");
  box("tetris-step-block", 16.9, 0, -16.8, 1.1, 0.72, 1.6, "#bfa686", false, "stone");

  // Sandwich walls between Tetris (x=12.5) and A Stairs (x=8.5) (PDF Page 5 & Page 9)
  box("bolluca2-sandwich-back-wall", 10.5, 0, -13.8, 4.2, 3.6, 0.45, "#dfc8a8", false, "stone");
  box("bolluca2-a-stairs-east-parapet", 8.35, 0, -17.2, 0.42, 2.25, 6.4, "#dfc8a8", false, "stone");
  for (let i = 0; i < 6; i++) {
    box(`a-stairs-visual-step-${i}`, 5.8, 1.2 + i * 0.08, -14.2 - i * 0.9, 4.4, 0.12, 0.82, "#c2ab8b", true, "stone");
  }

  // Jungle & Connector Archways & Low Parapet overlooking A Site (PDF Page 11 & 14)
  box("jungle-south-parapet", -12.5, 1.2, -20.8, 6.2, 1.05, 0.42, "#e4ceb0", false, "stone");
  box("jungle-south-coping", -12.5, 2.25, -20.8, 6.3, 0.12, 0.52, "#8c5a3c", true, "wood");
  box("jungle-arch-column-w", -15.4, 1.2, -20.8, 0.65, 3.8, 0.65, "#d8c09e", true, "stone");
  box("jungle-arch-column-e", -9.6, 1.2, -20.8, 0.65, 3.8, 0.65, "#d8c09e", true, "stone");
  box("jungle-arch-beam", -12.5, 4.4, -20.8, 6.8, 0.65, 0.65, "#b54b35", true, "wood");
  box("connector-south-arch-beam", -0.5, 4.4, -20.8, 6.8, 0.65, 0.65, "#b54b35", true, "wood");

  // A Site Crates: Default, Triple Box, Firebox, Danger Box (PDF Page 9 & Page 11)
  crate("bolluca2-crate-a-default", 12.6, 0, -29.0, 1.85, 2.35, 1.85, "#8b6b47");
  crate("bolluca2-crate-triple", 5.2, 0, -31.8, 1.9, 1.65, 1.9, "#4d6b46");
  crate("bolluca2-crate-triple-wing", 3.4, 0, -31.8, 1.65, 1.55, 1.65, "#597a52");
  crate("bolluca2-crate-triple-top", 5.2, 1.65, -31.8, 1.4, 1.15, 1.4, "#8b6b47");
  crate("bolluca2-crate-firebox", 13.2, 0, -37.2, 1.75, 2.1, 1.75, "#96744e");
  crate("bolluca2-crate-danger", 2.2, 0, -25.8, 1.55, 1.55, 1.55, "#8f6f4a");

  // A Site South & Palace Moroccan Arched Windows, Shutters, Crenellations & Minaret Tower (PDF Page 8, 9, 11)
  for (const wx of [-14, -7, 0, 7, 14]) {
    box(`asite-south-window-recess-${wx}`, wx, 4.2, -38.58, 1.8, 2.2, 0.14, "#24323d", true, "glass");
    box(`asite-south-window-arch-${wx}`, wx, 5.4, -38.52, 2.1, 0.35, 0.24, "#b54b35", true, "wood");
    for (const side of [-1, 1]) {
      box(`asite-south-shutter-${wx}-${side}`, wx + side * 1.1, 4.2, -38.52, 0.38, 2.0, 0.12, "#36647d", true, "wood");
    }
  }
  for (let mx = -16; mx <= 18; mx += 2.2) {
    box(`asite-south-merlon-${mx}`, mx, 7.6, -38.8, 0.95, 0.65, 0.45, "#f0e2c8", true, "plaster");
  }
  // Ornate Moroccan Minaret / Tower rising behind CT / Ticket Booth (PDF Page 8 & Page 9)
  box("asite-minaret-shaft", -15.5, 6.8, -40.5, 3.6, 5.4, 3.6, "#f2e4cc", true, "plaster");
  box("asite-minaret-gallery", -15.5, 12.2, -40.5, 4.1, 0.45, 4.1, "#b54b35", true, "wood");
  box("asite-minaret-lantern", -15.5, 12.65, -40.5, 2.4, 2.2, 2.4, "#ebd1a7", true, "plaster");
  box("asite-minaret-dome", -15.5, 14.85, -40.5, 2.0, 1.4, 2.0, "#d49b4b", true, "metal");

  // Palace Balcony Wooden Pergola & Palace Interior Pillars + Golden Dome (PDF Page 9, 11, 16)
  for (const z of [-29.5, -33.5, -37.5]) {
    box(`palace-pergola-post-${z}`, 14.3, 1.6, z, 0.28, 3.2, 0.28, "#6e5034", true, "wood");
  }
  box("palace-pergola-header", 14.3, 4.65, -33.5, 0.34, 0.28, 10.6, "#6e5034", true, "wood");
  for (let z = -38; z <= -29; z += 1.25) {
    box(`palace-pergola-rafter-${z}`, 17.5, 4.85, z, 6.8, 0.16, 0.22, "#7c5b3c", true, "wood");
  }
  for (const [px, pz] of [[25.5, -30.0], [25.5, -35.5], [30.5, -30.0], [30.5, -35.5]] as const) {
    box(`palace-pillar-${px}-${pz}`, px, 1.6, pz, 0.95, 4.2, 0.95, "#f2e4cc", false, "stone");
    box(`palace-pillar-base-${px}-${pz}`, px, 1.6, pz, 1.22, 0.35, 1.22, "#b59b78", true, "stone");
    box(`palace-pillar-cap-${px}-${pz}`, px, 5.45, pz, 1.26, 0.35, 1.26, "#b54b35", true, "wood");
  }
  box("bolluca2-palace-dome-drum", 27.5, 6.1, -32.5, 8.2, 2.4, 8.2, "#f2e4cc", true, "plaster");
  box("bolluca2-palace-dome-trim", 27.5, 8.5, -32.5, 8.6, 0.28, 8.6, "#b54b35", true, "wood");
  box("bolluca2-palace-dome-crown", 27.5, 8.78, -32.5, 6.8, 3.2, 6.8, "#d49b4b", true, "metal");
  for (let pz = -38; pz <= -27; pz += 2.2) {
    box(`palace-west-merlon-${pz}`, 21.0, 6.2, pz, 0.55, 0.68, 0.95, "#f2e4cc", true, "plaster");
  }

  // Ticket Booth & CT Stairs at SW of A Site (PDF Page 9 & Page 11)
  box("bolluca2-ticket-booth", -10.5, 0, -36.8, 2.6, 2.35, 1.9, "#527385", false, "metal");
  box("bolluca2-ticket-booth-roof", -10.5, 2.35, -36.8, 2.85, 0.18, 2.15, "#3a5361", true, "metal");
  box("bolluca2-ticket-window", -10.5, 1.25, -35.82, 1.65, 0.78, 0.08, "#8cc0d6", true, "glass");
  box("bolluca2-ticket-step-crate", -12.4, 0, -36.8, 1.15, 1.15, 1.25, "#8f6f4a", false, "wood");

  // ============================================================================
  // 6. MIDDLE (MID), TOP MID CART, CHAIR, WINDOW (SNIPER'S NEST) & UNDERPASS
  //    Strictly matching PDF Pages 5, 8, 14, 15
  // ============================================================================
  crate("mid-top-cart-box", 13.2, 0, 5.6, 1.95, 1.55, 1.75, "#94734d");
  box("mid-top-cart-bed", 15.4, 0.45, 5.6, 2.2, 0.22, 1.5, "#755638", false, "wood");
  for (const sz of [-0.78, 0.78]) {
    box(`mid-cart-wheel-${sz}`, 15.4, 0, 5.6 + sz, 0.75, 0.75, 0.18, "#3b3e40", true, "metal");
  }
  box("mid-chair-seat", 4.8, 0, -1.35, 0.85, 0.55, 0.85, "#7a593a", true, "wood");
  box("mid-chair-back", 4.8, 0.55, -1.72, 0.85, 0.65, 0.14, "#7a593a", true, "wood");

  // Mid Corridor Street Facade Shutters, Balconies & Terracotta Awnings (PDF Page 15)
  for (const mx of [6.0, 12.0, 18.0, 24.0]) {
    box(`mid-south-window-${mx}`, mx, 4.4, -1.62, 1.5, 1.9, 0.12, "#24323d", true, "glass");
    box(`mid-south-awning-${mx}`, mx, 5.5, -1.25, 2.2, 0.16, 0.95, "#b54b35", true, "wood");
    for (const side of [-1, 1]) {
      box(`mid-south-shutter-${mx}-${side}`, mx + side * 0.92, 4.4, -1.58, 0.34, 1.85, 0.1, "#36647d", true, "wood");
    }
  }
  for (const mx of [-8.0, -2.0, 6.0, 12.0]) {
    box(`mid-north-window-${mx}`, mx, 4.5, 13.58, 1.5, 1.9, 0.12, "#24323d", true, "glass");
    box(`mid-north-awning-${mx}`, mx, 5.6, 13.2, 2.2, 0.16, 0.95, "#b54b35", true, "wood");
    for (const side of [-1, 1]) {
      box(`mid-north-shutter-${mx}-${side}`, mx + side * 0.92, 4.5, 13.54, 0.34, 1.85, 0.1, "#6e4f35", true, "wood");
    }
  }
  // Catwalk Low Curb & Moroccan Arch Post at Top Mid / Catwalk Corner (PDF Page 15)
  box("catwalk-south-curb", -8.0, 1.2, 8.15, 10.5, 0.24, 0.32, "#b54b35", true, "wood");

  // Sniper's Nest / Window on West Wall of Mid (x=-12, z=0..8, y=1.6) looking East down Mid! (PDF Page 15)
  box("window-lower-retaining-wall", -12.0, 0, 4.0, 0.52, 1.6, 8.0, "#d8c09e", false, "stone");
  box("window-sill-ledge", -12.0, 1.6, 4.0, 0.68, 0.68, 4.4, "#f2e4cc", false, "stone");
  box("window-sill-trim", -11.62, 2.24, 4.0, 0.16, 0.12, 4.5, "#2e6d87", true, "wood");
  box("window-south-jamb", -12.0, 1.6, 0.9, 0.55, 3.6, 1.8, "#f0e2c8", false, "plaster");
  box("window-north-jamb", -12.0, 1.6, 7.1, 0.55, 3.6, 1.8, "#f0e2c8", false, "plaster");
  box("window-header-beam", -12.0, 4.2, 4.0, 0.62, 1.0, 4.4, "#b54b35", false, "wood");
  box("window-interior-backdrop", -21.55, 1.6, 4.0, 0.25, 3.5, 7.6, "#252e36", true, "stone");
  for (const sz of [1.55, 6.45]) {
    box(`window-blue-shutter-${sz}`, -11.64, 2.35, sz, 0.12, 1.75, 0.62, "#2e6d87", true, "wood");
  }
  box("bolluca2-window-under-bench", -11.15, 0, 2.8, 1.1, 0.95, 1.8, "#bfa686", false, "stone");
  box("bolluca2-window-vent-frame", -16.5, 1.6, 8.0, 1.8, 1.25, 0.32, "#566066", true, "metal");

  // Underpass Moroccan Blue/White Ceramic Tile Bands (PDF Page 5 & Page 15)
  box("bolluca2-underpass-tile-band-1", -11.75, 1.35, 17.5, 0.12, 0.36, 8.8, "#266885", true, "wood");
  box("bolluca2-underpass-tile-band-2", -5.25, 1.35, 17.5, 0.12, 0.36, 8.8, "#266885", true, "wood");

  // ============================================================================
  // 7. B SITE, B SHORT ARCHES, B CANOPY, VAN, BENCH/JAIL & MARKET/KITCHEN
  //    Strictly matching PDF Pages 10, 12, 13, 17
  // ============================================================================
  // B Short / Catwalk Brick Arches Wall separating B Short (x=-24..-14) from B Site (x=-43..-24) (PDF Page 10 & Page 13)
  box("b-short-arch-pier-south", -24.0, 1.2, 15.0, 0.68, 3.8, 1.6, "#efe2cc", false, "plaster");
  box("b-short-arch-pier-mid", -24.0, 1.2, 18.2, 0.68, 3.8, 1.2, "#efe2cc", false, "plaster");
  box("b-short-arch-pier-north", -24.0, 1.2, 25.2, 0.68, 3.8, 1.6, "#efe2cc", false, "plaster");
  box("b-short-arch-header-full", -24.0, 4.1, 20.0, 0.74, 0.95, 11.8, "#e6cfb0", false, "plaster");
  box("b-short-arch-brick-trim", -24.0, 3.92, 20.0, 0.78, 0.24, 11.9, "#b54b35", true, "wood");
  box("b-short-cat-parapet", -24.0, 1.2, 16.7, 0.52, 0.95, 1.8, "#d4bc9b", false, "stone");

  // Central B Site Compound Wall, Default Crate, E-Box, Pillar & Green B Canopy Tarp (PDF Page 10 & Page 12)
  box("b-site-center-wall-w", -32.2, 0, 20.5, 0.55, 2.35, 4.0, "#e6cfb0", false, "stone");
  box("b-site-center-wall-s", -30.5, 0, 18.5, 3.6, 2.35, 0.55, "#e6cfb0", false, "stone");
  box("b-site-center-coping-w", -32.2, 2.35, 20.5, 0.65, 0.12, 4.1, "#b54b35", true, "wood");
  box("b-site-center-coping-s", -30.5, 2.35, 18.5, 3.7, 0.12, 0.65, "#b54b35", true, "wood");
  box("bolluca2-b-canopy", -31.2, 3.65, 20.5, 5.4, 0.2, 5.8, "#346e4d", true, "wood");
  for (const [px, pz] of [[-33.2, 17.8], [-28.8, 17.8], [-33.2, 23.2], [-28.8, 23.2]] as const) {
    box(`b-canopy-pole-${px}-${pz}`, px, 0, pz, 0.16, 3.65, 0.16, "#5c4631", true, "wood");
  }
  crate("bolluca2-crate-b-default", -30.6, 0, 21.8, 1.65, 1.85, 1.65, "#8f6e49");
  crate("bolluca2-crate-b-ebox", -28.0, 0, 16.8, 1.5, 1.65, 1.5, "#4c626e");
  box("b-ebox-panel", -27.2, 0.85, 16.8, 0.12, 0.95, 0.75, "#94a6b0", true, "metal");
  box("b-empty-pillar", -31.8, 0, 14.8, 1.1, 3.2, 1.1, "#dfd0b8", false, "stone");

  // B Apartments Balcony Railing & Upper Windows overlooking B Site (PDF Page 10 & Page 12)
  box("b-balcony-railing-west", -37.85, 1.2, 28.0, 0.18, 0.92, 5.8, "#6e5034", true, "wood");
  for (const bz of [16.0, 21.0, 26.0]) {
    box(`b-west-wall-window-${bz}`, -42.58, 4.2, bz, 0.12, 1.8, 1.5, "#24323d", true, "glass");
    box(`b-west-wall-awning-${bz}`, -42.15, 5.2, bz, 0.85, 0.16, 2.0, "#b54b35", true, "wood");
  }

  // Delivery Van in NW Corner of B Site below B Apartments Balcony (PDF Page 10 & Page 12)
  box("bolluca2-van", -39.6, 0, 25.8, 2.25, 1.95, 3.6, "#edeae2", false, "metal");
  box("bolluca2-van-stripe", -38.44, 0.95, 25.8, 0.04, 0.28, 3.5, "#2e6d87", true, "wood");
  box("bolluca2-van-cab-hood", -39.6, 0, 23.4, 2.15, 1.05, 1.35, "#e2ddd2", false, "metal");
  box("bolluca2-van-windshield", -39.6, 1.25, 24.02, 1.85, 0.58, 0.1, "#5c7d8c", true, "glass");
  for (const sx of [-1.08, 1.08]) {
    for (const wz of [23.5, 26.8]) {
      box(`bolluca2-van-wheel-${sx}-${wz}`, -39.6 + sx, 0, wz, 0.24, 0.68, 0.68, "#2a2d30", true, "metal");
    }
  }

  // Bench & Red Tarp ("JAIL") along West Wall of B Site (PDF Page 10 & Page 12)
  crate("bolluca2-crate-b-bench", -41.4, 0, 18.2, 1.45, 1.25, 2.2, "#8c6b47");
  box("b-bench-red-tarp", -41.2, 3.4, 18.5, 2.8, 0.18, 5.6, "#b53c2a", true, "wood");

  // Market / Kitchen Building South of B Site: Market Window, Market Door & Counter (PDF Page 10, 12, 17)
  box("market-north-wall-west", -37.7, 0, 12.0, 0.6, 5.2, 0.55, "#f0e2c8", false, "plaster");
  box("market-north-wall-mid", -32.2, 0, 12.0, 3.8, 5.2, 0.55, "#f0e2c8", false, "plaster");
  box("market-north-wall-east", -25.8, 0, 12.0, 1.6, 5.2, 0.55, "#f0e2c8", false, "plaster");
  box("bolluca2-market-window-sill", -28.4, 0, 12.0, 3.2, 0.78, 0.62, "#c6ae8d", false, "stone");
  box("market-window-header", -28.4, 3.2, 12.0, 3.4, 2.0, 0.58, "#f0e2c8", false, "plaster");
  box("market-awning", -28.4, 3.35, 12.65, 3.6, 0.16, 1.1, "#2e6d87", true, "wood");
  box("bolluca2-market-counter", -31.8, 0, 5.8, 3.4, 1.05, 1.15, "#c2bdb4", false, "stone");
  box("market-counter-top", -31.8, 1.05, 5.8, 3.55, 0.08, 1.25, "#62737a", true, "metal");
  box("market-shelf-east", -25.6, 0, 5.8, 0.65, 2.4, 4.8, "#785a3c", true, "wood");

  // 8. Bombsite Target Paving & Wall-Mounted Painted Callout Signs (A & B)
  for (const site of BOLLUCA2_BOMB_SITES) {
    box(`site-paving-${site.id}`, site.x, site.y + 0.02, site.z, site.radius * 1.7, 0.03, site.radius * 1.7, "#c99b68", true, "stone");
    box(`site-border-n-${site.id}`, site.x, site.y + 0.03, site.z + site.radius * 0.85, site.radius * 1.7, 0.03, 0.18, "#b53c26", true, "stone");
    box(`site-border-s-${site.id}`, site.x, site.y + 0.03, site.z - site.radius * 0.85, site.radius * 1.7, 0.03, 0.18, "#b53c26", true, "stone");
  }
  const signA = box("site-sign-A", 9.5, 2.6, -38.55, 1.8, 1.4, 0.1, "#a83824", true, "plaster");
  signA.label = "BOMBSITE A";
  const signB = box("site-sign-B", -30.5, 1.35, 18.82, 1.6, 1.1, 0.08, "#a83824", true, "plaster");
  signB.label = "BOMBSITE B";

  // 9. T & CT Spawns (5 T spawns in T Spawn East, 5 CT spawns in CT Spawn South-West)
  const spawns: Vec3[] = [
    { x: 35.0, y: 0, z: -4.0 },
    { x: 38.5, y: 0, z: -2.0 },
    { x: 35.0, y: 0, z: 1.5 },
    { x: 38.5, y: 0, z: 4.0 },
    { x: 35.0, y: 0, z: 7.5 },
    { x: -27.5, y: 0, z: -32.0 },
    { x: -31.5, y: 0, z: -29.0 },
    { x: -27.5, y: 0, z: -25.0 },
    { x: -31.5, y: 0, z: -21.0 },
    { x: -27.5, y: 0, z: -16.0 },
  ];

  // 10. Verified Walkable Tactical Routes Across All Mirage Lanes
  const routes = [
    {
      name: "T Spawn → A Ramp → A Site",
      points: [
        { x: 35.0, y: 0, z: -4.0 },
        { x: 33.0, y: 0, z: -19.5 },
        { x: 15.0, y: 0, z: -19.5 },
        { x: 15.0, y: 0, z: -25.0 },
        { x: 8.5, y: 0, z: -29.5 },
      ],
    },
    {
      name: "T Spawn → Top Mid → Connector → A Site",
      points: [
        { x: 35.0, y: 0, z: 2.0 },
        { x: 20.0, y: 0, z: 2.0 },
        { x: -0.5, y: 0, z: 2.0 },
        { x: -0.5, y: 1.2, z: -14.0 },
        { x: -2.0, y: 1.2, z: -20.5 },
        { x: -2.0, y: 0, z: -27.5 },
        { x: 8.5, y: 0, z: -29.5 },
      ],
    },
    {
      name: "T Spawn → Mid → Catwalk → B Short → B Site",
      points: [
        { x: 35.0, y: 0, z: 2.0 },
        { x: 8.0, y: 0, z: 2.0 },
        { x: 8.0, y: 0, z: 10.5 },
        { x: -6.0, y: 1.2, z: 10.5 },
        { x: -18.5, y: 1.2, z: 11.5 },
        { x: -18.5, y: 1.2, z: 21.75 },
        { x: -29.5, y: 0, z: 21.75 },
      ],
    },
    {
      name: "CT Spawn → Market Door → B Site",
      points: [
        { x: -30.0, y: 0, z: -21.0 },
        { x: -30.0, y: 0, z: -2.0 },
        { x: -35.8, y: 0, z: 4.0 },
        { x: -35.8, y: 0, z: 16.0 },
        { x: -35.8, y: 0, z: 20.5 },
      ],
    },
    {
      name: "CT Spawn → Ticket → A Site",
      points: [
        { x: -27.5, y: 0, z: -32.0 },
        { x: -16.0, y: 0, z: -33.0 },
        { x: -2.0, y: 0, z: -35.5 },
        { x: 8.5, y: 0, z: -35.5 },
        { x: 8.5, y: 0, z: -29.5 },
      ],
    },
  ];

  return {
    id: "bolluca2",
    name: "Bolluca (2) · CS:GO Mirage PDF",
    subtitle: "CS:GO Mirage Referans PDF Birebir Mimari",
    bounds: 52,
    sky: "#8ec5ea",
    floor: "#d8c4a3",
    floorSurface: "stone",
    bombSites: BOLLUCA2_BOMB_SITES,
    radarFootprint: blocks.map(([w, e, s, n]) => [w, e, s, n] as const),
    solids,
    photoFrames: [],
    spawns,
    targets: [],
    hazard: { x: 200, z: 200, r: 0 },
    routes,
    landmarks: [
      "T Spawn", "T Roof", "Apts Ramp", "Back Alley", "Top Mid", "Cart", "Middle", "Chair",
      "Catwalk", "Sniper's Nest (Window)", "Under-Window Boost", "Ladder Room", "Underpass",
      "Connector", "Jungle", "Stairs", "Sandwich", "Tetris", "A Ramp", "Palace", "Palace Pillars",
      "Balcony", "Shadow", "A Site", "Default", "Triple Box", "Firebox", "Danger Box",
      "CT Stairs", "Ticket Booth", "CT Spawn", "Market (Kitchen)", "Market Window", "Market Door",
      "B Apartments", "B Balcony", "Van", "Bench (Jail)", "B Site", "B Canopy", "E-Box",
      "Empty (Pillar)", "B Short", "Arches", "Cat Corner",
    ],
  };
}
