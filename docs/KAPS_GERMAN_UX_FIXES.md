# Kaps German: curriculum visibility, safe exercise aids, and preparation feedback

Base revision: `c8ed8a9` (Satzbau and personalized reinforcement updates).

## Repairs

- **Missing categories/units:** the real API returns an array of level hierarchies, but the UI indexed it as a level-keyed object. The boundary adapter now supports both shapes, maps `unitCount` to `totalUnits`, supplies category accents, and uses the actual category identifier in test filters. Server “current” means recommended; untouched recommended units now correctly show “not started”. Category search is cleared when entering its units.
- **Answer-revealing aids:** a central help policy only pronounces already-visible German source text before checking. Articles, gaps, conjugations, spelling, ordering, and Satzbau no longer expose a target pronunciation or model recording in the header. Useful pronunciation remains available after a checked answer. Listening retains its explicit audio controls. Legacy saved Satzbau model hints are hidden before checking, and new own-sentence tasks no longer embed the German model answer in their hints.
- **Unit scope:** matching distractors were being turned into additional tested vocabulary from the wider CEFR pool. Matching pairs now stay within the selected learning pool and target level. The session safety filter and corrected-task filter enforce the selected unit's actual vocabulary IDs. Choice distractors can still use compatible non-target vocabulary.
- **Incorrect free-sentence success:** three tokens plus a guessed verb ending, or 75% token overlap, cannot establish grammatical correctness or preserve negation. Those rules no longer award correctness. Known validated sentences/alternatives still check immediately. Other free translations and own sentences use bounded, schema-validated semantic evaluation. If reliable evaluation is unavailable, the saved answer stays pending with no word-mastery success/failure or correctness XP. The learner can continue and retry evaluation later. AI is called outside the SQLite write transaction; final commits remain idempotent. Preliminary deterministic review also labels uncertainty rather than inventing a high grammar score.
- **Creation feedback:** all normal, unit, repeat, reverse-direction, and personalized reinforcement creation flows use one native modal. It makes the whole application inert, traps focus, and displays a spinner, server-confirmed stage progress, elapsed time, and explicitly estimated remaining time. The bar does not advance just because time passes. ETA uses recent successful preparations of that kind for that user, or a labelled initial estimate. Overruns say preparation continues rather than falsely reaching zero. Errors release the modal and restore the current page. A shared lock prevents rapid repeated clicks from starting duplicate requests.
- **Audio pack failures:** runtime audio cache queries used `cache_key/file_name` while the actual shipped schema uses `audio_hash/file_path`. Reads, writes and the manifest now use the real schema. The audio regression fixture initializes the real schema rather than copying a different one. Offline readiness counts only the selected level's cached normal audio; failed downloads and another level's cache no longer count as ready. Partial/error downloads show a recoverable message.
- **Other UX:** study preferences initialize once without a redundant second access/overview load; restarting a session preserves its original language direction.

## Data and schema

Only the additive `german_preparations` table/index is new. It stores owner, request kind, current stage, estimated duration and timestamps, without exercise answers or model prompts. The authenticated progress endpoint is owner-scoped, works across PM2 workers, and old preparation records are pruned after a day. Existing vocabulary, imports, sessions, mastery and audio tables are not reset or replaced. The audio fix uses the canonical existing schema.

## Validation

- `npm run test:german`: **33/33 passing** across generation, CEFR filtering, content audits, user isolation, mastery, AI services, pronunciation, real schema/audio caching, curriculum hierarchy, and UX regressions.
- New integration checks use the real Express router and SQLite: every CEFR level produces usable category/unit nodes, unit launch respects its vocabulary, completion/error/duplicate preparation states are correct, another user cannot read a job, an actual in-flight AI request reports `generating_ai` below 100%, and uncertain sentence grading cannot award mastery. A later reliable grade awards it exactly once.
- `npm run test:german:browser`: Chromium mobile and desktop. Real API/SQLite exercise flows cover all 11 non-mistake-review activity types, answer checking, refresh, expired practice recovery, reverse reinforcement, category-to-unit launch, native modal focus/inertness/ETA, failure recovery, vocabulary cards, pronunciation preferences, reporting, and admin views. Incorrect audio-cache readiness is explicitly tested with a failed fetch and a different level's cached audio. Mistake-review logic is covered by the Node suite.
- `npm run lint`: clean TypeScript check.
- `npm run build`: production frontend, server bundle and SEO generation pass.
- `npm run test:dm`: **10/10 passing** unaffected messaging regressions.
- `git diff --check`: clean.

The browser fixture tests a delayed request to verify the waiting UI. Its timings are not a production performance benchmark. AI schema/confidence/failure paths are tested with deterministic transports; this does not establish that an external AI model is infallible. Physical iOS/Android PWA testing and a linguistic review of all 2,127 production vocabulary records shown in the user's screenshot were not performed. Tests use isolated local databases and do not mutate production data.

## Deployment

```sh
cd /var/www/KapsApp && git pull --ff-only origin main && npm install --include=dev && npm run build && pm2 restart kapsapp-production
```

Reload existing browser/PWA clients after deployment. The additive initialization runs at startup.

## Changed files

- `docs/KAPS_GERMAN_UX_FIXES.md`
- `package.json`
- `src/components/german/ActivityInput.tsx`
- `src/components/german/ExerciseRunner.tsx`
- `src/components/german/HomeLearnView.tsx`
- `src/components/german/KapsGerman.tsx`
- `src/components/german/PronunciationGuideBox.tsx`
- `src/components/german/SessionPreparation.tsx`
- `src/components/german/api.ts`
- `src/components/german/german.css`
- `src/components/german/overview.ts`
- `src/components/german/types.ts`
- `src/server/german/activities.ts`
- `src/server/german/aiFeatures.ts`
- `src/server/german/audio.ts`
- `src/server/german/cefr.ts`
- `src/server/german/index.ts`
- `src/server/german/preparation.ts`
- `src/server/german/satzbau.ts`
- `src/server/german/sentenceGrading.ts`
- `src/server/german/store.ts`
- `src/shared/germanPreparation.ts`
- `src/shared/germanTaskHelp.ts`
- `tests/german.browser.ts`
- `tests/german.curriculum-satzbau-audio.test.ts`
- `tests/german.experience.test.ts`
