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
