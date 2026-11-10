import type { MapDefinition, Vec3 } from "./types";
import { collisionSolids, raySolid, support } from "./physics";

export const GRENADE_NAMES = { flash: "Flaş bombası", frag: "El bombası", smoke: "Sis bombası" } as const;
export type GrenadeKind = keyof typeof GRENADE_NAMES;
export const GRENADE_KEYS: GrenadeKind[] = ["flash", "frag", "smoke"];
export const SMOKE_RADIUS = 3.8;
export type Grenade = {
  id: string; kind: GrenadeKind; actor: string; team: string; position: Vec3; velocity: Vec3;
  detonate: number; expires?: number;
};

export function isGrenade(value: unknown): value is GrenadeKind {
  return typeof value === "string" && Object.hasOwn(GRENADE_NAMES, value);
}

export function grenadeLaunch(id: string, kind: GrenadeKind, actor: string, team: string, origin: Vec3, direction: Vec3, now: number, short: boolean): Grenade {
  const speed = short ? 5.5 : 17;
  return {
    id, kind, actor, team, position: { ...origin },
    velocity: { x: direction.x * speed, y: direction.y * speed + (short ? 1.8 : 4), z: direction.z * speed },
    detonate: now + (kind === "frag" ? 1.45 : 1.25),
  };
}

export function grenadeLineClear(map: MapDefinition, from: Vec3, to: Vec3) {
  const x = to.x-from.x, y = to.y-from.y, z = to.z-from.z;
  const distance = Math.hypot(x,y,z);
  if (distance < .001) return true;
  const direction = { x:x/distance, y:y/distance, z:z/distance };
  return !collisionSolids(map).some(solid => raySolid(from,direction,solid,distance) < distance-.01);
}

export function stepGrenade(grenade: Grenade, map: MapDefinition, dt: number, now: number): boolean {
  if (grenade.expires !== undefined) return false;
  const p = grenade.position, v = grenade.velocity;
  v.y -= 16 * dt;
  const next = {x:p.x+v.x*dt,y:p.y+v.y*dt,z:p.z+v.z*dt};
  const floor = support(map,next,p.y);
  if (!grenadeLineClear(map,p,next) || Math.abs(next.x)>map.bounds || Math.abs(next.z)>map.bounds) {
    v.x *= -.28; v.z *= -.28; v.y = Math.max(0,-v.y * .22);
  } else if (next.y <= floor + .12) {
    grenade.position = {...next,y:floor+.12};
    v.x *= .56; v.z *= .56; v.y = Math.abs(v.y) > 2 ? -v.y * .22 : 0;
  } else grenade.position = next;
  if (now < grenade.detonate) return false;
  grenade.expires = now + (grenade.kind === "smoke" ? 11 : .23);
  return true;
}

export function grenadeEffect(kind: GrenadeKind, map: MapDefinition, origin: Vec3, eye: Vec3, facing: Vec3) {
  const dx=origin.x-eye.x,dy=origin.y-eye.y,dz=origin.z-eye.z;
  const distance=Math.hypot(dx,dy,dz);
  const range=kind==="flash"?15:6;
  if (kind==="smoke" || distance>=range || !grenadeLineClear(map,origin,eye)) return 0;
  if (kind==="frag") return Math.ceil(82*(1-distance/range));
  const dot=distance>.001?(dx*facing.x+dy*facing.y+dz*facing.z)/distance:1;
  return (1-distance/range)*(dot>.25?2.8:.55);
}
