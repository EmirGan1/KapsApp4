import type { MapDefinition, Vec3 } from './types';
import { collisionSolids, raySolid } from './physics';

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
