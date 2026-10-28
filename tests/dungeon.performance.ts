import { performance } from "node:perf_hooks";
import { Server } from "socket.io";
import { createRun, makeHero, step } from "../src/games/dungeon/engine";
import { DungeonManager } from "../src/server/dungeonServer";
import { drive } from "./dungeon.pilot";
const runs = Array.from({ length: 10 }, (_, seed) =>
  createRun("perf" + seed, seed, "adventurer", [
    makeHero(1, "W", "warrior"),
    makeHero(2, "M", "mage"),
    makeHero(3, "H", "healer"),
    makeHero(4, "M2", "mage"),
  ]),
);
const perfIO = new Server();
const manager: any = new DungeonManager(perfIO, null);
clearInterval(manager.timer);
const samples: number[] = [],
  sizes: number[] = [];
const memory = process.memoryUsage().heapUsed;
for (let i = 0; i < 1000; i++) {
  const t = performance.now();
  for (const r of runs) {
    drive(r);
    step(r);
    if (i % 10 === 0)
      sizes.push(Buffer.byteLength(JSON.stringify(manager.snapshot(r))));
  }
  samples.push(performance.now() - t);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      rooms: 10,
      playersPerRoom: 4,
      steps: 1000,
      totalTicks: 10000,
      meanBatchMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p95BatchMs: samples[Math.floor(samples.length * 0.95)],
      maxBatchMs: samples.at(-1),
      averageSnapshotBytes: sizes.reduce((a, b) => a + b, 0) / sizes.length,
      maxSnapshotBytes: Math.max(...sizes),
      heapGrowthMB: (process.memoryUsage().heapUsed - memory) / 1024 / 1024,
      note: "Includes test-controller decisions and periodic JSON serialization, excludes transport and browser rendering; heap is not a leak measurement.",
    },
    null,
    2,
  ),
);
manager.destroy();
perfIO.close();
