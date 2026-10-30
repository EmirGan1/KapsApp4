# KapsStrike: expanded districts and play experience

## Implemented

- All three authored districts expanded 1.35× on X/Z: 129.6 m across, 82.25% more horizontal area. Buildings, doors, roads, collision, spawn points, target locations and authored routes share the same transformed geometry on client/server. Stair risers and roof heights retain their original safe vertical dimensions.
- Added courtyard planters/ceramics/rugs, street power cabinets/solar panels and dock cable spools/loading details; cover is deliberately placed off the three main traversal routes. The sea and coastal boundaries remain intact.
- Prediction replays pending commands against the corrected simulation tick. Small authoritative position corrections decay visually instead of snapping the camera. The server carries movement across at most 100 ms of missing input, with neutral fire/reload/interaction and no extra simulation time. Held input is cleared on respawn, new round and session replacement.
- Respawn resets local/server pitch and yaw, camera quaternion/up-vector/roll/inertia, recoil, interpolation history and held input. Gyroscope recenter follows death/respawn HUD transitions.
- New navy/mint field-console interface, sidebar home screen, compact pause menu and separate scrollable settings. Character, controls, graphics and mobile-input panels have a persistent close/back bar, Escape dismissal and focus containment. Underlying menus are inert while a panel is open.
- Knife attacks retain swing and melee sound but skip tracer, impact and muzzle effects. Enemy outline shells use back-face culling so the skin remains visible. Outlines stay depth-tested.
- Sniper/RX-3 ADS adds a circular scope/reticle and hides the viewmodel. `F` inspects the weapon; it is remappable and cancels for ADS, reload, firing or death.
- Three randomized supply cases per map, containing two new special firearm types: XR-24 Fırtına and MG-60 Kalkan. `E` opens/collects; touch users get an interaction button. Special weapons are carried in the server-controlled inventory and drop on death. Starter weapons remain available as before; acquired specials can be selected with the wheel or touch weapon picker.
- Every 90 seconds a supply aircraft delivers RX-3 Şimşek: 12-second advance warning, descending case/parachute, visible plane and red smoke at the landed supply. Placement samples validated authored ground routes, excluding spawn proximity and water. Old items expire; item counts are bounded.
- Supply interactions validate life state, distance, line of sight and one-time ownership. A client cannot select a locked special weapon. Match snapshots carry the shared supplies and delivery state.
- North-up minimap on desktops/tablets, hidden on phones independently of keyboard/touch selection. Shows structure, authored routes, self, teammates and supplies; no enemy wall reveal.
- Low/Medium/High settings now apply live: 128/512/1024 px original procedural mipmapped textures, native-resolution fine grain, environmental detail batches, shadows, DPR/resolution scale and optional dynamic resolution. Effects volume also applies to the initial audio configuration.

## Verification

- `npm run lint`: TypeScript passed.
- `npm run build`: production client/server build passed; large chunk warnings remain.
- `npm run test:strike`: 181 tests passed. Includes map route/door/stair/ramp/collision checks, weapon/security tests, scene disposal, 8/10 real local Socket.IO clients with simulated 0/100/200/300 ms delays, and new supply/respawn cases. Supply locations/warning/landing checked across 100 seeds on each map.
- `npm run test:game-input`: 13 tests passed.
- `npm run test:strike:menu`: 390×844, 768×1024 and 1440×900 menu/settings/back navigation and unsupported-WebGL layout checks passed.
- `npm run test:strike:maps`: all three actual WebGL maps loaded; street and overhead captures inspected with Medium graphics.
- `npm run test:strike:network`: two production UI/controller browser clients (desktop and 1366×1024 touch tablet), real Socket.IO room/create/join/start, movement, remote skins, firing/damage/death/score/respawn/melee, key changes, Escape and cleanup passed. Recorded forward camera samples did not show backward correction spikes greater than 15 cm. This is a regression check, not a hardware FPS guarantee.
- `npm run test:game-input:browser`: iPadOS desktop-UA 1366×1024, Android tablet 1600×900, iPhone landscape 844×390 passed existing touch/gyro/permission/sensitivity/ADS/keyboard/cleanup checks. Battle Royale shared sensor regression also passed.
- `npm run test:strike:experience`: actual WebGL menu/panel closing, 20 respawn camera resets, no melee bullet effects, F inspect, sniper scope, E supply pickup, plane/delivery/smoke, live texture dimensions, prediction replay with divergent ticks, phone/tablet minimap rules and engine disposal.

## Limits and deployment

Tests use Chromium software WebGL and emulated mobile capabilities/sensor events. Physical iOS/Android hardware, native Safari, WAN play and production SSH deployment were not tested here. No universal FPS or zero-defect guarantee is made. Textures are original procedural surfaces, not photographic assets. Existing chat, microphone, camera and screen-share systems were not rewritten or live-tested in this change.

No new runtime dependencies or environment variables. Deploy the same revision of frontend and Node server together (`npm run build`, then the existing PM2 deployment workflow); new inventory and map geometry must agree between client/server. This workspace has no SSH deployment access.
