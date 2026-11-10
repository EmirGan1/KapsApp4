import type { MapDefinition, Vec3 } from './types';
import { clamp, collisionSolids, rayBox, raySolid } from './physics';
import { PHYSICS as C, TARGET_HITBOXES } from './config';
import { tracePlayer } from './hitboxes';
import { aimDirection } from './combat';

type AimTarget = { position: Vec3; hp: number; friendly?: boolean; crouched?: boolean };

function visibleAimOffset(eye: Vec3, yaw: number, pitch: number, targets: AimTarget[], map: MapDefinition, radius: number, range: number) {
  let closest: { yaw: number; pitch: number; angle: number } | undefined;
  for (const target of targets) {
    if (target.hp <= 0 || target.friendly) continue;
    const x = target.position.x - eye.x;
    const y = target.position.y + (target.crouched ? .65 : 1.05) - eye.y;
    const z = target.position.z - eye.z;
    const distance = Math.hypot(x, y, z);
    if (distance < 1 || distance > range) continue;
    const offset = Math.atan2(x, z) - yaw;
    const deltaYaw = Math.atan2(Math.sin(offset), Math.cos(offset));
    const deltaPitch = -Math.atan2(y, Math.hypot(x, z)) - pitch;
    const angle = Math.hypot(deltaYaw, deltaPitch);
    if (angle >= (closest?.angle ?? radius)) continue;
    const direction = { x: x / distance, y: y / distance, z: z / distance };
    if (collisionSolids(map).some(solid => raySolid(eye, direction, solid, distance) < distance)) continue;
    closest = { yaw: deltaYaw, pitch: deltaPitch, angle };
  }
  return closest;
}

export function touchAimDelta(
  eye: Vec3, yaw: number, pitch: number, delta: { yaw: number; pitch: number },
  targets: AimTarget[], map: MapDefinition, aiming: boolean,
) {
  const speed = Math.hypot(delta.yaw, delta.pitch);
  const radius = aiming ? .09 : .075;
  if (speed === 0 || speed >= radius) return delta;
  const target = visibleAimOffset(eye, yaw, pitch, targets, map, radius, aiming ? 35 : 30);
  if (!target) return delta;

  const strength = (1 - target.angle / radius) * (1 - speed / radius);
  const toward = delta.yaw * target.yaw + delta.pitch * target.pitch > 0;
  if (!toward) {
    // Slow only near the center. Turning away farther out remains under full player control.
    const center = Math.max(0, 1 - target.angle / (radius * .35));
    const friction = 1 - center * strength * (aiming ? .30 : .23);
    return { yaw: delta.yaw * friction, pitch: delta.pitch * friction };
  }

  const steer = (input: number, remaining: number) => {
    if (input * remaining <= 0) return input;
    const movement = Math.abs(input);
    const room = Math.abs(remaining);
    // Resist overshoot without locking the crosshair, and never add movement past the target.
    const adjusted = movement >= room
      ? movement - (movement - room) * strength * (aiming ? .30 : .23)
      : movement + Math.min(room - movement, movement * strength * (aiming ? .16 : .12));
    return Math.sign(input) * adjusted;
  };
  return { yaw: steer(delta.yaw, target.yaw), pitch: steer(delta.pitch, target.pitch) };
}

export type TouchCombatTarget = AimTarget & {
  id: string;
  yaw?: number;
  pitch?: number;
  dummy?: boolean;
  protected?: boolean;
};

function crosshairTarget(eye: Vec3, yaw: number, pitch: number, targets: TouchCombatTarget[], map: MapDefinition, range: number) {
  const direction = aimDirection(yaw, pitch);
  const sinYaw = Math.sin(yaw), cosYaw = Math.cos(yaw);
  let nearest = range;
  let hit: TouchCombatTarget | undefined;
  for (const target of targets) {
    if (target.hp <= 0) continue;
    const x = target.position.x - eye.x, z = target.position.z - eye.z;
    const along = x * sinYaw + z * cosYaw;
    if (along < -1 || along > range + 1 || Math.abs(x * cosYaw - z * sinYaw) > 1) continue;
    const distance = target.dummy
      ? Math.min(...Object.values(TARGET_HITBOXES).map(box => rayBox(eye, direction,
        { x: target.position.x - box.radius, y: target.position.y + box.min, z: target.position.z - box.radius },
        { x: target.position.x + box.radius, y: target.position.y + box.max, z: target.position.z + box.radius }, nearest)))
      : tracePlayer(eye, direction, { ...target, height: target.crouched ? C.crouching : C.standing }, nearest)?.distance ?? Infinity;
    if (distance < nearest) {
      nearest = distance;
      hit = target;
    }
  }
  if (!hit || hit.friendly || hit.protected) return undefined;
  return collisionSolids(map).some(solid => raySolid(eye, direction, solid, nearest) <= nearest) ? undefined : hit;
}

export class TouchCombatAssist {
  private lock?: TouchCombatTarget;
  private dwell = 0;

  reset() {
    this.lock = undefined;
    this.dwell = 0;
  }

  step(eye: Vec3, yaw: number, pitch: number, targets: TouchCombatTarget[], map: MapDefinition, range: number, tracking: boolean, autoFire: boolean, dt: number) {
    let trackedYaw = yaw, trackedPitch = pitch;
    const previous = this.lock;
    const next = tracking && previous ? targets.find(target => target.id === previous.id && target.hp > 0 && !target.friendly && !target.protected) : undefined;
    if (next && previous) {
      const angles = (target: TouchCombatTarget) => {
        const x = target.position.x - eye.x, z = target.position.z - eye.z;
        return { yaw: Math.atan2(x, z), pitch: -Math.atan2(target.position.y + (target.crouched ? .65 : 1.05) - eye.y, Math.hypot(x, z)) };
      };
      const before = angles(previous), after = angles(next);
      const horizontal = after.yaw - before.yaw;
      const dx = Math.atan2(Math.sin(horizontal), Math.cos(horizontal)), dy = after.pitch - before.pitch;
      const size = Math.hypot(dx, dy);
      // Follow a fraction of target motion only after acquisition, with no snap on teleports.
      if (size > 0 && size < .04) {
        const gain = Math.min(.5, .24 * dt / size);
        const candidateYaw = yaw + dx * gain;
        const candidatePitch = clamp(pitch + dy * gain, -1.48, 1.48);
        if (crosshairTarget(eye, candidateYaw, candidatePitch, targets, map, range)?.id === next.id) {
          trackedYaw = candidateYaw;
          trackedPitch = candidatePitch;
        }
      }
    }

    const hit = crosshairTarget(eye, trackedYaw, trackedPitch, targets, map, range);
    this.dwell = hit && autoFire ? (hit.id === previous?.id ? this.dwell : 0) + dt : 0;
    this.lock = hit && { ...hit, position: { ...hit.position } };
    return { yaw: trackedYaw, pitch: trackedPitch, fire: !!hit && this.dwell >= .12 };
  }
}
