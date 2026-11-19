# Exclusive travel planner

The only entry button lives in the verified two-person DM. The standalone route is
`/gezi-planlama`. It has no sidebar, global search, sitemap or public navigation entry.
All data operations use the existing approved, non-banned session resolver, device
guard, application libSQL client and a strict Bearer header. Admin status, query
parameters and client usernames never authorize access.

## Bind the existing accounts before first use

Access stays closed until the two existing production IDs are configured. The
repository database does not contain usable production accounts, so IDs must be
resolved on the actual database. For a local SQLite deployment, run this from the
new checkout before restarting the application.

```bash
cd /var/www/KapsApp
python3 scripts/configure-private-travel.py   --database /var/www/KapsApp/local.db   --env /var/www/KapsApp/.env   --backup-dir /var/backups/kapsapp
```

Use an account with permission to read SQLite/WAL and write the environment file
and backup directory. The script reads the two account IDs, verifies the source
with quick_check, takes a consistent online SQLite backup including WAL contents,
verifies backup integrity, then atomically writes only these two environment keys.
It rejects ambiguous users, conflicting configured IDs and conflicting pinned IDs.
It never copies over, deletes or resets SQLite, WAL or SHM files. Keep the backup
outside the web root. The normal update workflow can then build and restart
`kapsapp-production`.

For Turso/libSQL URLs, back up and check the database actually used by PM2 using
the provider's supported procedure. Resolve the two existing user IDs there and
set `KAPSAPP_TRAVEL_DIDO_ID` and `KAPSAPP_TRAVEL_EMIRGAN_ID` in the existing runtime
environment. Do not use a local file that production does not use.

The first authorized request adds five travel-only tables and two indexes, then
pins the two configured IDs. Account renames preserve access. Reassigning an ID
in the environment causes access to fail closed. The members table has no
client-accessible mutation endpoint. Account replacement needs a deliberate
operator migration and verification of historical plan ownership.

## Data and collaboration

Every trip belongs to this one pair. Trip and item UUIDs are generated before
submission so an unchanged retry with the same ID is idempotent. A different payload with that ID returns a conflict and keeps the editor open. Metadata and each individual
record have optimistic versions. A stale update or delete returns 409 and the
editor retains the draft. Reopen the latest record and merge the changes.
Votes belong to the authenticated member. Deleting an item deletes its comments
and votes in the same transaction.

Each mutation and the trip revision increment commit in one write transaction.
Snapshot reads use a read transaction. Visible pages check the revision every four
seconds and also on reconnection or return to the app. Unchanged snapshots have
a small response. Background tabs stop polling. Plans are kept in the existing
database. No planner data is written to browser storage. A disconnected edit
stays in the open editor. Saving reports errors and requires a deliberate retry.
Keep the same editor open to reuse its submission ID after a lost acknowledgment.
Archived trips can be reopened and edited.

## Functional sections

- Shared trip library with dates, search, archive, progress and destination.
- Overview with scheduled places, visited count, checklist readiness, expenses,
  remaining budget, next activity, due tasks, unscheduled priorities and change history.
- Places, food and experiences with coordinates, favorites, priorities, Must Visit,
  Must Do, custom categories/tags, search, sort, comparison and saved-for-later state.
- Day itinerary with durations, overlap warnings, day load insights, approximate
  walking distance, unscheduled choices and private downloaded calendar export.
- Leaflet map, per-day connecting lines, coordinate editing, route links and nearby
  grouping through area filters. Map loading requires an explicit click.
- Estimated and actual expenses, category bars, remaining budget and equal two-person
  settlement. Monetary amounts are integer hundredths in one trip currency.
  Place estimates are comparison amounts, not extra expenses.
- Task and packing lists with assignees, due dates and completion.
- Flights, accommodation, dining and other reservation references, dates, status,
  notes and links.
- Shared notes, item comments, and two-person decisions with changeable votes.
- Budapest discovery suggestions ranked by matching entered interests and linked to
  official tourism sources. Other cities support fully custom collections.

Distances are Haversine straight-line estimates. Walking minutes assume 1.25 times
the direct distance at 4.5 km/h. Lines do not claim to follow roads. The map uses
standard OpenStreetMap tiles with attribution and browser caching, no prefetching.
Loading it shares IP and map viewport with the tile service. No paid routing,
booking, search or AI service is required. Live traffic, availability, exchange
rates, automatic bookings and destination-wide live recommendations are outside
this release. Calendar export uses the trip's IANA timezone, and dates/times in the
planner use that same timezone.

## Verification and rollout

Run `npm run build`, `npm run lint`,
`node --import tsx --test tests/travel.test.ts`, `node --import tsx tests/travel.browser.ts` and
`node --import tsx tests/travel.production.browser.ts` after the build.
Review existing baseline TypeScript diagnostics separately if present.

Production acceptance includes both real account IDs, the button in both directions
of their DM, absence in other DMs/groups, another user's API rejection, multi-device
synchronization, simultaneous edits, phone keyboard, reconnect and a restart.
The implementation environment has no VDS session and cannot validate live PM2,
database backup, physical-phone behavior or those production account identities.

## Research and assets

Wanderlog's map/day organization and shared budgeting and TripIt's single place
for booking references informed the navigation and structure. No automatic mail
access or booking import is added.

- https://wanderlog.com/plan-a-trip
- https://www.tripit.com/web/free
- https://www.budapestinfo.hu/en/10-best-viewpoints-in-budapest
- https://www.budapestinfo.hu/en/the-world-heritage-tour-of-buda
- https://www.budapestinfo.hu/en/experience-the-best-water-activities-in-budapest
- https://gerbeaud.hu/en/contact/
- https://www.budapestinfo.hu/en/great-market-hall
- https://operations.osmfoundation.org/policies/tiles/
- Budapest photograph by Tomas Piachewski, Unsplash
  https://unsplash.com/photos/NWXTcSsJX3Y
  Source https://images.unsplash.com/photo-1664186739928-a3a8a3775599
