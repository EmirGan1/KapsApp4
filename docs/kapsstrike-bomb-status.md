# Bomb mode quality update — 2026-10-31

Status: basic bomb mode release candidate in PR #8. Advanced quality-update features below remain incomplete. Deployment must be verified separately.

## This increment
- Server enforces all-ready before bomb match start; safely removes departed objective owners/actions and ghost round participants; synchronizes round scores and resets protection/weapon timers on each round.
- Purchase validation rejects prototype keys, duplicates, expired purchases and incorrect team equipment. Action rate limit and acknowledgments expose actionable purchase errors. Objective pickup/defuse checks line of sight.
- Private economy, loadout, objective actions and unplanted bomb information are redacted from opponents' bomb snapshots. Normal player replication still sends positions; full interest management is not implemented.
- Client freezes prediction during buy/result and limits predicted weapon selection to purchased weapons. Round transitions reset view/reconciliation state.
- Dedicated four-category purchase dialog with balance, ownership, prices, disabled reasons, B/ESC, focus containment, pointer-lock transition, touch controls and safe-area responsive layout. Original SVG silhouettes; no external assets.
- CT/T profile cards (initials fallback), alive/dead states, scores, round phase and authoritative clock. Original cosmetics retained.
- Same-team spectator camera and cycling; dead bomb players no longer see the incorrect automatic-respawn countdown. Kill-mode HUD unchanged.

## Verification
- 208 automated tests passed (baseline 205); new cases cover malicious purchase keys, private snapshot redaction and departed objective owner cleanup. Existing manager test now verifies ready gate.
- TypeScript passed; production build passed; diff whitespace check passed.
- Chromium menu tests passed at 390×844, 768×1024 and 1440×900.
- New `tests/kapsstrike.bomb.browser.ts` passed with two independent Chromium contexts using actual Socket.IO and Babylon WebGL (software renderer): mode selection, create/join/ready/start, desktop B/ESC and pointer lock, armor purchase/balance, tablet kit purchase, phone width, plant, kit defuse, CT score and next round, cleanup; no page errors.
- Test-only server placement at site A and extended initial purchase time make the browser sequence deterministic. Traversal to sites is not established by this test. First attempts timed out during startup/focus; after waiting for HUD and explicitly restoring the active desktop page the complete sequence passed.
- Screenshots inspected: desktop and phone purchase dialog. No physical iOS/Android testing or hardware FPS claims.

## Still required
HE/flash/smoke mechanics; first/third-person objective animations; spatial beeps and explosion effects; richer architecture/PBR and visual quality acceptance; full spectator testing; disconnect grace/rejoin; MR12 selection; tactical site radar; isolated bomb statistics persistence; complete match/overtime browser tests, 5v5 stress tests, physical mobile and voice regression checks. The fixture's test authentication is never used in production.

Do not represent the passing basic-mode tests as completion of the entire quality update or proof of live deployment.

Visibility audit: production KapsStrikeGame-DIZq-Bgn.js contained neither BOMBA KURMA nor strike:bomb_action. The production bundle predates this feature. Entry visibility was explicitly tested at phone, touch tablet and desktop sizes.

## Sites, controls and audio update
District now spans 160×160m (1.7× previous linear dimensions, approximately 2.9× footprint). Shared A/B centers drive server planting rules, minimap circles and in-world paint/signs/rings; route signs, architectural fittings and peripheral cover added. High ground texture uses 2048px, other surfaces 512px (Medium256/Low128) with a texture memory budget; these are procedural surfaces, not photogrammetry assets. CT spawn view faces into the town.

Bomb can be held using 7 / touch button, dropped with G / touch and retrieved with the interaction control by a living T. Desktop objective buttons replaced by keyboard hints; B opens a cursor-enabled purchase dialog. Phone/tablet objective, health, minimap and weapon controls moved to separate lanes. Plant announcement text, optional Turkish speech synthesis, synthesized accelerating countdown and explosion sound use game volume. Speech voice availability depends on browser/OS.

209 automated tests passed, including new shared site geometry checks. Two-context Chromium/WebGL browser flow passed at phone portrait/landscape and tablet sizes, including 7→held model→G→pickup→plant→kit defuse→next round and radar A/B labels. Screenshots inspected for objective/radar overlap; test positioning is explicitly fixture-controlled. A first all-surfaces-2048 High attempt closed the browser, so the texture budget was reduced and rechecked. Typecheck and production build passed. Physical iOS/Android device testing, audible sound output and real-device High FPS could not be verified here. Deployment remains separate from GitHub merge.

## Dense street network revision
Replaces the expanded open-field layout with six connected, bending 8m-wide approaches carved between continuous collision city blocks. A/B stay at the existing authoritative positions but occupy enclosed 20m site courts; covered halls and short links connect the routes. Map bounds remain 160×160m. Greedy merged 2m cells limit geometry cost; facade windows/cornices articulate the block edges.

211 automated tests passed: 81 sampled A-to-B ray pairs blocked, no sampled 24m open square, all authored route capsule clearances, spawn connectivity, interiors, stairs and bomb rules. TypeScript/build passed. Environment metal stripes and strong grid joints removed; cosmetic skin stripes replaced by restrained enamel panels while preserving skin IDs/colors/rarities and gameplay. package-lock synchronized with existing package.json after npm ci rejected missing Babylon/Playwright entries; lock validation via npm ci --dry-run --ignore-scripts passed. Native sqlite3 build could not run in this container; no backend versions intentionally changed.

## Dust II reference reconstruction — WORK IN PROGRESS
This revision replaces the authored corridor layout with a horizontal footprint sampled from the public de_dust2 radar (8px cells, 0.89408m nominal sampling using 4.4 Source units/pixel and 0.0254m/unit). Source reference: https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_dust2_radar_psd.png . Official art reference: https://www.counter-strike.net/dust2 . Public radar marker metadata was cross-checked at https://cs2.gs/maps/dust-ii/ . These are references, not measured Source 2 mesh/collision data.

Raster extraction fills small prop holes and bombsite annotation outlines; therefore it is NOT pixel-perfect collision recovery. Radar does not encode floor elevations, ceilings, wall thickness, stair shapes or all overlapping tunnels. The current flat terrain and small test ramp/stair are NOT a faithful reconstruction of A Ramp/Catwalk/Tunnel Stairs. These must be replaced from verified 3D data. Do not merge this revision as a completed Dust II remake.

Shared A/B rule coordinates and T/CT spawns moved; A/B geometry/LOS/connectivity and game rules tested. Named callout reference positions recorded. High terrain uses PBR albedo, metallic/roughness parameters and procedural normal maps. This is not CS2 texture fidelity, original game textures are not included. No finished grenade system exists in this repository revision; none was removed.

Required before acceptance: measured multi-level geometry; faithful props/doors/windows; independently validated route timings/widths/sightlines; source-vs-reconstruction 3D alignment; visual and real-device performance acceptance. No main merge or production deployment is authorized by this incomplete reconstruction.

Reconstruction verification: 212 automated tests passed; both shared site centers accept planting. TypeScript and production build passed. The first browser run was interrupted by development hot reload during edits; two subsequent stable two-context Chromium/WebGL runs passed purchase/7/G/pickup/plant/kit-defuse/round and phone/tablet layout checks, including High scene readiness and screenshot capture. Radar footprint side-by-side comparison and High/mobile screenshots were inspected. This confirms a playable horizontal prototype, NOT geometric equivalence or complete Dust II visuals. No physical iOS/Android, real GPU performance or original mesh alignment was tested.
