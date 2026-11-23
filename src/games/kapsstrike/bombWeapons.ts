import { isBombPrimary, type BombMatch } from "./bomb";
import type { MapDefinition, PlayerState, StrikeWorld, WeaponId } from "./types";
import { nearestSupply, DROP_INTERVAL } from "./world";
import { PHYSICS as C, WEAPONS } from "./config";
import { collisionSolids, raySolid, support } from "./physics";

/**
 * Resolves the active weapon skin for a player, prioritizing any picked-up ground
 * weapon's inherited skin ("" = explicitly stock/unskinned) over the player's loadout.
 */
export function resolveActiveWeaponSkin(
  p: PlayerState,
  weapon: WeaponId,
  cosmeticLoadout?: Partial<Record<WeaponId, string>>,
): string | undefined {
  const picked = p.weapon.pickedSkins?.[weapon];
  if (picked !== undefined) return picked || undefined;
  return cosmeticLoadout?.[weapon];
}

/**
 * Computes a grounded drop position slightly in front of the player (on voluntary drop)
 * without clipping through walls, or directly at the player's feet on death.
 */
function computeGroundedDropPosition(
  p: PlayerState,
  map: MapDefinition | undefined,
  death: boolean,
) {
  const base = { ...p.movement.position };
  if (!map) return base;
  if (!death) {
    const fwdX = Math.sin(p.yaw);
    const fwdZ = Math.cos(p.yaw);
    const eye = { x: base.x, y: base.y + 1.0, z: base.z };
    const dist = 0.85;
    const blocked = collisionSolids(map).some(
      (s) => raySolid(eye, { x: fwdX, y: 0, z: fwdZ }, s, dist) < dist - 0.08,
    );
    if (!blocked) {
      const candidate = { x: base.x + fwdX * dist, y: base.y, z: base.z + fwdZ * dist };
      const floorY = support(map, candidate, base.y + C.step);
      if (Math.abs(floorY - base.y) <= 1.2) {
        return { x: candidate.x, y: floorY, z: candidate.z };
      }
    }
  }
  base.y = support(map, base, base.y + C.step);
  return base;
}

/** Server-owned drops preserve ammunition and equipped skin; picking up never creates money or duplicate guns. */
export function dropBombWeapon(
  m: BombMatch,
  w: StrikeWorld,
  p: PlayerState,
  tick: number,
  death = false,
  cosmeticLoadout?: Partial<Record<WeaponId, string>>,
  map?: MapDefinition,
) {
  const owner = m.players[p.id],
    weapon = p.weapon.selected;
  if (
    !owner ||
    (!death && (!owner.alive || p.hp <= 0)) ||
    !["buy", "active", "planted"].includes(m.phase) ||
    !isBombPrimary(weapon) ||
    !owner.weapons.includes(weapon)
  )
    return false;

  const skinId = resolveActiveWeaponSkin(p, weapon, cosmeticLoadout);
  const position = computeGroundedDropPosition(p, map, death);
  w.pickups.push({
    id: `weapon-${++w.serial}`,
    position,
    weapon,
    ammo: p.weapon.ammo[weapon],
    kind: "dropped",
    opened: false,
    expires: tick + DROP_INTERVAL,
    ...(skinId ? { skinId } : {}),
    yaw: p.yaw,
  });
  if (p.weapon.pickedSkins) {
    delete p.weapon.pickedSkins[weapon];
  }
  owner.weapons = owner.weapons.filter((id) => id !== weapon);
  delete owner.purchase;
  p.weapon.inventory = [...owner.weapons];
  p.weapon.selected = owner.weapons.includes("pistol") ? "pistol" : "knife";
  p.weapon.reloadUntil = 0;
  p.weapon.switchUntil = tick + 24;
  return true;
}

export function pickupBombWeapon(
  m: BombMatch,
  w: StrikeWorld,
  map: MapDefinition,
  p: PlayerState,
  tick: number,
  cosmeticLoadout?: Partial<Record<WeaponId, string>>,
) {
  const owner = m.players[p.id];
  if (!owner?.alive || p.hp <= 0 || !["buy", "active", "planted"].includes(m.phase)) return false;
  const item = nearestSupply(w, map, p);
  if (!item || item.kind !== "dropped" || !isBombPrimary(item.weapon) || owner.weapons.includes(item.weapon))
    return false;
  // Drop the existing firearm before accepting the new one. Consume atomically on the server.
  const previous = owner.weapons.find(isBombPrimary);
  if (previous) {
    p.weapon.selected = previous;
    dropBombWeapon(m, w, p, tick, false, cosmeticLoadout, map);
  }
  item.opened = true;
  item.expires = tick + 1;
  delete owner.purchase;
  owner.weapons.push(item.weapon);
  p.weapon.inventory = [...owner.weapons];
  p.weapon.selected = item.weapon;
  p.weapon.ammo[item.weapon] = Math.max(0, Math.min(WEAPONS[item.weapon].capacity, item.ammo ?? 0));
  p.weapon.pickedSkins = { ...(p.weapon.pickedSkins || {}), [item.weapon]: item.skinId ?? "" };
  p.weapon.reloadUntil = 0;
  p.weapon.switchUntil = tick + 24;
  p.weapon.triggerHeld = true;
  return true;
}
