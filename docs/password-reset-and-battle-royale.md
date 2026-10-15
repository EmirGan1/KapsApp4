# Administrator-approved password recovery and Battle Royale regression coverage

## Password recovery

Recovery is an approval of a specific request, not a public permission attached only to a username. A username alone never returns an approved reset token. The request owner must present the random 256-bit `requesterKey` retained in the originating browser. The database stores hashes, not the requester key or the usable reset token. Approval expires after 30 minutes; pending requests expire after 24 hours. Successful completion atomically consumes approval, updates the bcrypt password and revokes every stored session, then disconnects every active socket for that account.

The old forgot/reset URLs are routed through the new guarded flow. Previously issued unapproved reset links are invalidated on startup. Legacy links no longer grant access. Existing users, password hashes and ordinary login sessions are preserved until a recovery completes.

User flow:

1. Choose **Şifremi Unuttum**, enter a username and send the request.
2. The waiting view polls every three seconds, without overlapping requests. Approval opens the new-password form automatically. Rejection/expiry/cancellation displays a message.
3. After leaving the page, return in the same browser and submit the username (with or without a password) to resume an approved request. Ordinary logins still require a correct password. No extra “leave password blank” explanation appears in the login form.
4. Correct-password login cancels a pending request. After completing recovery, sign in with the new password.

Administrators must verify the requester's identity outside the application before approving. `emirgan` and database `role=ROOT` accounts can decide requests from notifications or the administrator panel. Header/query username claims are not authentication. Administrator recovery from the public form is blocked. Losing browser storage requires contacting the administrator; another browser cannot claim an existing request.

`password_reset_requests` is created automatically. No manual migration is required. The existing administrator middleware and user approval endpoints also require a verified active administrator token; the old unconditional administrator fallback is removed.

## Battle Royale fixes

- Validate capacity, duration and mode; restrict bot management and returning everyone to the lobby to the host.
- Enforce deathmatch respawn delay, prevent royale respawns, make respawn acknowledgements one-use, and prevent acknowledgements extending protection.
- Initialize late deathmatch joins safely; late royale joins spectate. Clear stale input, buffs, reloads and hitbox history across round/respawn transitions.
- Stop stuck movement/fire on stale packets or loss of browser focus. Ignore gameplay shortcuts when typing in form controls.
- Find the actual entry point of swept circle collisions and resolve the closest projectile hit across walls, rocks, barrels, crates and players, independent of array order.
- Apply explosive impact damage once, clamp dropped/picked ammunition, prevent duplicate weapon slots and release declined pickup locks.
- Record every remaining human participant's kills/match result, avoid duplicate death/kill accounting, and clear finished-game timers.
- Stress simulations use isolated managers. HTTP/socket simulation endpoints are disabled unless `ENABLE_GAME_TEST_ENDPOINTS=true`, and then require a verified administrator. Leave this flag unset in production.
- Chaos checks measure authoritative displacement rather than reporting a standalone arithmetic clamp as a passing physics test.

## Verification

```sh
npm ci --ignore-scripts
npm run test:security
npm run test:battle
npm run lint
npm run build
```

The Battle Royale suite includes 3,000 generated analytic collision cases, 2,000 generated authoritative-input cases, focused exploit/weapon/respawn/lobby/zone/statistics regressions, existing headless/chaos simulations, and a seeded 10-client network run generating 60,000 packets across 6,000 real engine ticks with 15% simulated loss, 20–800 ms jitter and out-of-order delivery. In-process network simulations do not substitute for browser/device playtests, rendering/performance measurements or tests of a deployed multi-server environment. Passing tests cannot prove absence of all defects.
