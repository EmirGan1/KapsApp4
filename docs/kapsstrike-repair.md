# KapsStrike repair — first verified milestone

Base: c38af335811d73f4df376bdad8dfdd12a75e7fc6.

## Reproduced cause

The host sent both `strike:start_game` and `strike:start_match`. Each reset a live round and broadcast both `room_state` and `match_started`. Both client listeners constructed a controller. The same browser regression on the unmodified base observed **four controllers for one match**, failing the single-controller assertion. Disposing old controllers also releases pointer lock. Multiplayer pause callbacks did not reveal a pause menu, leaving stopped controls without a way to resume.

## Fixes

- Send one start command; server start aliases are idempotent during a round.
- One controller per room/round, stable event subscriptions, explicit pointer-lock gesture on desktop, touch starts without pointer lock.
- Map/snapshot loading stages, 12-second synchronization timeout, visible errors, retry and exit.
- Shared 120 Hz physics timebase inside 60 Hz server callbacks, 30 Hz snapshots. One queued input per physics step; capped queue and prediction history, validation of weapon/tick/axes and duplicate queued sequences.
- Reconciliation restores authoritative movement, health, ammo and weapon timers and resets the acknowledged sequence before replay.
- Training-only hazard/respawn rules cannot grant client-authoritative multiplayer life changes.
- Correct semi-automatic trigger semantics and reload completion while idle.
- Hitmarkers/damage/respawn feedback only affects the relevant player; remote shots do not recoil the local viewmodel. Kill-feed aliases deduplicated.
- Multiplayer hides offline target meshes; wheel events are throttled and require active game controls; touch inputs reset on pause.
- Repaired out-of-sync dependency lockfile (`npm ci` failed on the base).

## Validation

- `npm run test:strike`: 142 passed at this milestone, including existing training/scene/server tests and new duplicate-start/flood regressions.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm ci --ignore-scripts`: passed after lockfile repair.
- `npm run test:strike:browser`: all three training maps, High shadows and React menu/HUD/exit passed.
- `npm run test:strike:menu`: 390×844, 768×1024 and 1440×900 menu/settings/controls and unsupported-WebGL layouts passed.
- `npm run test:strike:network`: two independent Chromium browser contexts (one desktop, one touch/mobile emulation), real Socket.IO server and production manager/controller/renderer/UI, repeated for Warehouse, Dust and Neon. Actual WebGL via SwiftShader. Create/join/ready/start; remote character meshes; server-observed movement; actual fire inputs/raycast/ammo/damage/death/kill count/respawn; victim does not receive shooter hitmarker; ESC/resume UI and disposal.
- Browser fixture identities are synthetic and supplied by the test-only server. Production authentication was not bypassed or altered. A clear firing lane and expired protection are set server-side in the combat fixture; gameplay outcomes are produced by real gameplay code.

## Remaining request

This milestone does **not** complete the uploaded specification. Eight skins/3D preview/account persistence, full rebinding UI, knife, redesigned city maps and extensive hardware/network/long-match performance validation remain. No physical Android/iOS/Edge/Opera or production-account/live-call validation was performed. Software-rendered Chromium results do not establish physical GPU FPS guarantees. Existing broader server tests are largely mock-transport tests; the new browser test adds real transport coverage for two clients only.

## Second milestone — controls and melee

- Physical-code rebinding editor: keyboard/modifier combinations, mouse buttons, wheel directions, overlap warnings, explicit replacement, individual/all resets. ESC remains a recovery shortcut. Settings persist locally immediately and update controller bindings. Mobile touch controls remain available.
- Dedicated sixth knife slot (original five number slots preserved), wheel wrap/debounce and previous-weapon action. Normal 40 / heavy 65 damage, 2.2 m raycast range, 0.5 / 0.9 s cooldowns, no ammo consumption, authored low-poly viewmodel/swing/audio and third-person blade representation. Server validates combat and cover.
- Equip requests no longer disappear during an equip delay; selecting restarts the delay, preserving fire cooldown. Fixed server scheduling uses elapsed time to avoid timer rounding changing match duration.
- 147 unit/scene/server/binding tests passed. Added held-trigger/cooldown/heavy, out-of-range and wall-blocked knife assertions. Original five firearm tests retained.
- Two-context WebGL network test additionally uses remapped I/F movement/fire, actual editor persistence, synchronous wheel burst debounce/wrap, sixth-slot selection and server-confirmed 40 melee damage. Three-map training and High/React browser regression passed after adding the sixth weapon.
- Full skins and redesigned maps remain outstanding. The local binding store is device-specific; account sync is not claimed.
