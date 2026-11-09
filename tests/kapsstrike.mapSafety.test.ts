import test from 'node:test';
import assert from 'node:assert/strict';
import { PHYSICS as C } from '../src/games/kapsstrike/config';
import { MAPS } from '../src/games/kapsstrike/maps';
import { fits, move, newMovement, support } from '../src/games/kapsstrike/physics';
import { roamingSpawns } from '../src/games/kapsstrike/spawns';
import type { InputCommand } from '../src/games/kapsstrike/types';

const neutral: InputCommand = {
  sequence: 0, tick: 0, moveX: 0, moveZ: 0, yaw: 0, pitch: 0,
  jump: false, sprint: false, crouch: false, fire: false, ads: false, reload: false,
};

for (const map of Object.values(MAPS)) {
  const pool = roamingSpawns(map);
  for (let seed = 0; seed < 100; seed++) {
    test(`${map.id}: spawn, wall contact and recovery seed ${seed}`, () => {
      const start = pool[Math.floor(seed * pool.length / 100)];
      const movement = newMovement(start);
      assert.ok(fits(map, start, C.standing));
      assert.ok(Math.abs(support(map, start, start.y + .06) - start.y) < .1);

      for (let tick = 0; tick < 700; tick++) {
        const angle = seed * 2.39996 + Math.floor(tick / 100) * 1.17;
        move(movement, {
          ...neutral, sequence: tick, tick, yaw: angle, moveZ: 1,
          jump: (tick + seed) % 101 === 0, sprint: tick % 240 < 120, crouch: tick % 180 < 18,
        }, map, tick);
        const { x, y, z } = movement.position;
        assert.ok(Number.isFinite(x + y + z) && y >= 0, JSON.stringify(movement.position));
        assert.ok(Math.abs(x) <= map.bounds - C.radius + .001 && Math.abs(z) <= map.bounds - C.radius + .001);
        assert.ok(fits(map, movement.position, movement.height), JSON.stringify({ tick, position: movement.position, start }));
      }

      const obstruction = map.solids.find(solid => !solid.detail && solid.kind === 'box' && solid.h >= 3 && solid.w >= 2 && solid.d >= 2)!;
      movement.position = { x: obstruction.x, y: obstruction.y + .1, z: obstruction.z };
      move(movement, neutral, map, 701);
      assert.ok(fits(map, movement.position, movement.height));
      movement.position = { x: start.x, y: -20, z: start.z };
      move(movement, neutral, map, 702);
      assert.deepEqual(movement.position, start);
    });
  }
}
