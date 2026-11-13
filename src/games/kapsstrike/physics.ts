import {
  Vec3,
  MovementState,
  InputCommand,
  MapDefinition,
  Solid,
} from "./types";
import { PHYSICS as C, WEAPONS } from "./config";

const collisionCache = new WeakMap<MapDefinition, { source: Solid[]; length: number; solids: Solid[] }>();
/** Authored map geometry is immutable; skip thousands of facade fittings in the hot path. */
export function collisionSolids(map: MapDefinition): Solid[] {
  let result = collisionCache.get(map);
  if (!result || result.source !== map.solids || result.length !== map.solids.length) {
    result = { source: map.solids, length: map.solids.length, solids: map.solids.filter(s => !s.detail) };
    collisionCache.set(map, result);
  }
  return result.solids;
}

type SpatialIndex = { solids: Solid[]; cells: Map<string, Solid[]> };
const spatialCache = new WeakMap<MapDefinition, SpatialIndex>();
const viewmodelSpatialCache = new WeakMap<MapDefinition, SpatialIndex>();
const CELL = 8;
const EMPTY_SOLIDS: Solid[] = [];

/** Broad phase only: preserve authored order and the exact capsule/ramp narrow phase. */
export function nearbyCollisionSolids(map: MapDefinition, p: Vec3): Solid[] {
  return collisionCell(map, p, C.radius, spatialCache);
}

/** Candidate solids for the viewmodel's one-metre wall probe. */
export function nearbyViewmodelSolids(map: MapDefinition, p: Vec3): Solid[] {
  return collisionCell(map, p, 1, viewmodelSpatialCache);
}

function collisionCell(map: MapDefinition, p: Vec3, padding: number, cache: WeakMap<MapDefinition, SpatialIndex>): Solid[] {
  const solids = collisionSolids(map);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) return solids;
  let index = cache.get(map);
  if (!index || index.solids !== solids) {
    const cells = new Map<string, Solid[]>();
    for (const s of solids) {
      for (let x = Math.floor((s.x - s.w / 2 - padding) / CELL); x <= Math.floor((s.x + s.w / 2 + padding) / CELL); x++) {
        for (let z = Math.floor((s.z - s.d / 2 - padding) / CELL); z <= Math.floor((s.z + s.d / 2 + padding) / CELL); z++) {
          const key = x + "," + z;
          let list = cells.get(key);
          if (!list) {
            list = [];
            cells.set(key, list);
          }
          list.push(s);
        }
      }
    }
    index = { solids, cells };
    cache.set(map, index);
  }
  return index.cells.get(Math.floor(p.x / CELL) + "," + Math.floor(p.z / CELL)) ?? EMPTY_SOLIDS;
}

export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));

export function surface(s: Solid, x: number, z: number) {
  if (s.kind !== "ramp") return s.y + s.h;
  const t = clamp(s.axis === "x" ? (x - s.x + s.w / 2) / s.w : (z - s.z + s.d / 2) / s.d, 0, 1);
  return s.y + s.h * (s.reverse ? 1 - t : t);
}

function ellipseOverlaps(cx: number, cz: number, rx: number, rz: number, px: number, pz: number, r: number): boolean {
  const ex = Math.max(0.01, rx) + r;
  const ez = Math.max(0.01, rz) + r;
  const nx = (px - cx) / ex;
  const nz = (pz - cz) / ez;
  return nx * nx + nz * nz < 1 - 1e-8;
}

export function overlaps(s: Solid, p: Vec3, r = C.radius) {
  if (s.kind === "box" && s.shape) {
    // Support circular/elliptical cylinder & cone cross-sections accurately without invisible box corners.
    const taper = s.shape === "cone" ? clamp(1 - Math.max(0, p.y - s.y) / Math.max(0.01, s.h), 0, 1) : 1;
    return ellipseOverlaps(s.x, s.z, (s.w / 2) * taper, (s.d / 2) * taper, p.x, p.z, r);
  }
  const dx = p.x - clamp(p.x, s.x - s.w / 2, s.x + s.w / 2);
  const dz = p.z - clamp(p.z, s.z - s.d / 2, s.z + s.d / 2);
  return dx * dx + dz * dz < r * r - 1e-8;
}

function capsuleHitsSolid(s: Solid, p: Vec3, height: number): boolean {
  if (s.detail) return false;
  if (s.kind === "ramp") {
    return (
      overlaps(s, p) &&
      p.y + height > s.y + 0.001 &&
      p.y < surface(s, p.x, p.z) - 0.001
    );
  }
  if (s.shape === "cylinder") {
    if (p.y + height <= s.y + 0.001 || p.y >= s.y + s.h - 0.001) return false;
    return ellipseOverlaps(s.x, s.z, s.w / 2, s.d / 2, p.x, p.z, C.radius);
  }
  if (s.shape === "cone") {
    if (p.y + height <= s.y + 0.001 || p.y >= s.y + s.h - 0.001) return false;
    const minBandY = clamp(p.y, s.y, s.y + s.h);
    const taper = clamp(1 - (minBandY - s.y) / Math.max(0.01, s.h), 0, 1);
    return ellipseOverlaps(s.x, s.z, (s.w / 2) * taper, (s.d / 2) * taper, p.x, p.z, C.radius);
  }
  const dx = p.x - clamp(p.x, s.x - s.w / 2, s.x + s.w / 2);
  const dz = p.z - clamp(p.z, s.z - s.d / 2, s.z + s.d / 2);
  const low = p.y + C.radius;
  const high = p.y + height - C.radius;
  const dy = low > s.y + s.h ? low - s.y - s.h : high < s.y ? s.y - high : 0;
  return dx * dx + dy * dy + dz * dz < C.radius * C.radius - 1e-6;
}

export function fits(map: MapDefinition, p: Vec3, height: number) {
  return !nearbyCollisionSolids(map, p).some((s) => capsuleHitsSolid(s, p, height));
}

export function support(map: MapDefinition, p: Vec3, maxY: number) {
  let y = 0;
  for (const s of nearbyCollisionSolids(map, p)) {
    if (s.detail || !overlaps(s, p, C.radius)) continue;
    const top = surface(s, p.x, p.z);
    if (top <= maxY + 0.001) y = Math.max(y, top);
  }
  return y;
}

export function newMovement(position: Vec3): MovementState {
  return {
    position: { ...position },
    spawnPosition: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: true,
    stance: "stand",
    slideUntil: 0,
    height: C.standing,
    jumpHeld: false,
    crouchHeld: false,
  };
}

/**
 * Compute horizontal push-out normal when a capsule overlaps a solid laterally
 * so curved cylinders, cones, and diagonal corners glide instead of snagging.
 */
function lateralSlideNormal(map: MapDefinition, p: Vec3, height: number): { nx: number; nz: number } | null {
  let bestDist = Infinity;
  let nx = 0, nz = 0;
  for (const s of nearbyCollisionSolids(map, p)) {
    if (!capsuleHitsSolid(s, p, height)) continue;
    if (s.kind === "box" && s.shape) {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-5) {
        const taper = s.shape === "cone" ? clamp(1 - Math.max(0, p.y - s.y) / Math.max(0.01, s.h), 0.05, 1) : 1;
        const gx = dx / Math.pow((s.w / 2) * taper + C.radius, 2);
        const gz = dz / Math.pow((s.d / 2) * taper + C.radius, 2);
        const gLen = Math.hypot(gx, gz);
        if (gLen > 1e-6 && len < bestDist) {
          bestDist = len;
          nx = gx / gLen;
          nz = gz / gLen;
        }
      }
    } else {
      const cx = clamp(p.x, s.x - s.w / 2, s.x + s.w / 2);
      const cz = clamp(p.z, s.z - s.d / 2, s.z + s.d / 2);
      const dx = p.x - cx;
      const dz = p.z - cz;
      const len = Math.hypot(dx, dz);
      if (len > 1e-5 && len < bestDist) {
        bestDist = len;
        nx = dx / len;
        nz = dz / len;
      }
    }
  }
  return bestDist < Infinity ? { nx, nz } : null;
}

export function move(
  m: MovementState,
  input: InputCommand,
  map: MapDefinition,
  tick: number,
) {
  if (
    ![m.position.x, m.position.y, m.position.z, m.velocity.x, m.velocity.y, m.velocity.z].every(Number.isFinite) ||
    m.position.y < -10 ||
    m.position.y > 40 ||
    Math.abs(m.position.x) > map.bounds + 2 ||
    Math.abs(m.position.z) > map.bounds + 2
  ) {
    Object.assign(m, newMovement(m.spawnPosition || map.spawns[0]));
    return;
  }

  // Recover embedded capsules without forcing a standing player out of valid crawl spaces.
  if (!fits(map, m.position, C.crouching)) {
    const saved = m.lastSafePosition;
    if (saved && fits(map, saved, C.crouching)) m.position = { ...saved };
    else {
      let clear: Vec3 | undefined;
      for (const radius of [0.15, 0.3, 0.5, 0.75, 1]) {
        for (let i = 0; i < 16; i++) {
          const q = {
            x: m.position.x + Math.cos((i * Math.PI) / 8) * radius,
            y: m.position.y,
            z: m.position.z + Math.sin((i * Math.PI) / 8) * radius,
          };
          q.y = support(map, q, q.y + C.step);
          if (
            Math.abs(q.y - m.position.y) <= C.step &&
            Math.abs(q.x) < map.bounds - C.radius &&
            Math.abs(q.z) < map.bounds - C.radius &&
            fits(map, q, C.crouching)
          ) {
            clear = q;
            break;
          }
        }
        if (clear) break;
      }
      m.position = clear || { ...(m.spawnPosition || map.spawns[0]) };
    }
    m.velocity = { x: 0, y: 0, z: 0 };
  }

  const dt = C.dt,
    p = m.position,
    v = m.velocity,
    wasGrounded = m.grounded,
    speed = Math.hypot(v.x, v.z);

  const wantsCrouch = input.crouch || !fits(map, p, C.standing);
  if (input.crouch && !m.crouchHeld && m.grounded && speed > 7) {
    m.slideUntil = tick + C.slideTicks;
    m.stance = "slide";
  } else {
    m.stance = wantsCrouch
      ? tick < m.slideUntil && m.grounded
        ? "slide"
        : "crouch"
      : "stand";
  }
  m.height = m.stance === "stand" ? C.standing : C.crouching;
  m.crouchHeld = input.crouch;

  if (m.grounded) {
    const friction = m.stance === "slide" ? C.slideFriction : C.friction;
    const drop = Math.max(0, speed - friction * Math.max(speed, 2) * dt);
    if (speed) {
      v.x *= drop / speed;
      v.z *= drop / speed;
    }
  }

  const mx = clamp(input.moveX, -1, 1),
    mz = clamp(input.moveZ, -1, 1),
    length = Math.hypot(mx, mz);
  const desired =
    m.stance === "crouch"
      ? C.crouchSpeed
      : input.sprint
        ? C.sprintSpeed
        : C.walkSpeed;

  if (length > 0 && m.stance !== "slide") {
    const dx =
        (mx * Math.cos(input.yaw) + mz * Math.sin(input.yaw)) /
        Math.max(1, length),
      dz =
        (-mx * Math.sin(input.yaw) + mz * Math.cos(input.yaw)) /
        Math.max(1, length);
    const wanted = desired * WEAPONS[input.weapon || "rifle"].mobility;
    const projection = v.x * dx + v.z * dz;
    const add = Math.max(
      0,
      Math.min(
        wanted - projection,
        (m.grounded ? C.groundAcceleration : C.airAcceleration) * dt,
      ),
    );
    v.x += dx * add;
    v.z += dz * add;
  }

  const jumping = input.jump && !m.jumpHeld && m.grounded && m.stance === "stand";
  if (jumping) {
    v.y = C.jumpSpeed;
    m.grounded = false;
  }
  m.jumpHeld = input.jump;

  const planar = Math.hypot(v.x, v.z);
  if (planar > C.maxSpeed) {
    v.x *= C.maxSpeed / planar;
    v.z *= C.maxSpeed / planar;
  }

  // Apply the first jump rise before testing lateral movement against an uphill surface.
  if (jumping) {
    v.y -= C.gravity * dt;
    const raised = { ...p, y: p.y + v.y * dt };
    if (fits(map, raised, m.height)) p.y = raised.y;
    else v.y = 0;
  }

  const steps = Math.max(1, Math.ceil((Math.hypot(v.x, v.z) * dt) / 0.1));
  const stepMax = wasGrounded ? C.step : v.y <= 0 ? 0.2 : 0;

  const tryLateralMove = (dx: number, dz: number): boolean => {
    const cand = { x: p.x + dx, y: p.y, z: p.z + dz };
    const floor = support(map, cand, cand.y + stepMax);
    if (v.y <= 0 && floor > cand.y && fits(map, { ...cand, y: floor }, m.height)) {
      p.x = cand.x;
      p.z = cand.z;
      p.y = floor;
      return true;
    }
    if (fits(map, cand, m.height)) {
      p.x = cand.x;
      p.z = cand.z;
      return true;
    }
    return false;
  };

  for (let i = 0; i < steps; i++) {
    const stepDx = (v.x * dt) / steps;
    const stepDz = (v.z * dt) / steps;

    // 1. Try combined diagonal/forward displacement first (eliminates axis-order bias on ramps & stairs)
    if (tryLateralMove(stepDx, stepDz)) continue;

    // 2. Try tangent slide along curved cylinders/cones or angled corners
    const probe = { x: p.x + stepDx, y: p.y, z: p.z + stepDz };
    const norm = lateralSlideNormal(map, probe, m.height);
    if (norm && Math.abs(norm.nx) > 0.05 && Math.abs(norm.nz) > 0.05) {
      const vn = v.x * norm.nx + v.z * norm.nz;
      if (vn < 0) {
        const svx = v.x - vn * norm.nx;
        const svz = v.z - vn * norm.nz;
        if (tryLateralMove((svx * dt) / steps, (svz * dt) / steps)) {
          v.x = svx;
          v.z = svz;
          continue;
        }
      }
    }

    // 3. Fallback to crisp axis-separated wall sliding
    for (const axis of ["x", "z"] as const) {
      const old = p[axis],
        oldY = p.y;
      p[axis] += (v[axis] * dt) / steps;
      const floor = support(map, p, p.y + stepMax);
      if (v.y <= 0 && floor > p.y && fits(map, { ...p, y: floor }, m.height)) {
        p.y = floor;
      }
      if (!fits(map, p, m.height)) {
        p[axis] = old;
        p.y = oldY;
        v[axis] = 0;
      }
    }
  }

  const limit = map.bounds - C.radius;
  if (Math.abs(p.x) > limit || Math.abs(p.z) > limit) {
    const bounded = { ...p, x: clamp(p.x, -limit, limit), z: clamp(p.z, -limit, limit) };
    if (!fits(map, bounded, m.height)) {
      const saved = m.lastSafePosition;
      const safe =
        saved && Math.abs(saved.x) <= limit && Math.abs(saved.z) <= limit && fits(map, saved, m.height)
          ? saved
          : m.spawnPosition || map.spawns[0];
      const spawn = m.spawnPosition;
      Object.assign(m, newMovement(safe));
      if (spawn) m.spawnPosition = spawn;
      return;
    }
    if (Math.abs(p.x) > limit) v.x = 0;
    if (Math.abs(p.z) > limit) v.z = 0;
    p.x = bounded.x;
    p.z = bounded.z;
  }

  const oldY = p.y;
  if (!jumping) v.y -= C.gravity * dt;
  const nextY = p.y + v.y * dt;
  if (!jumping && v.y > 0) {
    p.y = nextY;
    if (!fits(map, p, m.height)) {
      p.y = oldY;
      v.y = 0;
    }
  } else if (!jumping) {
    const floor = support(map, p, oldY + 0.05);
    // Descending a ramp can move the floor farther than one tick of gravity.
    // Keep existing ground contact over a small slope drop, never across a ledge.
    const followsRamp =
      wasGrounded &&
      nextY > floor &&
      oldY - floor <= 0.14 &&
      nearbyCollisionSolids(map, p).some(
        (s) => s.kind === "ramp" && overlaps(s, p) && Math.abs(surface(s, p.x, p.z) - floor) < 0.001,
      );
    p.y = followsRamp ? floor : Math.max(nextY, floor);
    m.grounded = followsRamp || nextY <= floor;
    if (!fits(map, p, m.height)) {
      // A rounded capsule may overhang a ledge while its feet are just below
      // the top. Resolve the landing before allowing the next downward step.
      const edgeTop = support(map, p, oldY + C.radius);
      p.y = edgeTop > oldY && fits(map, { ...p, y: edgeTop }, m.height) ? edgeTop : oldY;
      m.grounded = p.y === edgeTop;
      v.y = 0;
    }
    if (m.grounded) v.y = 0;
  }

  if (fits(map, p, m.height)) m.lastSafePosition = { ...p };
  if (
    ![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite) ||
    p.y < -10 ||
    p.y > 40
  ) {
    Object.assign(m, newMovement(m.spawnPosition || map.spawns[0]));
  }
}

/** Clip a ray against three axis-aligned slabs without allocating plane arrays. */
function rayBounds(
  o: Vec3,
  d: Vec3,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  range: number,
) {
  let enter = 0,
    exit = range;
  for (let axis = 0; axis < 3; axis++) {
    const origin = axis === 0 ? o.x : axis === 1 ? o.y : o.z;
    const direction = axis === 0 ? d.x : axis === 1 ? d.y : d.z;
    const low = axis === 0 ? minX : axis === 1 ? minY : minZ;
    const high = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;
    if (Math.abs(direction) < 1e-9) {
      if (origin < low || origin > high) return Infinity;
      continue;
    }
    const t1 = (low - origin) / direction;
    const t2 = (high - origin) / direction;
    enter = Math.max(enter, Math.min(t1, t2));
    exit = Math.min(exit, Math.max(t1, t2));
    if (enter > exit) return Infinity;
  }
  return enter <= exit ? enter : Infinity;
}

/** Ray/convex-solid intersection, including the actual ramp plane rather than its box. */
export function raySolid(origin: Vec3, dir: Vec3, s: Solid, range: number) {
  if (s.kind === "box" && !s.shape) {
    return rayBounds(origin, dir, s.x - s.w / 2, s.y, s.z - s.d / 2, s.x + s.w / 2, s.y + s.h, s.z + s.d / 2, range);
  }
  const planes: number[][] = [
    [1, 0, 0, s.x + s.w / 2],
    [-1, 0, 0, -s.x + s.w / 2],
    [0, 0, 1, s.z + s.d / 2],
    [0, 0, -1, -s.z + s.d / 2],
    [0, -1, 0, -s.y],
  ];
  if (s.kind === "box" && s.shape) {
    // Match Babylon's 12-sided elliptical barrels and 8-sided cones, not their invisible bounding-box corners.
    planes.splice(0, 4);
    const sides = s.shape === "cone" ? 8 : 12,
      apothem = Math.cos(Math.PI / sides);
    for (let i = 0; i < sides; i++) {
      const angle = ((i + 0.5) * Math.PI * 2) / sides,
        a = Math.cos(angle) / (s.w / 2),
        c = Math.sin(angle) / (s.d / 2),
        b = s.shape === "cone" ? apothem / s.h : 0;
      planes.push([a, b, c, a * s.x + c * s.z + apothem + b * s.y]);
    }
    planes.push([0, 1, 0, s.y + s.h]);
  } else {
    const k = ((s.reverse ? -1 : 1) * s.h) / (s.axis === "x" ? s.w : s.d),
      low = s.axis === "x" ? s.x - s.w / 2 : s.z - s.d / 2;
    planes.push(
      s.axis === "x"
        ? [-k, 1, 0, s.y + (s.reverse ? s.h : 0) - k * low]
        : [0, 1, -k, s.y + (s.reverse ? s.h : 0) - k * low],
    );
  }
  let enter = 0,
    exit = range;
  for (const [a, b, c, d] of planes) {
    const q = d - a * origin.x - b * origin.y - c * origin.z,
      den = a * dir.x + b * dir.y + c * dir.z;
    if (Math.abs(den) < 1e-9) {
      if (q < 0) return Infinity;
      continue;
    }
    const t = q / den;
    if (den > 0) exit = Math.min(exit, t);
    else enter = Math.max(enter, t);
    if (enter > exit) return Infinity;
  }
  return enter >= 0 && enter <= range ? enter : Infinity;
}

export function rayBox(o: Vec3, d: Vec3, min: Vec3, max: Vec3, range: number) {
  return rayBounds(o, d, min.x, min.y, min.z, max.x, max.y, max.z, range);
}
