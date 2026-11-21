# DM and call repairs

## Root causes and implementation

| Area | Root cause | Change |
| --- | --- | --- |
| Replies | The server broadcast temporary `m_…` IDs before committing the insert, then mutated only its local object. Clients tried to reply/react using IDs that never existed in SQLite. | Persist before broadcast; echo the final numeric ID and client correlation ID. Validate references against both participants, populate sender/media metadata from SQLite, disable replying to uncommitted messages, focus/cancel composer, and retrieve older original messages on demand. |
| Notifications | Web Push ran unconditionally. A user-level active-chat map was overwritten by other devices, never reliably cleared on disconnect, and the App and Chats components both controlled presence. | Chats alone reports focus/visibility/page lifecycle and a 15-second heartbeat; socket-scoped leases expire in 45 seconds and disconnect removes only that socket. Check presence before push/notification creation. The service worker also asks visible focused windows about the exact DM/account to handle an arriving push race, with a 500 ms fail-open timeout. |
| Read/delivery receipts | A cached presence or online flag optimistically assigned delivered/read, `mark_chat_read` ran in hidden tabs, transient read positions controlled badges, and DM/group avatar markup was shared. | Start at `sent`; acknowledge actual received numeric IDs; report only incoming messages intersecting the visible focused conversation. Persist receipts before broadcasting to both users' devices; delivery cannot downgrade read. Badge counts query persistent read flags. DM avatars are removed; group avatars remain. |
| Reactions | Only a heart action existed. JSON read/modify/write could lose concurrent updates, private results were broadcast globally, and DM authorization was missing. | Bundled searchable Unicode picker, quick reactions, mobile hold/action control, counts and selected state. Participant authorization, scoped broadcasting, per-message queue plus SQL compare-and-swap, and one selected reaction per user with toggle/change behavior. Existing JSON and hearts remain stored. |
| Call audio | Route selection guessed speaker/earpiece by labels, did not offer the native chooser or general device list, and initially claimed speaker without evidence. Remote video could duplicate audio from the dedicated audio element. | Explicit system default, supported native `selectAudioOutput()` chooser and enumerated outputs, verified `setSinkId()` before updating the displayed device, rollback on errors, device-change handling, outgoing/incoming controls, and muted video rendering with the dedicated audio element handling sound. No peer renegotiation or microphone/camera mutation when switching output. |
| Socket privacy | Generic `join_room`/`leave_room` accepted arbitrary room strings. | Reserve `dm-user:` rooms for authenticated server-managed subscriptions. |

History refreshes merge messages received while the query is in flight. Reconnect reloads authoritative history. Text send failures/timeouts have a separate failure indicator and do not get delivery checkmarks.

## Database and compatibility

No new schema migration, database reset, or production database operation was performed. Existing `messages.reply_to`, `reactions`, `status`, `is_read`, `read_at`, and `room_id` columns are reused; the application's existing additive initialization creates these columns on older installations. Tests use isolated in-memory SQLite databases. No new runtime dependency was added.

Historical reply references that already contain a nonexistent temporary ID cannot be reliably reconstructed; new references are validated. Existing group/global message handlers and group receipt avatars retain their behavior. Reactions on other users' records are preserved when an individual changes their own selection.

Emoji data: Unicode Emoji 16.0, fully-qualified sequences from https://unicode.org/Public/emoji/16.0/emoji-test.txt. Names/search terms are English; emoji characters can also be searched directly. Data is bundled, without a third-party request at runtime. License: `docs/UNICODE_LICENSE.txt`.

## Validation

- `npm run test:dm`: 10 passing Node tests. Covers all bundled Unicode emoji sequences, skin tones/ZWJ/flags/keycaps, reaction toggles and changes, leased per-socket presence, verified audio routing/rollback, real Socket.IO users/devices with SQLite, persistent replies, actual delivery/read acknowledgments, background read rejection, unauthorized reply/reaction rejection, simultaneous reactions, reconnect/history persistence, and an injected database write failure.
- Service worker tests cover active DM suppression, other-DM delivery, hidden/offline/wrong-account/unresponsive window fallback. The push provider is mocked; this is not an APNs/FCM delivery test.
- `npm run test:dm:browser`: passing Chromium desktop and mobile viewport runs with two independent browser contexts, real sockets, and SQLite. Covers send/reply/cancel, emoji search and synchronization, reload persistence, no DM reader avatar, and gray-to-blue receipts. Foreground/background state is explicitly simulated in the fixture; it does not claim OS lockscreen/background execution coverage.
- `node --import tsx tests/rtc.browser.ts`: passed with two real WebRTC peers, independent camera/screen tracks, sharing stop/restart, and camera continuity.
- Existing targeted regression tests: 62/63 passed across security, viewport, RTC adaptation, and screen audio. `tests/screenAudio.test.ts` has an existing mock missing `getVideoTracks()`; reproduced unchanged on base commit `ffe08321bc1d42f74aac698c4911cd983a04487f`.
- `npm run lint`: three existing errors, reproduced unchanged on the base commit: implicit `item` type at `src/server/kapsAppAi.ts:115`, and obsolete model constants at `tests/kapsAppAi.browser.ts:22` and `:24`. No introduced TypeScript diagnostics.
- `npm run build`: production client, bundled server, and SEO pages passed.
- `git diff --check`: passed.

WebKit was downloaded, but cannot launch here because the host lacks its ICU66/JPEG8/WebP6/FFI7 and other required libraries. Physical Windows/macOS/Android/iOS devices, installed PWAs, actual Bluetooth/wired output routing, device locking, and real offline push delivery were not tested.

## Platform limits

A web app/PWA cannot force an earpiece or speaker that the browser/OS does not expose. `setSinkId()` and `selectAudioOutput()` are feature-detected independently and may require permission and direct user activation. Device labels can be unavailable before permission. iOS Safari/Home Screen PWA and Android Chrome/PWA therefore use the OS route selector when these APIs or outputs are unavailable; no icon-only success is shown. An installed PWA does not add native telephony routing powers. A verified `sinkId` confirms the browser's selected sink, not an independently measurable physical speaker state or the hardware behind the OS default.

References: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/setSinkId and https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/selectAudioOutput .

## Deployment

Changes are intended for `main`; no pull request is required. On the server:

```sh
cd /var/www/KapsApp && git pull --ff-only origin main && npm install --include=dev && npm run build && pm2 restart kapsapp-production
```

The existing `guncelle` alias need not be edited. If using that alias, pull first, then run it. The command does not replace/copy/delete the database. Refresh existing clients to load the new socket protocol and worker.

## Changed files

- `docs/DM_FIXES.md`
- `docs/UNICODE_LICENSE.txt`
- `package.json`
- `public/kapsapp-notifications.js`
- `server.ts`
- `src/App.tsx`
- `src/components/ActiveCallPanel.tsx`
- `src/components/CallAudioOutput.tsx`
- `src/components/Chats.tsx`
- `src/components/DmEmojiPicker.tsx`
- `src/components/IncomingCallNotification.tsx`
- `src/context/CallContext.tsx`
- `src/server/devicePush.ts`
- `src/server/directMessages.ts`
- `src/server/socket.ts`
- `src/shared/emojiData.json`
- `src/utils/audioOutput.ts`
- `src/utils/dmVisibility.ts`
- `tests/directMessages.browser.ts`
- `tests/directMessages.fixture.tsx`
- `tests/directMessages.test.ts`
- `tests/dmPush.test.ts`
