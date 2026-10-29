# Tablet controls and gyro repair

Base: `132ad8f` (KapsStrike gyro and MiniBattleRoyale device-detection additions).

## Fixed

- Removed KapsStrike's `<1024px` device checks from both the UI and controller. iPadOS desktop UA + MacIntel/touch, Android tablets, phones and other touch devices share capability detection; viewport width does not turn controls off.
- Added an explicit Auto / Touch / Keyboard-and-mouse preference in KapsStrike's **Mobil Kontroller / Jiroskop** screen and pause/settings panels. Touch is the tablet default; switching clears held input. Native mobile keyboard mode works without requiring unsupported pointer lock and supports drag-to-look.
- KapsStrike had applied gyro sensitivity in the UI (`×0.015`) and again in the controller (`×0.0015`), then kept the controller's initial settings. Sensor deltas are now radians, sensitivity applies once, and mode/sensitivity settings update the active controller.
- Shared iOS/Android orientation service: direct user-gesture permission call where required, HTTPS/support/denial/no-data messages, real-data active status, quaternion angle-wrap handling, current screen-angle compensation, recentering, spike/stale-sample baselines and listener cleanup. Android does not depend on the iOS-only permission method. Standard and absolute streams are not double-counted.
- Battle Royale uses the same service. Stale desktop mode preferences no longer override the first tablet touch default; explicit new keyboard choices persist. The input timer reads current sensor activity, and mouse/aim assist/unchanged held-stick input no longer overwrite gyro aiming. Calibration readouts are throttled.

Gyro is opt-in. A previously saved iOS gyro preference still requires the explicit permission button when the browser requires a fresh gesture. Permission granted and sensor data actually arriving are displayed separately. No microphone/camera permissions are requested by this feature.

## Verified

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:game-input`: 13 passing tests (device matrix, angle wrap, portrait/landscape/native-landscape compensation, invalid/stale/recenter handling, synchronous iOS request invocation, Android/no-request API, denial/insecure/unsupported).
- `npm run test:strike`: 170 passed.
- `npm run test:battle`: 5026 passed. No battle engine rules were changed.
- `npm run test:game-input:browser`: production KapsStrike UI/controller under Chromium profiles for iPadOS desktop UA 1366×1024, Android tablet 1600×900 and iPhone landscape 844×390. Verified actual touch-event joystick movement, look drag, touch fire and cancel, default touch UI, permission denial/retry, sensor-to-camera delta, live 2× sensitivity, ADS-only gating, pause gating, external keyboard fallback, mode switching and zero remaining sensor listeners/engines after exit.
- Same browser suite: real BattleRoyaleManager state over Socket.IO; iPad default touch despite old desktop preference, persisted iOS gyro preference/explicit grant, synthetic sensor movement changing outgoing aim input, explicit keyboard mode and PC input platform.
- `npm run test:strike:network`: two separate browser contexts (desktop + 1366×1024 touch tablet), real Socket.IO room/start/movement/fire/damage/death/score/respawn, live rebinding, skins and cleanup passed.

## Limits / deployment

The sensor and iOS permission inputs above are **simulated**. This is not a physical iPhone/iPad/Android hardware test or a native Safari sensor test. A site-level OS/browser denial, embedded-browser restriction, missing hardware, or reverse-proxy sensor policy cannot be bypassed by JavaScript; the UI now exposes the missing-data/permission state instead of claiming the gyro is active. The SSH deployment was not accessed or updated in this task. Build/deploy the updated frontend on the live host; GitHub source publication alone does not update a separate SSH checkout.

References: [W3C orientation coordinate system](https://www.w3.org/TR/orientation-event/), [MDN permission and secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static).
