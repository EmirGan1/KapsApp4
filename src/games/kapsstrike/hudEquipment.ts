import { GRENADE_KEYS, GRENADE_NAMES, type GrenadeKind } from "./grenades";
import { WEAPONS, WEAPON_ORDER } from "./config";
import type { WeaponId } from "./types";

export interface EquipmentHudInput {
  weapon?: WeaponId;
  ammo?: number;
  capacity?: number;
  inventory?: WeaponId[];
  utilityEquipped?: GrenadeKind;
  utilityCount?: number;
  utilityInventory?: Partial<Record<GrenadeKind, number>>;
  bombEquipped?: boolean;
  isBombCarrier?: boolean;
  armor?: number;
}

export interface TopRightWeaponSlot {
  kind: "weapon";
  id: WeaponId;
  label: string;
  sublabel: string;
  color: string;
  active: boolean;
}

export interface TopRightGrenadeSlot {
  kind: "grenade";
  id: GrenadeKind;
  label: string;
  count: number;
  active: boolean;
}

export interface TopRightBombSlot {
  kind: "bomb";
  id: "c4";
  label: string;
  sublabel: string;
  active: boolean;
}

export type TopRightEquipmentSlot =
  | TopRightWeaponSlot
  | TopRightGrenadeSlot
  | TopRightBombSlot;

export interface TouchCombatButtonState {
  mode: "weapon_attack" | "grenade_throw";
  showAttackButton: boolean;
  showGrenadeThrowButtons: boolean;
  activeGrenade?: GrenadeKind;
  activeGrenadeName?: string;
  activeGrenadeCount?: number;
}

/**
 * Determines whether the mobile/tablet touch HUD should display the standard
 * Attack (Fire) button or replace it exclusively with "Yakına At" / "Uzağa At"
 * grenade throw buttons while a grenade is held in hand.
 */
export function getTouchCombatButtonState(hud?: EquipmentHudInput | null): TouchCombatButtonState {
  const activeGrenade = hud?.utilityEquipped;
  if (activeGrenade) {
    const count =
      hud?.utilityCount ??
      hud?.utilityInventory?.[activeGrenade] ??
      1;
    return {
      mode: "grenade_throw",
      showAttackButton: false,
      showGrenadeThrowButtons: true,
      activeGrenade,
      activeGrenadeName: GRENADE_NAMES[activeGrenade],
      activeGrenadeCount: count,
    };
  }
  return {
    mode: "weapon_attack",
    showAttackButton: true,
    showGrenadeThrowButtons: false,
  };
}

/**
 * Builds the unified list of Weapons, Grenades, and C4 for the Top-Right
 * Weapon & Equipment Switcher on mobile and tablet.
 */
export function getTopRightEquipmentSlots(
  hud?: EquipmentHudInput | null,
  hiddenWeapons: WeaponId[] = [],
  isBombRoom = false
): {
  weapons: TopRightWeaponSlot[];
  grenades: TopRightGrenadeSlot[];
  bombSlot: TopRightBombSlot | null;
  activeSummary: { title: string; subtitle: string; badgeColor: string; isGrenade: boolean; isBomb: boolean };
} {
  const rawWeapons = hud?.inventory && hud.inventory.length > 0
    ? hud.inventory
    : WEAPON_ORDER.slice(0, 6);

  const visibleWeapons = rawWeapons.filter(
    (wId) => isBombRoom || wId === "knife" || !hiddenWeapons.includes(wId)
  );

  const isHoldingGrenade = Boolean(hud?.utilityEquipped);
  const isHoldingBomb = Boolean(hud?.bombEquipped);
  const currentWeapon: WeaponId = hud?.weapon || "rifle";

  const weapons: TopRightWeaponSlot[] = visibleWeapons.map((wId) => {
    const spec = WEAPONS[wId];
    const isCurrent = !isHoldingGrenade && !isHoldingBomb && currentWeapon === wId;
    const sublabel =
      wId === "knife"
        ? "Yakın Dövüş"
        : isCurrent && hud?.ammo !== undefined && hud?.capacity !== undefined
        ? `${hud.ammo} / ${hud.capacity}`
        : `${spec.capacity} Mermi`;
    return {
      kind: "weapon",
      id: wId,
      label: spec.name,
      sublabel,
      color: spec.color,
      active: isCurrent,
    };
  });

  const grenades: TopRightGrenadeSlot[] = [];
  for (const gKey of GRENADE_KEYS) {
    const count = hud?.utilityInventory?.[gKey] ?? (hud?.utilityEquipped === gKey ? (hud?.utilityCount ?? 1) : 0);
    if (count > 0) {
      grenades.push({
        kind: "grenade",
        id: gKey,
        label: GRENADE_NAMES[gKey],
        count,
        active: hud?.utilityEquipped === gKey,
      });
    }
  }

  const bombSlot: TopRightBombSlot | null = hud?.isBombCarrier
    ? {
        kind: "bomb",
        id: "c4",
        label: "C4 Patlayıcı",
        sublabel: "Görev Ekipmanı",
        active: Boolean(hud?.bombEquipped),
      }
    : null;

  let activeSummary: { title: string; subtitle: string; badgeColor: string; isGrenade: boolean; isBomb: boolean };
  if (hud?.utilityEquipped) {
    const gName = GRENADE_NAMES[hud.utilityEquipped];
    const gCount = hud.utilityCount ?? hud.utilityInventory?.[hud.utilityEquipped] ?? 1;
    activeSummary = {
      title: gName,
      subtitle: `Elde Bomba · ×${gCount}`,
      badgeColor: "#f59e0b",
      isGrenade: true,
      isBomb: false,
    };
  } else if (hud?.bombEquipped) {
    activeSummary = {
      title: "C4 Patlayıcı",
      subtitle: "Kuruluma Hazır",
      badgeColor: "#ef4444",
      isGrenade: false,
      isBomb: true,
    };
  } else {
    const wSpec = WEAPONS[currentWeapon] || WEAPONS.rifle;
    activeSummary = {
      title: wSpec.name,
      subtitle:
        currentWeapon === "knife"
          ? "Taktik Bıçak"
          : `${hud?.ammo ?? wSpec.capacity} / ${hud?.capacity ?? wSpec.capacity}`,
      badgeColor: wSpec.color || "#ecc17b",
      isGrenade: false,
      isBomb: false,
    };
  }

  return { weapons, grenades, bombSlot, activeSummary };
}

/**
 * Produces a read-only summary of the player's inventory contents for the
 * non-interactive inventory status box (no grenade equip/throw buttons).
 */
export function getReadOnlyInventoryContents(params: {
  weapons?: WeaponId[];
  utility?: Partial<Record<GrenadeKind, number>>;
  armor?: number;
  kit?: boolean;
  isCarrier?: boolean;
}): {
  weaponNames: string[];
  grenadeItems: { kind: GrenadeKind; label: string; count: number }[];
  equipmentTags: string[];
} {
  const weaponNames = (params.weapons ?? []).map((w) => WEAPONS[w]?.name || w);
  const grenadeItems: { kind: GrenadeKind; label: string; count: number }[] = [];
  for (const gKey of GRENADE_KEYS) {
    const c = params.utility?.[gKey] ?? 0;
    if (c > 0) {
      grenadeItems.push({ kind: gKey, label: GRENADE_NAMES[gKey], count: c });
    }
  }
  const equipmentTags: string[] = [];
  if ((params.armor ?? 0) > 0) {
    equipmentTags.push(`Zırh +${Math.ceil(params.armor ?? 0)}`);
  }
  if (params.kit) {
    equipmentTags.push("Çözme Kiti");
  }
  if (params.isCarrier) {
    equipmentTags.push("C4 Taşıyıcı");
  }
  return { weaponNames, grenadeItems, equipmentTags };
}
