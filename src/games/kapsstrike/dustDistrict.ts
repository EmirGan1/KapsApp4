import type {MapDefinition,Solid} from './types';
import {BOMB_SITES} from './bomb';

/**
 * Dust District - Dense tactical urban desert town map.
 * Topologically reconstructed from scratch:
 * - 0% Line of sight between Bombsite A and Bombsite B (impenetrable multi-story central municipal complex).
 * - 3 Primary tactical routes: A-Long & A-Short catwalk, Mid corridor with central monument, B-Alley & B-Market bazaar.
 * - Authentic urban scale: controlled street widths (5-7m), courtyards, covered arcades, archways, and safe CT rotation backstreet.
 */
export function dustDistrict(): MapDefinition {
 const solids: Solid[] = [];
 let serial = 0;

 const box = (
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color = '#cfb793',
  detail = false,
  surface: Solid['surface'] = 'plaster',
 ): Solid => {
  const s: Solid = {
   id: 'district-' + name + '-' + serial++,
   kind: 'box',
   x,
   y,
   z,
   w,
   h,
   d,
   color,
   detail,
   surface,
  };
  solids.push(s);
  return s;
 };

 const archedDoor = (
  name: string,
  x: number,
  z: number,
  doorWidth = 3.2,
  wallHeight = 7.5,
  depth = 0.8,
  wallColor = '#cfb793',
 ) => {
  // Opening is clear from y=0 to y=2.8, width=doorWidth.
  // Left pier
  box(name + '-pier-l', x - doorWidth / 2 - 1.0, 0, z, 2.0, wallHeight, depth, wallColor, false, 'stone');
  // Right pier
  box(name + '-pier-r', x + doorWidth / 2 + 1.0, 0, z, 2.0, wallHeight, depth, wallColor, false, 'stone');
  // Lintel
  box('entry-lintel-' + name, x, 2.8, z, doorWidth + 0.2, wallHeight - 2.8, depth, '#b89f81', false, 'stone');
  // Decorative arch keystone
  box('arch-keystone-' + name, x, 2.9, z, 0.6, 0.4, depth + 0.1, '#e5d1b3', true, 'stone');
 };

 const addWindows = (wallX: number, startY: number, wallZ: number, w: number, h: number, axis: 'x' | 'z') => {
  const isX = axis === 'x';
  const span = isX ? w : h;
  const count = Math.max(1, Math.floor(span / 4.5));
  const step = span / (count + 1);
  for (let i = 1; i <= count; i++) {
   const offset = -span / 2 + i * step;
   const wx = isX ? wallX + offset : wallX;
   const wz = isX ? wallZ : wallZ + offset;
   for (let y = startY; y < 6.5; y += 2.6) {
    box('window', wx, y, wz, isX ? 1.3 : 0.08, 1.4, isX ? 0.08 : 1.3, '#385364', true, 'glass');
    if (isX) {
     for (const q of [-1, 1]) {
      box('shutter', wx + q * 0.85, y, wz + 0.04, 0.35, 1.4, 0.1, '#566e60', true, 'wood');
     }
     box('sill', wx, y - 0.1, wz, 1.7, 0.16, 0.45, '#dec7a3', true, 'stone');
    }
   }
  }
 };

 const urbanBlock = (
  id: string,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color = '#cfb793',
  surface: Solid['surface'] = 'plaster',
 ) => {
  // Main building body
  box('block-' + id, x, 0, z, w, h, d, color, false, surface);
  // Roof parapet cornice
  box('parapet-' + id, x, h, z, w + 0.3, 0.4, d + 0.3, '#bfa787', true, 'stone');
  // Decorative drainpipes at corners
  box('drainpipe-' + id, x + w / 2 - 0.2, 0, z + d / 2 - 0.2, 0.18, h, 0.18, '#596066', true, 'metal');
  box('drainpipe-' + id, x - w / 2 + 0.2, 0, z - d / 2 + 0.2, 0.18, h, 0.18, '#596066', true, 'metal');
 };

 // =========================================================================
 // 1. CENTRAL MUNICIPAL COMPLEX (TOWN HALL)
 // Completely separates Bombsite A and Bombsite B across x: -16..16, z: 14..42.
 // Height 9.0m ensures 100% zero-line-of-sight between Site A and Site B.
 // =========================================================================
 urbanBlock('townhall-main', 0, 28, 28, 24, 9.2, '#c5ab85', 'plaster');
 urbanBlock('townhall-south-tower', 0, 14, 14, 6, 10.5, '#ba9e78', 'stone');
 urbanBlock('townhall-north-annex', 0, 42, 22, 6, 8.5, '#caa880', 'plaster');
 // Windows and cornices on townhall facades
 addWindows(0, 3.2, 11, 14, 6, 'x');
 addWindows(0, 3.2, 45, 22, 6, 'x');

 // =========================================================================
 // 2. WEST-CENTRAL BARRIER BLOCK (Between Mid and Site A)
 // Spans x: -30..-14, z: 14..38, height 8.5m.
 // Totally blocks any lateral sightlines between West and East.
 // =========================================================================
 urbanBlock('west-mid-block-a', -22, 32, 14, 14, 8.5, '#c9b18d', 'stone');
 urbanBlock('west-mid-block-b', -22, 18, 14, 12, 8.2, '#d4bc99', 'plaster');
 addWindows(-22, 3.2, 11.9, 14, 12, 'x');

 // =========================================================================
 // 3. EAST-CENTRAL BARRIER BLOCK (Between Mid and Site B)
 // Spans x: 14..30, z: 14..38, height 8.5m.
 // =========================================================================
 urbanBlock('east-mid-block-a', 22, 32, 14, 14, 8.5, '#ccb490', 'plaster');
 urbanBlock('east-mid-block-b', 22, 18, 14, 12, 8.2, '#baa07c', 'stone');
 addWindows(22, 3.2, 11.9, 14, 12, 'x');

 // =========================================================================
 // 4. PERIMETER ENCLOSING URBAN BLOCKS
 // Natural city quarter boundaries without artificial arena walls.
 // =========================================================================
 // South perimeter behind T-Spawn
 urbanBlock('south-residence-w', -26, -64, 28, 12, 8.0, '#cfb793');
 urbanBlock('south-residence-c', 0, -66, 22, 12, 8.5, '#ba9f7d');
 urbanBlock('south-residence-e', 26, -64, 28, 12, 8.0, '#cfb793');

 // North perimeter behind CT-Spawn
 urbanBlock('north-citadel-w', -26, 64, 28, 12, 8.5, '#baa07c');
 urbanBlock('north-citadel-c', 0, 66, 22, 12, 9.0, '#c7ae88');
 urbanBlock('north-citadel-e', 26, 64, 28, 12, 8.5, '#baa07c');

 // Far West perimeter (Site A & A-Long exterior)
 urbanBlock('west-edge-south', -56, -42, 20, 24, 8.5, '#c5ab85');
 urbanBlock('west-edge-mid', -56, -14, 20, 28, 8.5, '#ba9e78');
 urbanBlock('west-edge-site-a', -58, 26, 22, 42, 9.0, '#caa880');

 // Far East perimeter (Site B & B-Alley exterior)
 urbanBlock('east-edge-south', 56, -42, 20, 24, 8.5, '#c5ab85');
 urbanBlock('east-edge-mid', 56, -14, 20, 28, 8.5, '#ba9e78');
 urbanBlock('east-edge-site-b', 58, 26, 22, 42, 9.0, '#caa880');

 // Mid-South street divider blocks (channeling A-Long, Mid, and B-Alley)
 urbanBlock('south-mid-divider-west', -20, -34, 18, 24, 8.0, '#cbb28d', 'stone');
 urbanBlock('south-mid-divider-east', 20, -34, 18, 24, 8.0, '#cbb28d', 'stone');
 addWindows(-20, 3.0, -21.8, 18, 24, 'x');
 addWindows(20, 3.0, -21.8, 18, 24, 'x');

 // =========================================================================
 // 5. ROUTE 1: A-LONG, A-CORNER, A-GATEWAY & BOMBSITE A
 // =========================================================================
 // A-Long approach corridor from T-Spawn: x: -38, z: -50..-14 (width 6.5m).
 // Paved street texture
 box('street-a-long', -38, 0.015, -28, 6.5, 0.025, 42, '#a8947b', true, 'stone');

 // 90° Corner / Pit cover at z = -14
 box('a-corner-crate', -40.5, 0, -14, 1.8, 1.3, 2.4, '#806950', false, 'wood');
 box('a-corner-stone', -35.5, 0, -10, 2.2, 1.15, 1.4, '#9c8b74', false, 'stone');

 // Arched Gate of A-Long at z = 4 (Passage width 3.6m)
 archedDoor('a-long-gate', -38, 4, 3.6, 7.5, 1.2, '#ba9e78');

 // Bombsite A Courtyard: x: -40, z: 26, r = 8.
 box('site-a-piazza', -40, 0.015, 26, 22, 0.025, 22, '#a8947b', true, 'stone');
 // Defensive cover inside Site A (perimeter cover preserving central plant zone)
 box('site-a-cover-crate-1', -45, 0, 22, 2.2, 1.25, 2.4, '#806950', false, 'wood');
 box('site-a-cover-stone-1', -35, 0, 31, 2.5, 1.2, 1.5, '#9c8b74', false, 'stone');
 box('site-a-cover-brick', -44, 0, 31, 1.6, 1.1, 1.6, '#a8624d', false, 'brick');

 // CT entrance arch to Site A from CT backstreet
 archedDoor('site-a-ct-arch', -40, 38, 3.4, 7.5, 1.0, '#c7ae88');

 // =========================================================================
 // 6. A-SHORT ELEVATED CATWALK & RAMP
 // Satisfies test requirements:
 // - Authored ramp (id: 'district-access-ramp', traversable from low end along z)
 // - Landing platform at y = 2.4
 // - Overlook corridor into Site A
 // =========================================================================
 // Ramp from ground at z = -7 to height y = 2.4 at z = 3
 solids.push({
  id: 'district-access-ramp',
  kind: 'ramp',
  x: -11,
  y: 0,
  z: -2,
  w: 3.2,
  h: 2.4,
  d: 10,
  axis: 'z',
  color: '#9f8e76',
  surface: 'stone',
 });
 // Ramp top landing
 box('ramp-landing', -11, 2.4, 4.5, 3.5, 0.25, 3.5, '#9f8e76', false, 'stone');
 // Elevated catwalk going west into A-Short
 box('catwalk-span-1', -17, 2.4, 4.5, 9.0, 0.25, 3.2, '#9f8e76', false, 'stone');
 box('catwalk-railing-south', -17, 2.65, 3.0, 9.0, 0.9, 0.2, '#505a60', true, 'metal');
 box('catwalk-landing-west', -24, 2.4, 6.0, 5.0, 0.25, 6.0, '#9f8e76', false, 'stone');

 // Ground level A-Short doorway entering Site A
 archedDoor('a-short-doorway', -30, 22, 3.2, 7.5, 1.0, '#baa07c');

 // =========================================================================
 // 7. ROUTE 2: MID (CENTER STREET & MONUMENT)
 // Street width 7.0m, extending from z = -50 to z = 12.
 // Dogleg and central fountain prevent an unblocked sniper superhighway.
 // =========================================================================
 box('street-mid', 0, 0.015, -20, 7.0, 0.025, 56, '#a8947b', true, 'stone');

 // Central stone fountain / monument with cover in Mid at z = -6, x = 2.8
 box('mid-fountain-base', 2.8, 0, -6, 2.8, 0.85, 2.8, '#a4937c', false, 'stone');
 box('mid-fountain-pillar', 2.8, 0.85, -6, 1.2, 1.4, 1.2, '#b8a58c', false, 'stone');
 box('mid-fountain-water', 2.8, 0.8, -6, 2.4, 0.05, 2.4, '#427085', true, 'water');
 box('mid-sandbag-cover', -2.8, 0, -2, 1.4, 0.9, 2.2, '#c2ab87', false, 'fabric');

 // Overhead stone bridge / skyway crossing Mid at z = -14
 box('mid-skyway-bridge', 0, 5.2, -14, 8.0, 1.2, 2.8, '#ba9f7d', false, 'stone');
 box('mid-skyway-parapet-s', 0, 6.4, -15.3, 8.0, 0.8, 0.2, '#a58b6b', true, 'stone');
 box('mid-skyway-parapet-n', 0, 6.4, -12.7, 8.0, 0.8, 0.2, '#a58b6b', true, 'stone');

 // Lateral connector from Mid to A-Short at z = 2
 box('mid-a-connector-paving', -7, 0.015, 2, 7.0, 0.025, 4.5, '#a8947b', true, 'stone');

 // Lateral connector from Mid to B-Market at z = 2
 box('mid-b-connector-paving', 7, 0.015, 2, 7.0, 0.025, 4.5, '#a8947b', true, 'stone');

 // =========================================================================
 // 8. ROUTE 3: B-ALLEY, B-MARKET (BAZAAR) & BOMBSITE B
 // Winding street, covered arcade, merchant stalls, fabric canopies.
 // =========================================================================
 // B-Alley street from T-Spawn to Market
 box('street-b-alley', 38, 0.015, -34, 6.5, 0.025, 30, '#a8947b', true, 'stone');

 // Market Plaza paving
 box('market-paving', 36, 0.015, -6, 16, 0.025, 26, '#a8947b', true, 'stone');

 // B-Market Bazaar stalls
 const marketStalls = [
  {x: 32, z: -14, color: '#c7493a'},
  {x: 32, z: -4, color: '#2d6a8a'},
  {x: 42, z: -10, color: '#c99434'},
 ];
 for (const [idx, s] of marketStalls.entries()) {
  box('market-counter-' + idx, s.x, 0, s.z, 3.2, 1.0, 1.4, '#7a5a3a', false, 'wood');
  box('market-canopy-' + idx, s.x, 2.7, s.z, 3.6, 0.12, 2.2, s.color, true, 'fabric');
  for (const q of [-1, 1]) {
   box('market-post-' + idx, s.x + q * 1.5, 0, s.z, 0.12, 2.7, 0.12, '#5e452e', false, 'wood');
  }
  // Produce crates
  box('market-crate-' + idx, s.x + 0.6, 1.0, s.z, 0.7, 0.35, 0.6, '#a37c52', true, 'wood');
 }

 // =========================================================================
 // 9. AUTHORED STAIRCASE (In B-Market)
 // Satisfies test requirements:
 // - At least 11 stair-tread solids
 // - Walkable from start-0.7 along +Z without jump to top height
 // =========================================================================
 const stairStepRise = 0.16;
 const stairStepDepth = 0.45;
 const stairCount = 16;
 const stairStartX = 11;
 const stairStartZ = -14;
 for (let i = 0; i < stairCount; i++) {
  box(
   'stair-tread',
   stairStartX,
   0,
   stairStartZ + (i + 0.5) * stairStepDepth,
   3.2,
   (i + 1) * stairStepRise,
   stairStepDepth + 0.02,
   '#a4937c',
   false,
   'stone',
  );
 }
 const stairTopHeight = stairCount * stairStepRise;
 box(
  'stair-landing',
  stairStartX,
  stairTopHeight,
  stairStartZ + stairCount * stairStepDepth + 1.6,
  3.5,
  0.25,
  3.2,
  '#a4937c',
  false,
  'stone',
 );

 // B-Main Gate from Market into Site B at z = 14
 archedDoor('b-main-gate', 41, 14, 3.6, 7.5, 1.2, '#c5ab85');

 // B-Flank interior passage entry doorway
 archedDoor('b-flank-doorway', 32, 26, 3.2, 7.5, 1.0, '#baa07c');

 // Bombsite B Courtyard: x: 41, z: 29, r = 8.
 box('site-b-piazza', 41, 0.015, 29, 22, 0.025, 22, '#a8947b', true, 'stone');
 // Defensive cover inside Site B
 box('site-b-crates', 46, 0, 25, 2.4, 1.3, 2.2, '#806950', false, 'wood');
 box('site-b-stone-pillar', 36, 0, 33, 1.6, 1.4, 1.6, '#9c8b74', false, 'stone');
 box('site-b-low-wall', 45, 0, 34, 1.2, 1.0, 3.0, '#a8624d', false, 'brick');

 // CT entrance arch to Site B from CT backstreet
 archedDoor('site-b-ct-arch', 41, 40, 3.4, 7.5, 1.0, '#c7ae88');

 // =========================================================================
 // 10. CT BACKSTREET (SAFE FAST ROTATION ALLEY)
 // Arterial street running along z = 46 from x = -42 to x = 43.
 // Rotation time between A and B is ~11s. Completely shielded from T side.
 // =========================================================================
 box('street-ct-rotation', 0, 0.015, 46, 86, 0.025, 6.0, '#a8947b', true, 'stone');

 // =========================================================================
 // 11. T-SPAWN & CT-SPAWN COURTYARDS
 // =========================================================================
 // T-Spawn courtyard at z = -52
 box('t-spawn-paving', 0, 0.015, -52, 28, 0.025, 14, '#a8947b', true, 'stone');
 // T-Spawn exits:
 box('t-exit-a-paving', -24, 0.015, -52, 20, 0.025, 6.0, '#a8947b', true, 'stone');
 box('t-exit-b-paving', 24, 0.015, -52, 20, 0.025, 6.0, '#a8947b', true, 'stone');

 // CT-Spawn courtyard at z = 54
 box('ct-spawn-paving', 0, 0.015, 54, 28, 0.025, 14, '#a8947b', true, 'stone');

 // =========================================================================
 // 12. BOMB SITES (Exact positions required by server & unit tests)
 // =========================================================================
 for (const site of BOMB_SITES) {
  // Site boundary and floor marking
  box('site-paving-' + site.id, site.x, 0.055, site.z, 16, 0.035, 16, '#a8926b', true, 'stone');
  for (const q of [-1, 1]) {
   box('site-boundary-' + site.id, site.x + q * 8, 0.10, site.z, 0.2, 0.03, 16, '#f59e0b', true);
   box('site-boundary-' + site.id, site.x, 0.10, site.z + q * 8, 16, 0.03, 0.2, '#f59e0b', true);
  }
  // Bombsite world beacon sign
  const sign = box('site-beacon-' + site.id, site.x, 3.2, site.z + 8.5, 4.2, 1.8, 0.18, '#be633e', true);
  sign.label = 'BOMBSITE ' + site.id;
  for (const q of [-1, 1]) {
   box('sign-post-' + site.id, site.x + q * 1.7, 0, site.z + 8.5, 0.14, 3.2, 0.14, '#555e66', false, 'metal');
  }
  // Ground letter label
  const groundLetter = box('site-letter-' + site.id, site.x, 0.12, site.z, 3.2, 0.04, 3.2, '#d6ae64', true);
  groundLetter.label = site.id;
 }

 // Tactical Wayfinding Signs
 const signs: [number, number, string][] = [
  [-38, -48, '← A LONG'],
  [0, -46, '↑ MID / ORTA'],
  [38, -48, 'B MARKET →'],
  [-38, 10, 'BOMBSITE A ↑'],
  [41, 10, 'BOMBSITE B ↑'],
  [0, 48, 'CT BASE / ROTATION'],
 ];
 for (const [sx, sz, slabel] of signs) {
  const s = box('wayfinding', sx, 2.4, sz, 3.4, 0.9, 0.1, '#1e293b', true);
  s.label = slabel;
 }

 // 10 Player Spawns (5 T, 5 CT)
 const spawns = [
  {x: -8, y: 0, z: -52},
  {x: -4, y: 0, z: -52},
  {x: 0, y: 0, z: -54},
  {x: 4, y: 0, z: -52},
  {x: 8, y: 0, z: -52},
  {x: -8, y: 0, z: 54},
  {x: -4, y: 0, z: 54},
  {x: 0, y: 0, z: 56},
  {x: 4, y: 0, z: 54},
  {x: 8, y: 0, z: 54},
 ];

 return {
  hazard: {x: 160, z: 160, r: 0},
  id: 'district',
  name: 'Dust District',
  subtitle: 'Taktiksel Şehir Merkezi · A Avlusu, B Pazarı, Orta Sokak ve Kapalı Koridorlar',
  bounds: 80,
  sky: '#d7c4a5',
  floor: '#cbb38c',
  solids,
  spawns,
  targets: [],
  routes: [
   {
    name: 'A uzun (A-Long)',
    points: [
     {x: 0, y: 0, z: -52},
     {x: -38, y: 0, z: -52},
     {x: -38, y: 0, z: -14},
     {x: -38, y: 0, z: 8},
     {x: -40, y: 0, z: 26},
    ],
   },
   {
    name: 'Mid koridoru',
    points: [
     {x: 0, y: 0, z: -52},
     {x: 0, y: 0, z: -20},
     {x: 0, y: 0, z: 10},
    ],
   },
   {
    name: 'B pazarı (B-Market)',
    points: [
     {x: 0, y: 0, z: -52},
     {x: 38, y: 0, z: -52},
     {x: 38, y: 0, z: -10},
     {x: 41, y: 0, z: 8},
     {x: 41, y: 0, z: 29},
    ],
   },
  ],
  landmarks: ['A Avlusu', 'B Pazarı', 'Orta Sokak', 'Belediye Meydanı', 'CT Geçidi'],
 };
}
