# Automatic reload, collision broad phase and the Prism collection

Empty firearm magazines start the existing reload animation and sound immediately after the last accepted shot (or the next step when already empty), even after releasing fire. Client prediction and authority use the same helper. Reloading respects equip delay, death/weapon cancellation, and frozen bomb phases; knives never reload. The firing command is not mutated into a reload request, avoiding rejection of the last predicted bullet. Existing reload durations and weapon damage/fire rates are unchanged. Holding automatic fire resumes after reload; semi-automatic guns still require trigger release.

The catalog now contains **267 skins**, including 144 new finishes: twelve on each of eight firearms and four blade shapes. Twelve new SVG motifs have weapon-specific orientation and signatures. Inventory, local and remote weapons use the existing shared paint pipeline. Prizma, Sakura and Hükümdar increase the case count to nine; each costs 400 credits after its first free opening. Cases retain 40/30/20/5/5 percent rarity buckets, contain several weapon families, and display individual item odds. Existing IDs and ownership remain valid.

## Performance changes

- Cache collision solids in 8 m X/Z cells, expanded by capsule radius. Capsule/ramp narrow-phase equations and authored geometry remain identical. Both the client and server query nearby candidates instead of scanning the whole map. Cache invalidates on source-array replacement or length changes; authored solid coordinates are immutable after map construction.
- Build common player projections, world state and events once per snapshot broadcast, then append only recipient-specific acknowledgement, local state and bomb view. Disconnected recipients are skipped. Private recipient state is never shared.
- Poll server simulation at 120 Hz instead of 60 Hz, matching existing fixed-step physics. Elapsed-time accumulation still determines actual simulation steps. This reduces waiting between received input and its next simulation step; snapshots remain 30 Hz and reliable, with no dropped action commands.
- Texture resolution, lighting, shadows, geometry, render scale and medium/high quality presets are unchanged. This reduces CPU work; GPU-bound devices are not guaranteed an FPS gain.

## Reproducible measurements

Baseline: `f476b26acd5a4e21342237e7ee82fbc80ac2dacc`. Use an isolated baseline checkout sharing installed dependencies, then run the same scripts from this checkout:

```sh
STRIKE_BENCH_ROOT=/path/to/baseline node --import tsx tests/kapsstrike.performance.measure.ts
node --import tsx tests/kapsstrike.performance.measure.ts
STRIKE_BENCH_ROOT=/path/to/baseline node --import tsx tests/kapsstrike.latency.measure.ts
node --import tsx tests/kapsstrike.latency.measure.ts
```

Eight local Socket.IO clients, Dust II (`district`), 3.2 seconds of 60 Hz input per client:

| Metric | Baseline | Changed |
|---|---:|---:|
| Input receipt → processed, median | 19.043 ms | 4.425 ms |
| Input receipt → processed, p95 | 79.459 ms | 12.574 ms |
| Simulation step, median | 12.009 ms | 0.448 ms |
| Simulation step, p95 | 22.470 ms | 4.706 ms |
| Input send → acknowledged snapshot, median | 460.973 ms | 12.002 ms |
| Input send → acknowledged snapshot, p95 | 492.025 ms | 54.072 ms |

These are single-machine diagnostic measurements, not Internet RTT or production FPS guarantees. Baseline fell behind real time under this local load (269 steps vs 363); fewer received input sequences were processed. The snapshot-ack difference includes that backlog and should not be interpreted as a network ping improvement. More frequent timer wakeups trade a little scheduler overhead for lower processing wait. Rerun with production hardware, room counts and real clients before making capacity claims.

## Validation

The new regression suite compares indexed collisions against the original full-scan equations across every map, including solid edges, ramps, both stances and 5,000 deterministic points per map. It also checks reload parity, timing, frozen starts, unique textures, complete weapon/blade coverage, case prices, rarity boundaries and per-recipient snapshot isolation.

Existing audits cover 1,000 geometry/bomb scenarios, 4v4 gameplay, real 8/10-client jitter/reconnect flows, and scene quality/resource reuse. The browser test loads every skin's actual texture and compares its URL to inventory paint, then renders the new gold finish at medium and high quality. GitHub Actions runs this browser check because the local host disallows Chromium's process singleton socket.

CPU microbenchmark (median of seven warmed runs, 5,000 paired clearance/support queries per map):

| Workload | Baseline | Changed |
|---|---:|---:|
| Dust II (`district`) | 1504.57 ms | 22.60 ms |
| Warehouse | 97.84 ms | 7.52 ms |
| Dust | 110.90 ms | 4.37 ms |
| Neon | 92.46 ms | 3.48 ms |
| 1,000 snapshot broadcasts × 8 recipients | 9.02 ms | 5.21 ms |

Collision result checksums match in all four maps. This is operation time, not frame time or an FPS multiplier. Snapshot timing excludes JSON serialization and network delivery.
