# Kaps German — implementation and acceptance status

This branch implements the integrated learning core and a first Goethe practice
environment. It is not a completed delivery of every item in the master prompt.
Keep the PR in draft until the remaining acceptance work below is completed.

## Implemented paths

The entry appears in Dersler after backend authorization. The private route is
/ dersler / kaps-german (without spaces). The API prefix is /api/kaps-german.
User ID 1 always has administrator access. Only that ID can grant or revoke other
existing users, start Google authorization or trigger synchronization. Every
learner query scopes sessions and memory to the authenticated database ID.

The existing session resolver, device guard, application libSQL client, React
router, lazy loading and current Groq model/key-file conventions are reused.
All tables are additive. No existing user tables or SQLite files are replaced.

## Google setup

In Google Cloud, enable the Google Docs API and create a web OAuth client.
Configure the exact authorized redirect URI:

    https://kapsapp.online/api/kaps-german-google/callback

Set server-only environment variables:

    KAPS_GERMAN_GOOGLE_CLIENT_ID=<web client ID>
    KAPS_GERMAN_GOOGLE_CLIENT_SECRET=<client secret>
    KAPS_GERMAN_GOOGLE_REDIRECT_URI=https://kapsapp.online/api/kaps-german-google/callback
    KAPS_GERMAN_TOKEN_KEY=<base64 of exactly 32 random bytes>

Generate the key once using openssl rand -base64 32. Preserve it alongside the
database backup; changing it makes stored refresh tokens unreadable. Tokens use
AES-256-GCM and stay in the application database. No Google secrets go to the
frontend. Use the administrator Google connection button, sign in with
emirhanmadenci15@gmail.com, and authorize documents.readonly. The fixed source is
document 1-1DJxTHV2ebDKB0GpI49XEl-rqfxbLvGo-pFJOD_UvU.
The Google document does not need public sharing. A ChatGPT Google connector
does not provision the production OAuth client.

The callback consumes a one-use, ten-minute state. All document tabs and child
tabs are fetched with includeTabsContent=true. Tables, lists and em-dash-separated
pairs are parsed. Ambiguous lines are preserved as warnings. Unicode normalization
preserves umlauts. Source removal archives words. Unique German-expression
corrections preserve existing memory IDs; separate meanings keep separate IDs.
Linguistic metadata is conservative; detailed plural/irregular-form enrichment
and a reconciliation editor remain acceptance work.

## AI configuration and limits

Existing GROQ_API_KEY or GROQ_API_KEY_FILE is used. The default key-file path is
/etc/kapsapp/groq-api-key. Optional KAPS_GERMAN_GROQ_MODEL overrides the existing
openai/gpt-oss-120b model. JSON object output is validated locally. Optional
KAPS_GERMAN_OLLAMA_MODEL enables a localhost-only fallback; benchmark its memory
and concurrency alongside KapsAI and Desklib before enabling it on the VDS.

Generation has one in-process AI call at a time, a 40-second call deadline,
3,500 output-token budgets and at most four modules / four candidates per module
per generation run. Each candidate needs deterministic validation and a second
AI validation before insertion. Fingerprints suppress identical question text.
Provider prices are not inferred. Usage/cost dashboards, configurable daily
budgets and semantic similarity controls are not yet complete.

Without AI, source-based recall stays usable. Exact accepted answers and choices
are deterministic. Unknown free-form answers stay pending if semantic grading
fails. The student may explicitly request re-evaluation. Re-grading does not
repeat already-applied mastery evidence.

## Scheduling and persistence

A minute timer checks 03:00 Europe/Istanbul and catches up a missed run.
A database lease serializes synchronization across PM2 workers. Failed source
fetches retry with backoff; failed jobs are retried after a cooldown. The last
successful words stay available. Google synchronization and AI generation are
asynchronous. A failed generator produces a partial job and preserves old tasks.

Saved sessions snapshot their task bank and accepted answers server-side.
Draft updates use optimistic versions and are automatically saved after typing.
Exam corrections are hidden until submission. Timers have server-side deadlines.
Interrupted grading is recovered on startup. Pending AI answers can be retried.

SM-2-inspired review scheduling is explicitly not FSRS. Mastery needs productive
recall, multiple spaced days and a sufficiently long review interval. Same-session
correct streaks cannot establish mastery. Failure reverses mastery. No calibrated
retention percentage or official readiness score is displayed. Exam exposure
does not promote vocabulary mastery.

## Goethe reference and remaining acceptance

Official references checked on 20 November 2026:

- https://www.goethe.de/ins/de/de/prf/gzb1.cfm
- https://bfu.goethe.de/b1_mod/lesen.php
- https://bfu.goethe.de/b1_mod/hoeren.php
- https://bfu.goethe.de/b1_mod/schreiben.php
- https://bfu.goethe.de/b1_mod/sprechen.php
- https://www.goethe.de/pro/relaunch/prf/am/Durchfuehrungsbestimmungen_B1.pdf

Reading uses 65 minutes / five parts / 30 items; listening 40 minutes / four
parts / 30 items; writing 60 minutes / three tasks; speaking approximately
15 minutes for the pair plus preparation. Writing task lengths are approximately
80/80/40 words. The code contains format/count metadata; it does not replace
official assessment or the official paired speaking workflow.

The separate Goethe cards, private histories, generated reading passages,
writing prompts and typed/dictated speaking practice are implemented. A module
simulation only opens when all required part counts exist. Current generation
targets small practice pools, not all part variants. No complete four-module
mock exam is delivered. Hören stays explicitly unavailable because cached,
validated German audio and playback enforcement are not implemented.
Speaking dictation depends on the browser, asks permission, and does not give
pronunciation/fluency scores.

Remaining master acceptance includes natural cached audio, full-length validated
exam assembly, official-rubric aggregation/criteria UI, interactive speaking
partner/recording workflow, real-provider language-quality benchmarks, all eleven
specialized exercise interactions, richer independent exam analytics, mastery
event charts, adjustable learning settings, source reconciliation and global AI
configuration/usage administration. These are code gaps, not just missing keys.

## Verification and deployment

Run:

    npm run build
    npm run lint
    node --import tsx --test tests/german.test.ts
    node --import tsx tests/german.browser.ts
    node --import tsx tests/german.production.browser.ts

Tests use synthetic Google responses, isolated SQLite databases and local
Chromium. They do not verify the real Google account, live provider response
quality, the production 03:00 process, physical microphone or iPhone PWA.

For production acceptance, first take a verified online SQLite backup using the
existing backup procedure, then review the additive german_* schema and this
draft's incomplete acceptance list. Merge the reviewed branch only after the
desired release scope is accepted. Fetch/fast-forward through the existing
database-preserving update workflow, npm install --include=dev, npm run build,
and pm2 restart kapsapp-production. Set secrets in the existing private runtime
environment before restart. Open Dersler as user ID 1, connect Google, sync the
empty document, add a real source pair, re-sync and verify it in the vocabulary
library. Verify another user's API rejection, explicit grant/revoke, session
recovery and the nightly job. Rollback code while retaining all german_* tables.
Never reset local.db or remove WAL/SHM.

Full TypeScript checking has three pre-existing KapsAI diagnostics on the base
branch. No changes to unrelated AI model configuration are included.
