# Post notification destinations and user profile links

Likes and comments now navigate to `/gonderi/:id` using the notification's exact `target_id`. The notification list and floating toast share this destination logic. A dedicated authenticated single-post endpoint retrieves older posts and posts inside subject folders without relying on the first feed page, current filters, or a cached post. The page reuses the existing post card, supports likes, comments, media and the likes list, survives reload/back navigation, and clearly reports deleted posts. Desktop notification options also carry the exact post URL. Toast keys now distinguish multiple social notifications from the same sender so different posts cannot share a recycled toast identity.

`UserProfileLink` provides the common inline profile action. Known user IDs are preferred; name-only identity labels resolve an exact account, never the first approximate search result. Names with spaces and Unicode, keyboard activation and native links/new tabs are supported. Requests are coalesced and cached per authenticated account. Missing accounts show an error instead of opening an unrelated profile. Bot records and placeholder labels remain text. Form fields and native selection options retain their selection behavior.

Identity labels were reviewed across chat headers/replies/member lists, global/mini chat, feed and post comments, notification titles/toasts, profile and friend surfaces, likes/download/leaderboard/admin modals, voice/video interfaces, announcements, trip rooms and game panels. Existing working profile callbacks are retained; missing profile actions use the common component. Links inside another action stop propagation so opening a profile cannot also open a post, select an invite, send a message or toggle another control. Relevant modals close before navigation; an incoming-call inviter profile opens separately so viewing it does not reject the call. Group names remain group labels.

Explicit `@username` text in posts and chat also resolves to profile links. Matching uses the longest actual username, preserves punctuation and spaces, avoids email addresses and username prefixes, and does not interpret ordinary prose as a user identity. The server supplies public account IDs; message IDs and post IDs are never guessed to be user IDs. Notification reads include canonical sender names, with fallback handling for older notification wording.

An existing autocomplete cursor race was also corrected: a delayed animation frame can no longer move the cursor backwards after the user has already started typing another mention.

Validation:

- `npm run test:social-navigation`: route/target guards, explicit mention boundaries, exact name resolution, authenticated old subject-post lookup, deleted content, atomic like/unlike and correct notification recipient/target.
- `npm run test:social-navigation:browser`: real components and API at desktop and touch/mobile widths; grouped like and distinct toasts from one sender, old subject posts, comments, reload/back, nested link isolation, keyboard, named profile URLs, missing accounts/posts, explicit mention links, like/unlike and mocked OS notification URL metadata.
- Existing 10 DM tests, 3 mention test groups, 38 German tests; existing desktop/mobile DM and mention browser suites; TypeScript and production build.

Browser fixtures use isolated test databases and controlled notification transports. Physical OS delivery and every interactive game state were not exercised against production accounts. No destructive migration is needed.
