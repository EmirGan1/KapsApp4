/** Cosmetic IDs only. No gameplay numbers are stored here. */
export const SKINS = {
  classic: { name: "Classic Soldier", body: "#657b64", trim: "#374839", accent: "#a3b18a", role: "Piyade", gear: "helmet" },
  urban: { name: "Urban Runner", body: "#678ba3", trim: "#ecad61", accent: "#22303c", role: "Keşif", gear: "hood" },
  neon: { name: "Neon Striker", body: "#526483", trim: "#60d9cc", accent: "#0f172a", role: "Sibernetik", gear: "antenna" },
  shadow: { name: "Shadow Operative", body: "#4a5263", trim: "#bf9ba8", accent: "#181d26", role: "Gizli Tim", gear: "visor" },
  desert: { name: "Desert Scout", body: "#bc9b70", trim: "#73604c", accent: "#3d3328", role: "Çöl Keşfi", gear: "hat" },
  arctic: { name: "Arctic Fighter", body: "#d4e1e6", trim: "#6389a6", accent: "#2b3e4f", role: "Kuzey Timi", gear: "parka" },
  cyber: { name: "Cyber Agent", body: "#796ba4", trim: "#bbd9e3", accent: "#1e1b33", role: "Tekno Ajan", gear: "fins" },
  street: { name: "Street Warrior", body: "#b57b68", trim: "#c4c7a3", accent: "#2d2522", role: "Sokak Timi", gear: "cap" },
  sas_night: { name: "SAS Gece Timi", body: "#2c343f", trim: "#4f6272", accent: "#74e88b", role: "Gece Op.", gear: "nvg" },
  gign_breach: { name: "GIGN Zırhlı Tim", body: "#22334d", trim: "#4b6991", accent: "#9fd3ff", role: "Baskın Timi", gear: "riot" },
  viper_ghillie: { name: "Viper Nişancı", body: "#42573c", trim: "#6e824f", accent: "#c2b280", role: "Keskin Nişancı", gear: "ghillie" },
  phoenix_raider: { name: "Anka Taarruz", body: "#6b2f2f", trim: "#d49a47", accent: "#2b2220", role: "Taarruz Birliği", gear: "beret" },
  ghost_mask: { name: "Hayalet İnfazcı", body: "#34373d", trim: "#8b929e", accent: "#e5e7eb", role: "Özel Harekât", gear: "skullmask" },
  warden_elite: { name: "Zırhlı Komutan", body: "#3c4654", trim: "#c79a4b", accent: "#38bdf8", role: "Komuta", gear: "exovisor" },
  ksk_commando: { name: "KSK Komando", body: "#565a44", trim: "#917d57", accent: "#d97706", role: "Dağ Komando", gear: "headset" },
  titan_heavy: { name: "Ağır Zırhlı Titan", body: "#3e4246", trim: "#b44332", accent: "#f59e0b", role: "Ağır Taarruz", gear: "juggernaut" },
} as const;

export type SkinId = keyof typeof SKINS;

export function isSkin(value: unknown): value is SkinId {
  return typeof value === "string" && Object.hasOwn(SKINS, value);
}

const legacySkins: Record<string, SkinId> = {
  classic_soldier: "classic",
  urban_runner: "urban",
  neon_striker: "neon",
  shadow_operative: "shadow",
  desert_scout: "desert",
  arctic_fighter: "arctic",
  cyber_agent: "cyber",
  street_warrior: "street",
};

export function cleanSkin(value: unknown): SkinId {
  return isSkin(value)
    ? value
    : typeof value === "string" && Object.hasOwn(legacySkins, value)
      ? legacySkins[value]
      : "classic";
}
