import {
  Vec3,
  MovementState,
  InputCommand,
  MapDefinition,
  Solid,
} from "./types";
import { PHYSICS as C, WEAPONS } from "./config";
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export function surface(s: Solid, x: number, z: number) {
  return (
    s.y +
    (s.kind === "ramp"
      ? s.h *
        clamp(
          s.axis === "x"
            ? (x - (s.x - s.w / 2)) / s.w
            : (z - (s.z - s.d / 2)) / s.d,
          0,
          1,
        )
      : s.h)
  );
}
export function overlaps(s: Solid, p: Vec3, r = C.radius) {
  const dx = p.x - clamp(p.x, s.x - s.w / 2, s.x + s.w / 2),
    dz = p.z - clamp(p.z, s.z - s.d / 2, s.z + s.d / 2);
  return dx * dx + dz * dz < r * r - 1e-8;
}
export function fits(map: MapDefinition, p: Vec3, height: number) {
  return !map.solids.some((s) => {
    if (s.detail) return false;
    if (s.kind === "ramp")
      return (
        overlaps(s, p) &&
        p.y + height > s.y + 0.001 &&
        p.y < surface(s, p.x, p.z) - 0.001
      );
    const dx = p.x - clamp(p.x, s.x - s.w / 2, s.x + s.w / 2),
      dz = p.z - clamp(p.z, s.z - s.d / 2, s.z + s.d / 2);
    const low = p.y + C.radius,
      high = p.y + height - C.radius,
      dy = low > s.y + s.h ? low - s.y - s.h : high < s.y ? s.y - high : 0;
    return dx * dx + dy * dy + dz * dz < C.radius * C.radius - 1e-6;
  });
}
export function support(map: MapDefinition, p: Vec3, maxY: number) {
  let y = 0;
  for (const s of map.solids) {
    if (s.detail || !overlaps(s, p, C.radius)) continue;
    const top = surface(s, p.x, p.z);
    if (top <= maxY + 0.001) y = Math.max(y, top);
  }
  return y;
}
export function newMovement(position: Vec3): MovementState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    grounded: true,
    stance: "stand",
    slideUntil: 0,
    height: C.standing,
    jumpHeld: false,
    crouchHeld: false,
  };
}
export function move(
  m: MovementState,
  input: InputCommand,
  map: MapDefinition,
  tick: number,
) {
  const dt = C.dt,
    p = m.position,
    v = m.velocity,
    wasGrounded = m.grounded,
    speed = Math.hypot(v.x, v.z);
  const wantsCrouch = input.crouch || !fits(map, p, C.standing);
  if (input.crouch && !m.crouchHeld && m.grounded && speed > 7) {
    m.slideUntil = tick + C.slideTicks;
    m.stance = "slide";
  } else
    m.stance = wantsCrouch
      ? tick < m.slideUntil && m.grounded
        ? "slide"
        : "crouch"
      : "stand";
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
  if (input.jump && !m.jumpHeld && m.grounded && m.stance === "stand") {
    v.y = C.jumpSpeed;
    m.grounded = false;
  }
  m.jumpHeld = input.jump;
  const planar = Math.hypot(v.x, v.z);
  if (planar > C.maxSpeed) {
    v.x *= C.maxSpeed / planar;
    v.z *= C.maxSpeed / planar;
  }
  const steps = Math.max(1, Math.ceil((Math.hypot(v.x, v.z) * dt) / 0.1));
  for (let i = 0; i < steps; i++)
    for (const axis of ["x", "z"] as const) {
      const old = p[axis],
        oldY = p.y;
      p[axis] += (v[axis] * dt) / steps;
      const floor = support(map, p, p.y + (wasGrounded ? C.step : 0));
      if (wasGrounded && v.y <= 0 && floor > p.y) p.y = floor;
      if (!fits(map, p, m.height)) {
        p[axis] = old;
        p.y = oldY;
        v[axis] = 0;
      }
    }
  p.x = clamp(p.x, -map.bounds + C.radius, map.bounds - C.radius);
  p.z = clamp(p.z, -map.bounds + C.radius, map.bounds - C.radius);
  const oldY = p.y;
  v.y -= C.gravity * dt;
  const nextY = p.y + v.y * dt;
  if (v.y > 0) {
    p.y = nextY;
    if (!fits(map, p, m.height)) {
      p.y = oldY;
      v.y = 0;
    }
  } else {
    const floor = support(map, p, oldY + 0.03);
    if (nextY <= floor) {
      p.y = floor;
      v.y = 0;
      m.grounded = true;
    } else {
      p.y = nextY;
      m.grounded = false;
    }
  }
  if (
    ![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite) ||
    p.y < -10 ||
    p.y > 40
  ) {
    Object.assign(m, newMovement(map.spawns[0]));
  }
}
/** Ray/convex-solid intersection, including the actual ramp plane rather than its box. */
export function raySolid(origin: Vec3, dir: Vec3, s: Solid, range: number) {
  const planes: number[][] = [
    [1, 0, 0, s.x + s.w / 2],
    [-1, 0, 0, -s.x + s.w / 2],
    [0, 0, 1, s.z + s.d / 2],
    [0, 0, -1, -s.z + s.d / 2],
    [0, -1, 0, -s.y],
  ];
  if (s.kind === "box") planes.push([0, 1, 0, s.y + s.h]);
  else {
    const k = s.h / (s.axis === "x" ? s.w : s.d),
      low = s.axis === "x" ? s.x - s.w / 2 : s.z - s.d / 2;
    planes.push(
      s.axis === "x" ? [-k, 1, 0, s.y - k * low] : [0, 1, -k, s.y - k * low],
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
  return raySolid(
    o,
    d,
    {
      id: "hitbox",
      kind: "box",
      x: (min.x + max.x) / 2,
      y: min.y,
      z: (min.z + max.z) / 2,
      w: max.x - min.x,
      h: max.y - min.y,
      d: max.z - min.z,
      color: "",
    },
    range,
  );
}
