import type { MapDefinition, Solid, Vec3 } from "./types";
import { clamp, collisionSolids, raySolid } from "./physics";

export const GRENADE_NAMES = { flash: "Flaş bombası", frag: "El bombası", smoke: "Sis bombası" } as const;
export type GrenadeKind = keyof typeof GRENADE_NAMES;
export const GRENADE_KEYS: GrenadeKind[] = ["flash", "frag", "smoke"];
export const SMOKE_RADIUS = 3.8;
export const FRAG_RADIUS = 8;
export const FRAG_BURST_DURATION = 0.55;
export const GRENADE_RADIUS = 0.12;

export type Grenade = {
  id: string; kind: GrenadeKind; actor: string; team: string; position: Vec3; velocity: Vec3;
  detonate: number; expires?: number;
};

export function isGrenade(value: unknown): value is GrenadeKind {
  return typeof value === "string" && Object.hasOwn(GRENADE_NAMES, value);
}

export function grenadeLaunch(
  id: string, kind: GrenadeKind, actor: string, team: string, origin: Vec3,
  direction: Vec3, now: number, short: boolean, playerVelocity: Vec3,
): Grenade {
  const yaw = Math.atan2(direction.x, direction.z);
  const aimElevation = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
  const elevation = short
    ? 0.34
    : clamp(aimElevation + Math.PI / 18, -Math.PI / 2, Math.PI / 2);
  const speed = short ? 6 : 30;
  const horizontalSpeed = speed * Math.cos(elevation);
  // Full throws carry the thrower's movement. Short tosses stay close even at a sprint.
  const inheritedVelocity = short ? 0 : 0.85;

  return {
    id, kind, actor, team, position: { ...origin },
    velocity: {
      x: Math.sin(yaw) * horizontalSpeed + playerVelocity.x * inheritedVelocity,
      y: Math.sin(elevation) * speed + playerVelocity.y * inheritedVelocity,
      z: Math.cos(yaw) * horizontalSpeed + playerVelocity.z * inheritedVelocity,
    },
    detonate: now + (kind === "frag" ? 1.45 : 1.25),
  };
}

export function grenadeLineClear(map: MapDefinition, from: Vec3, to: Vec3) {
  const x = to.x - from.x, y = to.y - from.y, z = to.z - from.z;
  const distance = Math.hypot(x, y, z);
  if (distance < 0.001) return true;
  const direction = { x: x / distance, y: y / distance, z: z / distance };
  return !collisionSolids(map).some(solid => raySolid(from, direction, solid, distance) < distance - 0.01);
}

type SweepHit = {
  t: number;
  normal: Vec3;
  exactY?: number;
};

function intersectExpandedPlanes(
  origin: Vec3,
  dir: Vec3,
  planes: readonly [number, number, number, number][],
  radius: number,
  maxDist: number,
): SweepHit | null {
  let enter = -Infinity;
  let exit = maxDist;
  let hitNormal: Vec3 | null = null;
  let insideAll = true;
  let minDepth = Infinity;
  let pushNormal: Vec3 | null = null;

  for (const [ra, rb, rc, rd] of planes) {
    const len = Math.hypot(ra, rb, rc);
    if (len < 1e-9) continue;
    const a = ra / len, b = rb / len, c = rc / len, d = rd / len + radius;
    const signedDist = a * origin.x + b * origin.y + c * origin.z - d;
    if (signedDist > 0) insideAll = false;
    else if (-signedDist < minDepth) {
      minDepth = -signedDist;
      pushNormal = { x: a, y: b, z: c };
    }

    const q = -signedDist;
    const den = a * dir.x + b * dir.y + c * dir.z;
    if (Math.abs(den) < 1e-9) {
      if (q < 0) return null;
      continue;
    }
    const t = q / den;
    if (den > 0) {
      exit = Math.min(exit, t);
    } else if (t > enter) {
      enter = t;
      hitNormal = { x: a, y: b, z: c };
    }
    if (enter > exit) return null;
  }

  if (insideAll && pushNormal) {
    return { t: 0, normal: pushNormal };
  }
  if (enter >= 0 && enter <= maxDist && enter <= exit && hitNormal) {
    return { t: enter, normal: hitNormal };
  }
  return null;
}

function sweepExpandedSolid(
  origin: Vec3,
  dir: Vec3,
  s: Solid,
  radius: number,
  maxDist: number,
): SweepHit | null {
  // Fast AABB broad-phase rejection expanded by sphere radius + travel distance
  const minX = s.x - s.w / 2 - radius;
  const maxX = s.x + s.w / 2 + radius;
  const minY = s.y - radius;
  const maxY = s.y + s.h + radius;
  const minZ = s.z - s.d / 2 - radius;
  const maxZ = s.z + s.d / 2 + radius;

  const endX = origin.x + dir.x * maxDist;
  const endY = origin.y + dir.y * maxDist;
  const endZ = origin.z + dir.z * maxDist;
  if (
    Math.max(origin.x, endX) < minX || Math.min(origin.x, endX) > maxX ||
    Math.max(origin.y, endY) < minY || Math.min(origin.y, endY) > maxY ||
    Math.max(origin.z, endZ) < minZ || Math.min(origin.z, endZ) > maxZ
  ) {
    return null;
  }

  if (s.kind === "box" && !s.shape) {
    // Inside AABB check
    if (
      origin.x >= minX && origin.x <= maxX &&
      origin.y >= minY && origin.y <= maxY &&
      origin.z >= minZ && origin.z <= maxZ
    ) {
      const candidates: [number, Vec3, number | undefined][] = [
        [origin.x - minX, { x: -1, y: 0, z: 0 }, undefined],
        [maxX - origin.x, { x: 1, y: 0, z: 0 }, undefined],
        [origin.y - minY, { x: 0, y: -1, z: 0 }, undefined],
        [maxY - origin.y, { x: 0, y: 1, z: 0 }, maxY],
        [origin.z - minZ, { x: 0, y: 0, z: -1 }, undefined],
        [maxZ - origin.z, { x: 0, y: 0, z: 1 }, undefined],
      ];
      let best = candidates[0];
      for (let i = 1; i < candidates.length; i++) {
        if (candidates[i][0] < best[0]) best = candidates[i];
      }
      return { t: 0, normal: best[1], exactY: best[2] };
    }

    let enter = -Infinity;
    let exit = maxDist;
    let nx = 0, ny = 0, nz = 0;
    let exactY: number | undefined;

    for (let axis = 0; axis < 3; axis++) {
      const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z;
      const d = axis === 0 ? dir.x : axis === 1 ? dir.y : dir.z;
      const low = axis === 0 ? minX : axis === 1 ? minY : minZ;
      const high = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;

      if (Math.abs(d) < 1e-9) {
        if (o < low || o > high) return null;
        continue;
      }
      const inv = 1 / d;
      const tLow = (low - o) * inv;
      const tHigh = (high - o) * inv;
      const t1 = Math.min(tLow, tHigh);
      const t2 = Math.max(tLow, tHigh);
      if (t1 > enter) {
        enter = t1;
        nx = axis === 0 ? (d > 0 ? -1 : 1) : 0;
        ny = axis === 1 ? (d > 0 ? -1 : 1) : 0;
        nz = axis === 2 ? (d > 0 ? -1 : 1) : 0;
        exactY = axis === 1 && ny > 0 ? maxY : undefined;
      }
      exit = Math.min(exit, t2);
      if (enter > exit) return null;
    }

    if (enter >= 0 && enter <= maxDist && enter <= exit) {
      return { t: enter, normal: { x: nx, y: ny, z: nz }, exactY };
    }
    return null;
  }

  const planes: [number, number, number, number][] = [
    [1, 0, 0, s.x + s.w / 2],
    [-1, 0, 0, -s.x + s.w / 2],
    [0, 0, 1, s.z + s.d / 2],
    [0, 0, -1, -s.z + s.d / 2],
    [0, -1, 0, -s.y],
  ];

  if (s.kind === "box" && s.shape) {
    planes.splice(0, 4);
    const sides = s.shape === "cone" ? 8 : 12;
    const apothem = Math.cos(Math.PI / sides);
    for (let i = 0; i < sides; i++) {
      const angle = ((i + 0.5) * Math.PI * 2) / sides;
      const a = Math.cos(angle) / (s.w / 2);
      const c = Math.sin(angle) / (s.d / 2);
      const b = s.shape === "cone" ? apothem / s.h : 0;
      planes.push([a, b, c, a * s.x + c * s.z + apothem + b * s.y]);
    }
    planes.push([0, 1, 0, s.y + s.h]);
  } else {
    const k = ((s.reverse ? -1 : 1) * s.h) / (s.axis === "x" ? s.w : s.d);
    const low = s.axis === "x" ? s.x - s.w / 2 : s.z - s.d / 2;
    planes.push(
      s.axis === "x"
        ? [-k, 1, 0, s.y + (s.reverse ? s.h : 0) - k * low]
        : [0, 1, -k, s.y + (s.reverse ? s.h : 0) - k * low],
    );
  }

  return intersectExpandedPlanes(origin, dir, planes, radius, maxDist);
}

function closestBoundaryOrSolidHit(
  origin: Vec3,
  disp: Vec3,
  map: MapDefinition,
  solids: Solid[],
): SweepHit | null {
  const dist = Math.hypot(disp.x, disp.y, disp.z);
  const dir = dist > 1e-8 ? { x: disp.x / dist, y: disp.y / dist, z: disp.z / dist } : { x: 0, y: -1, z: 0 };
  let best: SweepHit | null = null;
  const consider = (hit: SweepHit | null) => {
    if (!hit) return;
    if (!best || hit.t < best.t) best = hit;
  };

  // Floor plane y = GRENADE_RADIUS
  if (origin.y <= GRENADE_RADIUS + 1e-6) {
    consider({ t: 0, normal: { x: 0, y: 1, z: 0 }, exactY: GRENADE_RADIUS });
  } else if (disp.y < -1e-8) {
    const t = (GRENADE_RADIUS - origin.y) / dir.y;
    if (t >= 0 && t <= dist) consider({ t, normal: { x: 0, y: 1, z: 0 }, exactY: GRENADE_RADIUS });
  }

  // Arena bounds walls
  const limit = map.bounds - GRENADE_RADIUS;
  if (origin.x >= limit - 1e-6) consider({ t: 0, normal: { x: -1, y: 0, z: 0 } });
  else if (disp.x > 1e-8) {
    const t = (limit - origin.x) / dir.x;
    if (t >= 0 && t <= dist) consider({ t, normal: { x: -1, y: 0, z: 0 } });
  }
  if (origin.x <= -limit + 1e-6) consider({ t: 0, normal: { x: 1, y: 0, z: 0 } });
  else if (disp.x < -1e-8) {
    const t = (-limit - origin.x) / dir.x;
    if (t >= 0 && t <= dist) consider({ t, normal: { x: 1, y: 0, z: 0 } });
  }
  if (origin.z >= limit - 1e-6) consider({ t: 0, normal: { x: 0, y: 0, z: -1 } });
  else if (disp.z > 1e-8) {
    const t = (limit - origin.z) / dir.z;
    if (t >= 0 && t <= dist) consider({ t, normal: { x: 0, y: 0, z: -1 } });
  }
  if (origin.z <= -limit + 1e-6) consider({ t: 0, normal: { x: 0, y: 0, z: 1 } });
  else if (disp.z < -1e-8) {
    const t = (-limit - origin.z) / dir.z;
    if (t >= 0 && t <= dist) consider({ t, normal: { x: 0, y: 0, z: 1 } });
  }

  // Authoritative map solids
  for (const solid of solids) {
    consider(sweepExpandedSolid(origin, dir, solid, GRENADE_RADIUS, dist));
  }

  return best;
}

export function stepGrenade(grenade: Grenade, map: MapDefinition, dt: number, now: number): boolean {
  if (grenade.expires !== undefined) return false;
  const p = grenade.position;
  const v = grenade.velocity;
  const solids = collisionSolids(map);

  // Sub-step fast throws so grenades never tunnel through thin walls or doorframes.
  const speed = Math.hypot(v.x, v.y, v.z);
  const subSteps = Math.max(1, Math.min(8, Math.ceil((speed * dt + 0.01) / 0.05)));
  const subDt = dt / subSteps;
  let touchesGround = false;

  for (let step = 0; step < subSteps; step++) {
    v.y -= 16 * subDt;
    const airDrag = Math.exp(-0.08 * subDt);
    v.x *= airDrag;
    v.z *= airDrag;

    let remaining = subDt;
    for (let bounce = 0; bounce < 2 && remaining > 1e-5; bounce++) {
      const disp = { x: v.x * remaining, y: v.y * remaining, z: v.z * remaining };
      const dist = Math.hypot(disp.x, disp.y, disp.z);
      const hit = closestBoundaryOrSolidHit(p, disp, map, solids);
      if (!hit) {
        p.x += disp.x;
        p.y += disp.y;
        p.z += disp.z;
        break;
      }

      const moveFraction = dist > 1e-8 ? clamp(hit.t / dist, 0, 1) : 0;
      p.x += disp.x * moveFraction;
      p.y += disp.y * moveFraction;
      p.z += disp.z * moveFraction;

      const n = hit.normal;
      const vn = v.x * n.x + v.y * n.y + v.z * n.z;
      const isGroundLike = n.y > 0.65;
      if (isGroundLike) {
        touchesGround = true;
        if (now >= grenade.detonate && grenade.kind !== "flash") {
          if (hit.exactY !== undefined) p.y = hit.exactY;
          v.x = 0;
          v.y = 0;
          v.z = 0;
          step = subSteps;
          break;
        }
      }

      if (vn < 0) {
        const restitution = isGroundLike ? (Math.abs(vn) > 2 ? 0.24 : 0) : 0.44;
        const tangentFriction = isGroundLike ? (Math.abs(vn) > 2 ? 0.62 : 0.92) : 0.84;

        const vtx = v.x - n.x * vn;
        const vty = v.y - n.y * vn;
        const vtz = v.z - n.z * vn;

        v.x = vtx * tangentFriction - n.x * (vn * restitution);
        v.y = vty * tangentFriction - n.y * (vn * restitution);
        v.z = vtz * tangentFriction - n.z * (vn * restitution);

        if (isGroundLike && restitution === 0) {
          v.y = Math.max(0, v.y);
        }
      }

      if (isGroundLike && hit.exactY !== undefined && Math.abs(v.y) < 1e-4) {
        p.y = hit.exactY;
      } else {
        p.x += n.x * 0.0015;
        p.y += n.y * 0.0015;
        p.z += n.z * 0.0015;
      }

      if (isGroundLike && Math.hypot(v.x, v.z) < 0.12) {
        v.x = 0;
        v.z = 0;
      }

      remaining *= 1 - moveFraction;
    }
  }

  if (now < grenade.detonate || (grenade.kind !== "flash" && !touchesGround)) return false;
  grenade.expires = now + (grenade.kind === "smoke" ? 11 : grenade.kind === "frag" ? FRAG_BURST_DURATION : 0.23);
  return true;
}

export function grenadeEffect(kind: GrenadeKind, map: MapDefinition, origin: Vec3, eye: Vec3, facing: Vec3) {
  const dx = origin.x - eye.x, dy = origin.y - eye.y, dz = origin.z - eye.z;
  const distance = Math.hypot(dx, dy, dz);
  const range = kind === "flash" ? 15 : FRAG_RADIUS;
  if (kind === "smoke" || distance >= range || !grenadeLineClear(map, origin, eye)) return 0;
  if (kind === "frag") return Math.ceil(82 * (1 - distance / range));
  const dot = distance > 0.001 ? (dx * facing.x + dy * facing.y + dz * facing.z) / distance : 1;
  return (1 - distance / range) * (dot > 0.25 ? 2.8 : 0.55);
}
