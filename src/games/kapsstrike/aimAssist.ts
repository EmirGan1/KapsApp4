import type { MapDefinition, Vec3 } from './types';
import { collisionSolids, raySolid } from './physics';

type AimTarget = { position: Vec3; hp: number; friendly?: boolean };

function visibleAimOffset(eye: Vec3, yaw: number, pitch: number, targets: AimTarget[], map: MapDefinition, radius: number, range: number) {
  let closest: { yaw: number; pitch: number; angle: number } | undefined;
  for (const target of targets) {
    if (target.hp <= 0 || target.friendly) continue;
    const x = target.position.x - eye.x;
    const y = target.position.y + 1.05 - eye.y;
    const z = target.position.z - eye.z;
    const distance = Math.hypot(x, y, z);
    if (distance < 1 || distance > range) continue;
    const offset = Math.atan2(x, z) - yaw;
    const deltaYaw = Math.atan2(Math.sin(offset), Math.cos(offset));
    const deltaPitch = -Math.atan2(y, Math.hypot(x, z)) - pitch;
    const angle = Math.hypot(deltaYaw, deltaPitch);
    if (angle >= (closest?.angle ?? radius)) continue;
    const direction = { x: x / distance, y: y / distance, z: z / distance };
    if (collisionSolids(map).some(solid => !solid.detail && raySolid(eye, direction, solid, distance) < distance - .1)) continue;
    closest = { yaw: deltaYaw, pitch: deltaPitch, angle };
  }
  return closest;
}

export function touchAimFriction(eye: Vec3, yaw: number, pitch: number, targets: AimTarget[], map: MapDefinition, aiming = false) {
  const radius = aiming ? .075 : .06;
  const target = visibleAimOffset(eye, yaw, pitch, targets, map, radius, 35);
  return target ? 1 - (1 - target.angle / radius) * (aiming ? .32 : .22) : 1;
}

export function tabletAimDelta(eye: Vec3, yaw: number, pitch: number, delta: { yaw: number; pitch: number }, targets: AimTarget[], map: MapDefinition, aiming: boolean) {
  const speed = Math.hypot(delta.yaw, delta.pitch);
  const radius = aiming ? .09 : .075;
  if (speed === 0 || speed >= radius) return delta;
  const target = visibleAimOffset(eye, yaw, pitch, targets, map, radius, aiming ? 35 : 26);
  if (!target) return delta;

  const proximity = 1 - target.angle / radius;
  const strength = proximity * (1 - speed / radius);
  const friction = 1 - strength * (aiming ? .42 : .31);
  // Reinforce only the axes the player is already moving toward the target.
  const steer = (input: number, remaining: number) => {
    const slowed = input * friction;
    if (input * remaining <= 0) return slowed;
    const room = Math.max(0, Math.abs(remaining) - Math.abs(slowed));
    return slowed + Math.sign(input) * Math.min(room, Math.abs(input) * strength * .18);
  };
  return { yaw: steer(delta.yaw, target.yaw), pitch: steer(delta.pitch, target.pitch) };
}
